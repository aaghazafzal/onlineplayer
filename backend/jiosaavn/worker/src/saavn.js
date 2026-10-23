/**
 * JioSaavn link parsing and response normalisation. Pure functions (no network),
 * so they can be unit-tested; the media URL decryption is injected.
 */

const HTML_ENTITIES = { amp: "&", quot: '"', apos: "'", lt: "<", gt: ">", nbsp: " " };

export function decodeEntities(str = "") {
  return String(str).replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, code) => {
    if (code[0] === "#") {
      const n = code[1].toLowerCase() === "x" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : m;
    }
    return HTML_ENTITIES[code.toLowerCase()] ?? m;
  });
}

const TYPE_BY_SEGMENT = { song: "song", album: "album", featured: "playlist", playlist: "playlist", artist: "artist" };

/**
 * jiosaavn.com/song/<slug>/<token>       -> { type: "song", token }
 * jiosaavn.com/album/<slug>/<token>      -> album
 * jiosaavn.com/featured/<slug>/<token>   -> playlist (editorial)
 * jiosaavn.com/s/playlist/<..>/<token>   -> playlist (user)
 * jiosaavn.com/artist/<slug>/<token>     -> artist (top songs)
 */
export function parseSaavnUrl(raw) {
  let u;
  try {
    u = new URL(raw.trim());
  } catch {
    return null;
  }
  const host = u.hostname.toLowerCase();
  if (!/(^|\.)(jiosaavn|saavn)\.com$/.test(host)) return null;
  const parts = u.pathname.split("/").filter(Boolean);
  if (parts[0] === "s") parts.shift(); // /s/playlist/... share form
  const type = TYPE_BY_SEGMENT[parts[0]];
  const token = parts[parts.length - 1];
  if (!type || parts.length < 2 || !/^[A-Za-z0-9_,.-]+$/.test(token || "")) return null;
  return { type, token };
}

export function isShortLink(raw) {
  try {
    const host = new URL(raw.trim()).hostname.toLowerCase();
    return /(^|\.)(jiosaavn\.page\.link|jsv\.io|saavn\.page\.link)$/.test(host) || host === "jiosaavn.page.link";
  } catch {
    return false;
  }
}

export function bigImage(url = "") {
  return url.replace(/-(50x50|150x150|250x250)\.(jpg|webp)/, "-500x500.$2").replace(/^http:/, "https:");
}

export function formatDuration(seconds) {
  const s = Math.max(0, Math.round(seconds || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}

function names(arr) {
  return (arr || []).map((a) => decodeEntities(a.name)).filter(Boolean);
}

/**
 * One JioSaavn song object -> our track. `decrypt(encrypted)` returns the CDN URL.
 * `link(url, filename)` builds the worker download URL used as a fallback.
 */
export function normaliseSong(s, decrypt, link) {
  const m = s.more_info || {};
  const map = m.artistMap || {};
  const primary = names(map.primary_artists);
  const featured = names(map.featured_artists);
  const artists = [...primary, ...featured];
  const title = decodeEntities(s.title || s.song || "");
  const durationSec = parseInt(m.duration || s.duration || "0", 10);
  const base = m.encrypted_media_url ? decrypt(m.encrypted_media_url) : null;
  const at = (kbps) => base && base.replace(/_(12|48|96|160|320)\.mp4/, `_${kbps}.mp4`);
  const label = `${artists.join(", ") || decodeEntities(s.subtitle || "")} - ${title}`.replace(/[\/\\?%*:|"<>\x00-\x1f]/g, "_").trim();

  const streams = [];
  if (base) {
    if (m["320kbps"] === "true" || m["320kbps"] === true) {
      streams.push({ quality: "320 kbps (High)", bitrate: "320k", codec: "AAC", streamUrl: at(320), directUrl: at(320), downloadUrl: link(at(320), `${label} (320kbps).m4a`), fileName: `${label} (320kbps).m4a` });
    }
    streams.push({ quality: "160 kbps (Standard)", bitrate: "160k", codec: "AAC", streamUrl: at(160), directUrl: at(160), downloadUrl: link(at(160), `${label} (160kbps).m4a`), fileName: `${label} (160kbps).m4a` });
    streams.push({ quality: "96 kbps (Data saver)", bitrate: "96k", codec: "AAC", streamUrl: at(96), directUrl: at(96), downloadUrl: link(at(96), `${label} (96kbps).m4a`), fileName: `${label} (96kbps).m4a` });
  }

  return {
    id: s.id,
    title,
    artist: artists.join(", ") || decodeEntities(s.subtitle || ""),
    album: decodeEntities(m.album || ""),
    year: s.year || "",
    language: s.language || "",
    explicit: s.explicit_content === "1" || s.explicit_content === 1,
    duration: durationSec,
    durationFormatted: formatDuration(durationSec),
    cover: bigImage(s.image),
    url: s.perma_url || "",
    hasLyrics: m.has_lyrics === "true",
    streams,
  };
}

/** Album / playlist / artist response -> collection */
export function normaliseCollection(type, data, decrypt, link) {
  const rawList = type === "artist" ? data.topSongs || [] : data.list || data.songs || [];
  const tracks = rawList.map((s) => normaliseSong(s, decrypt, link)).filter((t) => t.streams.length > 0);
  const total = tracks.reduce((n, t) => n + t.duration, 0);
  return {
    ok: true,
    provider: "jiosaavn",
    type,
    id: data.id || data.artistId || "",
    title: decodeEntities(data.title || data.name || ""),
    subtitle: decodeEntities(type === "artist" ? `${data.follower_count ? `${Number(data.follower_count).toLocaleString("en-IN")} followers` : "Artist"}` : data.subtitle || data.header_desc || ""),
    cover: bigImage(data.image || ""),
    year: data.year || "",
    trackCount: tracks.length,
    totalDuration: total,
    totalDurationFormatted: formatDuration(total),
    sourceUrl: data.perma_url || data.urls?.overview || "",
    tracks,
  };
}
