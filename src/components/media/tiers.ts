// Modules 637695 + 54342: the video resolution ladder. A rendition's `quality` is `original` or a
// rung height in pixels; `pickRendition` returns the smallest rung at least as tall as asked for.
import type { Rendition } from '@/content/types';
import { screens } from '@/lib/screens';

export const DEFAULT_TIERS = [240, 720];

export function normalizeTiers(tiers: number[]): number[] {
  for (const tier of tiers) {
    if (!Number.isInteger(tier) || tier <= 0 || tier % 2 !== 0)
      throw new Error(`Invalid tier ${tier}: a tier is a rung height in pixels, a positive even whole number.`);
  }
  return [...new Set(tiers)].sort((a, b) => a - b);
}

type RenditionLike = Pick<Rendition, 'quality' | 'url'> & Partial<Rendition>;

function qualityOf(rendition: RenditionLike): string | undefined {
  const quality = rendition.quality;
  return typeof quality === 'string' && quality ? quality : undefined;
}

function qualityRank(quality: string): number {
  return quality === 'original' ? Infinity : Number(quality);
}

function pickByHeight<R extends RenditionLike>(renditions: (R | null | undefined)[] | null | undefined, height: number) {
  const usable = (renditions ?? []).filter((r): r is R => !!r?.url);
  if (!usable.length) return undefined;
  const rungs = usable
    .map((rendition) => ({ rendition, height: Number(qualityOf(rendition)) }))
    .filter((r) => Number.isFinite(r.height))
    .sort((a, b) => a.height - b.height);
  const original = usable.find((r) => qualityOf(r) === 'original');
  return rungs.find((r) => r.height >= height)?.rendition ?? original ?? rungs.at(-1)?.rendition ?? usable[0];
}

/** `quality` is `original` (default) or a rung height such as `'720'`. */
export function pickRendition<R extends RenditionLike>(
  renditions: (R | null | undefined)[] | null | undefined,
  quality: string = 'original',
): R | undefined {
  return pickByHeight(renditions, quality === 'original' ? Infinity : Number(quality));
}

/** Upload-side helper: drop rungs that are not smaller in bytes than the next rung up. */
export function selectShrinkingRenditions<R extends { quality: string; bytes: number }>(renditions: R[]) {
  const sorted = [...renditions].sort((a, b) => qualityRank(b.quality) - qualityRank(a.quality));
  const kept: R[] = [];
  const dropped: { rendition: R; largerThan: R }[] = [];
  let previous: R | undefined;
  for (const rendition of sorted) {
    if (previous && rendition.bytes >= previous.bytes) {
      dropped.push({ rendition, largerThan: previous });
      continue;
    }
    kept.push(rendition);
    previous = rendition;
  }
  return { kept, dropped };
}

/** Lightboxes play the original from `md` up and the 720 rung on phones. */
export const LIGHTBOX_VIDEO_QUALITY = `(min-width: ${screens.md}) original, 720`;
