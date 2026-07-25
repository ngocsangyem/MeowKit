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
const tabs = [
  { title: 'Documentation', url: '/introduction' },
  { title: 'Workflows', url: '/workflows' },
  { title: 'CLI', url: '/cli' },
  { title: 'Reference', url: '/reference/agents' },
];

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <DocsLayout tree={source.getPageTree()} tabs={tabs} {...baseOptions()}>
      {children}
    </DocsLayout>
  );
}
