/**
 * Turns YouTube's DASH formats (fragmented MP4 with a sidx index) into HLS playlists
 * that hls.js and Safari can play: one fMP4 init segment plus byte-range segments.
 * Pure functions, unit-tested.
 */

/** Parse an ISO-BMFF `sidx` box. `bytes` starts at the box; `indexEnd` is the box's last byte in the file. */
export function parseSidx(bytes, indexEnd) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const size = view.getUint32(0);
  const type = String.fromCharCode(bytes[4], bytes[5], bytes[6], bytes[7]);
  if (type !== "sidx") throw new Error(`Expected sidx box, found ${type}`);
  const version = bytes[8];
  let p = 12 + 4; // header + version/flags + reference_ID
  const timescale = view.getUint32(p);
  p += 4;
  let firstOffset;
  if (version === 0) {
    p += 4; // earliest_presentation_time
    firstOffset = view.getUint32(p);
    p += 4;
  } else {
    p += 8;
    firstOffset = Number(view.getBigUint64(p));
    p += 8;
  }
  p += 2; // reserved
  const count = view.getUint16(p);
  p += 2;
  // offsets are relative to the first byte after the sidx box
  let offset = indexEnd + 1 + firstOffset;
  const refs = [];
  for (let i = 0; i < count; i++) {
    const word = view.getUint32(p);
    const refSize = word & 0x7fffffff;
    const duration = view.getUint32(p + 4);
    refs.push({ offset, size: refSize, duration: duration / timescale });
    offset += refSize;
    p += 12;
  }
  if (p > size) throw new Error("Truncated sidx box");
  return { timescale, refs };
}

/** Merge consecutive references into segments of about `target` seconds, never above `maxBytes`. */
export function mergeRefs(refs, target = 20, maxBytes = 8 * 1024 * 1024) {
  const out = [];
  let cur = null;
  for (const r of refs) {
    if (cur && cur.duration + r.duration <= target * 1.25 && cur.size + r.size <= maxBytes && cur.duration < target) {
      cur.size += r.size;
      cur.duration += r.duration;
    } else {
      if (cur) out.push(cur);
      cur = { offset: r.offset, size: r.size, duration: r.duration };
    }
  }
  if (cur) out.push(cur);
  return out;
}

/** HLS media playlist for one format. `segUrl` is the URL every byte range is read from. */
export function mediaPlaylist({ initEnd, segments, segUrl }) {
  const target = Math.max(1, Math.ceil(Math.max(...segments.map((s) => s.duration))));
  const lines = [
    "#EXTM3U",
    "#EXT-X-VERSION:7",
    `#EXT-X-TARGETDURATION:${target}`,
    "#EXT-X-PLAYLIST-TYPE:VOD",
    "#EXT-X-MEDIA-SEQUENCE:0",
    "#EXT-X-INDEPENDENT-SEGMENTS",
    `#EXT-X-MAP:URI="${segUrl}",BYTERANGE="${initEnd + 1}@0"`,
  ];
  for (const s of segments) {
    lines.push(`#EXTINF:${s.duration.toFixed(3)},`, `#EXT-X-BYTERANGE:${s.size}@${s.offset}`, segUrl);
  }
  lines.push("#EXT-X-ENDLIST", "");
  return lines.join("\n");
}

const codecsOf = (mime = "") => (mime.match(/codecs="([^"]+)"/) || [])[1] || "";

/**
 * Pick playable formats: H.264 MP4 video (one per height) and AAC audio, each with the
 * init/index ranges HLS needs. Returns { videos: [...], audio } sorted high to low.
 */
export function pickHlsFormats(streamingData) {
  const adaptive = (streamingData?.adaptiveFormats || []).filter((f) => f.url && f.initRange && f.indexRange);
  const byHeight = new Map();
  for (const f of adaptive) {
    if (!f.mimeType?.startsWith("video/mp4") || !codecsOf(f.mimeType).startsWith("avc1")) continue;
    const prev = byHeight.get(f.height);
    // keep the higher-bitrate (usually 30fps over 60fps-less) variant per height
    if (!prev || (f.bitrate || 0) > (prev.bitrate || 0)) byHeight.set(f.height, f);
  }
  const videos = [...byHeight.values()].sort((a, b) => b.height - a.height);
  const audio =
    adaptive.find((f) => f.itag === 140) ||
    adaptive.filter((f) => f.mimeType?.startsWith("audio/mp4")).sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0))[0] ||
    null;
  return { videos, audio };
}

export function masterPlaylist({ videos, audio, base }) {
  const audioCodec = codecsOf(audio.mimeType) || "mp4a.40.2";
  const lines = [
    "#EXTM3U",
    "#EXT-X-VERSION:7",
    "#EXT-X-INDEPENDENT-SEGMENTS",
    `#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="aud",NAME="Audio",DEFAULT=YES,AUTOSELECT=YES,URI="${base}/${audio.itag}.m3u8"`,
  ];
  // Native players (Safari, iOS) start with the first variant: make that 720p or the nearest below
  const start = videos.filter((v) => v.height <= 720).sort((a, b) => b.height - a.height)[0];
  const ordered = start ? [start, ...videos.filter((v) => v !== start)] : videos;
  for (const v of ordered) {
    const bandwidth = (v.bitrate || v.averageBitrate || 1_000_000) + (audio.bitrate || 128_000);
    lines.push(
      `#EXT-X-STREAM-INF:BANDWIDTH=${bandwidth},RESOLUTION=${v.width}x${v.height},CODECS="${codecsOf(v.mimeType)},${audioCodec}",AUDIO="aud"${v.fps ? `,FRAME-RATE=${v.fps}` : ""}`,
      `${base}/${v.itag}.m3u8`
    );
  }
  lines.push("");
  return lines.join("\n");
}

/** "bytes=a-b" -> [a, b] (b inclusive), clamped to the file; null when absent or invalid */
export function parseRange(header, total) {
  const m = /^bytes=(\d*)-(\d*)$/.exec((header || "").trim());
  if (!m || (m[1] === "" && m[2] === "")) return null;
  let start;
  let end;
  if (m[1] === "") {
    start = Math.max(0, total - parseInt(m[2], 10));
    end = total - 1;
  } else {
    start = parseInt(m[1], 10);
    end = m[2] === "" ? total - 1 : Math.min(parseInt(m[2], 10), total - 1);
  }
  if (!(start <= end) || start >= total) return null;
  return [start, end];
}
