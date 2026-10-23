/**
 * YouTube worker (youtube.onlineplayer.site)
 *
 * Playback uses YouTube's own embedded player in the page, so it has no limits and
 * costs this worker nothing. The worker resolves links (video / playlist metadata)
 * and offers best-effort downloads: YouTube sometimes answers datacenter requests
 * with a "confirm you're not a bot" check; then the download is refused with a clear
 * message. Nothing here tries to get around that check.
 */

import { parseYouTubeUrl, pickFormats, playlistFromNext, safeFilename, thumbnails } from "./yt.js";

const WEB_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const CACHE_VERSION = "v1";
const CHUNK = 10 * 1024 * 1024; // googlevideo serves large files fastest in ranged chunks

// Public Innertube clients whose formats carry direct URLs (no signature cipher)
const PLAYER_CLIENTS = [
  {
    name: "ANDROID_VR",
    id: "28",
    version: "1.60.19",
    ua: "com.google.android.apps.youtube.vr.oculus/1.60.19 (Linux; U; Android 12L; eureka-user Build/SQ3A.220605.009.A1) gzip",
    extra: { deviceMake: "Oculus", deviceModel: "Quest 3", androidSdkVersion: 32, osName: "Android", osVersion: "12L" },
  },
  {
    name: "IOS",
    id: "5",
    version: "20.10.4",
    ua: "com.google.ios.youtube/20.10.4 (iPhone16,2; U; CPU iOS 18_3_2 like Mac OS X;)",
    extra: { deviceMake: "Apple", deviceModel: "iPhone16,2", osName: "iPhone", osVersion: "18.3.2.22D82" },
  },
];

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
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Expose-Headers": "Content-Length, Content-Disposition, X-Cache, X-Download-Error",
    Vary: "Origin",
    ...extra,
  };
}

function json(data, status = 200, origin = null, extra = {}) {
  return new Response(JSON.stringify(data), { status, headers: cors(origin, { "Content-Type": "application/json; charset=utf-8", ...extra }) });
}

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

async function oembed(videoId) {
  const res = await fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(`https://www.youtube.com/watch?v=${videoId}`)}`, {
    headers: { "User-Agent": WEB_UA },
  });
  if (res.status === 401 || res.status === 403) return { blocked: true };
  if (!res.ok) return null;
  return res.json();
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

async function innertubePlayer(videoId) {
  let lastReason = "";
  for (const c of PLAYER_CLIENTS) {
    try {
      const res = await fetch("https://www.youtube.com/youtubei/v1/player?prettyPrint=false", {
        method: "POST",
        headers: { "Content-Type": "application/json", "User-Agent": c.ua, "X-YouTube-Client-Name": c.id, "X-YouTube-Client-Version": c.version },
        body: JSON.stringify({ context: { client: { clientName: c.name, clientVersion: c.version, hl: "en", gl: "IN", ...c.extra } }, videoId }),
      });
      const data = await res.json().catch(() => null);
      const status = data?.playabilityStatus?.status;
      if (status === "OK") return { data, client: c };
      lastReason = data?.playabilityStatus?.reason || status || `HTTP ${res.status}`;
    } catch (err) {
      lastReason = err.message;
    }
  }
  return { error: lastReason || "unavailable" };
}

async function handleResolve(request, url, env, ctx, origin) {
  const input = url.searchParams.get("url");
  if (!input) return json({ ok: false, error: "Missing url parameter" }, 400, origin);
  if (env.RESOLVE_LIMITER) {
    const { success } = await env.RESOLVE_LIMITER.limit({ key: request.headers.get("CF-Connecting-IP") || "unknown" });
    if (!success) return json({ ok: false, error: "Too many requests. Please wait a minute and try again." }, 429, origin, { "Retry-After": "60" });
  }

  const parsed = parseYouTubeUrl(input);
  if (!parsed) return json({ ok: false, error: "This does not look like a YouTube video, Shorts or playlist link." }, 400, origin);

  const key = `yt:${CACHE_VERSION}:${parsed.listId || ""}:${parsed.listId ? "" : parsed.videoId}`;
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
    if (!meta) return json({ ok: false, error: "This video is private, removed or cannot be embedded." }, 404, origin);
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

/**
 * Streams a download through this worker. googlevideo URLs are tied to the IP that
 * asked for them, so the lookup and the transfer must happen in the same request.
 */
async function handleDownload(request, url, env, origin) {
  const videoId = url.searchParams.get("v") || "";
  const kind = url.searchParams.get("kind") === "audio" ? "audio" : "video";
  if (!/^[A-Za-z0-9_-]{11}$/.test(videoId)) return json({ ok: false, error: "Missing or invalid video id" }, 400, origin);

  if (env.DOWNLOAD_LIMITER) {
    const { success } = await env.DOWNLOAD_LIMITER.limit({ key: request.headers.get("CF-Connecting-IP") || "unknown" });
    if (!success) return json({ ok: false, error: "Too many downloads at once. Please wait a minute." }, 429, origin, { "Retry-After": "60" });
  }

  const player = await innertubePlayer(videoId);
  if (player.error) {
    const botCheck = /bot|sign in|login/i.test(player.error);
    return json(
      {
        ok: false,
        error: botCheck
          ? "YouTube is asking our server to sign in right now, so this download is not available. Playback still works; try the download again in a few minutes."
          : `YouTube does not allow this video to be downloaded (${player.error}).`,
      },
      503,
      origin,
      { "X-Download-Error": botCheck ? "bot-check" : "unavailable" }
    );
  }

  const formats = pickFormats(player.data);
  const format = kind === "audio" ? formats.audio : formats.video;
  if (!format) return json({ ok: false, error: `No ${kind} file is available for this video.` }, 404, origin);

  const title = safeFilename(player.data.videoDetails?.title || videoId);
  const ext = kind === "audio" ? "m4a" : "mp4";
  const quality = kind === "audio" ? `${Math.round((format.bitrate || 128000) / 1000)}kbps` : `${format.height || 360}p`;
  const filename = `${title} (${quality}).${ext}`;
  const total = parseInt(format.contentLength || "0", 10);
  const ua = player.client.ua;

  // Ranged chunks piped into one response
  const { readable, writable } = new TransformStream();
  const pump = async () => {
    const writer = writable.getWriter();
    const copy = async (target) => {
      const res = await fetch(target, { headers: { "User-Agent": ua } });
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
      const reader = res.body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        await writer.write(value);
      }
    };
    try {
      if (!total) {
        await copy(format.url);
      } else {
        for (let start = 0; start < total; start += CHUNK) {
          await copy(`${format.url}&range=${start}-${Math.min(start + CHUNK, total) - 1}`);
        }
      }
      await writer.close();
    } catch (err) {
      await writer.abort(err).catch(() => {});
    }
  };
  const done = pump();

  const ascii = filename.replace(/[^\x20-\x7e]/g, "_").replace(/"/g, "'");
  const headers = cors(origin, {
    "Content-Type": kind === "audio" ? "audio/mp4" : "video/mp4",
    "Content-Disposition": `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
    "Cache-Control": "no-store",
  });
  if (total) headers["Content-Length"] = String(total);
  return { response: new Response(readable, { status: 200, headers }), done };
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin");
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(origin, { "Access-Control-Max-Age": "86400" }) });
    if (request.method !== "GET") return json({ ok: false, error: "Method not allowed" }, 405, origin);
    if (!isOriginAllowed(origin)) return json({ ok: false, error: "Origin not allowed" }, 403, origin);

    try {
      switch (url.pathname) {
        case "/":
        case "/health":
          return json({ ok: true, service: "YouTube worker", version: CACHE_VERSION, time: new Date().toISOString() }, 200, origin);
        case "/api/resolve":
          return await handleResolve(request, url, env, ctx, origin);
        case "/api/download": {
          const out = await handleDownload(request, url, env, origin);
          if (out instanceof Response) return out;
          ctx.waitUntil(out.done);
          return out.response;
        }
        default:
          return json({ ok: false, error: "Not Found" }, 404, origin);
      }
    } catch (err) {
      return json({ ok: false, error: "Internal error", message: err?.message || String(err) }, 500, origin);
    }
  },
};
