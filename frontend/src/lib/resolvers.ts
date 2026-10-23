import type { StreamData } from "../components/VideoPlayer";
import type { FileItem } from "../components/VideoMetaCard";
import type { InstagramMediaItem, InstagramPostData } from "../components/InstagramPostViewer";
import type { SpotifyTrackData } from "../components/AudioPlayer";
import type { SpotifyPlaylistData, SpotifyPlaylistItem } from "../components/SpotifyPlaylistViewer";
import type { HistoryItem } from "../components/RecentStreams";
import { ApiError, fetchProviderJson } from "./api";

export type { SpotifyPlaylistData, SpotifyPlaylistItem };

export type ProviderKind = "direct" | "instagram" | "spotify" | "jiosaavn" | "terabox" | "diskwala";

export type ResolveResult =
  | { kind: "direct"; stream: StreamData }
  | { kind: "instagram"; post: InstagramPostData; history: HistoryItem }
  | { kind: "spotify"; track: SpotifyTrackData; history: HistoryItem }
  | { kind: "spotify_playlist"; playlist: SpotifyPlaylistData; history: HistoryItem }
  | { kind: "terabox"; files: FileItem[]; stream: StreamData; cached: boolean; history: HistoryItem | null };

const TERABOX_HOST_HINTS = [
  "terabox", "1024tera", "dubox", "nephobox", "mirrobox", "momerybox",
  "tibibox", "freeterabox", "terasharelink", "terafileshare",
];

export function detectProvider(rawUrl: string): ProviderKind | null {
  const url = rawUrl.trim().toLowerCase();
  const path = url.split(/[?#]/)[0];
  if (path.endsWith(".m3u8") || path.endsWith(".mp4")) return "direct";
  if (url.includes("instagram.com") || url.includes("instagr.am")) return "instagram";
  if (/(^|\/\/|\.)(jiosaavn\.com|saavn\.com|jiosaavn\.page\.link)\//.test(url)) return "jiosaavn";
  if (
    url.includes("spotify.com") ||
    url.includes("spotify.link") ||
    url.startsWith("spotify:track:") ||
    url.startsWith("spotify:playlist:") ||
    url.startsWith("spotify:album:")
  ) return "spotify";
  if (TERABOX_HOST_HINTS.some((h) => url.includes(h)) || url.includes("surl=") || url.includes("/s/1")) return "terabox";
  if (url.includes("diskwala")) return "diskwala";
  return null;
}

const enc = encodeURIComponent;

function resolveDirect(url: string): ResolveResult {
  const fileName = url.split("/").pop()?.split("?")[0] || "Direct Video Stream";
  return {
    kind: "direct",
    stream: { streamUrl: url, title: fileName, durationFormatted: "Direct Stream", sizeFormatted: "Live Stream" },
  };
}

interface InstagramApiMedia {
  type?: "video" | "photo";
  stream_url: string;
  download_url?: string;
  direct_url?: string;
  proxy_url?: string;
  thumbnail?: string;
  filename?: string;
}

interface InstagramApiResponse {
  status?: string;
  error?: string;
  shortcode?: string;
  author?: string;
  title?: string;
  media_type?: InstagramPostData["type"];
  medias?: InstagramApiMedia[];
}

async function resolveInstagram(url: string): Promise<ResolveResult> {
  const { status, data } = await fetchProviderJson<InstagramApiResponse>("instagram", `/api/resolve?url=${enc(url)}`);
  if (status >= 400 || data.status === "error" || data.error) {
    throw new ApiError(data.error || "Could not resolve this Instagram post. Make sure the account and post are public.", status);
  }

  const medias = data.medias || [];
  if (medias.length === 0) throw new ApiError("No playable video or photo was found in this Instagram post.");

  const primary = medias.find((m) => m.type === "video") || medias[0];
  const isCarousel = medias.length > 1;
  const title = data.title || (isCarousel ? `Instagram Carousel (${medias.length} Slides)` : `Instagram Video (${data.shortcode || "Reel"})`);

  const post: InstagramPostData = {
    shortcode: data.shortcode,
    author: data.author,
    title,
    type: data.media_type || (isCarousel ? "carousel" : primary.type),
    medias: medias.map(
      (m, idx): InstagramMediaItem => ({
        type: m.type || "video",
        stream_url: m.stream_url,
        download_url: m.download_url,
        direct_url: m.direct_url,
        proxy_url: m.proxy_url,
        thumbnail: m.thumbnail || "",
        filename: m.filename || `instagram-${data.shortcode || "media"}-${idx + 1}.${m.type === "photo" ? "jpg" : "mp4"}`,
      })
    ),
  };

  return {
    kind: "instagram",
    post,
    history: {
      surl: data.shortcode || url,
      originalUrl: url,
      title,
      durationFormatted: isCarousel ? `${medias.length} Slides` : "Instagram Video",
      sizeFormatted: primary.type === "photo" ? "HD Photo" : "HD MP4",
      thumbnail: primary.thumbnail || "",
      streamUrl: primary.stream_url,
      playedAt: Date.now(),
    },
  };
}

type SpotifyAnyApiResponse = {
  ok?: boolean;
  error?: string;
  provider?: "spotify";
  type?: "track" | "playlist" | "album";
  // track fields
  trackId?: string;
  title?: string;
  artist?: string;
  album?: string;
  year?: string;
  duration?: number;
  durationFormatted?: string;
  cover?: string;
  streamUrl?: string;
  directStreamUrl?: string;
  streams?: SpotifyTrackData["streams"];
  previewUrl?: string | null;
  isFullLength?: boolean;
  match?: SpotifyTrackData["match"];
  spotifyUrl?: string;
  // playlist / album fields
  id?: string;
  subtitle?: string;
  trackCount?: number;
  totalDuration?: number;
  totalDurationFormatted?: string;
  tracks?: SpotifyPlaylistItem[];
};

async function resolveSpotify(url: string): Promise<ResolveResult> {
  const { status, data } = await fetchProviderJson<SpotifyAnyApiResponse>("spotify", `/api/resolve?url=${enc(url)}`);
  if (status >= 400 || !data.ok) {
    throw new ApiError(data.error || "Could not resolve this Spotify link. Please check that the link is public and active.", status);
  }

  // Playlist or Album
  if (data.type === "playlist" || data.type === "album") {
    const playlist: SpotifyPlaylistData = {
      ok: true,
      provider: "spotify",
      type: data.type,
      id: data.id || "",
      title: data.title || (data.type === "album" ? "Spotify Album" : "Spotify Playlist"),
      subtitle: data.subtitle || "",
      cover: data.cover || "",
      trackCount: data.trackCount || data.tracks?.length || 0,
      totalDuration: data.totalDuration || 0,
      totalDurationFormatted: data.totalDurationFormatted || "",
      tracks: data.tracks || [],
      spotifyUrl: data.spotifyUrl || url,
    };

    const typeLabel = playlist.type === "album" ? "Album" : "Playlist";
    return {
      kind: "spotify_playlist",
      playlist,
      history: {
        surl: playlist.id || url,
        originalUrl: url,
        title: `${playlist.title}${playlist.subtitle ? ` · ${playlist.subtitle}` : ""}`,
        durationFormatted: `${playlist.trackCount} Songs`,
        sizeFormatted: `Spotify ${typeLabel}`,
        thumbnail: playlist.cover || "/providers/spotify.png",
        streamUrl: url,
        playedAt: Date.now(),
      },
    };
  }

  // Single track
  if (!data.streamUrl) {
    throw new ApiError(data.error || "Could not resolve an audio stream for this track.", status);
  }

  const track: SpotifyTrackData = {
    ok: true,
    provider: "spotify",
    type: "track",
    trackId: data.trackId || "",
    title: data.title || "Unknown Track",
    artist: data.artist || "",
    album: data.album || "",
    year: data.year,
    duration: data.duration || 0,
    durationFormatted: data.durationFormatted || "",
    cover: data.cover || "",
    streamUrl: data.streamUrl,
    directStreamUrl: data.directStreamUrl || data.streamUrl,
    streams: data.streams || [],
    previewUrl: data.previewUrl ?? null,
    isFullLength: Boolean(data.isFullLength),
    match: data.match ?? null,
    spotifyUrl: data.spotifyUrl || url,
  };

  return {
    kind: "spotify",
    track,
    history: {
      surl: track.trackId || url,
      originalUrl: url,
      title: track.artist ? `${track.artist} - ${track.title}` : track.title,
      durationFormatted: track.durationFormatted || "Spotify Track",
      sizeFormatted: track.isFullLength ? (track.streams[0]?.bitrate === "320k" ? "320 kbps AAC" : "160 kbps AAC") : "30s Preview",
      thumbnail: track.cover || "/providers/spotify.png",
      streamUrl: track.streamUrl,
      playedAt: Date.now(),
    },
  };
}

// ---------------------------------------------------------------------------
// JioSaavn: everything arrives playable, so tracks are pre-resolved for the players
// ---------------------------------------------------------------------------
interface SaavnTrack {
  id: string;
  title: string;
  artist: string;
  album: string;
  year: string;
  explicit: boolean;
  duration: number;
  durationFormatted: string;
  cover: string;
  url: string;
  streams: SpotifyTrackData["streams"];
}

type SaavnResponse = Partial<SaavnTrack> & {
  ok?: boolean;
  error?: string;
  type?: "song" | "album" | "playlist" | "artist";
  subtitle?: string;
  trackCount?: number;
  totalDuration?: number;
  totalDurationFormatted?: string;
  sourceUrl?: string;
  tracks?: SaavnTrack[];
};

function saavnToTrack(t: SaavnTrack): SpotifyTrackData {
  return {
    ok: true,
    provider: "jiosaavn",
    sourceName: "JioSaavn",
    type: "track",
    trackId: t.id,
    title: t.title,
    artist: t.artist,
    album: t.album,
    year: t.year,
    duration: t.duration,
    durationFormatted: t.durationFormatted,
    cover: t.cover,
    streamUrl: t.streams[0]?.streamUrl || "",
    directStreamUrl: t.streams[0]?.directUrl || "",
    streams: t.streams,
    previewUrl: null,
    isFullLength: true,
    match: null,
    spotifyUrl: t.url,
  };
}

async function resolveJioSaavn(url: string): Promise<ResolveResult> {
  const { status, data } = await fetchProviderJson<SaavnResponse>("jiosaavn", `/api/resolve?url=${enc(url)}`);
  if (status >= 400 || !data.ok) throw new ApiError(data.error || "Could not open this JioSaavn link.", status);

  if (data.type === "song") {
    const track = saavnToTrack(data as SaavnTrack);
    return {
      kind: "spotify",
      track,
      history: {
        surl: `saavn:${track.trackId}`,
        originalUrl: url,
        title: `${track.artist} - ${track.title}`,
        durationFormatted: track.durationFormatted,
        sizeFormatted: "JioSaavn song",
        thumbnail: track.cover,
        streamUrl: track.streamUrl,
        playedAt: Date.now(),
      },
    };
  }

  const tracks = data.tracks || [];
  const playlist: SpotifyPlaylistData = {
    ok: true,
    provider: "jiosaavn",
    sourceName: "JioSaavn",
    type: data.type === "album" ? "album" : data.type === "artist" ? "artist" : "playlist",
    id: data.id || "",
    title: data.title || "JioSaavn",
    subtitle: data.subtitle || "",
    cover: data.cover || "",
    trackCount: data.trackCount || tracks.length,
    totalDuration: data.totalDuration || 0,
    totalDurationFormatted: data.totalDurationFormatted || "",
    spotifyUrl: data.sourceUrl || url,
    tracks: tracks.map((t, i) => ({
      index: i + 1,
      id: t.id,
      title: t.title,
      artist: t.artist,
      duration: t.duration,
      durationFormatted: t.durationFormatted,
      isExplicit: t.explicit,
      previewUrl: null,
      spotifyUrl: t.url,
      resolved: saavnToTrack(t),
    })),
  };
  return {
    kind: "spotify_playlist",
    playlist,
    history: {
      surl: `saavn:${data.type}:${playlist.id || url}`,
      originalUrl: url,
      title: playlist.title,
      durationFormatted: `${playlist.trackCount} songs`,
      sizeFormatted: `JioSaavn ${playlist.type}`,
      thumbnail: playlist.cover,
      streamUrl: url,
      playedAt: Date.now(),
    },
  };
}

interface TeraboxApiFile {
  fs_id: string;
  filename?: string;
  size_formatted?: string;
  duration_formatted?: string;
  thumbnail?: string;
  stream_url: string;
  stream_url_360?: string;
}

interface TeraboxApiResponse {
  ok?: boolean;
  error?: string;
  surl?: string;
  cached?: boolean;
  files?: TeraboxApiFile[];
}

async function resolveTerabox(url: string): Promise<ResolveResult> {
  const { status, data } = await fetchProviderJson<TeraboxApiResponse>("terabox", `/api/resolve?url=${enc(url)}`);
  if (status >= 400 || data.error || !data.ok) {
    throw new ApiError(data.error || "Could not resolve a stream from this link. It may be private, expired or invalid.", status);
  }
  if (!data.files?.length) throw new ApiError("No playable video files were found in this share link.");

  const files: FileItem[] = data.files.map((f) => ({
    fs_id: f.fs_id,
    filename: f.filename || "Video.mp4",
    size_formatted: f.size_formatted || "Unknown",
    duration_formatted: f.duration_formatted || "",
    thumbnail: f.thumbnail || "",
    stream_url: f.stream_url,
    stream_url_360: f.stream_url_360,
  }));
  const first = files[0];

  return {
    kind: "terabox",
    files,
    cached: Boolean(data.cached),
    stream: {
      streamUrl: first.stream_url,
      streamUrl360: first.stream_url_360,
      title: first.filename,
      durationFormatted: first.duration_formatted,
      sizeFormatted: first.size_formatted,
      thumbnail: first.thumbnail,
      surl: data.surl,
    },
    history: data.surl
      ? {
          surl: data.surl,
          originalUrl: url,
          title: first.filename,
          durationFormatted: first.duration_formatted,
          sizeFormatted: first.size_formatted,
          thumbnail: first.thumbnail,
          streamUrl: first.stream_url,
          playedAt: Date.now(),
        }
      : null,
  };
}

/** Resolve any supported link into playable data. Throws ApiError with a user-facing message. */
export async function resolveLink(rawUrl: string): Promise<ResolveResult> {
  const url = rawUrl.trim();
  switch (detectProvider(url)) {
    case "direct":
      return resolveDirect(url);
    case "instagram":
      return resolveInstagram(url);
    case "spotify":
      return resolveSpotify(url);
    case "terabox":
      return resolveTerabox(url);
    case "jiosaavn":
      return resolveJioSaavn(url);
    case "diskwala":
      throw new ApiError(
        "DiskWala support is coming in the next update. TeraBox, Instagram and Spotify links work right now."
      );
    default:
      throw new ApiError(
        "This link is not supported yet. TeraBox, Instagram, Spotify, JioSaavn and direct .mp4/.m3u8 links work."
      );
  }
}
