// The lab canvas lives in the layout so it keeps its pan/zoom while `/lab/[slug]` opens the
// experiment lightbox over it (the reference does this with a parallel `@modal` slot and an
// intercepting route; a static export has neither).
import type { ReactNode } from 'react';
import { InfiniteCanvas, type CanvasItem } from '@/components/canvas/infinite-canvas';
import { LabInfoWindow } from '@/components/lab/lab-info-window';
import { Image } from '@/components/media/image';
import { pickRendition } from '@/components/media/tiers';
import { Video } from '@/components/media/video';
import { EXPERIMENTS, LAB_BLURB } from '@/content/lab';

/** Canvas tiles play the 480 rung. */
const CANVAS_VIDEO_QUALITY = '480';

const ITEMS: CanvasItem[] = EXPERIMENTS.flatMap((experiment) =>
  experiment.media.map((media) => {
    const aspectRatio = media.dimensions.width / media.dimensions.height;
    const rendition = media._type === 'video' ? pickRendition(media.renditions, CANVAS_VIDEO_QUALITY) : undefined;
    return {
      key: `${experiment._id}-${media._key}`,
      href: `/lab/${experiment.slug}#${media._key}`,
      label: experiment.title,
      aspectRatio,
      children:
        media._type === 'video' ? (
          <Video
            sources={rendition ? [{ src: rendition.url }] : []}
            poster={media.placeholder}
            style={{ aspectRatio }}
            autoPlay
            muted
            loop
            controls={false}
            className="size-full object-cover"
            playsInline
            inViewPlayback={{ enabled: true }}
          />
        ) : (
          <Image image={media.image} sizes="25vw" className="size-full object-cover" />
        ),
    };
  }),
);

export default function LabLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <div className="relative isolate min-h-0 flex-1 ring-1 ring-theme-fg/30">
        <InfiniteCanvas items={ITEMS} label="Experiments canvas" itemsLabel="experiment media" className="absolute inset-0" />
        <LabInfoWindow count={EXPERIMENTS.length}>
          <div className="flex flex-col gap-[1em]">
            <p>{LAB_BLURB}</p>
          </div>
        </LabInfoWindow>
      </div>
      {children}
    </>
  );
}
