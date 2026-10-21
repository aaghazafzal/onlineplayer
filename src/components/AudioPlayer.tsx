"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { 
  Play, 
  Pause, 
  RotateCcw, 
  RotateCw, 
  Volume2, 
  VolumeX, 
  Download, 
  Copy, 
  Check, 
  ExternalLink, 
  Sparkles, 
  ShieldCheck, 
  Radio, 
  Music, 
  Disc, 
  Repeat, 
  Sliders, 
  Loader2,
  Share2
} from "lucide-react";

export interface SpotifyStreamOption {
  quality: string;
  bitrate: string;
  codec: string;
  streamUrl: string;
  directUrl: string;
  downloadUrl: string;
}

/** The full-length recording the worker matched to the Spotify track. */
export interface SpotifyMatchInfo {
  source: string;
  id: string;
  title: string;
  artist: string;
  album: string;
  duration: number;
  score: number;
  confidence: "exact" | "high" | "medium";
}

export interface SpotifyTrackData {
  ok: boolean;
  provider: "spotify";
  type: "track";
  trackId: string;
  title: string;
  artist: string;
  album: string;
  year?: string;
  match?: SpotifyMatchInfo | null;
  duration: number;
  durationFormatted: string;
  cover: string;
  streamUrl: string;
  directStreamUrl: string;
  streams: SpotifyStreamOption[];
  previewUrl: string | null;
  isFullLength: boolean;
  spotifyUrl: string;
}

interface AudioPlayerProps {
  trackData: SpotifyTrackData;
  autoStartDownload?: boolean;
}

export const AudioPlayer: React.FC<AudioPlayerProps> = ({
  trackData,
  autoStartDownload = false,
}) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Default to 320 kbps stream if available, otherwise first stream
  const initialStream = trackData.streams?.[0] || {
    quality: "320 kbps (Ultra HD)",
    bitrate: "320k",
    codec: "AAC / MP4",
    streamUrl: trackData.streamUrl,
    directUrl: trackData.directStreamUrl,
    downloadUrl: trackData.streamUrl,
  };

  const [activeStream, setActiveStream] = useState<SpotifyStreamOption>(initialStream);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(trackData.duration || 0);
  const [volume, setVolume] = useState(0.9);
  const [isMuted, setIsMuted] = useState(false);
  const [isLooping, setIsLooping] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1.0);
  const [isBuffering, setIsBuffering] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedStream, setCopiedStream] = useState(false);
  const [downloadingQuality, setDownloadingQuality] = useState<string | null>(null);

  // Auto-start download if user clicked Download in URL bar
  useEffect(() => {
    if (autoStartDownload && activeStream?.downloadUrl) {
      handleTriggerDownload(activeStream);
    }
  }, [autoStartDownload]);

  // Sync active stream when trackData changes
  useEffect(() => {
    const stream = trackData.streams?.[0] || {
      quality: "320 kbps (Ultra HD)",
      bitrate: "320k",
      codec: "AAC / MP4",
      streamUrl: trackData.streamUrl,
      directUrl: trackData.directStreamUrl,
      downloadUrl: trackData.streamUrl,
    };
    setActiveStream(stream);
    setCurrentTime(0);
    setIsPlaying(false);
    setDuration(trackData.duration || 0);
  }, [trackData]);

  // Audio element listeners
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const handleLoadedMetadata = () => {
      if (audio.duration && !isNaN(audio.duration)) {
        setDuration(audio.duration);
      }
    };

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleWaiting = () => setIsBuffering(true);
    const handlePlaying = () => setIsBuffering(false);
    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    audio.addEventListener("play", handlePlay);
    audio.addEventListener("pause", handlePause);
    audio.addEventListener("waiting", handleWaiting);
    audio.addEventListener("playing", handlePlaying);
    audio.addEventListener("ended", handleEnded);

    return () => {
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.removeEventListener("play", handlePlay);
      audio.removeEventListener("pause", handlePause);
      audio.removeEventListener("waiting", handleWaiting);
      audio.removeEventListener("playing", handlePlaying);
      audio.removeEventListener("ended", handleEnded);
    };
  }, [activeStream]);

  // Play / Pause toggle
  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
    } else {
      audio.play().catch((err) => {
        console.warn("Playback error:", err);
      });
    }
  };

  // Skip time forward or back
  const handleSkip = (seconds: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    const target = Math.max(0, Math.min(duration, audio.currentTime + seconds));
    audio.currentTime = target;
    setCurrentTime(target);
  };

  // Seek bar
  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current;
    if (!audio) return;
    const newTime = parseFloat(e.target.value);
    audio.currentTime = newTime;
    setCurrentTime(newTime);
  };

  // Volume slider
  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current;
    const val = parseFloat(e.target.value);
    setVolume(val);
    if (audio) {
      audio.volume = val;
      audio.muted = val === 0;
      setIsMuted(val === 0);
    }
  };

  // Toggle Mute
  const toggleMute = () => {
    const audio = audioRef.current;
    if (!audio) return;
    const nextMuted = !isMuted;
    audio.muted = nextMuted;
    setIsMuted(nextMuted);
  };

  // Switch Stream Bitrate (Preserves playback position)
  const handleSwitchQuality = (stream: SpotifyStreamOption) => {
    if (stream.bitrate === activeStream.bitrate) return;
    const audio = audioRef.current;
    const wasPlaying = isPlaying;
    const savedTime = audio ? audio.currentTime : currentTime;

    setActiveStream(stream);

    setTimeout(() => {
      if (audio) {
        audio.currentTime = savedTime;
        if (wasPlaying) {
          audio.play().catch(() => {});
        }
      }
    }, 100);
  };

  // Toggle Playback Rate
  const cyclePlaybackRate = () => {
    const audio = audioRef.current;
    if (!audio) return;
    const rates = [1.0, 1.25, 1.5, 2.0];
    const nextIdx = (rates.indexOf(playbackRate) + 1) % rates.length;
    const nextRate = rates[nextIdx];
    audio.playbackRate = nextRate;
    setPlaybackRate(nextRate);
  };

  // Download Trigger
  const handleTriggerDownload = (stream: SpotifyStreamOption) => {
    setDownloadingQuality(stream.bitrate);
    const downloadUrl = stream.downloadUrl || stream.streamUrl;
    
    // Create hidden anchor with download attribute
    const a = document.createElement("a");
    a.href = downloadUrl;
    a.download = `${trackData.artist} - ${trackData.title} (${stream.bitrate}).${stream.codec === "MP3" ? "mp3" : "m4a"}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    setTimeout(() => {
      setDownloadingQuality(null);
    }, 2000);
  };

  // Copy Stream Link
  const handleCopyStream = async () => {
    try {
      await navigator.clipboard.writeText(activeStream.directUrl || activeStream.streamUrl);
      setCopiedStream(true);
      setTimeout(() => setCopiedStream(false), 2500);
    } catch (e) {
      // ignore
    }
  };

  // Copy Spotify Track URL
  const handleCopySpotifyLink = async () => {
    try {
      await navigator.clipboard.writeText(trackData.spotifyUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    } catch (e) {
      // ignore
    }
  };

  const formatSeconds = (sec: number) => {
    if (!sec || isNaN(sec)) return "0:00";
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="w-full max-w-5xl lg:max-w-6xl mx-auto space-y-6">
      
      {/* Hidden Native Audio Element */}
      <audio
        ref={audioRef}
        src={activeStream.streamUrl}
        preload="metadata"
        loop={isLooping}
      />

      {/* Main Music Player Card */}
      <div className="relative overflow-hidden rounded-[32px] bg-white dark:bg-[#18181f] border border-zinc-200 dark:border-[#272733] shadow-2xl transition-all duration-200">
        
        {/* Glow Accent behind player */}
        <div className="absolute top-0 right-0 -mr-24 -mt-24 w-96 h-96 rounded-full bg-emerald-500/10 dark:bg-emerald-500/15 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 -ml-24 -mb-24 w-96 h-96 rounded-full bg-blue-500/10 dark:bg-blue-500/15 blur-3xl pointer-events-none" />

        <div className="relative p-6 sm:p-10 md:p-12 space-y-8">
          
          {/* Top Header Pill Row */}
          <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-zinc-200 dark:border-[#262633]">
            <div className="flex items-center gap-2.5">
              <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-[#1DB954]/15 text-[#1DB954] border border-[#1DB954]/30">
                <img src="/providers/spotify.png" alt="Spotify" className="h-4 w-4 object-contain" />
                <span>Spotify Cloud Audio</span>
              </span>

              {trackData.isFullLength ? (
                <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  <span>Full-Length {trackData.streams?.[0]?.bitrate === "320k" ? "320" : "160"} kbps AAC</span>
                </span>
              ) : (
                <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                  <Radio className="h-3.5 w-3.5" />
                  <span>Official 30s Preview</span>
                </span>
              )}
            </div>

            {/* Spotify Direct Link */}
            <a
              href={trackData.spotifyUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-zinc-100 dark:bg-[#121217] text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white border border-zinc-200 dark:border-[#272737] transition-colors"
            >
              <span>Open on Spotify</span>
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>

          {/* Main Track Showcase: Vinyl Record + Track Info + Dynamic Visualizer */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
            
            {/* LEFT: Rotating Vinyl Record & High-Res Album Cover */}
            <div className="md:col-span-5 flex justify-center items-center">
              <div className="relative group cursor-pointer" onClick={togglePlay}>
                
                {/* Vinyl Record that slides & spins behind album sleeve */}
                <div
                  className={`absolute top-0 right-0 h-44 w-44 sm:h-56 sm:w-56 rounded-full bg-gradient-to-tr from-zinc-950 via-zinc-900 to-zinc-950 border-4 border-zinc-800 shadow-2xl flex items-center justify-center transition-transform duration-700 ease-out ${
                    isPlaying 
                      ? "translate-x-12 sm:translate-x-16 rotate-12" 
                      : "translate-x-4 group-hover:translate-x-8"
                  }`}
                  style={{
                    boxShadow: "0 10px 40px rgba(0,0,0,0.6)",
                  }}
                >
                  {/* Vinyl Grooves concentric rings */}
                  <div className="absolute inset-2 rounded-full border border-zinc-700/40 pointer-events-none" />
                  <div className="absolute inset-5 rounded-full border border-zinc-700/30 pointer-events-none" />
                  <div className="absolute inset-8 rounded-full border border-zinc-700/25 pointer-events-none" />
                  <div className="absolute inset-11 rounded-full border border-zinc-700/20 pointer-events-none" />

                  {/* Vinyl Center Label (Cover thumbnail) */}
                  <div 
                    className={`h-16 w-16 sm:h-20 sm:w-20 rounded-full overflow-hidden border-2 border-zinc-700 shadow-inner flex items-center justify-center ${
                      isPlaying ? "animate-spin" : ""
                    }`}
                    style={{ animationDuration: "3s" }}
                  >
                    <img 
                      src={trackData.cover || "/providers/spotify.png"} 
                      alt="Cover" 
                      className="h-full w-full object-cover"
                    />
                    <div className="absolute h-3.5 w-3.5 rounded-full bg-zinc-950 border border-zinc-500" />
                  </div>
                </div>

                {/* Album Cover Art Sleeve (Foreground) */}
                <div className="relative z-10 h-44 w-44 sm:h-56 sm:w-56 rounded-2xl overflow-hidden shadow-2xl border-2 border-zinc-200 dark:border-[#333342] bg-zinc-100 dark:bg-zinc-900 group-hover:scale-102 transition-transform">
                  <img
                    src={trackData.cover || "/providers/spotify.png"}
                    alt={trackData.title}
                    className="h-full w-full object-cover"
                  />

                  {/* Center Play/Pause Overlay Icon */}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                    <div className="h-14 w-14 rounded-full bg-[#1DB954] text-white flex items-center justify-center shadow-lg transform group-hover:scale-110 transition-transform">
                      {isPlaying ? (
                        <Pause className="h-7 w-7 fill-white stroke-white" />
                      ) : (
                        <Play className="h-7 w-7 fill-white stroke-white ml-0.5" />
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* RIGHT: Metadata, Animated Wave Visualizer, and Quick Badges */}
            <div className="md:col-span-7 space-y-4">
              
              {/* Song Title */}
              <div className="space-y-1.5">
                <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-zinc-950 dark:text-white tracking-tight leading-snug">
                  {trackData.title}
                </h2>
                
                {/* Artist Name & Album */}
                <div className="flex flex-wrap items-center gap-2 text-sm sm:text-base font-bold text-zinc-600 dark:text-zinc-300">
                  <span className="text-blue-600 dark:text-blue-400">{trackData.artist}</span>
                  {trackData.album && (
                    <>
                      <span className="text-zinc-400">•</span>
                      <span className="text-zinc-500 dark:text-zinc-400 font-medium flex items-center gap-1.5">
                        <Disc className="h-4 w-4" />
                        <span>{trackData.album}</span>
                      </span>
                    </>
                  )}
                </div>

                {/* Which full-length recording is actually playing */}
                {trackData.match ? (
                  <p
                    className="flex flex-wrap items-center gap-1.5 pt-1 text-xs font-medium text-zinc-500 dark:text-zinc-400"
                    title={`Match score ${trackData.match.score}`}
                  >
                    <ShieldCheck className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                    <span>
                      {trackData.match.confidence === "exact" ? "Verified match" : "Matched"}:{" "}
                      <span className="font-bold text-zinc-700 dark:text-zinc-200">{trackData.match.title}</span>
                      {trackData.match.album && <> · {trackData.match.album}</>}
                      {trackData.match.duration > 0 && <> · {formatSeconds(trackData.match.duration)}</>}
                    </span>
                  </p>
                ) : !trackData.isFullLength ? (
                  <p className="flex items-center gap-1.5 pt-1 text-xs font-medium text-amber-600 dark:text-amber-400">
                    <Radio className="h-3.5 w-3.5 shrink-0" />
                    <span>No exact full-length version was found, so the official 30s preview is playing.</span>
                  </p>
                ) : null}
              </div>

              {/* Animated Frequency Visualizer Bars */}
              <div className="py-3 px-4 rounded-2xl bg-zinc-50 dark:bg-[#121217] border border-zinc-200 dark:border-[#242430]">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="relative flex h-2 w-2">
                      <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${isPlaying ? "bg-[#1DB954]" : "bg-zinc-400"} opacity-75`} />
                      <span className={`relative inline-flex rounded-full h-2 w-2 ${isPlaying ? "bg-[#1DB954]" : "bg-zinc-400"}`} />
                    </span>
                    <span className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                      {isPlaying ? "Live Audio Waveform" : "Player Paused"}
                    </span>
                  </div>

                  <span className="text-xs font-black text-[#1DB954]">
                    {activeStream.bitrate === "preview" ? "30s Preview" : `${activeStream.bitrate.toUpperCase()} ${activeStream.codec}`}
                  </span>
                </div>

                {/* Bars Spectrum */}
                <div className="flex items-end justify-between gap-1 h-12 pt-2">
                  {[
                    40, 65, 80, 50, 90, 70, 45, 85, 100, 60, 35, 75, 95, 80,
                    55, 70, 90, 100, 85, 60, 75, 50, 95, 65, 40, 80, 55, 70
                  ].map((height, i) => {
                    const dynamicScale = isPlaying 
                      ? Math.max(0.15, (Math.sin((i * 0.4) + (currentTime * 5)) + 1) / 2) 
                      : 0.12;

                    return (
                      <div
                        key={i}
                        className="flex-1 rounded-full transition-all duration-150 ease-out"
                        style={{
                          height: `${Math.max(4, height * dynamicScale)}px`,
                          backgroundColor: isPlaying
                            ? i % 3 === 0 ? "#1DB954" : i % 3 === 1 ? "#3b82f6" : "#10b981"
                            : "#52525b",
                          opacity: isPlaying ? 0.9 : 0.4,
                        }}
                      />
                    );
                  })}
                </div>
              </div>

              {/* Bitrate Selector Pills */}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider mr-1">Quality:</span>
                {trackData.streams?.map((s) => (
                  <button
                    key={s.bitrate}
                    type="button"
                    onClick={() => handleSwitchQuality(s)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                      activeStream.bitrate === s.bitrate
                        ? "bg-[#1DB954] text-white shadow-md shadow-[#1DB954]/25"
                        : "bg-zinc-100 dark:bg-[#121217] text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white border border-zinc-200 dark:border-[#272737]"
                    }`}
                  >
                    <span>{s.quality}</span>
                  </button>
                ))}
              </div>

            </div>
          </div>

          {/* Interactive Scrubbar */}
          <div className="space-y-2 pt-2">
            <div className="relative flex items-center group">
              <input
                type="range"
                min={0}
                max={duration || 100}
                value={currentTime}
                onChange={handleSeek}
                className="w-full h-2.5 rounded-lg appearance-none cursor-pointer bg-zinc-200 dark:bg-zinc-800 accent-[#1DB954]"
                style={{
                  background: `linear-gradient(to right, #1DB954 ${progressPercent}%, rgba(120,120,120,0.2) ${progressPercent}%)`,
                }}
              />
            </div>

            <div className="flex items-center justify-between text-xs font-bold text-zinc-500 dark:text-zinc-400 px-1">
              <span>{formatSeconds(currentTime)}</span>
              <span>{formatSeconds(duration)}</span>
            </div>
          </div>

          {/* Player Transport Controls Bar */}
          <div className="p-4 sm:p-5 rounded-2xl bg-zinc-50 dark:bg-[#121217] border border-zinc-200 dark:border-[#242430] flex flex-wrap items-center justify-between gap-4">
            
            {/* Left Controls: Repeat & Playback Speed */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsLooping(!isLooping)}
                className={`p-2.5 rounded-xl transition-colors cursor-pointer ${
                  isLooping 
                    ? "bg-[#1DB954]/20 text-[#1DB954]" 
                    : "text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-200 dark:hover:bg-zinc-800"
                }`}
                title={isLooping ? "Loop On" : "Loop Off"}
              >
                <Repeat className="h-4 w-4" strokeWidth={2.4} />
              </button>

              <button
                type="button"
                onClick={cyclePlaybackRate}
                className="px-2.5 py-1.5 rounded-xl text-xs font-black text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                title="Change playback speed"
              >
                {playbackRate}x
              </button>
            </div>

            {/* Center Controls: Skip -10s, Play/Pause, Skip +10s */}
            <div className="flex items-center gap-3 sm:gap-4">
              <button
                type="button"
                onClick={() => handleSkip(-10)}
                className="p-3 rounded-xl text-zinc-600 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-all active:scale-95 cursor-pointer"
                title="Rewind 10 seconds"
              >
                <RotateCcw className="h-5 w-5" strokeWidth={2.4} />
              </button>

              <button
                type="button"
                onClick={togglePlay}
                className="h-14 w-14 sm:h-16 sm:w-16 rounded-full bg-[#1DB954] hover:bg-[#1aa34a] text-white flex items-center justify-center shadow-xl shadow-[#1DB954]/30 active:scale-95 transition-all cursor-pointer"
                title={isPlaying ? "Pause" : "Play"}
              >
                {isBuffering ? (
                  <Loader2 className="h-7 w-7 animate-spin" />
                ) : isPlaying ? (
                  <Pause className="h-7 w-7 fill-white stroke-white" />
                ) : (
                  <Play className="h-7 w-7 fill-white stroke-white ml-1" />
                )}
              </button>

              <button
                type="button"
                onClick={() => handleSkip(10)}
                className="p-3 rounded-xl text-zinc-600 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-all active:scale-95 cursor-pointer"
                title="Fast forward 10 seconds"
              >
                <RotateCw className="h-5 w-5" strokeWidth={2.4} />
              </button>
            </div>

            {/* Right Controls: Volume Slider & Mute Toggle */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={toggleMute}
                className="p-2.5 rounded-xl text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                title={isMuted ? "Unmute" : "Mute"}
              >
                {isMuted || volume === 0 ? (
                  <VolumeX className="h-5 w-5" strokeWidth={2.4} />
                ) : (
                  <Volume2 className="h-5 w-5" strokeWidth={2.4} />
                )}
              </button>

              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={isMuted ? 0 : volume}
                onChange={handleVolumeChange}
                className="w-20 sm:w-24 h-1.5 rounded-lg appearance-none cursor-pointer bg-zinc-300 dark:bg-zinc-700 accent-[#1DB954]"
              />
            </div>
          </div>

          {/* Action Row: Direct Downloads & Quick Share */}
          <div className="pt-2 border-t border-zinc-200 dark:border-[#262633] space-y-4">
            
            {/* Download Action Buttons Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              
              {/* Button 1: best available quality (320k, 160k or preview) */}
              {trackData.streams?.[0] && (
                <button
                  type="button"
                  onClick={() => handleTriggerDownload(trackData.streams[0])}
                  disabled={downloadingQuality === trackData.streams[0].bitrate}
                  className="w-full py-4 px-6 rounded-2xl font-black text-sm sm:text-base text-white bg-[#059669] hover:bg-[#047857] shadow-lg shadow-emerald-600/25 flex items-center justify-center gap-2.5 active:scale-[0.98] transition-all cursor-pointer"
                >
                  {downloadingQuality === trackData.streams[0].bitrate ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      <span>Starting {trackData.streams[0].quality} download...</span>
                    </>
                  ) : (
                    <>
                      <Download className="h-5 w-5" strokeWidth={2.4} />
                      <span>Download {trackData.streams[0].quality}</span>
                    </>
                  )}
                </button>
              )}

              {/* Button 2: second quality if available, otherwise copy stream link */}
              {trackData.streams?.[1] ? (
                <button
                  type="button"
                  onClick={() => handleTriggerDownload(trackData.streams[1])}
                  disabled={downloadingQuality === trackData.streams[1].bitrate}
                  className="w-full py-4 px-6 rounded-2xl font-black text-sm sm:text-base text-white bg-[#2563eb] hover:bg-[#1d4ed8] shadow-lg shadow-blue-600/25 flex items-center justify-center gap-2.5 active:scale-[0.98] transition-all cursor-pointer"
                >
                  {downloadingQuality === trackData.streams[1].bitrate ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      <span>Starting {trackData.streams[1].quality} download...</span>
                    </>
                  ) : (
                    <>
                      <Download className="h-5 w-5" strokeWidth={2.4} />
                      <span>Download {trackData.streams[1].quality}</span>
                    </>
                  )}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleCopyStream}
                  className="w-full py-4 px-6 rounded-2xl font-black text-sm sm:text-base text-zinc-800 dark:text-zinc-100 bg-zinc-100 dark:bg-[#121217] hover:bg-zinc-200 dark:hover:bg-[#1c1c24] border border-zinc-200 dark:border-[#272737] flex items-center justify-center gap-2.5 active:scale-[0.98] transition-all cursor-pointer"
                >
                  {copiedStream ? (
                    <>
                      <Check className="h-5 w-5 text-emerald-500" strokeWidth={2.5} />
                      <span className="text-emerald-500">Audio Stream URL Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-5 w-5" strokeWidth={2.4} />
                      <span>Copy Direct Audio Stream</span>
                    </>
                  )}
                </button>
              )}
            </div>

            {/* Quick Share Links */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 text-xs text-zinc-500 dark:text-zinc-400">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleCopyStream}
                  className="inline-flex items-center gap-1.5 hover:text-zinc-950 dark:hover:text-white transition-colors cursor-pointer"
                >
                  {copiedStream ? (
                    <Check className="h-3.5 w-3.5 text-emerald-500" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                  <span>{copiedStream ? "Stream Copied!" : "Copy Stream Link"}</span>
                </button>

                <span>•</span>

                <button
                  type="button"
                  onClick={handleCopySpotifyLink}
                  className="inline-flex items-center gap-1.5 hover:text-zinc-950 dark:hover:text-white transition-colors cursor-pointer"
                >
                  {copiedLink ? (
                    <Check className="h-3.5 w-3.5 text-emerald-500" />
                  ) : (
                    <Share2 className="h-3.5 w-3.5" />
                  )}
                  <span>{copiedLink ? "Link Copied!" : "Share Track Link"}</span>
                </button>
              </div>

              <div className="flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
                <span>Zero Ads • No Login • Unlimited Bitrate</span>
              </div>
            </div>

          </div>

        </div>
      </div>
    </div>
  );
};
