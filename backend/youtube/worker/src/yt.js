/**
 * YouTube link parsing and response shaping. Pure functions, unit-tested.
 */

const ID_RE = /^[A-Za-z0-9_-]{11}$/;
const LIST_RE = /^[A-Za-z0-9_-]{10,64}$/;

/**
 * Accepts watch, youtu.be, shorts, live, embed, music.youtube.com and playlist links.
 * Returns { videoId?, listId? } or null.
 */
export function parseYouTubeUrl(raw) {
  let u;
  try {
    u = new URL(raw.trim());
  } catch {
    return null;
  }
  const host = u.hostname.toLowerCase().replace(/^(www|m|music)\./, "");
  let videoId = null;
  if (host === "youtu.be") {
    videoId = u.pathname.split("/").filter(Boolean)[0] || null;
  } else if (host === "youtube.com" || host === "youtube-nocookie.com") {
    const parts = u.pathname.split("/").filter(Boolean);
    if (parts[0] === "watch") videoId = u.searchParams.get("v");
    else if (["shorts", "live", "embed", "v", "e"].includes(parts[0])) videoId = parts[1] || null;
  } else {
    return null;
  }
  const listId = u.searchParams.get("list");
  const out = {};
  if (videoId && ID_RE.test(videoId)) out.videoId = videoId;
  // Mixes ("RD...") are generated per viewer and cannot be listed; play the video instead
  if (listId && LIST_RE.test(listId) && !listId.startsWith("RD")) out.listId = listId;
  return out.videoId || out.listId ? out : null;
}

export function thumbnails(videoId) {
  return {
    high: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    max: `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`,
  };
}

function text(node) {
  if (!node) return "";
  if (typeof node.simpleText === "string") return node.simpleText;
  return (node.runs || []).map((r) => r.text).join("");
}

export function parseLength(str = "") {
  const parts = str.split(":").map((n) => parseInt(n, 10));
  if (parts.some((n) => !Number.isFinite(n))) return 0;
  return parts.reduce((acc, n) => acc * 60 + n, 0);
}

/** Playlist from an Innertube /next response (watch page playlist panel). */
export function playlistFromNext(json) {
  const p = json?.contents?.twoColumnWatchNextResults?.playlist?.playlist;
  if (!p) return null;
  const videos = (p.contents || [])
    .map((c) => c.playlistPanelVideoRenderer)
    .filter((r) => r && r.videoId && !r.unplayableText)
    .map((r) => {
      const length = text(r.lengthText);
      return {
        id: r.videoId,
        title: text(r.title),
        channel: text(r.shortBylineText) || text(r.longBylineText),
        duration: parseLength(length),
        durationFormatted: length,
        thumbnail: thumbnails(r.videoId).high,
      };
    });
  return {
    id: p.playlistId,
    title: p.title || "YouTube playlist",
    channel: text(p.ownerName) || text(p.longBylineText) || "",
    totalVideos: p.totalVideos || videos.length,
    videos,
  };
}

/**
 * Downloadable formats from an Innertube /player response. Only formats with a
 * direct URL count (no signature cipher). Muxed MP4 (video+audio) and M4A audio.
 */
export function pickFormats(player) {
  const sd = player?.streamingData || {};
  const all = [...(sd.formats || []), ...(sd.adaptiveFormats || [])].filter((f) => f.url);
  const muxed = all
    .filter((f) => f.mimeType?.startsWith("video/mp4") && f.audioQuality)
    .sort((a, b) => (b.height || 0) - (a.height || 0))[0];
  const audio = all
    .filter((f) => f.mimeType?.startsWith("audio/mp4"))
    .sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0))[0];
  return { video: muxed || null, audio: audio || null };
}

export function safeFilename(name) {
  return (name || "video").replace(/[\/\\?%*:|"<>\x00-\x1f]/g, "_").replace(/\s+/g, " ").trim().slice(0, 150) || "video";
}
