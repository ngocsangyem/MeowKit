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
// `tabMode="top"` renders them as real links across the top. The default, "auto", renders a
// dropdown whose items only exist once it is opened — which is how three whole sections can be
// present in the config and still not be findable by someone looking at the page.
const tabs = [
  { title: 'Documentation', url: '/introduction' },
  { title: 'Workflows', url: '/workflows' },
  { title: 'CLI', url: '/cli' },
  { title: 'Reference', url: '/reference/agents' },
];

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <DocsLayout tree={source.getPageTree()} tabs={tabs} tabMode="top" {...baseOptions()}>
      {children}
    </DocsLayout>
  );
}
