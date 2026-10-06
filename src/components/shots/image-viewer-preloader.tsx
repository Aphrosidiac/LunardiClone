'use client';

// Module 209793. The R3F viewer is code-split (three + fiber are heavy). `ImageModelViewer` here is
// the lazy wrapper: it shows the sized skeleton until the viewer reports its texture is ready.
// `ImageViewerPreloader` starts fetching the viewer chunk on the first sign of a live visitor
// (pointer, touch or key), so opening a shot rarely waits on the download.
import dynamic from 'next/dynamic';
import { useCallback, useEffect, useState } from 'react';
import { ImageViewerLoader } from './image-viewer-loader';
import type { ImageModelViewerProps } from './image-model-viewer';

const LazyImageModelViewer = dynamic(() => import('./image-model-viewer').then((m) => m.ImageModelViewer), {
  ssr: false,
});

let viewerChunk: Promise<unknown> | undefined;

export function preloadImageViewer() {
  return (viewerChunk ??= import('./image-model-viewer'));
}

const WARM_EVENTS = ['pointermove', 'pointerdown', 'touchstart', 'keydown'] as const;

function warmOnFirstInteraction() {
  const warm = () => {
    preloadImageViewer();
    for (const type of WARM_EVENTS) window.removeEventListener(type, warm);
  };
  for (const type of WARM_EVENTS) window.addEventListener(type, warm, { passive: true });
  return () => {
    for (const type of WARM_EVENTS) window.removeEventListener(type, warm);
  };
}

export function ImageModelViewer({ aspectRatio, ...props }: Omit<ImageModelViewerProps, 'onReady'> & { aspectRatio?: number }) {
  const [ready, setReady] = useState(false);
  const onReady = useCallback(() => setReady(true), []);
  return (
    <div className="relative size-full">
      {!ready && <ImageViewerLoader aspectRatio={aspectRatio} className="absolute inset-0" />}
      <LazyImageModelViewer {...props} onReady={onReady} />
    </div>
  );
}

export function ImageViewerPreloader() {
  useEffect(warmOnFirstInteraction, []);
  return null;
}
