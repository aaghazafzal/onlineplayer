/**
 * OnlinePlayer health monitor
 * - Cron (every 15 min): end-to-end checks of every provider, state in KV
 * - Telegram alert when a service is down 2 runs in a row, and when it recovers
 * - status.onlineplayer.site: public status page + /api/status JSON
 */

import { runAllChecks } from "./checks.js";
import { applyResults, emptyState, formatDurationShort, uptimeById } from "./state.js";

const STATE_KEY = "state:v1";

async function loadState(env) {
  try {
    return (await env.MONITOR_STATE.get(STATE_KEY, "json")) || emptyState();
  } catch {
    return emptyState();
  }
}

function escapeHtml(s = "") {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

async function sendTelegram(env, text) {
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) return { sent: false, reason: "telegram not configured" };
  try {
    const res = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, text, parse_mode: "HTML", disable_web_page_preview: true }),
    });
    return { sent: res.ok, reason: res.ok ? null : `telegram HTTP ${res.status}` };
  } catch (err) {
    return { sent: false, reason: err.message };
  }
}

function alertText(alerts, now) {
  return alerts
    .map((a) =>
      a.type === "down"
        ? `🔴 <b>${escapeHtml(a.name)}</b> is DOWN\n${escapeHtml(a.error || "")}`
        : `✅ <b>${escapeHtml(a.name)}</b> recovered (was down ${formatDurationShort(now - (a.downSince || now))})`
    )
    .join("\n\n")
    .concat("\n\nhttps://status.onlineplayer.site");
}

async function runMonitor(env, { deep, now = Date.now() }) {
  const results = await runAllChecks({ deep });
  const prev = await loadState(env);
  const { state, alerts } = applyResults(prev, results, now);
  await env.MONITOR_STATE.put(STATE_KEY, JSON.stringify(state));
  const notify = alerts.length ? await sendTelegram(env, alertText(alerts, now)) : null;
  return { deep, results, alerts, notify };
}

function renderStatusPage(state) {
  const uptime = uptimeById(state);
  const checks = Object.values(state.checks || {});
  const allOk = checks.length > 0 && checks.every((c) => c.ok);
  const updated = state.updatedAt ? new Date(state.updatedAt).toISOString() : null;

  const rows = checks
    .map((c) => {
      // Always 48 slots (12h), oldest first; slots without data stay grey
      const recent = (state.history || [])
        .slice(-48)
        .map((h) => (h.r?.[c.id] === undefined ? "na" : h.r[c.id] ? "up" : "down"));
      const bars = [...Array(48 - recent.length).fill("na"), ...recent].map((s) => `<i class="${s}"></i>`).join("");
      return `<li class="svc">
        <div class="row"><span class="dot ${c.ok ? "up" : "down"}"></span><strong>${escapeHtml(c.name)}</strong>
          <span class="meta">${c.ok ? `${c.latencyMs} ms` : "Down"} · ${uptime[c.id] ?? "–"}% (24h)</span></div>
        ${c.ok ? "" : `<p class="err">${escapeHtml(c.lastError || "")}</p>`}
        <div class="bars" aria-label="Last 12 hours">${bars}</div>
      </li>`;
    })
    .join("");

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>OnlinePlayer Status</title><meta name="robots" content="noindex">
<style>
:root{--bg:#f4f4f7;--card:#fff;--fg:#18181b;--mut:#71717a;--bd:#e4e4e7;--up:#16a34a;--down:#dc2626;--na:#d4d4d8}
@media (prefers-color-scheme:dark){:root{--bg:#0e0e11;--card:#18181f;--fg:#f4f4f5;--mut:#a1a1aa;--bd:#27272a;--na:#3f3f46}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.5 system-ui,-apple-system,Segoe UI,Roboto,sans-serif}
main{max-width:720px;margin:0 auto;padding:40px 16px}h1{font-size:22px;margin:0 0 6px}
.banner{padding:16px 18px;border-radius:14px;font-weight:700;margin:18px 0;color:#fff;background:${allOk ? "var(--up)" : "var(--down)"}}
ul{list-style:none;padding:0;margin:0;display:grid;gap:12px}.svc{background:var(--card);border:1px solid var(--bd);border-radius:14px;padding:14px 16px}
.row{display:flex;align-items:center;gap:10px;flex-wrap:wrap}.meta{margin-left:auto;color:var(--mut);font-size:13px}
.dot{width:10px;height:10px;border-radius:50%}.dot.up{background:var(--up)}.dot.down{background:var(--down)}
.err{margin:8px 0 0;color:var(--down);font-size:13px}.bars{display:flex;gap:2px;margin-top:10px}
.bars i{flex:1;height:22px;border-radius:2px;background:var(--na)}.bars i.up{background:var(--up)}.bars i.down{background:var(--down)}
footer{margin-top:20px;color:var(--mut);font-size:13px}a{color:inherit}
</style></head><body><main>
<h1>OnlinePlayer Status</h1>
<div class="banner">${checks.length === 0 ? "No checks have run yet" : allOk ? "All systems operational" : "Some services are having problems"}</div>
<ul>${rows}</ul>
<footer>Checked every 15 minutes · Last check: <time datetime="${updated || ""}">${updated ? updated.replace("T", " ").slice(0, 16) + " UTC" : "never"}</time> · <a href="https://onlineplayer.site">onlineplayer.site</a></footer>
</main></body></html>`;
}

export default {
  async scheduled(controller, env, ctx) {
    // Hourly deep run (first slot of the hour) bypasses provider caches
    const deep = new Date(controller.scheduledTime).getUTCMinutes() < 15;
    ctx.waitUntil(runMonitor(env, { deep, now: controller.scheduledTime }));
  },

  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/status") {
      const state = await loadState(env);
      return new Response(JSON.stringify({ ...state, uptime: uptimeById(state) }), {
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Cache-Control": "public, max-age=60" },
      });
    }

    // Manual run, e.g. to test Telegram alerts: POST /api/run with header x-monitor-key
    if (url.pathname === "/api/run") {
      if (request.method !== "POST" || !env.MONITOR_KEY || request.headers.get("x-monitor-key") !== env.MONITOR_KEY) {
        return new Response("Forbidden", { status: 403 });
      }
      const out = await runMonitor(env, { deep: url.searchParams.get("deep") === "1" });
      if (url.searchParams.get("test_alert") === "1") {
        out.testAlert = await sendTelegram(env, "🔔 OnlinePlayer monitor test alert: Telegram is connected.");
      }
      return new Response(JSON.stringify(out, null, 2), { headers: { "Content-Type": "application/json" } });
    }

    if (url.pathname === "/" || url.pathname === "/index.html") {
      const state = await loadState(env);
      return new Response(renderStatusPage(state), {
        headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=60" },
      });
    }

    return new Response("Not Found", { status: 404 });
  },
};
