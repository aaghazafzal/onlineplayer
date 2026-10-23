"use client";

import React, { useState, useEffect } from "react";
import { Navbar } from "../components/Navbar";
import { UrlInputBar } from "../components/UrlInputBar";
import { VideoPlayer, StreamData } from "../components/VideoPlayer";
import { VideoMetaCard, FileItem } from "../components/VideoMetaCard";
import { InstagramPostViewer, InstagramPostData } from "../components/InstagramPostViewer";
import { AudioPlayer, SpotifyTrackData } from "../components/AudioPlayer";
import { SpotifyPlaylistViewer, SpotifyPlaylistData } from "../components/SpotifyPlaylistViewer";
import { RecentStreams, HistoryItem } from "../components/RecentStreams";
import { ShortcutsModal } from "../components/ShortcutsModal";
import { resolveLink } from "../lib/resolvers";
import { 
  AlertCircle, 
  Film, 
  ShieldCheck, 
  Zap, 
  Send, 
  Copy, 
  PlayCircle, 
  Download, 
  Smartphone, 
  Tablet, 
  Monitor, 
  Lock, 
  Check, 
  Rocket, 
  CheckCircle2, 
  ArrowRight, 
  Sparkles, 
  ChevronDown,
  Music
} from "lucide-react";

const FAQ_ITEMS = [
  {
    question: "Is it legal to stream and download videos using OnlinePlayer?",
    answer: "Yes! OnlinePlayer operates as a client-side cloud stream resolver. We do not host, re-encode, or store any media files on our servers. You are accessing and playing files that are already shared publicly through cloud storage platforms like TeraBox."
  },
  {
    question: "Do I need to install any software or extensions?",
    answer: "No! OnlinePlayer works 100% inside your standard web browser. There is no software, APK, or browser extension required. Simply paste your link and enjoy instant streaming or downloading across PC, Mac, Android, and iOS."
  },
  {
    question: "Is there a limit on video size or duration?",
    answer: "Zero limits! Unlike official cloud viewers that lock video playback behind 30-second preview restrictions, our streaming technology extracts the genuine full-length video whether it is a short clip or a 4-hour 4K movie."
  },
  {
    question: "Why is my video not downloading or playing?",
    answer: "Ensure your link is public and has not been deleted or expired by the original owner. Links that require passwords, expired share tokens, or links to non-video formats cannot be streamed."
  },
  {
    question: "Is my personal data safe and anonymous?",
    answer: "100% safe. We require no user accounts, no login passwords, and no email signups. We never track your streaming activity, nor do we store cookies with personal user logs."
  },
  {
    question: "Which TeraBox domains are supported by OnlinePlayer?",
    answer: "We support all official TeraBox domains and regional mirrors including terabox.app, 1024tera.com, 1024terabox.com, terasharelink.com, terafileshare.com, nephobox.com, dubox.com, and mirrobox.com."
  },
  {
    question: "How does the player work on different devices?",
    answer: "OnlinePlayer is completely responsive. On mobile phones (iPhone & Android), it features an edge-to-edge landscape auto-rotate player. On laptops and desktop computers, it provides keyboard shortcuts (Space to play/pause, Arrow keys for seek/volume, F for fullscreen)."
  },
  {
    question: "Is OnlinePlayer completely free to use?",
    answer: "Yes, OnlinePlayer is completely free with unrestricted access. There are no subscriptions, no credit cards required, and no hidden paywalls."
  }
];

export default function Home() {
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [streamData, setStreamData] = useState<StreamData | null>(null);
  const [instagramData, setInstagramData] = useState<InstagramPostData | null>(null);
  const [spotifyData, setSpotifyData] = useState<SpotifyTrackData | null>(null);
  const [spotifyPlaylistData, setSpotifyPlaylistData] = useState<SpotifyPlaylistData | null>(null);
  const [filesList, setFilesList] = useState<FileItem[]>([]);
  const [currentFileIndex, setCurrentFileIndex] = useState(0);
  const [isCachedHit, setIsCachedHit] = useState(false);
  const [isTheaterMode, setIsTheaterMode] = useState(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([]);
  const [autoStartDownload, setAutoStartDownload] = useState(false);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);

  // Load history from localStorage and check query params for auto-resolve
  useEffect(() => {
    try {
      const saved = localStorage.getItem("onlineplayer_history") || localStorage.getItem("omni_history");
      if (saved) {
        setHistoryItems(JSON.parse(saved));
      }
    } catch (e) {
      console.warn("Failed to load history:", e);
    }

    // Auto-resolve if ?url= or ?play= is in URL
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const targetUrl = params.get("url") || params.get("play");
      const shouldDownload = params.get("download") === "1" || params.get("action") === "download";
      if (targetUrl) {
        handleResolve(targetUrl, shouldDownload);
      }
    }
  }, []);

  // Functional updates: handleResolve can run from the mount effect, before the
  // loaded history has reached this render's closure.
  const persistHistory = (update: (prev: HistoryItem[]) => HistoryItem[]) => {
    setHistoryItems((prev) => {
      const updated = update(prev);
      try {
        localStorage.setItem("onlineplayer_history", JSON.stringify(updated));
      } catch (e) {
        console.warn("Failed to save history:", e);
      }
      return updated;
    });
  };

  const saveToHistory = (item: HistoryItem) => {
    persistHistory((prev) => [item, ...prev.filter((h) => h.surl !== item.surl)].slice(0, 12));
  };

  const handleClearHistory = () => {
    setHistoryItems([]);
    try {
      localStorage.removeItem("onlineplayer_history");
      localStorage.removeItem("omni_history");
    } catch {
      // storage unavailable
    }
  };

  const handleRemoveHistoryItem = (surl: string) => {
    persistHistory((prev) => prev.filter((h) => h.surl !== surl));
  };

  const handleResolve = async (url: string, autoDownload = false) => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const result = await resolveLink(url);

      setStreamData(null);
      setInstagramData(null);
      setSpotifyData(null);
      setSpotifyPlaylistData(null);
      setFilesList([]);
      setCurrentFileIndex(0);
      setIsCachedHit(false);

      switch (result.kind) {
        case "direct":
          setStreamData(result.stream);
          break;
        case "instagram":
          setInstagramData(result.post);
          saveToHistory(result.history);
          break;
        case "spotify":
          setSpotifyData(result.track);
          saveToHistory(result.history);
          break;
        case "spotify_playlist":
          setSpotifyPlaylistData(result.playlist);
          saveToHistory(result.history);
          break;
        case "terabox":
          setFilesList(result.files);
          setStreamData(result.stream);
          setIsCachedHit(result.cached);
          if (result.history) saveToHistory(result.history);
          break;
      }

      setAutoStartDownload(autoDownload);
      setTimeout(() => {
        document.getElementById("player-container")?.scrollIntoView({ behavior: "smooth" });
      }, 150);
    } catch (err) {
      console.error("Resolve error:", err);
      setErrorMessage(err instanceof Error && err.message ? err.message : "An unexpected error occurred while resolving this link.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectFile = (index: number) => {
    if (!filesList[index]) return;
    const file = filesList[index];
    setCurrentFileIndex(index);
    setStreamData((prev) => prev ? {
      ...prev,
      streamUrl: file.stream_url,
      streamUrl360: file.stream_url_360,
      title: file.filename,
      durationFormatted: file.duration_formatted,
      sizeFormatted: file.size_formatted,
      thumbnail: file.thumbnail,
    } : null);
  };

  const handlePlayHistoryItem = (item: HistoryItem) => {
    handleResolve(item.originalUrl, false);
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#f4f4f7] dark:bg-[#0e0e11] text-zinc-950 dark:text-zinc-100 transition-colors duration-200">
      
      {/* Top Navbar */}
      <Navbar onOpenShortcuts={() => setIsShortcutsOpen(true)} />

      {/* Main Container - Extended Width for Laptops & Desktops */}
      <main className="flex-1 w-full max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14 space-y-14 sm:space-y-18">
        
        {/* Universal Hero Headline */}
        <div className="text-center space-y-4 pt-2">
          <h1 className="text-3xl sm:text-5xl md:text-6xl font-black tracking-tight text-zinc-950 dark:text-white leading-[1.15]">
            Universal{" "}
            <span className="bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 bg-clip-text text-transparent">
              Cloud Video Player & Downloader
            </span>{" "}
            Online
          </h1>

          <p className="text-base sm:text-lg text-zinc-600 dark:text-zinc-400 font-medium max-w-3xl mx-auto leading-relaxed">
            Stream and download TeraBox, Instagram, Spotify, DiskWala, and direct cloud links instantly with zero limits &amp; no ads.
          </p>
        </div>

        {/* Hero Extraction Bar */}
        <UrlInputBar 
          onResolve={handleResolve} 
          isLoading={isLoading} 
        />

        {/* Error Alert Box */}
        {errorMessage && (
          <div className="max-w-5xl mx-auto p-5 sm:p-6 rounded-3xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-red-700 dark:text-red-300 text-sm flex items-start gap-3.5 shadow-sm">
            <AlertCircle className="h-6 w-6 text-red-500 shrink-0 mt-0.5" strokeWidth={2.4} />
            <div className="space-y-1.5">
              <p className="font-bold text-base">Unable to resolve media link</p>
              <p className="text-xs sm:text-sm text-red-600 dark:text-red-400 leading-relaxed">{errorMessage}</p>
              <a
                href="#providers"
                className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-blue-600 dark:text-blue-400 hover:underline pt-1"
              >
                <span>View Supported Platforms &amp; Status</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </a>
            </div>
          </div>
        )}

        {/* Active Player Section (Appears when video, Instagram post or Spotify track/playlist is loaded) */}
        {(streamData || instagramData || spotifyData || spotifyPlaylistData) && (
          <div id="player-container" className="space-y-8 pt-4 scroll-mt-24">
            {spotifyPlaylistData ? (
              <SpotifyPlaylistViewer
                playlistData={spotifyPlaylistData}
                autoStartDownload={autoStartDownload}
              />
            ) : spotifyData ? (
              <AudioPlayer
                trackData={spotifyData}
                autoStartDownload={autoStartDownload}
              />
            ) : instagramData ? (
              <InstagramPostViewer
                postData={instagramData}
                autoStartDownload={autoStartDownload}
              />
            ) : streamData ? (
              <>
                <VideoPlayer
                  streamData={streamData}
                  isTheaterMode={isTheaterMode}
                  onToggleTheater={() => setIsTheaterMode(!isTheaterMode)}
                />

                <VideoMetaCard
                  title={streamData.title}
                  durationFormatted={streamData.durationFormatted}
                  sizeFormatted={streamData.sizeFormatted}
                  streamUrl={streamData.streamUrl}
                  files={filesList}
                  currentFileIndex={currentFileIndex}
                  onSelectFile={handleSelectFile}
                  isCached={isCachedHit}
                  autoStartDownload={autoStartDownload}
                />
              </>
            ) : null}
          </div>
        )}

        {/* Recent Streams History */}
        <RecentStreams
          items={historyItems}
          onPlayItem={handlePlayHistoryItem}
          onClearHistory={handleClearHistory}
          onRemoveItem={handleRemoveHistoryItem}
        />

        {/* SECTION: Supported Platforms & Providers */}
        <section id="providers" className="p-8 sm:p-12 md:p-16 rounded-[32px] bg-white dark:bg-[#18181f] border border-zinc-200 dark:border-[#272733] shadow-2xl space-y-10 scroll-mt-24">
          {/* Header */}
          <div className="space-y-3 text-center max-w-3xl mx-auto">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-zinc-950 dark:text-white tracking-tight">
              Supported Platforms
            </h2>
            <p className="text-base sm:text-lg text-zinc-600 dark:text-zinc-400 font-medium">
              Stream and download videos with zero limits, no preview cutoffs, and ad-free playback from all major cloud platforms.
            </p>
          </div>

          {/* Provider Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
            
            {/* CARD 1: TeraBox */}
            <div className="group relative p-7 sm:p-8 rounded-[28px] bg-zinc-50 dark:bg-[#121217] border border-zinc-200 dark:border-[#262633] hover:border-blue-500/50 dark:hover:border-blue-500/50 transition-all duration-300 flex flex-col justify-between shadow-xs hover:shadow-xl">
              <div className="space-y-5">
                <div className="flex items-center justify-between">
                  <img 
                    src="/providers/terabox.png" 
                    alt="TeraBox Logo" 
                    className="h-12 w-auto sm:h-14 object-contain group-hover:scale-105 transition-transform"
                  />
                  <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold bg-zinc-100 dark:bg-[#181822] text-zinc-800 dark:text-zinc-200 border border-zinc-300/80 dark:border-[#28283a]">
                    <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
                    Live & Bypassed
                  </span>
                </div>

                <div>
                  <h3 className="text-xl sm:text-2xl font-black text-zinc-950 dark:text-white group-hover:text-blue-500 transition-colors">
                    TeraBox
                  </h3>
                  <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                    Cloud Storage & Video Sharing
                  </p>
                </div>

                {/* Feature Checkpoints */}
                <div className="space-y-2.5 pt-2">
                  <div className="flex items-center gap-2.5 text-xs sm:text-sm text-zinc-700 dark:text-zinc-300 font-medium">
                    <CheckCircle2 className="h-4 w-4 text-blue-500 dark:text-blue-400 shrink-0" />
                    <span>100% Full-Length Stream (No 30s cutoff)</span>
                  </div>
                  <div className="flex items-center gap-2.5 text-xs sm:text-sm text-zinc-700 dark:text-zinc-300 font-medium">
                    <CheckCircle2 className="h-4 w-4 text-blue-500 dark:text-blue-400 shrink-0" />
                    <span>Multi-Quality: 1080p, 720p, 480p, 360p</span>
                  </div>
                  <div className="flex items-center gap-2.5 text-xs sm:text-sm text-zinc-700 dark:text-zinc-300 font-medium">
                    <CheckCircle2 className="h-4 w-4 text-blue-500 dark:text-blue-400 shrink-0" />
                    <span>High-Speed Direct Downloader</span>
                  </div>
                  <div className="flex items-center gap-2.5 text-xs sm:text-sm text-zinc-700 dark:text-zinc-300 font-medium">
                    <CheckCircle2 className="h-4 w-4 text-blue-500 dark:text-blue-400 shrink-0" />
                    <span>Search & Browse Videos Catalog</span>
                  </div>
                </div>

                {/* Supported Domains */}
                <div className="pt-2">
                  <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-2">Supported Domains</p>
                  <div className="flex flex-wrap gap-1.5">
                    {["terabox.app", "1024tera.com", "terasharelink.com", "nephobox", "dubox"].map((dom) => (
                      <span key={dom} className="px-2.5 py-1 rounded-md text-[11px] font-semibold bg-zinc-200/70 dark:bg-[#1a1a24] text-zinc-700 dark:text-zinc-300 border border-zinc-300/40 dark:border-[#272737]">
                        {dom}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Action Button */}
              <div className="pt-6 mt-6 border-t border-zinc-200/80 dark:border-[#222230]">
                <button
                  type="button"
                  onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
                  className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-md shadow-blue-600/20 transition-all cursor-pointer"
                >
                  <span>Use TeraBox Player</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* CARD 2: Instagram */}
            <div className="group relative p-7 sm:p-8 rounded-[28px] bg-zinc-50 dark:bg-[#121217] border border-zinc-200 dark:border-[#262633] hover:border-blue-500/50 dark:hover:border-blue-500/50 transition-all duration-300 flex flex-col justify-between shadow-xs hover:shadow-xl">
              <div className="space-y-5">
                <div className="flex items-center justify-between">
                  <img 
                    src="/providers/instagram.png" 
                    alt="Instagram Logo" 
                    className="h-12 w-auto sm:h-14 object-contain group-hover:scale-105 transition-transform"
                  />
                  <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold bg-zinc-100 dark:bg-[#181822] text-zinc-800 dark:text-zinc-200 border border-zinc-300/80 dark:border-[#28283a]">
                    <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
                    Reels & Videos
                  </span>
                </div>

                <div>
                  <h3 className="text-xl sm:text-2xl font-black text-zinc-950 dark:text-white group-hover:text-blue-500 transition-colors">
                    Instagram
                  </h3>
                  <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                    Reels, Posts & IGTV Videos
                  </p>
                </div>

                {/* Feature Checkpoints */}
                <div className="space-y-2.5 pt-2">
                  <div className="flex items-center gap-2.5 text-xs sm:text-sm text-zinc-700 dark:text-zinc-300 font-medium">
                    <CheckCircle2 className="h-4 w-4 text-blue-500 dark:text-blue-400 shrink-0" />
                    <span>Instant Reel & Post Video Extractor</span>
                  </div>
                  <div className="flex items-center gap-2.5 text-xs sm:text-sm text-zinc-700 dark:text-zinc-300 font-medium">
                    <CheckCircle2 className="h-4 w-4 text-blue-500 dark:text-blue-400 shrink-0" />
                    <span>Original Audio & HD Quality (1080p)</span>
                  </div>
                  <div className="flex items-center gap-2.5 text-xs sm:text-sm text-zinc-700 dark:text-zinc-300 font-medium">
                    <CheckCircle2 className="h-4 w-4 text-blue-500 dark:text-blue-400 shrink-0" />
                    <span>One-Click MP4 Direct Downloader</span>
                  </div>
                  <div className="flex items-center gap-2.5 text-xs sm:text-sm text-zinc-700 dark:text-zinc-300 font-medium">
                    <CheckCircle2 className="h-4 w-4 text-blue-500 dark:text-blue-400 shrink-0" />
                    <span>No Login or Account Needed</span>
                  </div>
                </div>

                {/* Supported Domains */}
                <div className="pt-2">
                  <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-2">Supported Links</p>
                  <div className="flex flex-wrap gap-1.5">
                    {["instagram.com/reel/", "instagram.com/p/", "instagram.com/tv/", "instagr.am"].map((dom) => (
                      <span key={dom} className="px-2.5 py-1 rounded-md text-[11px] font-semibold bg-zinc-200/70 dark:bg-[#1a1a24] text-zinc-700 dark:text-zinc-300 border border-zinc-300/40 dark:border-[#272737]">
                        {dom}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Action Button */}
              <div className="pt-6 mt-6 border-t border-zinc-200/80 dark:border-[#222230]">
                <button
                  type="button"
                  onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
                  className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-md shadow-blue-600/20 transition-all cursor-pointer"
                >
                  <span>Use Instagram Player</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* CARD 3: Spotify */}
            <div className="group relative p-7 sm:p-8 rounded-[28px] bg-zinc-50 dark:bg-[#121217] border border-zinc-200 dark:border-[#262633] hover:border-[#1DB954]/50 dark:hover:border-[#1DB954]/50 transition-all duration-300 flex flex-col justify-between shadow-xs hover:shadow-xl">
              <div className="space-y-5">
                <div className="flex items-center justify-between">
                  <img 
                    src="/providers/spotify.png" 
                    alt="Spotify Logo" 
                    className="h-12 w-auto sm:h-14 object-contain group-hover:scale-105 transition-transform"
                  />
                  <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold bg-zinc-100 dark:bg-[#181822] text-zinc-800 dark:text-zinc-200 border border-zinc-300/80 dark:border-[#28283a]">
                    <span className="h-2 w-2 rounded-full bg-[#1DB954]"></span>
                    Live & Bypassed
                  </span>
                </div>

                <div>
                  <h3 className="text-xl sm:text-2xl font-black text-zinc-950 dark:text-white group-hover:text-[#1DB954] transition-colors">
                    Spotify
                  </h3>
                  <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                    Tracks, Songs & Cloud Music
                  </p>
                </div>

                {/* Feature Checkpoints */}
                <div className="space-y-2.5 pt-2">
                  <div className="flex items-center gap-2.5 text-xs sm:text-sm text-zinc-700 dark:text-zinc-300 font-medium">
                    <CheckCircle2 className="h-4 w-4 text-[#1DB954] shrink-0" />
                    <span>Full-Length 320 kbps AAC Audio</span>
                  </div>
                  <div className="flex items-center gap-2.5 text-xs sm:text-sm text-zinc-700 dark:text-zinc-300 font-medium">
                    <CheckCircle2 className="h-4 w-4 text-[#1DB954] shrink-0" />
                    <span>100% Full-Length Stream (No 30s Cut)</span>
                  </div>
                  <div className="flex items-center gap-2.5 text-xs sm:text-sm text-zinc-700 dark:text-zinc-300 font-medium">
                    <CheckCircle2 className="h-4 w-4 text-[#1DB954] shrink-0" />
                    <span>One-Click MP4/M4A Direct Downloader</span>
                  </div>
                  <div className="flex items-center gap-2.5 text-xs sm:text-sm text-zinc-700 dark:text-zinc-300 font-medium">
                    <CheckCircle2 className="h-4 w-4 text-[#1DB954] shrink-0" />
                    <span>No Spotify Premium / Login Required</span>
                  </div>
                </div>

                {/* Supported Domains */}
                <div className="pt-2">
                  <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-2">Supported Links</p>
                  <div className="flex flex-wrap gap-1.5">
                    {["open.spotify.com/track/", "spotify.link/", "spotify:track:"].map((dom) => (
                      <span key={dom} className="px-2.5 py-1 rounded-md text-[11px] font-semibold bg-zinc-200/70 dark:bg-[#1a1a24] text-zinc-700 dark:text-zinc-300 border border-zinc-300/40 dark:border-[#272737]">
                        {dom}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Action Button */}
              <div className="pt-6 mt-6 border-t border-zinc-200/80 dark:border-[#222230]">
                <button
                  type="button"
                  onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
                  className="w-full py-3 px-4 rounded-xl bg-[#1DB954] hover:bg-[#1aa34a] text-white font-bold text-sm flex items-center justify-center gap-2 shadow-md shadow-[#1DB954]/20 transition-all cursor-pointer"
                >
                  <span>Use Spotify Player</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* CARD 4: DiskWala */}
            <div className="group relative p-7 sm:p-8 rounded-[28px] bg-zinc-50 dark:bg-[#121217] border border-zinc-200 dark:border-[#262633] hover:border-blue-500/50 dark:hover:border-blue-500/50 transition-all duration-300 flex flex-col justify-between shadow-xs hover:shadow-xl">
              <div className="space-y-5">
                <div className="flex items-center justify-between">
                  <img 
                    src="/providers/diskwala.png" 
                    alt="DiskWala Logo" 
                    className="h-12 w-auto sm:h-14 object-contain group-hover:scale-105 transition-transform"
                  />
                  <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold bg-zinc-100 dark:bg-[#181822] text-zinc-800 dark:text-zinc-200 border border-zinc-300/80 dark:border-[#28283a]">
                    <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
                    Cloud Storage
                  </span>
                </div>

                <div>
                  <h3 className="text-xl sm:text-2xl font-black text-zinc-950 dark:text-white group-hover:text-blue-500 transition-colors">
                    DiskWala
                  </h3>
                  <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                    Fast Cloud Storage & Direct Files
                  </p>
                </div>

                {/* Feature Checkpoints */}
                <div className="space-y-2.5 pt-2">
                  <div className="flex items-center gap-2.5 text-xs sm:text-sm text-zinc-700 dark:text-zinc-300 font-medium">
                    <CheckCircle2 className="h-4 w-4 text-blue-500 dark:text-blue-400 shrink-0" />
                    <span>Instant Cloud Video Stream Playback</span>
                  </div>
                  <div className="flex items-center gap-2.5 text-xs sm:text-sm text-zinc-700 dark:text-zinc-300 font-medium">
                    <CheckCircle2 className="h-4 w-4 text-blue-500 dark:text-blue-400 shrink-0" />
                    <span>Zero Buffering & Direct CDN Speed</span>
                  </div>
                  <div className="flex items-center gap-2.5 text-xs sm:text-sm text-zinc-700 dark:text-zinc-300 font-medium">
                    <CheckCircle2 className="h-4 w-4 text-blue-500 dark:text-blue-400 shrink-0" />
                    <span>Full File Download Acceleration</span>
                  </div>
                  <div className="flex items-center gap-2.5 text-xs sm:text-sm text-zinc-700 dark:text-zinc-300 font-medium">
                    <CheckCircle2 className="h-4 w-4 text-blue-500 dark:text-blue-400 shrink-0" />
                    <span>Encrypted & Safe Media Streaming</span>
                  </div>
                </div>

                {/* Supported Domains */}
                <div className="pt-2">
                  <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-2">Supported Domains</p>
                  <div className="flex flex-wrap gap-1.5">
                    {["diskwala.com", "disk.diskwala.com"].map((dom) => (
                      <span key={dom} className="px-2.5 py-1 rounded-md text-[11px] font-semibold bg-zinc-200/70 dark:bg-[#1a1a24] text-zinc-700 dark:text-zinc-300 border border-zinc-300/40 dark:border-[#272737]">
                        {dom}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Action Button */}
              <div className="pt-6 mt-6 border-t border-zinc-200/80 dark:border-[#222230]">
                <button
                  type="button"
                  onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
                  className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-md shadow-blue-600/20 transition-all cursor-pointer"
                >
                  <span>Use DiskWala Player</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>

          </div>

          {/* Request a Platform Banner */}
          <div className="p-6 sm:p-8 rounded-[24px] bg-gradient-to-r from-blue-900/10 via-purple-900/10 to-indigo-900/10 dark:from-blue-950/40 dark:via-purple-950/40 dark:to-indigo-950/40 border border-blue-500/20 flex flex-col sm:flex-row items-center justify-between gap-5 text-center sm:text-left">
            <div className="space-y-1">
              <h4 className="text-lg sm:text-xl font-bold text-zinc-950 dark:text-white flex items-center justify-center sm:justify-start gap-2">
                <Sparkles className="h-5 w-5 text-amber-400" />
                <span>Want Another Platform Supported?</span>
              </h4>
              <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400">
                We are actively adding Google Drive, Mega.nz, YouTube, and MediaFire. Let us know which one you need next!
              </p>
            </div>
            <a
              href="https://t.me/"
              target="_blank"
              rel="noopener noreferrer"
              className="px-5 py-2.5 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 font-bold text-xs sm:text-sm hover:scale-105 transition-transform whitespace-nowrap cursor-pointer shadow-md"
            >
              Request a Platform →
            </a>
          </div>
        </section>

        {/* SECTION: Advanced Player Technology (iTeraPlay Tech Architecture) */}
        <section className="p-8 sm:p-12 md:p-14 rounded-[32px] bg-white dark:bg-[#18181f] border border-zinc-200 dark:border-[#272733] shadow-2xl">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center">
            
            {/* Left Column: Tech Features */}
            <div className="lg:col-span-7 space-y-6">
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-zinc-950 dark:text-white tracking-tight">
                Advanced Player Technology
              </h2>
              <p className="text-base sm:text-lg text-zinc-600 dark:text-zinc-400 leading-relaxed font-medium">
                Experience the power of our cutting-edge cloud video streaming technology. OnlinePlayer connects directly to high-speed media streams to ensure seamless connectivity, adaptive resolution, and uninterrupted video playback.
              </p>

              <div className="space-y-4 pt-2">
                {/* Feature 1 */}
                <div className="flex items-start gap-3.5">
                  <div className="h-2 w-2 rounded-full bg-blue-500 mt-2 shrink-0"></div>
                  <div>
                    <h4 className="text-base font-bold text-zinc-950 dark:text-white">
                      Smart Link Processing
                    </h4>
                    <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed mt-0.5">
                      Automatically detects and extracts playable streams from cloud links with 99.9% accuracy.
                    </p>
                  </div>
                </div>

                {/* Feature 2 */}
                <div className="flex items-start gap-3.5">
                  <div className="h-2 w-2 rounded-full bg-blue-500 mt-2 shrink-0"></div>
                  <div>
                    <h4 className="text-base font-bold text-zinc-950 dark:text-white">
                      Multi-Server Edge Network
                    </h4>
                    <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed mt-0.5">
                      Leverages distributed high-speed nodes to ensure continuous, uninterrupted streaming.
                    </p>
                  </div>
                </div>

                {/* Feature 3 */}
                <div className="flex items-start gap-3.5">
                  <div className="h-2 w-2 rounded-full bg-blue-500 mt-2 shrink-0"></div>
                  <div>
                    <h4 className="text-base font-bold text-zinc-950 dark:text-white">
                      Adaptive Quality
                    </h4>
                    <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed mt-0.5">
                      Dynamically optimizes playback from 360p up to crisp 1080p based on your internet connection speed.
                    </p>
                  </div>
                </div>

                {/* Feature 4 */}
                <div className="flex items-start gap-3.5">
                  <div className="h-2 w-2 rounded-full bg-blue-500 mt-2 shrink-0"></div>
                  <div>
                    <h4 className="text-base font-bold text-zinc-950 dark:text-white">
                      Zero Buffering & No Cutoffs
                    </h4>
                    <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed mt-0.5">
                      Advanced streaming pipeline bypasses 30-second preview limitations and eliminates buffering lag.
                    </p>
                  </div>
                </div>

                {/* Feature 5 */}
                <div className="flex items-start gap-3.5">
                  <div className="h-2 w-2 rounded-full bg-emerald-500 mt-2 shrink-0"></div>
                  <div>
                    <h4 className="text-base font-bold text-zinc-950 dark:text-white flex items-center gap-2">
                      <span>100% Free & No Login Required</span>
                      <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                        Zero Accounts
                      </span>
                    </h4>
                    <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed mt-0.5">
                      No registration walls, no login passwords, and no user tracking. Enjoy private and anonymous access without storing any personal data.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Why We Stand Out Stats Cards */}
            <div className="lg:col-span-5 p-7 sm:p-9 rounded-[28px] bg-zinc-50 dark:bg-[#121217] border border-zinc-200 dark:border-[#262633] space-y-4 sm:space-y-5">
              <h3 className="text-xl sm:text-2xl font-black text-zinc-950 dark:text-white">
                Why We Stand Out
              </h3>

              {/* Stat 1 */}
              <div className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-[#181822] border border-zinc-200 dark:border-[#262638] space-y-1.5 shadow-2xs">
                <div className="text-[11px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
                  Processing Speed
                </div>
                <div className="flex items-baseline gap-2.5">
                  <span className="text-3xl sm:text-4xl font-black text-zinc-950 dark:text-white tracking-tight">
                    3x
                  </span>
                  <span className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 font-medium">
                    Faster than competitors
                  </span>
                </div>
              </div>

              {/* Stat 2 */}
              <div className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-[#181822] border border-zinc-200 dark:border-[#262638] space-y-1.5 shadow-2xs">
                <div className="text-[11px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
                  Uptime & Reliability
                </div>
                <div className="flex items-baseline gap-2.5">
                  <span className="text-3xl sm:text-4xl font-black text-zinc-950 dark:text-white tracking-tight">
                    99.9%
                  </span>
                  <span className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 font-medium">
                    Reliable continuous access
                  </span>
                </div>
              </div>

              {/* Stat 3 */}
              <div className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-[#181822] border border-zinc-200 dark:border-[#262638] space-y-1.5 shadow-2xs">
                <div className="text-[11px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
                  Privacy & Data Safety
                </div>
                <div className="flex items-baseline gap-2.5">
                  <span className="text-3xl sm:text-4xl font-black text-zinc-950 dark:text-white tracking-tight">
                    100%
                  </span>
                  <span className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 font-medium">
                    No login, zero data storage
                  </span>
                </div>
              </div>
            </div>

          </div>
        </section>

        {/* SECTION 1: How to Use the Online Player */}
        <section id="how-it-works" className="p-8 sm:p-12 md:p-16 rounded-[32px] bg-white dark:bg-[#18181f] border border-zinc-200 dark:border-[#272733] shadow-2xl text-center space-y-10">
          <div className="space-y-5 max-w-4xl mx-auto">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-zinc-950 dark:text-white tracking-tight">
              How to Use OnlinePlayer
            </h2>

            <div className="text-base sm:text-lg text-zinc-600 dark:text-zinc-400 space-y-4 leading-relaxed">
              <p>
                <strong className="text-zinc-950 dark:text-white font-black">Tired of complicated apps & restrictions?</strong> We&apos;ve been there too! That&apos;s exactly why we created this{" "}
                <strong className="text-zinc-950 dark:text-white font-black">Universal Cloud Video Player & Downloader</strong> to make your life effortless. Just paste any link and enjoy instant, full-length high-speed streaming without installing external software.
              </p>
              <p>
                Whether it&apos;s a long movie on TeraBox, a reel on Instagram, or a cloud drive video, our streaming engine bypasses preview limits and delivers uninterrupted HD playback.
              </p>
            </div>
          </div>

          <div className="pt-6">
            <h3 className="text-2xl sm:text-3xl font-black text-zinc-950 dark:text-white mb-8">
              Here&apos;s How It Works
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8 text-left">
              {/* Step 1 Card */}
              <div className="p-8 sm:p-10 rounded-[26px] bg-zinc-50 dark:bg-[#121217] border border-zinc-200 dark:border-[#262633] space-y-5 hover:border-blue-500 dark:hover:border-blue-500 transition-colors">
                <span className="inline-block px-4 py-1.5 rounded-full text-xs font-black tracking-wider uppercase text-white bg-blue-600">
                  Step 1
                </span>
                <div className="p-4 rounded-2xl bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 w-fit">
                  <Copy className="h-7 w-7" strokeWidth={2.4} />
                </div>
                <h4 className="text-xl sm:text-2xl font-black text-zinc-950 dark:text-white">
                  Find & Copy
                </h4>
                <p className="text-sm sm:text-base text-zinc-600 dark:text-zinc-400 leading-relaxed">
                  Find your video on TeraBox, Instagram, DiskWala, or direct cloud link and copy its URL.
                </p>
              </div>

              {/* Step 2 Card */}
              <div className="p-8 sm:p-10 rounded-[26px] bg-zinc-50 dark:bg-[#121217] border border-zinc-200 dark:border-[#262633] space-y-5 hover:border-indigo-500 dark:hover:border-indigo-500 transition-colors">
                <span className="inline-block px-4 py-1.5 rounded-full text-xs font-black tracking-wider uppercase text-white bg-indigo-600">
                  Step 2
                </span>
                <div className="p-4 rounded-2xl bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 w-fit">
                  <PlayCircle className="h-7 w-7" strokeWidth={2.4} />
                </div>
                <h4 className="text-xl sm:text-2xl font-black text-zinc-950 dark:text-white">
                  Paste & Play
                </h4>
                <p className="text-sm sm:text-base text-zinc-600 dark:text-zinc-400 leading-relaxed">
                  Paste it in the box above. Click &apos;Play&apos; and your high-definition video starts playing instantly!
                </p>
              </div>

              {/* Step 3 Card */}
              <div className="p-8 sm:p-10 rounded-[26px] bg-zinc-50 dark:bg-[#121217] border border-zinc-200 dark:border-[#262633] space-y-5 hover:border-sky-500 dark:hover:border-sky-500 transition-colors">
                <span className="inline-block px-4 py-1.5 rounded-full text-xs font-black tracking-wider uppercase text-white bg-sky-600">
                  Step 3
                </span>
                <div className="p-4 rounded-2xl bg-sky-100 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 w-fit">
                  <Download className="h-7 w-7" strokeWidth={2.4} />
                </div>
                <h4 className="text-xl sm:text-2xl font-black text-zinc-950 dark:text-white">
                  Stream or Download
                </h4>
                <p className="text-sm sm:text-base text-zinc-600 dark:text-zinc-400 leading-relaxed">
                  Enjoy custom playback speed & subtitle support, or hit &apos;Download&apos; to save directly to your storage.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 2: Why Choose OnlinePlayer? */}
        <section id="features" className="p-8 sm:p-12 md:p-16 rounded-[32px] bg-white dark:bg-[#18181f] border border-zinc-200 dark:border-[#272733] shadow-2xl text-center space-y-10">
          <div className="space-y-3">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-zinc-950 dark:text-white tracking-tight">
              Why Choose OnlinePlayer?
            </h2>
            <p className="text-base sm:text-lg text-zinc-600 dark:text-zinc-400 font-medium">
              The fastest and most reliable <strong className="text-zinc-950 dark:text-white">universal cloud streaming</strong> platform.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 text-center">
            {/* Feature 1 */}
            <div className="p-8 rounded-[26px] bg-zinc-50 dark:bg-[#121217] border border-zinc-200 dark:border-[#262633] flex flex-col items-center space-y-4 hover:border-purple-500 dark:hover:border-purple-500 transition-colors">
              <div className="h-16 w-16 rounded-2xl bg-purple-100 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                <Film className="h-8 w-8" strokeWidth={2.4} />
              </div>
              <h4 className="text-lg sm:text-xl font-black text-zinc-950 dark:text-white">
                Multi-Cloud Support
              </h4>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
                Stream videos from TeraBox, Instagram, DiskWala, and direct HLS streams in one single place.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="p-8 rounded-[26px] bg-zinc-50 dark:bg-[#121217] border border-zinc-200 dark:border-[#262633] flex flex-col items-center space-y-4 hover:border-blue-500 dark:hover:border-blue-500 transition-colors">
              <div className="h-16 w-16 rounded-2xl bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                <Smartphone className="h-8 w-8" strokeWidth={2.4} />
              </div>
              <h4 className="text-lg sm:text-xl font-black text-zinc-950 dark:text-white">
                Works Everywhere
              </h4>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
                Optimized for phones, tablets, laptops, and smart TVs with responsive gestures and keyboard controls.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="p-8 rounded-[26px] bg-zinc-50 dark:bg-[#121217] border border-zinc-200 dark:border-[#262633] flex flex-col items-center space-y-4 hover:border-amber-500 dark:hover:border-amber-500 transition-colors">
              <div className="h-16 w-16 rounded-2xl bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                <Zap className="h-8 w-8" strokeWidth={2.4} />
              </div>
              <h4 className="text-lg sm:text-xl font-black text-zinc-950 dark:text-white">
                Ultra-Fast Resolving
              </h4>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
                Cloudflare Edge integration resolves streams in 1-2 seconds with zero buffering.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="p-8 rounded-[26px] bg-zinc-50 dark:bg-[#121217] border border-zinc-200 dark:border-[#262633] flex flex-col items-center space-y-4 hover:border-emerald-500 dark:hover:border-emerald-500 transition-colors">
              <div className="h-16 w-16 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <Lock className="h-8 w-8" strokeWidth={2.4} />
              </div>
              <h4 className="text-lg sm:text-xl font-black text-zinc-950 dark:text-white">
                100% Free & Unlimited
              </h4>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
                Completely unrestricted fair use with no account required and no hidden subscriptions.
              </p>
            </div>
          </div>
        </section>

        {/* SECTION 3: Why I Built OnlinePlayer */}
        <section className="p-8 sm:p-12 md:p-16 rounded-[32px] bg-white dark:bg-[#18181f] border border-zinc-200 dark:border-[#272733] shadow-2xl">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center">
            
            {/* Left Story Column */}
            <div className="lg:col-span-7 space-y-6">
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-zinc-950 dark:text-white tracking-tight">
                Why We Built OnlinePlayer
              </h2>

              <div className="text-base sm:text-lg text-zinc-600 dark:text-zinc-400 space-y-4 leading-relaxed">
                <p>
                  Here&apos;s the truth - we got exhausted by spammy download sites with fake buttons, popups, and 30-second cutoffs. We wanted a clean, honest <strong className="text-zinc-950 dark:text-white font-black">Universal Online Video Player</strong> that simply works.
                </p>
                <p>
                  So we built OnlinePlayer. Unlike other tools, our video engine connects directly to high-speed cloud streams. No registration walls, no redirects, and no invasive trackers.
                </p>
                <p>
                  Use it to binge-watch movies, stream videos with friends, or download large files directly at maximum connection speed.
                </p>
              </div>
            </div>

            {/* Right Features Box */}
            <div className="lg:col-span-5 p-8 sm:p-10 rounded-[28px] bg-zinc-50 dark:bg-[#121217] border border-zinc-200 dark:border-[#262633] space-y-6">
              <h3 className="text-xl sm:text-2xl font-black text-zinc-950 dark:text-white">
                Why You&apos;ll Love It
              </h3>

              <div className="space-y-5 text-sm sm:text-base">
                <div className="flex items-center gap-3.5">
                  <div className="p-1.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 shrink-0">
                    <Check className="h-4 w-4" strokeWidth={3} />
                  </div>
                  <div className="flex items-center gap-2.5 text-zinc-800 dark:text-zinc-200 font-medium">
                    <Rocket className="h-5 w-5 text-purple-500 shrink-0" strokeWidth={2.4} />
                    <span><strong>Lightning Fast:</strong> Resolves cloud links in 1-2 seconds</span>
                  </div>
                </div>

                <div className="flex items-center gap-3.5">
                  <div className="p-1.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 shrink-0">
                    <Check className="h-4 w-4" strokeWidth={3} />
                  </div>
                  <div className="flex items-center gap-2.5 text-zinc-800 dark:text-zinc-200 font-medium">
                    <Film className="h-5 w-5 text-indigo-500 shrink-0" strokeWidth={2.4} />
                    <span><strong>Stream or Download:</strong> Your choice with instant full access</span>
                  </div>
                </div>

                <div className="flex items-center gap-3.5">
                  <div className="p-1.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 shrink-0">
                    <Check className="h-4 w-4" strokeWidth={3} />
                  </div>
                  <div className="flex items-center gap-2.5 text-zinc-800 dark:text-zinc-200 font-medium">
                    <ShieldCheck className="h-5 w-5 text-blue-500 shrink-0" strokeWidth={2.4} />
                    <span><strong>Clean Experience:</strong> No intrusive ads or popup redirects</span>
                  </div>
                </div>

                <div className="flex items-center gap-3.5">
                  <div className="p-1.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 shrink-0">
                    <Check className="h-4 w-4" strokeWidth={3} />
                  </div>
                  <div className="flex items-center gap-2.5 text-zinc-800 dark:text-zinc-200 font-medium">
                    <Lock className="h-5 w-5 text-emerald-500 shrink-0" strokeWidth={2.4} />
                    <span><strong>Zero Limits:</strong> No daily caps and no forced signups</span>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </section>

        {/* SECTION 4: Works On Everything (Seriously) */}
        <section className="p-8 sm:p-12 md:p-16 rounded-[32px] bg-white dark:bg-[#18181f] border border-zinc-200 dark:border-[#272733] shadow-2xl text-center space-y-10">
          <div className="space-y-3">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-zinc-950 dark:text-white tracking-tight">
              Works On Everything (Seriously)
            </h2>
            <p className="text-base sm:text-lg text-zinc-600 dark:text-zinc-400 font-medium">
              Seamlessly streams on mobile, tablets, and provides high-speed downloads on PC.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8 text-left">
            {/* Phone */}
            <div className="p-8 sm:p-10 rounded-[26px] bg-zinc-50 dark:bg-[#121217] border border-zinc-200 dark:border-[#262633] space-y-4 hover:border-blue-500 dark:hover:border-blue-500 transition-colors">
              <div className="text-blue-500">
                <Smartphone className="h-8 w-8" strokeWidth={2.4} />
              </div>
              <h4 className="text-xl sm:text-2xl font-black text-zinc-950 dark:text-white">
                On Your Phone
              </h4>
              <p className="text-sm sm:text-base text-zinc-600 dark:text-zinc-400 leading-relaxed">
                Perfect for streaming on the go. Big buttons, touch gestures, and smooth mobile controls.
              </p>
            </div>

            {/* Tablet */}
            <div className="p-8 sm:p-10 rounded-[26px] bg-zinc-50 dark:bg-[#121217] border border-zinc-200 dark:border-[#262633] space-y-4 hover:border-blue-500 dark:hover:border-blue-500 transition-colors">
              <div className="text-blue-500">
                <Tablet className="h-8 w-8" strokeWidth={2.4} />
              </div>
              <h4 className="text-xl sm:text-2xl font-black text-zinc-950 dark:text-white">
                On Tablets
              </h4>
              <p className="text-sm sm:text-base text-zinc-600 dark:text-zinc-400 leading-relaxed">
                Enjoy movies on iPad or Android tablets. Crisp HD streaming looks stunning on high-res displays.
              </p>
            </div>

            {/* Computer */}
            <div className="p-8 sm:p-10 rounded-[26px] bg-zinc-50 dark:bg-[#121217] border border-zinc-200 dark:border-[#262633] space-y-4 hover:border-blue-500 dark:hover:border-blue-500 transition-colors">
              <div className="text-blue-500">
                <Monitor className="h-8 w-8" strokeWidth={2.4} />
              </div>
              <h4 className="text-xl sm:text-2xl font-black text-zinc-950 dark:text-white">
                On Computers
              </h4>
              <p className="text-sm sm:text-base text-zinc-600 dark:text-zinc-400 leading-relaxed">
                Full power with keyboard shortcuts (Space, seek, volume, F for fullscreen) and uncapped download speeds.
              </p>
            </div>
          </div>
        </section>

        {/* SECTION 5: Common Questions (iTeraPlay Style Accordion) */}
        <section id="faq" className="p-8 sm:p-12 md:p-16 rounded-[32px] bg-white dark:bg-[#18181f] border border-zinc-200 dark:border-[#272733] shadow-2xl space-y-10 scroll-mt-24">
          <div className="space-y-3 text-center max-w-3xl mx-auto">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-zinc-950 dark:text-white tracking-tight">
              Common Questions
            </h2>
            <p className="text-base sm:text-lg text-zinc-600 dark:text-zinc-400 font-medium">
              Quick answers to help you get started with OnlinePlayer.
            </p>
          </div>

          <div className="max-w-4xl mx-auto space-y-3.5">
            {FAQ_ITEMS.map((faq, idx) => {
              const isOpen = openFaqIndex === idx;
              return (
                <div
                  key={idx}
                  className="rounded-2xl bg-zinc-50 dark:bg-[#121217] border border-zinc-200 dark:border-[#262633] transition-colors overflow-hidden"
                >
                  <button
                    type="button"
                    onClick={() => setOpenFaqIndex(isOpen ? null : idx)}
                    className="w-full p-5 sm:p-6 text-left flex items-center justify-between gap-4 font-bold text-base sm:text-lg text-zinc-950 dark:text-white cursor-pointer select-none transition-colors hover:text-blue-500"
                  >
                    <span>{faq.question}</span>
                    <ChevronDown
                      className={`h-5 w-5 text-zinc-400 shrink-0 transition-transform duration-200 ${
                        isOpen ? "rotate-180 text-blue-500" : ""
                      }`}
                      strokeWidth={2.4}
                    />
                  </button>
                  {isOpen && (
                    <div className="px-5 pb-5 sm:px-6 sm:pb-6 text-sm sm:text-base text-zinc-600 dark:text-zinc-400 leading-relaxed border-t border-zinc-200/60 dark:border-[#222230] pt-3">
                      {faq.answer}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

      </main>

      {/* Floating Telegram Support Button */}
      <a
        href="https://t.me/"
        target="_blank"
        rel="noreferrer"
        className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full bg-[#0088cc] hover:bg-[#0077b5] text-white shadow-xl shadow-sky-500/30 flex items-center justify-center hover:scale-110 active:scale-95 transition-all group"
        title="Join Telegram Community & Support"
        aria-label="Telegram"
      >
        <Send className="h-6 w-6 fill-white stroke-white ml-0.5 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 transition-transform" strokeWidth={2} />
      </a>

      {/* Clean Footer */}
      <footer className="w-full border-t border-zinc-200 dark:border-[#262633] py-10 text-center text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 bg-white/50 dark:bg-black/20">
        <div className="max-w-[1360px] mx-auto px-4 space-y-2.5">
          <div className="flex items-center justify-center gap-2">
            <img src="/logo.png" alt="OnlinePlayer" className="h-6 w-6 object-contain" />
            <p className="font-extrabold text-zinc-900 dark:text-zinc-100 text-sm">
              OnlinePlayer
            </p>
          </div>
          <p className="font-semibold text-zinc-700 dark:text-zinc-300 text-xs">
            Universal High-Speed Cloud Stream Engine & Downloader
          </p>
          <p className="text-xs text-zinc-500 dark:text-zinc-500">
            OnlinePlayer does not host or store any video files on its servers. All media content is resolved directly through official cloud storage streams.
          </p>
        </div>
      </footer>

      {/* Keyboard Shortcuts Modal */}
      <ShortcutsModal
        isOpen={isShortcutsOpen}
        onClose={() => setIsShortcutsOpen(false)}
      />
    </div>
  );
}
