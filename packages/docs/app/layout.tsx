import { RootProvider } from 'fumadocs-ui/provider/next';
import { Newsreader, Onest } from 'next/font/google';
import type { ReactNode } from 'react';
import type { Metadata, Viewport } from 'next';
import { siteUrl, siteName, siteDescription } from '@/lib/site';
import { SoftwareApplicationJsonLd } from '@/components/json-ld';
import './global.css';

// Onest carries body text and section headings.
const onest = Onest({
  subsets: ['latin'],
  variable: '--font-onest',
  display: 'swap',
});

// Newsreader carries page titles. `axes: ['opsz']` keeps the optical-size axis, so the
// face is cut for display at a title's size instead of being a 16px text face scaled up.
const newsreader = Newsreader({
  subsets: ['latin'],
  axes: ['opsz'],
  variable: '--font-newsreader',
  display: 'swap',
});

// No webfont for code on purpose — see the --font-mono note in global.css. Code blocks use
// the platform monospace, which ships box-drawing and geometric glyphs in the same face as
// its letters, so preformatted text keeps a single advance width.

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    template: '%s | MeowKit',
    default: 'MeowKit — AI agent toolkit for Claude Code',
  },
  description: siteDescription,
  applicationName: siteName,
  authors: [{ name: 'ngocsangyem', url: 'https://github.com/ngocsangyem' }],
  keywords: [
    'claude code',
    'ai agent',
    'toolkit',
    'skills',
    'tdd',
    'code review',
    'meowkit',
    'claude',
    'anthropic',
  ],
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/favicon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon-16.png', sizes: '16x16', type: 'image/png' },
    ],
    shortcut: '/favicon.ico',
    apple: '/apple-touch-icon.png',
  },
  openGraph: {
    type: 'website',
    siteName,
    locale: 'en_US',
    url: siteUrl,
    images: '/og-image.png',
  },
  twitter: {
    card: 'summary_large_image',
    images: '/og-image.png',
  },
};

/* One entry per theme so the mobile browser chrome matches whichever ground is on
   screen: mist paper in light, night in dark. A single value bands against the other. */
export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#eef2f7' },
    { media: '(prefers-color-scheme: dark)', color: '#131a27' },
  ],
};

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${onest.variable} ${newsreader.variable}`}
    >
      <body className="flex min-h-screen flex-col">
        <SoftwareApplicationJsonLd />
        <RootProvider>{children}</RootProvider>
      </body>
    </html>
  );
}
