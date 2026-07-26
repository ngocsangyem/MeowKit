import { source } from '@/lib/source';
import redirectsData from '@/redirects.json';

// A retired page's MDX file stays on disk after its redirect lands — the content is kept so a
// merge can be diffed and reverted — but the URL no longer serves it. Anything that publishes a
// list of pages (llms.txt, llms-full.txt, sitemap.xml) must therefore skip it, or it advertises
// URLs that answer with a 308.
//
// The exclusion is derived from redirects.json rather than from a per-page frontmatter flag so
// that retiring a page is one edit, not two. A flag set without a redirect entry orphans the
// page; a redirect entry without the flag leaves it in the sitemap. Deriving both from the same
// file makes each state unreachable.
const redirects: Array<{ from: string; to: string }> = redirectsData.redirects;
const retired = new Set(redirects.map((entry) => entry.from));

export function getPublishedPages(): ReturnType<typeof source.getPages> {
  return source.getPages().filter((page) => !retired.has(page.url));
}
