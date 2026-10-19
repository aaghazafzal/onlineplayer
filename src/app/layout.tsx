import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "../context/ThemeContext";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://onlineplayer.app"),
  title: "OnlinePlayer — Universal Cloud Video Player & Downloader Online",
  description: "Fast, ad-free online video player & high-speed downloader for TeraBox, Instagram, DiskPlayer, and direct cloud streams without preview cutoffs.",
  icons: {
    icon: "/logo.png",
    shortcut: "/logo.png",
    apple: "/logo.png",
  },
  openGraph: {
    title: "OnlinePlayer — Universal Cloud Video Player & Downloader",
    description: "Stream and download TeraBox, Instagram, DiskPlayer, and direct cloud links with zero limits and high-speed playback.",
    images: [{ url: "/logo.png", width: 512, height: 512, alt: "OnlinePlayer Logo" }],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "OnlinePlayer — Universal Cloud Video Player & Downloader",
    description: "Stream and download TeraBox, Instagram, DiskPlayer, and direct cloud links with zero limits.",
    images: ["/logo.png"],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html 
      lang="en" 
      className={`${geistSans.variable} ${geistMono.variable} dark h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        <link rel="icon" type="image/png" href="/logo.png" />
        <link rel="apple-touch-icon" href="/logo.png" />
      </head>
      <body className="min-h-full flex flex-col antialiased" suppressHydrationWarning>
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
