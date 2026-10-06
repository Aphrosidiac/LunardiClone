// The experiment lightbox. The canvas behind it is rendered by `../layout.tsx`.
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ExperimentLightboxMedia } from '@/components/lab/experiment-lightbox-media';
import { ModalLightbox } from '@/components/window/modal-lightbox';
import { EXPERIMENTS } from '@/content/lab';
import { SITE } from '@/content/site';

type Props = { params: Promise<{ slug: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return EXPERIMENTS.map((experiment) => ({ slug: experiment.slug }));
}

function find(slug: string) {
  return EXPERIMENTS.find((experiment) => experiment.slug === slug);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const experiment = find((await params).slug);
  if (!experiment) return {};
  const title = `${experiment.title} | ${SITE.name}`;
  const url = `${SITE.url}/lab/${experiment.slug}`;
  return {
    title: { absolute: title },
    description: SITE.description,
    robots: { index: false, follow: true },
    alternates: { canonical: url },
    openGraph: { title, description: SITE.description, url, siteName: SITE.name, type: 'website' },
    twitter: { card: 'summary_large_image', title, description: SITE.description },
  };
}

export default async function ExperimentPage({ params }: Props) {
  const experiment = find((await params).slug);
  if (!experiment) notFound();

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CreativeWork',
    name: experiment.title,
    dateCreated: String(experiment.year),
    author: [{ '@id': `${SITE.url}/#org` }],
    url: `${SITE.url}/lab/${experiment.slug}`,
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <ModalLightbox title={experiment.title} closeHref="/lab" meta={`[${experiment.year}]`}>
        <ExperimentLightboxMedia media={experiment.media} />
      </ModalLightbox>
    </>
  );
}
