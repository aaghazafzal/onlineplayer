import { test } from "node:test";
import assert from "node:assert/strict";
import { decodeSnapSave, decodeSnapSaveReference } from "../src/index.js";

// Build a payload the way SnapSave's packer does: every char code (+t) is written
// in base e using n[0..e-1] as digits and n[e] as the separator.
function encode(text, n, t, e) {
  const bytes = unescape(encodeURIComponent(text));
  let h = "";
  for (const ch of bytes) {
    let v = ch.charCodeAt(0) + t;
    let digits = "";
    do {
      digits = n[v % e] + digits;
      v = Math.floor(v / e);
    } while (v > 0);
    h += digits + n[e];
  }
  return h;
}

function rng(seed) {
  let x = seed;
  return () => ((x = (x * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
}

test("fast decoder matches the reference on random payloads", () => {
  const rand = rng(42);
  const letters = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const sample = 'document.getElementById("download-section").innerHTML = "<a href=\\"https://cdn.example/v.mp4?x=1&y=2\\">Download video</a> हिंदी ✓";';
  for (let round = 0; round < 200; round++) {
    const e = 2 + Math.floor(rand() * 9); // base 2..10
    const pool = [...letters].sort(() => rand() - 0.5);
    const n = pool.slice(0, e + 1 + Math.floor(rand() * 4)).join("");
    const t = Math.floor(rand() * 80);
    const h = encode(sample, n, t, e);
    assert.equal(decodeSnapSave(h, 0, n, t, e), decodeSnapSaveReference(h, 0, n, t, e), `round ${round} n=${n} e=${e}`);
    assert.equal(decodeSnapSave(h, 0, n, t, e), sample);
  }
});

test("trailing chunk without separator and empty chunks match the reference", () => {
  const n = "ZxBNqwHdu";
  for (const h of ["", "xBw", "xBwqN", "ww", "xBwwqN"]) {
    let ref;
    let fast;
    try { ref = decodeSnapSaveReference(h, 0, n, 0, 5); } catch (e) { ref = e.name; }
    try { fast = decodeSnapSave(h, 0, n, 0, 5); } catch (e) { fast = e.name; }
    assert.equal(fast, ref, JSON.stringify(h));
  }
});

test("falls back to the reference when n contains regex specials", () => {
  const n = "a.bcdEFG";
  const h = encode("hello", n, 3, 4);
  assert.equal(decodeSnapSave(h, 0, n, 3, 4), decodeSnapSaveReference(h, 0, n, 3, 4));
});

test("fast decoder is much cheaper on a large payload", () => {
  const n = "ZxBNqwHdu";
  const h = encode("x".repeat(20000), n, 56, 5);
  const t0 = performance.now();
  decodeSnapSave(h, 0, n, 56, 5);
  const fast = performance.now() - t0;
  const t1 = performance.now();
  decodeSnapSaveReference(h, 0, n, 56, 5);
  const ref = performance.now() - t1;
  assert.ok(fast < ref, `fast ${fast.toFixed(1)}ms vs reference ${ref.toFixed(1)}ms`);
  console.log(`  20k chars: fast ${fast.toFixed(1)} ms, reference ${ref.toFixed(1)} ms`);
});
