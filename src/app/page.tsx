"use client";

import React, { useState, useEffect } from "react";
import { Navbar } from "../components/Navbar";
import { UrlInputBar } from "../components/UrlInputBar";
import { VideoPlayer, StreamData } from "../components/VideoPlayer";
import { VideoMetaCard, FileItem } from "../components/VideoMetaCard";
import { RecentStreams, HistoryItem } from "../components/RecentStreams";
import { ShortcutsModal } from "../components/ShortcutsModal";
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
  Rocket
} from "lucide-react";

const WORKER_API_BASE = "https://terabox-player-api.onlineplayer.workers.dev";

export default function Home() {
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [streamData, setStreamData] = useState<StreamData | null>(null);
  const [filesList, setFilesList] = useState<FileItem[]>([]);
  const [currentFileIndex, setCurrentFileIndex] = useState(0);
  const [isCachedHit, setIsCachedHit] = useState(false);
  const [isTheaterMode, setIsTheaterMode] = useState(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([]);
  const [autoStartDownload, setAutoStartDownload] = useState(false);

  // Load history from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("onlineplayer_history") || localStorage.getItem("omni_history");
      if (saved) {
        setHistoryItems(JSON.parse(saved));
      }
    } catch (e) {
      console.warn("Failed to load history:", e);
    }
  }, []);

  const saveToHistory = (item: HistoryItem) => {
    try {
      const updated = [item, ...historyItems.filter((h) => h.surl !== item.surl)].slice(0, 12);
      setHistoryItems(updated);
      localStorage.setItem("onlineplayer_history", JSON.stringify(updated));
    } catch (e) {
      console.warn("Failed to save history:", e);
    }
  };

  const handleClearHistory = () => {
    setHistoryItems([]);
    localStorage.removeItem("onlineplayer_history");
    localStorage.removeItem("omni_history");
  };

  const handleRemoveHistoryItem = (surl: string) => {
    const updated = historyItems.filter((h) => h.surl !== surl);
    setHistoryItems(updated);
    localStorage.setItem("onlineplayer_history", JSON.stringify(updated));
  };

  const handleResolve = async (url: string, autoDownload = false) => {
    setIsLoading(true);
    setErrorMessage(null);

    // Direct HLS / MP4 link bypass
    if (url.endsWith(".m3u8") || url.endsWith(".mp4")) {
      const fileName = url.split("/").pop()?.split("?")[0] || "Direct Video Stream";
      const newStream: StreamData = {
        streamUrl: url,
        title: fileName,
        durationFormatted: "Direct Stream",
        sizeFormatted: "Live Stream",
      };
      setStreamData(newStream);
      setFilesList([]);
      setCurrentFileIndex(0);
      setIsLoading(false);
      setAutoStartDownload(autoDownload);

      setTimeout(() => {
        document.getElementById("player-container")?.scrollIntoView({ behavior: "smooth" });
      }, 150);
      return;
    }

    try {
      const targetApi = `${WORKER_API_BASE}/api/resolve?url=${encodeURIComponent(url)}`;
      const res = await fetch(targetApi);
      const data = await res.json();

      if (!res.ok || data.error || !data.ok) {
        throw new Error(data.error || "Could not resolve stream from link. The link may be private or invalid.");
      }

      if (!data.files || data.files.length === 0) {
        throw new Error("No playable video files found in this share link.");
      }

      const files: FileItem[] = data.files.map((f: any) => ({
        fs_id: f.fs_id,
        filename: f.filename || "Video.mp4",
        size_formatted: f.size_formatted || "Unknown",
        duration_formatted: f.duration_formatted || "",
        thumbnail: f.thumbnail || "",
        stream_url: f.stream_url,
        stream_url_360: f.stream_url_360,
      }));

      const activeFile = files[0];
      const newStream: StreamData = {
        streamUrl: activeFile.stream_url,
        streamUrl360: activeFile.stream_url_360,
        title: activeFile.filename,
        durationFormatted: activeFile.duration_formatted,
        sizeFormatted: activeFile.size_formatted,
        thumbnail: activeFile.thumbnail,
        surl: data.surl,
      };

      setFilesList(files);
      setCurrentFileIndex(0);
      setStreamData(newStream);
      setIsCachedHit(Boolean(data.cached));

      // Save to history
      if (data.surl) {
        saveToHistory({
          surl: data.surl,
          originalUrl: url,
          title: activeFile.filename,
          durationFormatted: activeFile.duration_formatted,
          sizeFormatted: activeFile.size_formatted,
          thumbnail: activeFile.thumbnail,
          streamUrl: activeFile.stream_url,
          playedAt: Date.now(),
        });
      }

      if (autoDownload) {
        setAutoStartDownload(true);
      } else {
        setAutoStartDownload(false);
      }

      setTimeout(() => {
        document.getElementById("player-container")?.scrollIntoView({ behavior: "smooth" });
      }, 150);

    } catch (err: any) {
      console.error("Resolve error:", err);
      setErrorMessage(err.message || "An unexpected error occurred while resolving video.");
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
            Stream and download TeraBox, Instagram, DiskPlayer, and direct cloud links instantly with zero limits & no ads.
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
            <div className="space-y-1">
              <p className="font-bold text-base">Unable to resolve video stream</p>
              <p className="text-xs sm:text-sm text-red-600 dark:text-red-400 leading-relaxed">{errorMessage}</p>
            </div>
          </div>
        )}

        {/* Active Player Section (Appears when video is loaded) */}
        {streamData && (
          <div id="player-container" className="space-y-8 pt-4 scroll-mt-24">
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
          </div>
        )}

        {/* Recent Streams History */}
        <RecentStreams
          items={historyItems}
          onPlayItem={handlePlayHistoryItem}
          onClearHistory={handleClearHistory}
          onRemoveItem={handleRemoveHistoryItem}
        />

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
                  Find your video on TeraBox, Instagram, DiskPlayer, or direct cloud link and copy its URL.
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
                Stream videos from TeraBox, Instagram, DiskPlayer, and direct HLS streams in one single place.
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
