"use client";

import React, { useState } from "react";
import { 
  Download, 
  Copy, 
  Check, 
  Film, 
  Clock, 
  HardDrive, 
  ShieldCheck, 
  FolderOpen,
  PlayCircle
} from "lucide-react";

export interface FileItem {
  fs_id: string;
  filename: string;
  size_formatted: string;
  duration_formatted?: string;
  thumbnail?: string;
  stream_url: string;
  stream_url_360?: string;
}

interface VideoMetaCardProps {
  title: string;
  durationFormatted?: string;
  sizeFormatted?: string;
  streamUrl: string;
  files?: FileItem[];
  currentFileIndex: number;
  onSelectFile: (index: number) => void;
  isCached?: boolean;
}

export const VideoMetaCard: React.FC<VideoMetaCardProps> = ({
  title,
  durationFormatted,
  sizeFormatted,
  streamUrl,
  files = [],
  currentFileIndex,
  onSelectFile,
  isCached = false,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(streamUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    window.open(streamUrl, "_blank");
  };

  return (
    <div className="w-full max-w-5xl mx-auto space-y-4">
      {/* Primary Card */}
      <div className="p-5 sm:p-7 rounded-3xl bg-white dark:bg-[#18181f] border border-zinc-200 dark:border-[#272733] shadow-xl shadow-zinc-950/5 dark:shadow-black/40">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          
          {/* Title & Metadata */}
          <div className="space-y-2.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-50 dark:bg-blue-950/70 text-blue-600 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60">
                <ShieldCheck className="h-3.5 w-3.5" strokeWidth={2.5} />
                Full 1080p / 720p Stream
              </span>

              {isCached && (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50">
                  Instant Edge Hit
                </span>
              )}
            </div>

            <h1 className="text-xl sm:text-2xl font-bold text-zinc-950 dark:text-white tracking-tight leading-snug">
              {title}
            </h1>

            {/* Meta Info Badges */}
            <div className="flex items-center gap-4 text-xs font-medium text-zinc-600 dark:text-zinc-400 flex-wrap">
              {durationFormatted && (
                <div className="flex items-center gap-1.5">
                  <Clock className="h-4 w-4 text-zinc-400" strokeWidth={2.3} />
                  <span>{durationFormatted}</span>
                </div>
              )}

              {sizeFormatted && (
                <div className="flex items-center gap-1.5">
                  <HardDrive className="h-4 w-4 text-zinc-400" strokeWidth={2.3} />
                  <span>{sizeFormatted}</span>
                </div>
              )}

              <div className="flex items-center gap-1.5">
                <Film className="h-4 w-4 text-zinc-400" strokeWidth={2.3} />
                <span>HLS Adaptive Stream</span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
            <button
              onClick={handleCopy}
              className="px-4 py-2.5 rounded-xl text-xs font-bold text-zinc-800 dark:text-zinc-200 bg-zinc-100 dark:bg-[#121217] hover:bg-zinc-200 dark:hover:bg-[#20202a] border border-zinc-300 dark:border-[#2a2a38] transition-colors flex items-center gap-1.5"
              title="Copy M3U8 stream URL for VLC"
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4 text-emerald-500" strokeWidth={2.5} />
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" strokeWidth={2.3} />
                  <span>Copy Stream URL</span>
                </>
              )}
            </button>

            <a
              href={`vlc://${streamUrl}`}
              className="px-4 py-2.5 rounded-xl text-xs font-bold text-zinc-800 dark:text-zinc-200 bg-zinc-100 dark:bg-[#121217] hover:bg-zinc-200 dark:hover:bg-[#20202a] border border-zinc-300 dark:border-[#2a2a38] transition-colors flex items-center gap-1.5"
              title="Open stream in VLC Media Player"
            >
              <Film className="h-4 w-4" strokeWidth={2.3} />
              <span>VLC Player</span>
            </a>

            <button
              onClick={handleDownload}
              className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-[#059669] hover:bg-[#047857] shadow-md shadow-emerald-600/20 transition-all flex items-center gap-1.5 active:scale-95"
            >
              <Download className="h-4 w-4" strokeWidth={2.5} />
              <span>Direct Download</span>
            </button>
          </div>
        </div>
      </div>

      {/* Multi-File Episode/Playlist Selector (if files > 1) */}
      {files.length > 1 && (
        <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-[#18181f] border border-zinc-200 dark:border-[#272733] shadow-md">
          <div className="flex items-center gap-2 mb-4 text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            <FolderOpen className="h-4 w-4 text-blue-500" strokeWidth={2.3} />
            <span>Folder Playlist ({files.length} Videos)</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {files.map((file, idx) => (
              <button
                key={file.fs_id || idx}
                onClick={() => onSelectFile(idx)}
                className={`p-3.5 rounded-2xl border text-left transition-all flex items-center gap-3 ${
                  idx === currentFileIndex
                    ? "bg-blue-50 dark:bg-blue-950/40 border-blue-500 text-blue-700 dark:text-blue-300 shadow-sm"
                    : "bg-zinc-50 dark:bg-[#121217] border-zinc-200 dark:border-[#262633] text-zinc-700 dark:text-zinc-300 hover:border-zinc-400 dark:hover:border-zinc-700"
                }`}
              >
                <div className={`p-2 rounded-xl shrink-0 ${
                  idx === currentFileIndex
                    ? "bg-blue-600 text-white"
                    : "bg-zinc-200 dark:bg-[#20202a] text-zinc-600 dark:text-zinc-400"
                }`}>
                  <PlayCircle className="h-4 w-4" strokeWidth={2.4} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold truncate">
                    {file.filename}
                  </p>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                    {file.size_formatted} {file.duration_formatted ? `• ${file.duration_formatted}` : ""}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
