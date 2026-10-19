"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { 
  Play, 
  Menu, 
  X, 
  Sun, 
  Moon, 
  Home as HomeIcon, 
  BookOpen, 
  PlayCircle, 
  Code2, 
  Keyboard, 
  Send,
  Zap,
  Film
} from "lucide-react";
import { useTheme } from "../context/ThemeContext";

interface NavbarProps {
  onOpenShortcuts?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onOpenShortcuts }) => {
  const { theme, toggleTheme } = useTheme();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [activeItem, setActiveItem] = useState("home");

  useEffect(() => {
    setMounted(true);
  }, []);

  // Lock body scroll when sidebar drawer is open
  useEffect(() => {
    if (sidebarOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [sidebarOpen]);

  return (
    <>
      <header className="sticky top-0 z-40 w-full bg-[#f4f4f7]/95 dark:bg-[#0e0e11]/95 backdrop-blur-md border-b border-zinc-200 dark:border-[#262633] transition-colors duration-200">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 h-16 sm:h-18 flex items-center justify-between">
          
          {/* Left: Hamburger Button + Brand Logo */}
          <div className="flex items-center gap-3">
            {/* Hamburger Button (IteraPlay style) */}
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-2 sm:p-2.5 rounded-xl border border-zinc-300 dark:border-[#2a2a38] bg-white dark:bg-[#18181f] text-zinc-800 dark:text-zinc-200 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-[#20202a] transition-all cursor-pointer active:scale-95"
              aria-label="Open sidebar menu"
              title="Open Navigation"
            >
              <Menu className="h-5 w-5" strokeWidth={2.4} />
            </button>

            {/* Brand Logo */}
            <a href="/" className="flex items-center gap-2.5 group">
              <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/25 group-hover:scale-105 transition-transform shrink-0">
                <Play className="h-4.5 w-4.5 sm:h-5 sm:w-5 fill-white stroke-white ml-0.5" strokeWidth={2.5} />
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="font-black text-xl sm:text-2xl tracking-tight text-zinc-950 dark:text-white">
                  Online<span className="bg-gradient-to-r from-blue-500 to-indigo-500 bg-clip-text text-transparent">Player</span>
                </span>
                <span className="text-[10px] sm:text-[11px] font-black px-1.5 sm:px-2 py-0.5 rounded-md bg-blue-100 dark:bg-blue-950/80 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800/60 hidden xs:inline-block">
                  PRO
                </span>
              </div>
            </a>
          </div>

          {/* Right: Engine Status + Shortcuts + Theme Toggle Capsule */}
          <div className="flex items-center gap-2.5 sm:gap-4">
            
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
      </header>

      {/* React Portal Sidebar Drawer (Exact IteraPlay Left Slide-Over) */}
      {mounted && createPortal(
        <div 
          className={`fixed inset-0 z-[9999] transition-visibility duration-300 ${
            sidebarOpen ? "visible" : "invisible pointer-events-none"
          }`}
        >
          {/* Dimmed Backdrop */}
          <div 
            className={`fixed inset-0 bg-black/65 backdrop-blur-xs transition-opacity duration-300 ${
              sidebarOpen ? "opacity-100" : "opacity-0"
            }`}
            onClick={() => setSidebarOpen(false)}
          />

          {/* Left Slide Drawer Panel */}
          <aside 
            className={`fixed inset-y-0 left-0 w-[290px] sm:w-[320px] bg-white dark:bg-[#0e0e11] border-r border-zinc-200 dark:border-[#22222a] p-5 sm:p-6 flex flex-col justify-between shadow-2xl z-10 transition-transform duration-300 ease-out ${
              sidebarOpen ? "translate-x-0" : "-translate-x-full"
            }`}
          >
            {/* Top Section */}
            <div className="space-y-5">
              
              {/* Drawer Brand Header */}
              <div className="flex items-center justify-between pb-2 border-b border-zinc-200 dark:border-[#22222a]">
                <div className="flex items-center gap-2.5">
                  <div className="h-8.5 w-8.5 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
                    <Play className="h-4.5 w-4.5 fill-white stroke-white ml-0.5" strokeWidth={2.5} />
                  </div>
                  <span className="font-black text-xl tracking-tight text-zinc-950 dark:text-white">
                    Online<span className="text-blue-500">Player</span>
                  </span>
                </div>

                <button
                  onClick={() => setSidebarOpen(false)}
                  className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-[#1a1a22] transition-colors cursor-pointer"
                  aria-label="Close menu"
                >
                  <X className="h-5 w-5" strokeWidth={2.4} />
                </button>
              </div>

              {/* Appearance / Theme Row (Exact IteraPlay style) */}
              <div className="flex items-center justify-between py-2 px-1">
                <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                  Appearance
                </span>

                <button
                  onClick={toggleTheme}
                  className="relative flex items-center h-8 w-14 rounded-full bg-zinc-200 dark:bg-[#18181f] border border-zinc-300 dark:border-[#2e2e3e] p-1 transition-colors cursor-pointer"
                  aria-label="Toggle theme mode"
                  title={theme === "dark" ? "Switch to Day Mode" : "Switch to Night Mode"}
                >
                  <div
                    className={`h-6 w-6 rounded-full flex items-center justify-center transition-transform duration-200 ${
                      theme === "dark"
                        ? "translate-x-6 bg-[#2563eb] text-white shadow-md"
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

              {/* Navigation Items (Exact IteraPlay vertical stack) */}
              <nav className="space-y-1.5 pt-1">
                {/* Home */}
                <a
                  href="/"
                  onClick={() => {
                    setActiveItem("home");
                    setSidebarOpen(false);
                  }}
                  className={`flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm font-bold transition-all ${
                    activeItem === "home"
                      ? "bg-blue-600/15 text-blue-500 dark:text-blue-400 border border-blue-500/30"
                      : "text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-[#181820]"
                  }`}
                >
                  <HomeIcon className="h-4.5 w-4.5" strokeWidth={2.4} />
                  <span>Home</span>
                </a>

                {/* API */}
                <a
                  href="https://terabox-player-api.onlineplayer.workers.dev"
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => {
                    setActiveItem("api");
                    setSidebarOpen(false);
                  }}
                  className={`flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${
                    activeItem === "api"
                      ? "bg-blue-600/15 text-blue-500 dark:text-blue-400 border border-blue-500/30 font-bold"
                      : "text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-[#181820]"
                  }`}
                >
                  <Code2 className="h-4.5 w-4.5" strokeWidth={2.4} />
                  <span>API</span>
                </a>

                {/* Cloud Videos */}
                <a
                  href="#features"
                  onClick={() => {
                    setActiveItem("videos");
                    setSidebarOpen(false);
                  }}
                  className={`flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${
                    activeItem === "videos"
                      ? "bg-blue-600/15 text-blue-500 dark:text-blue-400 border border-blue-500/30 font-bold"
                      : "text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-[#181820]"
                  }`}
                >
                  <PlayCircle className="h-4.5 w-4.5" strokeWidth={2.4} />
                  <span>Cloud Videos</span>
                </a>

                {/* Telegram Bot / Community */}
                <a
                  href="https://t.me/"
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => {
                    setActiveItem("telegram");
                    setSidebarOpen(false);
                  }}
                  className={`flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${
                    activeItem === "telegram"
                      ? "bg-blue-600/15 text-blue-500 dark:text-blue-400 border border-blue-500/30 font-bold"
                      : "text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-[#181820]"
                  }`}
                >
                  <Send className="h-4.5 w-4.5" strokeWidth={2.4} />
                  <span>Telegram Bot</span>
                </a>

                {/* How To Use */}
                <a
                  href="#how-it-works"
                  onClick={() => {
                    setActiveItem("guide");
                    setSidebarOpen(false);
                  }}
                  className={`flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${
                    activeItem === "guide"
                      ? "bg-blue-600/15 text-blue-500 dark:text-blue-400 border border-blue-500/30 font-bold"
                      : "text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-[#181820]"
                  }`}
                >
                  <BookOpen className="h-4.5 w-4.5" strokeWidth={2.4} />
                  <span>How To Use</span>
                </a>

                {/* Keyboard Shortcuts */}
                {onOpenShortcuts && (
                  <button
                    onClick={() => {
                      setSidebarOpen(false);
                      onOpenShortcuts();
                    }}
                    className="w-full flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm font-semibold text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-[#181820] transition-all text-left cursor-pointer"
                  >
                    <Keyboard className="h-4.5 w-4.5 text-blue-500" strokeWidth={2.4} />
                    <span>Shortcuts</span>
                  </button>
                )}
              </nav>
            </div>

            {/* Bottom Section (No login/signup, clean brand tag) */}
            <div className="pt-4 border-t border-zinc-200 dark:border-[#22222a] text-center space-y-1">
              <p className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                OnlinePlayer v2.0
              </p>
              <p className="text-[11px] text-zinc-400 dark:text-zinc-500">
                Universal Multi-Cloud Video Engine
              </p>
            </div>
          </aside>
        </div>,
        document.body
      )}
    </>
  );
};
