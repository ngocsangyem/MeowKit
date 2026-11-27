import type { MetadataRoute } from 'next';
import { siteUrl } from '@/lib/site';

export const revalidate = false;

// The beta docs (built from develop with NEXT_PUBLIC_DOCS_CHANNEL=beta) describe unreleased
// behavior, so search engines index only the stable site.
const isBeta = process.env.NEXT_PUBLIC_DOCS_CHANNEL === 'beta';

export default function robots(): MetadataRoute.Robots {
  if (isBeta) return { rules: { userAgent: '*', disallow: '/' } };
  return {
    rules: { userAgent: '*', allow: '/' },
    sitemap: new URL('/sitemap.xml', siteUrl).toString(),
  };
}
