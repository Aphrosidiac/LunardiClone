// The 3D shot viewer. The canvas behind it is rendered by `../layout.tsx`.
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ImageModelViewer } from '@/components/shots/image-viewer-preloader';
import { viewerSrc } from '@/components/shots/viewer-src';
import { ModalLightbox } from '@/components/window/modal-lightbox';
import { SHOTS } from '@/content/shots';
import { SITE } from '@/content/site';

type Props = { params: Promise<{ id: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return SHOTS.map((shot) => ({ id: shot._id }));
}

function find(id: string) {
  return SHOTS.find((shot) => shot._id === id);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const shot = find((await params).id);
  if (!shot) return {};
  const title = `${shot.title} | ${SITE.name}`;
  const url = `${SITE.url}/shots/${shot._id}`;
  const image = { url: `${SITE.url}${shot.image.src}`, width: shot.image.width, height: shot.image.height, alt: shot.image.alt };
  return {
    title: { absolute: title },
    description: SITE.description,
    alternates: { canonical: url },
    openGraph: { title, description: SITE.description, url, siteName: SITE.name, type: 'website', images: [image] },
    twitter: { card: 'summary_large_image', title, description: SITE.description, images: [image.url] },
  };
}

export default async function ShotPage({ params }: Props) {
  const shot = find((await params).id);
  if (!shot) notFound();

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CreativeWork',
    name: shot.title,
    dateCreated: shot.date,
    author: [{ '@id': `${SITE.url}/#org` }],
    url: `${SITE.url}/shots/${shot._id}`,
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <ModalLightbox title={shot.title} closeHref="/shots" contentClickable>
        <ImageModelViewer src={viewerSrc(shot.image)} aspectRatio={shot.image.width / shot.image.height} />
      </ModalLightbox>
    </>
  );
}
