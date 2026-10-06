import type { Shot } from './types';
import SHOTS_JSON from './shots.json';
import { WORKS, shotImg } from './works';

// The reference's "Awards" slot. FF has no awards to show, so this canvas holds what it does have:
// screens captured from the live sites it built (PhantomClone tools/shots.mjs, imported by
// tools/import-shots.mjs). One entry per capture, titled after its project.

export const SHOTS_BLURB =
  'Captured from the live sites the studio built, not mocked up for the occasion. Drag to wander, open one to look closer.';

type ShotEntry = { src: string; width: number; height: number; widths: number[]; alt: string; page: string; row: string; lqip: string };
const all = SHOTS_JSON as unknown as Record<string, ShotEntry[]>;
const titles = Object.fromEntries(WORKS.map((w) => [w.slug, w.title]));

export const SHOTS: Shot[] = Object.entries(all).flatMap(([slug, list]) =>
  list.map((s, i) => {
    const id = `${slug}-${i + 1}`;
    return {
      _id: id,
      href: `/shots/${id}`,
      title: titles[slug] ?? slug,
      subtitle: s.alt,
      date: '2026-09-25',
      site: s.page,
      image: shotImg(s),
    };
  }),
);
