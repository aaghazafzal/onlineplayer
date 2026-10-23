"use client";

import React, { useState, useEffect } from "react";
import { AlertCircle } from "lucide-react";
import { SiteHeader } from "../components/SiteHeader";
import { LinkBox } from "../components/LinkBox";
import { Segments } from "../components/Segments";
import { RevealObserver } from "../components/RevealObserver";
import { HeroStage, ProviderShowcase, HowItWorks, LinkFormats, Faq, SiteFooter } from "../components/HomeSections";
import { VideoPlayer, StreamData } from "../components/VideoPlayer";
import { VideoMetaCard, FileItem } from "../components/VideoMetaCard";
import { InstagramPostViewer, InstagramPostData } from "../components/InstagramPostViewer";
import { AudioPlayer, SpotifyTrackData } from "../components/AudioPlayer";
import { SpotifyPlaylistViewer, SpotifyPlaylistData } from "../components/SpotifyPlaylistViewer";
import { RecentStreams, HistoryItem } from "../components/RecentStreams";
import { ShortcutsModal } from "../components/ShortcutsModal";
import { resolveLink } from "../lib/resolvers";

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

  // Load history from localStorage and check query params for auto-resolve
  useEffect(() => {
    try {
      const saved = localStorage.getItem("onlineplayer_history") || localStorage.getItem("omni_history");
      // Reading browser storage after hydration (the static HTML has no history)
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (saved) setHistoryItems(JSON.parse(saved));
    } catch (e) {
      console.warn("Failed to load history:", e);
    }

    // Auto-resolve if ?url= or ?play= is in the address
    const params = new URLSearchParams(window.location.search);
    const targetUrl = params.get("url") || params.get("play");
    const shouldDownload = params.get("download") === "1" || params.get("action") === "download";
    if (targetUrl) handleResolve(targetUrl, shouldDownload);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on load
  }, []);

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

  const hasPlayer = Boolean(streamData || instagramData || spotifyData || spotifyPlaylistData);

  return (
    <div id="top" className="min-h-svh flex flex-col bg-bg text-ink">
      <RevealObserver />
      <SiteHeader onOpenShortcuts={() => setIsShortcutsOpen(true)} />

      <main className="flex-1">
        {/* ============ Hero: the paper card with the tool, beside the stage ============ */}
        <section id="play" aria-labelledby="hero-title" className="scroll-mt-20">
          <div className="frame grid grid-cols-1 lg:grid-cols-2 gap-3 pb-3 lg:min-h-[calc(100svh-72px)]">
            {/* The stage of sample players is desktop only; phones open straight on the link box */}
            <div className="hidden lg:block lg:order-2 lg:sticky lg:top-[84px] lg:h-[calc(100svh-96px)]">
              <HeroStage />
            </div>

            <div className="lg:order-1 relative z-10 flex flex-col rounded-ui bg-paper overflow-clip">
              <Segments count={40} played={0.72} markAt={6} play className="h-10 lg:h-14 gap-[3px] px-0" />

              <div className="flex flex-1 flex-col justify-center px-5 sm:px-10 lg:px-14 py-10 lg:py-14">
                <h1 id="hero-title" className="text-head leading-[1.02]">
                  <span className="rise-line"><span style={{ "--i": 0 } as React.CSSProperties}>Paste a link.</span></span>
                  <span className="rise-line"><span style={{ "--i": 1 } as React.CSSProperties}>Play it whole.</span></span>
                </h1>
                <p className="mt-8 max-w-[38ch] text-body text-ink">
                  TeraBox videos, Instagram posts, and Spotify and JioSaavn songs, played or saved in your browser. Free, with no login.
                </p>

                <div className="mt-10 max-w-[560px]">
                  <LinkBox onResolve={handleResolve} isLoading={isLoading} />
                </div>

                <nav aria-label="More" className="mt-12 flex flex-wrap gap-x-7 gap-y-3 text-[0.9375rem]">
                  <a className="link" href="/terabox-videos">Browse TeraBox videos</a>
                  <a className="link" href="#how">How it works</a>
                  <a className="link" href="https://status.onlineplayer.site">Service status</a>
                </nav>
              </div>
            </div>
          </div>
        </section>

        {/* ============ Errors and the active player ============ */}
        {errorMessage && (
          <div className="frame pt-10" role="alert">
            <div className="rounded-ui bg-danger-soft text-ink p-6 sm:p-8 max-w-3xl">
              <h2 className="text-lead font-semibold flex items-center gap-3">
                <AlertCircle className="h-6 w-6 text-danger shrink-0" strokeWidth={2.4} />
                That link did not open
              </h2>
              <p className="mt-3 text-body">{errorMessage}</p>
              <a href="#links" className="link mt-4 inline-block font-medium">
                See which links work
              </a>
            </div>
          </div>
        )}

        {hasPlayer && (
          <section id="player-container" aria-label="Player" className="frame pt-12 lg:pt-16 scroll-mt-24 space-y-6">
            {spotifyPlaylistData ? (
              <SpotifyPlaylistViewer key={`${spotifyPlaylistData.provider}:${spotifyPlaylistData.id}`} playlistData={spotifyPlaylistData} autoStartDownload={autoStartDownload} />
            ) : spotifyData ? (
              <AudioPlayer key={spotifyData.trackId} trackData={spotifyData} autoStartDownload={autoStartDownload} />
            ) : instagramData ? (
              <InstagramPostViewer postData={instagramData} autoStartDownload={autoStartDownload} />
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
          </section>
        )}

        {historyItems.length > 0 && (
          <div className="frame pt-12 lg:pt-16">
            <RecentStreams
              items={historyItems}
              onPlayItem={handlePlayHistoryItem}
              onClearHistory={handleClearHistory}
              onRemoveItem={handleRemoveHistoryItem}
            />
          </div>
        )}

        <div className="h-[var(--section-gap)]" aria-hidden="true" />

        <ProviderShowcase />
        <HowItWorks />
        <LinkFormats />
        <Faq />
      </main>

      <SiteFooter />

      <ShortcutsModal isOpen={isShortcutsOpen} onClose={() => setIsShortcutsOpen(false)} />
    </div>
  );
}
