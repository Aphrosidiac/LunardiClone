import type { Metadata } from 'next';
import { Suspense } from 'react';
import { WorkList, WorkListSkeleton } from '@/components/works/work-list';
import { SITE } from '@/content/site';
import { WORKS, WORKS_BLURB } from '@/content/works';

const TITLE = `Works | ${SITE.name}`;

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: WORKS_BLURB,
  alternates: { canonical: '/works' },
  openGraph: { title: TITLE, description: WORKS_BLURB, url: '/works', type: 'website' },
  twitter: { card: 'summary_large_image', title: TITLE, description: WORKS_BLURB },
};

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'CollectionPage',
      '@id': `${SITE.url}/works#webpage`,
      url: `${SITE.url}/works`,
      name: TITLE,
      description: WORKS_BLURB,
      isPartOf: { '@id': `${SITE.url}/#website` },
      inLanguage: 'en',
      mainEntity: {
        '@type': 'ItemList',
        itemListElement: WORKS.map((work, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          url: `${SITE.url}${work.href}`,
          name: work.title,
        })),
      },
    },
  ],
};

export default function WorksPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <h1 className="sr-only">Works</h1>
      <Suspense fallback={<WorkListSkeleton />}>
        <WorkList />
      </Suspense>
    </>
  );
}
