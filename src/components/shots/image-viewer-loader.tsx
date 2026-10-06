'use client';

// Module 477627. Viewer constants shared by the R3F viewer and its loading skeleton. The skeleton
// is sized to where the plane lands: a VIEWER_PLANE_HEIGHT plane seen from VIEWER_ZOOM units away
// through a VIEWER_FOV lens fills `2 / (zoom · 2·tan(fov/2))` of the canvas height, capped so its
// width stays within VIEWER_MAX_WIDTH_RATIO of the canvas width.
import { Skeleton } from '@/components/line-skeleton';
import { cx } from '@/lib/cx';

export const VIEWER_FOV = 40;
export const VIEWER_ZOOM = 4;
export const VIEWER_PLANE_HEIGHT = 2;
export const VIEWER_MAX_WIDTH_RATIO = 0.8;

/** Fraction of the viewport height the plane covers at VIEWER_ZOOM (≈ 0.687). */
const PLANE_HEIGHT_FRACTION = VIEWER_PLANE_HEIGHT / (2 * VIEWER_ZOOM * Math.tan((VIEWER_FOV * Math.PI) / 360));

export function ImageViewerLoader({ aspectRatio = 0.75, className }: { aspectRatio?: number; className?: string }) {
  const height = `min(${100 * PLANE_HEIGHT_FRACTION}cqh, ${(100 * VIEWER_MAX_WIDTH_RATIO) / aspectRatio}cqw)`;
  return (
    <div className={cx('flex size-full items-center justify-center', className)} style={{ containerType: 'size' }}>
      <Skeleton style={{ height, aspectRatio }} />
    </div>
  );
}
