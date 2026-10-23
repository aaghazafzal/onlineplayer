/**
 * Joins a video-only and an audio-only fragmented MP4 (YouTube's DASH files) into one
 * fragmented MP4 with both tracks, without decoding anything: the boxes are re-assembled
 * and track ids patched. Output plays in browsers, VLC, phones and most editors.
 */

interface Box {
  type: string;
  start: number; // offset of the box header in its buffer
  headerSize: number;
  end: number; // exclusive
}

const enc = new TextEncoder();

function readBoxes(buf: Uint8Array, from = 0, to = buf.length): Box[] {
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const out: Box[] = [];
  let p = from;
  while (p + 8 <= to) {
    let size = view.getUint32(p);
    const type = String.fromCharCode(buf[p + 4], buf[p + 5], buf[p + 6], buf[p + 7]);
    let headerSize = 8;
    if (size === 1) {
      size = Number(view.getBigUint64(p + 8));
      headerSize = 16;
    } else if (size === 0) {
      size = to - p;
    }
    if (size < headerSize || p + size > to) break; // truncated or corrupt: stop here
    out.push({ type, start: p, headerSize, end: p + size });
    p += size;
  }
  return out;
}

const children = (buf: Uint8Array, box: Box) => readBoxes(buf, box.start + box.headerSize, box.end);
const child = (buf: Uint8Array, box: Box, type: string) => children(buf, box).find((b) => b.type === type);
const slice = (buf: Uint8Array, box: Box) => buf.slice(box.start, box.end);

function box(type: string, ...parts: Uint8Array[]): Uint8Array {
  const size = 8 + parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(size);
  new DataView(out.buffer).setUint32(0, size);
  out.set(enc.encode(type), 4);
  let p = 8;
  for (const part of parts) {
    out.set(part, p);
    p += part.length;
  }
  return out;
}

function concat(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let p = 0;
  for (const part of parts) {
    out.set(part, p);
    p += part.length;
  }
  return out;
}

/** Copy of a box with one 32-bit field (at `offset` from the box start) replaced */
function patch32(bytes: Uint8Array, offset: number, value: number): Uint8Array {
  const copy = bytes.slice();
  new DataView(copy.buffer).setUint32(offset, value);
  return copy;
}

function fullBoxVersion(buf: Uint8Array, b: Box) {
  return buf[b.start + b.headerSize];
}

interface Track {
  buf: Uint8Array;
  ftyp: Box | undefined;
  moov: Box;
  trak: Box;
  trex: Box | undefined;
  mvhd: Box | undefined;
  mehd: Box | undefined;
  timescale: number;
  fragments: { moof: Box; mdat: Box }[];
}

function readTrack(buf: Uint8Array, label: string): Track {
  const top = readBoxes(buf);
  const moov = top.find((b) => b.type === "moov");
  if (!moov) throw new Error(`The ${label} file has no moov box`);
  const trak = child(buf, moov, "trak");
  if (!trak) throw new Error(`The ${label} file has no track`);
  const mvex = child(buf, moov, "mvex");
  const mdia = child(buf, trak, "mdia");
  const mdhd = mdia && child(buf, mdia, "mdhd");
  if (!mdhd) throw new Error(`The ${label} track has no mdhd box`);
  const tsOffset = mdhd.start + mdhd.headerSize + 4 + (fullBoxVersion(buf, mdhd) === 1 ? 16 : 8);
  const timescale = new DataView(buf.buffer, buf.byteOffset).getUint32(tsOffset);

  const fragments: { moof: Box; mdat: Box }[] = [];
  for (let i = 0; i < top.length; i++) {
    if (top[i].type === "moof" && top[i + 1]?.type === "mdat") {
      fragments.push({ moof: top[i], mdat: top[i + 1] });
      i++;
    }
  }
  if (!fragments.length) throw new Error(`The ${label} file has no media fragments`);
  return {
    buf,
    ftyp: top.find((b) => b.type === "ftyp"),
    moov,
    trak,
    trex: mvex && child(buf, mvex, "trex"),
    mvhd: child(buf, moov, "mvhd"),
    mehd: mvex && child(buf, mvex, "mehd"),
    timescale,
    fragments,
  };
}

/** trak with its tkhd track_ID set to `id` */
function retrack(t: Track, id: number): Uint8Array {
  const trakBytes = slice(t.buf, t.trak);
  const local = readBoxes(trakBytes, t.trak.headerSize);
  const tkhd = local.find((b) => b.type === "tkhd");
  if (!tkhd) throw new Error("Track has no tkhd box");
  const off = tkhd.start + tkhd.headerSize + 4 + (trakBytes[tkhd.start + tkhd.headerSize] === 1 ? 16 : 8);
  return patch32(trakBytes, off, id);
}

function trexFor(t: Track, id: number): Uint8Array {
  if (t.trex) return patch32(slice(t.buf, t.trex), t.trex.headerSize + 4, id);
  // defaults: description index 1, everything else 0
  const body = new Uint8Array(24);
  const v = new DataView(body.buffer);
  v.setUint32(4, id);
  v.setUint32(8, 1);
  return box("trex", body);
}

/** One moof with track id, sequence number and absolute base offsets rewritten */
function rewriteMoof(t: Track, moof: Box, id: number, seq: number, newMoofOffset: number): { bytes: Uint8Array; time: number } {
  const bytes = slice(t.buf, moof);
  const view = new DataView(bytes.buffer);
  let time = 0;
  for (const b of readBoxes(bytes, moof.headerSize)) {
    if (b.type === "mfhd") view.setUint32(b.start + b.headerSize + 4, seq);
    if (b.type !== "traf") continue;
    for (const c of readBoxes(bytes, b.start + b.headerSize, b.end)) {
      const body = c.start + c.headerSize;
      if (c.type === "tfhd") {
        const flags = view.getUint32(body) & 0xffffff;
        view.setUint32(body + 4, id);
        if (flags & 0x1) {
          // absolute base-data-offset: keep it pointing at the same bytes after the move
          const oldBase = Number(view.getBigUint64(body + 8));
          view.setBigUint64(body + 8, BigInt(newMoofOffset + (oldBase - moof.start)));
        }
      } else if (c.type === "tfdt") {
        const version = bytes[body];
        const decode = version === 1 ? Number(view.getBigUint64(body + 4)) : view.getUint32(body + 4);
        time = decode / t.timescale;
      }
    }
  }
  return { bytes, time };
}

/** Returns one MP4 file (as bytes) with the video track and the audio track */
export function muxVideoAudio(videoBytes: Uint8Array, audioBytes: Uint8Array): Uint8Array {
  const v = readTrack(videoBytes, "video");
  const a = readTrack(audioBytes, "audio");

  const ftyp = v.ftyp ? slice(v.buf, v.ftyp) : box("ftyp", enc.encode("iso5"), new Uint8Array([0, 0, 0, 1]), enc.encode("iso5iso6mp41"));
  if (!v.mvhd) throw new Error("The video file has no mvhd box");
  const mvhdIn = slice(v.buf, v.mvhd);
  // next_track_ID is the last field of mvhd
  const mvhd = patch32(mvhdIn, mvhdIn.length - 4, 3);
  const mvex = box("mvex", ...(v.mehd ? [slice(v.buf, v.mehd)] : []), trexFor(v, 1), trexFor(a, 2));
  const moov = box("moov", mvhd, retrack(v, 1), retrack(a, 2), mvex);

  // Interleave fragments by decode time so players never starve one track
  type Frag = { t: Track; id: number; moof: Box; mdat: Box; time: number };
  const frags: Frag[] = [];
  for (const [t, id] of [[v, 1], [a, 2]] as [Track, number][]) {
    for (const f of t.fragments) frags.push({ t, id, moof: f.moof, mdat: f.mdat, time: rewriteMoof(t, f.moof, id, 0, 0).time });
  }
  frags.sort((x, y) => x.time - y.time || x.id - y.id);

  const parts: Uint8Array[] = [ftyp, moov];
  let offset = ftyp.length + moov.length;
  frags.forEach((f, i) => {
    const { bytes } = rewriteMoof(f.t, f.moof, f.id, i + 1, offset);
    const mdat = f.t.buf.subarray(f.mdat.start, f.mdat.end);
    parts.push(bytes, mdat);
    offset += bytes.length + mdat.length;
  });
  return concat(parts);
}
