import { RootProvider } from 'fumadocs-ui/provider/next';
import { Inter, Space_Grotesk } from 'next/font/google';
import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import { siteUrl, siteName, siteDescription } from '@/lib/site';
import { SoftwareApplicationJsonLd } from '@/components/json-ld';
import './global.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
});

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-space-grotesk',
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
  other: {
    'theme-color': '#1a1a2e',
  },
};

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${inter.variable} ${spaceGrotesk.variable}`}
    >
      <body className="flex min-h-screen flex-col">
        <SoftwareApplicationJsonLd />
        <RootProvider>{children}</RootProvider>
      </body>
    </html>
  );
}
