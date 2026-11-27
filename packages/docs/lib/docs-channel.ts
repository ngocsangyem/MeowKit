// Which release channel this build of the docs describes, and where the other one lives.
//
// The site is built twice from one source: from `main` as the stable channel
// (docs.meowkit.dev) and from `develop` as the beta channel (beta.docs.meowkit.dev).
// .github/workflows/docs-deploy.yml sets these at build time from the release tags
// (`scripts/release/next-version.cjs channels`). A local build with none set is the
// stable channel with no version numbers, which is what `next dev` should show.

export type DocsChannel = 'stable' | 'beta';

export interface ChannelInfo {
  id: DocsChannel;
  label: string;
  /** Newest published version on this channel; empty when unknown (local builds). */
  version: string;
  /** Origin of the site that serves this channel, no trailing slash. */
  origin: string;
}

const trimSlash = (url: string) => url.replace(/\/+$/, '');

export const currentChannel: DocsChannel =
  process.env.NEXT_PUBLIC_DOCS_CHANNEL === 'beta' ? 'beta' : 'stable';

export const channels: Record<DocsChannel, ChannelInfo> = {
  stable: {
    id: 'stable',
    label: 'Stable',
    version: process.env.NEXT_PUBLIC_STABLE_VERSION ?? '',
    origin: trimSlash(process.env.NEXT_PUBLIC_STABLE_DOCS_URL ?? 'https://docs.meowkit.dev'),
  },
  beta: {
    id: 'beta',
    label: 'Beta',
    // Set only while a beta is ahead of the stable release; empty means "no beta to offer".
    version: process.env.NEXT_PUBLIC_BETA_VERSION ?? '',
    origin: trimSlash(process.env.NEXT_PUBLIC_BETA_DOCS_URL ?? 'https://beta.docs.meowkit.dev'),
  },
};

/** The same page on another channel's site. */
export function channelHref(target: DocsChannel, pathname: string): string {
  return `${channels[target].origin}${pathname.startsWith('/') ? pathname : `/${pathname}`}`;
}
