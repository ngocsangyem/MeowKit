import type { MetadataRoute } from 'next';
import { siteUrl } from '@/lib/site';

export const revalidate = false;

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/' },
    sitemap: new URL('/sitemap.xml', siteUrl).toString(),
  };
}
