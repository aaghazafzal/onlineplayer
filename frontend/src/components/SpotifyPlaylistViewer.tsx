"use client";

import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Play, Pause, SkipBack, SkipForward, Shuffle, Repeat, Repeat1, Volume2, VolumeX, Download, ExternalLink, Search, Check, Share2 } from "lucide-react";
import { Segments } from "./Segments";
import { audioFileName, saveFromCdn } from "../lib/download";
import type { SpotifyTrackData } from "./AudioPlayer";
import { fetchProviderJson } from "../lib/api";

export interface SpotifyPlaylistItem {
  index: number;
  id: string;
  title: string;
  artist: string;
  duration: number;
  durationFormatted: string;
  isExplicit: boolean;
  previewUrl: string | null;
  spotifyUrl: string;
  /** Already playable (JioSaavn): no lookup needed */
  resolved?: SpotifyTrackData;
}

export interface SpotifyPlaylistData {
  ok: boolean;
  provider: "spotify" | "jiosaavn";
  /** Shown as "Open on …"; defaults to Spotify */
  sourceName?: string;
  type: "playlist" | "album" | "artist";
  id: string;
  title: string;
  subtitle: string;
  cover: string;
  trackCount: number;
  totalDuration: number;
  totalDurationFormatted: string;
  tracks: SpotifyPlaylistItem[];
  spotifyUrl: string;
}

interface SpotifyPlaylistViewerProps {
  playlistData: SpotifyPlaylistData;
  autoStartDownload?: boolean;
}

type RepeatMode = "off" | "all" | "one";

export const SpotifyPlaylistViewer: React.FC<SpotifyPlaylistViewerProps> = ({
  playlistData,
  autoStartDownload = false,
}) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Tracks list
  const tracks = useMemo(() => playlistData.tracks || [], [playlistData.tracks]);

  // Playback state
  const [currentTrackIndex, setCurrentTrackIndex] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.9);
  const [isMuted, setIsMuted] = useState(false);
  const [isShuffle, setIsShuffle] = useState(false);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>("off");
  const [isResolvingCurrent, setIsResolvingCurrent] = useState(false);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);

  // Search filter
  const [searchQuery, setSearchQuery] = useState("");

  // In-memory cache for resolved track stream data: trackId -> SpotifyTrackData
  const [resolvedCache, setResolvedCache] = useState<Record<string, SpotifyTrackData>>({});

  // Track downloading states: trackId -> boolean | "done"
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [downloadDoneId, setDownloadDoneId] = useState<string | null>(null);

  // Copied states
  const [copiedLink, setCopiedLink] = useState(false);

  // Active track object
  const currentTrack = currentTrackIndex !== null ? tracks[currentTrackIndex] : null;
  const currentResolved = currentTrack?.id ? currentTrack.resolved ?? resolvedCache[currentTrack.id] : null;

  // Filtered tracks for the tracklist
  const filteredTracks = useMemo(() => {
    if (!searchQuery.trim()) return tracks;
    const q = searchQuery.toLowerCase();
    return tracks.filter(
      (t) => t.title.toLowerCase().includes(q) || t.artist.toLowerCase().includes(q)
    );
  }, [tracks, searchQuery]);

  // Helper: Resolve a track's audio stream on demand
  const resolveTrackAudio = useCallback(
    async (track: SpotifyPlaylistItem): Promise<SpotifyTrackData | null> => {
      if (!track.id) return null;
      if (track.resolved) return track.resolved;
      if (resolvedCache[track.id]) {
        return resolvedCache[track.id];
      }

      try {
        const { status, data } = await fetchProviderJson<SpotifyTrackData>(
          "spotify",
          `/api/resolve?url=${encodeURIComponent(track.spotifyUrl || `https://open.spotify.com/track/${track.id}`)}`
        );

        if (status >= 400 || !data.ok || !data.streamUrl) {
          throw new Error(data?.title ? `No stream available for ${data.title}` : "Failed to load audio");
        }

        setResolvedCache((prev) => ({ ...prev, [track.id]: data }));
        return data;
      } catch (err) {
        console.warn(`Failed to resolve track ${track.title}:`, err);
        return null;
      }
    },
    [resolvedCache]
  );

  // Pre-fetch next track in background
  const prefetchTrack = useCallback(
    (index: number) => {
      if (index >= 0 && index < tracks.length) {
        const next = tracks[index];
        if (next && next.id && !resolvedCache[next.id]) {
          resolveTrackAudio(next).catch(() => {});
        }
      }
    },
    [tracks, resolvedCache, resolveTrackAudio]
  );

  // Lets playTrackIndex skip forward to itself without referencing itself while declared
  const playIndexRef = useRef<(index: number) => void>(() => {});

  // Play a specific track index
  const playTrackIndex = useCallback(
    async (index: number) => {
      if (index < 0 || index >= tracks.length) return;
      const track = tracks[index];
      if (!track) return;

      setCurrentTrackIndex(index);
      setErrorNotice(null);
      setCurrentTime(0);

      // Check if already resolved
      let trackAudio: SpotifyTrackData | null = track.resolved ?? resolvedCache[track.id] ?? null;
      if (!trackAudio) {
        setIsResolvingCurrent(true);
        trackAudio = await resolveTrackAudio(track);
        setIsResolvingCurrent(false);
      }

      if (!trackAudio || !trackAudio.streamUrl) {
        // Fallback to preview if available
        if (track.previewUrl) {
          if (audioRef.current) {
            audioRef.current.src = track.previewUrl;
            audioRef.current.play().catch(() => {});
            setIsPlaying(true);
          }
          return;
        }
        setErrorNotice(`"${track.title}" could not be played, so the next track is starting.`);
        setTimeout(() => {
          if (index + 1 < tracks.length) playIndexRef.current(index + 1);
        }, 1500);
        return;
      }

      if (audioRef.current) {
        audioRef.current.src = trackAudio.streamUrl;
        audioRef.current.currentTime = 0;
        audioRef.current
          .play()
          .then(() => setIsPlaying(true))
          .catch((err) => {
            console.warn("Audio play interrupted:", err);
            setIsPlaying(false);
          });
      }

      // Pre-fetch the next track for 0-latency transition
      prefetchTrack(index + 1);
    },
    [tracks, resolvedCache, resolveTrackAudio, prefetchTrack]
  );

  useEffect(() => {
    playIndexRef.current = playTrackIndex;
  }, [playTrackIndex]);

  // Play / Pause toggle
  const togglePlay = () => {
    if (!audioRef.current) return;
    if (currentTrackIndex === null) {
      if (tracks.length > 0) playTrackIndex(0);
      return;
    }

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current
        .play()
        .then(() => setIsPlaying(true))
        .catch(() => setIsPlaying(false));
    }
  };

  // Next Track
  const handleNextTrack = useCallback(() => {
    if (tracks.length === 0) return;
    if (currentTrackIndex === null) {
      playTrackIndex(0);
      return;
    }

    if (isShuffle) {
      const candidates = tracks.map((_, i) => i).filter((i) => i !== currentTrackIndex);
      if (candidates.length > 0) {
        const rand = candidates[Math.floor(Math.random() * candidates.length)];
        playTrackIndex(rand);
        return;
      }
    }

    if (currentTrackIndex + 1 < tracks.length) {
      playTrackIndex(currentTrackIndex + 1);
    } else if (repeatMode === "all") {
      playTrackIndex(0);
    }
  }, [tracks, currentTrackIndex, isShuffle, repeatMode, playTrackIndex]);

  // Previous Track
  const handlePrevTrack = useCallback(() => {
    if (tracks.length === 0) return;
    if (audioRef.current && audioRef.current.currentTime > 3) {
      audioRef.current.currentTime = 0;
      return;
    }

    if (currentTrackIndex === null || currentTrackIndex <= 0) {
      if (repeatMode === "all") playTrackIndex(tracks.length - 1);
      else playTrackIndex(0);
      return;
    }

    playTrackIndex(currentTrackIndex - 1);
  }, [tracks, currentTrackIndex, repeatMode, playTrackIndex]);

  // Audio event listeners
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const onDurationChange = () => setDuration(audio.duration || 0);
    const onEnded = () => {
      if (repeatMode === "one") {
        audio.currentTime = 0;
        audio.play().catch(() => {});
      } else {
        handleNextTrack();
      }
    };
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);

    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("durationchange", onDurationChange);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);

    return () => {
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("durationchange", onDurationChange);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
    };
  }, [repeatMode, handleNextTrack]);

  // Volume sync
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

  // Play All handler
  const handlePlayAll = () => {
    if (tracks.length > 0) {
      playTrackIndex(0);
    }
  };

  // Shuffle All handler
  const handleShuffleAll = () => {
    if (tracks.length === 0) return;
    setIsShuffle(true);
    const rand = Math.floor(Math.random() * tracks.length);
    playTrackIndex(rand);
  };

  // Repeat Mode cycle
  const cycleRepeatMode = () => {
    setRepeatMode((prev) => {
      if (prev === "off") return "all";
      if (prev === "all") return "one";
      return "off";
    });
  };

  // Download a specific track
  const handleDownloadTrack = async (track: SpotifyPlaylistItem, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!track.id || downloadingId) return;

    setDownloadingId(track.id);
    try {
      let resolved = track.resolved ?? resolvedCache[track.id];
      if (!resolved) {
        resolved = (await resolveTrackAudio(track)) as SpotifyTrackData;
      }

      if (!resolved || !resolved.streams?.length) {
        setErrorNotice(`No downloadable version of "${track.title}" was found.`);
        return;
      }

      // Best quality first, saved straight from the CDN; the Worker link is the fallback
      const stream = resolved.streams[0];
      const fileName = stream.fileName || audioFileName(track.artist, track.title, stream.bitrate, stream.codec);
      await saveFromCdn(stream.directUrl || stream.streamUrl, fileName, stream.downloadUrl);

      setDownloadDoneId(track.id);
      setTimeout(() => setDownloadDoneId(null), 3000);
    } catch (err) {
      console.error("Track download error:", err);
      setErrorNotice(`The download of "${track.title}" could not start. Try again.`);
    } finally {
      setDownloadingId(null);
    }
  };

  // Format seconds -> mm:ss or hh:mm:ss
  const formatTime = (sec: number) => {
    if (!sec || isNaN(sec) || sec < 0) return "0:00";
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = Math.floor(sec % 60);
    const ss = s < 10 ? `0${s}` : `${s}`;
    if (h > 0) {
      const mm = m < 10 ? `0${m}` : `${m}`;
      return `${h}:${mm}:${ss}`;
    }
    return `${m}:${ss}`;
  };

  // Seek handler
  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setCurrentTime(val);
    if (audioRef.current) {
      audioRef.current.currentTime = val;
    }
  };

  // Copy Playlist link
  const handleCopyLink = () => {
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(playlistData.spotifyUrl || window.location.href);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  const isAlbum = playlistData.type === "album";
  const kindLabel = playlistData.type === "album" ? "Album" : playlistData.type === "artist" ? "Top songs" : "Playlist";
  const sourceName = playlistData.sourceName || "Spotify";
  const progress = duration > 0 ? currentTime / duration : 0;

  const transport = (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => setIsShuffle(!isShuffle)}
        aria-pressed={isShuffle}
        className={`btn min-h-[44px] w-11 px-0 ${isShuffle ? "btn-ink" : "btn-quiet"}`}
        title="Shuffle"
      >
        <Shuffle className="h-4 w-4" strokeWidth={2.4} />
      </button>
      <button type="button" onClick={handlePrevTrack} className="btn btn-quiet min-h-[48px] w-12 px-0" aria-label="Previous track">
        <SkipBack className="h-5 w-5 fill-current" strokeWidth={2.2} />
      </button>
      <button type="button" onClick={togglePlay} className="btn btn-accent min-h-[56px] w-14 px-0" aria-label={isPlaying ? "Pause" : "Play"}>
        {isResolvingCurrent ? (
          <span className="h-5 w-5 rounded-full border-2 border-current border-r-transparent animate-[spin_0.8s_linear_infinite]" />
        ) : isPlaying ? (
          <Pause className="h-6 w-6 fill-current" strokeWidth={2.2} />
        ) : (
          <Play className="h-6 w-6 fill-current ml-0.5" strokeWidth={2.2} />
        )}
      </button>
      <button type="button" onClick={handleNextTrack} className="btn btn-quiet min-h-[48px] w-12 px-0" aria-label="Next track">
        <SkipForward className="h-5 w-5 fill-current" strokeWidth={2.2} />
      </button>
      <button
        type="button"
        onClick={cycleRepeatMode}
        aria-label={`Repeat: ${repeatMode}`}
        className={`btn min-h-[44px] w-11 px-0 ${repeatMode !== "off" ? "btn-ink" : "btn-quiet"}`}
        title={repeatMode === "one" ? "Repeat this track" : repeatMode === "all" ? "Repeat all" : "Repeat off"}
      >
        {repeatMode === "one" ? <Repeat1 className="h-4 w-4" strokeWidth={2.4} /> : <Repeat className="h-4 w-4" strokeWidth={2.4} />}
      </button>
    </div>
  );

  return (
    <article className="w-full grid grid-cols-1 lg:grid-cols-12 gap-3" aria-label={`${kindLabel}: ${playlistData.title}`}>
      <audio
        ref={audioRef}
        preload="auto"
        onError={() => {
          // CDN refused this browser: retry the current track once through the Worker proxy
          const proxy = currentResolved?.streams?.[0]?.proxyUrl;
          if (proxy && audioRef.current && audioRef.current.src !== proxy) {
            audioRef.current.src = proxy;
            audioRef.current.play().catch(() => {});
          }
        }}
      />

      {/* Left: the record and what is playing */}
      <div className="lg:col-span-5 lg:sticky lg:top-[84px] self-start rounded-ui bg-paper overflow-clip">
        <div className="bg-stage p-4 sm:p-6">
          <div className="flex lg:block gap-4 items-end">
            <img
              src={currentResolved?.cover || playlistData.cover || "/providers/spotify.png"}
              alt={`Cover of ${playlistData.title}`}
              className="w-28 sm:w-40 lg:w-full aspect-square object-cover rounded-ui shrink-0"
            />
            <div className="lg:mt-5 min-w-0 text-stage-ink">
              <p className="text-small text-stage-muted">{kindLabel}</p>
              <h2 className="mt-1 text-lead lg:text-head font-semibold tracking-[-0.03em] leading-[1.05] [overflow-wrap:anywhere]">
                {playlistData.title}
              </h2>
              <p className="mt-2 text-small text-stage-muted">
                {[playlistData.subtitle, `${playlistData.trackCount} tracks`, playlistData.totalDurationFormatted].filter(Boolean).join(" · ")}
              </p>
            </div>
          </div>
        </div>

        <div className="p-5 sm:p-6 flex flex-col gap-5">
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={handlePlayAll} className="btn btn-accent min-h-[52px]">
              <Play className="h-5 w-5 fill-current" strokeWidth={2.2} /> Play all
            </button>
            <button type="button" onClick={handleShuffleAll} className="btn btn-ink min-h-[52px]">
              <Shuffle className="h-5 w-5" strokeWidth={2.4} /> Shuffle
            </button>
          </div>

          {currentTrack ? (
            <div className="flex flex-col gap-4">
              <div className="min-w-0">
                <p className="text-small text-muted">Now playing</p>
                <p className="mt-1 text-body font-medium truncate">{currentTrack.title}</p>
                <p className="text-small text-muted truncate">{currentTrack.artist}</p>
              </div>
              <div>
                <div className="relative h-5">
                  <Segments count={36} played={progress} className="absolute inset-0 gap-[3px]" />
                  <input
                    type="range"
                    min={0}
                    max={duration || 100}
                    step={0.1}
                    value={currentTime}
                    onChange={handleSeek}
                    aria-label="Seek"
                    className="absolute inset-0 w-full opacity-0 cursor-pointer"
                  />
                </div>
                <div className="mt-2 flex justify-between text-small text-muted tabular">
                  <span>{formatTime(currentTime)}</span>
                  <span>{formatTime(duration)}</span>
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3">
                {transport}
                <div className="hidden sm:flex items-center gap-2">
                  <button type="button" onClick={() => setIsMuted(!isMuted)} className="btn btn-quiet min-h-[44px] w-11 px-0" aria-label={isMuted ? "Unmute" : "Mute"}>
                    {isMuted || volume === 0 ? <VolumeX className="h-5 w-5" strokeWidth={2.4} /> : <Volume2 className="h-5 w-5" strokeWidth={2.4} />}
                  </button>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={isMuted ? 0 : volume}
                    onChange={(e) => {
                      setVolume(parseFloat(e.target.value));
                      setIsMuted(false);
                    }}
                    aria-label="Volume"
                    className="w-24 cursor-pointer accent-[var(--accent)]"
                  />
                </div>
              </div>
            </div>
          ) : (
            <p className="text-small text-muted">{playlistData.provider === "spotify" ? "Press a track or Play all. Each song is matched to its full-length recording when it starts." : "Press a track or Play all. Every song plays in full."}</p>
          )}

          {errorNotice && (
            <p role="alert" className="rounded-ui bg-danger-soft p-3 text-small text-ink">
              {errorNotice}
            </p>
          )}

          <div className="flex flex-wrap gap-x-6 gap-y-2 text-small">
            <button type="button" onClick={handleCopyLink} className="link inline-flex items-center gap-1.5 cursor-pointer">
              {copiedLink ? <Check className="h-4 w-4" strokeWidth={2.4} /> : <Share2 className="h-4 w-4" strokeWidth={2.4} />}
              {copiedLink ? "Link copied" : `Share ${isAlbum ? "album" : "playlist"}`}
            </button>
            <a href={playlistData.spotifyUrl} target="_blank" rel="noopener noreferrer" className="link inline-flex items-center gap-1.5">
              Open on {sourceName} <ExternalLink className="h-4 w-4" strokeWidth={2.4} />
            </a>
          </div>
        </div>
      </div>

      {/* Right: the track list */}
      <div className="lg:col-span-7 rounded-ui bg-paper p-3 sm:p-5">
        <label className="flex items-center gap-2 rounded-ui bg-surface-2 px-3 min-h-[48px] focus-within:outline-3 focus-within:outline-accent">
          <Search className="h-4 w-4 text-muted shrink-0" strokeWidth={2.4} />
          <span className="sr-only">Search this {isAlbum ? "album" : "playlist"}</span>
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={`Search ${tracks.length} tracks`}
            className="min-w-0 flex-1 bg-transparent text-body placeholder:text-muted focus:outline-none"
          />
        </label>

        <ol className="mt-3 flex flex-col gap-1" aria-label="Tracks">
          {filteredTracks.map((track) => {
            const idx = tracks.indexOf(track);
            const active = idx === currentTrackIndex;
            const busyHere = downloadingId === track.id;
            const doneHere = downloadDoneId === track.id;
            return (
              <li key={track.id || idx}>
                <div
                  className={`group flex items-center gap-3 rounded-ui px-2 sm:px-3 min-h-[60px] transition-colors ${
                    active ? "bg-accent text-accent-ink" : "hover:bg-surface-2"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => (active ? togglePlay() : playTrackIndex(idx))}
                    className="flex flex-1 min-w-0 items-center gap-3 text-left py-2 cursor-pointer"
                    aria-label={`${active && isPlaying ? "Pause" : "Play"} ${track.title} by ${track.artist}`}
                  >
                    <span className={`w-7 shrink-0 text-center text-small tabular ${active ? "" : "text-muted"}`}>
                      {active && isResolvingCurrent ? (
                        <span className="inline-block h-4 w-4 rounded-full border-2 border-current border-r-transparent animate-[spin_0.8s_linear_infinite]" />
                      ) : active && isPlaying ? (
                        <Pause className="inline h-4 w-4 fill-current" strokeWidth={2.2} />
                      ) : (
                        track.index
                      )}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-body font-medium truncate">{track.title}</span>
                      <span className={`block text-small truncate ${active ? "opacity-85" : "text-muted"}`}>
                        {track.isExplicit ? "Explicit · " : ""}
                        {track.artist}
                      </span>
                    </span>
                  </button>
                  <span className={`text-small tabular shrink-0 ${active ? "" : "text-muted"}`}>{track.durationFormatted}</span>
                  <button
                    type="button"
                    onClick={(e) => handleDownloadTrack(track, e)}
                    disabled={Boolean(downloadingId)}
                    className={`btn min-h-[40px] w-10 px-0 shrink-0 ${active ? "bg-accent-ink/15" : "btn-quiet"}`}
                    aria-label={`Download ${track.title}`}
                    title="Download"
                  >
                    {busyHere ? (
                      <span className="h-4 w-4 rounded-full border-2 border-current border-r-transparent animate-[spin_0.8s_linear_infinite]" />
                    ) : doneHere ? (
                      <Check className="h-4 w-4" strokeWidth={2.6} />
                    ) : (
                      <Download className="h-4 w-4" strokeWidth={2.4} />
                    )}
                  </button>
                </div>
              </li>
            );
          })}
          {filteredTracks.length === 0 && <li className="px-3 py-8 text-body text-muted">No track matches &ldquo;{searchQuery}&rdquo;.</li>}
        </ol>
      </div>

      {/* Phones: a mini player docked to the bottom while something plays */}
      {currentTrack && (
        <div className="lg:hidden fixed inset-x-0 bottom-0 z-40 bg-stage text-stage-ink on-stage px-3 pt-2 pb-[max(12px,env(safe-area-inset-bottom))]">
          <Segments count={30} played={progress} className="h-1.5 gap-[2px]" />
          <div className="mt-2 flex items-center gap-3">
            <img src={currentResolved?.cover || playlistData.cover} alt="" className="h-11 w-11 rounded-[4px] object-cover shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-small font-medium truncate">{currentTrack.title}</p>
              <p className="text-small text-stage-muted truncate">{currentTrack.artist}</p>
            </div>
            <button type="button" onClick={handlePrevTrack} className="h-11 w-11 inline-flex items-center justify-center" aria-label="Previous track">
              <SkipBack className="h-5 w-5 fill-current" strokeWidth={2.2} />
            </button>
            <button type="button" onClick={togglePlay} className="btn btn-accent min-h-[44px] w-11 px-0" aria-label={isPlaying ? "Pause" : "Play"}>
              {isPlaying ? <Pause className="h-5 w-5 fill-current" strokeWidth={2.2} /> : <Play className="h-5 w-5 fill-current ml-0.5" strokeWidth={2.2} />}
            </button>
            <button type="button" onClick={handleNextTrack} className="h-11 w-11 inline-flex items-center justify-center" aria-label="Next track">
              <SkipForward className="h-5 w-5 fill-current" strokeWidth={2.2} />
            </button>
          </div>
        </div>
      )}
    </article>
  );
};
