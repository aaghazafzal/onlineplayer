"use client";

import React, { useState, useEffect } from "react";
import { 
  Play, 
  Download, 
  ClipboardPaste, 
  X, 
  Loader2, 
  Clock, 
  Sparkles, 
  HardDrive, 
  Camera, 
  Radio, 
  CheckCircle2, 
  Zap, 
  ShieldCheck 
} from "lucide-react";

interface UrlInputBarProps {
  onResolve: (url: string, autoDownload?: boolean) => void;
  isLoading: boolean;
  initialUrl?: string;
  onOpenAuth?: (mode: "login" | "signup") => void;
}

export type ProviderTab = "terabox" | "instagram" | "diskplayer" | "direct";

export const UrlInputBar: React.FC<UrlInputBarProps> = ({
  onResolve,
  isLoading,
  initialUrl = "",
  onOpenAuth,
}) => {
  const [inputUrl, setInputUrl] = useState(initialUrl);
  const [activeTab, setActiveTab] = useState<ProviderTab>("terabox");
  const [resolvedProvider, setResolvedProvider] = useState<ProviderTab | null>(null);

  // Auto-detect provider from user input
  useEffect(() => {
    const val = inputUrl.trim().toLowerCase();
    if (!val) {
      setResolvedProvider(null);
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
      setResolvedProvider("terabox");
      setActiveTab("terabox");
    } else if (val.includes("instagram.com") || val.includes("instagr.am")) {
      setResolvedProvider("instagram");
      setActiveTab("instagram");
    } else if (val.includes("disk") || val.includes("disko")) {
      setResolvedProvider("diskplayer");
      setActiveTab("diskplayer");
    } else if (val.endsWith(".m3u8") || val.endsWith(".mp4")) {
      setResolvedProvider("direct");
      setActiveTab("direct");
    }
  }, [inputUrl]);

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
    setResolvedProvider(null);
  };

  const getPlaceholder = () => {
    switch (activeTab) {
      case "instagram":
        return "Paste your Instagram Reel or Post link here...";
      case "diskplayer":
        return "Paste your DiskPlayer link here...";
      case "direct":
        return "Paste direct MP4 or M3U8 video stream URL...";
      default:
        return "Paste your TeraBox link here...";
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-4">
      
      {/* Main Extraction Card (IteraPlay Master Card) */}
      <div className="p-6 sm:p-8 md:p-10 rounded-3xl bg-white dark:bg-[#18181f] border border-zinc-200 dark:border-[#272733] shadow-2xl shadow-zinc-950/5 dark:shadow-black/50 transition-all duration-200">
        
        {/* Provider Tabs Selector */}
        <div className="flex items-center gap-1.5 sm:gap-2 mb-5 overflow-x-auto pb-1 scrollbar-none">
          <button
            type="button"
            onClick={() => setActiveTab("terabox")}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              activeTab === "terabox"
                ? "bg-blue-600 text-white shadow-md shadow-blue-600/20"
                : "bg-zinc-100 dark:bg-[#121217] text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white border border-zinc-200 dark:border-[#242430]"
            }`}
          >
            <HardDrive className="h-3.5 w-3.5" strokeWidth={2.4} />
            <span>TeraBox</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("instagram")}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              activeTab === "instagram"
                ? "bg-gradient-to-r from-pink-600 to-rose-600 text-white shadow-md shadow-pink-600/20"
                : "bg-zinc-100 dark:bg-[#121217] text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white border border-zinc-200 dark:border-[#242430]"
            }`}
          >
            <Camera className="h-3.5 w-3.5" strokeWidth={2.4} />
            <span>Instagram</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("diskplayer")}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              activeTab === "diskplayer"
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
                : "bg-zinc-100 dark:bg-[#121217] text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white border border-zinc-200 dark:border-[#242430]"
            }`}
          >
            <Zap className="h-3.5 w-3.5" strokeWidth={2.4} />
            <span>DiskPlayer</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("direct")}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              activeTab === "direct"
                ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/20"
                : "bg-zinc-100 dark:bg-[#121217] text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white border border-zinc-200 dark:border-[#242430]"
            }`}
          >
            <Radio className="h-3.5 w-3.5" strokeWidth={2.4} />
            <span>Direct Stream</span>
          </button>
        </div>

        {/* Input Field with Internal PASTE Button */}
        <form onSubmit={handlePlayClick} className="space-y-5">
          <div className="relative flex items-center p-2 rounded-2xl bg-zinc-50 dark:bg-[#121217] border border-zinc-300 dark:border-[#2c2c3a] focus-within:border-blue-500 dark:focus-within:border-blue-500 transition-all duration-150">
            <input
              type="text"
              value={inputUrl}
              onChange={(e) => setInputUrl(e.target.value)}
              placeholder={getPlaceholder()}
              className="w-full bg-transparent px-3 py-3 sm:py-3.5 text-sm sm:text-base font-medium text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none"
              disabled={isLoading}
            />

            {/* Clear Input Button */}
            {inputUrl && (
              <button
                type="button"
                onClick={handleClear}
                className="p-1.5 mr-2 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors"
                title="Clear input"
              >
                <X className="h-4 w-4" strokeWidth={2.5} />
              </button>
            )}

            {/* Prominent Blue PASTE Button inside Input */}
            <button
              type="button"
              onClick={handlePaste}
              className="px-4 sm:px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold text-white bg-[#2563eb] hover:bg-[#1d4ed8] shadow-sm flex items-center gap-1.5 whitespace-nowrap active:scale-95 transition-all"
            >
              <ClipboardPaste className="h-4 w-4" strokeWidth={2.4} />
              <span>PASTE</span>
            </button>
          </div>

          {/* Two Massive Action Buttons: Play (Indigo) and Download (Emerald) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 pt-1">
            
            {/* Play Button */}
            <button
              type="submit"
              disabled={isLoading || !inputUrl.trim()}
              className="w-full py-4 px-6 rounded-2xl font-bold text-base sm:text-lg text-white bg-[#4338ca] hover:bg-[#3730a3] disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-600/25 flex items-center justify-center gap-2.5 active:scale-[0.98] transition-all cursor-pointer"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" strokeWidth={2.5} />
                  <span>Loading Stream...</span>
                </>
              ) : (
                <>
                  <Play className="h-5 w-5 fill-white stroke-white" strokeWidth={2.4} />
                  <span>Play</span>
                </>
              )}
            </button>

            {/* Download Button */}
            <button
              type="button"
              onClick={handleDownloadClick}
              disabled={isLoading || !inputUrl.trim()}
              className="w-full py-4 px-6 rounded-2xl font-bold text-base sm:text-lg text-white bg-[#059669] hover:bg-[#047857] disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-emerald-600/25 flex items-center justify-center gap-2.5 active:scale-[0.98] transition-all cursor-pointer"
            >
              <Download className="h-5 w-5" strokeWidth={2.4} />
              <span>Download</span>
            </button>
          </div>
        </form>
      </div>

      {/* Guest Limit & Service Status Bar (Matching Screenshot 2) */}
      <div className="p-4 sm:px-6 rounded-2xl bg-white dark:bg-[#18181f] border border-zinc-200 dark:border-[#272733] shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3 text-xs sm:text-sm">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-indigo-100 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
            <Clock className="h-4 w-4" strokeWidth={2.4} />
          </div>
          <div>
            <span className="font-bold text-zinc-900 dark:text-white">
              Guest Limit: 5/5 plays or downloads
            </span>
            <span className="text-zinc-500 dark:text-zinc-400 ml-2">
              Resets in: 3h 7m
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <button
            onClick={() => onOpenAuth?.("login")}
            className="flex-1 sm:flex-none px-4 py-2 rounded-xl text-xs font-bold text-white bg-[#4f46e5] hover:bg-[#4338ca] transition-all shadow-sm"
          >
            Login for Unlimited
          </button>
          <a
            href="#how-it-works"
            className="flex-1 sm:flex-none px-4 py-2 rounded-xl text-xs font-bold text-white bg-[#059669] hover:bg-[#047857] text-center transition-all shadow-sm"
          >
            Free Alternative
          </a>
        </div>
      </div>
    </div>
  );
};
