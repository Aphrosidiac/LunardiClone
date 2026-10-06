import type { Metadata } from 'next';
import { SHOTS, SHOTS_BLURB } from '@/content/shots';
import { SITE } from '@/content/site';

const TITLE = `Shots | ${SITE.name}`;
const URL = `${SITE.url}/shots`;

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: SHOTS_BLURB,
  alternates: { canonical: URL },
  openGraph: { title: TITLE, description: SHOTS_BLURB, url: URL, siteName: SITE.name, type: 'website' },
  twitter: { card: 'summary_large_image', title: TITLE, description: SHOTS_BLURB },
};

const JSON_LD = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'CollectionPage',
      '@id': `${URL}#webpage`,
      name: `${SITE.name} Shots`,
      description: SHOTS_BLURB,
      url: URL,
      inLanguage: 'en',
      isPartOf: { '@id': `${SITE.url}/#website` },
      mainEntityOfPage: `${URL}#webpage`,
      publisher: { '@id': `${SITE.url}/#org` },
      hasPart: SHOTS.map((shot) => ({
        '@type': 'CreativeWork',
        name: shot.title,
        url: `${SITE.url}/shots/${shot._id}`,
        dateCreated: shot.date,
        author: { '@id': `${SITE.url}/#org` },
      })),
    },
    {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: SITE.url },
        { '@type': 'ListItem', position: 2, name: 'Shots', item: URL },
      ],
    },
  ],
};

// The visible h1 is in the info window (../layout.tsx), as on the reference.
export default function ShotsPage() {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }} />;
}
