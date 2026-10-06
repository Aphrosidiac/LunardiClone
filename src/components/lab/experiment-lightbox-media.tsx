'use client';

// Module 423393. The media shown in an experiment's lightbox: the item whose `_key` is in the URL
// hash (the canvas links to `/lab/<slug>#<key>`), else the first one.
import type { MediaItem } from '@/content/types';
import { Image } from '@/components/media/image';
import { MediaVideo } from '@/components/media/media-video';
import { LIGHTBOX_VIDEO_QUALITY } from '@/components/media/tiers';
import { useHashKey } from '@/lib/hash-key';
import { run } from '@/lib/utils';

export function ExperimentLightboxMedia({ media }: { media: MediaItem[] }) {
  const hashKey = useHashKey();
  const item = media.find((m) => m._key === hashKey) ?? media[0];
  if (!item) return null;
  return run(() =>
    item._type === 'video' ? (
      <MediaVideo
        key={item._key}
        video={item}
        quality={LIGHTBOX_VIDEO_QUALITY}
        playsInline
        inViewPlayback={{ enabled: true }}
        className="h-full w-full object-contain"
      />
    ) : item._type === 'image' ? (
      <Image key={item._key} image={item.image} className="max-h-full max-w-full object-contain" />
    ) : null,
  );
}
