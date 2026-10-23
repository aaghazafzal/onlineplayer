"use client";

import React, { useState, useEffect } from "react";
import { 
  Play, 
  Download, 
  ClipboardPaste, 
  X, 
  Loader2, 
  HardDrive, 
  Camera, 
  Radio, 
  Zap,
  Sparkles
} from "lucide-react";

interface UrlInputBarProps {
  onResolve: (url: string, autoDownload?: boolean) => void;
  isLoading: boolean;
  initialUrl?: string;
}

export type ProviderTab = "all" | "terabox" | "instagram" | "spotify" | "diskwala" | "direct";

export const UrlInputBar: React.FC<UrlInputBarProps> = ({
  onResolve,
  isLoading,
  initialUrl = "",
}) => {
  const [inputUrl, setInputUrl] = useState(initialUrl);
  const [activeTab, setActiveTab] = useState<ProviderTab>("all");

  // Auto-detect provider from user input if not on a specific manual tab
  useEffect(() => {
    const val = inputUrl.trim().toLowerCase();
    if (!val) {
      return;
    }

    if (
      val.includes("terabox") || 
      val.includes("1024tera") || 
      val.includes("dubox") || 
      val.includes("nephobox") || 
      val.includes("mirrobox") || 
      val.includes("momerybox") ||
      val.includes("surl=") ||
      val.includes("/s/1")
    ) {
      if (activeTab !== "all") setActiveTab("terabox");
    } else if (val.includes("instagram.com") || val.includes("instagr.am")) {
      if (activeTab !== "all") setActiveTab("instagram");
    } else if (val.includes("spotify.com") || val.includes("spotify.link") || val.startsWith("spotify:track:")) {
      if (activeTab !== "all") setActiveTab("spotify");
    } else if (val.includes("diskwala") || val.includes("disk") || val.includes("disko")) {
      if (activeTab !== "all") setActiveTab("diskwala");
    } else if (val.endsWith(".m3u8") || val.endsWith(".mp4")) {
      if (activeTab !== "all") setActiveTab("direct");
    }
  }, [inputUrl, activeTab]);

  const handlePlayClick = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputUrl.trim() || isLoading) return;
    onResolve(inputUrl.trim(), false);
  };

  const handleDownloadClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!inputUrl.trim() || isLoading) return;
    onResolve(inputUrl.trim(), true);
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setInputUrl(text.trim());
      }
    } catch (err) {
      console.warn("Clipboard access not available:", err);
    }
  };

  const handleClear = () => {
    setInputUrl("");
  };

  const getPlaceholder = () => {
    switch (activeTab) {
      case "terabox":
        return "Paste your TeraBox link here (1024tera, terabox.app, dubox, nephobox)...";
      case "instagram":
        return "Paste your Instagram Reel or Post video link here...";
      case "spotify":
        return "Paste Spotify Track, Playlist, or Album link (open.spotify.com/...)...";
      case "diskwala":
        return "Paste your DiskWala link here (diskwala.com)...";
      case "direct":
        return "Paste direct MP4 or M3U8 video stream URL...";
      default:
        return "Paste any TeraBox, Instagram, or Spotify (Track / Playlist / Album) link here...";
    }
  };

  return (
    <div className="w-full max-w-5xl lg:max-w-6xl mx-auto space-y-5">
      
      {/* Main Extraction Card (IteraPlay Master Card) */}
      <div className="p-7 sm:p-10 md:p-12 rounded-[32px] bg-white dark:bg-[#18181f] border border-zinc-200 dark:border-[#272733] shadow-2xl shadow-zinc-950/5 dark:shadow-black/50 transition-all duration-200">
        
        {/* Provider Tabs Selector */}
        <div className="flex items-center gap-2 sm:gap-2.5 mb-6 overflow-x-auto pb-1 scrollbar-none">
          {/* ALL Tab */}
          <button
            type="button"
            onClick={() => setActiveTab("all")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === "all"
                ? "bg-blue-600 text-white shadow-md shadow-blue-600/25"
                : "bg-zinc-100 dark:bg-[#121217] text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white border border-zinc-200 dark:border-[#242430]"
            }`}
          >
            <Sparkles className="h-4 w-4" strokeWidth={2.4} />
            <span>All</span>
          </button>

          {/* TeraBox Tab */}
          <button
            type="button"
            onClick={() => setActiveTab("terabox")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === "terabox"
                ? "bg-blue-600 text-white shadow-md shadow-blue-600/25"
                : "bg-zinc-100 dark:bg-[#121217] text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white border border-zinc-200 dark:border-[#242430]"
            }`}
          >
            <img src="/providers/terabox.png" alt="TeraBox" className="h-4 w-4 object-contain" />
            <span>TeraBox</span>
          </button>

          {/* Instagram Tab */}
          <button
            type="button"
            onClick={() => setActiveTab("instagram")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === "instagram"
                ? "bg-blue-600 text-white shadow-md shadow-blue-600/25"
                : "bg-zinc-100 dark:bg-[#121217] text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white border border-zinc-200 dark:border-[#242430]"
            }`}
          >
            <img src="/providers/instagram.png" alt="Instagram" className="h-4 w-4 object-contain" />
            <span>Instagram</span>
          </button>

          {/* Spotify Tab */}
          <button
            type="button"
            onClick={() => setActiveTab("spotify")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === "spotify"
                ? "bg-blue-600 text-white shadow-md shadow-blue-600/25"
                : "bg-zinc-100 dark:bg-[#121217] text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white border border-zinc-200 dark:border-[#242430]"
            }`}
          >
            <img src="/providers/spotify.png" alt="Spotify" className="h-4 w-4 object-contain" />
            <span>Spotify</span>
          </button>

          {/* DiskWala Tab */}
          <button
            type="button"
            onClick={() => setActiveTab("diskwala")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === "diskwala"
                ? "bg-blue-600 text-white shadow-md shadow-blue-600/25"
                : "bg-zinc-100 dark:bg-[#121217] text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white border border-zinc-200 dark:border-[#242430]"
            }`}
          >
            <img src="/providers/diskwala.png" alt="DiskWala" className="h-4 w-4 object-contain" />
            <span>DiskWala</span>
          </button>

          {/* Direct Stream Tab */}
          <button
            type="button"
            onClick={() => setActiveTab("direct")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === "direct"
                ? "bg-blue-600 text-white shadow-md shadow-blue-600/25"
                : "bg-zinc-100 dark:bg-[#121217] text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white border border-zinc-200 dark:border-[#242430]"
            }`}
          >
            <Radio className="h-4 w-4" strokeWidth={2.4} />
            <span>Direct Stream</span>
          </button>
        </div>

        {/* Input Field with Internal PASTE Button */}
        <form onSubmit={handlePlayClick} className="space-y-6">
          <div className="relative flex items-center p-2 sm:p-2.5 rounded-2xl bg-zinc-50 dark:bg-[#121217] border border-zinc-300 dark:border-[#2c2c3a] focus-within:border-blue-500 dark:focus-within:border-blue-500 transition-all duration-150">
            <input
              type="text"
              value={inputUrl}
              onChange={(e) => setInputUrl(e.target.value)}
              placeholder={getPlaceholder()}
              className="w-full min-w-0 bg-transparent px-3 sm:px-4 py-3 sm:py-4 text-base sm:text-lg font-medium text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none"
              disabled={isLoading}
            />

            {/* Clear Input Button */}
            {inputUrl && (
              <button
                type="button"
                onClick={handleClear}
                className="p-2 mr-2 rounded-xl text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                title="Clear input"
              >
                <X className="h-4 w-4" strokeWidth={2.5} />
              </button>
            )}

            {/* Prominent Blue PASTE Button inside Input */}
            <button
              type="button"
              onClick={handlePaste}
              className="px-5 sm:px-6 py-3 rounded-xl text-xs sm:text-sm font-black text-white bg-[#2563eb] hover:bg-[#1d4ed8] shadow-md flex items-center gap-2 whitespace-nowrap active:scale-95 transition-all cursor-pointer"
            >
              <ClipboardPaste className="h-4 w-4" strokeWidth={2.4} />
              <span>PASTE</span>
            </button>
          </div>

          {/* Two Massive Action Buttons: Play (Indigo) and Download (Emerald) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
            
            {/* Play Button */}
            <button
              type="submit"
              disabled={isLoading || !inputUrl.trim()}
              className="w-full py-4.5 sm:py-5 px-8 rounded-2xl font-black text-base sm:text-xl text-white bg-[#4338ca] hover:bg-[#3730a3] disabled:opacity-50 disabled:cursor-not-allowed shadow-xl shadow-indigo-600/25 flex items-center justify-center gap-3 active:scale-[0.98] transition-all cursor-pointer"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-6 w-6 animate-spin" strokeWidth={2.5} />
                  <span>Loading Stream...</span>
                </>
              ) : (
                <>
                  <Play className="h-6 w-6 fill-white stroke-white" strokeWidth={2.4} />
                  <span>Play</span>
                </>
              )}
            </button>

            {/* Download Button */}
            <button
              type="button"
              onClick={handleDownloadClick}
              disabled={isLoading || !inputUrl.trim()}
              className="w-full py-4.5 sm:py-5 px-8 rounded-2xl font-black text-base sm:text-xl text-white bg-[#059669] hover:bg-[#047857] disabled:opacity-50 disabled:cursor-not-allowed shadow-xl shadow-emerald-600/25 flex items-center justify-center gap-3 active:scale-[0.98] transition-all cursor-pointer"
            >
              <Download className="h-6 w-6" strokeWidth={2.4} />
              <span>Download</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
