'use client';

// Module 87059. Wraps a rich-text media block: when the block is flagged `isLightbox`, its
// rendering becomes a zoom-in button that opens the media full size in a Lightbox.
import { useState, type ReactNode } from 'react';
import type { Img, MediaItem } from '@/content/types';
import { Image } from '@/components/media/image';
import { MediaVideo, type MediaVideoSource } from '@/components/media/media-video';
import { LIGHTBOX_VIDEO_QUALITY } from '@/components/media/tiers';
import { Lightbox } from './lightbox';

/**
 * The reference block shape (`{ isLightbox, type, image, video }`), or one of our `MediaItem`s
 * with an `isLightbox` flag.
 */
export type MediaLightboxValue =
  | {
      isLightbox?: boolean | null;
      type?: 'image' | 'video' | null;
      image?: Img | null;
      video?: MediaVideoSource | null;
    }
  | (MediaItem & { isLightbox?: boolean | null });

function LightboxMedia({ value }: { value: MediaLightboxValue }) {
  if ('_type' in value && (value._type === 'image' || value._type === 'video')) {
    if (value._type === 'image') return <Image image={value.image} className="size-full min-h-0 object-contain" />;
    return <MediaVideo video={value} quality={LIGHTBOX_VIDEO_QUALITY} playsInline className="size-full min-h-0 object-contain" />;
  }
  const block = value as Extract<MediaLightboxValue, { type?: unknown }>;
  if (block.type === 'image' && block.image) return <Image image={block.image} className="size-full min-h-0 object-contain" />;
  if (block.type === 'video' && block.video)
    return <MediaVideo video={block.video} quality={LIGHTBOX_VIDEO_QUALITY} playsInline className="size-full min-h-0 object-contain" />;
  return null;
}

export function MediaLightboxTrigger({ value, children }: { value: MediaLightboxValue | null | undefined; children?: ReactNode }) {
  const [open, setOpen] = useState(false);
  if (!value?.isLightbox) return <>{children}</>;
  return (
    <>
      <button type="button" className="cursor-zoom-in text-left" onClick={() => setOpen(true)} aria-label="Open in lightbox">
        {children}
      </button>
      <Lightbox open={open} onClose={() => setOpen(false)} title="Media" className="size-full">
        <LightboxMedia value={value} />
      </Lightbox>
    </>
  );
}
