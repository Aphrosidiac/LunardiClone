'use client';

// Module 892759. The media grid's lightbox, driven by the URL hash: `#<media _key>` opens that
// item. Arrow keys step through the media (wrapping) by replacing the hash. Closing goes back in
// history when the hash was pushed by a grid link, otherwise it just clears the hash.
import { useRef } from 'react';
import type { MediaItem } from '@/content/types';
import { Image } from '@/components/media/image';
import { MediaVideo } from '@/components/media/media-video';
import { LIGHTBOX_VIDEO_QUALITY } from '@/components/media/tiers';
import { Lightbox } from '@/components/window/lightbox';
import { useWindowEvent } from '@/hooks/use-window-event';
import { readHashKey, replaceHashKey, useHashKey } from '@/lib/hash-key';
import { run } from '@/lib/utils';

export function WorkMediaLightbox({ title, media }: { title: string; media?: MediaItem[] | null }) {
  const hashKey = useHashKey();
  const items = media ?? [];
  const index = items.findIndex((item) => item?._key === hashKey);
  const current = index === -1 ? null : items[index];
  const pushedByLink = useRef(false);

  useWindowEvent('hashchange', () => {
    pushedByLink.current = readHashKey() !== null;
  });

  const handleClose = () => {
    if (pushedByLink.current) {
      pushedByLink.current = false;
      window.history.back();
      return;
    }
    replaceHashKey(null);
  };

  const step = (direction: number) => {
    if (index === -1 || items.length < 2) return;
    const next = items[(index + direction + items.length) % items.length];
    if (next) replaceHashKey(next._key);
  };

  useWindowEvent('keydown', (event) => {
    if (!current) return;
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      step(1);
      return;
    }
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      step(-1);
    }
  });

  return (
    <Lightbox open={!!current} onClose={handleClose} title={title} className="size-full">
      {run(() =>
        current?._type === 'video' ? (
          <MediaVideo
            key={current._key}
            video={current}
            quality={LIGHTBOX_VIDEO_QUALITY}
            inViewPlayback={{ enabled: true }}
            playsInline
            className="size-full min-h-0 object-contain"
          />
        ) : current?._type === 'image' ? (
          <Image tabIndex={-1} image={current.image} className="size-full min-h-0 object-contain" />
        ) : undefined,
      )}
    </Lightbox>
  );
}
