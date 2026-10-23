import { test } from "node:test";
import assert from "node:assert/strict";
import { buildQueries, decodeEntities, normalize, parseTitle, pickBestMatch, scoreCandidate } from "../src/matcher.js";

const song = (over) => ({
  title: "Blinding Lights",
  album: "After Hours",
  primaryArtists: ["The Weeknd"],
  artists: [],
  durationSec: 200,
  year: "2020",
  ...over,
});

const blinding = { title: "Blinding Lights", artists: ["The Weeknd"], album: "After Hours", durationSec: 200, year: "2020" };

test("decodeEntities and normalize handle JioSaavn text", () => {
  assert.equal(decodeEntities("Tere Liye (From &quot;Prince&quot;) &amp; More &#039;x&#039;"), `Tere Liye (From "Prince") & More 'x'`);
  assert.equal(normalize("ADÉLA"), "adela");
  assert.equal(normalize("Mr. Brightside"), "mr brightside");
  assert.equal(normalize("Simon & Garfunkel"), "simon and garfunkel");
});

test("parseTitle strips film, feat and version decorations", () => {
  const a = parseTitle('Kesariya (From "Brahmastra")');
  assert.equal(a.base, "kesariya");
  assert.equal(a.from, "brahmastra");

  const b = parseTitle("Tujhko - From “Cocktail 2”");
  assert.equal(b.base, "tujhko");
  assert.equal(b.from, "cocktail 2");

  const c = parseTitle("Levitating (feat. DaBaby)");
  assert.equal(c.base, "levitating");
  assert.deepEqual(c.feat, ["dababy"]);

  const d = parseTitle("Mr. Brightside - Live");
  assert.equal(d.base, "mr brightside");
  assert.ok(d.versions.has("live"));

  assert.deepEqual(parseTitle("Dance With Me").feat, []);
});

test("original recording beats remix, cover album and instrumental", () => {
  const candidates = [
    song({ title: "Blinding Lights (Major Lazer Remix)", durationSec: 198 }),
    song({ title: "Blinding Lights (Instrumental)", durationSec: 201 }),
    song({ title: "Blinding Lights", album: "Covers, Vol. 2", primaryArtists: ["Some Band"], artists: ["The Weeknd"], durationSec: 174 }),
    song({ title: "Blinding Lights", album: "After Hours", durationSec: 200 }),
  ];
  const { best } = pickBestMatch(blinding, candidates);
  assert.ok(best);
  assert.equal(best.cand.album, "After Hours");
  assert.equal(best.cand.title, "Blinding Lights");
});

test("remix / slowed / lofi versions are rejected when target is the original", () => {
  for (const title of ["Blinding Lights (Remix)", "Blinding Lights (Slowed + Reverb)", "Blinding Lights - Lofi", "Blinding Lights (Live)"]) {
    const r = scoreCandidate(blinding, song({ title }));
    assert.equal(r.accepted, false, title);
  }
});

test("cover crediting the original artist only as songwriter is rejected", () => {
  const target = { title: "Earrings", artists: ["Malcolm Todd"], album: "Sweet Boy", durationSec: 152 };
  const cover = { title: "Earrings", album: "Earrings", primaryArtists: ["Vionelle"], artists: ["Malcolm Todd"], durationSec: 151 };
  assert.equal(scoreCandidate(target, cover).accepted, false);
});

test("same title by a different artist is never accepted", () => {
  const target = { title: "Coffee", artists: ["Amrinder Gill", "Jasmeen Akhtar"], durationSec: 165 };
  const other = { title: "Coffee", album: "T.I.M.T", primaryArtists: ["Lakhi Ghuman"], artists: [], durationSec: 161 };
  assert.equal(scoreCandidate(target, other).accepted, false);
});

test("large duration gap is rejected even with matching title and artist", () => {
  const r = scoreCandidate(blinding, song({ durationSec: 146 }));
  assert.equal(r.accepted, false);
});

test("Bollywood: composer-first Spotify credits still match singer-first JioSaavn credits", () => {
  const target = {
    title: 'Kesariya (From "Brahmastra")',
    artists: ["Pritam", "Arijit Singh", "Amitabh Bhattacharya"],
    album: "Brahmastra",
    durationSec: 268,
    year: "2022",
  };
  const cand = { title: "Kesariya", album: "Brahmastra", primaryArtists: ["Arijit Singh"], artists: ["Pritam", "Amitabh Bhattacharya"], durationSec: 268, year: "2022" };
  const r = scoreCandidate(target, cand);
  assert.equal(r.accepted, true);
  assert.ok(r.score >= 95, `score ${r.score}`);
});

test("remix is accepted when the Spotify track itself is that remix", () => {
  const target = { title: "Blinding Lights - Major Lazer Remix", artists: ["The Weeknd", "Major Lazer"], durationSec: 198 };
  const remix = song({ title: "Blinding Lights (Major Lazer Remix)", primaryArtists: ["The Weeknd"], durationSec: 198, album: "Blinding Lights" });
  const original = song({ durationSec: 200 });
  const { best } = pickBestMatch(target, [original, remix]);
  assert.equal(best?.cand.title, "Blinding Lights (Major Lazer Remix)");
});

test("buildQueries puts the most specific query first", () => {
  const q = buildQueries({ title: 'Kesariya (From "Brahmastra")', artists: ["Pritam", "Arijit Singh"], album: "Brahmastra" });
  assert.equal(q[0], "Kesariya Pritam");
  assert.ok(q.includes("Kesariya brahmastra"));
  assert.ok(q.includes("Kesariya"));
});
