import type { Experiment, MediaItem } from './types';
import { videoItem } from './works';

// The lab: techniques pulled out of FF's builds and films, one clip each. Media ids resolve
// through src/content/media.json (tools/media.jobs.mjs).

export const LAB_BLURB =
  'Studies, prototypes and pieces built to find out if they could be. Some ended up inside client work, most did not.';

type Def = { slug: string; title: string; year: number; media: string; description: string; stack: string[] };

const DEFS: Def[] = [
  { slug: 'wrapping-grid', title: 'Wrapping WebGL Grid', year: 2026, media: 'lab/wrapping-grid', stack: ['three.js', 'GLSL'], description: 'An 11 by 11 instanced grid that wraps forever in both directions, warped by a barrel lens at the edges. Drag throws it; hover glows with the blurred centre colour of the tile.' },
  { slug: 'brand-film', title: 'Brand Film from Code', year: 2026, media: 'lab/brand-film', stack: ['Remotion', 'three.js'], description: 'A thirty-second studio film rendered entirely from React components, with a score synthesised in numpy and voice from text. No editing timeline anywhere.' },
  { slug: 'fisheye-slider', title: 'Fisheye Slider', year: 2026, media: 'lab/fisheye-slider', stack: ['React Three Fiber', 'GLSL'], description: 'An image slider seen through a fisheye lens pass, matched frame for frame against the reference it was rebuilt from.' },
  { slug: 'lockup-intro', title: 'Lockup Build Intro', year: 2026, media: 'lab/lockup-intro', stack: ['SVG', 'GSAP'], description: 'The //FF lockup assembles itself path by path, the counter capped by real load progress, then the screen splits along the slash’s angle.' },
  { slug: 'word-captions', title: 'Word-by-Word Captions', year: 2026, media: 'lab/word-captions', stack: ['Remotion'], description: 'A vertical ad whose captions land on the voice one word at a time, timed from the transcribed audio rather than by hand.' },
  { slug: 'tile-intro', title: 'Tile Collapse Intro', year: 2026, media: 'lab/tile-intro', stack: ['GSAP', 'Webflow IX'], description: 'Blurred tiles sharpen, line up, collapse and one grows into the hero. A Webflow interaction, re-run outside Webflow by a small runner of our own.' },
  { slug: 'rack-assembly', title: 'Rack Assembly on Scroll', year: 2026, media: 'lab/rack-assembly', stack: ['three.js'], description: 'Pallet racking assembled piece by piece as the page scrolls: frames, then beams, then decking, each part from a box primitive rather than a heavy model.' },
  { slug: 'whatsapp-chat', title: 'Chat Thread Ad', year: 2026, media: 'lab/whatsapp-chat', stack: ['Remotion'], description: 'A Bahasa Malaysia ad told as a chat thread: typing indicators, keyboard taps and replies timed like a real conversation.' },
  { slug: 'particle-mountain', title: 'Particle Mountain', year: 2026, media: 'lab/particle-mountain', stack: ['three.js', 'GLSL'], description: 'A loader mark fills, a black panel opens, and points settle into a mountain range the camera then flies over.' },
  { slug: 'process-board', title: 'Process Board', year: 2026, media: 'lab/process-board', stack: ['Remotion'], description: 'Brief to live site in one square: a project board that moves itself through each stage while the preview builds beside it.' },
  { slug: 'card-strip', title: 'Swinging Card Strip', year: 2026, media: 'lab/card-strip', stack: ['three.js'], description: 'A strip of project cards hung in 3D that swings with the cursor and opens into full-screen titles.' },
  { slug: 'gallery-walk', title: 'Gallery Walk', year: 2026, media: 'lab/gallery-walk', stack: ['three.js', 'Remotion'], description: 'A camera walks a white gallery where every frame on the wall is a live site the studio built.' },
  { slug: 'kinetic-titles', title: 'Kinetic Titles', year: 2026, media: 'lab/kinetic-titles', stack: ['GSAP'], description: 'Project names set enormous, letters split across the screen and pulled back together around a floating preview.' },
  { slug: 'pricing-film', title: 'Pricing in Motion', year: 2026, media: 'lab/pricing-film', stack: ['Remotion'], description: 'The studio’s prices as a film: the figure counts up, the inclusions tick in, and the care plans slide in last.' },
  { slug: 'halftone-field', title: 'Halftone Field', year: 2026, media: 'lab/halftone-field', stack: ['Canvas 2D'], description: 'A soft halftone field behind the hero that a mint blob swims through, drawn as dots so it stays crisp at any size.' },
  { slug: 'kinetic-manifesto', title: 'Kinetic Manifesto', year: 2026, media: 'lab/kinetic-manifesto', stack: ['Remotion'], description: 'Six lines, one per beat. Type that fills the frame, cut to the music.' },
  { slug: 'quote-calculator', title: 'Quote Calculator', year: 2026, media: 'lab/quote-calculator', stack: ['Astro'], description: 'A package calculator that prices a shoot as you pick it, totals sliding up in the corner.' },
  { slug: 'flying-gallery', title: 'Flying Gallery', year: 2026, media: 'lab/flying-gallery', stack: ['GSAP', 'Lenis'], description: 'Photographs that fly in from the edges and settle into a loose collage as the page scrolls.' },
];

export const EXPERIMENTS: Experiment[] = DEFS.flatMap((d) => {
  const m = videoItem(d.media);
  if (!m) return [];
  return [{ _id: d.slug, slug: d.slug, href: `/lab/${d.slug}`, title: d.title, year: d.year, description: d.description, stack: d.stack, media: [m] as MediaItem[] }];
});
