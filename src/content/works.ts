import type { Img, MediaItem, Work } from './types';
import MEDIA from './media.json';
import SHOTS from './shots.json';

// FF Dev Studio's work. Facts come from the live ffdev.studio data (PhantomClone src/data.js, synced
// 2026-10-06) — see docs/ff-projects.json. Media: clips cut from the screen recordings or captured
// live (tools/media.jobs.mjs → media.json) followed by the captured screens (tools/import-shots.mjs).

export const WORKS_BLURB =
  'A selection of what the studio has shipped since opening: products of our own, sites for clients, and measured recreations of award-level work.';

type ManifestVideo = { type: 'video'; width: number; height: number; placeholder: string; renditions: { quality: string; url: string; poster: string }[] };
type ShotEntry = { src: string; width: number; height: number; widths: number[]; alt: string; page: string; row: string; lqip: string };

const manifest = MEDIA as unknown as Record<string, ManifestVideo | undefined>;
const shots = SHOTS as unknown as Record<string, ShotEntry[] | undefined>;

export function videoItem(id: string, opts: { muted?: boolean } = {}): MediaItem | null {
  const m = manifest[id];
  if (!m || m.type !== 'video') return null;
  return {
    _key: id.replace(/[^a-z0-9]/gi, '-'),
    _type: 'video',
    dimensions: { width: m.width, height: m.height },
    placeholder: m.placeholder,
    playback: { autoplay: true, controls: null, loop: true, muted: opts.muted ?? true },
    renditions: m.renditions,
  };
}

export function shotImg(s: ShotEntry): Img {
  return { src: s.src, width: s.width, height: s.height, alt: s.alt, lqip: s.lqip, widths: s.widths };
}

function shotItems(slug: string, limit: number): MediaItem[] {
  return (shots[slug] ?? []).slice(0, limit).map((s, i) => ({
    _key: `${slug}-shot-${i}`,
    _type: 'image' as const,
    dimensions: { width: s.width, height: s.height },
    placeholder: s.lqip,
    image: shotImg(s),
  }));
}

function media(slug: string, clips: string[], stills = 8): MediaItem[] {
  const v = clips.map((c) => videoItem(`works/${slug}/${c}`)).filter((x): x is MediaItem => !!x);
  return [...v, ...shotItems(slug, stills)];
}

const STACK: Record<string, string> = {
  swift: 'Swift', node: 'Node.js', sqlite: 'SQLite', vite: 'Vite', three: 'three.js', gsap: 'GSAP', lenis: 'Lenis',
  nuxt: 'Nuxt', postgres: 'PostgreSQL', next: 'Next.js', astro: 'Astro', ogl: 'OGL', blender: 'Blender', r3f: 'React Three Fiber',
};

type Def = {
  slug: string;
  title: string;
  group: Work['group'];
  client: string;
  year: number;
  role: string;
  stack: string[];
  url: string;
  reference?: string;
  description: string;
  clips: string[];
  stills?: number;
  source?: string;
};

const DEFS: Def[] = [
  {
    slug: 'hai-awan', title: 'Hai Awan', group: 'work', client: 'FF Dev Studio', year: 2026,
    role: 'Product / macOS app / Server / Website', stack: ['swift', 'node', 'sqlite', 'vite'], url: 'https://awan.ffdev.studio/',
    description: 'A little cloud that lives in your Mac’s notch. Hold two keys, ask out loud, and it looks at your screen and points at the answer. The studio’s own product, open source end to end.',
    clips: ['load', 'scroll'], source: 'https://github.com/Aphrosidiac/HaiAwan',
  },
  {
    slug: 'ff-member', title: 'FF Member', group: 'work', client: 'FF Dev Studio', year: 2026,
    role: 'Art direction / WebGL / Motion', stack: ['vite', 'three', 'gsap', 'lenis'], url: 'https://ff-member.pages.dev/',
    description: 'The studio’s care plans sold as a membership, with a black member card issued, polished and flown onto a chrome plinth on every visit.',
    clips: ['load', 'scroll'],
  },
  {
    slug: 'indahnya', title: 'Indahnya', group: 'work', client: 'FF Dev Studio', year: 2026,
    role: 'Product / Design / Full stack / Motion', stack: ['nuxt', 'postgres', 'gsap', 'lenis'], url: 'https://indahnya-86v.pages.dev/',
    description: 'Every photo from a majlis in one gallery. Guests scan the QR on the table, snap and upload: no app, no login. E-kad, RSVP and a live slideshow on the dewan’s TV.',
    clips: ['load', 'scroll'],
  },
  {
    slug: 'ff-phantom', title: 'FF Phantom', group: 'work', client: 'FF Dev Studio', year: 2026,
    role: 'WebGL / Interaction / Content', stack: ['vite', 'three', 'gsap'], url: 'https://ffdev.studio/', reference: 'phantom.land',
    description: 'The studio site: a wrapping WebGL grid of everything FF has shipped, lens-warped at the edges, with video tiles cut from the work itself.',
    clips: ['intro', 'grid'],
  },
  {
    slug: 'sunlight-supplies', title: 'Sunlight Supplies', group: 'work', client: 'Sunlight Supplies', year: 2026,
    role: 'Art direction / Frontend / 3D', stack: ['next', 'three'], url: 'https://ff-sunlight.pages.dev/',
    description: 'Pallet racking and display fixtures, rendered in three.js rather than photographed: beams, frames and bays assembled on scroll.',
    clips: ['hero', 'stages', 'floors'],
  },
  {
    slug: 'lewix-ai', title: 'LEWIX AI', group: 'work', client: 'Lewix.ai', year: 2026,
    role: 'Art direction / Frontend / WebGL', stack: ['next', 'three', 'gsap'], url: 'https://lewix.ai/',
    description: 'A one-page site carried by a single generative environment instead of a stack of sections. Scrolling moves the camera through it.',
    clips: ['loader', 'mountain', 'team', 'footer'],
  },
  {
    slug: 'smoothsail', title: 'SmoothSail', group: 'work', client: 'Lewix.ai', year: 2026,
    role: 'Product design / Frontend / Architecture', stack: ['next', 'postgres'], url: 'https://smoothsail.my/',
    description: 'A store builder for Malaysian sellers, sold on real interface states rather than a feature list. Storefronts, checkout and shared stock across channels.',
    clips: ['hero', 'malay', 'pricing'],
  },
  {
    slug: 'big-brain-furniture', title: 'Big Brain Furniture', group: 'work', client: 'TGS Furnishings', year: 2026,
    role: 'Art direction / Design system / Frontend', stack: ['next'], url: 'https://bbf.lewix.ai/',
    description: 'Reclaimed teak, presented as a catalogue that treats the material as the whole design.',
    clips: ['load', 'scroll'],
  },
  {
    slug: 'ascend-peptides', title: 'Ascend Peptides', group: 'work', client: 'Ascend Peptides', year: 2026,
    role: 'Design / Frontend / Commerce / SEO', stack: ['next', 'postgres'], url: 'https://ascendpeptides.my/',
    description: 'A research catalogue where the product needs precision, not persuasion: purity, form, storage and documentation first, price second.',
    clips: ['load', 'scroll'],
  },
  {
    slug: 'lewix-my', title: 'Lewix', group: 'work', client: 'Lewix.ai', year: 2026,
    role: 'Art direction / Design / Frontend / Motion', stack: ['next', 'gsap'], url: 'https://lewix.my/',
    description: 'The front door of an AI product studio, built to read as capable before a feature is described.',
    clips: ['hero', 'planet', 'store', 'footer'],
  },
  {
    slug: 'big-brain-furniture-alt', title: 'Big Brain, second direction', group: 'work', client: 'TGS Furnishings', year: 2026,
    role: 'Art direction / Information architecture', stack: ['next'], url: 'https://ff-bbf-alt.pages.dev/',
    description: 'The same brief structured a second way, so the choice could be made by looking, not arguing.',
    clips: ['hero', 'wood', 'storage', 'objects'],
  },
  {
    slug: 'meridian', title: 'Meridian', group: 'work', client: 'FF Dev Studio', year: 2026,
    role: 'WebGL / Interaction engineering / Motion', stack: ['vite', 'three'], url: 'https://ff-meridian.pages.dev/',
    description: 'The engine ffdev.studio ran on before FF Phantom, rebuilt from nothing: one WebGL build on desktop and phone, sized to the scarce axis.',
    clips: ['strip', 'titles', 'studio', 'pricing'],
  },
  {
    slug: 'ff-search', title: 'FF Search', group: 'recreation', client: 'FF Dev Studio', year: 2026,
    role: 'Frontend / Motion / Measurement', stack: ['vite', 'gsap'], url: 'https://ff-search-b4q.pages.dev/', reference: 'aspensearch.com',
    description: 'A search firm’s site rebuilt to the pixel, then re-cast in the studio’s own words. The team and testimonials are fictional.',
    clips: ['hero', 'built', 'start'],
  },
  {
    slug: 'ff-shoots', title: 'FF Shoots', group: 'recreation', client: 'FF Dev Studio', year: 2026,
    role: 'WebGL / Motion / Gesture control', stack: ['next', 'three', 'gsap'], url: 'https://ff-shoots.pages.dev/', reference: 'remyshoots.co.za',
    description: 'A photographer’s slider rebuilt one to one, fisheye lens and hand gestures included.',
    clips: ['gallery', 'lens', 'index'],
  },
  {
    slug: 'ff-stanzza', title: 'FF Stanzza', group: 'recreation', client: 'FF Dev Studio', year: 2026,
    role: 'Frontend / Motion / Webflow interactions', stack: ['vite', 'gsap', 'lenis'], url: 'https://ff-stanzza.pages.dev/', reference: 'stanzza.design',
    description: 'A Webflow awards page rebuilt outside Webflow, every scroll timeline and dropdown intact.',
    clips: ['intro', 'project', 'services', 'about'],
  },
  {
    slug: 'ff-frames', title: 'FF Frames', group: 'recreation', client: 'FF Dev Studio', year: 2026,
    role: 'Frontend / Motion / Astro', stack: ['astro', 'gsap', 'lenis'], url: 'https://ff-frames.pages.dev/', reference: 'ethanwong.photography',
    description: 'Twenty-four routes of a photographer’s site, rebuilt one to one, pricing calculator included.',
    clips: ['hero', 'weddings', 'gallery', 'pricing'],
  },
  {
    slug: 'ff-siena', title: 'FF Siena', group: 'recreation', client: 'FF Dev Studio', year: 2026,
    role: 'WebGL / Motion / Page transitions', stack: ['vite', 'ogl', 'gsap', 'lenis'], url: 'https://ff-siena.pages.dev/', reference: 'siena.film',
    description: 'A film foundation’s site rebuilt one to one: the OGL film roll, the slider, the footage lightbox and the page transitions, ported to readable modules.',
    clips: ['load'],
  },
  {
    slug: 'ff-cellar', title: 'Cellar', group: 'recreation', client: 'FF Dev Studio', year: 2026,
    role: '3D / Baked lighting / Frontend', stack: ['next', 'three', 'blender'], url: 'https://ff-cellar.pages.dev/', reference: 'basement.studio',
    description: 'A studio site with an office you can look around, rebuilt with a generated Blender scene and lighting baked in Cycles.',
    clips: ['load', 'scroll'],
  },
  {
    slug: 'obys-translation', title: 'Obys translation', group: 'recreation', client: 'FF Dev Studio', year: 2026,
    role: 'Interaction engineering / Measurement', stack: ['vite', 'gsap'], url: 'https://ff-concepts.pages.dev/concepts/02/', reference: 'obys.agency',
    description: 'Three layout modes, a flip tumble between them, and a page that never scrolls.',
    clips: ['load', 'scroll'],
  },
  {
    slug: 'basement-translation', title: 'Basement translation', group: 'recreation', client: 'FF Dev Studio', year: 2026,
    role: 'Interaction engineering / Type system', stack: ['vite'], url: 'https://ff-concepts.pages.dev/concepts/01/', reference: 'basement.studio',
    description: 'Pure black, one weight throughout. Unfinished, and shown that way rather than dressed up.',
    clips: ['load', 'scroll'],
  },
];

const host = (u: string) => u.replace(/^https?:\/\//, '').replace(/\/$/, '');

export const WORKS: Work[] = DEFS.map((d) => ({
  _id: d.slug,
  slug: d.slug,
  href: `/works/${d.slug}`,
  title: d.title,
  group: d.group,
  client: d.client,
  year: d.year,
  stack: d.stack.map((s) => STACK[s] ?? s),
  link: { label: host(d.url), href: d.url },
  credits: [
    { label: 'Client', value: d.client },
    ...(d.reference ? [{ label: 'Reference', value: d.reference, href: `https://${d.reference}` }] : []),
    { label: 'Role', value: d.role.split(' / ').join(', ') },
    ...(d.reference ? [] : [{ label: 'Design', value: 'FF Dev Studio' }]),
    { label: 'Development', value: 'FF Dev Studio' },
  ],
  description: d.description,
  media: media(d.slug, d.clips, d.stills ?? 8),
}));

/** Second group in the list (reference: "Open source"). */
export const OPEN_SOURCE: { title: string; href: string }[] = [
  { title: 'Hai Awan', href: 'https://github.com/Aphrosidiac/HaiAwan' },
  { title: 'Shoal', href: 'https://github.com/Aphrosidiac/Shoal' },
];
