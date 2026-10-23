"use client";

import React, { useEffect, useRef, useState } from "react";
import { Download, ExternalLink, Music, Check, AlertCircle, X } from "lucide-react";
import { VideoPlayer } from "./VideoPlayer";
import { fetchProviderJson } from "../lib/api";
import { downloadYouTubeAudio, downloadYouTubeVideo } from "../lib/youtubeDownload";

export interface YouTubeVideoItem {
  id: string;
  title: string;
  channel: string;
  duration: number;
  durationFormatted: string;
  thumbnail: string;
}

export interface YouTubeData {
  provider: "youtube";
  type: "video" | "playlist";
  id: string;
  title: string;
  channel: string;
  thumbnail?: string;
  isShort?: boolean;
  sourceUrl: string;
  // playlist only
  totalVideos?: number;
  videos?: YouTubeVideoItem[];
  startVideoId?: string;
}

interface StreamsInfo {
  ok: boolean;
  error?: string;
  botCheck?: boolean;
  title?: string;
  channel?: string;
  duration?: number;
  live?: boolean;
  hls?: string | null;
  qualities?: { itag: number; height: number; fps: number; size: number }[];
  audio?: { itag: number; bitrate: number; size: number } | null;
  segBase?: string;
}

interface YouTubeViewerProps {
  data: YouTubeData;
  autoStartDownload?: boolean;
}

type DlState = { kind: "video" | "audio"; stage: "downloading" | "joining" | "done" | "error"; progress: number; message?: string } | null;

const MAX_BROWSER_BYTES = 1.5 * 1024 ** 3; // the file is assembled in memory

function formatSize(bytes: number) {
  if (!bytes) return "";
  return bytes >= 1024 ** 3 ? `${(bytes / 1024 ** 3).toFixed(1)} GB` : `${Math.max(1, Math.round(bytes / 1024 ** 2))} MB`;
}

/**
 * Ad-free: the YouTube worker serves the video as HLS, played by our own player.
 * If YouTube refuses the worker for this video, YouTube's embedded player is the fallback.
 */
export function YouTubeViewer({ data, autoStartDownload = false }: YouTubeViewerProps) {
  const isPlaylist = data.type === "playlist" && (data.videos?.length || 0) > 0;
  const [currentId, setCurrentId] = useState(isPlaylist ? data.startVideoId || data.videos![0].id : data.id);
  const [streams, setStreams] = useState<StreamsInfo | null>(null);
  const [retryNonce, setRetryNonce] = useState(0);
  const [theater, setTheater] = useState(false);
  const [pickedItag, setPickedItag] = useState<number | null>(null);
  const [dl, setDl] = useState<DlState>(null);
  const abortRef = useRef<AbortController | null>(null);
  const autoStarted = useRef(false);

  const current = isPlaylist ? data.videos!.find((v) => v.id === currentId) : null;
  const title = streams?.title || current?.title || data.title;
  const channel = streams?.channel || current?.channel || data.channel;

  // Ask the worker for the ad-free stream of the current video
  useEffect(() => {
    let alive = true;
    // Loading state for the newly selected video
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStreams(null);
    setPickedItag(null);
    (async () => {
      let last: StreamsInfo = { ok: false };
      // YouTube's sign-in check comes and goes: try a few times before falling back
      for (let attempt = 0; attempt < 3 && alive; attempt++) {
        if (attempt > 0) await new Promise((r) => setTimeout(r, 1500 * attempt));
        try {
          const { data: s } = await fetchProviderJson<StreamsInfo>("youtube", `/api/streams?v=${currentId}`);
          last = s.ok ? s : { ok: false, error: s.error, botCheck: s.botCheck };
        } catch (err) {
          last = { ok: false, error: err instanceof Error ? err.message : "Could not reach the YouTube worker." };
        }
        if (last.ok || !last.botCheck) break;
      }
      if (alive) setStreams(last);
    })();
    return () => {
      alive = false;
    };
  }, [currentId, retryNonce]);

  const adFree = Boolean(streams?.ok && streams.hls && !streams.live);
  const qualities = streams?.qualities || [];
  const defaultItag = (qualities.find((q) => q.height <= 720) || qualities[qualities.length - 1])?.itag;
  const chosen = qualities.find((q) => q.itag === (pickedItag ?? defaultItag));

  const goNext = () => {
    if (!isPlaylist) return;
    const list = data.videos!;
    const i = list.findIndex((v) => v.id === currentId);
    if (i >= 0 && i + 1 < list.length) {
      setCurrentId(list[i + 1].id);
      setDl(null);
    }
  };

  const startDownload = async (kind: "video" | "audio") => {
    if (!streams?.ok || !streams.segBase || !streams.audio || dl?.stage === "downloading" || dl?.stage === "joining") return;
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setDl({ kind, stage: "downloading", progress: 0 });
    const onProgress = (progress: number, stage: "downloading" | "joining") => setDl({ kind, stage, progress });
    try {
      if (kind === "audio") {
        await downloadYouTubeAudio(streams.segBase, title, streams.audio, onProgress, ctrl.signal);
      } else {
        if (!chosen) throw new Error("No video quality is available.");
        if (chosen.size + streams.audio.size > MAX_BROWSER_BYTES) throw new Error("This quality is too large to assemble in the browser. Pick a lower one.");
        await downloadYouTubeVideo(streams.segBase, title, chosen, streams.audio, onProgress, ctrl.signal);
      }
      setDl({ kind, stage: "done", progress: 1 });
      setTimeout(() => setDl((d) => (d?.stage === "done" ? null : d)), 5000);
    } catch (err) {
      if (ctrl.signal.aborted) {
        setDl(null);
        return;
      }
      setDl({ kind, stage: "error", progress: 0, message: err instanceof Error ? err.message : "The download failed." });
    }
  };

  // Download pressed in the link box: start once the stream info is in
  useEffect(() => {
    if (autoStartDownload && adFree && !autoStarted.current) {
      autoStarted.current = true;
      startDownload("video");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, when ready
  }, [autoStartDownload, adFree]);

  const busy = dl?.stage === "downloading" || dl?.stage === "joining";
  const embedSrc = `https://www.youtube-nocookie.com/embed/${currentId}?${new URLSearchParams({ autoplay: "1", rel: "0", playsinline: "1" })}`;

  const dlButton = (kind: "video" | "audio", label: string, style: string) => {
    const mine = dl?.kind === kind;
    return (
      <button
        type="button"
        onClick={() => (mine && busy ? abortRef.current?.abort() : startDownload(kind))}
        disabled={busy && !mine}
        className={`btn ${style} relative overflow-clip min-h-[52px]`}
        title={mine && busy ? "Cancel the download" : undefined}
      >
        {mine && busy && (
          <span className="absolute inset-y-0 left-0 bg-ink/20 transition-[width] duration-200" style={{ width: `${Math.round((dl?.progress || 0) * 100)}%` }} aria-hidden="true" />
        )}
        <span className="relative inline-flex items-center gap-2">
          {mine && busy ? (
            <span className="h-4 w-4 rounded-full border-2 border-current border-r-transparent animate-[spin_0.8s_linear_infinite]" />
          ) : mine && dl?.stage === "done" ? (
            <Check className="h-5 w-5" strokeWidth={2.5} />
          ) : kind === "audio" ? (
            <Music className="h-5 w-5" strokeWidth={2.4} />
          ) : (
            <Download className="h-5 w-5" strokeWidth={2.4} />
          )}
          {mine && dl?.stage === "downloading"
            ? `Downloading ${Math.round(dl.progress * 100)}%`
            : mine && dl?.stage === "joining"
              ? "Joining video and sound"
              : mine && dl?.stage === "done"
                ? "Saved to your downloads"
                : label}
          {mine && busy && <X className="h-4 w-4 opacity-80" strokeWidth={2.6} aria-label="Cancel" />}
        </span>
      </button>
    );
  };

  return (
    <article className="w-full grid grid-cols-1 lg:grid-cols-12 gap-3" aria-label={`YouTube: ${title}`}>
      <div className={`${theater ? "lg:col-span-12" : "lg:col-span-8"} min-w-0`}>
        {streams === null ? (
          <div className="aspect-video w-full rounded-ui bg-stage text-stage-ink flex flex-col items-center justify-center gap-3">
            <span className="h-8 w-8 rounded-full border-[3px] border-current border-r-transparent animate-[spin_0.8s_linear_infinite]" />
            <p className="text-small text-stage-muted">Preparing the ad-free stream</p>
          </div>
        ) : adFree ? (
          <VideoPlayer
            key={currentId}
            streamData={{ streamUrl: streams.hls!, title, surl: `yt-${currentId}`, thumbnail: `https://i.ytimg.com/vi/${currentId}/hqdefault.jpg` }}
            isTheaterMode={theater}
            onToggleTheater={() => setTheater((t) => !t)}
            onEnded={goNext}
          />
        ) : (
          <div className="rounded-ui bg-stage overflow-clip">
            <div className="aspect-video w-full">
              <iframe
                key={currentId}
                src={embedSrc}
                title={title}
                className="h-full w-full"
                allow="autoplay; encrypted-media; picture-in-picture; fullscreen; clipboard-write"
                allowFullScreen
                referrerPolicy="strict-origin-when-cross-origin"
              />
            </div>
          </div>
        )}
      </div>

      <div className={`${theater ? "lg:col-span-12" : "lg:col-span-4"} rounded-ui bg-paper p-5 sm:p-6 flex flex-col gap-5 min-w-0`}>
        <div className="min-w-0">
          <p className="text-small text-muted">
            YouTube{isPlaylist ? ` · Playlist · ${data.totalVideos || data.videos!.length} videos` : data.isShort ? " · Short" : ""}
            {adFree ? " · No ads" : ""}
          </p>
          <h2 className="mt-2 text-lead font-semibold tracking-[-0.02em] leading-snug [overflow-wrap:anywhere]">{title}</h2>
          {channel && <p className="mt-1 text-body text-muted truncate">{channel}</p>}
        </div>

        {streams && !adFree && (
          <p role="status" className="rounded-ui bg-danger-soft p-3 text-small text-ink flex gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-danger" strokeWidth={2.4} />
            <span>
              {streams.live
                ? "Live streams play in YouTube's own player."
                : `${streams.error || "The ad-free stream is not available right now."} YouTube's own player is shown instead, which can include ads.`}
            </span>
          </p>
        )}
        {streams && !adFree && !streams.live && (
          <button type="button" onClick={() => setRetryNonce((n) => n + 1)} className="btn btn-accent min-h-[48px]">
            Try ad-free again
          </button>
        )}

        {adFree && (
          <div className="flex flex-col gap-3">
            <div role="radiogroup" aria-label="Download quality" className="flex flex-wrap gap-1">
              {qualities.map((q) => (
                <button
                  key={q.itag}
                  type="button"
                  role="radio"
                  aria-checked={chosen?.itag === q.itag}
                  onClick={() => setPickedItag(q.itag)}
                  disabled={busy}
                  className={`min-h-[40px] px-3 rounded-ui text-small transition-colors ${chosen?.itag === q.itag ? "bg-ink text-paper" : "bg-surface-2 hover:bg-surface"}`}
                >
                  {q.height}p
                </button>
              ))}
            </div>
            {dlButton("video", `Download MP4 ${chosen ? `${chosen.height}p · ${formatSize(chosen.size + (streams?.audio?.size || 0))}` : ""}`, "btn-accent")}
            {dlButton("audio", `Download audio M4A${streams?.audio ? ` · ${formatSize(streams.audio.size)}` : ""}`, "btn-ink")}
            {dl?.stage === "error" && (
              <p role="alert" className="rounded-ui bg-danger-soft p-3 text-small text-ink flex gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-danger" strokeWidth={2.4} />
                <span>{dl.message} Press the button to try again.</span>
              </p>
            )}
          </div>
        )}

        <a
          href={isPlaylist ? `https://www.youtube.com/watch?v=${currentId}&list=${data.id}` : data.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="link text-small inline-flex items-center gap-1.5 self-start"
        >
          Open on YouTube <ExternalLink className="h-4 w-4" strokeWidth={2.4} />
        </a>
      </div>

      {isPlaylist && (
        <div className="lg:col-span-12 rounded-ui bg-paper p-3 sm:p-5">
          <h3 className="px-1 text-body font-semibold">{data.title}</h3>
          <ol className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {data.videos!.map((v, i) => {
              const active = v.id === currentId;
              return (
                <li key={`${v.id}-${i}`}>
                  <button
                    type="button"
                    onClick={() => {
                      setCurrentId(v.id);
                      setDl(null);
                    }}
                    aria-current={active}
                    className={`w-full flex items-center gap-3 rounded-ui p-2 text-left transition-colors ${active ? "bg-accent text-accent-ink" : "hover:bg-surface-2"}`}
                  >
                    <span className="relative h-14 w-24 shrink-0 overflow-clip rounded-[4px] bg-stage">
                      <img src={v.thumbnail} alt="" loading="lazy" className="h-full w-full object-cover" />
                      {v.durationFormatted && (
                        <span className="absolute bottom-1 right-1 rounded-[3px] bg-stage px-1 text-[0.8125rem] text-stage-ink tabular">{v.durationFormatted}</span>
                      )}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-small font-medium line-clamp-2">{v.title}</span>
                      <span className={`block text-small truncate ${active ? "opacity-85" : "text-muted"}`}>{v.channel}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </div>
      )}
    </article>
  );
}
