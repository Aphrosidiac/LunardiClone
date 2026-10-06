// The texture the 3D viewer loads, and the canvas preloads on hover. The reference requests a
// 2048px-wide rendition; we pick the smallest width variant on disk at least that wide
// (`<stem>-<w>.webp`), else the full-size `src`.
import type { Img } from '@/content/types';

export const VIEWER_TEXTURE_WIDTH = 2048;

export function viewerSrc(image: Img, target = VIEWER_TEXTURE_WIDTH): string {
  const width = (image.widths ?? [])
    .filter((w) => w >= target && w < image.width)
    .sort((a, b) => a - b)[0];
  if (!width) return image.src;
  return image.src.replace(/\.[a-z0-9]+$/i, `-${width}.webp`);
}
