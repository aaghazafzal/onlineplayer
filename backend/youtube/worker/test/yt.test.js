import { test } from "node:test";
import assert from "node:assert/strict";
import { parseLength, parseYouTubeUrl, pickFormats, playlistFromNext, safeFilename } from "../src/yt.js";

test("parses every YouTube link shape", () => {
  const id = "dQw4w9WgXcQ";
  for (const url of [
    `https://www.youtube.com/watch?v=${id}`,
    `https://youtube.com/watch?v=${id}&t=42s`,
    `https://m.youtube.com/watch?v=${id}`,
    `https://youtu.be/${id}?si=abc`,
    `https://www.youtube.com/shorts/${id}`,
    `https://www.youtube.com/live/${id}`,
    `https://www.youtube.com/embed/${id}`,
    `https://music.youtube.com/watch?v=${id}`,
    `https://www.youtube-nocookie.com/embed/${id}`,
  ]) {
    assert.deepEqual(parseYouTubeUrl(url), { videoId: id }, url);
  }
  assert.deepEqual(parseYouTubeUrl("https://www.youtube.com/playlist?list=PLFgquLnL59alCl_2TQvOiD5Vgm1hCaGSI"), {
    listId: "PLFgquLnL59alCl_2TQvOiD5Vgm1hCaGSI",
  });
  assert.deepEqual(parseYouTubeUrl(`https://www.youtube.com/watch?v=${id}&list=PLFgquLnL59alCl_2TQvOiD5Vgm1hCaGSI`), {
    videoId: id,
    listId: "PLFgquLnL59alCl_2TQvOiD5Vgm1hCaGSI",
  });
});

test("rejects other sites, bad ids and per-viewer mixes", () => {
  assert.equal(parseYouTubeUrl("https://evil.com/watch?v=dQw4w9WgXcQ"), null);
  assert.equal(parseYouTubeUrl("https://www.youtube.com/watch?v=short"), null);
  assert.equal(parseYouTubeUrl("https://www.youtube.com/@channel"), null);
  assert.deepEqual(parseYouTubeUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=RDdQw4w9WgXcQ"), { videoId: "dQw4w9WgXcQ" });
});

test("durations and filenames", () => {
  assert.equal(parseLength("3:55"), 235);
  assert.equal(parseLength("1:02:03"), 3723);
  assert.equal(parseLength(""), 0);
  assert.equal(safeFilename('a/b:c"d'), "a_b_c_d");
});

test("playlist panel is read from /next", () => {
  const json = {
    contents: {
      twoColumnWatchNextResults: {
        playlist: {
          playlist: {
            playlistId: "PL1",
            title: "Mix",
            totalVideos: 3,
            ownerName: { simpleText: "Someone" },
            contents: [
              { playlistPanelVideoRenderer: { videoId: "aaaaaaaaaaa", title: { simpleText: "One" }, lengthText: { simpleText: "3:55" }, shortBylineText: { runs: [{ text: "Artist" }] } } },
              { playlistPanelVideoRenderer: { videoId: "bbbbbbbbbbb", title: { simpleText: "Gone" }, unplayableText: { simpleText: "Deleted" } } },
              { automixPreviewVideoRenderer: {} },
            ],
          },
        },
      },
    },
  };
  const p = playlistFromNext(json);
  assert.equal(p.title, "Mix");
  assert.equal(p.channel, "Someone");
  assert.equal(p.videos.length, 1);
  assert.deepEqual(p.videos[0], {
    id: "aaaaaaaaaaa",
    title: "One",
    channel: "Artist",
    duration: 235,
    durationFormatted: "3:55",
    thumbnail: "https://i.ytimg.com/vi/aaaaaaaaaaa/hqdefault.jpg",
  });
  assert.equal(playlistFromNext({}), null);
});

test("picks muxed MP4 and M4A audio with direct URLs only", () => {
  const f = pickFormats({
    streamingData: {
      formats: [{ itag: 18, url: "u18", mimeType: 'video/mp4; codecs="avc1, mp4a"', height: 360, audioQuality: "AUDIO_QUALITY_LOW" }],
      adaptiveFormats: [
        { itag: 137, url: "u137", mimeType: 'video/mp4; codecs="avc1"', height: 1080 },
        { itag: 140, url: "u140", mimeType: 'audio/mp4; codecs="mp4a"', bitrate: 130000, audioQuality: "AUDIO_QUALITY_MEDIUM" },
        { itag: 139, url: "u139", mimeType: 'audio/mp4; codecs="mp4a"', bitrate: 48000, audioQuality: "AUDIO_QUALITY_LOW" },
        { itag: 251, signatureCipher: "s=...", mimeType: 'audio/webm; codecs="opus"', bitrate: 160000 },
      ],
    },
  });
  assert.equal(f.video.itag, 18);
  assert.equal(f.audio.itag, 140);
  assert.deepEqual(pickFormats({}), { video: null, audio: null });
});
