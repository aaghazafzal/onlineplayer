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
  Copy,
  Check,
  Settings,
  Tv,
  PictureInPicture,
  AlertCircle
} from "lucide-react";

export interface StreamData {
  streamUrl: string;
  streamUrl360?: string;
  /** Tried once if streamUrl fails (e.g. the CDN refuses this browser) */
  fallbackUrl?: string;
  title: string;
  durationSeconds?: number;
  durationFormatted?: string;
  sizeFormatted?: string;
  thumbnail?: string;
  surl?: string;
}

const SCRIM = "bg-gradient-to-t from-black/85 to-transparent"; // taste-skill-ignore: neutral scrim over footage, the house rules' one gradient
const MENU_SHADOW = "shadow-[0_12px_40px_rgba(0,0,0,0.35)]"; // taste-skill-ignore: a real menu floating over video

/** Our TeraBox playlists accept ?direct=1 to list CDN segment URLs instead of proxied ones. */
function directPlaylistUrl(url: string) {
  try {
    const u = new URL(url);
    const ours = u.hostname === "terabox.onlineplayer.site" || u.hostname.endsWith(".onlineplayer.workers.dev");
    if (!ours || !(u.pathname.startsWith("/playlist/") || u.pathname === "/proxy")) return url;
    u.searchParams.set("direct", "1");
    return u.toString();
  } catch {
    return url;
  }
}

// Vendor-prefixed Fullscreen / orientation APIs (Safari, old Firefox, old Edge)
type FsDocument = Document & {
  webkitFullscreenElement?: Element | null;
  mozFullScreenElement?: Element | null;
  msFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
  mozCancelFullScreen?: () => Promise<void> | void;
  msExitFullscreen?: () => Promise<void> | void;
};
type FsElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
  mozRequestFullScreen?: () => Promise<void> | void;
  msRequestFullscreen?: () => Promise<void> | void;
};
type LockableOrientation = ScreenOrientation & {
  lock?: (orientation: string) => Promise<void>;
  unlock?: () => void;
};

function fullscreenElement() {
  const d = document as FsDocument;
  return d.fullscreenElement || d.webkitFullscreenElement || d.mozFullScreenElement || d.msFullscreenElement || null;
}

async function requestFullscreen(el: HTMLElement) {
  const e = el as FsElement;
  if (e.requestFullscreen) return e.requestFullscreen();
  if (e.webkitRequestFullscreen) return e.webkitRequestFullscreen();
  if (e.mozRequestFullScreen) return e.mozRequestFullScreen();
  if (e.msRequestFullscreen) return e.msRequestFullscreen();
}

async function exitFullscreen() {
  const d = document as FsDocument;
  if (d.exitFullscreen) return d.exitFullscreen();
  if (d.webkitExitFullscreen) return d.webkitExitFullscreen();
  if (d.mozCancelFullScreen) return d.mozCancelFullScreen();
  if (d.msExitFullscreen) return d.msExitFullscreen();
}

function orientation() {
  return (typeof screen !== "undefined" ? screen.orientation : undefined) as LockableOrientation | undefined;
}

interface VideoPlayerProps {
  streamData: StreamData;
  isTheaterMode: boolean;
  onToggleTheater: () => void;
  /** Called when the video plays to its end (playlists move on) */
  onEnded?: () => void;
  /** Called with the current time when the stream stops being served (the page can switch source) */
  onPlaybackFailed?: (time: number) => void;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({
  streamData,
  isTheaterMode,
  onToggleTheater,
  onEnded,
  onPlaybackFailed,
}) => {
  const failedRef = useRef(onPlaybackFailed);
  useEffect(() => {
    failedRef.current = onPlaybackFailed;
  }, [onPlaybackFailed]);
  // Qualities offered by an HLS master playlist; -1 is automatic
  const [hlsLevels, setHlsLevels] = useState<{ index: number; height: number }[]>([]);
  const [hlsLevel, setHlsLevel] = useState(-1);
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

  // Check if current stream supports multi-quality (e.g. TeraBox with 480p/360p)
  const hasMultiQuality = Boolean(streamData.streamUrl360);

  // Compute active stream url based on quality
  const activeUrl = selectedQuality === "360" && streamData.streamUrl360
    ? streamData.streamUrl360
    : streamData.streamUrl;

  // Playback engine. Browsers with native HLS (iOS, Android, Safari) get the playlist
  // with direct CDN segments (?direct=1): no Worker request per segment. Everything
  // else, or a native failure, uses hls.js through the segment proxy.
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !activeUrl) return;

    setPlayerError(null);
    let cancelled = false;

    const destroyHls = () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
    destroyHls();

    const restorePosition = (margin: number) => {
      if (!streamData.surl) return;
      try {
        const pos = parseFloat(localStorage.getItem(`pos_${streamData.surl}`) || "");
        if (pos > 5 && pos < (video.duration || 100000) - margin) video.currentTime = pos;
      } catch {
        // storage unavailable
      }
    };
    const autoplay = () => video.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));

    const isHls = activeUrl.includes("m3u8") || activeUrl.includes("/share/streaming") || activeUrl.includes("/proxy?stream=");

    const startHlsJs = () => {
      if (!Hls.isSupported()) {
        setPlayerError("This browser cannot play this stream. Try Chrome, Safari or Firefox.");
        return;
      }
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
        backBufferLength: 90,
        maxBufferLength: 60,
        maxMaxBufferLength: 300,
      });
      hlsRef.current = hls;
      hls.loadSource(activeUrl);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, (_event, data) => {
        const levels = data.levels.map((l, index) => ({ index, height: l.height })).filter((l) => l.height);
        if (levels.length > 1) {
          setHlsLevels([...levels].sort((a, b) => b.height - a.height));
          setHlsLevel(-1);
          // Start sharp but not heavy: 720p on wide screens, 480p on phones
          const cap = window.innerWidth > 800 ? 720 : 480;
          const start = levels.filter((l) => l.height <= cap).sort((a, b) => b.height - a.height)[0];
          if (start) hls.startLevel = start.index;
        } else {
          setHlsLevels([]);
        }
        restorePosition(30);
        autoplay();
      });
      let networkFailures = 0;
      const giveUp = () => {
        const at = video.currentTime;
        destroyHls();
        if (failedRef.current) failedRef.current(at);
        else setPlayerError("Playback stopped. Press Play to retry, or open the link again.");
      };
      hls.on(Hls.Events.FRAG_LOADED, () => {
        networkFailures = 0;
      });
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (!data.fatal) return;
        if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
          // A server that refuses (4xx/5xx) twice will not start serving again: stop looping
          const status = (data.response as { code?: number } | undefined)?.code || 0;
          networkFailures++;
          if (networkFailures > 2 || (status >= 400 && networkFailures > 1)) giveUp();
          else setTimeout(() => hlsRef.current === hls && hls.startLoad(), 1500 * networkFailures);
        } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) hls.recoverMediaError();
        else giveUp();
      });
    };

    const startNative = (src: string, onFail: () => void) => {
      video.src = src;
      video.onloadedmetadata = () => {
        restorePosition(30);
        autoplay();
      };
      video.onerror = () => {
        if (cancelled) return;
        video.onerror = null;
        video.removeAttribute("src");
        onFail();
      };
    };

    // Apple WebKit (iPhone, iPad, Mac Safari) plays HLS natively without CORS, so it can
    // read segments straight from TeraBox's CDN. Chrome's native HLS needs CORS, which that
    // CDN does not send, so other browsers keep using hls.js through the proxy.
    const nativeHls = video.canPlayType("application/vnd.apple.mpegurl") !== "";
    const appleWebKit = /iP(hone|ad|od)|Macintosh/.test(navigator.userAgent) && !/Chrome|CriOS|FxiOS|Android|Edg\//.test(navigator.userAgent);

    if (isHls && nativeHls && appleWebKit) {
      // direct CDN -> hls.js via proxy (iOS 17.1+, macOS) -> native via proxy
      startNative(directPlaylistUrl(activeUrl), () =>
        Hls.isSupported() ? startHlsJs() : startNative(activeUrl, () => setPlayerError("This stream could not be played. Open the link again."))
      );
    } else if (isHls && Hls.isSupported()) {
      startHlsJs();
    } else if (isHls && nativeHls) {
      startNative(activeUrl, () => setPlayerError("This stream could not be played. Open the link again."));
    } else if (isHls) {
      startHlsJs(); // reports that this browser cannot play HLS
    } else {
      // Progressive MP4 (Instagram, direct files)
      video.src = activeUrl;
      video.load();
      video.onloadedmetadata = () => {
        restorePosition(10);
        autoplay();
      };
      video.onerror = () => {
        if (streamData.fallbackUrl && video.src !== streamData.fallbackUrl) {
          video.src = streamData.fallbackUrl;
          video.load();
          return;
        }
        setPlayerError("This video could not be loaded. Check the link or try again.");
      };
    }

    return () => {
      cancelled = true;
      video.onerror = null;
      video.onloadedmetadata = null;
      destroyHls();
    };
  }, [activeUrl, streamData.surl, streamData.fallbackUrl]);

  // Listen for fullscreen change (including ESC key, swipe down, Android back gesture)
  useEffect(() => {
    const onFullscreenChange = () => {
      const isFs = Boolean(fullscreenElement());
      setIsFullscreen(isFs);
      if (!isFs) {
        try {
          orientation()?.unlock?.();
        } catch {
          // orientation lock not supported
        }
      }
    };

    document.addEventListener("fullscreenchange", onFullscreenChange);
    document.addEventListener("webkitfullscreenchange", onFullscreenChange);
    document.addEventListener("mozfullscreenchange", onFullscreenChange);
    document.addEventListener("MSFullscreenChange", onFullscreenChange);

    return () => {
      document.removeEventListener("fullscreenchange", onFullscreenChange);
      document.removeEventListener("webkitfullscreenchange", onFullscreenChange);
      document.removeEventListener("mozfullscreenchange", onFullscreenChange);
      document.removeEventListener("MSFullscreenChange", onFullscreenChange);
    };
  }, []);

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

  // Fullscreen toggle with mobile auto-rotate & orientation lock
  const toggleFullscreen = async () => {
    const container = playerContainerRef.current;
    const video = videoRef.current;
    if (!container || !video) return;

    // iOS Safari only allows fullscreen on the video element itself
    const iosVideo = video as HTMLVideoElement & { webkitEnterFullscreen?: () => void };
    if (/iPad|iPhone|iPod/.test(navigator.userAgent) && iosVideo.webkitEnterFullscreen) {
      try {
        iosVideo.webkitEnterFullscreen();
        return;
      } catch (e) {
        console.warn("iOS native fullscreen error:", e);
      }
    }

    if (!fullscreenElement()) {
      try {
        await requestFullscreen(container);
        setIsFullscreen(true);
        // Turn phones and tablets to landscape where the browser allows it
        await orientation()?.lock?.("landscape").catch(() => {});
      } catch (err) {
        console.error("Fullscreen error:", err);
      }
    } else {
      try {
        await exitFullscreen();
        setIsFullscreen(false);
        try {
          orientation()?.unlock?.();
        } catch {
          // orientation lock not supported
        }
      } catch (err) {
        console.error("Exit fullscreen error:", err);
      }
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
      className={`relative w-full bg-stage text-stage-ink ${
        isFullscreen ? "fixed inset-0 h-dvh w-screen z-[99999]" : "rounded-ui overflow-clip"
      }`}
    >
      <div className={`relative w-full bg-black flex items-center justify-center ${isFullscreen ? "h-full" : "aspect-video"}`}>
        <video
          ref={videoRef}
          onTimeUpdate={handleTimeUpdate}
          onEnded={() => {
            setIsPlaying(false);
            onEnded?.();
          }}
          onClick={togglePlay}
          className="w-full h-full object-contain cursor-pointer"
          playsInline
        />

        {!isPlaying && (
          <button onClick={togglePlay} className="btn btn-accent absolute z-20 h-[72px] w-[72px] px-0" aria-label="Play video">
            <Play className="h-8 w-8 fill-current ml-1" strokeWidth={2.4} />
          </button>
        )}

        {playerError && (
          <div role="alert" className="absolute top-4 inset-x-4 z-30 p-4 rounded-ui bg-danger-soft text-ink text-small flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-danger shrink-0" strokeWidth={2.5} />
            <span>{playerError}</span>
          </div>
        )}

        {/* Controls, over a neutral scrim so they stay legible on any frame */}
        <div
          className={`absolute inset-x-0 bottom-0 z-20 ${SCRIM} pt-14 ${
            isFullscreen ? "pb-6 px-6 sm:px-10" : "pb-3 px-3 sm:px-4"
          } transition-opacity duration-300 ${showControls ? "opacity-100" : "opacity-0 pointer-events-none"}`}
        >
          <div
            ref={progressBarRef}
            onClick={handleSeek}
            role="slider"
            aria-label="Seek"
            aria-valuemin={0}
            aria-valuemax={Math.round(duration) || 0}
            aria-valuenow={Math.round(currentTime)}
            className="group relative h-2 hover:h-3 w-full rounded-[2px] bg-white/20 cursor-pointer mb-3 transition-[height] duration-150"
          >
            <div className="absolute inset-y-0 left-0 rounded-[2px] bg-white/35" style={{ width: `${Math.min(100, bufferPercent)}%` }} />
            <div className="absolute inset-y-0 left-0 rounded-[2px] bg-accent" style={{ width: `${Math.min(100, progressPercent)}%` }} />
            <div
              className="absolute top-1/2 -translate-y-1/2 -ml-2 h-4 w-4 rounded-[3px] bg-white opacity-0 group-hover:opacity-100 transition-opacity"
              style={{ left: `${Math.min(100, progressPercent)}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-white text-small">
            <div className="flex items-center gap-2 sm:gap-3">
              <button
                onClick={togglePlay}
                className="h-10 w-10 inline-flex items-center justify-center rounded-ui hover:bg-white/10 transition-colors"
                title={isPlaying ? "Pause (Space)" : "Play (Space)"}
                aria-label={isPlaying ? "Pause" : "Play"}
              >
                {isPlaying ? <Pause className="h-5 w-5 fill-white" strokeWidth={2.5} /> : <Play className="h-5 w-5 fill-white ml-0.5" strokeWidth={2.5} />}
              </button>

              <div className="tabular text-white/85">
                {formatSeconds(currentTime)}
                <span className="mx-1 text-white/50">/</span>
                {formatSeconds(duration)}
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={toggleMute}
                  className="h-10 w-10 inline-flex items-center justify-center rounded-ui hover:bg-white/10 transition-colors"
                  title="Mute (M)"
                  aria-label={isMuted ? "Unmute" : "Mute"}
                >
                  {isMuted || volume === 0 ? (
                    <VolumeX className="h-5 w-5" strokeWidth={2.2} />
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
                  aria-label="Volume"
                  className="w-20 h-1.5 cursor-pointer accent-[var(--accent)] hidden sm:block"
                />
              </div>
            </div>

            <div className="flex items-center gap-1 sm:gap-1.5">
              <div className="relative">
                <button
                  onClick={() => setShowSettingsMenu(!showSettingsMenu)}
                  aria-expanded={showSettingsMenu}
                  className="h-10 px-2.5 inline-flex items-center gap-1.5 rounded-ui hover:bg-white/10 transition-colors font-medium"
                  title="Quality and speed"
                >
                  <Settings className="h-4 w-4" strokeWidth={2.2} />
                  <span className="hidden sm:inline">
                    {hasMultiQuality
                      ? `${selectedQuality}p`
                      : hlsLevels.length > 1
                        ? hlsLevel === -1
                          ? "Auto"
                          : `${hlsLevels.find((l) => l.index === hlsLevel)?.height}p`
                        : `${playbackSpeed}x`}
                  </span>
                </button>

                {showSettingsMenu && (
                  <div className={`absolute right-0 bottom-full mb-2 w-56 rounded-ui bg-paper text-ink p-3 ${MENU_SHADOW} text-small z-40`}>
                    {hasMultiQuality && (
                      <div className="pb-3">
                        <p className="px-1 pb-1 text-muted">Quality</p>
                        {(["480", "360"] as const).map((q) => (
                          <button
                            key={q}
                            onClick={() => changeQuality(q)}
                            className={`w-full min-h-[40px] px-2 rounded-ui text-left flex items-center justify-between transition-colors ${
                              selectedQuality === q ? "bg-accent text-accent-ink font-medium" : "hover:bg-surface-2"
                            }`}
                          >
                            <span>{q === "480" ? "480p, sharper" : "360p, uses less data"}</span>
                            {selectedQuality === q && <Check className="h-4 w-4" strokeWidth={2.5} />}
                          </button>
                        ))}
                      </div>
                    )}
                    {!hasMultiQuality && hlsLevels.length > 1 && (
                      <div className="pb-3">
                        <p className="px-1 pb-1 text-muted">Quality</p>
                        <div className="max-h-56 overflow-y-auto">
                          {[{ index: -1, height: 0 }, ...hlsLevels].map((l) => (
                            <button
                              key={l.index}
                              onClick={() => {
                                if (hlsRef.current) hlsRef.current.currentLevel = l.index;
                                setHlsLevel(l.index);
                                setShowSettingsMenu(false);
                              }}
                              className={`w-full min-h-[40px] px-2 rounded-ui text-left flex items-center justify-between transition-colors ${
                                hlsLevel === l.index ? "bg-accent text-accent-ink font-medium" : "hover:bg-surface-2"
                              }`}
                            >
                              <span>{l.index === -1 ? "Auto" : `${l.height}p${l.height >= 1080 ? " HD" : ""}`}</span>
                              {hlsLevel === l.index && <Check className="h-4 w-4" strokeWidth={2.5} />}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    <p className="px-1 pb-1 text-muted">Speed</p>
                    <div className="grid grid-cols-3 gap-1">
                      {[0.5, 0.75, 1, 1.25, 1.5, 2].map((sp) => (
                        <button
                          key={sp}
                          onClick={() => changeSpeed(sp)}
                          className={`min-h-[36px] rounded-ui tabular transition-colors ${
                            playbackSpeed === sp ? "bg-accent text-accent-ink font-medium" : "bg-surface-2 hover:bg-surface"
                          }`}
                        >
                          {sp}x
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <button
                onClick={copyStreamLink}
                className="h-10 w-10 inline-flex items-center justify-center rounded-ui hover:bg-white/10 transition-colors"
                title="Copy stream link (VLC, MX Player)"
                aria-label="Copy stream link"
              >
                {copiedLink ? <Check className="h-4 w-4" strokeWidth={2.5} /> : <Copy className="h-4 w-4" strokeWidth={2.2} />}
              </button>

              <button
                onClick={togglePiP}
                className="h-10 w-10 hidden sm:inline-flex items-center justify-center rounded-ui hover:bg-white/10 transition-colors"
                title="Picture in picture"
                aria-label="Picture in picture"
                aria-pressed={isPiPActive}
              >
                <PictureInPicture className="h-4 w-4" strokeWidth={2.2} />
              </button>

              <button
                onClick={onToggleTheater}
                className={`h-10 w-10 hidden md:inline-flex items-center justify-center rounded-ui transition-colors ${
                  isTheaterMode ? "bg-white/15" : "hover:bg-white/10"
                }`}
                title="Theatre mode (T)"
                aria-label="Theatre mode"
                aria-pressed={isTheaterMode}
              >
                <Tv className="h-4 w-4" strokeWidth={2.2} />
              </button>

              <button
                onClick={toggleFullscreen}
                className="h-10 w-10 inline-flex items-center justify-center rounded-ui hover:bg-white/10 transition-colors"
                title="Fullscreen (F)"
                aria-label={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
              >
                {isFullscreen ? <Minimize className="h-4 w-4" strokeWidth={2.5} /> : <Maximize className="h-4 w-4" strokeWidth={2.5} />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
