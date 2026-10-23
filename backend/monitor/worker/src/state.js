/**
 * Pure state transitions for the health monitor (no I/O, unit-tested).
 *
 * A check must fail FAIL_THRESHOLD runs in a row before a DOWN alert is sent,
 * so a single slow request does not page anyone. Once alerted, the next
 * successful run sends a RECOVERED alert.
 */

export const FAIL_THRESHOLD = 2;
export const HISTORY_LENGTH = 96; // 24h of 15-minute runs

export function emptyState() {
  return { updatedAt: null, checks: {}, history: [] };
}

/**
 * @param {object} prev     previous state (or emptyState())
 * @param {Array<{id:string,name:string,ok:boolean,latencyMs:number,error?:string}>} results
 * @param {number} now      epoch ms
 * @returns {{ state: object, alerts: Array<{type:"down"|"recovered", id:string, name:string, error?:string, downSince?:number}> }}
 */
export function applyResults(prev, results, now) {
  const state = {
    updatedAt: now,
    checks: { ...(prev?.checks || {}) },
    history: [...(prev?.history || [])],
  };
  const alerts = [];

  for (const r of results) {
    const old = state.checks[r.id] || { ok: true, since: now, failStreak: 0, alerted: false };
    const next = {
      id: r.id,
      name: r.name,
      ok: r.ok,
      latencyMs: r.latencyMs,
      lastCheckedAt: now,
      lastError: r.ok ? null : r.error || "Unknown error",
      failStreak: r.ok ? 0 : (old.failStreak || 0) + 1,
      since: r.ok === old.ok ? old.since || now : now,
      alerted: old.alerted || false,
    };

    if (!r.ok && next.failStreak >= FAIL_THRESHOLD && !next.alerted) {
      next.alerted = true;
      alerts.push({ type: "down", id: r.id, name: r.name, error: next.lastError, downSince: next.since });
    } else if (r.ok && old.alerted) {
      next.alerted = false;
      alerts.push({ type: "recovered", id: r.id, name: r.name, downSince: old.since });
    }

    state.checks[r.id] = next;
  }

  state.history.push({ t: now, r: Object.fromEntries(results.map((r) => [r.id, r.ok ? 1 : 0])) });
  if (state.history.length > HISTORY_LENGTH) state.history = state.history.slice(-HISTORY_LENGTH);

  return { state, alerts };
}

/** Uptime % per check over the stored history window. */
export function uptimeById(state) {
  const totals = {};
  for (const h of state?.history || []) {
    for (const [id, ok] of Object.entries(h.r || {})) {
      totals[id] = totals[id] || { up: 0, n: 0 };
      totals[id].up += ok;
      totals[id].n += 1;
    }
  }
  return Object.fromEntries(
    Object.entries(totals).map(([id, t]) => [id, t.n ? Math.round((t.up / t.n) * 1000) / 10 : null])
  );
}

export function formatDurationShort(ms) {
  const min = Math.max(0, Math.round(ms / 60000));
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}
