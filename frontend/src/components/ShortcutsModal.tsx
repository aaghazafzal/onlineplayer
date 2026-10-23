"use client";

import React, { useEffect, useRef } from "react";
import { X } from "lucide-react";

interface ShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const DIALOG_SHADOW = "shadow-[0_24px_80px_rgba(0,0,0,0.35)]"; // taste-skill-ignore: a real dialog floats above the page

const SHORTCUTS = [
  { key: "Space", desc: "Play or pause" },
  { key: "← →", desc: "Back or forward 5 seconds" },
  { key: "↑ ↓", desc: "Volume up or down" },
  { key: "F", desc: "Fullscreen" },
  { key: "M", desc: "Mute" },
  { key: "T", desc: "Theatre mode" },
];

/** A real dialog: Escape and the backdrop close it, focus moves in and back. */
export const ShortcutsModal: React.FC<ShortcutsModalProps> = ({ isOpen, onClose }) => {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (isOpen && !dialog.open) dialog.showModal();
    if (!isOpen && dialog.open) dialog.close();
  }, [isOpen]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      aria-labelledby="shortcuts-title"
      className={`m-auto w-[min(440px,calc(100vw-32px))] rounded-ui bg-paper text-ink p-0 backdrop:bg-black/50 ${DIALOG_SHADOW}`}
    >
      <div className="p-6">
        <div className="flex items-center justify-between gap-4">
          <h2 id="shortcuts-title" className="text-lead font-semibold tracking-[-0.02em]">
            Keyboard shortcuts
          </h2>
          <button onClick={onClose} className="btn btn-quiet min-h-[40px] w-10 px-0" aria-label="Close">
            <X className="h-5 w-5" strokeWidth={2.4} />
          </button>
        </div>
        <dl className="mt-5 flex flex-col gap-1">
          {SHORTCUTS.map((s) => (
            <div key={s.key} className="flex items-center justify-between gap-4 rounded-ui bg-surface-2 px-4 min-h-[48px]">
              <dt className="text-body">{s.desc}</dt>
              <dd>
                <kbd className="inline-block min-w-[44px] rounded-[4px] bg-paper px-2 py-1 text-center text-small font-medium">{s.key}</kbd>
              </dd>
            </div>
          ))}
        </dl>
        <p className="mt-4 text-small text-muted">They work while a video is playing on this page.</p>
      </div>
    </dialog>
  );
};
