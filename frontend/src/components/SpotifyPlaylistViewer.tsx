"use client";

import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Shuffle,
  Repeat,
  Repeat1,
  Volume2,
  VolumeX,
  Download,
  ExternalLink,
  Search,
  Music,
  Disc,
  ListMusic,
  Sparkles,
  Loader2,
  Check,
  Share2,
  Copy,
} from "lucide-react";
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
}

export interface SpotifyPlaylistData {
  ok: boolean;
  provider: "spotify";
  type: "playlist" | "album";
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
  const currentResolved = currentTrack?.id ? resolvedCache[currentTrack.id] : null;

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
      let trackAudio: SpotifyTrackData | null = resolvedCache[track.id] ?? null;
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
        setErrorNotice(`Could not stream "${track.title}". Skipping to next track...`);
        setTimeout(() => {
          if (index + 1 < tracks.length) playTrackIndex(index + 1);
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
      let resolved = resolvedCache[track.id];
      if (!resolved) {
        resolved = (await resolveTrackAudio(track)) as SpotifyTrackData;
      }

      if (!resolved || !resolved.streams?.length) {
        alert(`Could not find a downloadable stream for "${track.title}".`);
        return;
      }

      // Prefer 320 kbps stream download URL, fallback to first stream downloadUrl
      const stream = resolved.streams[0];
      const dlUrl = stream.downloadUrl || stream.streamUrl;

      const a = document.createElement("a");
      a.href = dlUrl;
      a.download = `${track.artist} - ${track.title} (320kbps).m4a`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      setDownloadDoneId(track.id);
      setTimeout(() => setDownloadDoneId(null), 3000);
    } catch (err) {
      console.error("Track download error:", err);
      alert("Failed to initiate download for this track.");
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

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6">
      {/* Hidden audio element */}
      <audio ref={audioRef} preload="auto" />

      {/* Main Playlist Container */}
      <div className="relative rounded-3xl overflow-hidden bg-gradient-to-b from-zinc-900/90 via-[#121216] to-[#0d0d11] border border-zinc-800/80 shadow-2xl backdrop-blur-xl">
        {/* Ambient Cover Art Blur in Background */}
        {playlistData.cover && (
          <div
            className="absolute inset-0 opacity-20 dark:opacity-25 pointer-events-none filter blur-3xl scale-125 transition-all duration-700"
            style={{
              backgroundImage: `url(${playlistData.cover})`,
              backgroundPosition: "center 20%",
              backgroundSize: "cover",
            }}
          />
        )}

        <div className="relative z-10 p-6 sm:p-8 md:p-10 space-y-8">
          {/* Top Header Card */}
          <div className="flex flex-col sm:flex-row items-center sm:items-end gap-6 md:gap-8">
            {/* Artwork Cover */}
            <div className="relative shrink-0 group">
              <div className="w-48 h-48 sm:w-56 sm:h-56 md:w-64 md:h-64 rounded-2xl overflow-hidden shadow-2xl border border-white/10 bg-zinc-800 flex items-center justify-center">
                {playlistData.cover ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={playlistData.cover}
                    alt={playlistData.title}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-zinc-500">
                    {isAlbum ? <Disc className="w-16 h-16" /> : <ListMusic className="w-16 h-16" />}
                  </div>
                )}
              </div>

              {/* Spotify Icon Badge */}
              <div className="absolute -bottom-2 -right-2 w-9 h-9 rounded-full bg-[#1DB954] text-black flex items-center justify-center shadow-lg border-2 border-zinc-900">
                <Music className="w-5 h-5 fill-current" />
              </div>
            </div>

            {/* Title & Metadata */}
            <div className="flex-1 text-center sm:text-left space-y-3 min-w-0">
              {/* Type Pill */}
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/10 text-xs font-bold tracking-wider uppercase text-[#1DB954]">
                {isAlbum ? <Disc className="w-3.5 h-3.5" /> : <ListMusic className="w-3.5 h-3.5" />}
                <span>Spotify {isAlbum ? "Album" : "Playlist"}</span>
              </div>

              {/* Title */}
              <h1 className="text-2xl sm:text-4xl md:text-5xl font-black text-white tracking-tight leading-tight line-clamp-2">
                {playlistData.title}
              </h1>

              {/* Creator / Artist */}
              {playlistData.subtitle && (
                <p className="text-sm sm:text-base md:text-lg font-medium text-zinc-300">
                  {isAlbum ? "By" : "Curated by"}{" "}
                  <span className="text-white font-bold">{playlistData.subtitle}</span>
                </p>
              )}

              {/* Stats badges */}
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 pt-1 text-xs text-zinc-400">
                <span className="inline-flex items-center gap-1 font-semibold text-zinc-300">
                  <Music className="w-3.5 h-3.5 text-[#1DB954]" />
                  {playlistData.trackCount} {playlistData.trackCount === 1 ? "track" : "tracks"}
                </span>
                <span>•</span>
                <span>{playlistData.totalDurationFormatted || "Full Collection"}</span>
                <span>•</span>
                <span className="text-emerald-400 font-semibold flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  320 kbps Ultra HD
                </span>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 pt-3">
                <button
                  onClick={handlePlayAll}
                  className="px-6 py-3 rounded-full bg-[#1DB954] hover:bg-[#1ed760] text-black font-extrabold text-sm flex items-center gap-2.5 shadow-lg shadow-[#1DB954]/25 transition active:scale-95 cursor-pointer"
                >
                  <Play className="w-4 h-4 fill-current" />
                  <span>Play All</span>
                </button>

                <button
                  onClick={handleShuffleAll}
                  className="px-5 py-3 rounded-full bg-white/10 hover:bg-white/15 text-white font-semibold text-sm flex items-center gap-2 border border-white/10 transition active:scale-95 cursor-pointer"
                >
                  <Shuffle className="w-4 h-4" />
                  <span>Shuffle</span>
                </button>

                <a
                  href={playlistData.spotifyUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-3 rounded-full bg-zinc-800/80 hover:bg-zinc-800 text-zinc-300 hover:text-white font-medium text-xs flex items-center gap-1.5 border border-zinc-700/60 transition cursor-pointer"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Spotify</span>
                </a>

                <button
                  onClick={handleCopyLink}
                  className="p-3 rounded-full bg-zinc-800/80 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-700/60 transition cursor-pointer"
                  title="Copy link"
                >
                  {copiedLink ? <Check className="w-4 h-4 text-emerald-400" /> : <Share2 className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>

          {/* Error notice if a stream failed */}
          {errorNotice && (
            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin shrink-0" />
              <span>{errorNotice}</span>
            </div>
          )}

          {/* Tracklist Section */}
          <div className="space-y-4 pt-2">
            {/* Filter Search Bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pb-2 border-b border-zinc-800">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <span>Tracklist</span>
                <span className="text-xs font-normal text-zinc-400">({tracks.length})</span>
              </h2>

              <div className="relative w-full sm:w-72">
                <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Filter tracks by title or artist..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 rounded-full bg-zinc-800/80 text-white placeholder-zinc-500 text-xs border border-zinc-700/60 focus:outline-none focus:border-[#1DB954] transition"
                />
              </div>
            </div>

            {/* Tracks List Table */}
            <div className="space-y-1">
              {filteredTracks.length === 0 ? (
                <div className="py-12 text-center text-zinc-500 text-sm">
                  No tracks match &ldquo;{searchQuery}&rdquo;
                </div>
              ) : (
                filteredTracks.map((track) => {
                  const originalIndex = tracks.findIndex((t) => t.id === track.id);
                  const isCurrent = currentTrackIndex === originalIndex;
                  const isTrackLoading = isCurrent && isResolvingCurrent;
                  const isTrackDownloading = downloadingId === track.id;
                  const isTrackDone = downloadDoneId === track.id;

                  return (
                    <div
                      key={track.id || track.index}
                      onClick={() => playTrackIndex(originalIndex)}
                      className={`group flex items-center gap-3 sm:gap-4 p-3 rounded-xl transition duration-200 cursor-pointer ${
                        isCurrent
                          ? "bg-[#1DB954]/15 border border-[#1DB954]/40 text-white"
                          : "hover:bg-zinc-800/50 text-zinc-300 hover:text-white"
                      }`}
                    >
                      {/* Index / Playing Equalizer / Play button */}
                      <div className="w-8 flex items-center justify-center shrink-0">
                        {isTrackLoading ? (
                          <Loader2 className="w-4 h-4 animate-spin text-[#1DB954]" />
                        ) : isCurrent && isPlaying ? (
                          /* Animated 3-bar green equalizer */
                          <div className="flex items-end justify-center gap-0.5 h-4 w-4">
                            <span className="w-1 bg-[#1DB954] rounded-full animate-[pulse_0.6s_ease-in-out_infinite] h-3" />
                            <span className="w-1 bg-[#1DB954] rounded-full animate-[pulse_0.4s_ease-in-out_infinite] h-4" />
                            <span className="w-1 bg-[#1DB954] rounded-full animate-[pulse_0.8s_ease-in-out_infinite] h-2" />
                          </div>
                        ) : (
                          <>
                            <span className="text-xs text-zinc-500 group-hover:hidden font-mono">
                              {track.index}
                            </span>
                            <Play className="w-4 h-4 text-white hidden group-hover:block fill-current" />
                          </>
                        )}
                      </div>

                      {/* Title & Artist */}
                      <div className="flex-1 min-w-0 pr-2">
                        <div className="flex items-center gap-2">
                          <p
                            className={`text-sm font-semibold truncate ${
                              isCurrent ? "text-[#1DB954]" : "text-white"
                            }`}
                          >
                            {track.title}
                          </p>
                          {track.isExplicit && (
                            <span className="shrink-0 px-1.5 py-0.5 rounded text-[10px] font-bold bg-zinc-700 text-zinc-300">
                              E
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-zinc-400 truncate">{track.artist}</p>
                      </div>

                      {/* Duration */}
                      <div className="text-xs text-zinc-400 font-mono shrink-0 hidden sm:block">
                        {track.durationFormatted}
                      </div>

                      {/* 1-Click Track Download button */}
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={(e) => handleDownloadTrack(track, e)}
                          disabled={isTrackDownloading}
                          className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-700/50 transition cursor-pointer"
                          title="Download 320 kbps AAC"
                        >
                          {isTrackDownloading ? (
                            <Loader2 className="w-4 h-4 animate-spin text-[#1DB954]" />
                          ) : isTrackDone ? (
                            <Check className="w-4 h-4 text-emerald-400" />
                          ) : (
                            <Download className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Integrated Docked Player Bar (Visible when any track is selected/playing) */}
        {currentTrack && (
          <div className="sticky bottom-0 z-20 bg-zinc-950/95 border-t border-zinc-800 p-4 sm:p-5 backdrop-blur-xl space-y-3">
            {/* Top row: Track Info & Controls & Tools */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              {/* Left: Current Track Thumbnail & Info */}
              <div className="flex items-center gap-3 min-w-0 w-full sm:w-1/3">
                <div className="w-12 h-12 rounded-lg overflow-hidden shrink-0 bg-zinc-800 border border-white/10">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={playlistData.cover || "/providers/spotify.png"}
                    alt={currentTrack.title}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-white truncate">{currentTrack.title}</p>
                  <p className="text-xs text-zinc-400 truncate">{currentTrack.artist}</p>
                </div>
              </div>

              {/* Center: Playback Controls */}
              <div className="flex items-center justify-center gap-4 w-full sm:w-1/3">
                {/* Shuffle toggle */}
                <button
                  onClick={() => setIsShuffle(!isShuffle)}
                  className={`p-2 rounded-full transition cursor-pointer ${
                    isShuffle ? "text-[#1DB954]" : "text-zinc-400 hover:text-white"
                  }`}
                  title="Shuffle"
                >
                  <Shuffle className="w-4 h-4" />
                </button>

                {/* Previous */}
                <button
                  onClick={handlePrevTrack}
                  className="p-2 text-zinc-300 hover:text-white transition cursor-pointer"
                  title="Previous Track"
                >
                  <SkipBack className="w-5 h-5 fill-current" />
                </button>

                {/* Play / Pause button */}
                <button
                  onClick={togglePlay}
                  disabled={isResolvingCurrent}
                  className="w-11 h-11 rounded-full bg-[#1DB954] hover:bg-[#1ed760] text-black flex items-center justify-center shadow-lg transition active:scale-95 cursor-pointer disabled:opacity-50"
                  title={isPlaying ? "Pause" : "Play"}
                >
                  {isResolvingCurrent ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : isPlaying ? (
                    <Pause className="w-5 h-5 fill-current" />
                  ) : (
                    <Play className="w-5 h-5 fill-current ml-0.5" />
                  )}
                </button>

                {/* Next */}
                <button
                  onClick={handleNextTrack}
                  className="p-2 text-zinc-300 hover:text-white transition cursor-pointer"
                  title="Next Track"
                >
                  <SkipForward className="w-5 h-5 fill-current" />
                </button>

                {/* Repeat Mode cycle */}
                <button
                  onClick={cycleRepeatMode}
                  className={`p-2 rounded-full transition cursor-pointer ${
                    repeatMode !== "off" ? "text-[#1DB954]" : "text-zinc-400 hover:text-white"
                  }`}
                  title={`Repeat: ${repeatMode}`}
                >
                  {repeatMode === "one" ? <Repeat1 className="w-4 h-4" /> : <Repeat className="w-4 h-4" />}
                </button>
              </div>

              {/* Right: Volume & 1-Click Download for Current Track */}
              <div className="flex items-center justify-end gap-3 w-full sm:w-1/3">
                {/* Volume slider */}
                <div className="hidden md:flex items-center gap-2">
                  <button
                    onClick={() => setIsMuted(!isMuted)}
                    className="text-zinc-400 hover:text-white transition cursor-pointer"
                  >
                    {isMuted || volume === 0 ? (
                      <VolumeX className="w-4 h-4" />
                    ) : (
                      <Volume2 className="w-4 h-4" />
                    )}
                  </button>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={isMuted ? 0 : volume}
                    onChange={(e) => {
                      setVolume(parseFloat(e.target.value));
                      setIsMuted(false);
                    }}
                    className="w-20 h-1 accent-[#1DB954] bg-zinc-700 rounded-lg cursor-pointer"
                  />
                </div>

                {/* Download current song button */}
                <button
                  onClick={(e) => handleDownloadTrack(currentTrack, e)}
                  disabled={downloadingId === currentTrack.id}
                  className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-semibold flex items-center gap-1.5 border border-white/10 transition active:scale-95 cursor-pointer"
                  title="Download Current Song (320 kbps)"
                >
                  {downloadingId === currentTrack.id ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-[#1DB954]" />
                  ) : downloadDoneId === currentTrack.id ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Download className="w-3.5 h-3.5" />
                  )}
                  <span className="hidden sm:inline">320k</span>
                </button>
              </div>
            </div>

            {/* Bottom Timeline Seekbar */}
            <div className="flex items-center gap-3">
              <span className="text-[11px] font-mono text-zinc-400 w-10 text-right">
                {formatTime(currentTime)}
              </span>
              <input
                type="range"
                min="0"
                max={duration || currentTrack.duration || 100}
                value={currentTime}
                onChange={handleSeek}
                className="flex-1 h-1.5 accent-[#1DB954] bg-zinc-800 rounded-lg cursor-pointer"
              />
              <span className="text-[11px] font-mono text-zinc-400 w-10">
                {formatTime(duration || currentTrack.duration)}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
