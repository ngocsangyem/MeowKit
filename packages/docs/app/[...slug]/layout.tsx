import { DocsLayout } from 'fumadocs-ui/layouts/docs';
import type { ReactNode } from 'react';
import { source } from '@/lib/source';
import { baseOptions } from '@/lib/layout.shared';

// Docs layout lives at app/[...slug] (not app/docs) so every page keeps its
// VitePress-era URL with no /docs prefix. `tabs={{}}` auto-generates sidebar
// tabs from the root:true meta.json folders (CLI, Reference, Workflows) plus
// the default root (Guide); auto-tabs bind each tab to its tree folder so the
// sidebar scopes per active tab.
export default function Layout({ children }: { children: ReactNode }) {
  // tabs default to getLayoutTabs(tree): the root:true meta.json folders
  // (CLI, Reference, Workflows) auto-generate $folder-bound sidebar tabs that
  // scope the sidebar to the active section; the default root is the Guide tab.
  return (
    <DocsLayout tree={source.getPageTree()} {...baseOptions()}>
      {children}
    </DocsLayout>
  );
}
