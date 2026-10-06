// Home: the desktop. Server composition from docs/reference/2026-10-06/jsx/home.jsx — every window's
// content is rendered here on the server and handed to the QuickActions client component.
import { Suspense } from 'react';
import type { Metadata } from 'next';
import { DitherSlot } from '@/components/dither/dither-provider';
import { EmailCaptureContent } from '@/components/email-capture';
import { AboutFolder } from '@/components/home/about-folder';
import { Marquee } from '@/components/home/marquee';
import { QuickActionLink } from '@/components/home/quick-action-link';
import { QuickActions } from '@/components/home/quick-actions';
import { ShowreelPlayer } from '@/components/home/showreel-player';
import { LineSkeleton, Skeleton } from '@/components/line-skeleton';
import { ArticleLine } from '@/components/lines/article-line';
import { Image } from '@/components/media/image';
import { Video } from '@/components/media/video';
import {
  ABOUT,
  ABOUT_DATE,
  ABOUT_FILES,
  ABOUT_STRIP,
  BUILD_NOTES,
  BUILD_NOTES_AUDIENCE_IDS,
  BUILD_NOTES_CTA,
  BUILD_NOTES_LEGAL,
  FEATURED_ARTICLE,
  FEATURED_EXPERIMENT,
  HOME_H1,
  SHOWREEL,
  WORK_GALLERY,
  type GalleryItem,
} from '@/content/home';
import { SITE } from '@/content/site';
import type { Img } from '@/content/types';

export const metadata: Metadata = {
  title: { absolute: SITE.title },
  description: SITE.description,
  alternates: { canonical: SITE.url },
  openGraph: { title: SITE.title, description: SITE.description, url: SITE.url, siteName: SITE.name, type: 'website' },
  twitter: { card: 'summary_large_image', title: SITE.title, description: SITE.description },
};

const WEB_PAGE_LD = {
  '@type': 'WebPage',
  '@id': `${SITE.url}/#webpage`,
  url: SITE.url,
  name: HOME_H1,
  isPartOf: { '@id': `${SITE.url}/#website` },
  about: { '@id': `${SITE.url}/#org` },
  inLanguage: 'en',
};

// TODO(lead): `GalleryItem` needs `image?: Img` — the reference work gallery mixes stills
// (SanityImage, height 60) in with the looping clips.
function galleryImage(item: GalleryItem): Img | undefined {
  return (item as GalleryItem & { image?: Img }).image;
}

const marqueeLoader = <div className="h-60 w-full animate-pulse bg-theme-fg/10" />;

function GalleryMedia({ item }: { item: GalleryItem }) {
  const image = galleryImage(item);
  if (image) return <Image image={image} height={60} className="h-60 w-auto" />;
  return (
    <Video
      sources={item.sources}
      poster={item.poster}
      style={{ aspectRatio: item.width / item.height }}
      autoPlay
      muted
      loop
      controls={false}
      className="h-60 w-auto"
      playsInline
      inViewPlayback={{ enabled: true }}
    />
  );
}

export default function HomePage() {
  const workGallery = (
    <Suspense fallback={marqueeLoader}>
      <Marquee pauseOnHover loader={marqueeLoader}>
        {WORK_GALLERY.map((item, index) => (
          <QuickActionLink
            key={`${item.href}-${index}`}
            href={item.href}
            panel="work_gallery"
            prefetchOnIntent
            eventTitle={item.title}
            className="mx-1 block"
            aria-label={item.title}
          >
            <GalleryMedia item={item} />
          </QuickActionLink>
        ))}
      </Marquee>
    </Suspense>
  );

  const about = (
    <Suspense
      fallback={
        <div>
          <div className="flex flex-col">
            <LineSkeleton style={{ width: '100%' }} />
            <LineSkeleton style={{ width: '98%' }} />
            <LineSkeleton style={{ width: '94%' }} />
            <LineSkeleton style={{ width: '62%' }} />
          </div>
          <Skeleton className="mt-[1em] h-60 w-full" />
        </div>
      }
    >
      <div>
        {ABOUT}
        <AboutFolder date={ABOUT_DATE} files={ABOUT_FILES} />
        <div className="mt-[1em]">
          <Marquee loader={marqueeLoader}>
            {ABOUT_STRIP.map((image, index) => (
              <div key={`${image.src}-${index}`} className="mx-1">
                <Image image={image} height={60} className="h-60 w-auto" />
              </div>
            ))}
          </Marquee>
        </div>
      </div>
    </Suspense>
  );

  const featuredArticle = (
    <Suspense
      fallback={
        <div className="w-full border-theme-fg/30 py-4 border-b-0">
          <div className="flex items-center gap-4">
            <Skeleton className="size-[1em] shrink-0" />
            <LineSkeleton style={{ width: '45%' }} />
          </div>
          <div className="flex flex-col mt-4 ml-[calc(1em+--spacing(4))]">
            <LineSkeleton style={{ width: '100%' }} />
            <LineSkeleton style={{ width: '92%' }} />
            <LineSkeleton style={{ width: '56%' }} />
          </div>
        </div>
      }
    >
      {FEATURED_ARTICLE ? (
        <ArticleLine
          article={{
            _id: FEATURED_ARTICLE._id,
            excerpt: FEATURED_ARTICLE.excerpt,
            href: FEATURED_ARTICLE.href,
            title: FEATURED_ARTICLE.title,
          }}
          showExcerpt
          className="border-b-0"
          trackClick={{ panel: 'featured_article' }}
        />
      ) : null}
    </Suspense>
  );

  const featuredExperiment = (
    <Suspense fallback={<Skeleton className="h-60 w-full" />}>
      <Marquee loader={marqueeLoader} pauseOnHover>
        {FEATURED_EXPERIMENT.map((item, index) => (
          <QuickActionLink
            key={`${item.href}-${index}`}
            href={item.href}
            panel="featured_experiment"
            eventTitle={item.title}
            aria-label={item.title}
            className="mx-1 block"
          >
            <GalleryMedia item={item} />
          </QuickActionLink>
        ))}
      </Marquee>
    </Suspense>
  );

  const showReel = (
    <Suspense fallback={<div className="aspect-video w-full animate-pulse bg-theme-fg/10" />}>
      <ShowreelPlayer
        src={SHOWREEL.src}
        poster={SHOWREEL.poster || undefined}
        aspectRatio={SHOWREEL.width / SHOWREEL.height}
        autoPlay
        className="w-full"
        ariaLabel="Show reel"
      />
    </Suspense>
  );

  const emailCapture = (
    <Suspense fallback={null}>
      <EmailCaptureContent
        text={BUILD_NOTES}
        ctaText={BUILD_NOTES_CTA}
        audienceIds={BUILD_NOTES_AUDIENCE_IDS}
        legalText={BUILD_NOTES_LEGAL}
      />
    </Suspense>
  );

  return (
    <div className="relative isolate flex size-full flex-col justify-between overflow-hidden p-4 ring-1 ring-theme-fg/30">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(WEB_PAGE_LD) }} />
      <h1 className="sr-only">{HOME_H1}</h1>
      <QuickActions
        workGallery={workGallery}
        about={about}
        featuredArticle={featuredArticle}
        featuredExperiment={featuredExperiment}
        showReel={showReel}
        emailCapture={emailCapture}
      />
      <DitherSlot className="absolute inset-0 z-behind" />
    </div>
  );
}
