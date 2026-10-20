"use client";

import React, { useState, useEffect, useRef } from "react";
import { Navbar } from "../../components/Navbar";
import { ShortcutsModal } from "../../components/ShortcutsModal";
import { VideoPlayer, StreamData } from "../../components/VideoPlayer";
import {
  Search,
  SlidersHorizontal,
  X,
  Play,
  PlayCircle,
  Download,
  Share2,
  Bookmark,
  Flag,
  Film,
  Eye,
  Calendar,
  HardDrive,
  Clock,
  Sparkles,
  ExternalLink,
  Check,
  AlertCircle,
  Loader2,
  RefreshCw,
  TrendingUp,
  Flame,
  ArrowRight
} from "lucide-react";

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

  // Load bookmarks on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem("terabox_bookmarks");
      if (saved) {
        setBookmarkedIds(new Set(JSON.parse(saved)));
      }
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
        setVideoList((prev) => [...prev, ...(data.list || [])]);
      } else {
        setVideoList(data.list || []);
        setTotalResults(data.total || 0);
        setActiveQuery(query.trim());
      }
    } catch (err: any) {
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

  // Initial load
  useEffect(() => {
    fetchVideos("pushpa", selectedSort, selectedQuality, selectedDuration, 0, false);
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
    const url = item.shareUrl || `https://terabox.com/s/${item.surl}`;
    navigator.clipboard.writeText(url);
    setCopiedId(item.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Play video inside In-Page Modal
  const handlePlayModal = async (item: VideoItem) => {
    if (!item.surl) {
      // Fallback: Redirect to main page with search
      window.location.href = `/?search=${encodeURIComponent(item.title)}`;
      return;
    }

    setActiveModalVideo(item);
    setModalLoading(true);
    setModalError(null);
    setModalStreamData(null);

    try {
      const targetApi = `${WORKER_API_BASE}/api/resolve?url=https://terabox.com/s/${item.surl}`;
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
        surl: item.surl,
      });
    } catch (err: any) {
      console.error("Modal stream resolve error:", err);
      setModalError(err.message || "Failed to load stream. Please try again.");
    } finally {
      setModalLoading(false);
    }
  };

  // Direct Download Trigger
  const handleDownload = (item: VideoItem) => {
    if (!item.surl) return;
    const targetUrl = `https://terabox.com/s/${item.surl}`;
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

  return (
    <div className="min-h-screen bg-[#f8f9fc] dark:bg-[#090a0f] text-zinc-900 dark:text-zinc-100 flex flex-col transition-colors duration-200">
      {/* Top Header Navigation */}
      <Navbar onOpenShortcuts={() => setIsShortcutsOpen(true)} />

      {/* Main Content Container */}
      <main className="flex-1 max-w-[1400px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
        
        {/* Top Header Row: Browse Title & High-Tech Search Bar */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          
          {/* Left Title: Browse with Vertical Accent Bar */}
          <div className="flex items-center gap-3">
            <div className="h-8 w-1.5 rounded-full bg-blue-600 shadow-sm shadow-blue-500/50" />
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-zinc-950 dark:text-white">
              Browse
            </h1>
          </div>

          {/* Right: Search Input Capsule (Exact IteraPlay Style) */}
          <form
            onSubmit={handleSearchSubmit}
            className="relative flex-1 max-w-xl flex items-center bg-white dark:bg-[#13141f] border border-zinc-200 dark:border-[#242536] rounded-2xl p-1.5 shadow-xs focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20 transition-all"
          >
            <div className="pl-3.5 pr-2 text-zinc-400">
              <SlidersHorizontal className="h-4 w-4" strokeWidth={2.2} />
            </div>

            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search TeraBox videos, movies, anime..."
              className="w-full bg-transparent text-sm font-semibold text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-500 outline-none px-1"
            />

            {/* Clear Button */}
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-[#202030] transition-colors cursor-pointer mr-1"
                title="Clear input"
              >
                <X className="h-4 w-4" />
              </button>
            )}

            {/* Submit Search Button */}
            <button
              type="submit"
              className="h-9 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center gap-2 shadow-xs shadow-blue-600/30 transition-all cursor-pointer active:scale-95"
            >
              <Search className="h-3.5 w-3.5" strokeWidth={2.4} />
              <span className="hidden xs:inline">Search</span>
            </button>
          </form>
        </div>

        {/* Popular Quick-Search Tags */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs no-scrollbar">
          <span className="text-zinc-400 dark:text-zinc-500 font-bold flex items-center gap-1.5 shrink-0">
            <Flame className="h-3.5 w-3.5 text-amber-500" />
            Trending:
          </span>
          {POPULAR_SEARCHES.map((tag) => (
            <button
              key={tag}
              onClick={() => handleTagClick(tag)}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all shrink-0 cursor-pointer ${
                activeQuery.toLowerCase() === tag.toLowerCase()
                  ? "bg-blue-600 text-white shadow-xs"
                  : "bg-white dark:bg-[#14141f] text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-[#222230] hover:border-blue-500/50 hover:text-zinc-900 dark:hover:text-white"
              }`}
            >
              {tag}
            </button>
          ))}
        </div>

        {/* Sub-Header Banner: Found X Results + Clear All (Exact IteraPlay Style) */}
        <div className="flex items-center justify-between pt-2 pb-1 border-t border-zinc-200/80 dark:border-white/[0.06]">
          {/* Left: Found X Results indicator */}
          <div className="flex items-center gap-2.5">
            <div className="h-5 w-1 rounded-full bg-amber-500" />
            <h2 className="text-sm sm:text-base font-extrabold text-zinc-950 dark:text-white tracking-tight">
              {activeQuery ? (
                <>
                  Found <span className="text-blue-500">{totalResults}</span> Results for &ldquo;{activeQuery}&rdquo;
                </>
              ) : (
                <>
                  Trending Videos <span className="text-zinc-400">({totalResults})</span>
                </>
              )}
            </h2>
          </div>

          {/* Right: Clear All Button */}
          {activeQuery && (
            <button
              onClick={handleClearAll}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-red-500 hover:text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 transition-all cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
              <span>Clear All</span>
            </button>
          )}
        </div>

        {/* Filter Pills Row (Sort & Quality Pills) */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-white/70 dark:bg-[#11121a]/80 backdrop-blur-md p-2.5 rounded-2xl border border-zinc-200 dark:border-white/[0.06]">
          {/* Quality Filters */}
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-zinc-400 dark:text-zinc-500 font-bold px-1 hidden sm:inline">
              Quality:
            </span>
            {(["all", "1080p", "720p", "480p"] as const).map((q) => (
              <button
                key={q}
                onClick={() => handleFilterChange(selectedSort, q, selectedDuration)}
                className={`px-3 py-1.5 rounded-xl font-bold uppercase transition-all cursor-pointer ${
                  selectedQuality === q
                    ? "bg-blue-600 text-white shadow-xs"
                    : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-[#1a1b28]"
                }`}
              >
                {q}
              </button>
            ))}
          </div>

          {/* Sort Filters */}
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-zinc-400 dark:text-zinc-500 font-bold px-1 hidden sm:inline">
              Sort:
            </span>
            {(["trending", "latest"] as const).map((s) => (
              <button
                key={s}
                onClick={() => handleFilterChange(s, selectedQuality, selectedDuration)}
                className={`px-3 py-1.5 rounded-xl font-bold capitalize transition-all cursor-pointer ${
                  selectedSort === s
                    ? "bg-blue-600 text-white shadow-xs"
                    : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-[#1a1b28]"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Error Alert Box */}
        {errorMessage && (
          <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-500 dark:text-red-400 flex items-center justify-between text-sm font-semibold">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-5 w-5 shrink-0" />
              <span>{errorMessage}</span>
            </div>
            <button
              onClick={() => fetchVideos(activeQuery, selectedSort, selectedQuality, selectedDuration, 0, false)}
              className="px-3 py-1 rounded-xl bg-red-500 text-white font-bold text-xs hover:bg-red-600 transition-colors"
            >
              Retry
            </button>
          </div>
        )}

        {/* Video Cards Grid */}
        {isLoading ? (
          // Skeleton Loading Shimmer Grid
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 sm:gap-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="rounded-2xl overflow-hidden bg-white dark:bg-[#12131d] border border-zinc-200 dark:border-white/[0.06] p-3 space-y-3 animate-pulse"
              >
                <div className="aspect-video w-full rounded-xl bg-zinc-200 dark:bg-zinc-800/60" />
                <div className="h-4 w-4/5 rounded-md bg-zinc-200 dark:bg-zinc-800/60" />
                <div className="h-3 w-1/3 rounded-md bg-zinc-200 dark:bg-zinc-800/60" />
                <div className="h-9 w-full rounded-xl bg-zinc-200 dark:bg-zinc-800/60" />
              </div>
            ))}
          </div>
        ) : videoList.length === 0 ? (
          // Empty State
          <div className="py-20 text-center space-y-4 max-w-md mx-auto">
            <div className="h-16 w-16 mx-auto rounded-3xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-500">
              <Film className="h-8 w-8" strokeWidth={2} />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-zinc-950 dark:text-white">
                No videos found
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                We couldn&apos;t find any TeraBox videos matching &ldquo;{activeQuery}&rdquo;. Try another search term or browse popular tags.
              </p>
            </div>
            <div className="pt-2 flex flex-wrap justify-center gap-2">
              {POPULAR_SEARCHES.slice(0, 5).map((t) => (
                <button
                  key={t}
                  onClick={() => handleTagClick(t)}
                  className="px-3 py-1 rounded-xl bg-zinc-100 dark:bg-[#1a1b26] text-xs font-bold text-blue-500 hover:bg-blue-600 hover:text-white transition-all cursor-pointer"
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        ) : (
          // Video Cards Grid (Exact IteraPlay / TeraViralHub Layout)
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 sm:gap-6">
            {videoList.map((item) => {
              const isBookmarked = bookmarkedIds.has(item.id);
              const isCopied = copiedId === item.id;
              const qualityBadgeColor =
                item.quality === "1080P"
                  ? "bg-[#2563eb] text-white"
                  : item.quality === "720P"
                  ? "bg-[#0284c7] text-white"
                  : "bg-[#6366f1] text-white";

              return (
                <article
                  key={item.id}
                  className="group relative flex flex-col rounded-2xl overflow-hidden bg-white dark:bg-[#12131d] border border-zinc-200 dark:border-white/[0.06] hover:border-blue-500/50 hover:shadow-xl hover:shadow-blue-500/5 transition-all duration-300"
                >
                  {/* Thumbnail Container (16:9) */}
                  <div 
                    onClick={() => handlePlayModal(item)}
                    className="relative aspect-video w-full overflow-hidden bg-zinc-900 cursor-pointer"
                  >
                    <img
                      src={item.thumbnail}
                      alt={item.title}
                      loading="lazy"
                      onError={(e) => {
                        // Fallback image on broken thumbnail
                        (e.target as HTMLImageElement).src =
                          "https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=600&auto=format&fit=crop&q=60";
                      }}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />

                    {/* Gradient Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30 pointer-events-none" />

                    {/* Top-Left Quality Badge */}
                    <div className="absolute top-2.5 left-2.5">
                      <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md shadow-md ${qualityBadgeColor}`}>
                        {item.quality}
                      </span>
                    </div>

                    {/* Top-Right Views Badge */}
                    <div className="absolute top-2.5 right-2.5">
                      <span className="flex items-center gap-1 bg-black/60 backdrop-blur-xs text-white text-[10px] font-mono font-bold px-2 py-0.5 rounded-md">
                        <Eye className="h-3 w-3" />
                        {item.views}
                      </span>
                    </div>

                    {/* Bottom-Left Duration Badge */}
                    <div className="absolute bottom-2.5 left-2.5">
                      <span className="flex items-center gap-1 bg-black/75 backdrop-blur-xs text-white text-[11px] font-mono font-bold px-2 py-0.5 rounded-md shadow-xs">
                        <Clock className="h-3 w-3 text-blue-400" />
                        {item.duration}
                      </span>
                    </div>

                    {/* Bottom-Right File Size Badge */}
                    <div className="absolute bottom-2.5 right-2.5">
                      <span className="bg-black/75 backdrop-blur-xs text-white text-[11px] font-mono font-bold px-2 py-0.5 rounded-md shadow-xs">
                        {item.size}
                      </span>
                    </div>

                    {/* Hover Center Play Button */}
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
                      <div className="h-12 w-12 rounded-full bg-blue-600/90 text-white flex items-center justify-center shadow-lg shadow-blue-600/40 transform scale-90 group-hover:scale-100 transition-transform">
                        <Play className="h-5 w-5 fill-white ml-0.5" />
                      </div>
                    </div>
                  </div>

                  {/* Card Body Info */}
                  <div className="p-3.5 flex flex-col justify-between flex-1 space-y-3">
                    <div>
                      {/* Video Title */}
                      <h3
                        onClick={() => handlePlayModal(item)}
                        title={item.title}
                        className="text-xs sm:text-sm font-bold text-zinc-900 dark:text-zinc-100 line-clamp-2 hover:text-blue-500 cursor-pointer transition-colors leading-snug"
                      >
                        {item.title}
                      </h3>

                      {/* Date */}
                      <p className="text-[11px] font-medium text-zinc-400 dark:text-zinc-500 mt-1">
                        {formatDate(item.createdAt)}
                      </p>
                    </div>

                    {/* Card Action Buttons (Exact IteraPlay Row: Bookmark, Download, Share, Flag) */}
                    <div className="flex items-center gap-1.5 pt-1 border-t border-zinc-100 dark:border-white/[0.05]">
                      
                      {/* 1. Bookmark Button */}
                      <button
                        onClick={() => handleToggleBookmark(item)}
                        className={`h-9 w-9 rounded-xl border flex items-center justify-center transition-all cursor-pointer active:scale-95 shrink-0 ${
                          isBookmarked
                            ? "bg-amber-500/15 border-amber-500/30 text-amber-500"
                            : "bg-zinc-100 dark:bg-[#181926] border-zinc-200 dark:border-[#262738] text-zinc-500 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white"
                        }`}
                        title={isBookmarked ? "Bookmarked" : "Bookmark Video"}
                      >
                        <Bookmark className={`h-4 w-4 ${isBookmarked ? "fill-amber-500" : ""}`} />
                      </button>

                      {/* 2. Download Button (Green) */}
                      <button
                        onClick={() => handleDownload(item)}
                        className="flex-1 h-9 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-black text-xs flex items-center justify-center gap-1.5 shadow-sm shadow-emerald-600/30 transition-all cursor-pointer active:scale-95"
                        title="Download Video via OnlinePlayer Engine"
                      >
                        <Download className="h-4 w-4" strokeWidth={2.4} />
                        <span className="hidden xs:inline">Download</span>
                      </button>

                      {/* 3. Share Button (Blue) */}
                      <button
                        onClick={() => handleCopyLink(item)}
                        className="h-9 w-9 rounded-xl bg-blue-600/15 hover:bg-blue-600 border border-blue-500/30 text-blue-500 hover:text-white flex items-center justify-center transition-all cursor-pointer active:scale-95 shrink-0"
                        title={isCopied ? "Link Copied!" : "Share / Copy Link"}
                      >
                        {isCopied ? (
                          <Check className="h-4 w-4 text-emerald-400" />
                        ) : (
                          <Share2 className="h-4 w-4" />
                        )}
                      </button>

                      {/* 4. Play in Full Player Page */}
                      <a
                        href={`/?url=${encodeURIComponent(item.shareUrl || `https://terabox.com/s/${item.surl}`)}`}
                        className="h-9 w-9 rounded-xl bg-zinc-100 dark:bg-[#181926] border border-zinc-200 dark:border-[#262738] text-zinc-500 dark:text-zinc-400 hover:text-blue-500 hover:border-blue-500/40 flex items-center justify-center transition-all cursor-pointer active:scale-95 shrink-0"
                        title="Open in Full OnlinePlayer Page"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {/* Load More Button */}
        {!isLoading && videoList.length > 0 && videoList.length < totalResults && (
          <div className="pt-6 text-center">
            <button
              onClick={handleLoadMore}
              disabled={isLoadingMore}
              className="px-6 py-3 rounded-2xl bg-white dark:bg-[#13141f] border border-zinc-200 dark:border-[#242536] hover:border-blue-500 text-sm font-bold text-zinc-800 dark:text-zinc-200 hover:text-blue-500 shadow-sm transition-all cursor-pointer active:scale-95 disabled:opacity-50 flex items-center gap-2 mx-auto"
            >
              {isLoadingMore ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                  <span>Loading more videos...</span>
                </>
              ) : (
                <>
                  <span>Load More Videos ({videoList.length} of {totalResults})</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </div>
        )}
      </main>

      {/* In-Page Video Player Modal */}
      {activeModalVideo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative w-full max-w-4xl bg-white dark:bg-[#0f1017] rounded-3xl overflow-hidden border border-zinc-200 dark:border-white/[0.08] shadow-2xl flex flex-col max-h-[90vh]">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-200 dark:border-[#1e202e]">
              <div className="flex items-center gap-2.5 truncate pr-3">
                <PlayCircle className="h-5 w-5 text-blue-500 shrink-0" />
                <h3 className="text-sm sm:text-base font-extrabold text-zinc-950 dark:text-white truncate">
                  {activeModalVideo.title}
                </h3>
              </div>

              <button
                onClick={() => {
                  setActiveModalVideo(null);
                  setModalStreamData(null);
                }}
                className="p-1.5 rounded-xl text-zinc-400 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-[#1a1b28] transition-colors cursor-pointer"
                title="Close Player"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Player Content */}
            <div className="relative aspect-video w-full bg-black">
              {modalLoading ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center space-y-3 text-white">
                  <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                  <p className="text-xs font-bold tracking-wider uppercase text-zinc-400">
                    Resolving full video stream...
                  </p>
                </div>
              ) : modalError ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center space-y-3 text-red-400">
                  <AlertCircle className="h-10 w-10" />
                  <p className="text-sm font-bold">{modalError}</p>
                  <a
                    href={`/?url=${encodeURIComponent(`https://terabox.com/s/${activeModalVideo.surl}`)}`}
                    className="px-4 py-2 rounded-xl bg-blue-600 text-white font-bold text-xs"
                  >
                    Open in Full OnlinePlayer
                  </a>
                </div>
              ) : modalStreamData ? (
                <VideoPlayer
                  streamData={modalStreamData}
                  isTheaterMode={false}
                  onToggleTheater={() => {}}
                />
              ) : null}
            </div>

            {/* Modal Footer Controls */}
            <div className="p-4 bg-zinc-50 dark:bg-[#12131d] flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-3 text-zinc-500 dark:text-zinc-400 font-mono font-bold">
                <span>Duration: {activeModalVideo.duration}</span>
                <span>•</span>
                <span>Size: {activeModalVideo.size}</span>
                <span>•</span>
                <span className="uppercase text-blue-500">{activeModalVideo.quality}</span>
              </div>

              <div className="flex items-center gap-2">
                {/* Download via OnlinePlayer Button */}
                <button
                  onClick={() => handleDownload(activeModalVideo)}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black flex items-center gap-1.5 shadow-sm shadow-emerald-600/30 cursor-pointer"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Download</span>
                </button>

                {/* Open in Main Player Page */}
                <a
                  href={`/?url=${encodeURIComponent(activeModalVideo.shareUrl || `https://terabox.com/s/${activeModalVideo.surl}`)}`}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-black flex items-center gap-1.5 shadow-sm shadow-blue-600/30"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  <span>Open Full Page</span>
                </a>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Keyboard Shortcuts Modal */}
      <ShortcutsModal
        isOpen={isShortcutsOpen}
        onClose={() => setIsShortcutsOpen(false)}
      />
    </div>
  );
}
