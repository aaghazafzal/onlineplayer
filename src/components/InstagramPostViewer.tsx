"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { 
  Download, 
  Copy, 
  Check, 
  Film, 
  Image as ImageIcon, 
  ChevronLeft, 
  ChevronRight, 
  Layers, 
  ExternalLink, 
  ShieldCheck, 
  Sparkles, 
  Clock, 
  Loader2, 
  AlertCircle,
  PlayCircle
} from "lucide-react";
import { VideoPlayer } from "./VideoPlayer";
import { downloadVideoStream, DownloadProgress } from "../utils/hlsDownloader";

export interface InstagramMediaItem {
  type: "video" | "photo";
  stream_url: string;
  download_url?: string;
  direct_url?: string;
  thumbnail?: string;
  filename?: string;
}

export interface InstagramPostData {
  shortcode?: string;
  author?: string;
  title?: string;
  type?: "video" | "photo" | "carousel";
  medias: InstagramMediaItem[];
}

interface InstagramPostViewerProps {
  postData: InstagramPostData;
  autoStartDownload?: boolean;
}

export const InstagramPostViewer: React.FC<InstagramPostViewerProps> = ({
  postData,
  autoStartDownload = false,
}) => {
  const medias = postData.medias || [];
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isTheaterMode, setIsTheaterMode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgress | null>(null);
  const [batchStatus, setBatchStatus] = useState<{
    active: boolean;
    current: number;
    total: number;
    currentName: string;
  } | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const hasAutoStartedRef = useRef(false);
  const touchStartXRef = useRef<number | null>(null);
  const stripRef = useRef<HTMLDivElement>(null);

  const currentMedia = medias[currentIndex] || medias[0];
  const isCarousel = medias.length > 1;

  // Navigation handlers
  const handleNext = useCallback(() => {
    if (medias.length <= 1) return;
    setCurrentIndex((prev) => (prev + 1) % medias.length);
  }, [medias.length]);

  const handlePrev = useCallback(() => {
    if (medias.length <= 1) return;
    setCurrentIndex((prev) => (prev - 1 + medias.length) % medias.length);
  }, [medias.length]);

  // Keyboard navigation (Left / Right arrow keys)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "ArrowLeft") handlePrev();
      if (e.key === "ArrowRight") handleNext();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleNext, handlePrev]);

  // Auto-scroll active thumbnail into view
  useEffect(() => {
    if (stripRef.current) {
      const activeThumb = stripRef.current.children[currentIndex] as HTMLElement;
      if (activeThumb) {
        activeThumb.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
      }
    }
  }, [currentIndex]);

  // Touch Swipe handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartXRef.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartXRef.current === null) return;
    const touchEndX = e.changedTouches[0].clientX;
    const diff = touchStartXRef.current - touchEndX;

    if (diff > 50) {
      handleNext();
    } else if (diff < -50) {
      handlePrev();
    }
    touchStartXRef.current = null;
  };

  // Copy current slide link
  const handleCopyLink = () => {
    if (!currentMedia) return;
    navigator.clipboard.writeText(currentMedia.stream_url || currentMedia.direct_url || "");
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  // Download single active slide
  const handleDownloadCurrent = async () => {
    if (!currentMedia) return;

    if (downloadProgress && (downloadProgress.status === "downloading" || downloadProgress.status === "preparing")) {
      abortControllerRef.current?.abort();
      setDownloadProgress({
        status: "cancelled",
        percent: 0,
        downloadedChunks: 0,
        totalChunks: 0,
        downloadedBytes: 0,
        speedMBs: 0,
      });
      setTimeout(() => setDownloadProgress(null), 2000);
      return;
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    const defaultExt = currentMedia.type === "photo" ? ".jpg" : ".mp4";
    const filename = currentMedia.filename || `instagram-${postData.shortcode || "media"}-${currentIndex + 1}${defaultExt}`;

    try {
      await downloadVideoStream(
        currentMedia.stream_url,
        filename,
        (prog) => {
          setDownloadProgress({ ...prog });
          if (prog.status === "completed") {
            setTimeout(() => setDownloadProgress(null), 4000);
          }
        },
        controller.signal
      );
    } catch (err: any) {
      if (err.message !== "Download cancelled") {
        console.error("Slide download failed:", err);
        setDownloadProgress({
          status: "error",
          percent: 0,
          downloadedChunks: 0,
          totalChunks: 0,
          downloadedBytes: 0,
          speedMBs: 0,
          error: err.message || "Failed to download",
        });
        setTimeout(() => setDownloadProgress(null), 4500);
      }
    }
  };

  // Batch download all slides sequentially
  const handleDownloadAll = async () => {
    if (batchStatus?.active || medias.length === 0) return;

    setBatchStatus({
      active: true,
      current: 1,
      total: medias.length,
      currentName: medias[0]?.filename || "Slide 1",
    });

    for (let i = 0; i < medias.length; i++) {
      const media = medias[i];
      const defaultExt = media.type === "photo" ? ".jpg" : ".mp4";
      const filename = media.filename || `instagram-${postData.shortcode || "media"}-${i + 1}${defaultExt}`;

      setBatchStatus({
        active: true,
        current: i + 1,
        total: medias.length,
        currentName: filename,
      });

      try {
        await downloadVideoStream(media.stream_url, filename);
      } catch (e) {
        console.warn(`Failed downloading item ${i + 1}:`, e);
      }

      // Small pause between downloads to avoid browser throttling
      await new Promise((resolve) => setTimeout(resolve, 800));
    }

    setBatchStatus(null);
  };

  // Auto-start download if requested
  useEffect(() => {
    if (autoStartDownload && !hasAutoStartedRef.current && currentMedia) {
      hasAutoStartedRef.current = true;
      handleDownloadCurrent();
    }
  }, [autoStartDownload, currentMedia]);

  if (!currentMedia) return null;

  return (
    <div className="w-full max-w-[1360px] mx-auto space-y-6">
      
      {/* Top Header Card */}
      <div className="p-4 sm:p-6 rounded-3xl bg-white dark:bg-[#18181f] border border-zinc-200 dark:border-[#272733] shadow-xl shadow-zinc-950/5 dark:shadow-black/40 flex flex-col md:flex-row md:items-center justify-between gap-4">
        
        {/* Left: Provider Tag & Meta */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500/10 via-pink-500/10 to-purple-600/10 text-pink-600 dark:text-pink-400 border border-pink-500/20 font-bold text-xs sm:text-sm">
            <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24">
              <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
            </svg>
            <span>{isCarousel ? "Instagram Carousel Post" : "Instagram Reel"}</span>
          </div>

          {postData.author && (
            <span className="px-3 py-1.5 rounded-xl bg-zinc-100 dark:bg-[#121217] text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-[#2a2a38] text-xs font-semibold">
              @{postData.author}
            </span>
          )}

          {isCarousel && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60 text-xs font-bold">
              <Layers className="h-3.5 w-3.5" />
              Slide {currentIndex + 1} of {medias.length}
            </span>
          )}

          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50 text-xs font-bold">
            <ShieldCheck className="h-3.5 w-3.5" />
            100% Watermark-Free HD
          </span>
        </div>

        {/* Right: Quick Action Buttons */}
        <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
          {isCarousel && (
            <button
              onClick={handleDownloadAll}
              disabled={batchStatus?.active}
              className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-700 hover:to-purple-700 shadow-md shadow-pink-600/20 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
            >
              {batchStatus?.active ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Downloading {batchStatus.current}/{batchStatus.total}...</span>
                </>
              ) : (
                <>
                  <Download className="h-4 w-4" />
                  <span>Download All ({medias.length} Slides)</span>
                </>
              )}
            </button>
          )}

          <button
            onClick={handleCopyLink}
            className="px-3.5 py-2 rounded-xl text-xs font-bold text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-[#121217] hover:bg-zinc-200 dark:hover:bg-[#20202a] border border-zinc-200 dark:border-[#2a2a38] transition-colors flex items-center gap-1.5 cursor-pointer"
            title="Copy direct media URL"
          >
            {copiedLink ? (
              <>
                <Check className="h-4 w-4 text-emerald-500" strokeWidth={2.5} />
                <span className="text-emerald-600 dark:text-emerald-400">Copied</span>
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" />
                <span>Copy URL</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Main Showcase Stage */}
      <div 
        className="relative rounded-3xl bg-[#09090c] border border-zinc-800/80 shadow-2xl overflow-hidden group select-none"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* MEDIA DISPLAY */}
        {currentMedia.type === "video" ? (
          <div className="w-full">
            <VideoPlayer
              streamData={{
                streamUrl: currentMedia.stream_url,
                title: currentMedia.filename || postData.title || `Instagram Video (${currentIndex + 1})`,
                durationFormatted: "Instagram Video",
                sizeFormatted: "HD MP4",
                thumbnail: currentMedia.thumbnail,
              }}
              isTheaterMode={isTheaterMode}
              onToggleTheater={() => setIsTheaterMode(!isTheaterMode)}
            />
          </div>
        ) : (
          <div className="relative min-h-[380px] sm:min-h-[500px] max-h-[75vh] flex items-center justify-center p-3 sm:p-6 bg-[#0c0c11]">
            <img
              src={currentMedia.stream_url}
              alt={currentMedia.filename || `Instagram Slide ${currentIndex + 1}`}
              className="max-h-[70vh] w-auto max-w-full object-contain rounded-2xl shadow-2xl transition-transform duration-300"
              loading="eager"
            />
            {/* HD Photo Tag */}
            <div className="absolute top-4 left-4 z-20">
              <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-black/70 backdrop-blur-md text-white border border-white/10 text-xs font-semibold">
                <ImageIcon className="h-3.5 w-3.5 text-pink-400" />
                Original Photo
              </span>
            </div>
          </div>
        )}

        {/* Carousel Navigation Arrows (Overlaid on Media) */}
        {isCarousel && (
          <>
            <button
              onClick={handlePrev}
              className="absolute left-3 top-1/2 -translate-y-1/2 z-30 p-2.5 sm:p-3 rounded-full bg-black/60 hover:bg-black/85 text-white/90 hover:text-white backdrop-blur-md border border-white/15 transition-all shadow-xl hover:scale-105 active:scale-95 cursor-pointer"
              title="Previous Slide (Left Arrow)"
              aria-label="Previous Slide"
            >
              <ChevronLeft className="h-5 w-5 sm:h-6 sm:w-6" strokeWidth={2.5} />
            </button>

            <button
              onClick={handleNext}
              className="absolute right-3 top-1/2 -translate-y-1/2 z-30 p-2.5 sm:p-3 rounded-full bg-black/60 hover:bg-black/85 text-white/90 hover:text-white backdrop-blur-md border border-white/15 transition-all shadow-xl hover:scale-105 active:scale-95 cursor-pointer"
              title="Next Slide (Right Arrow)"
              aria-label="Next Slide"
            >
              <ChevronRight className="h-5 w-5 sm:h-6 sm:w-6" strokeWidth={2.5} />
            </button>

            {/* Slide Indicator Dots on Stage */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/60 backdrop-blur-md border border-white/10">
              {medias.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentIndex(idx)}
                  className={`transition-all rounded-full ${
                    idx === currentIndex 
                      ? "h-2 w-6 bg-pink-500 shadow-sm shadow-pink-500/50" 
                      : "h-2 w-2 bg-white/40 hover:bg-white/70"
                  }`}
                  aria-label={`Go to slide ${idx + 1}`}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* Slide Meta Card & Dedicated Download Controls */}
      <div className="p-5 sm:p-7 rounded-3xl bg-white dark:bg-[#18181f] border border-zinc-200 dark:border-[#272733] shadow-xl shadow-zinc-950/5 dark:shadow-black/40 space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          
          {/* Metadata */}
          <div className="space-y-2 min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap text-xs">
              <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-bold ${
                currentMedia.type === "video" 
                  ? "bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-300 border border-purple-200 dark:border-purple-800/60"
                  : "bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60"
              }`}>
                {currentMedia.type === "video" ? (
                  <>
                    <Film className="h-3 w-3" />
                    <span>HD MP4 Video</span>
                  </>
                ) : (
                  <>
                    <ImageIcon className="h-3 w-3" />
                    <span>HD Photo</span>
                  </>
                )}
              </span>

              {isCarousel && (
                <span className="text-zinc-500 dark:text-zinc-400 font-semibold">
                  Item #{currentIndex + 1} of {medias.length}
                </span>
              )}
            </div>

            <h2 className="text-base sm:text-lg md:text-xl font-bold text-zinc-950 dark:text-white tracking-tight break-all sm:break-words">
              {postData.title || currentMedia.filename || `Instagram Media ${currentIndex + 1}`}
            </h2>
          </div>

          {/* Download Button */}
          <div className="shrink-0 flex items-center gap-3">
            <button
              onClick={handleDownloadCurrent}
              disabled={Boolean(downloadProgress && downloadProgress.status === "assembling")}
              className={`w-full sm:w-auto px-6 py-3.5 rounded-2xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg ${
                downloadProgress?.status === "downloading" || downloadProgress?.status === "preparing"
                  ? "bg-amber-500 hover:bg-amber-600 text-white shadow-amber-500/25"
                  : downloadProgress?.status === "completed"
                  ? "bg-emerald-600 text-white shadow-emerald-600/25"
                  : downloadProgress?.status === "error"
                  ? "bg-red-600 hover:bg-red-700 text-white shadow-red-600/25"
                  : "bg-blue-600 hover:bg-blue-700 text-white shadow-blue-600/25 active:scale-95"
              }`}
            >
              {downloadProgress?.status === "downloading" ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Downloading ({downloadProgress.percent}%) • Click to Cancel</span>
                </>
              ) : downloadProgress?.status === "preparing" ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Preparing Media...</span>
                </>
              ) : downloadProgress?.status === "assembling" ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Saving File...</span>
                </>
              ) : downloadProgress?.status === "completed" ? (
                <>
                  <Check className="h-4 w-4" strokeWidth={2.5} />
                  <span>Saved to Downloads</span>
                </>
              ) : downloadProgress?.status === "error" ? (
                <>
                  <AlertCircle className="h-4 w-4" />
                  <span>Retry Download</span>
                </>
              ) : (
                <>
                  <Download className="h-4 w-4" strokeWidth={2.4} />
                  <span>
                    {currentMedia.type === "video" ? "Download Video (HD MP4)" : "Download Photo (HD JPG)"}
                  </span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Real-time Progress Bar */}
        {downloadProgress && (downloadProgress.status === "downloading" || downloadProgress.status === "preparing") && (
          <div className="pt-2 space-y-2">
            <div className="w-full bg-zinc-100 dark:bg-zinc-800 rounded-full h-2 overflow-hidden">
              <div
                className="bg-gradient-to-r from-blue-500 to-indigo-500 h-2 transition-all duration-200 rounded-full"
                style={{ width: `${downloadProgress.percent}%` }}
              />
            </div>
            <div className="flex justify-between items-center text-[11px] text-zinc-500 dark:text-zinc-400 font-medium">
              <span>
                {downloadProgress.speedMBs > 0 ? `${downloadProgress.speedMBs} MB/s` : "Connecting to high-speed CDN..."}
              </span>
              <span>{downloadProgress.percent}% Completed</span>
            </div>
          </div>
        )}
      </div>

      {/* Thumbnail Carousel Strip (For Multi-Slide Carousel Posts) */}
      {isCarousel && (
        <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-[#18181f] border border-zinc-200 dark:border-[#272733] shadow-xl shadow-zinc-950/5 dark:shadow-black/40 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-pink-500" />
              <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                All Carousel Slides ({medias.length} Items)
              </h3>
            </div>
            <span className="text-xs text-zinc-500 dark:text-zinc-400 font-medium hidden sm:inline">
              Click any slide or use arrow keys ← →
            </span>
          </div>

          {/* Horizontal Scroll Ribbon */}
          <div 
            ref={stripRef}
            className="flex items-center gap-3 overflow-x-auto pb-2 pt-1 scrollbar-thin scrollbar-thumb-zinc-300 dark:scrollbar-thumb-zinc-700"
          >
            {medias.map((media, idx) => {
              const isActive = idx === currentIndex;
              return (
                <button
                  key={idx}
                  onClick={() => setCurrentIndex(idx)}
                  className={`group relative shrink-0 w-24 sm:w-28 h-24 sm:h-28 rounded-2xl overflow-hidden border-2 transition-all text-left cursor-pointer ${
                    isActive 
                      ? "border-pink-500 ring-4 ring-pink-500/20 scale-105 z-10" 
                      : "border-zinc-200 dark:border-zinc-800 hover:border-pink-400/50 opacity-80 hover:opacity-100"
                  }`}
                >
                  {/* Thumbnail Image */}
                  <img
                    src={media.thumbnail || media.stream_url}
                    alt={`Slide ${idx + 1}`}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                  />

                  {/* Overlay Gradient */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

                  {/* Slide Number Badge */}
                  <span className="absolute top-1.5 left-1.5 px-2 py-0.5 rounded-md bg-black/75 backdrop-blur-sm text-[10px] font-black text-white">
                    #{idx + 1}
                  </span>

                  {/* Type Badge */}
                  <div className="absolute bottom-1.5 right-1.5 p-1 rounded-md bg-black/75 backdrop-blur-sm text-white">
                    {media.type === "video" ? (
                      <Film className="h-3 w-3 text-purple-400" />
                    ) : (
                      <ImageIcon className="h-3 w-3 text-amber-400" />
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

    </div>
  );
};
