import { DocsLayout } from 'fumadocs-ui/layouts/docs';
import type { ReactNode } from 'react';
import { source } from '@/lib/source';
import { baseOptions } from '@/lib/layout.shared';

// Docs layout lives at app/[...slug] (not app/docs) so every page keeps its
// VitePress-era URL with no /docs prefix.
//
// Tabs are listed explicitly rather than left to `getLayoutTabs(tree)`. That default only finds
// `root: true` folders that are CHILDREN OF THE TREE, so it silently produced no tabs at all
// once the root meta.json stopped ending in a "..." catch-all — CLI, Reference, and Workflows
// became unreachable from the sidebar with nothing reporting it. An explicit list cannot fail
// that way, and `check-nav-coverage.mjs` now asserts every root tree has a tab here.
//
// tabMode is left at its default. "top" is NOT usable with this layout: it renders LayoutTabs
// into `[grid-area:main]`, the same grid area as the page content container, with an opaque
// background and z-10 — two items in one grid area overlap, so it covers the whole article.
// The header links in layout.shared.tsx are what actually make these sections visible.

/** Section roots that own their own tab. Everything else belongs to Documentation. */
const SECTION_PREFIXES = ['/workflows', '/cli', '/reference'];

const inSection = (url: string, prefix: string) =>
  url === prefix || url.startsWith(`${prefix}/`);

const allUrls = source.getPages().map((page) => page.url);
const urlsUnder = (prefix: string) =>
  new Set(allUrls.filter((url) => inSection(url, prefix)));

// Each tab carries the full set of URLs it owns. A `LayoutTab` resolves membership from
// `$folder` or `urls`; given neither, Fumadocs can only compare against the tab's own `url`,
// so every page outside `/introduction`, `/workflows`, `/cli` and `/reference/agents` matched
// no tab — and the sidebar dropdown renders only while some tab is active, so it vanished on
// most of the site. Deriving the sets from `source` keeps them correct as pages are added.
const tabs = [
  {
    title: 'Documentation',
    url: '/introduction',
    // The root tree is the complement: whatever no section tab claims.
    urls: new Set(
      allUrls.filter((url) => !SECTION_PREFIXES.some((p) => inSection(url, p))),
    ),
  },
  { title: 'Workflows', url: '/workflows', urls: urlsUnder('/workflows') },
  { title: 'CLI', url: '/cli', urls: urlsUnder('/cli') },
  // Tab points at /reference/agents because /reference itself has no index page,
  // but the tab owns every /reference/* URL.
  { title: 'Reference', url: '/reference/agents', urls: urlsUnder('/reference') },
];

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <DocsLayout tree={source.getPageTree()} tabs={tabs} {...baseOptions()}>
      {children}
    </DocsLayout>
  );
}
