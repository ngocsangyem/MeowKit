import {
  DocsBody,
  DocsDescription,
  DocsPage,
  DocsTitle,
  ViewOptionsPopover,
} from 'fumadocs-ui/layouts/docs/page';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { createRelativeLink } from 'fumadocs-ui/mdx';
import { source } from '@/lib/source';
import { getMDXComponents } from '@/components/mdx';
import { BreadcrumbJsonLd } from '@/components/json-ld';

interface PageParams {
  params: Promise<{ slug: string[] }>;
}

export default async function Page(props: PageParams) {
  const params = await props.params;
  const page = source.getPage(params.slug);
  if (!page) notFound();

  const MDX = page.data.body;

  return (
    <DocsPage toc={page.data.toc} full={page.data.full}>
      <BreadcrumbJsonLd slug={params.slug} />
      <DocsTitle>{page.data.title}</DocsTitle>
      <DocsDescription>{page.data.description}</DocsDescription>
      <div className="flex flex-row items-center gap-2 border-b border-fd-border pb-4">
        <ViewOptionsPopover markdownUrl={`${page.url}.md`} />
      </div>
      <DocsBody>
        <MDX components={getMDXComponents({ a: createRelativeLink(source, page) })} />
      </DocsBody>
    </DocsPage>
  );
}

export function generateStaticParams() {
  // The root route ('/') is owned by app/(home); exclude the empty slug.
  return source
    .generateParams()
    .filter((param) => param.slug.length > 0);
}

export async function generateMetadata(props: PageParams): Promise<Metadata> {
  const params = await props.params;
  const page = source.getPage(params.slug);
  if (!page) notFound();

  const description = page.data.description ?? undefined;
  return {
    title: page.data.title,
    description,
    alternates: { canonical: page.url },
    openGraph: {
      type: 'article',
      url: page.url,
      title: page.data.title,
      description,
    },
    twitter: {
      card: 'summary_large_image',
      title: page.data.title,
      description,
    },
  };
}
