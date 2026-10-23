/**
 * YouTube worker (youtube.onlineplayer.site)
 *
 * Ad-free playback: the worker reads a video's DASH formats from YouTube's public
 * Innertube API (official iOS / Android VR clients), turns them into HLS playlists
 * (src/hls.js) and proxies the byte ranges, so the page plays them in its own player.
 * Segments are edge-cached per colo; player responses are shared through KV, so a
 * video is looked up on YouTube about once every few hours worldwide.
 *
 * Downloads use the same /seg ranges; the browser joins video + audio into one MP4.
 * When YouTube refuses every client (its "confirm you're not a bot" check), the API
 * says so and the page falls back to YouTube's embedded player. That check is not
 * circumvented here.
 */

import { masterPlaylist, mediaPlaylist, mergeRefs, parseRange, parseSidx, pickHlsFormats } from "./hls.js";
import { parseYouTubeUrl, playlistFromNext, safeFilename, thumbnails } from "./yt.js";

const WEB_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const CACHE_VERSION = "v2";
const CHUNK = 10 * 1024 * 1024; // googlevideo serves large files fastest in ranged chunks
const MAX_RANGE = 16 * 1024 * 1024; // one /seg response at most

// Public Innertube clients whose formats carry direct URLs (no signature cipher).
// iOS answers datacenter requests most often, so it goes first and gets a retry.
const CLIENTS = {
  IOS: {
    name: "IOS",
    id: "5",
    version: "20.10.4",
    ua: "com.google.ios.youtube/20.10.4 (iPhone16,2; U; CPU iOS 18_3_2 like Mac OS X;)",
    extra: { deviceMake: "Apple", deviceModel: "iPhone16,2", osName: "iPhone", osVersion: "18.3.2.22D82" },
  },
  ANDROID_VR: {
    name: "ANDROID_VR",
    id: "28",
    version: "1.60.19",
    ua: "com.google.android.apps.youtube.vr.oculus/1.60.19 (Linux; U; Android 12L; eureka-user Build/SQ3A.220605.009.A1) gzip",
    extra: { deviceMake: "Oculus", deviceModel: "Quest 3", androidSdkVersion: 32, osName: "Android", osVersion: "12L" },
  },
};
// YouTube's sign-in check depends on load per egress IP, so a retry often lands elsewhere
const CLIENT_ORDER = ["IOS", "ANDROID_VR", "IOS", "ANDROID_VR", "IOS"];

function isOriginAllowed(origin) {
  if (!origin) return true;
  try {
    const host = new URL(origin).hostname.toLowerCase();
    return host === "onlineplayer.site" || host.endsWith(".onlineplayer.site") || host.endsWith(".pages.dev") || host === "localhost" || host === "127.0.0.1";
  } catch {
    return false;
  }
}

function cors(origin, extra = {}) {
  return {
    "Access-Control-Allow-Origin": origin && isOriginAllowed(origin) ? origin : "*",
    "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Range",
    "Access-Control-Expose-Headers": "Content-Length, Content-Range, Accept-Ranges, Content-Disposition, X-Cache, X-Download-Error",
    Vary: "Origin",
    ...extra,
  };
}

function json(data, status = 200, origin = null, extra = {}) {
  return new Response(JSON.stringify(data), { status, headers: cors(origin, { "Content-Type": "application/json; charset=utf-8", ...extra }) });
}

function text(body, type, origin, extra = {}) {
  return new Response(body, { headers: cors(origin, { "Content-Type": type, ...extra }) });
}

// ---------------------------------------------------------------------------
// Edge cache (Cache API): free and unmetered. Per colo, which suits googlevideo
// URLs: they are only valid from the network that asked for them.
// ---------------------------------------------------------------------------
const cacheKey = (host, key) => new Request(`https://${host}/__edge-cache/${encodeURIComponent(key)}`);
async function edgeGet(host, key, as = "json") {
  try {
    const r = await caches.default.match(cacheKey(host, key));
    if (!r) return null;
    return as === "json" ? await r.json() : as === "text" ? await r.text() : r;
  } catch {
    return null;
  }
}
async function edgePut(host, key, body, ttl, type = "application/json") {
  try {
    const payload = typeof body === "string" || body instanceof ArrayBuffer || body instanceof ReadableStream ? body : JSON.stringify(body);
    await caches.default.put(cacheKey(host, key), new Response(payload, { headers: { "Content-Type": type, "Cache-Control": `public, max-age=${Math.max(60, Math.floor(ttl))}` } }));
  } catch {
    // best-effort
  }
}
async function edgeDelete(host, key) {
  try {
    await caches.default.delete(cacheKey(host, key));
  } catch {
    // best-effort
  }
}

// ---------------------------------------------------------------------------
// YouTube APIs
// ---------------------------------------------------------------------------
async function oembed(videoId) {
  const res = await fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(`https://www.youtube.com/watch?v=${videoId}`)}`, {
    headers: { "User-Agent": WEB_UA },
  });
  if (!res.ok) return null;
  return res.json().catch(() => null);
}

async function innertubeNext(listId, videoId) {
  const res = await fetch("https://www.youtube.com/youtubei/v1/next?prettyPrint=false", {
    method: "POST",
    headers: { "Content-Type": "application/json", "User-Agent": WEB_UA },
    body: JSON.stringify({
      context: { client: { clientName: "WEB", clientVersion: "2.20250101.00.00", hl: "en", gl: "IN" } },
      playlistId: listId,
      ...(videoId ? { videoId } : {}),
    }),
  });
  if (!res.ok) return null;
  return res.json().catch(() => null);
}

async function callPlayer(clientName, videoId) {
  const c = CLIENTS[clientName];
  const res = await fetch("https://www.youtube.com/youtubei/v1/player?prettyPrint=false", {
    method: "POST",
    headers: { "Content-Type": "application/json", "User-Agent": c.ua, "X-YouTube-Client-Name": c.id, "X-YouTube-Client-Version": c.version },
    body: JSON.stringify({ context: { client: { clientName: c.name, clientVersion: c.version, hl: "en", gl: "IN", ...c.extra } }, videoId }),
  });
  return res.json().catch(() => null);
}

const FORMAT_FIELDS = ["itag", "url", "mimeType", "width", "height", "fps", "bitrate", "averageBitrate", "contentLength", "initRange", "indexRange", "approxDurationMs", "qualityLabel", "audioQuality"];

/**
 * The playable formats of a video, cached per colo until shortly before the URLs expire.
 * Returns { ok: true, player } or { ok: false, reason, botCheck }.
 */
async function getPlayer(env, host, videoId, ctx, { fresh = false } = {}) {
  const key = `yt:${CACHE_VERSION}:player:${videoId}`;
  if (!fresh) {
    const cached = await edgeGet(host, key);
    if (cached) return { ok: true, player: cached };
    // Shared copy from another colo (googlevideo URLs work from any network)
    const shared = env.YT_PLAYERS ? await env.YT_PLAYERS.get(key, "json").catch(() => null) : null;
    if (shared && shared.expiresAt > Date.now() + 10 * 60 * 1000) {
      ctx.waitUntil(edgePut(host, key, shared, (shared.expiresAt - Date.now()) / 1000));
      return { ok: true, player: shared };
    }
  }
  let lastReason = "unavailable";
  for (const [attempt, name] of CLIENT_ORDER.entries()) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, 150 + Math.random() * 250));
    let data;
    try {
      data = await callPlayer(name, videoId);
    } catch (err) {
      lastReason = err.message;
      continue;
    }
    const status = data?.playabilityStatus?.status;
    if (status !== "OK") {
      lastReason = data?.playabilityStatus?.reason || status || "no answer";
      continue;
    }
    const sd = data.streamingData || {};
    const pick = (f) => Object.fromEntries(FORMAT_FIELDS.filter((k) => f[k] !== undefined).map((k) => [k, f[k]]));
    const player = {
      client: name,
      title: data.videoDetails?.title || "",
      channel: data.videoDetails?.author || "",
      lengthSeconds: parseInt(data.videoDetails?.lengthSeconds || "0", 10),
      isLive: Boolean(data.videoDetails?.isLiveContent && sd.hlsManifestUrl && !sd.adaptiveFormats?.length),
      hlsManifestUrl: sd.hlsManifestUrl || null,
      formats: (sd.formats || []).filter((f) => f.url).map(pick),
      adaptiveFormats: (sd.adaptiveFormats || []).filter((f) => f.url).map(pick),
    };
    if (!player.adaptiveFormats.length && !player.formats.length) {
      lastReason = "no direct formats";
      continue;
    }
    const ttl = Math.min(parseInt(sd.expiresInSeconds || "21600", 10) - 1200, 5 * 3600);
    player.expiresAt = Date.now() + ttl * 1000;
    ctx.waitUntil(edgePut(host, key, player, ttl));
    if (env.YT_PLAYERS) ctx.waitUntil(env.YT_PLAYERS.put(key, JSON.stringify(player), { expirationTtl: Math.max(60, Math.floor(ttl)) }).catch(() => {}));
    return { ok: true, player };
  }
  return { ok: false, reason: lastReason, botCheck: /bot|sign in|login/i.test(lastReason) };
}

function findFormat(player, itag) {
  return [...player.adaptiveFormats, ...player.formats].find((f) => String(f.itag) === String(itag)) || null;
}

const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

function playerError(result, origin) {
  return json(
    {
      ok: false,
      botCheck: result.botCheck,
      error: result.botCheck
        ? "YouTube is asking our server to sign in right now, so ad-free playback is not available for this video at the moment."
        : `YouTube does not allow this video to be played here (${result.reason}).`,
    },
    503,
    origin,
    { "X-Download-Error": result.botCheck ? "bot-check" : "unavailable", "Cache-Control": "no-store" }
  );
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------
async function handleResolve(request, url, env, ctx, origin) {
  const input = url.searchParams.get("url");
  if (!input) return json({ ok: false, error: "Missing url parameter" }, 400, origin);
  if (env.RESOLVE_LIMITER) {
    const { success } = await env.RESOLVE_LIMITER.limit({ key: request.headers.get("CF-Connecting-IP") || "unknown" });
    if (!success) return json({ ok: false, error: "Too many requests. Please wait a minute and try again." }, 429, origin, { "Retry-After": "60" });
  }

  const parsed = parseYouTubeUrl(input);
  if (!parsed) return json({ ok: false, error: "This does not look like a YouTube video, Shorts or playlist link." }, 400, origin);

  const key = `yt:${CACHE_VERSION}:resolve:${parsed.listId || ""}:${parsed.listId ? "" : parsed.videoId}`;
  const cached = url.searchParams.get("refresh") === "1" ? null : await edgeGet(url.host, key);
  if (cached) return json({ ...cached, fromCache: true }, 200, origin, { "X-Cache": "HIT" });

  let result;
  if (parsed.listId) {
    const next = await innertubeNext(parsed.listId, parsed.videoId);
    const playlist = next && playlistFromNext(next);
    if (playlist && playlist.videos.length) {
      result = { ok: true, provider: "youtube", type: "playlist", ...playlist, startVideoId: parsed.videoId || playlist.videos[0].id, sourceUrl: `https://www.youtube.com/playlist?list=${parsed.listId}` };
    } else if (!parsed.videoId) {
      return json({ ok: false, error: "This playlist is private, empty or could not be read." }, 404, origin);
    }
  }

  if (!result) {
    const meta = await oembed(parsed.videoId);
    if (!meta) return json({ ok: false, error: "This video is private, removed or cannot be played outside YouTube." }, 404, origin);
    result = {
      ok: true,
      provider: "youtube",
      type: "video",
      id: parsed.videoId,
      title: meta.title || "YouTube video",
      channel: meta.author_name || "",
      channelUrl: meta.author_url || "",
      thumbnail: thumbnails(parsed.videoId).max,
      thumbnailFallback: thumbnails(parsed.videoId).high,
      isShort: /\/shorts\//.test(input),
      sourceUrl: `https://www.youtube.com/watch?v=${parsed.videoId}`,
    };
  }

  ctx.waitUntil(edgePut(url.host, key, result, result.type === "playlist" ? 21600 : 86400));
  return json(result, 200, origin, { "X-Cache": "MISS" });
}

/** Qualities and the ad-free HLS address for one video */
async function handleStreams(request, url, env, ctx, origin) {
  const v = url.searchParams.get("v") || "";
  if (!VIDEO_ID.test(v)) return json({ ok: false, error: "Missing or invalid video id" }, 400, origin);
  if (env.RESOLVE_LIMITER) {
    const { success } = await env.RESOLVE_LIMITER.limit({ key: request.headers.get("CF-Connecting-IP") || "unknown" });
    if (!success) return json({ ok: false, error: "Too many requests. Please wait a minute." }, 429, origin, { "Retry-After": "60" });
  }
  const result = await getPlayer(env, url.host, v, ctx, { fresh: url.searchParams.get("fresh") === "1" });
  if (!result.ok) return playerError(result, origin);
  const p = result.player;
  const { videos, audio } = pickHlsFormats({ adaptiveFormats: p.adaptiveFormats });
  const base = `https://${url.host}`;
  const playable = videos.length > 0 && audio;
  return json(
    {
      ok: true,
      id: v,
      title: p.title,
      channel: p.channel,
      duration: p.lengthSeconds,
      live: p.isLive,
      hls: playable ? `${base}/hls/${v}/master.m3u8` : null,
      qualities: videos.map((f) => ({ itag: f.itag, height: f.height, fps: f.fps || 30, size: parseInt(f.contentLength || "0", 10) })),
      audio: audio ? { itag: audio.itag, bitrate: audio.bitrate || 0, size: parseInt(audio.contentLength || "0", 10) } : null,
      segBase: `${base}/seg/${v}`,
    },
    200,
    origin,
    { "Cache-Control": "no-store" }
  );
}

async function handleMaster(url, env, ctx, origin, v) {
  const result = await getPlayer(env, url.host, v, ctx);
  if (!result.ok) return playerError(result, origin);
  const { videos, audio } = pickHlsFormats({ adaptiveFormats: result.player.adaptiveFormats });
  if (!videos.length || !audio) return json({ ok: false, error: "No HLS-compatible formats for this video." }, 404, origin);
  const body = masterPlaylist({ videos, audio, base: `https://${url.host}/hls/${v}` });
  return text(body, "application/vnd.apple.mpegurl", origin, { "Cache-Control": "private, max-age=300" });
}

async function handleMedia(url, env, ctx, origin, v, itag) {
  const key = `yt:${CACHE_VERSION}:media:${v}:${itag}`;
  const cached = await edgeGet(url.host, key, "text");
  if (cached) return text(cached, "application/vnd.apple.mpegurl", origin, { "Cache-Control": "private, max-age=3600", "X-Cache": "HIT" });

  const result = await getPlayer(env, url.host, v, ctx);
  if (!result.ok) return playerError(result, origin);
  const f = findFormat(result.player, itag);
  if (!f?.indexRange || !f?.initRange) return json({ ok: false, error: "Unknown format" }, 404, origin);

  const indexStart = parseInt(f.indexRange.start, 10);
  const indexEnd = parseInt(f.indexRange.end, 10);
  const res = await fetch(`${f.url}&range=${indexStart}-${indexEnd}`, { headers: { "User-Agent": CLIENTS[result.player.client].ua } });
  if (!res.ok) {
    ctx.waitUntil(edgeDelete(url.host, `yt:${CACHE_VERSION}:player:${v}`));
    if (env.YT_PLAYERS) ctx.waitUntil(env.YT_PLAYERS.delete(`yt:${CACHE_VERSION}:player:${v}`).catch(() => {}));
    return json({ ok: false, error: `YouTube refused the index (HTTP ${res.status}). Reload to try again.` }, 502, origin);
  }
  const { refs } = parseSidx(new Uint8Array(await res.arrayBuffer()), indexEnd);
  const body = mediaPlaylist({ initEnd: parseInt(f.initRange.end, 10), segments: mergeRefs(refs, 20), segUrl: `https://${url.host}/seg/${v}/${itag}` });
  // The playlist holds no URLs from YouTube, so it outlives the player cache
  ctx.waitUntil(edgePut(url.host, key, body, 86400, "application/vnd.apple.mpegurl"));
  return text(body, "application/vnd.apple.mpegurl", origin, { "Cache-Control": "private, max-age=3600", "X-Cache": "MISS" });
}

/** Byte ranges of one format, proxied from googlevideo and edge-cached */
async function handleSegment(request, url, env, ctx, origin, v, itag) {
  if (env.SEGMENT_LIMITER) {
    const { success } = await env.SEGMENT_LIMITER.limit({ key: request.headers.get("CF-Connecting-IP") || "unknown" });
    if (!success) return json({ ok: false, error: "Too many requests. Please slow down." }, 429, origin, { "Retry-After": "30" });
  }

  let result = await getPlayer(env, url.host, v, ctx);
  if (!result.ok) return playerError(result, origin);
  let f = findFormat(result.player, itag);
  if (!f) return json({ ok: false, error: "Unknown format" }, 404, origin);
  const total = parseInt(f.contentLength || "0", 10);
  if (!total) return json({ ok: false, error: "This format has no known size." }, 404, origin);

  const range = parseRange(request.headers.get("Range"), total) || [0, total - 1];
  const start = range[0];
  const end = Math.min(range[1], start + MAX_RANGE - 1);
  const partial = !(start === 0 && end === total - 1);
  const type = f.mimeType?.split(";")[0] || "application/octet-stream";
  const headers = (cache) =>
    cors(origin, {
      "Content-Type": type,
      "Content-Length": String(end - start + 1),
      "Accept-Ranges": "bytes",
      "Cache-Control": "public, max-age=86400",
      "X-Cache": cache,
      ...(partial ? { "Content-Range": `bytes ${start}-${end}/${total}` } : {}),
    });

  const segKey = `yt:${CACHE_VERSION}:seg:${v}:${itag}:${start}-${end}`;
  const hit = await edgeGet(url.host, segKey, "response");
  if (hit) return new Response(request.method === "HEAD" ? null : hit.body, { status: partial ? 206 : 200, headers: headers("HIT") });
  if (request.method === "HEAD") return new Response(null, { status: partial ? 206 : 200, headers: headers("MISS") });

  let upstream = await fetch(`${f.url}&range=${start}-${end}`, { headers: { "User-Agent": CLIENTS[result.player.client].ua } });
  if (upstream.status === 403 || upstream.status === 410) {
    // URL expired or refused: ask YouTube again once
    result = await getPlayer(env, url.host, v, ctx, { fresh: true });
    if (!result.ok) return playerError(result, origin);
    f = findFormat(result.player, itag);
    if (!f) return json({ ok: false, error: "Format no longer offered" }, 404, origin);
    upstream = await fetch(`${f.url}&range=${start}-${end}`, { headers: { "User-Agent": CLIENTS[result.player.client].ua } });
  }
  if (!upstream.ok || !upstream.body) return json({ ok: false, error: `YouTube answered HTTP ${upstream.status}` }, 502, origin);

  const [forUser, forCache] = upstream.body.tee();
  ctx.waitUntil(edgePut(url.host, segKey, forCache, 86400, type));
  return new Response(forUser, { status: partial ? 206 : 200, headers: headers("MISS") });
}

/** Single-file download (audio M4A, or a format that already has sound) streamed in ranged chunks */
async function handleDownload(request, url, env, ctx, origin) {
  const v = url.searchParams.get("v") || "";
  const kind = url.searchParams.get("kind") === "audio" ? "audio" : "video";
  if (!VIDEO_ID.test(v)) return json({ ok: false, error: "Missing or invalid video id" }, 400, origin);
  if (env.DOWNLOAD_LIMITER) {
    const { success } = await env.DOWNLOAD_LIMITER.limit({ key: request.headers.get("CF-Connecting-IP") || "unknown" });
    if (!success) return json({ ok: false, error: "Too many downloads at once. Please wait a minute." }, 429, origin, { "Retry-After": "60" });
  }
  const result = await getPlayer(env, url.host, v, ctx);
  if (!result.ok) return playerError(result, origin);
  const p = result.player;
  const format =
    kind === "audio"
      ? pickHlsFormats({ adaptiveFormats: p.adaptiveFormats }).audio
      : p.formats.filter((f) => f.mimeType?.startsWith("video/mp4")).sort((a, b) => (b.height || 0) - (a.height || 0))[0];
  if (!format) return json({ ok: false, error: kind === "audio" ? "No audio file is available." : "Pick a quality to download; this video has no single-file version." }, 404, origin);

  const title = safeFilename(p.title || v);
  const ext = kind === "audio" ? "m4a" : "mp4";
  const quality = kind === "audio" ? `${Math.round((format.bitrate || 128000) / 1000)}kbps` : `${format.height || 360}p`;
  const filename = `${title} (${quality}).${ext}`;
  const total = parseInt(format.contentLength || "0", 10);
  const ua = CLIENTS[p.client].ua;

  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const copy = async (target) => {
    const res = await fetch(target, { headers: { "User-Agent": ua } });
    if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
    const reader = res.body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      await writer.write(value);
    }
  };
  ctx.waitUntil(
    (async () => {
      try {
        if (!total) await copy(format.url);
        else for (let s = 0; s < total; s += CHUNK) await copy(`${format.url}&range=${s}-${Math.min(s + CHUNK, total) - 1}`);
        await writer.close();
      } catch (err) {
        await writer.abort(err).catch(() => {});
      }
    })()
  );

  const ascii = filename.replace(/[^\x20-\x7e]/g, "_").replace(/"/g, "'");
  return new Response(readable, {
    status: 200,
    headers: cors(origin, {
      "Content-Type": kind === "audio" ? "audio/mp4" : "video/mp4",
      "Content-Disposition": `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      "Cache-Control": "no-store",
      ...(total ? { "Content-Length": String(total) } : {}),
    }),
  });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin");
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(origin, { "Access-Control-Max-Age": "86400" }) });
    if (request.method !== "GET" && request.method !== "HEAD") return json({ ok: false, error: "Method not allowed" }, 405, origin);
    if (!isOriginAllowed(origin)) return json({ ok: false, error: "Origin not allowed" }, 403, origin);

    try {
      const path = url.pathname;
      let m;
      if (path === "/" || path === "/health") return json({ ok: true, service: "YouTube worker", version: CACHE_VERSION, time: new Date().toISOString() }, 200, origin);
      if (path === "/api/resolve") return await handleResolve(request, url, env, ctx, origin);
      if (path === "/api/streams") return await handleStreams(request, url, env, ctx, origin);
      if (path === "/api/download") return await handleDownload(request, url, env, ctx, origin);
      if ((m = /^\/hls\/([A-Za-z0-9_-]{11})\/master\.m3u8$/.exec(path))) return await handleMaster(url, env, ctx, origin, m[1]);
      if ((m = /^\/hls\/([A-Za-z0-9_-]{11})\/(\d{1,4})\.m3u8$/.exec(path))) return await handleMedia(url, env, ctx, origin, m[1], m[2]);
      if ((m = /^\/seg\/([A-Za-z0-9_-]{11})\/(\d{1,4})$/.exec(path))) return await handleSegment(request, url, env, ctx, origin, m[1], m[2]);
      return json({ ok: false, error: "Not Found" }, 404, origin);
    } catch (err) {
      return json({ ok: false, error: "Internal error", message: err?.message || String(err) }, 500, origin);
    }
  },
};
