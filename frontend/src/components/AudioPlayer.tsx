"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { Play, Pause, RotateCcw, RotateCw, Volume2, VolumeX, Download, Copy, Check, ExternalLink, Repeat, Share2 } from "lucide-react";
import { Segments } from "./Segments";

export interface SpotifyStreamOption {
  quality: string;
  bitrate: string;
  codec: string;
  streamUrl: string;
  directUrl: string;
  downloadUrl: string;
  /** Same audio through the Worker, used if the CDN refuses this browser */
  proxyUrl?: string;
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
  const [useProxy, setUseProxy] = useState(false);

  // The page remounts this component per track (key={trackId}), so state starts fresh.

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

  // Auto-start the download when the visitor pressed Download in the link box
  useEffect(() => {
    // Starting a download is the side effect this runs for; it marks the button busy
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (autoStartDownload && activeStream?.downloadUrl) handleTriggerDownload(activeStream);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per mount
  }, [autoStartDownload]);

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

  const isPreview = !trackData.isFullLength;
  const meta = [trackData.album, trackData.year].filter(Boolean).join(" · ");

  return (
    <article className="w-full rounded-ui bg-paper overflow-clip" aria-label={`${trackData.title} by ${trackData.artist}`}>
      <audio
        ref={audioRef}
        src={useProxy ? activeStream.proxyUrl || activeStream.streamUrl : activeStream.streamUrl}
        preload="metadata"
        loop={isLooping}
        onError={() => {
          // CDN refused this browser: fall back once to the Worker proxy
          if (!useProxy && activeStream.proxyUrl) setUseProxy(true);
        }}
      />

      <div className="grid grid-cols-1 lg:grid-cols-12">
        {/* Cover */}
        <div className="lg:col-span-5 bg-stage p-4 sm:p-6 lg:p-8">
          <button
            type="button"
            onClick={togglePlay}
            className="group relative block w-full max-w-[260px] sm:max-w-[360px] lg:max-w-none mx-auto aspect-square overflow-clip rounded-ui"
            aria-label={isPlaying ? "Pause" : "Play"}
          >
            <img
              src={trackData.cover || "/providers/spotify.png"}
              alt={`Cover of ${trackData.album || trackData.title}`}
              className="h-full w-full object-cover transition-transform duration-700 ease-[var(--ease-out)] group-hover:scale-[1.03]"
            />
          </button>
        </div>

        {/* Track and controls */}
        <div className="lg:col-span-7 p-5 sm:p-8 lg:p-10 flex flex-col gap-7">
          <div>
            <h2 className="text-head leading-[1.02] [overflow-wrap:anywhere]">{trackData.title}</h2>
            <p className="mt-3 text-lead text-ink">{trackData.artist}</p>
            {meta && <p className="mt-1 text-body text-muted">{meta}</p>}
            {trackData.match ? (
              <p className="mt-4 text-small text-ink" title={`Match score ${trackData.match.score}`}>
                {trackData.match.confidence === "exact" ? "Verified match" : "Matched"}: {trackData.match.title}
                <span className="text-muted">
                  {trackData.match.album ? ` · ${trackData.match.album}` : ""}
                  {trackData.match.duration > 0 ? ` · ${formatSeconds(trackData.match.duration)}` : ""}
                </span>
              </p>
            ) : isPreview ? (
              <p className="mt-4 text-small text-ink">
                No exact full-length version was found, so Spotify&apos;s official 30-second preview is playing.
              </p>
            ) : null}
          </div>

          {/* Seek: the segment motif, with a real range input on top for touch and keyboard */}
          <div>
            <div className="relative h-5">
              <Segments count={48} played={duration > 0 ? currentTime / duration : 0} className="absolute inset-0 gap-[3px]" />
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
              <span>{formatSeconds(currentTime)}</span>
              <span>{formatSeconds(duration)}</span>
            </div>
          </div>

          {/* Transport */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsLooping(!isLooping)}
                aria-pressed={isLooping}
                className={`btn min-h-[44px] w-11 px-0 ${isLooping ? "btn-ink" : "btn-quiet"}`}
                title={isLooping ? "Repeat is on" : "Repeat is off"}
              >
                <Repeat className="h-4 w-4" strokeWidth={2.4} />
              </button>
              <button type="button" onClick={cyclePlaybackRate} className="btn btn-quiet min-h-[44px] px-3 text-small tabular" title="Playback speed">
                {playbackRate}x
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button type="button" onClick={() => handleSkip(-10)} className="btn btn-quiet min-h-[52px] w-[52px] px-0" aria-label="Back 10 seconds">
                <RotateCcw className="h-5 w-5" strokeWidth={2.4} />
              </button>
              <button
                type="button"
                onClick={togglePlay}
                className="btn btn-accent min-h-[64px] w-[64px] px-0"
                aria-label={isPlaying ? "Pause" : "Play"}
              >
                {isBuffering ? (
                  <span className="h-6 w-6 rounded-full border-2 border-current border-r-transparent animate-[spin_0.8s_linear_infinite]" />
                ) : isPlaying ? (
                  <Pause className="h-7 w-7 fill-current" strokeWidth={2.2} />
                ) : (
                  <Play className="h-7 w-7 fill-current ml-1" strokeWidth={2.2} />
                )}
              </button>
              <button type="button" onClick={() => handleSkip(10)} className="btn btn-quiet min-h-[52px] w-[52px] px-0" aria-label="Forward 10 seconds">
                <RotateCw className="h-5 w-5" strokeWidth={2.4} />
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button type="button" onClick={toggleMute} className="btn btn-quiet min-h-[44px] w-11 px-0" aria-label={isMuted ? "Unmute" : "Mute"}>
                {isMuted || volume === 0 ? <VolumeX className="h-5 w-5" strokeWidth={2.4} /> : <Volume2 className="h-5 w-5" strokeWidth={2.4} />}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={isMuted ? 0 : volume}
                onChange={handleVolumeChange}
                aria-label="Volume"
                className="w-24 cursor-pointer accent-[var(--accent)] hidden sm:block"
              />
            </div>
          </div>

          {/* Quality */}
          {trackData.streams?.length > 1 && (
            <div role="radiogroup" aria-label="Quality" className="flex flex-wrap gap-2">
              {trackData.streams.map((s) => (
                <button
                  key={s.bitrate}
                  type="button"
                  role="radio"
                  aria-checked={activeStream.bitrate === s.bitrate}
                  onClick={() => handleSwitchQuality(s)}
                  className={`btn min-h-[44px] text-small ${activeStream.bitrate === s.bitrate ? "btn-ink" : "btn-quiet"}`}
                >
                  {s.quality}
                </button>
              ))}
            </div>
          )}

          {/* Downloads */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {trackData.streams?.map((s, i) => (
              <button
                key={s.bitrate}
                type="button"
                onClick={() => handleTriggerDownload(s)}
                disabled={downloadingQuality === s.bitrate}
                className={`btn min-h-[56px] ${i === 0 ? "btn-accent" : "btn-ink"}`}
              >
                <Download className="h-5 w-5" strokeWidth={2.4} />
                {downloadingQuality === s.bitrate ? "Starting download" : s.bitrate === "preview" ? "Download the preview" : `Download ${s.bitrate.replace("k", " kbps")}`}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-small">
            <button type="button" onClick={handleCopyStream} className="link inline-flex items-center gap-1.5 cursor-pointer">
              {copiedStream ? <Check className="h-4 w-4" strokeWidth={2.4} /> : <Copy className="h-4 w-4" strokeWidth={2.4} />}
              {copiedStream ? "Stream link copied" : "Copy stream link"}
            </button>
            <button type="button" onClick={handleCopySpotifyLink} className="link inline-flex items-center gap-1.5 cursor-pointer">
              {copiedLink ? <Check className="h-4 w-4" strokeWidth={2.4} /> : <Share2 className="h-4 w-4" strokeWidth={2.4} />}
              {copiedLink ? "Track link copied" : "Share track link"}
            </button>
            <a href={trackData.spotifyUrl} target="_blank" rel="noopener noreferrer" className="link inline-flex items-center gap-1.5">
              Open on Spotify <ExternalLink className="h-4 w-4" strokeWidth={2.4} />
            </a>
          </div>
        </div>
      </div>
    </article>
  );
};
