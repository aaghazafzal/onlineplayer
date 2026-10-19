"use client";

import React, { useRef, useState, useEffect, useCallback } from "react";
import Hls from "hls.js";
import {
  Play,
  Pause,
  Volume2,
  Volume1,
  VolumeX,
  Maximize,
  Minimize,
  Download,
  Copy,
  Check,
  Settings,
  RotateCcw,
  FastForward,
  Tv,
  PictureInPicture,
  Film,
  AlertCircle
} from "lucide-react";

export interface StreamData {
  streamUrl: string;
  streamUrl360?: string;
  title: string;
  durationSeconds?: number;
  durationFormatted?: string;
  sizeFormatted?: string;
  thumbnail?: string;
  surl?: string;
}

interface VideoPlayerProps {
  streamData: StreamData;
  isTheaterMode: boolean;
  onToggleTheater: () => void;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({
  streamData,
  isTheaterMode,
  onToggleTheater,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const playerContainerRef = useRef<HTMLDivElement>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const hlsRef = useRef<Hls | null>(null);

  // Player state
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(streamData.durationSeconds || 0);
  const [bufferedTime, setBufferedTime] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPiPActive, setIsPiPActive] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [selectedQuality, setSelectedQuality] = useState<"480" | "360">("480");
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [playerError, setPlayerError] = useState<string | null>(null);

  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Compute active stream url based on quality
  const activeUrl = selectedQuality === "360" && streamData.streamUrl360
    ? streamData.streamUrl360
    : streamData.streamUrl;

  // Initialize HLS.js
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !activeUrl) return;

    setPlayerError(null);

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
        backBufferLength: 90,
        maxBufferLength: 60,
        maxMaxBufferLength: 300,
        autoStartLoad: true,
      });

      hlsRef.current = hls;
      hls.loadSource(activeUrl);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        // Restore timestamp if saved in localStorage
        if (streamData.surl) {
          const savedPos = localStorage.getItem(`pos_${streamData.surl}`);
          if (savedPos) {
            const pos = parseFloat(savedPos);
            if (pos > 5 && pos < (video.duration || 100000) - 30) {
              video.currentTime = pos;
            }
          }
        }
        video.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
      });

      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              console.warn("Fatal network error encountered, attempting to recover...");
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              console.warn("Fatal media error encountered, recovering media...");
              hls.recoverMediaError();
              break;
            default:
              console.error("Unrecoverable HLS error:", data);
              setPlayerError("Video playback stalled. Please refresh or retry link.");
              hls.destroy();
              break;
          }
        }
      });
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      // Native Safari iOS/macOS HLS support
      video.src = activeUrl;
      video.addEventListener("loadedmetadata", () => {
        video.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
      });
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [activeUrl, streamData.surl]);

  // Video time & buffer tracking
  const handleTimeUpdate = () => {
    const video = videoRef.current;
    if (!video) return;

    setCurrentTime(video.currentTime);
    if (video.duration && !isNaN(video.duration)) {
      setDuration(video.duration);
    }

    // Save progress periodically for resume capability
    if (streamData.surl && Math.floor(video.currentTime) % 5 === 0) {
      localStorage.setItem(`pos_${streamData.surl}`, video.currentTime.toString());
    }

    // Buffered range
    if (video.buffered.length > 0) {
      for (let i = 0; i < video.buffered.length; i++) {
        if (video.buffered.start(i) <= video.currentTime && video.buffered.end(i) >= video.currentTime) {
          setBufferedTime(video.buffered.end(i));
          break;
        }
      }
    }
  };

  // Play / Pause toggle
  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    if (video.paused) {
      video.play().then(() => setIsPlaying(true)).catch(console.error);
    } else {
      video.pause();
      setIsPlaying(false);
    }
  }, []);

  // Seek bar scrub
  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const bar = progressBarRef.current;
    const video = videoRef.current;
    if (!bar || !video || !duration) return;

    const rect = bar.getBoundingClientRect();
    const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const newTime = pos * duration;
    video.currentTime = newTime;
    setCurrentTime(newTime);
  };

  // Volume scrub
  const handleVolumeChange = (newVol: number) => {
    const video = videoRef.current;
    if (!video) return;
    const clamped = Math.max(0, Math.min(1, newVol));
    video.volume = clamped;
    setVolume(clamped);
    setIsMuted(clamped === 0);
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    if (isMuted) {
      video.muted = false;
      setIsMuted(false);
      video.volume = volume > 0 ? volume : 0.5;
    } else {
      video.muted = true;
      setIsMuted(true);
    }
  };

  // Fullscreen toggle
  const toggleFullscreen = async () => {
    const container = playerContainerRef.current;
    if (!container) return;

    if (!document.fullscreenElement) {
      await container.requestFullscreen().catch(console.error);
      setIsFullscreen(true);
    } else {
      await document.exitFullscreen().catch(console.error);
      setIsFullscreen(false);
    }
  };

  // Picture in Picture toggle
  const togglePiP = async () => {
    const video = videoRef.current;
    if (!video) return;

    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
        setIsPiPActive(false);
      } else if (document.pictureInPictureEnabled) {
        await video.requestPictureInPicture();
        setIsPiPActive(true);
      }
    } catch (e) {
      console.warn("PiP not supported or denied:", e);
    }
  };

  // Playback speed
  const changeSpeed = (speed: number) => {
    const video = videoRef.current;
    if (video) {
      video.playbackRate = speed;
      setPlaybackSpeed(speed);
    }
    setShowSettingsMenu(false);
  };

  // Quality switch
  const changeQuality = (q: "480" | "360") => {
    setSelectedQuality(q);
    setShowSettingsMenu(false);
  };

  // Copy M3U8 link
  const copyStreamLink = () => {
    navigator.clipboard.writeText(activeUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  // Controls auto-hide on inactivity
  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying) setShowControls(false);
    }, 2800);
  };

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input
      if (["INPUT", "TEXTAREA"].includes((e.target as HTMLElement)?.tagName)) return;

      const video = videoRef.current;
      if (!video) return;

      switch (e.code) {
        case "Space":
          e.preventDefault();
          togglePlay();
          break;
        case "ArrowLeft":
          e.preventDefault();
          video.currentTime = Math.max(0, video.currentTime - 5);
          break;
        case "ArrowRight":
          e.preventDefault();
          video.currentTime = Math.min(video.duration || 100000, video.currentTime + 5);
          break;
        case "ArrowUp":
          e.preventDefault();
          handleVolumeChange(volume + 0.1);
          break;
        case "ArrowDown":
          e.preventDefault();
          handleVolumeChange(volume - 0.1);
          break;
        case "KeyF":
          e.preventDefault();
          toggleFullscreen();
          break;
        case "KeyM":
          e.preventDefault();
          toggleMute();
          break;
        case "KeyT":
          e.preventDefault();
          onToggleTheater();
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [togglePlay, volume, onToggleTheater]);

  const formatSeconds = (sec: number) => {
    if (!sec || isNaN(sec)) return "00:00";
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = Math.floor(sec % 60);
    if (h > 0) {
      return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
    }
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const progressPercent = duration ? (currentTime / duration) * 100 : 0;
  const bufferPercent = duration ? (bufferedTime / duration) * 100 : 0;

  return (
    <div
      ref={playerContainerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => isPlaying && setShowControls(false)}
      className={`relative w-full rounded-3xl overflow-hidden bg-black shadow-2xl transition-all duration-300 border border-zinc-800 ${
        isTheaterMode ? "max-w-[1500px] mx-auto" : "max-w-[1360px] mx-auto"
      }`}
    >
      {/* 16:9 Video Aspect Container */}
      <div className="relative aspect-video w-full bg-black flex items-center justify-center">
        <video
          ref={videoRef}
          onTimeUpdate={handleTimeUpdate}
          onEnded={() => setIsPlaying(false)}
          onClick={togglePlay}
          className="w-full h-full object-contain cursor-pointer"
          playsInline
        />

        {/* Big Center Play Overlay (when paused) */}
        {!isPlaying && (
          <button
            onClick={togglePlay}
            className="absolute z-20 h-20 w-20 rounded-full bg-blue-600/90 hover:bg-blue-600 text-white flex items-center justify-center shadow-2xl shadow-blue-600/40 backdrop-blur-md transition-transform hover:scale-110 active:scale-95"
            aria-label="Play Video"
          >
            <Play className="h-9 w-9 fill-white stroke-white ml-1.5" strokeWidth={2.5} />
          </button>
        )}

        {/* Error Banner */}
        {playerError && (
          <div className="absolute top-4 left-4 right-4 z-30 p-3 rounded-xl bg-red-950/80 border border-red-800 text-red-200 text-sm flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-red-400 shrink-0" strokeWidth={2.5} />
            <span>{playerError}</span>
          </div>
        )}

        {/* Controls Overlay */}
        <div
          className={`absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/95 via-black/60 to-transparent pt-12 pb-3 px-4 transition-opacity duration-300 ${
            showControls ? "opacity-100" : "opacity-0 pointer-events-none"
          }`}
        >
          {/* Progress / Seek Bar */}
          <div
            ref={progressBarRef}
            onClick={handleSeek}
            className="group relative h-2 hover:h-3 w-full bg-zinc-700/60 rounded-full cursor-pointer mb-3 transition-all"
          >
            {/* Buffer Bar */}
            <div
              className="absolute left-0 top-0 bottom-0 bg-zinc-500/50 rounded-full transition-all"
              style={{ width: `${Math.min(100, bufferPercent)}%` }}
            />
            {/* Played Bar */}
            <div
              className="absolute left-0 top-0 bottom-0 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full"
              style={{ width: `${Math.min(100, progressPercent)}%` }}
            />
            {/* Scrubber Knob */}
            <div
              className="absolute top-1/2 -translate-y-1/2 h-3.5 w-3.5 bg-white rounded-full shadow-md opacity-0 group-hover:opacity-100 transition-opacity -ml-1.5"
              style={{ left: `${Math.min(100, progressPercent)}%` }}
            />
          </div>

          {/* Controls Bottom Row */}
          <div className="flex items-center justify-between text-white text-xs sm:text-sm">
            {/* Left Controls: Play, Time, Volume */}
            <div className="flex items-center gap-3">
              <button
                onClick={togglePlay}
                className="p-1.5 rounded-lg hover:bg-white/10 transition-colors text-white"
                title={isPlaying ? "Pause (Space)" : "Play (Space)"}
              >
                {isPlaying ? (
                  <Pause className="h-5 w-5 fill-white" strokeWidth={2.5} />
                ) : (
                  <Play className="h-5 w-5 fill-white ml-0.5" strokeWidth={2.5} />
                )}
              </button>

              {/* Time Display */}
              <div className="font-mono text-xs text-zinc-300">
                <span>{formatSeconds(currentTime)}</span>
                <span className="mx-1 text-zinc-500">/</span>
                <span>{formatSeconds(duration)}</span>
              </div>

              {/* Volume & Mute */}
              <div className="flex items-center gap-1.5 group">
                <button
                  onClick={toggleMute}
                  className="p-1.5 rounded-lg hover:bg-white/10 transition-colors text-zinc-300 hover:text-white"
                  title="Mute (M)"
                >
                  {isMuted || volume === 0 ? (
                    <VolumeX className="h-5 w-5 text-red-400" strokeWidth={2.2} />
                  ) : volume < 0.5 ? (
                    <Volume1 className="h-5 w-5" strokeWidth={2.2} />
                  ) : (
                    <Volume2 className="h-5 w-5" strokeWidth={2.2} />
                  )}
                </button>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={isMuted ? 0 : volume}
                  onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                  className="w-16 h-1.5 bg-zinc-600 rounded-lg appearance-none cursor-pointer accent-sky-400 hidden sm:block"
                />
              </div>
            </div>

            {/* Right Controls: Settings, Theater, PiP, Fullscreen */}
            <div className="flex items-center gap-1.5 sm:gap-2">
              {/* Quality & Settings Dropdown */}
              <div className="relative">
                <button
                  onClick={() => setShowSettingsMenu(!showSettingsMenu)}
                  className="p-1.5 rounded-lg hover:bg-white/10 transition-colors text-zinc-300 hover:text-white flex items-center gap-1 font-semibold text-xs"
                  title="Settings & Quality"
                >
                  <Settings className="h-4 w-4" strokeWidth={2.2} />
                  <span className="hidden sm:inline">{selectedQuality}p</span>
                </button>

                {showSettingsMenu && (
                  <div className="absolute right-0 bottom-full mb-2 w-48 rounded-xl bg-zinc-900 border border-zinc-800 p-2 shadow-2xl text-xs space-y-2 z-40">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-zinc-400 px-2">Quality</span>
                      <div className="mt-1 space-y-0.5">
                        <button
                          onClick={() => changeQuality("480")}
                          className={`w-full px-2 py-1.5 rounded-md text-left flex items-center justify-between ${
                            selectedQuality === "480" ? "bg-sky-500/20 text-sky-400 font-semibold" : "hover:bg-zinc-800 text-zinc-300"
                          }`}
                        >
                          <span>480p High Definition</span>
                          {selectedQuality === "480" && <Check className="h-3.5 w-3.5" strokeWidth={2.5} />}
                        </button>
                        <button
                          onClick={() => changeQuality("360")}
                          className={`w-full px-2 py-1.5 rounded-md text-left flex items-center justify-between ${
                            selectedQuality === "360" ? "bg-sky-500/20 text-sky-400 font-semibold" : "hover:bg-zinc-800 text-zinc-300"
                          }`}
                        >
                          <span>360p Fast / Low Data</span>
                          {selectedQuality === "360" && <Check className="h-3.5 w-3.5" strokeWidth={2.5} />}
                        </button>
                      </div>
                    </div>

                    <div className="border-t border-zinc-800 pt-2">
                      <span className="text-[10px] uppercase font-bold text-zinc-400 px-2">Speed</span>
                      <div className="grid grid-cols-3 gap-1 mt-1">
                        {[0.5, 0.75, 1, 1.25, 1.5, 2].map((s) => (
                          <button
                            key={s}
                            onClick={() => changeSpeed(s)}
                            className={`px-1.5 py-1 rounded text-center font-medium ${
                              playbackSpeed === s ? "bg-sky-500 text-white font-bold" : "hover:bg-zinc-800 text-zinc-300"
                            }`}
                          >
                            {s}x
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Copy Stream Link */}
              <button
                onClick={copyStreamLink}
                className="p-1.5 rounded-lg hover:bg-white/10 transition-colors text-zinc-300 hover:text-white"
                title="Copy Stream Link (VLC / MX Player)"
              >
                {copiedLink ? (
                  <Check className="h-4 w-4 text-emerald-400" strokeWidth={2.5} />
                ) : (
                  <Copy className="h-4 w-4" strokeWidth={2.2} />
                )}
              </button>

              {/* Picture in Picture */}
              <button
                onClick={togglePiP}
                className="p-1.5 rounded-lg hover:bg-white/10 transition-colors text-zinc-300 hover:text-white hidden sm:block"
                title="Picture in Picture"
              >
                <PictureInPicture className="h-4 w-4" strokeWidth={2.2} />
              </button>

              {/* Theater Mode */}
              <button
                onClick={onToggleTheater}
                className={`p-1.5 rounded-lg hover:bg-white/10 transition-colors ${
                  isTheaterMode ? "text-sky-400" : "text-zinc-300 hover:text-white"
                } hidden md:block`}
                title="Theater Mode (T)"
              >
                <Tv className="h-4 w-4" strokeWidth={2.2} />
              </button>

              {/* Fullscreen */}
              <button
                onClick={toggleFullscreen}
                className="p-1.5 rounded-lg hover:bg-white/10 transition-colors text-zinc-300 hover:text-white"
                title="Fullscreen (F)"
              >
                {isFullscreen ? (
                  <Minimize className="h-4 w-4" strokeWidth={2.5} />
                ) : (
                  <Maximize className="h-4 w-4" strokeWidth={2.5} />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
