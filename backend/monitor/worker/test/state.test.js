import { test } from "node:test";
import assert from "node:assert/strict";
import { applyResults, emptyState, FAIL_THRESHOLD, HISTORY_LENGTH, uptimeById } from "../src/state.js";

const ok = (id) => ({ id, name: id, ok: true, latencyMs: 100 });
const fail = (id, error = "boom") => ({ id, name: id, ok: false, latencyMs: 100, error });

test("a single failure does not alert", () => {
  const { alerts, state } = applyResults(emptyState(), [fail("spotify")], 1000);
  assert.equal(alerts.length, 0);
  assert.equal(state.checks.spotify.failStreak, 1);
});

test("alerts once after FAIL_THRESHOLD consecutive failures, not again while still down", () => {
  let state = emptyState();
  const sent = [];
  for (let i = 0; i < FAIL_THRESHOLD + 3; i++) {
    const out = applyResults(state, [fail("spotify")], 1000 * (i + 1));
    state = out.state;
    sent.push(...out.alerts);
  }
  assert.equal(sent.length, 1);
  assert.equal(sent[0].type, "down");
  assert.equal(sent[0].error, "boom");
});

test("recovery alert only after a down alert was sent", () => {
  let { state } = applyResults(emptyState(), [fail("ig")], 1000);
  let out = applyResults(state, [ok("ig")], 2000);
  assert.equal(out.alerts.length, 0, "flap without alert must stay silent");

  state = out.state;
  for (let i = 0; i < FAIL_THRESHOLD; i++) state = applyResults(state, [fail("ig")], 3000 + i).state;
  out = applyResults(state, [ok("ig")], 10_000);
  assert.deepEqual(out.alerts.map((a) => a.type), ["recovered"]);
  assert.equal(out.state.checks.ig.alerted, false);
});

test("since tracks when the current up/down status started", () => {
  let { state } = applyResults(emptyState(), [ok("site")], 1000);
  state = applyResults(state, [ok("site")], 2000).state;
  assert.equal(state.checks.site.since, 1000);
  state = applyResults(state, [fail("site")], 3000).state;
  assert.equal(state.checks.site.since, 3000);
});

test("history is capped and uptime is computed per check", () => {
  let state = emptyState();
  for (let i = 0; i < HISTORY_LENGTH + 10; i++) {
    state = applyResults(state, [ok("a"), i % 4 === 0 ? fail("b") : ok("b")], i).state;
  }
  assert.equal(state.history.length, HISTORY_LENGTH);
  const up = uptimeById(state);
  assert.equal(up.a, 100);
  assert.equal(up.b, 75);
});

test("checks that are no longer run disappear from the state", () => {
  const prev = applyResults(null, [{ id: "a", name: "A", ok: true }, { id: "gone", name: "Gone", ok: true }], 1000).state;
  const { state } = applyResults(prev, [{ id: "a", name: "A", ok: true }], 2000);
  assert.deepEqual(Object.keys(state.checks), ["a"]);
});
