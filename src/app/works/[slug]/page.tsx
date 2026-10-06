// The reference's `(template)` route: list window (hidden below lg) beside the work window, each
// behind its own Suspense skeleton.
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { WorkList, WorkListSkeleton } from '@/components/works/work-list';
import { WorkWindow, WorkWindowSkeleton } from '@/components/works/work-window';
import { SITE } from '@/content/site';
import { WORKS } from '@/content/works';

type Params = { slug: string };

export const dynamicParams = false;

export function generateStaticParams(): Params[] {
  return WORKS.map((work) => ({ slug: work.slug }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await params;
  const work = WORKS.find((entry) => entry.slug === slug);
  if (!work) return {};
  const title = `${work.title} | ${SITE.name}`;
  return {
    title: { absolute: title },
    description: work.description,
    alternates: { canonical: work.href },
    openGraph: { title, description: work.description, url: work.href, type: 'website' },
    twitter: { card: 'summary_large_image', title, description: work.description },
  };
}

export default async function WorkPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const work = WORKS.find((entry) => entry.slug === slug);
  if (!work) notFound();

  const webPage = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage',
        '@id': `${SITE.url}${work.href}#webpage`,
        url: `${SITE.url}${work.href}`,
        name: work.title,
        description: work.description,
        isPartOf: { '@id': `${SITE.url}/#website` },
        inLanguage: 'en',
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE.url}/` },
          { '@type': 'ListItem', position: 2, name: 'Works', item: `${SITE.url}/works` },
          { '@type': 'ListItem', position: 3, name: work.title, item: `${SITE.url}${work.href}` },
        ],
      },
    ],
  };
  const creativeWork = {
    '@context': 'https://schema.org',
    '@type': 'CreativeWork',
    name: work.title,
    dateCreated: String(work.year),
    description: work.description,
    url: `${SITE.url}${work.href}`,
    creator: { '@id': `${SITE.url}/#org` },
    ...(work.link ? { sameAs: work.link.href } : {}),
  };

  return (
    <div className="grid size-full flex-1 auto-rows-fr grid-cols-12 gap-16">
      <Suspense fallback={<WorkListSkeleton detail />}>
        <WorkList detail />
      </Suspense>
      <Suspense fallback={<WorkWindowSkeleton />}>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(webPage) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(creativeWork) }} />
        <WorkWindow work={work} />
      </Suspense>
    </div>
  );
}
