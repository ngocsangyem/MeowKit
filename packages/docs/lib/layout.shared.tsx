import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';

// The nav mark is the brand lockup from `assets/branding/meow-logo{,-dark}.svg`, copied
// into `public/` under the names the site already linked. Two files rather than one
// recoloured by CSS: the masters are the source of truth for the mark, and inlining their
// path data here would fork it. Both ship in the markup and CSS hides one, so the swap
// happens with the theme class and never lags a frame behind the toggle.
//
// Plain <img>, not next/image: an SVG served from `public/` needs no resizing, and
// next/image would only pass it through behind `dangerouslyAllowSVG`.
function NavTitle() {
  return (
    <>
      <img
        src="/logo.svg"
        alt="MeowKit"
        className="h-5 w-auto dark:hidden"
        width={101}
        height={20}
      />
      <img
        src="/logo-dark.svg"
        alt=""
        aria-hidden
        className="hidden h-5 w-auto dark:block"
        width={101}
        height={20}
      />
    </>
  );
}

// Shared layout options for HomeLayout and DocsLayout.
// The Guide/CLI/Reference/Workflows tabs are driven by root:true meta.json
// folders (rendered as sidebar tabs). These links reproduce the VitePress
// top-nav standalone items and the Resources dropdown.
export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: <NavTitle />,
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
