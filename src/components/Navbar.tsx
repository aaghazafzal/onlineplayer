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
    if (typeof window !== "undefined") {
      const path = window.location.pathname;
      if (path.includes("terabox-videos")) {
        setActiveItem("terabox-videos");
      } else if (window.location.hash === "#providers" || window.location.hash === "#features") {
        setActiveItem("providers");
      } else if (window.location.hash === "#how-it-works") {
        setActiveItem("guide");
      } else {
        setActiveItem("home");
      }
    }
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
      <header className="sticky top-0 z-40 w-full bg-[#f4f4f7]/95 dark:bg-[#0e0e11]/95 backdrop-blur-md border-b border-zinc-200 dark:border-[#22222d] transition-colors duration-200">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          
          {/* Left: Hamburger Button + Brand Logo */}
          <div className="flex items-center gap-3.5">
            {/* Hamburger Button (IteraPlay style) */}
            <button
              onClick={() => setSidebarOpen(true)}
              className="h-11 w-11 sm:h-12 sm:w-12 rounded-2xl border border-zinc-300 dark:border-[#28283a] bg-white dark:bg-[#14141d] text-zinc-800 dark:text-zinc-200 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-[#1e1e2c] flex items-center justify-center shadow-xs transition-all cursor-pointer active:scale-95"
              aria-label="Open sidebar menu"
              title="Open Navigation"
            >
              <Menu className="h-5 w-5 sm:h-5.5 sm:w-5.5" strokeWidth={2.4} />
            </button>

            {/* Brand Logo */}
            <a href="/" className="flex items-center gap-2.5 group">
              <img
                src="/logo.png"
                alt="OnlinePlayer"
                className="h-9 w-9 sm:h-10 sm:w-10 object-contain drop-shadow-md group-hover:scale-105 transition-transform shrink-0"
              />
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

          {/* Center: Desktop Navigation Bar (Exact IteraPlay style: rounded-2xl, taller, larger text) */}
          <nav className="hidden lg:flex items-center gap-1.5 p-1.5 rounded-2xl bg-white dark:bg-[#14141d] border border-zinc-200 dark:border-[#262636] shadow-sm">
            {/* Home */}
            <a
              href="/"
              onClick={() => setActiveItem("home")}
              className={`flex items-center gap-2.5 px-4.5 py-2.5 rounded-xl text-sm font-bold transition-all ${
                activeItem === "home"
                  ? "bg-zinc-200/90 dark:bg-[#28283a] text-zinc-950 dark:text-white shadow-xs"
                  : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-[#1e1e2c]"
              }`}
            >
              <HomeIcon className="h-4 w-4" strokeWidth={2.4} />
              <span>Home</span>
            </a>

            {/* TeraBox Videos */}
            <a
              href="/terabox-videos"
              onClick={() => setActiveItem("terabox-videos")}
              className={`flex items-center gap-2.5 px-4.5 py-2.5 rounded-xl text-sm font-bold transition-all ${
                activeItem === "terabox-videos"
                  ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
                  : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-[#1e1e2c]"
              }`}
            >
              <PlayCircle className="h-4 w-4" strokeWidth={2.4} />
              <span>TeraBox Videos</span>
            </a>

            {/* Providers */}
            <a
              href="/#providers"
              onClick={() => setActiveItem("providers")}
              className={`flex items-center gap-2.5 px-4.5 py-2.5 rounded-xl text-sm font-bold transition-all ${
                activeItem === "providers"
                  ? "bg-zinc-200/90 dark:bg-[#28283a] text-zinc-950 dark:text-white shadow-xs"
                  : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-[#1e1e2c]"
              }`}
            >
              <Film className="h-4 w-4" strokeWidth={2.4} />
              <span>Providers</span>
            </a>

            {/* How To Use */}
            <a
              href="/#how-it-works"
              onClick={() => setActiveItem("guide")}
              className={`flex items-center gap-2.5 px-4.5 py-2.5 rounded-xl text-sm font-bold transition-all ${
                activeItem === "guide"
                  ? "bg-zinc-200/90 dark:bg-[#28283a] text-zinc-950 dark:text-white shadow-xs"
                  : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-[#1e1e2c]"
              }`}
            >
              <BookOpen className="h-4 w-4" strokeWidth={2.4} />
              <span>How To Use</span>
            </a>

            {/* API */}
            <a
              href="https://terabox.onlineplayer.site"
              target="_blank"
              rel="noreferrer"
              onClick={() => setActiveItem("api")}
              className={`flex items-center gap-2.5 px-4.5 py-2.5 rounded-xl text-sm font-bold transition-all ${
                activeItem === "api"
                  ? "bg-zinc-200/90 dark:bg-[#28283a] text-zinc-950 dark:text-white shadow-xs"
                  : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-[#1e1e2c]"
              }`}
            >
              <Code2 className="h-4 w-4" strokeWidth={2.4} />
              <span>API</span>
            </a>
          </nav>

          {/* Right: Bold Shortcuts Button + Theme Toggle Capsule */}
          <div className="flex items-center gap-3">
            {/* Bold Keyboard Shortcuts Button */}
            {onOpenShortcuts && (
              <button
                onClick={onOpenShortcuts}
                className="hidden sm:flex items-center gap-2.5 px-4 h-11 sm:h-12 rounded-2xl text-sm font-bold text-zinc-800 dark:text-zinc-200 bg-white dark:bg-[#14141d] hover:bg-zinc-100 dark:hover:bg-[#1e1e2c] border border-zinc-300 dark:border-[#262636] shadow-xs hover:border-blue-500 dark:hover:border-blue-500 transition-all cursor-pointer active:scale-95"
                title="Keyboard Shortcuts"
              >
                <Keyboard className="h-4.5 w-4.5 text-blue-500" strokeWidth={2.4} />
                <span>Shortcuts</span>
                <kbd className="hidden md:inline-flex items-center px-1.5 py-0.5 text-[11px] font-black rounded-md bg-zinc-100 dark:bg-[#262638] text-zinc-600 dark:text-zinc-400 border border-zinc-300 dark:border-[#38384e]">
                  ?
                </kbd>
              </button>
            )}

            {/* Day / Night Mode Pill Toggle */}
            <button
              onClick={toggleTheme}
              className="relative flex items-center h-9 sm:h-10 w-15 sm:w-16 rounded-full bg-zinc-200 dark:bg-[#14141d] border border-zinc-300 dark:border-[#262636] p-1 transition-colors cursor-pointer"
              aria-label="Toggle theme mode"
              title={theme === "dark" ? "Switch to Day Mode" : "Switch to Night Mode"}
            >
              <div
                className={`h-7 sm:h-7.5 w-7 sm:w-7.5 rounded-full flex items-center justify-center transition-transform duration-200 ${
                  theme === "dark"
                    ? "translate-x-6 sm:translate-x-6.5 bg-[#2563eb] text-white shadow-md"
                    : "translate-x-0 bg-white text-amber-500 shadow-md"
                }`}
              >
                {theme === "dark" ? (
                  <Moon className="h-4 w-4 fill-white stroke-white" strokeWidth={2.4} />
                ) : (
                  <Sun className="h-4 w-4 fill-amber-500 stroke-amber-500" strokeWidth={2.4} />
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
                  <img
                    src="/logo.png"
                    alt="OnlinePlayer"
                    className="h-8.5 w-8.5 object-contain drop-shadow-sm shrink-0"
                  />
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

                {/* TeraBox Videos */}
                <a
                  href="/terabox-videos"
                  onClick={() => {
                    setActiveItem("terabox-videos");
                    setSidebarOpen(false);
                  }}
                  className={`flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm font-bold transition-all ${
                    activeItem === "terabox-videos"
                      ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
                      : "text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-[#181820]"
                  }`}
                >
                  <PlayCircle className="h-4.5 w-4.5" strokeWidth={2.4} />
                  <span>TeraBox Videos</span>
                </a>

                {/* API */}
                <a
                  href="https://terabox.onlineplayer.site"
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

                {/* Providers */}
                <a
                  href="/#providers"
                  onClick={() => {
                    setActiveItem("providers");
                    setSidebarOpen(false);
                  }}
                  className={`flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${
                    activeItem === "providers"
                      ? "bg-blue-600/15 text-blue-500 dark:text-blue-400 border border-blue-500/30 font-bold"
                      : "text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-[#181820]"
                  }`}
                >
                  <Film className="h-4.5 w-4.5" strokeWidth={2.4} />
                  <span>Providers</span>
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
