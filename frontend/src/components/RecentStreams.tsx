"use client";

import React from "react";
import { Play, X } from "lucide-react";

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

function timeAgo(timestamp: number) {
  const mins = Math.floor((Date.now() - timestamp) / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "Yesterday" : `${days} days ago`;
}

/** Links played in this browser (stored only here), newest first. */
export const RecentStreams: React.FC<RecentStreamsProps> = ({ items, onPlayItem, onClearHistory, onRemoveItem }) => {
  if (items.length === 0) return null;

  return (
    <section aria-labelledby="recent-title" className="w-full">
      <div className="flex items-end justify-between gap-4">
        <h2 id="recent-title" className="text-lead font-semibold tracking-[-0.02em]">
          Played on this device
        </h2>
        <button onClick={onClearHistory} className="link text-small text-muted hover:text-ink cursor-pointer">
          Clear the list
        </button>
      </div>

      <ul className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
        {items.map((item) => (
          <li key={item.surl} className="group relative">
            <button
              onClick={() => onPlayItem(item)}
              className="w-full flex items-center gap-3 rounded-ui bg-paper p-2 pr-10 text-left transition-colors hover:bg-surface-2"
              title={`Play ${item.title}`}
            >
              <span className="relative h-14 w-20 shrink-0 overflow-clip rounded-[4px] bg-surface-2">
                {item.thumbnail && (
                  <img
                    src={item.thumbnail}
                    alt=""
                    loading="lazy"
                    className="h-full w-full object-cover"
                    onError={(e) => ((e.target as HTMLElement).style.display = "none")}
                  />
                )}
                <span className="absolute inset-0 flex items-center justify-center bg-stage/55 text-stage-ink opacity-0 group-hover:opacity-100 transition-opacity">
                  <Play className="h-5 w-5 fill-current" strokeWidth={2.2} />
                </span>
              </span>
              <span className="min-w-0">
                <span className="block text-small font-medium truncate">{item.title}</span>
                <span className="block text-small text-muted truncate">
                  {[item.durationFormatted, timeAgo(item.playedAt)].filter(Boolean).join(" · ")}
                </span>
              </span>
            </button>
            <button
              onClick={() => onRemoveItem(item.surl)}
              className="absolute top-1/2 right-2 -translate-y-1/2 h-8 w-8 inline-flex items-center justify-center rounded-[4px] text-muted hover:text-ink hover:bg-surface sm:opacity-0 sm:group-hover:opacity-100 focus-visible:opacity-100 transition-opacity"
              aria-label={`Remove ${item.title} from the list`}
            >
              <X className="h-4 w-4" strokeWidth={2.4} />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
};
