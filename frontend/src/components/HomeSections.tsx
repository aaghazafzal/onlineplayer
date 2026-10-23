"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUp } from "lucide-react";
import { DirectFragment, InstagramFragment, JioSaavnFragment, SpotifyFragment, TeraBoxFragment } from "./ProductFragments";

/* ==========================================================================
   Hero stage: the accent field at full height with the three players
   crossfading slowly (signature move). Reduced motion shows the first only.
   ========================================================================== */
const STAGE_FRAGMENTS = [TeraBoxFragment, InstagramFragment, SpotifyFragment, JioSaavnFragment];

export function HeroStage() {
  const [active, setActive] = useState(0);

  useEffect(() => {
    // Desktop only (the stage is hidden on phones), and still under reduced motion
    if (!matchMedia("(min-width: 1024px)").matches || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let timer: ReturnType<typeof setInterval> | null = null;
    const start = () => {
      timer = setInterval(() => setActive((i) => (i + 1) % STAGE_FRAGMENTS.length), 6000);
    };
    const stop = () => timer && clearInterval(timer);
    const onVis = () => (document.hidden ? stop() : start());
    start();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  return (
    <div className="relative h-full min-h-[48svh] rounded-ui bg-accent overflow-clip" aria-label="What the player shows">
      {STAGE_FRAGMENTS.map((Fragment, i) => (
        <div
          key={i}
          className="xfade absolute inset-0 flex items-center justify-center p-[6%]"
          style={{ opacity: active === i ? 1 : 0 }}
          aria-hidden={active !== i}
        >
          <Fragment className="w-full max-w-[540px]" />
        </div>
      ))}
    </div>
  );
}

/* ==========================================================================
   Showcase: "Object on a disc", the disc swapped for the motif's own shape
   (a segment block). Choosing a service swaps the player and the block colour.
   ========================================================================== */
const SERVICES = [
  {
    id: "terabox",
    name: "TeraBox",
    block: "bg-field-2",
    Fragment: TeraBoxFragment,
    fact: "The whole video, not the 30-second preview, in 480p or 360p. Share folders list every file, and any of them downloads as MP4.",
  },
  {
    id: "instagram",
    name: "Instagram",
    block: "bg-field-4",
    Fragment: InstagramFragment,
    fact: "Reels, videos, photos and carousels from public accounts. Every slide of a carousel saves on its own.",
  },
  {
    id: "spotify",
    name: "Spotify",
    block: "bg-field-5",
    Fragment: SpotifyFragment,
    fact: "Each song is matched to the same recording and plays in full at 320 kbps. Playlists and albums play track by track.",
  },
  {
    id: "jiosaavn",
    name: "JioSaavn",
    block: "bg-field-2",
    Fragment: JioSaavnFragment,
    fact: "Songs, albums, playlists and an artist's top songs, all at up to 320 kbps. Playing and saving come straight from JioSaavn's servers.",
  },
  {
    id: "direct",
    name: "Direct links",
    block: "bg-field-1",
    Fragment: DirectFragment,
    fact: "Any address ending in .mp4 or .m3u8 plays as it is, with the same controls and keyboard shortcuts.",
  },
];

export function ProviderShowcase() {
  const [active, setActive] = useState(0);
  const current = SERVICES[active];

  return (
    <section id="services" aria-labelledby="services-title" className="bg-field-3 py-[var(--section-gap)]">
      <div className="frame grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-6 items-end">
        {/* The block with the player standing in front, breaking its top edge */}
        <div className="lg:col-span-7 lg:col-start-6 lg:row-start-1 relative pt-10" data-reveal="scale">
          <div className={`xfade-bg ${current.block} rounded-ui aspect-[5/4] lg:aspect-auto lg:h-[64vh] transition-colors duration-500`} />
          {SERVICES.map(({ id, Fragment }, i) => (
            <div
              key={id}
              className="xfade absolute inset-x-0 top-0 flex justify-center px-[8%]"
              style={{ opacity: active === i ? 1 : 0 }}
              aria-hidden={active !== i}
            >
              <Fragment className="w-full max-w-[460px]" />
            </div>
          ))}
        </div>

        {/* The list of names; the heading is its first line */}
        <div className="lg:col-span-5 lg:row-start-1 lg:col-start-1">
          <h2 id="services-title" className="text-head text-muted font-semibold tracking-[-0.03em] leading-[1.15]" data-reveal>
            What it plays
          </h2>
          <ul role="tablist" aria-label="Services" className="mt-1 flex flex-wrap lg:flex-col gap-x-6 gap-y-1 lg:gap-0">
            {SERVICES.map((s, i) => (
              <li key={s.id} role="presentation" data-reveal style={{ "--i": i + 1 } as React.CSSProperties}>
                <button
                  type="button"
                  role="tab"
                  aria-selected={active === i}
                  onClick={() => setActive(i)}
                  className={`whitespace-nowrap text-left text-head font-semibold tracking-[-0.03em] leading-[1.15] transition-colors duration-200 cursor-pointer ${
                    active === i ? "text-ink" : "text-muted hover:text-ink"
                  }`}
                >
                  {active === i ? <span className="underline decoration-[6px] underline-offset-[10px] decoration-accent">{s.name}</span> : s.name}
                </button>
              </li>
            ))}
          </ul>
          <p className="mt-8 max-w-[44ch] text-body text-ink" aria-live="polite" data-reveal style={{ "--i": 5 } as React.CSSProperties}>
            {current.fact}
          </p>
        </div>
      </div>
    </section>
  );
}

/* ==========================================================================
   How it works: the progress bar enlarged into the diagram. Widths follow how
   long each stage takes: copying and pasting are slivers, watching is the bar.
   ========================================================================== */
const STAGES = [
  { time: "A second", text: "First, copy the share link in the app.", grow: 12, bg: "bg-field-2" },
  { time: "A second", text: "Then paste it into the box at the top.", grow: 12, bg: "bg-field-5" },
  { time: "A few seconds", text: "Next, the full stream is found for you.", grow: 16, bg: "bg-field-1" },
  { time: "As long as it runs", text: "Finally, watch it here or save it.", grow: 60, bg: "bg-accent text-accent-ink" },
];

export function HowItWorks() {
  return (
    <section id="how" aria-labelledby="how-title" className="bg-field-4 py-[var(--section-gap)]">
      <div className="frame">
        <h2 id="how-title" className="text-display max-w-[14ch]" data-reveal>
          From link to playing
        </h2>

        <ol data-ui className="mt-16 flex flex-col lg:flex-row gap-[6px] lg:h-[22vh] lg:min-h-[180px]">
          {STAGES.map((s, i) => (
            <li
              key={i}
              className="flex flex-col lg:block min-w-0"
              style={{ flexGrow: s.grow, flexBasis: 0, "--i": i } as React.CSSProperties}
              data-reveal
            >
              <div className={`${s.bg} rounded-ui p-5 h-full min-h-[96px] lg:min-h-0`}>
                <span className="text-lead font-semibold tracking-[-0.02em] leading-tight block">{s.time}</span>
                <span className="lg:hidden mt-2 block text-body">{s.text}</span>
              </div>
            </li>
          ))}
        </ol>
        <div className="hidden lg:flex gap-[6px] mt-5" aria-hidden="true">
          {STAGES.map((s, i) => (
            <p key={i} className="text-body max-w-[22ch] min-w-0 pr-3" style={{ flexGrow: s.grow, flexBasis: 0 }}>
              {s.text}
            </p>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ==========================================================================
   Link formats: one giant word over a stack of filled bars that open in place.
   ========================================================================== */
const FORMATS: { name: string; rows: [string, string][] }[] = [
  {
    name: "TeraBox share links",
    rows: [
      ["terabox.app/s/…", "Full video"],
      ["1024terabox.com/s/…", "Full video"],
      ["1024tera.com/s/…", "Full video"],
      ["terasharelink.com/s/…", "Full video"],
      ["nephobox, dubox, mirrobox, freeterabox", "Full video"],
      ["Folder links", "Every file listed"],
    ],
  },
  {
    name: "Instagram posts and reels",
    rows: [
      ["instagram.com/reel/…", "Video"],
      ["instagram.com/p/…", "Photo, video or carousel"],
      ["instagram.com/tv/…", "Video"],
    ],
  },
  {
    name: "Spotify songs",
    rows: [
      ["open.spotify.com/track/…", "Full song, 320 kbps"],
      ["spotify:track:…", "Full song, 320 kbps"],
      ["spotify.link/…", "Short links work too"],
    ],
  },
  {
    name: "Spotify playlists and albums",
    rows: [
      ["open.spotify.com/playlist/…", "Up to 100 tracks"],
      ["open.spotify.com/album/…", "Every track"],
    ],
  },
  {
    name: "JioSaavn",
    rows: [
      ["jiosaavn.com/song/…", "Full song, 320 kbps"],
      ["jiosaavn.com/album/…", "Every song"],
      ["jiosaavn.com/featured/…", "Playlist, up to 200 songs"],
      ["jiosaavn.com/artist/…", "Top songs"],
    ],
  },
  {
    name: "Direct video files",
    rows: [
      ["…/video.mp4", "Plays as it is"],
      ["…/stream.m3u8", "HLS, plays and downloads"],
    ],
  },
];

export function LinkFormats() {
  // Rows render only while their group is open, so closed groups hold no hidden text
  const [open, setOpen] = useState<Record<string, boolean>>({ [FORMATS[0].name]: true });
  return (
    <section id="links" aria-labelledby="links-title" className="bg-bg py-[var(--section-gap)]">
      <div className="frame">
        <div className="mx-auto lg:max-w-[640px] [container-type:inline-size]">
          <h2
            id="links-title"
            className="font-semibold leading-[0.8] tracking-[-0.05em] text-ink text-[36cqw] -ml-[0.04em]"
            data-reveal
          >
            Links
          </h2>
          <div className="mt-5 flex flex-col gap-[6px]">
            {FORMATS.map((f, i) => (
              <details
                key={f.name}
                open={i === 0}
                onToggle={(e) => {
                  const isOpen = e.currentTarget.open;
                  setOpen((prev) => ({ ...prev, [f.name]: isOpen }));
                }}
                className="group rounded-ui bg-surface"
                data-reveal
                style={{ "--i": i } as React.CSSProperties}
              >
                <summary className="flex min-h-[56px] items-center justify-between gap-4 px-[18px] text-body font-medium">
                  {f.name}
                  <span className="plus" aria-hidden="true" />
                </summary>
                {open[f.name] && (
                  <ul className="px-5 pb-5 pt-1 flex flex-col gap-[14px]">
                    {f.rows.map(([pattern, gives]) => (
                      <li key={pattern} className="flex items-baseline justify-between gap-6 text-body">
                        <span className="min-w-0 break-words">{pattern}</span>
                        <span className="shrink-0 text-right text-muted">{gives}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </details>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ==========================================================================
   FAQ: sticky heading, filled tiles; the open one takes the accent.
   ========================================================================== */
const QUESTIONS: [string, string][] = [
  [
    "Is it really free?",
    "Yes. There is no account, no subscription and no ads. It runs on free hosting, which is why one person can open a limited number of new links per minute.",
  ],
  [
    "Why did a Spotify song play only 30 seconds?",
    "We look for the same recording, same artist and same length, on another catalogue. When no exact match exists we play Spotify's official preview instead of a different song, and the player says so.",
  ],
  [
    "Which TeraBox links work?",
    "Public share links from any TeraBox domain: terabox.app, 1024terabox, 1024tera, terasharelink, nephobox, dubox and the others. Private, deleted or expired links cannot be opened.",
  ],
  [
    "Do you keep my links or files?",
    "Files are never stored here: video and audio come straight from the original service. The links you played are kept only in this browser, in the Recent list, and you can clear them.",
  ],
  [
    "Why does a video sometimes take a few seconds to start?",
    "The first time anyone opens a link, the full stream has to be found. After that it is cached, so it starts almost at once for a few hours.",
  ],
  [
    "How do downloads work?",
    "TeraBox videos are saved as MP4, assembled in your browser from the stream. Instagram media, Spotify and JioSaavn songs (.m4a) download directly.",
  ],
  [
    "Does it work on my phone?",
    "Yes, in any modern browser on iPhone or Android. On phones TeraBox video plays straight from TeraBox's servers, which is why it starts fast.",
  ],
  [
    "What can I play here?",
    "Only content you are allowed to watch or listen to. OnlinePlayer does not host, upload or index any files; it plays links you already have.",
  ],
];

export function Faq() {
  return (
    <section id="faq" aria-labelledby="faq-title" className="bg-field-5 py-[var(--section-gap)]">
      <div className="frame grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-6">
        <h2 id="faq-title" className="lg:col-span-4 text-head lg:sticky lg:top-24 self-start max-w-[10ch]" data-reveal>
          Questions people ask
        </h2>
        <div className="lg:col-span-8 flex flex-col gap-2">
          {QUESTIONS.map(([q, a], i) => (
            <details
              key={q}
              name="faq"
              className="group rounded-ui bg-paper text-ink open:bg-accent open:text-accent-ink transition-colors duration-200"
              data-reveal
              style={{ "--i": i % 4 } as React.CSSProperties}
            >
              <summary className="flex min-h-[64px] lg:min-h-[72px] items-center justify-between gap-6 px-5 lg:px-6 text-[1.125rem] lg:text-[1.25rem] font-medium leading-snug">
                {q}
                <span className="plus" aria-hidden="true" />
              </summary>
              <p className="px-5 lg:px-6 pb-6 max-w-[52ch] text-body">{a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ==========================================================================
   Footer: the name built from blocks, like stream segments of uneven height.
   ========================================================================== */
const BLOCK_COLOURS = ["bg-field-2", "bg-accent", "bg-field-5", "bg-field-1", "bg-field-4", "bg-field-3"];
const BLOCK_HEIGHTS = [100, 78, 92, 64, 86, 70, 96, 74, 88, 66, 100, 80];

function BlockRow({ letters, offset }: { letters: string; offset: number }) {
  return (
    <div className="flex flex-1 items-end gap-1 min-h-0">
      {letters.split("").map((ch, j) => {
        const i = j + offset;
        const colour = BLOCK_COLOURS[i % BLOCK_COLOURS.length];
        return (
          <span
            key={i}
            className={`${colour} ${colour === "bg-accent" ? "text-accent-ink" : "text-ink"} rounded-ui flex flex-1 basis-0 items-end justify-center pb-[0.1em] font-semibold leading-none tracking-[-0.04em] text-[min(13vw,8.5rem)] lg:text-[min(9vw,8.5rem)]`}
            style={{ height: `${BLOCK_HEIGHTS[i]}%` }}
          >
            {ch}
          </span>
        );
      })}
    </div>
  );
}

export function SiteFooter() {
  return (
    <footer className="bg-paper pt-[var(--section-gap)] pb-10">
      <div className="frame">
        <p className="sr-only">OnlinePlayer</p>
        {/* Phones: two rows (Online / Player); desktop: one row across the width */}
        <div aria-hidden="true" className="flex flex-col lg:flex-row gap-1 h-[30svh] lg:h-[34svh] min-h-[200px]">
          <BlockRow letters="Online" offset={0} />
          <BlockRow letters="Player" offset={6} />
        </div>

        <div className="mt-14 grid grid-cols-2 lg:grid-cols-12 gap-x-6 gap-y-10 text-[0.9375rem]">
          <nav aria-label="Play" className="lg:col-span-2 flex flex-col gap-2">
            <Link className="link" href="/#play">Play a link</Link>
            <Link className="link" href="/terabox-videos">TeraBox videos</Link>
          </nav>
          <nav aria-label="Services" className="lg:col-span-2 flex flex-col gap-2">
            <Link className="link" href="/#services">TeraBox</Link>
            <Link className="link" href="/#services">Instagram</Link>
            <Link className="link" href="/#services">Spotify</Link>
            <Link className="link" href="/#services">JioSaavn</Link>
          </nav>
          <nav aria-label="Help" className="lg:col-span-2 flex flex-col gap-2">
            <Link className="link" href="/#how">How it works</Link>
            <Link className="link" href="/#links">Supported links</Link>
            <Link className="link" href="/#faq">Questions</Link>
          </nav>
          <nav aria-label="Status" className="lg:col-span-2 flex flex-col gap-2">
            <a className="link" href="https://status.onlineplayer.site">Service status</a>
          </nav>
          <p className="col-span-2 lg:col-span-4 text-muted text-small leading-relaxed">
            Sea clip: &ldquo;Ocean surface waves 09&rdquo; by Mostafameraji, CC0, via Wikimedia Commons. Photographs by Michael
            Hirsch, Julien Moreau and Todd Quackenbush, Unsplash licence.
          </p>
        </div>

        <div className="mt-14 flex items-center justify-between gap-4 text-small text-muted">
          <span>© {new Date().getFullYear()} OnlinePlayer</span>
          <a href="#top" className="btn btn-ink min-h-[44px] px-4 text-small">
            <ArrowUp className="h-4 w-4" strokeWidth={2.4} /> Back to top
          </a>
        </div>
      </div>
    </footer>
  );
}
