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
  Sparkles,
  Layers
} from "lucide-react";
import { useTheme } from "../context/ThemeContext";

interface NavbarProps {
  onOpenShortcuts?: () => void;
  onOpenAuth?: (type: "login" | "signup") => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onOpenShortcuts, onOpenAuth }) => {
  const { theme, toggleTheme } = useTheme();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("home");

  return (
    <header className="sticky top-0 z-50 w-full bg-[#f4f4f7]/95 dark:bg-[#0e0e11]/95 backdrop-blur-md border-b border-zinc-200 dark:border-[#262633] transition-colors duration-200">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between">
        
        {/* Left: Hamburger + Logo */}
        <div className="flex items-center gap-3">
          {/* Mobile / Left Hamburger Menu Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2.5 rounded-xl border border-zinc-300 dark:border-[#2a2a38] bg-white dark:bg-[#18181f] text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-[#20202a] transition-all"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? (
              <X className="h-5 w-5" strokeWidth={2.3} />
            ) : (
              <Menu className="h-5 w-5" strokeWidth={2.3} />
            )}
          </button>

          {/* Brand Logo */}
          <a href="/" className="flex items-center gap-2.5 group">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20 group-hover:scale-105 transition-transform">
              <Play className="h-4.5 w-4.5 fill-white stroke-white ml-0.5" strokeWidth={2.4} />
            </div>
            <div className="flex items-baseline gap-1">
              <span className="font-extrabold text-xl tracking-tight text-zinc-950 dark:text-white">
                Online<span className="text-blue-500">Player</span>
              </span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-950/80 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800/60 hidden sm:inline-block">
                PRO
              </span>
            </div>
          </a>
        </div>

        {/* Center: Floating Pill Navigation (IteraPlay style) */}
        <nav className="hidden lg:flex items-center gap-1 p-1 rounded-2xl bg-zinc-200/70 dark:bg-[#18181f] border border-zinc-300/60 dark:border-[#272733] shadow-inner">
          <button
            onClick={() => setActiveTab("home")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === "home"
                ? "bg-white dark:bg-[#272734] text-zinc-950 dark:text-white shadow-sm"
                : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white"
            }`}
          >
            <HomeIcon className="h-3.5 w-3.5" strokeWidth={2.4} />
            <span>Home</span>
          </button>

          <a
            href="#how-it-works"
            onClick={() => setActiveTab("how")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === "how"
                ? "bg-white dark:bg-[#272734] text-zinc-950 dark:text-white shadow-sm"
                : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white"
            }`}
          >
            <BookOpen className="h-3.5 w-3.5" strokeWidth={2.4} />
            <span>Guide</span>
          </a>

          <a
            href="#providers"
            onClick={() => setActiveTab("providers")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === "providers"
                ? "bg-white dark:bg-[#272734] text-zinc-950 dark:text-white shadow-sm"
                : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white"
            }`}
          >
            <Film className="h-3.5 w-3.5" strokeWidth={2.4} />
            <span>Cloud Videos</span>
          </a>

          <a
            href="#features"
            onClick={() => setActiveTab("features")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === "features"
                ? "bg-white dark:bg-[#272734] text-zinc-950 dark:text-white shadow-sm"
                : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white"
            }`}
          >
            <Layers className="h-3.5 w-3.5" strokeWidth={2.4} />
            <span>Features</span>
          </a>

          <a
            href="https://terabox-player-api.onlineplayer.workers.dev"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white transition-all"
          >
            <Code2 className="h-3.5 w-3.5" strokeWidth={2.4} />
            <span>API</span>
          </a>
        </nav>

        {/* Right: Theme Toggle Capsule + Login + Sign Up */}
        <div className="flex items-center gap-2.5 sm:gap-3">
          
          {/* Day / Night Mode Pill Toggle (Matching iteraplay pill toggle) */}
          <button
            onClick={toggleTheme}
            className="relative flex items-center h-8 w-14 rounded-full bg-zinc-200 dark:bg-[#18181f] border border-zinc-300 dark:border-[#2e2e3e] p-1 transition-colors cursor-pointer"
            aria-label="Toggle theme mode"
            title={theme === "dark" ? "Switch to Day Mode" : "Switch to Night Mode"}
          >
            <div
              className={`h-6 w-6 rounded-full flex items-center justify-center transition-transform duration-200 ${
                theme === "dark"
                  ? "translate-x-6 bg-[#2563eb] text-white shadow-sm"
                  : "translate-x-0 bg-white text-amber-500 shadow-sm"
              }`}
            >
              {theme === "dark" ? (
                <Moon className="h-3.5 w-3.5 fill-white stroke-white" strokeWidth={2.4} />
              ) : (
                <Sun className="h-3.5 w-3.5 fill-amber-500 stroke-amber-500" strokeWidth={2.4} />
              )}
            </div>
          </button>

          {/* Login Link */}
          <button
            onClick={() => onOpenAuth?.("login")}
            className="px-3 py-2 text-xs sm:text-sm font-semibold text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white transition-colors"
          >
            Login
          </button>

          {/* Sign Up Button (Bright royal blue) */}
          <button
            onClick={() => onOpenAuth?.("signup")}
            className="px-4 sm:px-5 py-2 rounded-xl text-xs sm:text-sm font-bold text-white bg-[#2563eb] hover:bg-[#1d4ed8] shadow-md shadow-blue-500/20 active:scale-95 transition-all"
          >
            Sign up
          </button>
        </div>
      </div>

      {/* Mobile Slide-down Menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-zinc-200 dark:border-[#262633] bg-[#f4f4f7] dark:bg-[#131318] px-4 py-4 space-y-3 animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="grid grid-cols-2 gap-2">
            <a
              href="/"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-2.5 p-3 rounded-xl bg-white dark:bg-[#1c1c24] border border-zinc-200 dark:border-[#2a2a38] text-xs font-bold text-zinc-900 dark:text-white"
            >
              <HomeIcon className="h-4 w-4 text-blue-500" strokeWidth={2.4} />
              <span>Home</span>
            </a>
            <a
              href="#how-it-works"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-2.5 p-3 rounded-xl bg-white dark:bg-[#1c1c24] border border-zinc-200 dark:border-[#2a2a38] text-xs font-bold text-zinc-900 dark:text-white"
            >
              <BookOpen className="h-4 w-4 text-indigo-500" strokeWidth={2.4} />
              <span>How To Use</span>
            </a>
            <a
              href="#features"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-2.5 p-3 rounded-xl bg-white dark:bg-[#1c1c24] border border-zinc-200 dark:border-[#2a2a38] text-xs font-bold text-zinc-900 dark:text-white"
            >
              <Film className="h-4 w-4 text-emerald-500" strokeWidth={2.4} />
              <span>Features</span>
            </a>
            <a
              href="https://terabox-player-api.onlineplayer.workers.dev"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2.5 p-3 rounded-xl bg-white dark:bg-[#1c1c24] border border-zinc-200 dark:border-[#2a2a38] text-xs font-bold text-zinc-900 dark:text-white"
            >
              <Code2 className="h-4 w-4 text-sky-500" strokeWidth={2.4} />
              <span>Worker API</span>
            </a>
          </div>

          <div className="pt-2 flex items-center justify-between border-t border-zinc-200 dark:border-[#262633] text-xs text-zinc-500">
            <span>High-Speed Cloud Stream Engine</span>
            <button
              onClick={onOpenShortcuts}
              className="font-semibold text-blue-500 underline"
            >
              Shortcuts
            </button>
          </div>
        </div>
      )}
    </header>
  );
};
