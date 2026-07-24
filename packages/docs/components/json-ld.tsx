import { siteUrl, siteName, siteDescription } from '@/lib/site';

// SoftwareApplication structured data for the site (rendered site-wide).
export function SoftwareApplicationJsonLd() {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: siteName,
    description: siteDescription,
    applicationCategory: 'DeveloperApplication',
    operatingSystem: 'macOS, Linux, Windows',
    url: siteUrl,
    author: {
      '@type': 'Person',
      name: 'ngocsangyem',
      url: 'https://github.com/ngocsangyem',
    },
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    license: 'https://opensource.org/licenses/MIT',
  };
  return (
    <script
      type="application/ld+json"
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

// BreadcrumbList for nested pages (depth > 1).
export function BreadcrumbJsonLd({ slug }: { slug: string[] }) {
  if (slug.length < 2) return null;
  const data = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: slug.map((part, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: part.replace(/-/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()),
      item: new URL(`/${slug.slice(0, i + 1).join('/')}`, siteUrl).toString(),
    })),
  };
  return (
    <script
      type="application/ld+json"
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
