import type { MetadataRoute } from 'next';
import { getPublishedPages } from '@/lib/get-published-pages';
import { siteUrl } from '@/lib/site';

export const revalidate = false;

export default function sitemap(): MetadataRoute.Sitemap {
  return getPublishedPages().map((page) => ({
    url: new URL(page.url, siteUrl).toString(),
    changeFrequency: 'weekly',
    priority: page.url === '/' ? 1 : 0.7,
  }));
}
