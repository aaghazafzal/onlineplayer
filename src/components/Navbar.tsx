"use client";

import React, { useState } from "react";
import { 
  Play, 
  Menu, 
  X, 
  Sun, 
  Moon, 
  Home as HomeIcon, 
  BookOpen, 
  Film, 
  Code2, 
  Keyboard,
  ChevronRight,
  Send,
  Sparkles
} from "lucide-react";
import { useTheme } from "../context/ThemeContext";

interface NavbarProps {
  onOpenShortcuts?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onOpenShortcuts }) => {
  const { theme, toggleTheme } = useTheme();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 w-full bg-[#f4f4f7]/95 dark:bg-[#0e0e11]/95 backdrop-blur-md border-b border-zinc-200 dark:border-[#262633] transition-colors duration-200">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 h-16 sm:h-18 flex items-center justify-between">
        
        {/* Left: Mobile Hamburger (hidden on laptop) + Brand Logo */}
        <div className="flex items-center gap-2.5 sm:gap-3">
          {/* Hamburger Menu Trigger - Only on Mobile/Tablet (lg:hidden) */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden p-2 sm:p-2.5 rounded-xl border border-zinc-300 dark:border-[#2a2a38] bg-white dark:bg-[#18181f] text-zinc-800 dark:text-zinc-200 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-[#20202a] transition-all cursor-pointer active:scale-95"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? (
              <X className="h-5 w-5" strokeWidth={2.4} />
            ) : (
              <Menu className="h-5 w-5" strokeWidth={2.4} />
            )}
          </button>

          {/* Brand Logo */}
          <a href="/" className="flex items-center gap-2 sm:gap-2.5 group">
            <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/25 group-hover:scale-105 transition-transform shrink-0">
              <Play className="h-4.5 w-4.5 sm:h-5 sm:w-5 fill-white stroke-white ml-0.5" strokeWidth={2.5} />
            </div>
            <div className="flex items-baseline gap-1 sm:gap-1.5">
              <span className="font-black text-xl sm:text-2xl tracking-tight text-zinc-950 dark:text-white">
                Online<span className="bg-gradient-to-r from-blue-500 to-indigo-500 bg-clip-text text-transparent">Player</span>
              </span>
              <span className="text-[10px] sm:text-[11px] font-black px-1.5 sm:px-2 py-0.5 rounded-md bg-blue-100 dark:bg-blue-950/80 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800/60 hidden xs:inline-block">
                PRO
              </span>
            </div>
          </a>
        </div>

        {/* Right: Cloud Status + Shortcuts + Theme Toggle Capsule */}
        <div className="flex items-center gap-2 sm:gap-4">
          
          {/* Cloud Status Pill (Laptop) */}
          <div className="hidden sm:flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-white dark:bg-[#18181f] border border-zinc-200 dark:border-[#272733] text-xs font-semibold text-zinc-700 dark:text-zinc-300 shadow-xs">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="font-bold text-zinc-900 dark:text-white">Universal Cloud Engine</span>
          </div>

          {/* Keyboard Shortcuts Button */}
          {onOpenShortcuts && (
            <button
              onClick={onOpenShortcuts}
              className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-zinc-700 dark:text-zinc-300 bg-white dark:bg-[#18181f] hover:bg-zinc-100 dark:hover:bg-[#20202a] border border-zinc-200 dark:border-[#272733] transition-colors cursor-pointer"
              title="Keyboard Shortcuts"
            >
              <Keyboard className="h-4 w-4 text-blue-500" strokeWidth={2.3} />
              <span>Shortcuts</span>
            </button>
          )}

          {/* Day / Night Mode Pill Toggle */}
          <button
            onClick={toggleTheme}
            className="relative flex items-center h-8 sm:h-8.5 w-14 sm:w-15 rounded-full bg-zinc-200 dark:bg-[#18181f] border border-zinc-300 dark:border-[#2e2e3e] p-1 transition-colors cursor-pointer"
            aria-label="Toggle theme mode"
            title={theme === "dark" ? "Switch to Day Mode" : "Switch to Night Mode"}
          >
            <div
              className={`h-6 sm:h-6.5 w-6 sm:w-6.5 rounded-full flex items-center justify-center transition-transform duration-200 ${
                theme === "dark"
                  ? "translate-x-6 sm:translate-x-6.5 bg-[#2563eb] text-white shadow-md"
                  : "translate-x-0 bg-white text-amber-500 shadow-md"
              }`}
            >
              {theme === "dark" ? (
                <Moon className="h-3.5 w-3.5 fill-white stroke-white" strokeWidth={2.4} />
              ) : (
                <Sun className="h-3.5 w-3.5 fill-amber-500 stroke-amber-500" strokeWidth={2.4} />
              )}
            </div>
          </button>
        </div>
      </div>

      {/* Upgraded Mobile Drawer Sheet (Overlaid with backdrop blur) */}
      {mobileMenuOpen && (
        <div 
          className="fixed inset-0 z-50 lg:hidden bg-black/75 backdrop-blur-md p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-150"
          onClick={() => setMobileMenuOpen(false)}
        >
          <div 
            className="w-full max-w-md mx-auto rounded-3xl bg-white dark:bg-[#15151c] border border-zinc-200 dark:border-[#2a2a3a] p-5 sm:p-6 shadow-2xl space-y-4 animate-in slide-in-from-top-3 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer Header */}
            <div className="flex items-center justify-between pb-3.5 border-b border-zinc-200 dark:border-[#262633]">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 flex items-center justify-center text-white shadow-sm">
                  <Play className="h-4 w-4 fill-white stroke-white ml-0.5" strokeWidth={2.4} />
                </div>
                <span className="font-black text-base text-zinc-950 dark:text-white">
                  Online<span className="text-blue-500">Player</span>
                </span>
                <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-950/80 text-blue-600 dark:text-blue-400">
                  PRO
                </span>
              </div>

              <button
                onClick={() => setMobileMenuOpen(false)}
                className="p-1.5 rounded-full bg-zinc-100 dark:bg-[#20202a] text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors cursor-pointer"
                aria-label="Close menu"
              >
                <X className="h-5 w-5" strokeWidth={2.4} />
              </button>
            </div>

            {/* Supported Provider Chips */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider px-1">
                Supported Cloud Providers
              </span>
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-[11px] font-bold">
                <span className="px-2.5 py-1 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800/40 shrink-0">TeraBox</span>
                <span className="px-2.5 py-1 rounded-xl bg-pink-50 dark:bg-pink-950/40 text-pink-600 dark:text-pink-400 border border-pink-200 dark:border-pink-800/40 shrink-0">Instagram</span>
                <span className="px-2.5 py-1 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/40 shrink-0">DiskPlayer</span>
                <span className="px-2.5 py-1 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/40 shrink-0">Direct HLS</span>
              </div>
            </div>

            {/* Interactive Nav Cards */}
            <div className="space-y-2">
              <a
                href="/"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center justify-between p-3.5 rounded-2xl bg-zinc-50 dark:bg-[#1c1c24] border border-zinc-200 dark:border-[#282836] hover:border-blue-500 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-blue-100 dark:bg-blue-950/70 text-blue-600 dark:text-blue-400">
                    <HomeIcon className="h-5 w-5" strokeWidth={2.4} />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-zinc-950 dark:text-white">Home Player</p>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400">Paste & stream instantly</p>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-zinc-400" />
              </a>

              <a
                href="#how-it-works"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center justify-between p-3.5 rounded-2xl bg-zinc-50 dark:bg-[#1c1c24] border border-zinc-200 dark:border-[#282836] hover:border-indigo-500 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-indigo-100 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-400">
                    <BookOpen className="h-5 w-5" strokeWidth={2.4} />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-zinc-950 dark:text-white">How To Use</p>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400">3-step guide & offline saving</p>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-zinc-400" />
              </a>

              <a
                href="#features"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center justify-between p-3.5 rounded-2xl bg-zinc-50 dark:bg-[#1c1c24] border border-zinc-200 dark:border-[#282836] hover:border-emerald-500 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-emerald-100 dark:bg-emerald-950/70 text-emerald-600 dark:text-emerald-400">
                    <Film className="h-5 w-5" strokeWidth={2.4} />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-zinc-950 dark:text-white">Why OnlinePlayer</p>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400">Zero limits & full 1080p speed</p>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-zinc-400" />
              </a>

              <a
                href="https://terabox-player-api.onlineplayer.workers.dev"
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between p-3.5 rounded-2xl bg-zinc-50 dark:bg-[#1c1c24] border border-zinc-200 dark:border-[#282836] hover:border-sky-500 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-sky-100 dark:bg-sky-950/70 text-sky-600 dark:text-sky-400">
                    <Code2 className="h-5 w-5" strokeWidth={2.4} />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-zinc-950 dark:text-white">Worker Edge API</p>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400">Cloudflare Edge endpoints</p>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-zinc-400" />
              </a>
            </div>

            {/* Bottom Actions */}
            <div className="pt-2 space-y-2">
              <a
                href="https://t.me/"
                target="_blank"
                rel="noreferrer"
                className="w-full py-3.5 px-4 rounded-2xl bg-[#0088cc] hover:bg-[#0077b5] text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-sky-500/25 transition-all cursor-pointer"
              >
                <Send className="h-4 w-4 fill-white stroke-white" />
                <span>Join Telegram Community & Support</span>
              </a>

              {onOpenShortcuts && (
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onOpenShortcuts();
                  }}
                  className="w-full py-2.5 px-4 rounded-xl text-center text-xs font-bold text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white bg-zinc-100 dark:bg-[#18181f] border border-zinc-200 dark:border-[#272733] transition-colors cursor-pointer"
                >
                  View Keyboard Shortcuts
                </button>
              )}
            </div>

            <div className="text-center text-[10px] text-zinc-400 dark:text-zinc-500 pt-1">
              OnlinePlayer • 100% Free & Unlimited Cloud Media
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
