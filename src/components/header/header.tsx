// The site header (server component). Reproduces the reference root-layout header and its
// Suspense skeleton verbatim; identity and nav come from SITE.
import NextLink from 'next/link';
import { Image } from '@/components/media/image';
import { SITE } from '@/content/site';
import { Availability } from './availability';
import { Clock } from './clock';
import { CursorsToggle } from './cursors-toggle';
import { EmailLink } from './email-link';
import { HeaderLink } from './header-link';
import { MobileMenu } from './mobile-menu';
import { SearchLightbox } from './search-lightbox';
import { SoundToggle } from './sound-toggle';
import { ThemeSwitcher } from './theme-switcher';

export function Header() {
  const availability = { status: SITE.availability.status, availableFrom: SITE.availability.availableFrom };
  return (
    <header className="grid h-34 grid-cols-[auto_1fr] gap-8 px-4 lg:grid-cols-12 lg:gap-16">
      <div className="col-span-1 flex items-center justify-between lg:col-span-4">
        <NextLink href="/" draggable={false} className="select-none flex h-full items-center gap-8 p-4">
          <Image image={SITE.avatar} priority width={16} height={16} className="rounded-full object-cover" />
          <p className="font-semibold">{SITE.name}</p>
        </NextLink>
      </div>
      <div className="col-span-1 hidden items-center gap-16 lg:col-span-8 lg:col-start-5 lg:flex">
        <nav className="ml-auto h-full lg:mr-auto lg:ml-0">
          <ul className="flex h-full items-center gap-8">
            {SITE.nav.map((item) => (
              <li key={item.href} className="h-full">
                <HeaderLink href={item.href} className="h-full">
                  {item.label}
                </HeaderLink>
              </li>
            ))}
          </ul>
        </nav>
        <div className="hidden h-full lg:block">
          <div className="flex h-full items-center gap-8">
            <EmailLink email={SITE.email} source="header" className="h-full" />
            <ThemeSwitcher />
            <SoundToggle className="h-full" />
            <CursorsToggle className="h-full" />
            <SearchLightbox />
            <Availability availability={availability} className="h-full" />
            <Clock className="h-full" />
          </div>
        </div>
      </div>
      <MobileMenu search={<SearchLightbox />} email={SITE.email} availability={availability} />
    </header>
  );
}

const SKELETON_TOOLS = ['w-26 xl:w-51', 'w-26 xl:w-51', 'w-26 xl:w-51', 'w-26 xl:w-51', 'w-26 xl:w-51', 'w-84', 'w-80'];

/** Suspense fallback for <Header>, as the reference ships it. */
export function HeaderSkeleton() {
  return (
    <header className="grid h-34 grid-cols-[auto_1fr] gap-8 px-4 lg:grid-cols-12 lg:gap-16" aria-hidden>
      <div className="col-span-1 flex items-center justify-between lg:col-span-4">
        <div className="flex h-full items-center gap-8 p-4">
          <div className="animate-pulse bg-theme-fg/10 size-16 rounded-full" />
          <p className="font-semibold">{SITE.name}</p>
        </div>
      </div>
      <div className="col-span-1 hidden items-center gap-16 lg:col-span-8 lg:col-start-5 lg:flex">
        <ul className="mr-auto flex h-full items-center gap-8">
          {SITE.nav.map((item) => (
            <li key={item.href} className="flex h-full items-center p-4 font-semibold text-theme-fg/50">
              {item.label}
            </li>
          ))}
        </ul>
        <div className="flex h-full items-center gap-8">
          {SKELETON_TOOLS.map((width, index) => (
            <div key={index} className={`animate-pulse bg-theme-fg/10 h-18 ${width}`} />
          ))}
        </div>
      </div>
      <span className="ml-auto p-4 font-semibold lg:hidden">Open Menu</span>
    </header>
  );
}
