import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createMDX } from 'fumadocs-mdx/next';

// Retired URLs live in redirects.json as reviewable data rather than inline here, so adding one
// is a one-line diff a reviewer can read without parsing Next config. `permanent: true` emits a
// 308, which keeps the request method and preserves search ranking for inbound links.
const { redirects } = JSON.parse(
  readFileSync(fileURLToPath(new URL('./redirects.json', import.meta.url)), 'utf-8'),
);

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  async redirects() {
    return redirects.map(({ from, to }) => ({ source: from, destination: to, permanent: true }));
  },
  async rewrites() {
    // Any doc URL + `.md` serves its raw Markdown from the per-page llms route.
    return [
      {
        source: '/:path*.md',
        destination: '/llms.mdx/:path*',
      },
    ];
  },
};

const withMDX = createMDX();

export default withMDX(config);
