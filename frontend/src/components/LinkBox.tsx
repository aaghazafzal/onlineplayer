"use client";

import React, { useRef, useState } from "react";
import { Play, Download, ClipboardPaste, X } from "lucide-react";
import { detectProvider, type ProviderKind } from "../lib/resolvers";
import { formatLatency, useServiceStatus, type ServiceId } from "../lib/status";

interface LinkBoxProps {
  onResolve: (url: string, autoDownload?: boolean) => void;
  isLoading: boolean;
}

const PROVIDER_COPY: Record<ProviderKind, { name: string; gives: string; service?: ServiceId }> = {
  terabox: { name: "TeraBox link", gives: "full video, 480p or 360p", service: "terabox" },
  instagram: { name: "Instagram post", gives: "videos and photos, every slide", service: "instagram" },
  spotify: { name: "Spotify link", gives: "full song at 320 kbps, or the whole playlist", service: "spotify" },
  jiosaavn: { name: "JioSaavn link", gives: "songs, albums, playlists and artists at 320 kbps", service: "jiosaavn" },
  direct: { name: "Direct video file", gives: "plays as it is" },
  diskwala: { name: "DiskWala link", gives: "not supported yet" },
};

/**
 * The page's live thing: paste any link and it says what it is, what you will get,
 * and whether that engine is up right now (from the health monitor).
 */
export function LinkBox({ onResolve, isLoading }: LinkBoxProps) {
  const [url, setUrl] = useState("");
  const [nudge, setNudge] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const status = useServiceStatus();
  const kind = url.trim() ? detectProvider(url) : null;
  const info = kind ? PROVIDER_COPY[kind] : null;
  const engine = info?.service ? status?.[info.service] : undefined;
  const canSubmit = Boolean(url.trim()) && !isLoading && kind !== "diskwala";

  // The buttons stay live: with an empty box they point you at the field instead
  const submit = (download: boolean) => {
    if (!url.trim()) {
      setNudge(true);
      inputRef.current?.focus();
      return;
    }
    if (!canSubmit) return;
    onResolve(url.trim(), download);
  };

  const paste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) setUrl(text.trim());
    } catch {
      // Clipboard permission denied: the field is still there to paste into by hand
    }
  };

  return (
    <form
      className="w-full"
      onSubmit={(e) => {
        e.preventDefault();
        submit(false);
      }}
    >
      <label htmlFor="link" className="sr-only">
        Link to play
      </label>
      <div className="flex items-stretch gap-2 rounded-ui bg-surface-2 p-2 focus-within:outline-3 focus-within:outline-accent">
        <input
          id="link"
          ref={inputRef}
          type="url"
          inputMode="url"
          autoComplete="off"
          spellCheck={false}
          value={url}
          onChange={(e) => {
            setUrl(e.target.value);
            setNudge(false);
          }}
          placeholder="Paste a TeraBox, Instagram, Spotify or JioSaavn link"
          className="min-w-0 flex-1 bg-transparent px-3 text-body text-ink placeholder:text-muted focus:outline-none"
          disabled={isLoading}
        />
        {url && (
          <button
            type="button"
            onClick={() => setUrl("")}
            aria-label="Clear link"
            className="btn btn-quiet min-h-[44px] w-11 px-0 bg-transparent"
          >
            <X className="h-5 w-5" strokeWidth={2.4} />
          </button>
        )}
        <button type="button" onClick={paste} className="btn btn-ink min-h-[44px] px-4 text-small">
          <ClipboardPaste className="h-4 w-4" strokeWidth={2.4} />
          Paste
        </button>
      </div>

      {/* What the box recognised, and whether that engine is up right now */}
      <p className="mt-3 min-h-[1.5em] text-small text-muted" aria-live="polite">
        {info ? (
          <>
            <span className="font-medium text-ink">{info.name}</span>
            {": "}
            {info.gives}
            {engine && (
              <>
                {" · "}
                <span className={engine.ok ? "text-ink" : "text-danger"}>
                  {engine.ok ? `engine up, answered in ${formatLatency(engine.latencyMs)}` : "engine is having trouble right now"}
                </span>
              </>
            )}
          </>
        ) : nudge ? (
          <span className="font-medium text-ink">Paste a link into the box first, then press Play.</span>
        ) : (
          "Works with share links from the app or the website."
        )}
      </p>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <button type="submit" disabled={isLoading} className="btn btn-accent w-full min-h-[56px]">
          {isLoading ? (
            <span className="h-5 w-5 rounded-full border-2 border-current border-r-transparent animate-[spin_0.8s_linear_infinite]" />
          ) : (
            <Play className="h-5 w-5 fill-current" strokeWidth={2.4} />
          )}
          {isLoading ? "Finding it" : "Play"}
        </button>
        <button type="button" disabled={isLoading} onClick={() => submit(true)} className="btn btn-ink w-full min-h-[56px]">
          <Download className="h-5 w-5" strokeWidth={2.4} />
          Download
        </button>
      </div>
    </form>
  );
}
