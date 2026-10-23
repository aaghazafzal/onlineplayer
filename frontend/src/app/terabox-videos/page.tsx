"use client";

import React, { useState, useEffect, useRef } from "react";
import { SiteHeader } from "../../components/SiteHeader";
import { SiteFooter } from "../../components/HomeSections";
import { RevealObserver } from "../../components/RevealObserver";
import { ShortcutsModal } from "../../components/ShortcutsModal";
import { VideoPlayer, StreamData } from "../../components/VideoPlayer";
import { Search, X, Play, Download, Share2, Bookmark, ExternalLink, Check, AlertCircle, RefreshCw, ArrowUp } from "lucide-react";

interface VideoItem {
  id: string | number;
  title: string;
  size: string;
  thumbnail: string;
  duration: string;
  quality: string;
  views: number;
  createdAt: string;
  surl: string | null;
  shareUrl: string | null;
}

const FLOAT_SHADOW = "shadow-[0_8px_24px_rgba(0,0,0,0.25)]"; // taste-skill-ignore: a fixed button floating over the content

const WORKER_API_BASE = "https://terabox.onlineplayer.site";

const POPULAR_SEARCHES = [
  "Pushpa",
  "Kalki",
  "Avengers",
  "Naruto",
  "Mirzapur",
  "Jawan",
  "Animal",
  "Devara",
  "Salaar",
  "Movie"
];

export default function TeraBoxVideosPage() {
  const [searchQuery, setSearchQuery] = useState("pushpa");
  const [activeQuery, setActiveQuery] = useState("pushpa");
  const [videoList, setVideoList] = useState<VideoItem[]>([]);
  const [totalResults, setTotalResults] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  // Filters
  const [selectedSort, setSelectedSort] = useState<"trending" | "latest">("trending");
  const [selectedQuality, setSelectedQuality] = useState<"all" | "1080p" | "720p" | "480p">("all");
  const [selectedDuration, setSelectedDuration] = useState<"all" | "short" | "medium" | "long">("all");

  // Bookmarks state (saved in localStorage)
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string | number>>(new Set());

  // Copy notification state
  const [copiedId, setCopiedId] = useState<string | number | null>(null);

  // In-page modal player
  const [activeModalVideo, setActiveModalVideo] = useState<VideoItem | null>(null);
  const [modalStreamData, setModalStreamData] = useState<StreamData | null>(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  // Sticky search: shown once the page's own search box has scrolled under the header
  const searchEndRef = useRef<HTMLDivElement>(null);
  const [searchStuck, setSearchStuck] = useState(false);
  const [showTop, setShowTop] = useState(false);

  useEffect(() => {
    const sentinel = searchEndRef.current;
    if (!sentinel) return;
    const io = new IntersectionObserver(
      ([entry]) => setSearchStuck(!entry.isIntersecting && entry.boundingClientRect.top < 72),
      { rootMargin: "-72px 0px 0px 0px" } // the site header is 72px tall
    );
    io.observe(sentinel);

    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        setShowTop(window.scrollY > 900);
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      io.disconnect();
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame);
    };
  }, []);

  const scrollToTop = () => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
  };

  // Load bookmarks on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem("terabox_bookmarks");
      // Reading browser storage after hydration (the static HTML has no bookmarks)
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (saved) setBookmarkedIds(new Set(JSON.parse(saved)));
    } catch (e) {
      console.warn("Failed to load bookmarks:", e);
    }
  }, []);

  // Fetch search results
  const fetchVideos = async (
    query: string,
    sort: string,
    quality: string,
    duration: string,
    offset = 0,
    append = false
  ) => {
    if (append) {
      setIsLoadingMore(true);
    } else {
      setIsLoading(true);
      setErrorMessage(null);
    }

    try {
      const params = new URLSearchParams();
      if (query.trim()) params.append("q", query.trim());
      params.append("sort", sort);
      if (quality !== "all") params.append("quality", quality);
      if (duration !== "all") params.append("duration", duration);
      params.append("offset", offset.toString());
      params.append("limit", "24");

      // Fetch directly from Cloudflare Worker Search API (Ultra-fast Edge CDN + KV Cache)
      const res = await fetch(`${WORKER_API_BASE}/api/search?${params.toString()}`);
      const data = await res.json();

      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to load video results.");
      }

      if (append) {
        setVideoList((prev) => [
          ...prev,
          ...(data.list || []).filter((item: VideoItem) => Boolean(item.surl || item.shareUrl))
        ]);
      } else {
        const filtered = (data.list || []).filter((item: VideoItem) => Boolean(item.surl || item.shareUrl));
        setVideoList(filtered);
        setTotalResults(data.total || filtered.length);
        setActiveQuery(query.trim());
      }
    } catch (caught) {
      const err = caught as Error;
      console.error("Search fetch error:", err);
      setErrorMessage(err.message || "Failed to load videos. Please try again.");
      if (!append) {
        setVideoList([]);
        setTotalResults(0);
      }
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  };

  // Initial load: fetching from the network is what this effect is for
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchVideos("pushpa", selectedSort, selectedQuality, selectedDuration, 0, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once on load
  }, []);

  // Handle Search Submission
  const handleSearchSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    fetchVideos(searchQuery, selectedSort, selectedQuality, selectedDuration, 0, false);
  };

  // Handle Clear All
  const handleClearAll = () => {
    setSearchQuery("");
    setActiveQuery("");
    fetchVideos("", selectedSort, selectedQuality, selectedDuration, 0, false);
    searchInputRef.current?.focus();
  };

  // Handle Quick Tag Click
  const handleTagClick = (tag: string) => {
    setSearchQuery(tag);
    fetchVideos(tag, selectedSort, selectedQuality, selectedDuration, 0, false);
  };

  // Filter change handlers
  const handleFilterChange = (
    newSort = selectedSort,
    newQuality = selectedQuality,
    newDuration = selectedDuration
  ) => {
    setSelectedSort(newSort);
    setSelectedQuality(newQuality);
    setSelectedDuration(newDuration);
    fetchVideos(activeQuery, newSort, newQuality, newDuration, 0, false);
  };

  // Load More
  const handleLoadMore = () => {
    if (isLoadingMore || videoList.length >= totalResults) return;
    fetchVideos(
      activeQuery,
      selectedSort,
      selectedQuality,
      selectedDuration,
      videoList.length,
      true
    );
  };

  // Toggle Bookmark
  const handleToggleBookmark = (item: VideoItem) => {
    const next = new Set(bookmarkedIds);
    if (next.has(item.id)) {
      next.delete(item.id);
    } else {
      next.add(item.id);
    }
    setBookmarkedIds(next);
    try {
      localStorage.setItem("terabox_bookmarks", JSON.stringify([...next]));
    } catch (e) {
      console.warn("Failed to save bookmarks:", e);
    }
  };

  // Copy Share Link
  const handleCopyLink = (item: VideoItem) => {
    const url = item.shareUrl || (item.surl ? `https://terabox.com/s/${item.surl}` : "");
    if (!url) {
      setErrorMessage("Share link is not available for this item.");
      return;
    }
    navigator.clipboard.writeText(url);
    setCopiedId(item.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Play video inside In-Page Modal
  const handlePlayModal = async (item: VideoItem) => {
    const link = item.shareUrl || (item.surl ? `https://terabox.com/s/${item.surl}` : "");
    if (!link) {
      setErrorMessage("Stream link is not available for this video.");
      return;
    }

    setActiveModalVideo(item);
    setModalLoading(true);
    setModalError(null);
    setModalStreamData(null);

    try {
      const targetApi = `${WORKER_API_BASE}/api/resolve?url=${encodeURIComponent(link)}`;
      const res = await fetch(targetApi);
      const data = await res.json();

      if (!res.ok || data.error || !data.ok) {
        throw new Error(data.error || "Unable to extract stream for this video.");
      }

      const activeFile = data.files?.[0];
      if (!activeFile || !activeFile.stream_url) {
        throw new Error("No playable HLS stream found for this video.");
      }

      setModalStreamData({
        streamUrl: activeFile.stream_url,
        streamUrl360: activeFile.stream_url_360,
        title: item.title,
        durationFormatted: activeFile.duration_formatted || item.duration,
        sizeFormatted: activeFile.size_formatted || item.size,
        thumbnail: item.thumbnail,
        surl: item.surl || undefined,
      });
    } catch (caught) {
      const err = caught as Error;
      console.error("Modal stream resolve error:", err);
      setModalError(err.message || "Failed to load stream. Please try again.");
    } finally {
      setModalLoading(false);
    }
  };

  // Direct Download Trigger
  const handleDownload = (item: VideoItem) => {
    const targetUrl = item.shareUrl || (item.surl ? `https://terabox.com/s/${item.surl}` : "");
    if (!targetUrl) return;
    // Open in main player with auto-download triggered
    window.location.href = `/?url=${encodeURIComponent(targetUrl)}&download=1`;
  };

  // Format date helper
  const formatDate = (isoString?: string) => {
    if (!isoString) return "";
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric"
      });
    } catch {
      return isoString;
    }
  };

  const closeModal = () => {
    setActiveModalVideo(null);
    setModalStreamData(null);
  };
  const shareLinkOf = (item: VideoItem) => item.shareUrl || (item.surl ? `https://terabox.com/s/${item.surl}` : "");

  const QUALITIES = ["all", "1080p", "720p", "480p"] as const;
  const SORTS = [
    { id: "trending", label: "Most watched" },
    { id: "latest", label: "Newest" },
  ] as const;

  return (
    <div id="top" className="min-h-svh bg-bg text-ink flex flex-col">
      <RevealObserver />
      <SiteHeader onOpenShortcuts={() => setIsShortcutsOpen(true)} />

      <main className="flex-1 frame pt-10 lg:pt-16 pb-[var(--section-gap)]">
        {/* Title and search */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-6 items-end">
          <div className="lg:col-span-12">
            <h1 className="text-display leading-[0.95] max-w-[12ch]">TeraBox videos to play</h1>
            <p className="mt-5 max-w-[42ch] text-body">
              Search public TeraBox shares and play any of them here in full, or save it as MP4.
            </p>
          </div>

          <form onSubmit={handleSearchSubmit} className="lg:col-span-8" role="search">
            <label htmlFor="video-search" className="sr-only">
              Search videos
            </label>
            <div className="flex items-stretch gap-2 rounded-ui bg-paper p-2 focus-within:outline-3 focus-within:outline-accent">
              <Search className="h-5 w-5 self-center ml-2 text-muted shrink-0" strokeWidth={2.4} />
              <input
                id="video-search"
                ref={searchInputRef}
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by title"
                className="min-w-0 flex-1 bg-transparent px-2 text-body placeholder:text-muted focus:outline-none"
              />
              <button type="submit" className="btn btn-accent min-h-[48px]">
                Search
              </button>
            </div>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-small">
              <span className="text-muted">Try</span>
              {POPULAR_SEARCHES.map((tag) => (
                <button key={tag} type="button" onClick={() => handleTagClick(tag)} className="link cursor-pointer">
                  {tag}
                </button>
              ))}
            </div>
          </form>
        </div>
        <div ref={searchEndRef} aria-hidden="true" />

        {/* Result count and filters */}
        <div className="mt-14 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <h2 className="text-lead font-semibold tracking-[-0.02em]" aria-live="polite">
            {isLoading
              ? "Searching"
              : activeQuery
                ? `${totalResults.toLocaleString()} videos for “${activeQuery}”`
                : `${totalResults.toLocaleString()} videos`}
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            <div role="radiogroup" aria-label="Quality" className="flex gap-1 rounded-ui bg-surface p-1">
              {QUALITIES.map((q) => (
                <button
                  key={q}
                  type="button"
                  role="radio"
                  aria-checked={selectedQuality === q}
                  onClick={() => handleFilterChange(selectedSort, q, selectedDuration)}
                  className={`min-h-[40px] px-3 rounded-[4px] text-small transition-colors ${
                    selectedQuality === q ? "bg-ink text-paper" : "hover:bg-surface-2"
                  }`}
                >
                  {q === "all" ? "Any quality" : q}
                </button>
              ))}
            </div>
            <div role="radiogroup" aria-label="Sort" className="flex gap-1 rounded-ui bg-surface p-1">
              {SORTS.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  role="radio"
                  aria-checked={selectedSort === s.id}
                  onClick={() => handleFilterChange(s.id, selectedQuality, selectedDuration)}
                  className={`min-h-[40px] px-3 rounded-[4px] text-small transition-colors ${
                    selectedSort === s.id ? "bg-ink text-paper" : "hover:bg-surface-2"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
            {activeQuery && (
              <button type="button" onClick={handleClearAll} className="link text-small ml-2 cursor-pointer">
                Clear search
              </button>
            )}
          </div>
        </div>

        {errorMessage && (
          <div role="alert" className="mt-6 rounded-ui bg-danger-soft p-5 flex flex-wrap items-center justify-between gap-4">
            <p className="text-body">{errorMessage}</p>
            <button
              type="button"
              onClick={() => fetchVideos(activeQuery, selectedSort, selectedQuality, selectedDuration, 0, false)}
              className="btn btn-ink min-h-[44px] text-small"
            >
              <RefreshCw className="h-4 w-4" strokeWidth={2.4} /> Try again
            </button>
          </div>
        )}

        {/* Results */}
        {isLoading ? (
          <ul className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-3 gap-y-8" aria-hidden="true">
            {Array.from({ length: 8 }, (_, i) => (
              <li key={i}>
                <div className="aspect-video rounded-ui bg-surface" />
                <div className="mt-3 h-5 w-4/5 rounded-[4px] bg-surface" />
                <div className="mt-2 h-4 w-2/5 rounded-[4px] bg-surface" />
              </li>
            ))}
          </ul>
        ) : videoList.length === 0 && !errorMessage ? (
          <div className="mt-10 rounded-ui bg-paper p-8 sm:p-12">
            <h3 className="text-lead font-semibold">Nothing found{activeQuery ? ` for “${activeQuery}”` : ""}</h3>
            <p className="mt-2 text-body text-muted">Try a shorter title, or one of these:</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {POPULAR_SEARCHES.slice(0, 6).map((t) => (
                <button key={t} type="button" onClick={() => handleTagClick(t)} className="btn btn-quiet min-h-[44px] text-small">
                  {t}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <ul className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-3 gap-y-8">
            {videoList.map((item, i) => {
              const saved = bookmarkedIds.has(item.id);
              return (
                <li key={`${item.id}-${i}`} data-reveal style={{ "--i": i % 4 } as React.CSSProperties}>
                  <button
                    type="button"
                    onClick={() => handlePlayModal(item)}
                    className="group relative block w-full aspect-video overflow-clip rounded-ui bg-stage"
                    aria-label={`Play ${item.title}`}
                  >
                    {item.thumbnail ? (
                      <img
                        src={item.thumbnail}
                        alt=""
                        loading="lazy"
                        className="h-full w-full object-cover transition-transform duration-500 ease-[var(--ease-out)] group-hover:scale-[1.04]"
                      />
                    ) : null}
                    <span className="absolute inset-0 m-auto inline-flex h-12 w-12 items-center justify-center rounded-ui bg-accent text-accent-ink opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity">
                      <Play className="h-5 w-5 fill-current ml-0.5" strokeWidth={2.2} />
                    </span>
                    {item.duration && (
                      <span className="absolute bottom-2 right-2 rounded-[4px] bg-stage px-2 py-0.5 text-small text-stage-ink tabular">{item.duration}</span>
                    )}
                  </button>
                  <h3 className="mt-3 text-body font-medium leading-snug min-h-[2.75em]">
                    <button
                      type="button"
                      onClick={() => handlePlayModal(item)}
                      title={item.title}
                      className="w-full text-left line-clamp-2 [overflow-wrap:anywhere] hover:underline underline-offset-4 cursor-pointer"
                    >
                      {item.title}
                    </button>
                  </h3>
                  <p className="mt-1 text-small text-muted">
                    {[item.quality, item.size, item.views ? `${item.views.toLocaleString()} views` : "", formatDate(item.createdAt)].filter(Boolean).join(" · ")}
                  </p>
                  <div className="mt-3 flex gap-1">
                    <button type="button" onClick={() => handleDownload(item)} className="btn btn-quiet min-h-[40px] flex-1 px-2 text-small">
                      <Download className="h-4 w-4" strokeWidth={2.4} /> Save
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCopyLink(item)}
                      className="btn btn-quiet min-h-[40px] flex-1 px-2 text-small"
                      aria-label={`Copy the share link of ${item.title}`}
                    >
                      {copiedId === item.id ? <Check className="h-4 w-4" strokeWidth={2.6} /> : <Share2 className="h-4 w-4" strokeWidth={2.4} />}
                      {copiedId === item.id ? "Copied" : "Link"}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggleBookmark(item)}
                      aria-pressed={saved}
                      aria-label={saved ? `Remove ${item.title} from saved` : `Save ${item.title} for later`}
                      className={`btn min-h-[40px] w-10 px-0 ${saved ? "btn-ink" : "btn-quiet"}`}
                    >
                      <Bookmark className={`h-4 w-4 ${saved ? "fill-current" : ""}`} strokeWidth={2.4} />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {!isLoading && videoList.length > 0 && videoList.length < totalResults && (
          <div className="mt-12 flex justify-center">
            <button type="button" onClick={handleLoadMore} disabled={isLoadingMore} className="btn btn-ink min-h-[56px] px-8">
              {isLoadingMore ? (
                <span className="h-5 w-5 rounded-full border-2 border-current border-r-transparent animate-[spin_0.8s_linear_infinite]" />
              ) : null}
              {isLoadingMore ? "Loading" : `Show more (${videoList.length} of ${totalResults.toLocaleString()})`}
            </button>
          </div>
        )}
      </main>

      <SiteFooter />

      {/* Compact search that follows the page once the main one is out of view */}
      <div
        className={`fixed inset-x-0 top-[72px] z-30 bg-bg transition-[transform,opacity] duration-300 ease-[var(--ease-out)] motion-reduce:transition-none ${
          searchStuck ? "translate-y-0 opacity-100" : "-translate-y-full opacity-0 pointer-events-none"
        }`}
        aria-hidden={!searchStuck}
        inert={!searchStuck}
      >
        <form onSubmit={handleSearchSubmit} className="frame py-2" role="search">
          <label htmlFor="video-search-sticky" className="sr-only">
            Search videos
          </label>
          <div className="flex items-stretch gap-2 rounded-ui bg-paper p-1.5 focus-within:outline-3 focus-within:outline-accent">
            <Search className="h-5 w-5 self-center ml-2 text-muted shrink-0" strokeWidth={2.4} />
            <input
              id="video-search-sticky"
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by title"
              className="min-w-0 flex-1 bg-transparent px-2 text-body placeholder:text-muted focus:outline-none"
            />
            <button type="submit" className="btn btn-accent min-h-[44px]">
              Search
            </button>
          </div>
        </form>
      </div>

      {/* Back to the top */}
      <button
        type="button"
        onClick={scrollToTop}
        aria-label="Back to top"
        title="Back to top"
        className={`btn btn-ink fixed z-30 right-4 sm:right-6 bottom-[max(16px,env(safe-area-inset-bottom))] sm:bottom-6 min-h-[52px] w-[52px] px-0 ${FLOAT_SHADOW} transition-[transform,opacity] duration-300 ease-[var(--ease-out)] motion-reduce:transition-none ${
          showTop ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0 pointer-events-none"
        }`}
        tabIndex={showTop ? 0 : -1}
      >
        <ArrowUp className="h-5 w-5" strokeWidth={2.4} />
      </button>

      {/* In-page player */}
      {activeModalVideo && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-title"
          onClick={(e) => e.target === e.currentTarget && closeModal()}
          onKeyDown={(e) => e.key === "Escape" && closeModal()}
        >
          <div className="w-full max-w-5xl rounded-ui bg-paper overflow-clip flex flex-col max-h-[92vh]">
            <div className="flex items-center justify-between gap-4 px-4 sm:px-5 min-h-[60px]">
              <h2 id="modal-title" className="text-body font-medium truncate">
                {activeModalVideo.title}
              </h2>
              <button onClick={closeModal} className="btn btn-quiet min-h-[40px] w-10 px-0 shrink-0" aria-label="Close player" autoFocus>
                <X className="h-5 w-5" strokeWidth={2.4} />
              </button>
            </div>

            <div className="relative aspect-video w-full bg-stage text-stage-ink">
              {modalLoading ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                  <span className="h-8 w-8 rounded-full border-[3px] border-current border-r-transparent animate-[spin_0.8s_linear_infinite]" />
                  <p className="text-small text-stage-muted">Finding the full video</p>
                </div>
              ) : modalError ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center">
                  <AlertCircle className="h-8 w-8" strokeWidth={2.2} />
                  <p className="text-body max-w-[44ch]">{modalError}</p>
                  <a href={`/?url=${encodeURIComponent(shareLinkOf(activeModalVideo))}`} className="btn btn-accent min-h-[48px] text-small">
                    Open in the full player
                  </a>
                </div>
              ) : modalStreamData ? (
                <VideoPlayer streamData={modalStreamData} isTheaterMode={false} onToggleTheater={() => {}} />
              ) : null}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 p-4 sm:p-5">
              <p className="text-small text-muted">
                {[activeModalVideo.duration, activeModalVideo.size, activeModalVideo.quality].filter(Boolean).join(" · ")}
              </p>
              <div className="flex gap-2">
                <button onClick={() => handleDownload(activeModalVideo)} className="btn btn-ink min-h-[44px] text-small">
                  <Download className="h-4 w-4" strokeWidth={2.4} /> Download
                </button>
                <a href={`/?url=${encodeURIComponent(shareLinkOf(activeModalVideo))}`} className="btn btn-accent min-h-[44px] text-small">
                  <ExternalLink className="h-4 w-4" strokeWidth={2.4} /> Open full page
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      <ShortcutsModal isOpen={isShortcutsOpen} onClose={() => setIsShortcutsOpen(false)} />
    </div>
  );
}
