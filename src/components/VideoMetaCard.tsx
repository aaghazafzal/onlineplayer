"use client";

import React, { useState, useRef, useEffect } from "react";
import { 
  Download, 
  Copy, 
  Check, 
  Film, 
  Clock, 
  HardDrive, 
  ShieldCheck, 
  FolderOpen,
  PlayCircle,
  Loader2,
  X,
  AlertCircle
} from "lucide-react";
import { downloadVideoStream, DownloadProgress } from "../utils/hlsDownloader";

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
  autoStartDownload?: boolean;
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
  autoStartDownload = false,
}) => {
  const [copied, setCopied] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgress | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const hasAutoStartedRef = useRef<boolean>(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(streamUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = async () => {
    // If currently downloading, clicking cancels the download
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
      setTimeout(() => setDownloadProgress(null), 2500);
      return;
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      await downloadVideoStream(
        streamUrl,
        title,
        (prog) => {
          setDownloadProgress({ ...prog });
          if (prog.status === "completed") {
            setTimeout(() => {
              setDownloadProgress(null);
            }, 4500);
          }
        },
        controller.signal
      );
    } catch (err: any) {
      if (err.message !== "Download cancelled") {
        console.error("Download failed:", err);
        setDownloadProgress({
          status: "error",
          percent: 0,
          downloadedChunks: 0,
          totalChunks: 0,
          downloadedBytes: 0,
          speedMBs: 0,
          error: err.message || "Failed to download",
        });
        setTimeout(() => setDownloadProgress(null), 5000);
      }
    }
  };

  // Auto-start download if triggered from input bar
  useEffect(() => {
    if (autoStartDownload && !hasAutoStartedRef.current && streamUrl) {
      hasAutoStartedRef.current = true;
      handleDownload();
    }
  }, [autoStartDownload, streamUrl]);

  return (
    <div className="w-full max-w-[1360px] mx-auto space-y-5">
      {/* Primary Card */}
      <div className="p-5 sm:p-7 rounded-3xl bg-white dark:bg-[#18181f] border border-zinc-200 dark:border-[#272733] shadow-xl shadow-zinc-950/5 dark:shadow-black/40 overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 min-w-0 w-full">
          
          {/* Title & Metadata (min-w-0 with word break to prevent screen overflow) */}
          <div className="space-y-2.5 min-w-0 flex-1 w-full overflow-hidden">
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

            {/* Title with full wrap support for long underscore filenames */}
            <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-zinc-950 dark:text-white tracking-tight leading-snug break-all sm:break-words [overflow-wrap:anywhere]">
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
          <div className="flex items-center gap-2.5 shrink-0 flex-wrap w-full lg:w-auto">
            <button
              onClick={handleCopy}
              className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl text-xs font-bold text-zinc-800 dark:text-zinc-200 bg-zinc-100 dark:bg-[#121217] hover:bg-zinc-200 dark:hover:bg-[#20202a] border border-zinc-300 dark:border-[#2a2a38] transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
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
                  <span>Copy URL</span>
                </>
              )}
            </button>

            <a
              href={`vlc://${streamUrl}`}
              className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl text-xs font-bold text-zinc-800 dark:text-zinc-200 bg-zinc-100 dark:bg-[#121217] hover:bg-zinc-200 dark:hover:bg-[#20202a] border border-zinc-300 dark:border-[#2a2a38] transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              title="Open stream in VLC Media Player"
            >
              <Film className="h-4 w-4" strokeWidth={2.3} />
              <span>VLC Player</span>
            </a>

            {/* Direct Download Button with Real-Time In-Browser Progress */}
            {downloadProgress && (downloadProgress.status === "downloading" || downloadProgress.status === "preparing" || downloadProgress.status === "assembling") ? (
              <div className="w-full sm:w-auto min-w-[210px]">
                <button
                  onClick={handleDownload}
                  className="relative overflow-hidden w-full px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-rose-600 transition-all flex items-center justify-between gap-3 shadow-md shadow-blue-600/20 cursor-pointer group"
                  title="Click to cancel download"
                >
                  {/* Visual Progress Fill */}
                  <div 
                    className="absolute inset-y-0 left-0 bg-blue-500/60 transition-all duration-300"
                    style={{ width: `${downloadProgress.percent}%` }}
                  />

                  {/* Left Label */}
                  <div className="relative z-10 flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin text-white shrink-0" strokeWidth={2.6} />
                    <span className="truncate">
                      {downloadProgress.status === "assembling"
                        ? "Saving File..."
                        : `Downloading ${downloadProgress.percent}%`}
                    </span>
                  </div>

                  {/* Right Details / Cancel on hover */}
                  <div className="relative z-10 flex items-center gap-1.5 text-[11px] font-mono shrink-0 pl-2">
                    <span className="group-hover:hidden opacity-95">
                      {downloadProgress.speedMBs > 0 ? `${downloadProgress.speedMBs} MB/s` : `${downloadProgress.downloadedChunks}/${downloadProgress.totalChunks}`}
                    </span>
                    <span className="hidden group-hover:inline-flex items-center gap-1 text-white font-bold">
                      <X className="h-3.5 w-3.5" strokeWidth={3} />
                      <span>Cancel</span>
                    </span>
                  </div>
                </button>
              </div>
            ) : downloadProgress?.status === "completed" ? (
              <button
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-emerald-600 transition-all flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/20"
              >
                <Check className="h-4 w-4 text-white" strokeWidth={3} />
                <span>Downloaded!</span>
              </button>
            ) : downloadProgress?.status === "error" ? (
              <button
                onClick={handleDownload}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-md shadow-rose-600/20"
                title={downloadProgress.error || "Download error. Click to retry."}
              >
                <AlertCircle className="h-4 w-4 text-white" strokeWidth={2.4} />
                <span>Retry Download</span>
              </button>
            ) : (
              <button
                onClick={handleDownload}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-[#059669] hover:bg-[#047857] shadow-md shadow-emerald-600/20 transition-all flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer"
              >
                <Download className="h-4 w-4" strokeWidth={2.5} />
                <span>Direct Download</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Multi-File Episode/Playlist Selector (if files > 1) */}
      {files.length > 1 && (
        <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-[#18181f] border border-zinc-200 dark:border-[#272733] shadow-md overflow-hidden">
          <div className="flex items-center gap-2 mb-4 text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            <FolderOpen className="h-4 w-4 text-blue-500" strokeWidth={2.3} />
            <span>Folder Playlist ({files.length} Videos)</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {files.map((file, idx) => (
              <button
                key={file.fs_id || idx}
                onClick={() => onSelectFile(idx)}
                className={`p-3.5 rounded-2xl border text-left transition-all flex items-center gap-3 min-w-0 ${
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
                <div className="min-w-0 flex-1 overflow-hidden">
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
