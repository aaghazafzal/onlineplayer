"use client";

import React from "react";
import { X, Keyboard } from "lucide-react";

interface ShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SHORTCUTS = [
  { key: "Space", desc: "Play / Pause playback" },
  { key: "← / →", desc: "Seek backward / forward 5 seconds" },
  { key: "↑ / ↓", desc: "Volume up / down 10%" },
  { key: "F", desc: "Toggle Fullscreen" },
  { key: "M", desc: "Toggle Mute" },
  { key: "T", desc: "Toggle Theater Widescreen Mode" },
];

export const ShortcutsModal: React.FC<ShortcutsModalProps> = ({
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div 
        className="w-full max-w-md rounded-3xl bg-white dark:bg-[#18181f] border border-zinc-200 dark:border-[#272733] p-6 sm:p-7 shadow-2xl relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-zinc-200 dark:border-[#272733]">
          <div className="flex items-center gap-2.5">
            <Keyboard className="h-5 w-5 text-blue-500" strokeWidth={2.4} />
            <h2 className="text-base font-bold text-zinc-950 dark:text-white">
              Keyboard Shortcuts
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-zinc-400 hover:text-zinc-600 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-[#20202a] transition-colors"
          >
            <X className="h-4 w-4" strokeWidth={2.5} />
          </button>
        </div>

        {/* Shortcuts list */}
        <div className="mt-4 space-y-2.5">
          {SHORTCUTS.map((s) => (
            <div
              key={s.key}
              className="flex items-center justify-between text-xs py-2 px-3 rounded-xl bg-zinc-50 dark:bg-[#121217] border border-zinc-200 dark:border-[#262633]"
            >
              <span className="text-zinc-700 dark:text-zinc-300 font-medium">
                {s.desc}
              </span>
              <kbd className="px-2.5 py-1 rounded-lg bg-white dark:bg-[#20202a] border border-zinc-300 dark:border-[#303040] font-mono text-[11px] font-bold text-zinc-800 dark:text-zinc-200 shadow-xs">
                {s.key}
              </kbd>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="mt-5 text-center text-[11px] text-zinc-400 dark:text-zinc-500">
          Press any shortcut while the video player is in focus.
        </div>
      </div>
    </div>
  );
};
