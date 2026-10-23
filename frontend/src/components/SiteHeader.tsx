"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Menu, Moon, Sun, X, Keyboard } from "lucide-react";
import { useTheme } from "../context/ThemeContext";

interface SiteHeaderProps {
  onOpenShortcuts?: () => void;
}

const LINKS = [
  { href: "/#play", label: "Play a link" },
  { href: "/terabox-videos", label: "TeraBox videos" },
  { href: "/#how", label: "How it works" },
  { href: "/#faq", label: "Questions" },
];

export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <Link href="/" className={`inline-flex items-center gap-2.5 font-semibold tracking-[-0.03em] text-ink ${className}`}>
      <img src="/logo.png" alt="" width={32} height={32} className="h-8 w-8 object-contain" />
      <span className="text-[1.375rem] leading-none">OnlinePlayer</span>
    </Link>
  );
}

/** A plain bar: wordmark, four links, theme and shortcuts. On phones the links open in a sheet. */
export function SiteHeader({ onOpenShortcuts }: SiteHeaderProps) {
  const { theme, toggleTheme } = useTheme();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  const themeLabel = theme === "dark" ? "Switch to light theme" : "Switch to dark theme";

  return (
    <header className="sticky top-0 z-40 bg-bg">
      <div className="frame flex h-[72px] items-center justify-between gap-6">
        <Wordmark />

        <nav aria-label="Main" className="hidden lg:flex items-center gap-8 text-body">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="link text-ink">
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          {onOpenShortcuts && (
            <button
              type="button"
              onClick={onOpenShortcuts}
              className="btn btn-quiet hidden lg:inline-flex min-h-[44px] px-4 text-small"
            >
              <Keyboard className="h-4 w-4" strokeWidth={2.2} />
              Shortcuts
            </button>
          )}
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={themeLabel}
            title={themeLabel}
            className="btn btn-quiet min-h-[44px] w-11 px-0"
          >
            {theme === "dark" ? <Sun className="h-5 w-5" strokeWidth={2.2} /> : <Moon className="h-5 w-5" strokeWidth={2.2} />}
          </button>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="mobile-menu"
            aria-label={open ? "Close menu" : "Open menu"}
            className="btn btn-ink min-h-[44px] w-11 px-0 lg:hidden"
          >
            {open ? <X className="h-5 w-5" strokeWidth={2.4} /> : <Menu className="h-5 w-5" strokeWidth={2.4} />}
          </button>
        </div>
      </div>

      {/* Phone sheet: a full-width panel under the bar, links set large */}
      {open && (
        <div id="mobile-menu" className="lg:hidden fixed inset-x-0 top-[72px] bottom-0 z-40 bg-paper overflow-y-auto">
          <nav aria-label="Mobile" className="frame flex flex-col pt-6 pb-10">
            {LINKS.map((l) => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="py-4 text-head font-semibold tracking-[-0.03em] text-ink active:opacity-60"
              >
                {l.label}
              </a>
            ))}
            <a
              href="https://status.onlineplayer.site"
              className="py-4 text-lead text-muted"
              onClick={() => setOpen(false)}
            >
              Service status
            </a>
          </nav>
        </div>
      )}
    </header>
  );
}
