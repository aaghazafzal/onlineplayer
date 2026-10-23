import { test } from "node:test";
import assert from "node:assert/strict";
import { bigImage, decodeEntities, formatDuration, isShortLink, normaliseCollection, normaliseSong, parseSaavnUrl } from "../src/saavn.js";

test("parses every JioSaavn link shape", () => {
  assert.deepEqual(parseSaavnUrl("https://www.jiosaavn.com/song/kesariya/AgIAQyBeWlI"), { type: "song", token: "AgIAQyBeWlI" });
  assert.deepEqual(parseSaavnUrl("https://www.jiosaavn.com/album/brahmastra/xq4v9ZFC9iA_"), { type: "album", token: "xq4v9ZFC9iA_" });
  assert.deepEqual(parseSaavnUrl("https://www.jiosaavn.com/featured/lets-play-arijit-singh-hindi/Iz0pi7nkjUE_"), { type: "playlist", token: "Iz0pi7nkjUE_" });
  assert.deepEqual(parseSaavnUrl("https://www.jiosaavn.com/s/playlist/abc123/my-mix/Xy0pi7nkjUE_?utm=1"), { type: "playlist", token: "Xy0pi7nkjUE_" });
  assert.deepEqual(parseSaavnUrl("https://www.jiosaavn.com/artist/arijit-singh-songs/LlRWpHzy3Hk_"), { type: "artist", token: "LlRWpHzy3Hk_" });
  assert.deepEqual(parseSaavnUrl("https://jiosaavn.com/song/x/AbC"), { type: "song", token: "AbC" });
});

test("rejects other sites and unsupported pages", () => {
  assert.equal(parseSaavnUrl("https://evil.com/song/x/AgIAQyBeWlI"), null);
  assert.equal(parseSaavnUrl("https://www.jiosaavn.com/shows/podcast/1"), null);
  assert.equal(parseSaavnUrl("not a url"), null);
  assert.equal(parseSaavnUrl("https://www.jiosaavn.com/song"), null);
});

test("short links are recognised", () => {
  assert.equal(isShortLink("https://jiosaavn.page.link/abc"), true);
  assert.equal(isShortLink("https://www.jiosaavn.com/song/x/y"), false);
});

test("helpers", () => {
  assert.equal(decodeEntities("Kesariya (From &quot;Brahmastra&quot;)"), 'Kesariya (From "Brahmastra")');
  assert.equal(bigImage("http://c.saavncdn.com/871/x-150x150.jpg"), "https://c.saavncdn.com/871/x-500x500.jpg");
  assert.equal(formatDuration(268), "4:28");
  assert.equal(formatDuration(3725), "1:02:05");
});

const song = (over = {}) => ({
  id: "AgIAQyBe",
  title: "Kesariya (From &quot;Brahmastra&quot;)",
  subtitle: "Arijit Singh",
  image: "https://c.saavncdn.com/871/a-150x150.jpg",
  year: "2022",
  language: "hindi",
  explicit_content: "0",
  perma_url: "https://www.jiosaavn.com/song/kesariya/AgIAQyBeWlI",
  more_info: {
    album: "Brahmastra",
    duration: "268",
    "320kbps": "true",
    has_lyrics: "false",
    encrypted_media_url: "ENC",
    artistMap: { primary_artists: [{ name: "Pritam" }, { name: "Arijit Singh" }], featured_artists: [] },
  },
  ...over,
});
const decrypt = () => "https://aac.saavncdn.com/871/abc_96.mp4";
const link = (u, f) => `https://w/api/download?url=${encodeURIComponent(u)}&filename=${encodeURIComponent(f)}`;

test("a song becomes a track with 320/160/96 streams", () => {
  const t = normaliseSong(song(), decrypt, link);
  assert.equal(t.title, 'Kesariya (From "Brahmastra")');
  assert.equal(t.artist, "Pritam, Arijit Singh");
  assert.equal(t.cover, "https://c.saavncdn.com/871/a-500x500.jpg");
  assert.deepEqual(t.streams.map((s) => s.bitrate), ["320k", "160k", "96k"]);
  assert.equal(t.streams[0].streamUrl, "https://aac.saavncdn.com/871/abc_320.mp4");
  assert.match(t.streams[0].fileName, /^Pritam, Arijit Singh - Kesariya \(From _Brahmastra_\) \(320kbps\)\.m4a$/);
});

test("songs without 320 kbps or without media are handled", () => {
  const no320 = normaliseSong(song({ more_info: { ...song().more_info, "320kbps": "false" } }), decrypt, link);
  assert.deepEqual(no320.streams.map((s) => s.bitrate), ["160k", "96k"]);
  const none = normaliseSong(song({ more_info: { ...song().more_info, encrypted_media_url: "" } }), decrypt, link);
  assert.equal(none.streams.length, 0);
});

test("collections drop unplayable songs and add up durations", () => {
  const c = normaliseCollection(
    "album",
    { id: "1", title: "Brahmastra", subtitle: "Pritam", image: "x-150x150.jpg", list: [song(), song({ more_info: { ...song().more_info, encrypted_media_url: "" } }), song()] },
    decrypt,
    link
  );
  assert.equal(c.trackCount, 2);
  assert.equal(c.totalDuration, 536);
  assert.equal(c.provider, "jiosaavn");
  const a = normaliseCollection("artist", { name: "Arijit Singh", topSongs: [song()], follower_count: "1000" }, decrypt, link);
  assert.equal(a.title, "Arijit Singh");
  assert.equal(a.trackCount, 1);
});
