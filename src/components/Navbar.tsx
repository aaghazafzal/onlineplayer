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
  Zap
} from "lucide-react";
import { useTheme } from "../context/ThemeContext";

interface NavbarProps {
  onOpenShortcuts?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onOpenShortcuts }) => {
  const { theme, toggleTheme } = useTheme();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 w-full bg-[#f4f4f7]/95 dark:bg-[#0e0e11]/95 backdrop-blur-md border-b border-zinc-200 dark:border-[#262633] transition-colors duration-200">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 h-16 sm:h-18 flex items-center justify-between">
        
        {/* Left: Mobile Hamburger (hidden on laptop) + Brand Logo */}
        <div className="flex items-center gap-2.5 sm:gap-3">
          {/* Hamburger Menu Trigger - Only on Mobile/Tablet (lg:hidden) */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden p-2.5 rounded-xl border border-zinc-300 dark:border-[#2a2a38] bg-white dark:bg-[#18181f] text-zinc-800 dark:text-zinc-200 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-[#20202a] transition-all cursor-pointer active:scale-95"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? (
              <X className="h-5 w-5" strokeWidth={2.5} />
            ) : (
              <Menu className="h-5 w-5" strokeWidth={2.5} />
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

      {/* Upgraded Mobile Dropdown Panel (Sits cleanly below header via top-full) */}
      {mobileMenuOpen && (
        <div className="lg:hidden absolute top-full left-0 right-0 w-full bg-[#f4f4f7] dark:bg-[#121217] border-b border-zinc-300 dark:border-[#2a2a3a] shadow-2xl p-4 sm:p-5 space-y-4 max-h-[calc(100vh-4.5rem)] overflow-y-auto animate-in slide-in-from-top-2 duration-150 z-50">
          
          {/* Supported Provider Chips */}
          <div className="space-y-1.5">
            <span className="text-[10px] font-black text-zinc-500 dark:text-zinc-400 uppercase tracking-wider px-1">
              Supported Cloud Engines
            </span>
            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none text-xs font-bold">
              <span className="px-3 py-1.5 rounded-xl bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60 shrink-0">
                TeraBox HD
              </span>
              <span className="px-3 py-1.5 rounded-xl bg-pink-100 dark:bg-pink-950/60 text-pink-700 dark:text-pink-300 border border-pink-200 dark:border-pink-800/60 shrink-0">
                Instagram Reels
              </span>
              <span className="px-3 py-1.5 rounded-xl bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60 shrink-0">
                DiskPlayer
              </span>
              <span className="px-3 py-1.5 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 shrink-0">
                Direct HLS Stream
              </span>
            </div>
          </div>

          {/* Nav Item Cards */}
          <div className="space-y-2 pt-1">
            <a
              href="/"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center justify-between p-3.5 rounded-2xl bg-white dark:bg-[#181820] border border-zinc-200 dark:border-[#282836] hover:border-blue-500 shadow-xs transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-blue-100 dark:bg-blue-950/80 text-blue-600 dark:text-blue-400">
                  <HomeIcon className="h-5 w-5" strokeWidth={2.4} />
                </div>
                <div>
                  <p className="text-xs font-bold text-zinc-950 dark:text-white">Home Player</p>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400">Paste & stream immediately</p>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-zinc-400" />
            </a>

            <a
              href="#how-it-works"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center justify-between p-3.5 rounded-2xl bg-white dark:bg-[#181820] border border-zinc-200 dark:border-[#282836] hover:border-indigo-500 shadow-xs transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-indigo-100 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400">
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
              className="flex items-center justify-between p-3.5 rounded-2xl bg-white dark:bg-[#181820] border border-zinc-200 dark:border-[#282836] hover:border-emerald-500 shadow-xs transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400">
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
              className="flex items-center justify-between p-3.5 rounded-2xl bg-white dark:bg-[#181820] border border-zinc-200 dark:border-[#282836] hover:border-sky-500 shadow-xs transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-sky-100 dark:bg-sky-950/80 text-sky-600 dark:text-sky-400">
                  <Code2 className="h-5 w-5" strokeWidth={2.4} />
                </div>
                <div>
                  <p className="text-xs font-bold text-zinc-950 dark:text-white">Worker Edge API</p>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400">Live resolver endpoints</p>
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
                className="w-full py-2.5 px-4 rounded-xl text-center text-xs font-bold text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white bg-white dark:bg-[#181820] border border-zinc-200 dark:border-[#282836] transition-colors cursor-pointer"
              >
                View Keyboard Shortcuts
              </button>
            )}
          </div>

          <div className="text-center text-[11px] text-zinc-500 dark:text-zinc-400 pt-1">
            OnlinePlayer • 100% Free & Unlimited Cloud Media
          </div>
        </div>
      )}
    </header>
  );
};
