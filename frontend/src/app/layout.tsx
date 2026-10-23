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
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://onlineplayer.site"),
  title: "OnlinePlayer — Universal Cloud Video Player & Downloader Online",
  description: "Fast, ad-free online video player & high-speed downloader for TeraBox, Instagram, DiskWala, and direct cloud streams without preview cutoffs.",
  icons: {
    icon: [
      { url: "/icon.png?v=3", type: "image/png", sizes: "32x32" },
      { url: "/favicon.ico?v=3", sizes: "any" },
    ],
    shortcut: "/favicon.ico?v=3",
    apple: "/apple-icon.png?v=3",
  },
  openGraph: {
    title: "OnlinePlayer — Universal Cloud Video Player & Downloader",
    description: "Stream and download TeraBox, Instagram, DiskWala, and direct cloud links with zero limits and high-speed playback.",
    images: [{ url: "/logo.png", width: 512, height: 512, alt: "OnlinePlayer Logo" }],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "OnlinePlayer — Universal Cloud Video Player & Downloader",
    description: "Stream and download TeraBox, Instagram, DiskWala, and direct cloud links with zero limits.",
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
        <link rel="icon" type="image/png" href="/icon.png?v=3" sizes="32x32" />
        <link rel="icon" type="image/x-icon" href="/favicon.ico?v=3" />
        <link rel="apple-touch-icon" href="/apple-icon.png?v=3" />
      </head>
      <body className="min-h-full flex flex-col antialiased" suppressHydrationWarning>
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
