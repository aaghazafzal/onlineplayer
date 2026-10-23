import React from "react";

interface SegmentsProps {
  /** Number of stream segments to draw */
  count: number;
  /** Fraction already played, 0..1 */
  played?: number;
  /** Index of a segment to mark (e.g. where a 30-second preview would stop) */
  markAt?: number;
  /** Animate the fill once on load (hero band) */
  play?: boolean;
  className?: string;
  /** Per-segment relative widths; defaults to equal */
  weights?: number[];
}

/** The page's one motif: a stream cut into segments, played part in ink. */
export function Segments({ count, played = 1, markAt, play = false, className = "", weights }: SegmentsProps) {
  const playedCount = Math.round(count * played);
  return (
    <div className={`segments ${play ? "play" : ""} ${className}`} aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <i
          key={i}
          className={i === markAt ? "cut" : i < playedCount ? "" : "rest"}
          style={{ "--i": i, ...(weights ? { flexGrow: weights[i] ?? 1 } : {}) } as React.CSSProperties}
        />
      ))}
    </div>
  );
}
