"use client";

import React from "react";
import { History, Play, Trash2, Clock, Film } from "lucide-react";

export interface HistoryItem {
  surl: string;
  originalUrl: string;
  title: string;
  durationFormatted?: string;
  sizeFormatted?: string;
  thumbnail?: string;
  streamUrl: string;
  playedAt: number;
}

interface RecentStreamsProps {
  items: HistoryItem[];
  onPlayItem: (item: HistoryItem) => void;
  onClearHistory: () => void;
  onRemoveItem: (surl: string) => void;
}

export const RecentStreams: React.FC<RecentStreamsProps> = ({
  items,
  onPlayItem,
  onClearHistory,
  onRemoveItem,
}) => {
  if (items.length === 0) return null;

  const formatDate = (timestamp: number) => {
    const diff = Date.now() - timestamp;
    const mins = Math.floor(diff / (1000 * 60));
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  return (
    <div className="w-full max-w-5xl mx-auto space-y-4 pt-4">
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <History className="h-4.5 w-4.5 text-blue-500" strokeWidth={2.4} />
          <h2 className="text-sm font-bold text-zinc-900 dark:text-white">
            Recent Streams
          </h2>
          <span className="text-xs px-2.5 py-0.5 rounded-full bg-zinc-200 dark:bg-[#20202a] text-zinc-700 dark:text-zinc-300 font-bold">
            {items.length}
          </span>
        </div>

        <button
          onClick={onClearHistory}
          className="text-xs font-semibold text-zinc-500 hover:text-red-500 dark:text-zinc-400 dark:hover:text-red-400 transition-colors flex items-center gap-1.5"
        >
          <Trash2 className="h-3.5 w-3.5" strokeWidth={2.2} />
          <span>Clear History</span>
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {items.map((item) => (
          <div
            key={item.surl}
            className="group relative p-3.5 rounded-2xl bg-white dark:bg-[#18181f] border border-zinc-200 dark:border-[#272733] hover:border-blue-500 dark:hover:border-blue-500 shadow-md transition-all duration-200 flex flex-col justify-between"
          >
            <div className="flex items-start gap-3">
              {/* Thumbnail / Icon */}
              <div className="relative h-16 w-24 rounded-xl bg-zinc-100 dark:bg-[#121217] flex items-center justify-center shrink-0 overflow-hidden border border-zinc-200 dark:border-[#272733]">
                {item.thumbnail ? (
                  <img
                    src={item.thumbnail}
                    alt={item.title}
                    className="h-full w-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = "none";
                    }}
                  />
                ) : (
                  <Film className="h-6 w-6 text-zinc-400" strokeWidth={2} />
                )}
                <button
                  onClick={() => onPlayItem(item)}
                  className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white"
                  title="Play"
                >
                  <Play className="h-6 w-6 fill-white stroke-white" strokeWidth={2.5} />
                </button>
              </div>

              {/* Title & Info */}
              <div className="min-w-0 flex-1">
                <p 
                  onClick={() => onPlayItem(item)}
                  className="text-xs font-bold text-zinc-950 dark:text-white truncate cursor-pointer hover:text-blue-500 transition-colors"
                  title={item.title}
                >
                  {item.title}
                </p>

                <div className="flex items-center gap-2 text-[11px] font-medium text-zinc-500 dark:text-zinc-400 mt-1.5">
                  {item.durationFormatted && (
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" strokeWidth={2} />
                      {item.durationFormatted}
                    </span>
                  )}
                  {item.sizeFormatted && (
                    <span>• {item.sizeFormatted}</span>
                  )}
                </div>

                <p className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-1">
                  {formatDate(item.playedAt)}
                </p>
              </div>
            </div>

            {/* Remove item button */}
            <button
              onClick={() => onRemoveItem(item.surl)}
              className="absolute top-2.5 right-2.5 p-1 rounded-lg text-zinc-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
              title="Remove from history"
            >
              <Trash2 className="h-3.5 w-3.5" strokeWidth={2.2} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
