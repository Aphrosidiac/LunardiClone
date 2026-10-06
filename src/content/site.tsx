import type { ReactNode } from 'react';
import NextLink from 'next/link';
import type { Img } from './types';

// Identity. Every name, address and line of copy the chrome shows comes from here.
// Facts are FF Dev Studio's own (ffdevstudio/BRAND_GUIDELINES.md, SERVICE_ARCHITECTURE.md).

export const SITE = {
  name: 'FF Dev Studio',
  shortName: 'FF',
  role: 'Independent Web Studio',
  url: 'https://ff-desk.pages.dev',
  email: 'hello@ffdev.studio',
  whatsapp: 'https://wa.me/60139078719',
  title: 'Independent Web Studio | FF Dev Studio',
  description:
    'FF Dev Studio is an independent web studio in Kuala Lumpur. Custom websites, WebGL and motion, built by the person you talk to. Projects from RM1,000.',
  legalName: 'FF DEV STUDIO (202603234793)',
  avatar: {
    src: '/brand/ff-profile-ink-512.png',
    width: 512,
    height: 512,
    alt: 'The //FF mark in ink on a round badge',
  } satisfies Img,
  /** IANA zone for the header clock and its bracketed label. */
  timeZone: 'Asia/Kuala_Lumpur',
  timeZoneLabel: 'KUL',
  availability: { status: 'available' as 'available' | 'busy', availableFrom: null as string | null },
  /** Live-cursor presence server (presence/ worker). Unset = feature off, header shows "nobody else". */
  presenceUrl: process.env.NEXT_PUBLIC_PRESENCE_URL || '',
  nav: [
    { href: '/', label: 'Home' },
    { href: '/works', label: 'Works' },
    { href: '/blog', label: 'Blog' },
    { href: '/lab', label: 'Lab' },
    { href: '/shots', label: 'Shots' },
  ],
  socials: [
    { label: 'ffdev.studio', href: 'https://ffdev.studio' },
    { label: 'GitHub', href: 'https://github.com/Aphrosidiac' },
    { label: 'WhatsApp', href: 'https://wa.me/60139078719' },
  ],
} as const;

/** The same inline-link styling the reference uses for every prose link. */
export function A({ href, children }: { href: string; children: ReactNode }) {
  const external = /^https?:/.test(href);
  return (
    <NextLink
      href={href}
      draggable={false}
      className="select-none underline underline-offset-2 hover:decoration-dashed"
      target={external ? '_blank' : undefined}
      rel={external ? 'noopener' : undefined}
    >
      {children}
    </NextLink>
  );
}

/** The one-off notification window that greets a visitor. It carries the demo disclaimer. */
export const NOTIFICATION = {
  title: 'Demo recreation',
  body: (
    <div className="flex flex-col gap-[1em]">
      <p>
        A demo recreation of <A href="https://www.edoardolunardi.dev">Edoardo Lunardi’s portfolio</A>, rebuilt by FF Dev
        Studio to show the craft can be matched. The layout and interactions follow his original; every word, project and
        image here is FF’s own. Not affiliated.
      </p>
      <p>
        The studio itself lives at <A href="https://ffdev.studio">ffdev.studio</A>
      </p>
    </div>
  ),
};

/** A demo recreation is honest about what it is. Shown in the About window and the Build Notes. */
export const DISCLAIMER =
  'This site is a demo recreation of edoardolunardi.dev, rebuilt by FF Dev Studio to show the craft can be matched. The layout and interactions follow Edoardo Lunardi’s original; every word, project and image here is FF’s own. Not affiliated.';

export const JSON_LD = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      '@id': `${SITE.url}/#org`,
      name: SITE.name,
      legalName: SITE.legalName,
      url: 'https://ffdev.studio',
      email: SITE.email,
      logo: `${SITE.url}/brand/ff-profile-ink-512.png`,
      address: { '@type': 'PostalAddress', addressLocality: 'Kuala Lumpur', addressCountry: 'MY' },
      sameAs: ['https://ffdev.studio', 'https://github.com/Aphrosidiac'],
    },
    { '@type': 'WebSite', '@id': `${SITE.url}/#website`, url: SITE.url, name: SITE.name, publisher: { '@id': `${SITE.url}/#org` } },
  ],
};
