import type { ReactNode } from 'react';
import { A, SITE } from './site';
import { ARTICLES } from './blog';
import { WORKS, videoItem } from './works';
import { EXPERIMENTS } from './lab';
import MEDIA from './media.json';
import type { Img } from './types';

// Home desktop content. Facts are FF's own: ffdevstudio/SERVICE_ARCHITECTURE.md (services, prices,
// terms, care plans) and the live ffdev.studio project data.

export const HOME_H1 = `${SITE.name} — ${SITE.role}`;

export const ABOUT: ReactNode = (
  <div className="flex flex-col gap-[1em]">
    <p>
      Independent web studio in Kuala Lumpur, building custom websites end to end: design, motion, WebGL and the code
      underneath. Products of our own, sites for clients across Malaysia, and measured recreations of{' '}
      <A href="/works/ff-search">award-level work</A> to prove the craft can be matched, not approximated. You talk to
      the person who builds it, from the first message to launch.
    </p>
    <p>
      Taking on new projects. Find the studio at <A href="https://ffdev.studio">ffdev.studio</A>,{' '}
      <A href="https://github.com/Aphrosidiac">GitHub</A>, <A href={SITE.whatsapp}>WhatsApp</A> or{' '}
      <A href={`mailto:${SITE.email}`}>get in touch directly</A>.
    </p>
  </div>
);

export type AboutFile = { key: string; name: string; icon: 'file' | 'folder'; note: string | null; size: string; content: ReactNode };

/** Shown as the `ls -l` listing date in the About folder. */
export const ABOUT_DATE = 'Oct 06';

const Table = ({ head, rule, rows }: { head: string; rule: string; rows: string[] }) => (
  <div className="overflow-x-auto whitespace-pre [scrollbar-width:none]" data-lenis-prevent>
    <div className="font-semibold">{head}</div>
    <div className="opacity-60">{rule}</div>
    {rows.map((r) => (
      <div key={r}>{r}</div>
    ))}
  </div>
);

const SERVICES: [string, ReactNode][] = [
  ['Custom websites, end to end.', 'Direction, design and build from one person, so nothing is lost in a handoff. Landing pages, SME and corporate sites, portfolios, campaigns.'],
  ['Motion, 3D and WebGL.', 'Interaction and shaders that feel designed rather than bolted on, and still run smoothly on a mid-range phone.'],
  ['E-commerce.', 'Catalogues, checkout and payments for stores that need to feel as considered as what they sell.'],
  ['Booking and enquiry flows.', 'Forms, WhatsApp paths and integrations that put a lead in front of you instead of in a spam folder.'],
  ['Products of our own.', <>The studio ships its own work too: <A href="/works/hai-awan">Hai Awan</A> on the Mac and <A href="/works/indahnya">Indahnya</A> for the majlis. Same standard either way.</>],
  ['Performance and findability.', 'Accessibility, technical SEO and structured data as part of the build, not a line item after it.'],
  ['Care after launch.', 'Managed hosting, monitoring and fixes on a monthly plan, so the site you launched is the site you keep.'],
];

export const ABOUT_FILES: AboutFile[] = [
  {
    key: 'ff101',
    name: 'services.md',
    icon: 'file',
    note: null,
    size: '1.1K',
    content: (
      <div className="flex flex-col gap-[1lh] whitespace-pre-wrap">
        <ol className="flex flex-col gap-[1lh]">
          {SERVICES.map(([title, body], i) => (
            <li key={i} className="flex">
              <span className="shrink-0">{i + 1}. </span>
              <span>
                <strong className="font-semibold">{title}</strong> {body}
              </span>
            </li>
          ))}
        </ol>
      </div>
    ),
  },
  {
    key: 'ff102',
    name: 'pricing.csv',
    icon: 'file',
    note: null,
    size: '0.5K',
    content: (
      <div className="flex flex-col gap-[1lh] whitespace-pre-wrap">
        <p>Every project is quoted after one conversation. These bands are where most land, so you know if we are in the same range.</p>
        <Table
          head="| Engagement             | Price             |"
          rule="|------------------------|-------------------|"
          rows={[
            '| Focused build          | RM1,000 – 1,999   |',
            '| Full brand website     | RM2,000 – 3,499   |',
            '| Signature experience   | RM3,500 – 5,000+  |',
            '| Care plan              | from RM59 / month |',
          ]}
        />
        <p>
          50% to begin, 50% before launch, three revision rounds and a thirty-day defect warranty.{' '}
          <A href={SITE.whatsapp}>Start on WhatsApp</A>, that is where every project begins.
        </p>
      </div>
    ),
  },
  {
    key: 'ff103',
    name: 'care.md',
    icon: 'file',
    note: null,
    size: '0.3K',
    content: (
      <div className="flex flex-col gap-[1lh] whitespace-pre-wrap">
        <Table
          head="| Plan     | Monthly | Yearly   | Adds                              |"
          rule="|----------|---------|----------|-----------------------------------|"
          rows={[
            '| Care     | RM59    | RM590    | Hosting, SSL, monitoring, fixes   |',
            '| Maintain | RM149   | RM1,490  | 60 min of changes, priority help  |',
            '| Evolve   | RM299   | RM2,990  | 3 hours of improvements, reviews  |',
          ]}
        />
        <p>
          Hosting is recommended, never required. <A href="https://ff-member.pages.dev/">See the plans as a membership</A>.
        </p>
      </div>
    ),
  },
  {
    key: 'ff104',
    name: 'faq.txt',
    icon: 'file',
    note: null,
    size: '0.8K',
    content: (
      <div className="flex flex-col gap-[1lh] whitespace-pre-wrap">
        <p>
          <strong className="font-semibold">How do I get in touch?</strong> Email{' '}
          <A href={`mailto:${SITE.email}`}>{SITE.email}</A> or message on <A href={SITE.whatsapp}>WhatsApp</A>.
        </p>
        <p>
          <strong className="font-semibold">Who will I be talking to?</strong> The person who designs and builds your
          site. There is no account manager in between.
        </p>
        <p>
          <strong className="font-semibold">Do you design too?</strong> Yes. Visual direction, UI and motion are part of
          every build. If you already have a designer, we build from their files.
        </p>
        <p>
          <strong className="font-semibold">How long does it take?</strong> A focused build is usually 2–5 working days,
          a full site 4–8, anything with 3D or a catalogue a week or more.
        </p>
        <p>
          <strong className="font-semibold">What’s your stack?</strong> Next.js, Astro, Nuxt or plain Vite depending on
          the job; three.js and React Three Fiber for WebGL; self-hosted wherever it makes sense.
        </p>
        <p>
          <strong className="font-semibold">What is this site?</strong> A demo recreation of Edoardo Lunardi’s
          portfolio, rebuilt by the studio to show the interactions can be matched exactly. The layout follows his
          original; the work, words and media here are FF’s own. Not affiliated.
        </p>
      </div>
    ),
  },
];

/** About-window photo strip: the studio's work in black and white. */
const STRIP = ['hai-awan', 'ff-member', 'indahnya', 'ff-search', 'ff-shoots', 'ff-stanzza', 'ff-frames', 'sunlight-supplies', 'lewix-ai', 'smoothsail', 'big-brain-furniture', 'lewix-my', 'meridian'];
export const ABOUT_STRIP: Img[] = STRIP.map((s) => ({
  src: `/media/about/${s}.webp`,
  width: 426,
  height: 240,
  widths: [213],
  alt: `${WORKS.find((w) => w.slug === s)?.title ?? s}, in black and white`,
}));

export const FEATURED_ARTICLE = ARTICLES[0];

export type GalleryItem = { href: string; title: string; sources: { src: string }[]; poster?: string; width: number; height: number; image?: Img };

/** Every clip of every work at 240p, the way the reference's Work Gallery runs. */
export const WORK_GALLERY: GalleryItem[] = WORKS.flatMap((w) =>
  w.media.flatMap((m) => {
    if (m._type !== 'video') return [];
    const r = m.renditions.find((x) => x.quality === '240') ?? m.renditions[0];
    return [{ href: w.href, title: w.title, sources: [{ src: r.url }], poster: m.placeholder, width: m.dimensions.width, height: m.dimensions.height }];
  }),
);

const featured = ['wrapping-grid', 'lockup-intro'];
export const FEATURED_EXPERIMENT: GalleryItem[] = featured.flatMap((slug) => {
  const e = EXPERIMENTS.find((x) => x.slug === slug);
  const m = e?.media[0];
  if (!e || !m || m._type !== 'video') return [];
  const r = m.renditions.find((x) => x.quality === '240') ?? m.renditions[0];
  return [{ href: `${e.href}#${m._key}`, title: e.title, sources: [{ src: r.url }], poster: m.placeholder, width: m.dimensions.width, height: m.dimensions.height }];
});

type Manifest = Record<string, { width: number; height: number; renditions: { quality: string; url: string; poster: string }[] } | undefined>;
const reel = (MEDIA as unknown as Manifest)['showreel'];
const reelTop = reel?.renditions.find((r) => r.quality === 'original') ?? reel?.renditions[reel.renditions.length - 1];
export const SHOWREEL = {
  title: 'Showreel',
  src: reelTop?.url ?? '',
  poster: reelTop?.poster ?? '',
  width: reel?.width ?? 1920,
  height: reel?.height ?? 1080,
  renditions: reel?.renditions ?? [],
};
// keep the brand film reachable as a media item too
export const SHOWREEL_ITEM = videoItem('showreel', { muted: false });

export const BUILD_NOTES: ReactNode = (
  <div className="flex flex-col gap-[1em]">
    <p>Notes from the bench: what broke, what we measured, and what we would do again. Sent when there is something worth sending.</p>
  </div>
);

// Build Notes window = the reference's email-capture window (EmailCaptureContent).
export const BUILD_NOTES_CTA = 'Join the list';
export const BUILD_NOTES_LEGAL: ReactNode = (
  <div className="flex flex-col gap-[1em]">
    <p>Your email is only collected if you choose to submit it.</p>
    <p>It is used to send the occasional build note. No marketing, no spam.</p>
    <p>
      Joining opens your own mail app with a short request to {SITE.email}; nothing is stored by this page. To be
      removed at any time, write to <A href={`mailto:${SITE.email}`}>{SITE.email}</A>.
    </p>
    <p>Your address is never sold or shared.</p>
  </div>
);
export const BUILD_NOTES_AUDIENCE_IDS: string[] = ['build-notes'];
