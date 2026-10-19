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
  ShieldCheck,
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
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between">
        
        {/* Left: Mobile Hamburger (hidden on laptop) + Brand Logo */}
        <div className="flex items-center gap-3">
          {/* Hamburger Menu - Only on Mobile/Tablet (lg:hidden) */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden p-2.5 rounded-xl border border-zinc-300 dark:border-[#2a2a38] bg-white dark:bg-[#18181f] text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-[#20202a] transition-all"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? (
              <X className="h-5 w-5" strokeWidth={2.4} />
            ) : (
              <Menu className="h-5 w-5" strokeWidth={2.4} />
            )}
          </button>

          {/* Brand Logo */}
          <a href="/" className="flex items-center gap-2.5 group">
            <div className="h-10 w-10 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/25 group-hover:scale-105 transition-transform">
              <Play className="h-5 w-5 fill-white stroke-white ml-0.5" strokeWidth={2.5} />
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="font-black text-2xl tracking-tight text-zinc-950 dark:text-white">
                Online<span className="bg-gradient-to-r from-blue-500 to-indigo-500 bg-clip-text text-transparent">Player</span>
              </span>
              <span className="text-[11px] font-black px-2 py-0.5 rounded-md bg-blue-100 dark:bg-blue-950/80 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800/60 hidden sm:inline-block">
                PRO
              </span>
            </div>
          </a>
        </div>

        {/* Right: Engine Status + Shortcuts + Theme Toggle Capsule (No Login/Signup) */}
        <div className="flex items-center gap-3 sm:gap-4">
          
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
            className="relative flex items-center h-8.5 w-15 rounded-full bg-zinc-200 dark:bg-[#18181f] border border-zinc-300 dark:border-[#2e2e3e] p-1 transition-colors cursor-pointer"
            aria-label="Toggle theme mode"
            title={theme === "dark" ? "Switch to Day Mode" : "Switch to Night Mode"}
          >
            <div
              className={`h-6.5 w-6.5 rounded-full flex items-center justify-center transition-transform duration-200 ${
                theme === "dark"
                  ? "translate-x-6.5 bg-[#2563eb] text-white shadow-md"
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

      {/* Mobile Slide-down Menu (Only when Hamburger clicked on mobile) */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-zinc-200 dark:border-[#262633] bg-[#f4f4f7] dark:bg-[#131318] px-4 py-5 space-y-4 animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="grid grid-cols-2 gap-2.5">
            <a
              href="/"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-2.5 p-3.5 rounded-2xl bg-white dark:bg-[#1c1c24] border border-zinc-200 dark:border-[#2a2a38] text-xs font-bold text-zinc-900 dark:text-white"
            >
              <HomeIcon className="h-4.5 w-4.5 text-blue-500" strokeWidth={2.4} />
              <span>Home</span>
            </a>
            <a
              href="#how-it-works"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-2.5 p-3.5 rounded-2xl bg-white dark:bg-[#1c1c24] border border-zinc-200 dark:border-[#2a2a38] text-xs font-bold text-zinc-900 dark:text-white"
            >
              <BookOpen className="h-4.5 w-4.5 text-indigo-500" strokeWidth={2.4} />
              <span>How To Use</span>
            </a>
            <a
              href="#features"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-2.5 p-3.5 rounded-2xl bg-white dark:bg-[#1c1c24] border border-zinc-200 dark:border-[#2a2a38] text-xs font-bold text-zinc-900 dark:text-white"
            >
              <Film className="h-4.5 w-4.5 text-emerald-500" strokeWidth={2.4} />
              <span>Features</span>
            </a>
            <a
              href="https://terabox-player-api.onlineplayer.workers.dev"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2.5 p-3.5 rounded-2xl bg-white dark:bg-[#1c1c24] border border-zinc-200 dark:border-[#2a2a38] text-xs font-bold text-zinc-900 dark:text-white"
            >
              <Code2 className="h-4.5 w-4.5 text-sky-500" strokeWidth={2.4} />
              <span>Worker API</span>
            </a>
          </div>

          <div className="pt-2 flex items-center justify-between border-t border-zinc-200 dark:border-[#262633] text-xs text-zinc-500">
            <span className="font-medium">Universal Multi-Cloud Video Player</span>
            {onOpenShortcuts && (
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  onOpenShortcuts();
                }}
                className="font-bold text-blue-500 underline"
              >
                Keyboard Shortcuts
              </button>
            )}
          </div>
        </div>
      )}
    </header>
  );
};
