import type { Metadata } from 'next';
import { EXPERIMENTS, LAB_BLURB } from '@/content/lab';
import { SITE } from '@/content/site';

const TITLE = `Lab: WebGL, Canvas & Motion Experiments | ${SITE.name}`;
const URL = `${SITE.url}/lab`;

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: LAB_BLURB,
  alternates: { canonical: URL },
  openGraph: { title: TITLE, description: LAB_BLURB, url: URL, siteName: SITE.name, type: 'website' },
  twitter: { card: 'summary_large_image', title: TITLE, description: LAB_BLURB },
};

const JSON_LD = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'CollectionPage',
      '@id': `${URL}#webpage`,
      name: `${SITE.name} Lab`,
      description: LAB_BLURB,
      url: URL,
      inLanguage: 'en',
      isPartOf: { '@id': `${SITE.url}/#website` },
      mainEntityOfPage: `${URL}#webpage`,
      publisher: { '@id': `${SITE.url}/#org` },
      hasPart: EXPERIMENTS.map((experiment) => ({
        '@type': 'CreativeWork',
        name: experiment.title,
        url: `${SITE.url}/lab/${experiment.slug}`,
        dateCreated: String(experiment.year),
        author: { '@id': `${SITE.url}/#org` },
      })),
    },
    {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: SITE.url },
        { '@type': 'ListItem', position: 2, name: 'Lab', item: URL },
      ],
    },
  ],
};

export default function LabPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }} />
      <h1 className="sr-only">Lab</h1>
    </>
  );
}
