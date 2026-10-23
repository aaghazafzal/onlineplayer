"use client";

import React, { useState, useRef, useEffect } from "react";
import { Download, Copy, Check, PlayCircle, X, AlertCircle } from "lucide-react";
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
    } catch (caught) {
      const err = caught as Error;
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

  const isHls = streamUrl.includes("m3u8") || streamUrl.includes("/proxy?stream=");
  const busy = downloadProgress && ["downloading", "preparing", "assembling"].includes(downloadProgress.status);

  return (
    <div className="w-full space-y-3">
      <div className="rounded-ui bg-paper p-5 sm:p-7 flex flex-col lg:flex-row lg:items-end justify-between gap-6">
        <div className="min-w-0 flex-1">
          <h2 className="text-lead font-semibold tracking-[-0.02em] leading-snug [overflow-wrap:anywhere]">{title}</h2>
          <p className="mt-2 text-small text-muted flex flex-wrap gap-x-4 gap-y-1">
            {durationFormatted && <span className="tabular">{durationFormatted}</span>}
            {sizeFormatted && <span className="tabular">{sizeFormatted}</span>}
            <span>{isHls ? "Full-length HLS stream" : "Direct video file"}</span>
            {isCached && <span>Opened from cache</span>}
          </p>
        </div>

        <div className="flex flex-wrap gap-2 w-full lg:w-auto">
          <button onClick={handleCopy} className="btn btn-quiet flex-1 sm:flex-none min-h-[48px] text-small" title="Copy stream URL">
            {copied ? <Check className="h-4 w-4" strokeWidth={2.5} /> : <Copy className="h-4 w-4" strokeWidth={2.3} />}
            {copied ? "Copied" : "Copy URL"}
          </button>
          <a href={`vlc://${streamUrl}`} className="btn btn-quiet flex-1 sm:flex-none min-h-[48px] text-small" title="Open the stream in VLC">
            Open in VLC
          </a>

          {busy && downloadProgress ? (
            <button
              onClick={handleDownload}
              className="btn btn-ink relative overflow-clip w-full sm:w-auto sm:min-w-[240px] min-h-[48px] text-small justify-between"
              title="Cancel the download"
            >
              <span className="absolute inset-y-0 left-0 bg-accent transition-[width] duration-300" style={{ width: `${downloadProgress.percent}%` }} aria-hidden="true" />
              <span className="relative inline-flex items-center gap-2">
                <span className="h-4 w-4 rounded-full border-2 border-current border-r-transparent animate-[spin_0.8s_linear_infinite]" />
                {downloadProgress.status === "assembling" ? "Saving the file" : `Downloading ${downloadProgress.percent}%`}
              </span>
              <span className="relative inline-flex items-center gap-1 tabular">
                {downloadProgress.speedMBs > 0 ? `${downloadProgress.speedMBs} MB/s` : `${downloadProgress.downloadedChunks}/${downloadProgress.totalChunks}`}
                <X className="h-4 w-4" strokeWidth={2.6} aria-label="Cancel" />
              </span>
            </button>
          ) : downloadProgress?.status === "completed" ? (
            <span className="btn btn-accent w-full sm:w-auto min-h-[48px] text-small" role="status">
              <Check className="h-4 w-4" strokeWidth={3} /> Downloaded
            </span>
          ) : downloadProgress?.status === "error" ? (
            <button
              onClick={handleDownload}
              className="btn w-full sm:w-auto min-h-[48px] text-small bg-danger text-paper"
              title={downloadProgress.error || "Download failed. Try again."}
            >
              <AlertCircle className="h-4 w-4" strokeWidth={2.4} /> Try the download again
            </button>
          ) : (
            <button onClick={handleDownload} className="btn btn-accent w-full sm:w-auto min-h-[48px] text-small">
              <Download className="h-4 w-4" strokeWidth={2.5} /> Download MP4
            </button>
          )}
        </div>
      </div>

      {files.length > 1 && (
        <div className="rounded-ui bg-paper p-5 sm:p-6">
          <h3 className="text-body font-semibold">This folder has {files.length} videos</h3>
          <ul className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {files.map((file, idx) => {
              const active = idx === currentFileIndex;
              return (
                <li key={file.fs_id || idx}>
                  <button
                    onClick={() => onSelectFile(idx)}
                    aria-current={active}
                    className={`w-full min-h-[64px] p-3 rounded-ui text-left flex items-center gap-3 transition-colors ${
                      active ? "bg-accent text-accent-ink" : "bg-surface-2 hover:bg-surface"
                    }`}
                  >
                    <PlayCircle className="h-5 w-5 shrink-0" strokeWidth={2.2} />
                    <span className="min-w-0">
                      <span className="block text-small font-medium truncate">{file.filename}</span>
                      <span className={`block text-small tabular ${active ? "opacity-85" : "text-muted"}`}>
                        {file.size_formatted}
                        {file.duration_formatted ? ` · ${file.duration_formatted}` : ""}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
};
