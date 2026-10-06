// The shots canvas (the reference's /awards) lives in the layout so it keeps its pan/zoom while
// `/shots/[id]` opens the 3D viewer over it.
import type { ReactNode } from 'react';
import { InfiniteCanvas, type CanvasItem } from '@/components/canvas/infinite-canvas';
import { Image } from '@/components/media/image';
import { ImageViewerPreloader } from '@/components/shots/image-viewer-preloader';
import { viewerSrc } from '@/components/shots/viewer-src';
import { Window } from '@/components/window/window';
import { SHOTS, SHOTS_BLURB } from '@/content/shots';

const ITEMS: CanvasItem[] = SHOTS.map((shot) => ({
  key: shot._id,
  href: `/shots/${shot._id}`,
  label: shot.title,
  aspectRatio: shot.image.width / shot.image.height,
  preloadImage: viewerSrc(shot.image),
  children: <Image image={shot.image} sizes="25vw" className="size-full object-cover" />,
}));

export default function ShotsLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <div className="relative isolate min-h-0 flex-1 ring-1 ring-theme-fg/30">
        <ImageViewerPreloader />
        <InfiniteCanvas items={ITEMS} label="Shots canvas" itemsLabel="site screenshots" className="absolute inset-0" />
        <Window
          id="shots-info"
          left={<h1>Shots</h1>}
          right={<span className="font-mono">[{SHOTS.length}]</span>}
          allowFullscreen={false}
          draggable
          className="absolute bottom-8 left-8 z-10 w-320"
        >
          <div className="flex flex-col gap-[1em]">
            <p>{SHOTS_BLURB}</p>
          </div>
        </Window>
      </div>
      {children}
    </>
  );
}
