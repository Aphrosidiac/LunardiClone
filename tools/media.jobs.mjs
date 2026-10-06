// Every piece of media the site ships, and where it comes from. Run with `node tools/media.mjs`.
// Sources are FF's own: Fakhrul's screen recordings of the sites (~/Videos, 2026-09-24), live
// captures of the deployed sites, the FF ad films (C:/Dev/FFAds), and PhantomClone's captured shots.
import path from 'node:path';
import os from 'node:os';
import { RECIPES } from './record.recipes.mjs';

const VID = path.join(os.homedir(), 'Videos');
const ADS = 'C:/Dev/FFAds/out/final';
// Chrome at 1920x1080: page viewport is 1904x944 at y=87 (measured on all ten recordings).
const CROP = '1904:944:0:87';
const rec = (file, at, dur = 6, speed = 1.15) => ({ file: path.join(VID, file), at, dur, speed, crop: CROP });
const ad = (file, at, dur = 8) => ({ file: path.join(ADS, file), at, dur });

const R = {
  search: '2026-09-24 17-16-53.mp4',
  shoots: '2026-09-24 17-18-29.mp4',
  stanzza: '2026-09-24 17-19-40.mp4',
  frames: '2026-09-24 17-20-47.mp4',
  sunlight: '2026-09-24 17-21-54.mp4',
  lewixai: '2026-09-24 17-23-22.mp4',
  smoothsail: '2026-09-24 17-24-00.mp4',
  lewixmy: '2026-09-24 17-25-03.mp4',
  meridian: '2026-09-24 17-25-54.mp4',
  bbfalt: '2026-09-24 17-26-44.mp4',
};

export const JOBS = [
  // ── works: cuts from the screen recordings ────────────────────────────────────────────────
  { id: 'works/ff-search/hero', cut: rec(R.search, 2.4) },
  { id: 'works/ff-search/built', cut: rec(R.search, 7.2) },
  { id: 'works/ff-search/start', cut: rec(R.search, 23.6) },
  { id: 'works/ff-shoots/gallery', cut: rec(R.shoots, 7.5) },
  { id: 'works/ff-shoots/lens', cut: rec(R.shoots, 15.3) },
  { id: 'works/ff-shoots/index', cut: rec(R.shoots, 31.5) },
  { id: 'works/ff-stanzza/intro', cut: rec(R.stanzza, 2.35, 6, 1) },
  { id: 'works/ff-stanzza/project', cut: rec(R.stanzza, 13.5) },
  { id: 'works/ff-stanzza/services', cut: rec(R.stanzza, 22.5) },
  { id: 'works/ff-stanzza/about', cut: rec(R.stanzza, 30) },
  { id: 'works/ff-frames/hero', cut: rec(R.frames, 0.5) },
  { id: 'works/ff-frames/weddings', cut: rec(R.frames, 7.75) },
  { id: 'works/ff-frames/gallery', cut: rec(R.frames, 19.5) },
  { id: 'works/ff-frames/pricing', cut: rec(R.frames, 30.5) },
  { id: 'works/sunlight-supplies/hero', cut: rec(R.sunlight, 0.3) },
  { id: 'works/sunlight-supplies/stages', cut: rec(R.sunlight, 9.9) },
  { id: 'works/sunlight-supplies/floors', cut: rec(R.sunlight, 17.5) },
  { id: 'works/lewix-ai/loader', cut: rec(R.lewixai, 4.5) },
  { id: 'works/lewix-ai/mountain', cut: rec(R.lewixai, 9.5) },
  { id: 'works/lewix-ai/team', cut: rec(R.lewixai, 15) },
  { id: 'works/lewix-ai/footer', cut: rec(R.lewixai, 20.5) },
  { id: 'works/smoothsail/hero', cut: rec(R.smoothsail, 0.5) },
  { id: 'works/smoothsail/malay', cut: rec(R.smoothsail, 11.6) },
  { id: 'works/smoothsail/pricing', cut: rec(R.smoothsail, 19) },
  { id: 'works/lewix-my/hero', cut: rec(R.lewixmy, 0.5) },
  { id: 'works/lewix-my/planet', cut: rec(R.lewixmy, 5) },
  { id: 'works/lewix-my/store', cut: rec(R.lewixmy, 14.3) },
  { id: 'works/lewix-my/footer', cut: rec(R.lewixmy, 23.5) },
  { id: 'works/meridian/strip', cut: rec(R.meridian, 1) },
  { id: 'works/meridian/titles', cut: rec(R.meridian, 7) },
  { id: 'works/meridian/studio', cut: rec(R.meridian, 16.5) },
  { id: 'works/meridian/pricing', cut: rec(R.meridian, 19.5) },
  { id: 'works/big-brain-furniture-alt/hero', cut: rec(R.bbfalt, 2.7) },
  { id: 'works/big-brain-furniture-alt/wood', cut: rec(R.bbfalt, 7.5) },
  { id: 'works/big-brain-furniture-alt/storage', cut: rec(R.bbfalt, 12) },
  { id: 'works/big-brain-furniture-alt/objects', cut: rec(R.bbfalt, 21) },

  // ── lab: FF ad films (rendered from code) ──────────────────────────────────────────────────
  { id: 'lab/brand-film', cut: ad('FF-Ad-01_Impossible-to-Ignore_16x9.mp4', 4) },
  { id: 'lab/word-captions', cut: ad('FF-Ad-02_Before-They-Read_9x16.mp4', 4) },
  { id: 'lab/whatsapp-chat', cut: ad('FF-Ad-03_Tanya-Je_BM_9x16.mp4', 6) },
  { id: 'lab/process-board', cut: ad('FF-Ad-04_From-Brief-to-Live_1x1.mp4', 6) },
  { id: 'lab/pricing-film', cut: ad('FF-Ad-05_What-It-Costs_4x5.mp4', 6) },
  { id: 'lab/gallery-walk', cut: ad('FF-Ad-06_The-Gallery_16x9.mp4', 4) },
  { id: 'lab/kinetic-manifesto', cut: ad('FF-Ad-07_Manifesto_9x16.mp4', 0) },
  // the showreel window plays the full brand film
  { id: 'showreel', cut: { file: path.join(ADS, 'FF-Ad-01_Impossible-to-Ignore_16x9.mp4'), at: 0, dur: 30 } },

  // ── lab: cuts that show one technique each ──────────────────────────────────────────────────
  { id: 'lab/fisheye-slider', cut: rec(R.shoots, 15.3, 6, 1) },
  { id: 'lab/tile-intro', cut: rec(R.stanzza, 2.35, 7, 1) },
  { id: 'lab/rack-assembly', cut: rec(R.sunlight, 9.9, 6, 1) },
  { id: 'lab/particle-mountain', cut: rec(R.lewixai, 4.5, 7, 1) },
  { id: 'lab/card-strip', cut: rec(R.meridian, 1, 6, 1) },
  { id: 'lab/kinetic-titles', cut: rec(R.meridian, 7, 6, 1) },
  { id: 'lab/halftone-field', cut: rec(R.search, 2.4, 6, 1) },
  { id: 'lab/quote-calculator', cut: rec(R.frames, 30.5, 6, 1) },
  { id: 'lab/flying-gallery', cut: rec(R.frames, 7.75, 6, 1) },

  // ── live captures of sites with no recording (recipes in record.recipes.mjs) ───────────────
  ...Object.entries(RECIPES).map(([id, r]) => ({ id, record: r })),
];
