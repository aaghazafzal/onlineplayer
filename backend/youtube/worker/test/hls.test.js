import { test } from "node:test";
import assert from "node:assert/strict";
import { masterPlaylist, mediaPlaylist, mergeRefs, parseRange, parseSidx, pickHlsFormats } from "../src/hls.js";

function sidxBox({ version = 0, timescale = 1000, firstOffset = 0, refs }) {
  const header = 12 + 4 + 4 + (version === 0 ? 8 : 16) + 4;
  const size = header + refs.length * 12;
  const b = new Uint8Array(size);
  const v = new DataView(b.buffer);
  v.setUint32(0, size);
  b.set([0x73, 0x69, 0x64, 0x78], 4); // "sidx"
  b[8] = version;
  let p = 12;
  v.setUint32(p, 1); p += 4; // reference_ID
  v.setUint32(p, timescale); p += 4;
  if (version === 0) { v.setUint32(p, 0); v.setUint32(p + 4, firstOffset); p += 8; }
  else { v.setBigUint64(p, 0n); v.setBigUint64(p + 8, BigInt(firstOffset)); p += 16; }
  p += 2;
  v.setUint16(p, refs.length); p += 2;
  for (const [sz, dur] of refs) { v.setUint32(p, sz); v.setUint32(p + 4, dur); v.setUint32(p + 8, 0x90000000); p += 12; }
  return b;
}

test("parses sidx v0 and v1 with offsets after the box", () => {
  for (const version of [0, 1]) {
    const box = sidxBox({ version, timescale: 1000, firstOffset: 10, refs: [[100, 5000], [200, 5000], [50, 2500]] });
    const indexEnd = 799; // box occupies ..799, so media starts at 800 (+10 firstOffset)
    const { refs } = parseSidx(box, indexEnd);
    assert.deepEqual(refs, [
      { offset: 810, size: 100, duration: 5 },
      { offset: 910, size: 200, duration: 5 },
      { offset: 1110, size: 50, duration: 2.5 },
    ]);
  }
  assert.throws(() => parseSidx(new Uint8Array(40), 39), /sidx/);
});

test("merges references into ~20 s segments without gaps", () => {
  const refs = Array.from({ length: 50 }, (_, i) => ({ offset: 1000 + i * 100, size: 100, duration: 5.005 }));
  const segs = mergeRefs(refs, 20);
  assert.equal(segs.reduce((n, s) => n + s.size, 0), 5000);
  for (let i = 1; i < segs.length; i++) assert.equal(segs[i].offset, segs[i - 1].offset + segs[i - 1].size);
  assert.ok(segs.every((s) => s.duration <= 25.1));
  assert.ok(segs.length >= 12 && segs.length <= 14, String(segs.length));
  const capped = mergeRefs(refs, 20, 250);
  assert.ok(capped.every((s) => s.size <= 250));
});

test("media playlist is valid fMP4 byte-range HLS", () => {
  const pl = mediaPlaylist({ initEnd: 739, segments: [{ offset: 1300, size: 500, duration: 19.5 }, { offset: 1800, size: 400, duration: 3 }], segUrl: "/seg/v/136" });
  assert.match(pl, /#EXT-X-MAP:URI="\/seg\/v\/136",BYTERANGE="740@0"/);
  assert.match(pl, /#EXT-X-TARGETDURATION:20/);
  assert.match(pl, /#EXT-X-BYTERANGE:500@1300\n\/seg\/v\/136/);
  assert.match(pl, /#EXT-X-ENDLIST\n$/);
});

const fmt = (itag, mime, height, bitrate, extra = {}) => ({ itag, mimeType: mime, height, width: Math.round(height * 16 / 9), bitrate, url: `u${itag}`, initRange: { start: "0", end: "739" }, indexRange: { start: "740", end: "1299" }, ...extra });

test("picks one H.264 MP4 per height and AAC audio", () => {
  const sd = {
    adaptiveFormats: [
      fmt(137, 'video/mp4; codecs="avc1.640028"', 1080, 4e6),
      fmt(399, 'video/mp4; codecs="av01.0.08M.08"', 1080, 2e6),
      fmt(136, 'video/mp4; codecs="avc1.4d401f"', 720, 2e6),
      fmt(298, 'video/mp4; codecs="avc1.4d4020"', 720, 3e6),
      fmt(248, 'video/webm; codecs="vp9"', 1080, 3e6),
      fmt(135, 'video/mp4; codecs="avc1.4d401e"', 480, 1e6, { url: undefined }),
      fmt(140, 'audio/mp4; codecs="mp4a.40.2"', undefined, 130000),
      fmt(251, 'audio/webm; codecs="opus"', undefined, 160000),
    ],
  };
  const { videos, audio } = pickHlsFormats(sd);
  assert.deepEqual(videos.map((v) => v.itag), [137, 298]);
  assert.equal(audio.itag, 140);
  const master = masterPlaylist({ videos, audio, base: "/hls/abc" });
  assert.match(master, /TYPE=AUDIO,GROUP-ID="aud".*URI="\/hls\/abc\/140.m3u8"/);
  assert.match(master, /RESOLUTION=1920x1080,CODECS="avc1.640028,mp4a.40.2",AUDIO="aud"\n\/hls\/abc\/137.m3u8/);
});

test("range header parsing", () => {
  assert.deepEqual(parseRange("bytes=0-99", 1000), [0, 99]);
  assert.deepEqual(parseRange("bytes=900-", 1000), [900, 999]);
  assert.deepEqual(parseRange("bytes=-100", 1000), [900, 999]);
  assert.deepEqual(parseRange("bytes=500-5000", 1000), [500, 999]);
  assert.equal(parseRange("bytes=1000-", 1000), null);
  assert.equal(parseRange("", 1000), null);
});
