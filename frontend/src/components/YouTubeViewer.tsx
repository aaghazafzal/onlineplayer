"use client";

import React, { useEffect, useRef, useState } from "react";
import { Download, ExternalLink, Music, Check, AlertCircle } from "lucide-react";
import { PROVIDER_ENDPOINTS } from "../lib/api";

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

interface YouTubeViewerProps {
  data: YouTubeData;
  autoStartDownload?: boolean;
}

type DlState = { kind: "video" | "audio"; status: "working" | "done" | "error"; progress: number; message?: string } | null;

/**
 * Plays through YouTube's own embedded player (no limits, nothing proxied).
 * Downloads go through the YouTube worker and are best-effort: YouTube sometimes
 * blocks them, and the worker's message is shown as is.
 */
export function YouTubeViewer({ data, autoStartDownload = false }: YouTubeViewerProps) {
  const isPlaylist = data.type === "playlist" && (data.videos?.length || 0) > 0;
  const [currentId, setCurrentId] = useState(isPlaylist ? data.startVideoId || data.videos![0].id : data.id);
  const [dl, setDl] = useState<DlState>(null);
  const started = useRef(false);

  const current = isPlaylist ? data.videos!.find((v) => v.id === currentId) : null;
  const title = current?.title || data.title;
  const channel = current?.channel || data.channel;

  const params = new URLSearchParams({ autoplay: "1", rel: "0", playsinline: "1", modestbranding: "1" });
  if (isPlaylist) params.set("list", data.id);
  const embedSrc = `https://www.youtube-nocookie.com/embed/${currentId}?${params}`;

  const download = async (kind: "video" | "audio") => {
    if (dl?.status === "working") return;
    setDl({ kind, status: "working", progress: 0 });
    try {
      const res = await fetch(`${PROVIDER_ENDPOINTS.youtube[0]}/api/download?v=${currentId}&kind=${kind}`);
      if (!res.ok || (res.headers.get("Content-Type") || "").includes("application/json")) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `The download failed (HTTP ${res.status}).`);
      }
      const total = Number(res.headers.get("Content-Length")) || 0;
      const reader = res.body!.getReader();
      const chunks: BlobPart[] = [];
      let got = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        got += value.length;
        if (total) setDl({ kind, status: "working", progress: got / total });
      }
      if (total && got < total) throw new Error("The download was cut off. Please try again.");
      const name = /filename\*=UTF-8''([^;]+)/.exec(res.headers.get("Content-Disposition") || "")?.[1];
      const blob = new Blob(chunks, { type: kind === "audio" ? "audio/mp4" : "video/mp4" });
      const href = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = href;
      a.download = name ? decodeURIComponent(name) : `${title}.${kind === "audio" ? "m4a" : "mp4"}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(href), 30_000);
      setDl({ kind, status: "done", progress: 1 });
      setTimeout(() => setDl(null), 4000);
    } catch (err) {
      setDl({ kind, status: "error", progress: 0, message: err instanceof Error ? err.message : "The download failed." });
    }
  };

  useEffect(() => {
    if (autoStartDownload && !started.current) {
      started.current = true;
      // Starting a download is what this effect is for
      // eslint-disable-next-line react-hooks/set-state-in-effect
      download("video");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per mount
  }, [autoStartDownload]);

  const button = (kind: "video" | "audio", label: string, style: string) => {
    const active = dl?.kind === kind && dl.status === "working";
    return (
      <button type="button" onClick={() => download(kind)} disabled={dl?.status === "working"} className={`btn ${style} relative overflow-clip min-h-[52px]`}>
        {active && <span className="absolute inset-y-0 left-0 bg-ink/20 transition-[width] duration-200" style={{ width: `${Math.round((dl?.progress || 0) * 100)}%` }} aria-hidden="true" />}
        <span className="relative inline-flex items-center gap-2">
          {active ? (
            <span className="h-4 w-4 rounded-full border-2 border-current border-r-transparent animate-[spin_0.8s_linear_infinite]" />
          ) : dl?.kind === kind && dl.status === "done" ? (
            <Check className="h-5 w-5" strokeWidth={2.5} />
          ) : kind === "audio" ? (
            <Music className="h-5 w-5" strokeWidth={2.4} />
          ) : (
            <Download className="h-5 w-5" strokeWidth={2.4} />
          )}
          {active ? (dl?.progress ? `Downloading ${Math.round(dl.progress * 100)}%` : "Preparing the file") : dl?.kind === kind && dl.status === "done" ? "Saved to your downloads" : label}
        </span>
      </button>
    );
  };

  return (
    <article className="w-full grid grid-cols-1 lg:grid-cols-12 gap-3" aria-label={`YouTube: ${title}`}>
      {/* YouTube's own player */}
      <div className={`lg:col-span-8 rounded-ui bg-stage overflow-clip ${data.isShort && !isPlaylist ? "flex justify-center" : ""}`}>
        <div className={data.isShort && !isPlaylist ? "aspect-[9/16] h-[min(78vh,760px)]" : "aspect-video w-full"}>
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

      <div className="lg:col-span-4 rounded-ui bg-paper p-5 sm:p-6 flex flex-col gap-5 min-w-0">
        <div className="min-w-0">
          <p className="text-small text-muted">
            YouTube{isPlaylist ? ` · Playlist · ${data.totalVideos || data.videos!.length} videos` : data.isShort ? " · Short" : ""}
          </p>
          <h2 className="mt-2 text-lead font-semibold tracking-[-0.02em] leading-snug [overflow-wrap:anywhere]">{title}</h2>
          {channel && <p className="mt-1 text-body text-muted truncate">{channel}</p>}
        </div>

        <div className="flex flex-col gap-2">
          {button("video", "Try video download (MP4)", "btn-accent")}
          {button("audio", "Try audio download (M4A)", "btn-ink")}
          {dl?.status === "error" ? (
            <p role="alert" className="rounded-ui bg-danger-soft p-3 text-small text-ink flex gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-danger" strokeWidth={2.4} />
              <span>{dl.message}</span>
            </p>
          ) : (
            <p className="text-small text-muted">YouTube sometimes blocks downloads from our servers. Playing always works.</p>
          )}
        </div>

        <a href={isPlaylist ? `https://www.youtube.com/watch?v=${currentId}&list=${data.id}` : data.sourceUrl} target="_blank" rel="noopener noreferrer" className="link text-small inline-flex items-center gap-1.5 self-start">
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
