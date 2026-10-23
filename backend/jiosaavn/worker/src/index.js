/**
 * JioSaavn worker (jiosaavn.onlineplayer.site)
 * Resolves song / album / playlist / artist links to full-length AAC streams
 * (320/160/96 kbps). Playback and downloads go straight to JioSaavn's CDN, which
 * allows any origin, so this worker is only hit once per link (then cached).
 */

// Only the DES-ECB pieces of crypto-js (the full library is ~200 KB of cold-start CPU)
import CryptoJS from "crypto-js/core";
import "crypto-js/tripledes";
import "crypto-js/mode-ecb";
import { bigImage, decodeEntities, isShortLink, normaliseCollection, normaliseSong, parseSaavnUrl } from "./saavn.js";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const CACHE_VERSION = "v1";
const MAX_TRACKS = 200;

function isOriginAllowed(origin) {
  if (!origin) return true;
  try {
    const host = new URL(origin).hostname.toLowerCase();
    return host === "onlineplayer.site" || host.endsWith(".onlineplayer.site") || host.endsWith(".pages.dev") || host === "localhost" || host === "127.0.0.1";
  } catch {
    return false;
  }
}

function isMediaUrlAllowed(raw) {
  try {
    const u = new URL(raw);
    return u.protocol === "https:" && u.hostname.toLowerCase().endsWith(".saavncdn.com");
  } catch {
    return false;
  }
}

function cors(origin, extra = {}) {
  return {
    "Access-Control-Allow-Origin": origin && isOriginAllowed(origin) ? origin : "*",
    "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Range",
    "Access-Control-Expose-Headers": "Content-Length, Content-Range, Accept-Ranges, Content-Disposition, X-Cache",
    Vary: "Origin",
    ...extra,
  };
}

function json(data, status = 200, origin = null, extra = {}) {
  return new Response(JSON.stringify(data), { status, headers: cors(origin, { "Content-Type": "application/json; charset=utf-8", ...extra }) });
}

function decryptMediaUrl(encrypted) {
  try {
    const out = CryptoJS.DES.decrypt(
      { ciphertext: CryptoJS.enc.Base64.parse(encrypted) },
      CryptoJS.enc.Utf8.parse("38346591"),
      { mode: CryptoJS.mode.ECB, padding: CryptoJS.pad.Pkcs7 }
    ).toString(CryptoJS.enc.Utf8);
    return out ? out.replace(/^http:\/\//, "https://") : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Edge cache (Cache API): free and unmetered, unlike KV writes
// ---------------------------------------------------------------------------
const cacheKey = (host, key) => new Request(`https://${host}/__edge-cache/${encodeURIComponent(key)}`);
async function edgeGet(host, key) {
  try {
    const r = await caches.default.match(cacheKey(host, key));
    return r ? await r.json() : null;
  } catch {
    return null;
  }
}
async function edgePut(host, key, value, ttl) {
  try {
    await caches.default.put(cacheKey(host, key), new Response(JSON.stringify(value), { headers: { "Cache-Control": `public, max-age=${ttl}` } }));
  } catch {
    // best-effort
  }
}

// JioSaavn tailors results to the requester's country: forward the real client IP.
async function saavnApi(params, clientIp) {
  const qs = new URLSearchParams({ _format: "json", _marker: "0", api_version: "4", ctx: "web6dot0", ...params });
  const headers = { "User-Agent": UA, Accept: "application/json" };
  if (clientIp) headers["X-Forwarded-For"] = clientIp;
  const res = await fetch(`https://www.jiosaavn.com/api.php?${qs}`, { headers });
  if (!res.ok) throw new Error(`JioSaavn answered HTTP ${res.status}`);
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error("JioSaavn returned an unexpected page");
  }
}

async function resolveShortLink(raw) {
  try {
    const res = await fetch(raw, { redirect: "follow", headers: { "User-Agent": UA } });
    if (parseSaavnUrl(res.url)) return res.url;
    const html = await res.text();
    const m = html.match(/https?:\/\/(?:www\.)?jiosaavn\.com\/(?:song|album|featured|s\/playlist|artist)\/[^"'\s<>]+/);
    return m ? m[0] : null;
  } catch {
    return null;
  }
}

async function resolveLink(parsed, clientIp, link) {
  const { type, token } = parsed;
  if (type === "song") {
    const data = await saavnApi({ __call: "webapi.get", token, type: "song", includeMetaTags: "0" }, clientIp);
    const s = data.songs?.[0];
    if (!s) return null;
    const track = normaliseSong(s, decryptMediaUrl, link);
    if (!track.streams.length) return { ok: false, error: "This song is not available to stream in your region." };
    return { ok: true, provider: "jiosaavn", type: "song", ...track, sourceUrl: track.url };
  }

  // Artist pages take their own paging params; extra empty ones shrink the list
  const params =
    type === "artist"
      ? { __call: "webapi.get", token, type, n_song: "50", n_album: "0", includeMetaTags: "0" }
      : { __call: "webapi.get", token, type, includeMetaTags: "0", n: String(MAX_TRACKS), p: "1" };
  const data = await saavnApi(params, clientIp);
  if (!data || (data.error && !data.list && !data.topSongs)) return null;
  const collection = normaliseCollection(type, data, decryptMediaUrl, link);
  if (!collection.tracks.length) return { ok: false, error: `No playable songs were found in this ${type}.` };
  const listCount = parseInt(data.list_count || "0", 10);
  if (listCount > collection.trackCount && type !== "artist") collection.truncatedFrom = listCount;
  return collection;
}

function safeFilename(name) {
  return (name || "track.m4a").replace(/[\/\\?%*:|"<>\x00-\x1f]/g, "_").replace(/\s+/g, " ").trim().slice(0, 180) || "track.m4a";
}

async function handleDownload(request, url, origin) {
  const target = url.searchParams.get("url");
  if (!target || !isMediaUrlAllowed(target)) return json({ ok: false, error: "This media host is not allowed" }, 403, origin);
  const name = safeFilename(url.searchParams.get("filename"));
  const upstream = await fetch(target, { headers: { "User-Agent": UA }, cf: { cacheEverything: true, cacheTtl: 86400 } });
  const ascii = name.replace(/[^\x20-\x7e]/g, "_").replace(/"/g, "'");
  const headers = cors(origin, {
    "Content-Type": upstream.headers.get("Content-Type") || "audio/mp4",
    "Content-Disposition": `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`,
    "Cache-Control": "public, max-age=86400",
  });
  const len = upstream.headers.get("Content-Length");
  if (len) headers["Content-Length"] = len;
  return new Response(request.method === "HEAD" ? null : upstream.body, { status: upstream.status, headers });
}

async function handleResolve(request, url, env, ctx, origin) {
  const input = url.searchParams.get("url");
  if (!input) return json({ ok: false, error: "Missing url parameter" }, 400, origin);

  const clientIp = request.headers.get("CF-Connecting-IP") || "";
  if (env.RESOLVE_LIMITER) {
    const { success } = await env.RESOLVE_LIMITER.limit({ key: clientIp || "unknown" });
    if (!success) return json({ ok: false, error: "Too many requests. Please wait a minute and try again." }, 429, origin, { "Retry-After": "60" });
  }

  let link = input.trim();
  if (!parseSaavnUrl(link) && isShortLink(link)) link = (await resolveShortLink(link)) || link;
  const parsed = parseSaavnUrl(link);
  if (!parsed) {
    return json({ ok: false, error: "This does not look like a JioSaavn song, album, playlist or artist link." }, 400, origin);
  }

  const region = request.cf?.country === "IN" ? "in" : "intl";
  const key = `saavn:${CACHE_VERSION}:${region}:${parsed.type}:${parsed.token}`;
  const refresh = url.searchParams.get("refresh") === "1";
  if (!refresh) {
    const cached = await edgeGet(url.host, key);
    if (cached) return json({ ...cached, fromCache: true }, 200, origin, { "X-Cache": "HIT" });
  }

  const base = /^(localhost|127\.0\.0\.1)$/.test(url.hostname) ? url.origin : `https://${url.host}`;
  const downloadLink = (media, filename) => `${base}/api/download?url=${encodeURIComponent(media)}&filename=${encodeURIComponent(filename)}`;

  let result;
  try {
    result = await resolveLink(parsed, clientIp, downloadLink);
  } catch (err) {
    return json({ ok: false, error: `Could not reach JioSaavn right now (${err.message}). Please try again.` }, 502, origin);
  }
  if (!result) return json({ ok: false, error: `This JioSaavn ${parsed.type} was not found. It may be private or removed.` }, 404, origin);
  if (!result.ok) return json(result, 404, origin);

  ctx.waitUntil(edgePut(url.host, key, result, parsed.type === "playlist" ? 21600 : 86400));
  return json(result, 200, origin, { "X-Cache": "MISS" });
}

async function handleLyrics(request, url, origin) {
  const id = url.searchParams.get("id");
  if (!id || !/^[A-Za-z0-9_-]{4,20}$/.test(id)) return json({ ok: false, error: "Missing song id" }, 400, origin);
  try {
    const data = await saavnApi({ __call: "lyrics.getLyrics", lyrics_id: id }, request.headers.get("CF-Connecting-IP") || "");
    if (!data.lyrics) return json({ ok: false, error: "No lyrics for this song." }, 404, origin);
    const text = decodeEntities(String(data.lyrics).replace(/<br\s*\/?>/gi, "\n"));
    return json({ ok: true, lyrics: text, copyright: decodeEntities(data.lyrics_copyright || "") }, 200, origin, { "Cache-Control": "public, max-age=86400" });
  } catch (err) {
    return json({ ok: false, error: err.message }, 502, origin);
  }
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin");

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(origin, { "Access-Control-Max-Age": "86400" }) });
    if (request.method !== "GET" && request.method !== "HEAD") return json({ ok: false, error: "Method not allowed" }, 405, origin);
    if (!isOriginAllowed(origin)) return json({ ok: false, error: "Origin not allowed" }, 403, origin);

    try {
      switch (url.pathname) {
        case "/":
        case "/health":
          return json({ ok: true, service: "JioSaavn worker", version: CACHE_VERSION, time: new Date().toISOString() }, 200, origin);
        case "/api/resolve":
          return await handleResolve(request, url, env, ctx, origin);
        case "/api/download":
          return await handleDownload(request, url, origin);
        case "/api/lyrics":
          return await handleLyrics(request, url, origin);
        default:
          return json({ ok: false, error: "Not Found" }, 404, origin);
      }
    } catch (err) {
      return json({ ok: false, error: "Internal error", message: err?.message || String(err) }, 500, origin);
    }
  },
};

export { bigImage };
