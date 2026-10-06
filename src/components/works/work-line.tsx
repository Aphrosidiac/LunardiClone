'use client';

// Module 451201. An EntryLine for a work. Active (and linking back to /works) while its detail
// is open. On lg+ hovering the row loads the work's preview media once and, 100ms later, shows
// it cycling every 500ms in the dither slot (`#portal`) beside the list.
//
// The reference fetches `/api/works/<id>/preview`; a static export has no API, so the preview is
// read from the works content module, loaded lazily on first hover just like the fetch was.
import { usePathname } from 'next/navigation';
import { Activity, Fragment, memo, useEffect, useRef, useState } from 'react';
import type { MediaItem, Work } from '@/content/types';
import { EntryLine, type EntryLineProps } from '@/components/lines/entry-line';
import { Image } from '@/components/media/image';
import { MediaVideo } from '@/components/media/media-video';
import { Portal } from '@/components/portal';
import { useBreakpoint } from '@/hooks/use-breakpoint';
import { run } from '@/lib/utils';

const PreviewCycle = memo(function PreviewCycle({ media }: { media: MediaItem[] }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!media.length) return;
    const interval = window.setInterval(() => {
      setIndex((current) => (current + 1) % media.length);
    }, 500);
    return () => {
      window.clearInterval(interval);
    };
  }, [media.length]);

  if (!media.length) return null;

  return media.map((item, i) => (
    <Fragment key={item._key}>
      {run(() =>
        item._type === 'video' ? (
          <MediaVideo
            video={item}
            quality="720"
            playsInline
            inViewPlayback={{ enabled: true }}
            className="absolute size-[33%]"
            style={{ opacity: +(i === index) }}
          />
        ) : item._type === 'image' ? (
          <Image
            image={item.image}
            sizes="50vw"
            noPlaceholder
            className="absolute size-[33%] object-contain"
            style={{ opacity: +(i === index) }}
          />
        ) : undefined,
      )}
    </Fragment>
  ));
});

async function loadPreview(id: string): Promise<MediaItem[]> {
  const { WORKS } = await import('@/content/works');
  return WORKS.find((work) => work._id === id)?.media ?? [];
}

export type WorkLineProps = Omit<EntryLineProps, 'title' | 'href' | 'active'> & {
  work: Pick<Work, '_id' | 'href' | 'title'>;
};

export function WorkLine({ work, className, ...props }: WorkLineProps) {
  const pathname = usePathname();
  const isDesktop = useBreakpoint('lg');
  const active = pathname === work.href;
  const href = active ? '/works' : work.href;
  const [visible, setVisible] = useState(false);
  const [media, setMedia] = useState<MediaItem[] | null>(null);
  const timeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const request = useRef<Promise<void> | null>(null);

  const handleMouseEnter = () => {
    if (!request.current) {
      request.current = loadPreview(work._id)
        .then(setMedia)
        .catch(() => {
          request.current = null;
        });
    }
    if (timeout.current) clearTimeout(timeout.current);
    timeout.current = setTimeout(() => {
      setVisible(true);
    }, 100);
  };

  const handleMouseLeave = () => {
    if (timeout.current) clearTimeout(timeout.current);
    setVisible(false);
  };

  useEffect(
    () => () => {
      if (timeout.current) clearTimeout(timeout.current);
    },
    [],
  );

  return (
    <>
      <EntryLine
        title={work.title ?? ''}
        href={href}
        active={active}
        className={className}
        onMouseEnter={isDesktop ? handleMouseEnter : undefined}
        onMouseLeave={isDesktop ? handleMouseLeave : undefined}
        {...props}
      />
      {isDesktop && media && (
        <Portal targetId="portal">
          <Activity mode={visible ? 'visible' : 'hidden'}>
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <PreviewCycle media={media} />
            </div>
          </Activity>
        </Portal>
      )}
    </>
  );
}
