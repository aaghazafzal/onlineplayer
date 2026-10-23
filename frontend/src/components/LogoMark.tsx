import React from "react";

// A play triangle cut into four stream segments: the site's motif as its mark.
// Same geometry as public/logo.svg and the icons rendered from it.
const SEGMENTS = [
  "21,14 26.5,17.19 26.5,46.81 21,50",
  "29.5,18.94 35,22.13 35,41.87 29.5,45.06",
  "38,23.87 43.5,27.06 43.5,36.94 38,40.13",
  "46.5,28.81 52,32 46.5,35.19",
];

/** The OnlinePlayer mark in the theme's colours (teal tile, light segments; inverted in dark mode) */
export function LogoMark({ size = 32, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className={className} aria-hidden="true" focusable="false">
      <rect width="64" height="64" rx="14" className="fill-accent" />
      <g className="fill-accent-ink stroke-accent-ink" strokeWidth="1.6" strokeLinejoin="round">
        {SEGMENTS.map((points) => (
          <polygon key={points} points={points} />
        ))}
      </g>
    </svg>
  );
}
