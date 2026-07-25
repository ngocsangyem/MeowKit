import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';

// Shared layout options for HomeLayout and DocsLayout.
// The Guide/CLI/Reference/Workflows tabs are driven by root:true meta.json
// folders (rendered as sidebar tabs). These links reproduce the VitePress
// top-nav standalone items and the Resources dropdown.
export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: 'MeowKit',
    },
    githubUrl: 'https://github.com/ngocsangyem/MeowKit',
    links: [
      // The three root:true trees (Workflows, CLI, Reference) are reachable ONLY from here.
      // Fumadocs' sidebar tabs cannot carry them: the auto dropdown hides them behind a closed
      // control, and tabMode="top" overlaps the article. check-nav-coverage.mjs asserts every
      // root tree still has a link in this list.
      { text: 'Workflows', url: '/workflows' },
      { text: 'CLI', url: '/cli' },
      { text: 'Reference', url: '/reference/agents' },
      { text: 'Cheatsheet', url: '/cheatsheet' },
      {
        type: 'menu',
        text: 'Resources',
        items: [
          { text: 'Changelog', url: '/changelog' },
          { text: 'Migration: TDD optional', url: '/migration/tdd-optional' },
          {
            text: 'GitHub Releases',
            url: 'https://github.com/ngocsangyem/MeowKit/releases',
            external: true,
          },
          {
            text: 'npm: mewkit',
            url: 'https://www.npmjs.com/package/mewkit',
            external: true,
          },
        ],
      },
    ],
  };
}
