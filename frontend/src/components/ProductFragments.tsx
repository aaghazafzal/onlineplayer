import React from "react";
import { Play, Download, Pause } from "lucide-react";
import { Segments } from "./Segments";

/*
 * Real-size fragments of the player, used as the page's pictures (hero stage and
 * showcase). They mirror the actual players: same controls, same numbers the
 * workers return. Sample media: CC0 sea clip and Unsplash photos (credited in the footer).
 */

export function TeraBoxFragment({ className = "" }: { className?: string }) {
  return (
    <figure className={`on-stage bg-stage text-stage-ink rounded-ui p-3 sm:p-4 ${className}`}>
      <div className="relative aspect-video overflow-clip rounded-ui bg-black">
        <video
          className="drift h-full w-full object-cover"
          src="/media/ocean-surface-waves-09.webm"
          poster="/media/ocean-surface-waves-09-poster.jpg"
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          width={854}
          height={480}
          aria-hidden="true"
        />
      </div>
      <figcaption data-ui className="mt-3 sm:mt-4 space-y-3">
        <div className="flex items-center justify-between gap-3 text-small">
          <span className="truncate font-medium">sea-view-from-the-window.mp4</span>
          <span className="tabular text-stage-muted shrink-0">1:12 / 2:47</span>
        </div>
        <div className="relative">
          <Segments count={28} played={0.43} markAt={4} className="h-3" />
          <span className="absolute left-[16%] top-5 text-small text-stage-muted whitespace-nowrap">
            0:30, where previews stop
          </span>
        </div>
        <div className="flex items-center justify-between gap-3 pt-6 text-small text-stage-muted">
          <span>480p HLS · 28 segments · 64.2 MB</span>
          <span className="inline-flex items-center gap-1.5 text-stage-ink">
            <Pause className="h-4 w-4" strokeWidth={2.4} /> Playing
          </span>
        </div>
      </figcaption>
    </figure>
  );
}

export function InstagramFragment({ className = "" }: { className?: string }) {
  return (
    <figure className={`bg-paper text-ink rounded-ui p-3 sm:p-4 ${className}`}>
      <div data-ui className="flex items-center justify-between pb-3 text-small">
        <span className="font-medium">@technology</span>
        <span className="tabular text-muted">1 of 3</span>
      </div>
      <div className="aspect-[4/5] overflow-clip rounded-ui">
        <img
          src="/media/photo-623.jpg"
          alt="A red suspension bridge seen from the water, its tower in fog"
          width={1200}
          height={1500}
          className="h-full w-full object-cover"
        />
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {["/media/photo-623.jpg", "/media/photo-1081.jpg", "/media/photo-954.jpg"].map((src, i) => (
          <div key={src} className={`aspect-square overflow-clip rounded-ui ${i === 0 ? "outline-3 outline-accent -outline-offset-3" : ""}`}>
            <img src={src} alt="" width={400} height={400} loading="lazy" className="h-full w-full object-cover" />
          </div>
        ))}
      </div>
      <figcaption data-ui className="mt-3 flex items-center justify-between gap-3">
        <span className="text-small text-muted">Carousel · 3 photos</span>
        <span className="btn btn-accent min-h-[40px] px-4 text-small">
          <Download className="h-4 w-4" strokeWidth={2.4} /> Save photo
        </span>
      </figcaption>
    </figure>
  );
}

export function SpotifyFragment({ className = "" }: { className?: string }) {
  return (
    <figure className={`on-stage bg-stage text-stage-ink rounded-ui p-3 sm:p-4 ${className}`}>
      <div data-ui className="flex gap-4">
        <div className="aspect-square w-[38%] shrink-0 rounded-ui bg-field-5 text-[#141414] p-3 flex flex-col justify-end">
          <span className="text-lead font-semibold leading-none tracking-[-0.03em]">Kesariya</span>
          <span className="text-small mt-1">Brahmastra</span>
        </div>
        <div className="min-w-0 flex flex-col justify-between py-1">
          <div>
            <p className="text-lead font-semibold leading-tight tracking-[-0.02em] truncate">Kesariya</p>
            <p className="text-small text-stage-muted truncate">Pritam, Arijit Singh</p>
          </div>
          <p className="text-small">
            Verified match <span className="text-stage-muted">· 4:28 · 320 kbps AAC</span>
          </p>
        </div>
      </div>
      <figcaption data-ui className="mt-4 space-y-3">
        <Segments count={40} played={0.6} className="h-3" />
        <div className="flex items-center justify-between text-small tabular text-stage-muted">
          <span>2:41</span>
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-ui bg-accent text-accent-ink">
            <Pause className="h-5 w-5" strokeWidth={2.4} />
          </span>
          <span>4:28</span>
        </div>
      </figcaption>
    </figure>
  );
}

export function DirectFragment({ className = "" }: { className?: string }) {
  return (
    <figure className={`on-stage bg-stage text-stage-ink rounded-ui p-3 sm:p-4 ${className}`}>
      <div className="relative aspect-video overflow-clip rounded-ui">
        <img
          src="/media/photo-1081.jpg"
          alt="A stepped white building corner against a pale sky"
          width={1200}
          height={1500}
          loading="lazy"
          className="h-full w-full object-cover"
        />
        <span className="absolute inset-0 m-auto inline-flex h-14 w-14 items-center justify-center rounded-ui bg-accent text-accent-ink">
          <Play className="h-6 w-6 fill-current" strokeWidth={2.4} />
        </span>
      </div>
      <figcaption data-ui className="mt-3 space-y-3 text-small">
        <p className="truncate text-stage-muted">https://media.example.org/talks/opening.m3u8</p>
        <Segments count={24} played={0} className="h-3" />
      </figcaption>
    </figure>
  );
}

export function JioSaavnFragment({ className = "" }: { className?: string }) {
  const rows: [string, string][] = [
    ["Kesariya", "4:28"],
    ["Deva Deva", "4:39"],
    ["Rasiya", "3:42"],
  ];
  return (
    <figure className={`bg-paper text-ink rounded-ui p-3 sm:p-4 ${className}`}>
      <div data-ui className="flex items-end gap-4">
        <div className="aspect-square w-[34%] shrink-0 rounded-ui bg-field-2 text-[#141414] p-3 flex flex-col justify-end">
          <span className="text-lead font-semibold leading-none tracking-[-0.03em]">Brahmastra</span>
          <span className="text-small mt-1">9 songs</span>
        </div>
        <div className="min-w-0 pb-1">
          <p className="text-small text-muted">Album · JioSaavn</p>
          <p className="text-lead font-semibold leading-tight tracking-[-0.02em] truncate">Brahmastra</p>
          <p className="text-small text-muted truncate">Pritam, Arijit Singh</p>
        </div>
      </div>
      <figcaption data-ui className="mt-4 flex flex-col gap-1">
        {rows.map(([t, d], i) => (
          <div key={t} className={`flex items-center gap-3 rounded-ui px-3 min-h-[44px] ${i === 0 ? "bg-accent text-accent-ink" : "bg-surface-2"}`}>
            <span className="text-small tabular w-4">{i === 0 ? <Pause className="h-4 w-4" strokeWidth={2.4} /> : i + 1}</span>
            <span className="flex-1 text-small font-medium truncate">{t}</span>
            <span className="text-small tabular opacity-80">{d}</span>
            <Download className="h-4 w-4" strokeWidth={2.4} />
          </div>
        ))}
      </figcaption>
    </figure>
  );
}

export function YouTubeFragment({ className = "" }: { className?: string }) {
  return (
    <figure className={`on-stage bg-stage text-stage-ink rounded-ui p-3 sm:p-4 ${className}`}>
      <div className="relative aspect-video overflow-clip rounded-ui">
        <img
          src="/media/photo-954.jpg"
          alt="A narrow opening in a white wall showing a white staircase"
          width={1200}
          height={1500}
          loading="lazy"
          className="h-full w-full object-cover"
        />
        <span className="absolute inset-0 m-auto inline-flex h-14 w-14 items-center justify-center rounded-ui bg-accent text-accent-ink">
          <Play className="h-6 w-6 fill-current" strokeWidth={2.4} />
        </span>
      </div>
      <figcaption data-ui className="mt-3 space-y-3">
        <div className="text-small">
          <p className="font-medium truncate">Stairs of light, a short film</p>
          <p className="text-stage-muted">YouTube · no ads · up to 1080p</p>
        </div>
        <div className="grid grid-cols-2 gap-2 text-small">
          <span className="btn btn-accent min-h-[40px] text-small">MP4</span>
          <span className="btn min-h-[40px] text-small bg-stage-ink text-stage">M4A</span>
        </div>
      </figcaption>
    </figure>
  );
}
