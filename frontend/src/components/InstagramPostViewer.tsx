"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { Download, Copy, Check, ChevronLeft, ChevronRight, AlertCircle, Play } from "lucide-react";
import { VideoPlayer } from "./VideoPlayer";
import { downloadVideoStream, DownloadProgress } from "../utils/hlsDownloader";

export interface InstagramMediaItem {
  type: "video" | "photo";
  stream_url: string;
  download_url?: string;
  direct_url?: string;
  /** Same media through the Worker, used if the CDN refuses this browser */
  proxy_url?: string;
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
    } catch (caught) {
      const err = caught as Error;
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

  const busy = downloadProgress?.status === "downloading" || downloadProgress?.status === "preparing";
  const kindLabel = currentMedia.type === "video" ? "Video" : "Photo";

  return (
    <article className="w-full grid grid-cols-1 lg:grid-cols-12 gap-3" aria-label="Instagram post">
      {/* Media stage */}
      <div
        className="lg:col-span-7 relative rounded-ui bg-stage overflow-clip select-none"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {currentMedia.type === "video" ? (
          <VideoPlayer
            streamData={{
              streamUrl: currentMedia.stream_url,
              fallbackUrl: currentMedia.proxy_url,
              title: currentMedia.filename || postData.title || `Instagram video ${currentIndex + 1}`,
              thumbnail: currentMedia.thumbnail,
            }}
            isTheaterMode={isTheaterMode}
            onToggleTheater={() => setIsTheaterMode(!isTheaterMode)}
          />
        ) : (
          <div className="flex items-center justify-center min-h-[360px] sm:min-h-[520px] max-h-[78vh] p-3 sm:p-6">
            <img
              src={currentMedia.stream_url}
              alt={currentMedia.filename || `Instagram photo ${currentIndex + 1}`}
              onError={(e) => {
                const img = e.currentTarget;
                if (currentMedia.proxy_url && img.src !== currentMedia.proxy_url) img.src = currentMedia.proxy_url;
              }}
              className="max-h-[72vh] w-auto max-w-full object-contain rounded-ui"
            />
          </div>
        )}

        {isCarousel && (
          <>
            <button
              onClick={handlePrev}
              className="btn absolute left-3 top-1/2 -translate-y-1/2 z-30 min-h-[48px] w-12 px-0 bg-paper text-ink"
              aria-label="Previous slide"
              title="Previous slide (left arrow)"
            >
              <ChevronLeft className="h-6 w-6" strokeWidth={2.5} />
            </button>
            <button
              onClick={handleNext}
              className="btn absolute right-3 top-1/2 -translate-y-1/2 z-30 min-h-[48px] w-12 px-0 bg-paper text-ink"
              aria-label="Next slide"
              title="Next slide (right arrow)"
            >
              <ChevronRight className="h-6 w-6" strokeWidth={2.5} />
            </button>
          </>
        )}
      </div>

      {/* Details, downloads and slides */}
      <div className="lg:col-span-5 rounded-ui bg-paper p-5 sm:p-7 flex flex-col gap-6">
        <div>
          <p className="text-small text-muted">
            {postData.author ? `@${postData.author}` : "Instagram"}
            {isCarousel ? ` · ${kindLabel} ${currentIndex + 1} of ${medias.length}` : ` · ${kindLabel}`}
          </p>
          <h2 className="mt-2 text-lead font-semibold tracking-[-0.02em] leading-snug [overflow-wrap:anywhere]">
            {postData.title || currentMedia.filename || "Instagram post"}
          </h2>
        </div>

        {isCarousel && (
          <div className="flex gap-1" aria-hidden="true">
            {medias.map((_, idx) => (
              <i key={idx} className={`block h-2 flex-1 rounded-[2px] ${idx === currentIndex ? "bg-accent" : idx < currentIndex ? "bg-ink" : "bg-surface-2"}`} />
            ))}
          </div>
        )}

        <div className="flex flex-col gap-2">
          <button
            onClick={handleDownloadCurrent}
            disabled={downloadProgress?.status === "assembling"}
            className={`btn min-h-[56px] relative overflow-clip ${downloadProgress?.status === "error" ? "bg-danger text-paper" : "btn-accent"}`}
          >
            {busy && downloadProgress && (
              <span className="absolute inset-y-0 left-0 bg-ink/25 transition-[width] duration-200" style={{ width: `${downloadProgress.percent}%` }} aria-hidden="true" />
            )}
            <span className="relative inline-flex items-center gap-2">
              {busy ? (
                <span className="h-4 w-4 rounded-full border-2 border-current border-r-transparent animate-[spin_0.8s_linear_infinite]" />
              ) : downloadProgress?.status === "completed" ? (
                <Check className="h-5 w-5" strokeWidth={2.5} />
              ) : downloadProgress?.status === "error" ? (
                <AlertCircle className="h-5 w-5" strokeWidth={2.4} />
              ) : (
                <Download className="h-5 w-5" strokeWidth={2.4} />
              )}
              {downloadProgress?.status === "downloading"
                ? `Downloading ${downloadProgress.percent}%, press to cancel`
                : downloadProgress?.status === "preparing"
                  ? "Preparing the file"
                  : downloadProgress?.status === "assembling"
                    ? "Saving the file"
                    : downloadProgress?.status === "completed"
                      ? "Saved to your downloads"
                      : downloadProgress?.status === "error"
                        ? "Try the download again"
                        : `Download this ${kindLabel.toLowerCase()}`}
            </span>
          </button>

          {isCarousel && (
            <button onClick={handleDownloadAll} disabled={batchStatus?.active} className="btn btn-ink min-h-[52px]">
              <Download className="h-5 w-5" strokeWidth={2.4} />
              {batchStatus?.active ? `Downloading ${batchStatus.current} of ${batchStatus.total}` : `Download all ${medias.length}`}
            </button>
          )}

          <button onClick={handleCopyLink} className="btn btn-quiet min-h-[48px] text-small" title="Copy the media URL">
            {copiedLink ? <Check className="h-4 w-4" strokeWidth={2.5} /> : <Copy className="h-4 w-4" strokeWidth={2.4} />}
            {copiedLink ? "Media URL copied" : "Copy media URL"}
          </button>
        </div>

        {isCarousel && (
          <div>
            <h3 className="text-small text-muted">All {medias.length} slides</h3>
            <div ref={stripRef} className="mt-3 grid grid-cols-4 gap-2">
              {medias.map((media, idx) => {
                const active = idx === currentIndex;
                return (
                  <button
                    key={idx}
                    onClick={() => setCurrentIndex(idx)}
                    aria-label={`Slide ${idx + 1}, ${media.type}`}
                    aria-current={active}
                    className={`relative aspect-square overflow-clip rounded-ui transition-opacity ${
                      active ? "outline-3 outline-accent -outline-offset-3" : "opacity-80 hover:opacity-100"
                    }`}
                  >
                    <img src={media.thumbnail || media.stream_url} alt="" loading="lazy" className="h-full w-full object-cover" />
                    {media.type === "video" && (
                      <span className="absolute bottom-1 right-1 inline-flex h-6 w-6 items-center justify-center rounded-[4px] bg-stage text-stage-ink">
                        <Play className="h-3 w-3 fill-current" strokeWidth={2.4} />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </article>
  );
};
