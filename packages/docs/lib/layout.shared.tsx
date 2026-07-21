import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';

// Shared layout options for HomeLayout and DocsLayout.
// Full nav parity (tabs, links) lands with the navigation phase.
export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: 'MeowKit',
    },
    githubUrl: 'https://github.com/ngocsangyem/meowkit',
  };
}
