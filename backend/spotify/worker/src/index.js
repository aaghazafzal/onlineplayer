/**
 * Spotify Track Stream Engine
 * Cloudflare Worker: Spotify metadata -> exact-recording match on JioSaavn -> 320/160 kbps AAC streams.
 * KV caching, HTTP 206 range proxy, host-allowlisted media proxy.
 */

// Only the DES-ECB pieces of crypto-js (the full library is ~200 KB and costs cold-start CPU)
import CryptoJS from "crypto-js/core";
import "crypto-js/tripledes";
import "crypto-js/mode-ecb";
import { buildQueries, confidenceLabel, decodeEntities, pickBestMatch } from "./matcher.js";

const CACHE_VERSION = "v2";
const PREVIEW_CACHE_TTL = 3600; // re-try full-length matching every hour for preview-only tracks
const BROWSER_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

// Only these media hosts may be fetched through /api/proxy and /api/download
const MEDIA_HOST_SUFFIXES = [".saavncdn.com", ".scdn.co", ".spotifycdn.com"];

function isOriginAllowed(origin) {
  if (!origin) return true; // <audio>, curl and same-origin requests carry no Origin
  try {
    const host = new URL(origin).hostname.toLowerCase();
    return (
      host === "onlineplayer.site" ||
      host.endsWith(".onlineplayer.site") ||
      host.endsWith(".pages.dev") ||
      host === "localhost" ||
      host === "127.0.0.1"
    );
  } catch {
    return false;
  }
}

function isMediaUrlAllowed(rawUrl) {
  try {
    const u = new URL(rawUrl);
    if (u.protocol !== "https:") return false;
    const host = u.hostname.toLowerCase();
    return MEDIA_HOST_SUFFIXES.some((s) => host.endsWith(s));
  } catch {
    return false;
  }
}

// DES-ECB decryption for JioSaavn media URLs
function decryptMediaUrl(encryptedUrl) {
  try {
    const key = CryptoJS.enc.Utf8.parse("38346591");
    const decrypted = CryptoJS.DES.decrypt(
      { ciphertext: CryptoJS.enc.Base64.parse(encryptedUrl) },
      key,
      { mode: CryptoJS.mode.ECB, padding: CryptoJS.pad.Pkcs7 }
    );
    const url = decrypted.toString(CryptoJS.enc.Utf8);
    return url ? url.replace(/^http:\/\//, "https://") : null;
  } catch {
    return null;
  }
}

function corsHeaders(origin, extra = {}) {
  return {
    "Access-Control-Allow-Origin": origin && isOriginAllowed(origin) ? origin : "*",
    "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Range",
    "Access-Control-Expose-Headers": "Content-Length, Content-Range, Accept-Ranges, Content-Disposition, X-Cache",
    Vary: "Origin",
    ...extra,
  };
}

function jsonResponse(data, status = 200, origin = null, extra = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: corsHeaders(origin, { "Content-Type": "application/json; charset=utf-8", ...extra }),
  });
}

// ---------------------------------------------------------------------------
// Spotify metadata
// ---------------------------------------------------------------------------

async function parseSpotifyUrl(rawUrl) {
  if (!rawUrl) return null;
  let str = rawUrl.trim();

  const uriMatch = str.match(/^spotify:(track|playlist|album):([A-Za-z0-9]+)/i);
  if (uriMatch) return { type: uriMatch[1].toLowerCase(), id: uriMatch[2] };

  // Short links (spotify.link / spotify.app.link) redirect to open.spotify.com
  if (/spotify\.(app\.)?link/i.test(str)) {
    try {
      const resp = await fetch(str, { redirect: "follow", headers: { "User-Agent": BROWSER_UA } });
      if (resp.url) str = resp.url;
      if (!/\/(track|playlist|album)\//i.test(str)) {
        const html = await resp.text();
        const m = html.match(/open\.spotify\.com\/(track|playlist|album)\/([A-Za-z0-9]+)/i);
        if (m) return { type: m[1].toLowerCase(), id: m[2] };
      }
    } catch {
      // fall through to parsing
    }
  }

  const match = str.match(/\/(track|playlist|album)\/([A-Za-z0-9]+)/i);
  return match ? { type: match[1].toLowerCase(), id: match[2] } : null;
}

function formatDuration(seconds) {
  if (!seconds || seconds <= 0) return "0:00";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const secStr = s < 10 ? `0${s}` : `${s}`;
  if (h > 0) {
    const minStr = m < 10 ? `0${m}` : `${m}`;
    return `${h}:${minStr}:${secStr}`;
  }
  return `${m}:${secStr}`;
}

async function fetchSpotifyCollection(type, id) {
  try {
    const res = await fetch(`https://open.spotify.com/embed/${type}/${id}`, {
      headers: { "User-Agent": BROWSER_UA, Accept: "text/html" },
    });
    if (!res.ok) return null;
    const html = await res.text();
    const match = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
    if (!match) return null;
    const json = JSON.parse(match[1]);
    const entity = json.props?.pageProps?.state?.data?.entity;
    if (!entity || !entity.name) return null;

    const images = entity.visualIdentity?.image || [];
    const sortedImages = [...images].sort((a, b) => (b.maxWidth || 0) - (a.maxWidth || 0));
    const cover = sortedImages[0]?.url || "";

    const rawTracks = entity.trackList || [];
    let totalDurationSec = 0;

    const tracks = rawTracks.map((t, idx) => {
      const trackId = t.uri ? t.uri.replace(/^spotify:track:/, "") : "";
      const durationSec = Math.round((t.duration || 0) / 1000);
      totalDurationSec += durationSec;
      return {
        index: idx + 1,
        id: trackId,
        title: t.title || "Unknown Track",
        artist: t.subtitle || "",
        duration: durationSec,
        durationFormatted: formatDuration(durationSec),
        isExplicit: Boolean(t.isExplicit),
        previewUrl: t.audioPreview?.url || null,
        spotifyUrl: trackId ? `https://open.spotify.com/track/${trackId}` : "",
      };
    });

    return {
      ok: true,
      provider: "spotify",
      type, // "playlist" | "album"
      id,
      title: entity.name || entity.title || `Spotify ${type === "album" ? "Album" : "Playlist"}`,
      subtitle: entity.subtitle || "",
      cover,
      trackCount: tracks.length,
      totalDuration: totalDurationSec,
      totalDurationFormatted: formatDuration(totalDurationSec),
      tracks,
      spotifyUrl: `https://open.spotify.com/${type}/${id}`,
    };
  } catch {
    return null;
  }
}

async function fetchEmbedEntity(trackId) {
  try {
    const res = await fetch(`https://open.spotify.com/embed/track/${trackId}`, {
      headers: { "User-Agent": BROWSER_UA, Accept: "text/html" },
    });
    if (!res.ok) return null;
    const html = await res.text();
    const match = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
    if (!match) return null;
    return JSON.parse(match[1]).props?.pageProps?.state?.data?.entity || null;
  } catch {
    return null;
  }
}

// The public track page carries "Artist · Album · Song · Year" in og:description
/** Read a response body as text until `marker` appears or `maxBytes` is reached, then cancel. */
async function readUntil(res, marker, maxBytes) {
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let text = "";
  try {
    while (text.length < maxBytes) {
      const { done, value } = await reader.read();
      if (done) break;
      text += decoder.decode(value, { stream: true });
      if (text.includes(marker)) break;
    }
  } finally {
    reader.cancel().catch(() => {});
  }
  return text;
}

async function fetchTrackPageInfo(trackId) {
  try {
    const res = await fetch(`https://open.spotify.com/track/${trackId}`, {
      headers: { "User-Agent": BROWSER_UA, Accept: "text/html" },
    });
    if (!res.ok) return null;
    // The og: tags live in <head>; stop reading there instead of decoding the whole
    // ~170 KB page (saves CPU on the free plan's 10 ms budget).
    const html = await readUntil(res, "</head>", 96 * 1024);
    const desc = html.match(/<meta property="og:description" content="([^"]*)"/)?.[1];
    const title = html.match(/<meta property="og:title" content="([^"]*)"/)?.[1];
    const image = html.match(/<meta property="og:image" content="([^"]*)"/)?.[1];
    const info = { title: title ? decodeEntities(title) : "", album: "", year: "", cover: image || "" };
    if (desc) {
      const parts = decodeEntities(desc).split(" · ");
      if (parts.length >= 4) {
        info.album = parts.slice(1, -2).join(" · ");
        info.year = parts[parts.length - 1];
      }
    }
    return info;
  } catch {
    return null;
  }
}

async function fetchSpotifyOembed(trackId) {
  try {
    const res = await fetch(`https://open.spotify.com/oembed?url=https://open.spotify.com/track/${trackId}`, {
      headers: { "User-Agent": BROWSER_UA },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return { title: data.title || "", cover: data.thumbnail_url || "" };
  } catch {
    return null;
  }
}

async function fetchSpotifyMetadata(trackId) {
  const [entity, page] = await Promise.all([fetchEmbedEntity(trackId), fetchTrackPageInfo(trackId)]);

  if (entity) {
    const artistList = (entity.artists || []).map((a) => a.name).filter(Boolean);
    const durationMs = entity.duration || 0;
    return {
      title: entity.name || entity.title || page?.title || "Unknown Track",
      artistList,
      artists: artistList.join(", ") || "Unknown Artist",
      album: page?.album || "",
      year: page?.year || entity.releaseDate?.isoString?.slice(0, 4) || "",
      duration: Math.round(durationMs / 1000),
      cover: entity.visualIdentity?.image?.sort?.((a, b) => (b.maxWidth || 0) - (a.maxWidth || 0))?.[0]?.url || page?.cover || "",
      previewUrl: entity.audioPreview?.url || null,
    };
  }

  const oembed = page?.title ? null : await fetchSpotifyOembed(trackId);
  const title = page?.title || oembed?.title;
  if (!title) return null;
  return {
    title,
    artistList: [],
    artists: "",
    album: page?.album || "",
    year: page?.year || "",
    duration: 0,
    cover: page?.cover || oembed?.cover || "",
    previewUrl: null,
  };
}

// ---------------------------------------------------------------------------
// JioSaavn search + matching
// ---------------------------------------------------------------------------

// JioSaavn tailors its catalogue to the requester's country. Forward the real
// client IP (standard proxy behaviour) so users get the results they would get
// on jiosaavn.com, instead of the Cloudflare edge's country.
async function searchSaavn(query, clientIp) {
  const headers = { "User-Agent": BROWSER_UA, Accept: "application/json" };
  if (clientIp) headers["X-Forwarded-For"] = clientIp;

  try {
    const url =
      "https://www.jiosaavn.com/api.php?__call=search.getResults&_format=json&_marker=0&api_version=4&ctx=web6dot0&n=12&p=1&q=" +
      encodeURIComponent(query);
    const res = await fetch(url, { headers });
    let results = [];
    if (res.ok) {
      const data = await res.json();
      results = (data.results || [])
        .filter((s) => s?.type === "song" && s.more_info?.encrypted_media_url)
        .map((s) => {
          const m = s.more_info;
          const map = m.artistMap || {};
          const names = (arr) => (arr || []).map((a) => decodeEntities(a.name)).filter(Boolean);
          return {
            id: s.id,
            title: decodeEntities(s.title),
            album: decodeEntities(m.album || ""),
            primaryArtists: [...names(map.primary_artists), ...names(map.featured_artists)],
            artists: names(map.artists),
            durationSec: parseInt(m.duration || "0", 10),
            year: s.year || "",
            language: s.language || "",
            has320: m["320kbps"] === "true",
            encryptedMediaUrl: m.encrypted_media_url,
            playCount: parseInt(s.play_count || "0", 10),
            permaUrl: s.perma_url || "",
          };
        });
    }

    if (results.length > 0) return results;

    // Fallback: autocomplete.get for mashups, DJ remixes, and non-standard query strings
    const acUrl =
      "https://www.jiosaavn.com/api.php?__call=autocomplete.get&_format=json&_marker=0&cc=in&includeMetaTags=1&query=" +
      encodeURIComponent(query);
    const acRes = await fetch(acUrl, { headers });
    if (!acRes.ok) return [];
    const acData = await acRes.json();
    const acSongs = acData.songs?.data || [];
    if (!acSongs.length) return [];

    const details = await Promise.all(
      acSongs.slice(0, 3).map(async (as) => {
        if (!as.id) return null;
        try {
          const dUrl =
            "https://www.jiosaavn.com/api.php?__call=song.getDetails&pids=" + as.id + "&_format=json&_marker=0";
          const dRes = await fetch(dUrl, { headers });
          if (!dRes.ok) return null;
          const dData = await dRes.json();
          const songObj = dData[as.id] || Object.values(dData)[0];
          if (!songObj?.encrypted_media_url) return null;
          const map = songObj.artistMap || {};
          const names = (arr) => (arr || []).map((a) => decodeEntities(a.name)).filter(Boolean);
          return {
            id: songObj.id,
            title: decodeEntities(songObj.song || songObj.title),
            album: decodeEntities(songObj.album || ""),
            primaryArtists: (songObj.primary_artists || "")
              .split(",")
              .map((a) => decodeEntities(a.trim()))
              .filter(Boolean),
            artists: names(map.artists),
            durationSec: parseInt(songObj.duration || "0", 10),
            year: songObj.year || "",
            language: songObj.language || "",
            has320: songObj["320kbps"] === "true",
            encryptedMediaUrl: songObj.encrypted_media_url,
            playCount: parseInt(songObj.play_count || "0", 10),
            permaUrl: songObj.perma_url || "",
          };
        } catch {
          return null;
        }
      })
    );

    return details.filter(Boolean);
  } catch {
    return [];
  }
}

async function findFullLengthAudio(meta, clientIp) {
  if (!meta.title || !meta.artistList.length) return { best: null, ranked: [] };

  const target = {
    title: meta.title,
    artists: meta.artistList,
    album: meta.album,
    durationSec: meta.duration,
    year: meta.year,
  };

  const results = await Promise.all(buildQueries(target).map((q) => searchSaavn(q, clientIp)));
  const byId = new Map();
  for (const list of results) for (const c of list) if (!byId.has(c.id)) byId.set(c.id, c);

  return pickBestMatch(target, [...byId.values()]);
}

function buildAudioUrls(cand) {
  const decrypted = decryptMediaUrl(cand.encryptedMediaUrl);
  if (!decrypted || !isMediaUrlAllowed(decrypted)) return null;
  const at = (kbps) => decrypted.replace(/_(96|160|320)\.mp4/, `_${kbps}.mp4`);
  return { audio320: cand.has320 ? at(320) : null, audio160: at(160) };
}

function safeFilename(name) {
  return name.replace(/[\/\\?%*:|"<>\x00-\x1f]/g, "_").replace(/\s+/g, " ").trim().slice(0, 180) || "track";
}

function contentDisposition(filename) {
  const ascii = filename.replace(/[^\x20-\x7e]/g, "_").replace(/"/g, "'");
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

// ---------------------------------------------------------------------------
// Edge cache (Cache API). Free and unmetered; KV writes are capped at 1k/day on
// the free plan, which a popular day would exhaust.
// ---------------------------------------------------------------------------

function edgeCacheKey(host, key) {
  return new Request(`https://${host}/__edge-cache/${encodeURIComponent(key)}`);
}

async function edgeGet(host, key) {
  try {
    const res = await caches.default.match(edgeCacheKey(host, key));
    return res ? await res.json() : null;
  } catch {
    return null;
  }
}

async function edgePut(host, key, value, ttlSeconds) {
  try {
    await caches.default.put(
      edgeCacheKey(host, key),
      new Response(JSON.stringify(value), { headers: { "Cache-Control": `public, max-age=${Math.max(60, ttlSeconds)}` } })
    );
  } catch {
    // best-effort
  }
}

// ---------------------------------------------------------------------------
// Request handlers
// ---------------------------------------------------------------------------

async function handleMediaPassthrough(request, url, origin, asDownload) {
  const targetUrl = url.searchParams.get("url");
  if (!targetUrl) return jsonResponse({ ok: false, error: "Missing url parameter" }, 400, origin);
  if (!isMediaUrlAllowed(targetUrl)) {
    return jsonResponse({ ok: false, error: "This media host is not allowed" }, 403, origin);
  }

  const headers = { "User-Agent": BROWSER_UA };
  const range = request.headers.get("Range");
  if (range && !asDownload) headers.Range = range;

  let upstream;
  try {
    upstream = await fetch(targetUrl, {
      headers,
      cf: { cacheEverything: true, cacheTtl: 86400 },
    });
  } catch (err) {
    return jsonResponse({ ok: false, error: "Upstream media fetch failed", message: err.message }, 502, origin);
  }

  const respHeaders = corsHeaders(origin, {
    "Content-Type": upstream.headers.get("Content-Type") || "audio/mp4",
    "Accept-Ranges": "bytes",
    "Cache-Control": "public, max-age=86400",
  });
  for (const h of ["Content-Range", "Content-Length", "Last-Modified", "ETag"]) {
    const val = upstream.headers.get(h);
    if (val) respHeaders[h] = val;
  }
  if (asDownload) {
    const name = safeFilename(url.searchParams.get("filename") || "track.m4a");
    respHeaders["Content-Disposition"] = contentDisposition(name);
  }

  return new Response(request.method === "HEAD" ? null : upstream.body, {
    status: upstream.status,
    headers: respHeaders,
  });
}

async function handleCollectionResolve(type, id, url, env, ctx, origin) {
  const forceRefresh = url.searchParams.get("refresh") === "1";
  const cacheKey = `spotify:${CACHE_VERSION}:${type}:${id}`;

  if (!forceRefresh) {
    try {
      const cached = await edgeGet(url.host, cacheKey);
      if (cached) return jsonResponse({ ...cached, fromCache: true }, 200, origin, { "X-Cache": "HIT" });
    } catch {
      // cache miss on error
    }
  }

  const collection = await fetchSpotifyCollection(type, id);
  if (!collection) {
    return jsonResponse(
      {
        ok: false,
        error: `Unable to load this Spotify ${type === "album" ? "album" : "playlist"}. Please check that the link is public and active.`,
      },
      404,
      origin
    );
  }

  const ttl = type === "album" ? 604800 : 21600; // 7 days for album, 6 hours for playlist
  ctx.waitUntil(edgePut(url.host, cacheKey, collection, ttl));

  return jsonResponse(collection, 200, origin, { "X-Cache": "MISS" });
}

async function handleResolve(request, url, env, ctx, origin) {
  const inputUrl = url.searchParams.get("url");
  if (!inputUrl) return jsonResponse({ ok: false, error: "Missing url parameter" }, 400, origin);

  if (env.RESOLVE_LIMITER) {
    const ip = request.headers.get("CF-Connecting-IP") || "unknown";
    const { success } = await env.RESOLVE_LIMITER.limit({ key: ip });
    if (!success) {
      return jsonResponse({ ok: false, error: "Too many requests. Please wait a minute and try again." }, 429, origin, {
        "Retry-After": "60",
      });
    }
  }

  const parsed = await parseSpotifyUrl(inputUrl);
  if (!parsed) {
    return jsonResponse(
      {
        ok: false,
        error: "Invalid Spotify URL. Please provide a track, playlist, or album link (e.g. https://open.spotify.com/...)",
      },
      400,
      origin
    );
  }

  const { type, id } = parsed;
  if (type === "playlist" || type === "album") {
    return await handleCollectionResolve(type, id, url, env, ctx, origin);
  }

  const trackId = id;

  const debug = url.searchParams.get("debug") === "1";
  const forceRefresh = debug || url.searchParams.get("refresh") === "1";
  const clientIp = request.headers.get("CF-Connecting-IP") || "";
  // Catalogue differs by country, so Indian and international results are cached apart
  const region = request.cf?.country === "IN" ? "in" : "intl";
  const cacheKey = `spotify:${CACHE_VERSION}:${region}:track:${trackId}`;

  if (!forceRefresh) {
    try {
      const cached = await edgeGet(url.host, cacheKey);
      if (cached) return jsonResponse({ ...cached, fromCache: true }, 200, origin, { "X-Cache": "HIT" });
    } catch {
      // cache miss on error
    }
  }

  const meta = await fetchSpotifyMetadata(trackId);
  if (!meta) {
    return jsonResponse(
      { ok: false, error: "Unable to find this track on Spotify. Please check that the link is public and active." },
      404,
      origin
    );
  }

  const { best, ranked } = await findFullLengthAudio(meta, clientIp);
  const audio = best ? buildAudioUrls(best.cand) : null;

  // Behind the custom domain the public origin is always https
  const base = /^(localhost|127.0.0.1)$/.test(url.hostname) ? url.origin : `https://${url.host}`;
  const label = safeFilename(`${meta.artists || "Spotify"} - ${meta.title}`);
  // Playback goes straight to the CDN (it allows any origin + Range), so seeking costs
  // no Worker requests; /api/proxy stays available as a fallback.
  const proxied = (u) => `${base}/api/proxy?url=${encodeURIComponent(u)}`;
  const playable = (u) => u;
  const download = (u, suffix) =>
    `${base}/api/download?url=${encodeURIComponent(u)}&filename=${encodeURIComponent(`${label}${suffix}`)}`;

  let streams = [];
  let isFullLength = false;
  let match = null;

  if (audio) {
    isFullLength = true;
    if (audio.audio320) {
      streams.push({
        quality: "320 kbps (High)",
        bitrate: "320k",
        codec: "AAC",
        streamUrl: playable(audio.audio320),
        proxyUrl: proxied(audio.audio320),
        directUrl: audio.audio320,
        downloadUrl: download(audio.audio320, " (320kbps).m4a"),
      });
    }
    streams.push({
      quality: "160 kbps (Standard)",
      bitrate: "160k",
      codec: "AAC",
      streamUrl: playable(audio.audio160),
      proxyUrl: proxied(audio.audio160),
      directUrl: audio.audio160,
      downloadUrl: download(audio.audio160, " (160kbps).m4a"),
    });
    match = {
      source: "jiosaavn",
      id: best.cand.id,
      title: best.cand.title,
      artist: best.cand.primaryArtists.join(", "),
      album: best.cand.album,
      duration: best.cand.durationSec,
      score: best.score,
      confidence: confidenceLabel(best.score),
    };
  } else if (meta.previewUrl && isMediaUrlAllowed(meta.previewUrl)) {
    streams.push({
      quality: "Official Preview (30s)",
      bitrate: "preview",
      codec: "MP3",
      streamUrl: playable(meta.previewUrl),
      proxyUrl: proxied(meta.previewUrl),
      directUrl: meta.previewUrl,
      downloadUrl: download(meta.previewUrl, " (Preview).mp3"),
    });
  } else {
    return jsonResponse(
      {
        ok: false,
        error: "No exact full-length match was found for this track, and Spotify offers no preview for it.",
        title: meta.title,
        artist: meta.artists,
      },
      404,
      origin
    );
  }

  const duration = meta.duration || match?.duration || 0;
  const payload = {
    ok: true,
    provider: "spotify",
    type: "track",
    trackId,
    title: meta.title,
    artist: meta.artists,
    album: meta.album || match?.album || "",
    year: meta.year,
    duration,
    durationFormatted: formatDuration(duration),
    cover: meta.cover,
    streamUrl: streams[0].streamUrl,
    directStreamUrl: streams[0].directUrl,
    streams,
    previewUrl: meta.previewUrl,
    isFullLength,
    match,
    spotifyUrl: `https://open.spotify.com/track/${trackId}`,
  };

  const ttl = isFullLength ? parseInt(env.CACHE_TTL || "86400", 10) : PREVIEW_CACHE_TTL;
  ctx.waitUntil(edgePut(url.host, cacheKey, payload, ttl));

  if (debug) {
    payload.debug = ranked.slice(0, 8).map((r) => ({
      title: r.cand.title,
      artists: r.cand.primaryArtists.join(", "),
      album: r.cand.album,
      duration: r.cand.durationSec,
      score: r.score,
      accepted: r.accepted,
      reasons: r.reasons,
    }));
  }

  return jsonResponse(payload, 200, origin, { "X-Cache": "MISS" });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin");

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(origin, { "Access-Control-Max-Age": "86400" }) });
    }
    if (request.method !== "GET" && request.method !== "HEAD") {
      return jsonResponse({ ok: false, error: "Method not allowed" }, 405, origin);
    }
    if (!isOriginAllowed(origin)) {
      return jsonResponse({ ok: false, error: "Origin not allowed" }, 403, origin);
    }

    try {
      switch (url.pathname) {
        case "/":
        case "/health":
          return jsonResponse(
            { ok: true, service: "Spotify Stream Engine", version: CACHE_VERSION, timestamp: new Date().toISOString() },
            200,
            origin
          );
        case "/api/resolve":
          return await handleResolve(request, url, env, ctx, origin);
        case "/api/proxy":
          return await handleMediaPassthrough(request, url, origin, false);
        case "/api/download":
          return await handleMediaPassthrough(request, url, origin, true);
        default:
          return jsonResponse({ ok: false, error: "Not Found" }, 404, origin);
      }
    } catch (err) {
      return jsonResponse({ ok: false, error: "Internal error", message: err?.message || String(err) }, 500, origin);
    }
  },
};
