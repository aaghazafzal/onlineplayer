import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ThemeProvider } from "../context/ThemeContext";

const description =
  "Paste a TeraBox, Instagram, Spotify or JioSaavn link and play or download it in your browser: full-length videos, reels and 320 kbps songs. Free, no login, no ads.";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://onlineplayer.site"),
  title: "OnlinePlayer: play and download TeraBox, Instagram, Spotify and JioSaavn links",
  description,
  icons: {
    icon: [
      { url: "/icon.svg?v=4", type: "image/svg+xml" },
      { url: "/icon.png?v=4", type: "image/png", sizes: "32x32" },
      { url: "/favicon.ico?v=4", sizes: "any" },
    ],
    shortcut: "/favicon.ico?v=4",
    apple: "/apple-icon.png?v=4",
  },
  openGraph: {
    title: "OnlinePlayer: paste a link, play it whole",
    description,
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "OnlinePlayer: paste a link, play it whole" }],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "OnlinePlayer: paste a link, play it whole",
    description,
    images: ["/og.png"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#c3cbe5" },
    { media: "(prefers-color-scheme: dark)", color: "#15171d" },
  ],
};

// Runs before first paint: marks JS as available (motion start states) and applies
// the saved or system theme so there is no flash of the wrong one.
const bootScript = `(function(){var d=document.documentElement;d.classList.add('js');try{var q=new URLSearchParams(location.search).get('theme');var t=(q==='light'||q==='dark')?q:localStorage.getItem('onlineplayer_theme');if(t!=='light'&&t!=='dark'){t=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}d.classList.toggle('dark',t==='dark')}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: bootScript }} />
        <link rel="preconnect" href="https://api.fontshare.com" />
        <link rel="preconnect" href="https://cdn.fontshare.com" crossOrigin="anonymous" />
        <link href="https://api.fontshare.com/v2/css?f[]=chillax@400,500,600&display=swap" rel="stylesheet" />
        <link rel="icon" type="image/svg+xml" href="/icon.svg?v=4" />
        <link rel="icon" type="image/png" href="/icon.png?v=4" sizes="32x32" />
        <link rel="icon" type="image/x-icon" href="/favicon.ico?v=4" />
        <link rel="apple-touch-icon" href="/apple-icon.png?v=4" />
      </head>
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
