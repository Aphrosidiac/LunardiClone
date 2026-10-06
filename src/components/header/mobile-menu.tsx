'use client';

// Ported from reference module 774907. Below `lg` the header collapses to "Open Menu"; the panel is
// portalled and kept mounted (Activity) so reopening is instant. Every route is prefetched on
// small screens since there is no hover to trigger it.
import { Activity, useEffect, useState, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Portal } from '@/components/portal';
import { useBreakpoint } from '@/hooks/use-breakpoint';
import { useFocusTrap } from '@/hooks/use-focus-trap';
import { useWindowEvent } from '@/hooks/use-window-event';
import { SITE } from '@/content/site';
import { Availability, type AvailabilityData } from './availability';
import { Clock } from './clock';
import { EmailLink } from './email-link';
import { HeaderLink } from './header-link';
import { ThemeSwitcher } from './theme-switcher';

const NAV = SITE.nav;

export function MobileMenu({
  search,
  email,
  availability,
}: {
  search?: ReactNode;
  email?: string;
  availability?: AvailabilityData;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const isDesktop = useBreakpoint('lg');
  const trapRef = useFocusTrap(open);

  useEffect(() => {
    if (isDesktop) return;
    for (const item of NAV.toReversed()) if (item.href !== pathname) router.prefetch(item.href);
  }, [isDesktop, pathname, router]);

  useWindowEvent(
    'keydown',
    (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || !open || document.querySelector('[role="dialog"][aria-modal="true"]')) return;
      setOpen(false);
    },
    true,
  );

  useEffect(() => {
    if (isDesktop) setOpen(false);
  }, [isDesktop]);

  useEffect(() => {
    if (pathname !== undefined) setOpen(false);
  }, [pathname]);

  return (
    <>
      <button type="button" className="ml-auto cursor-pointer p-4 font-semibold lg:hidden" onClick={() => setOpen(!open)}>
        {open ? 'Close' : 'Open'} Menu
      </button>
      <Portal>
        <Activity mode={open ? 'visible' : 'hidden'}>
          <div
            ref={trapRef}
            className="fixed inset-x-8 top-34 bottom-8 flex flex-col bg-black/95 p-4 text-theme-fg lg:hidden"
            tabIndex={-1}
          >
            <div className="flex items-start justify-between">
              <ul className="flex flex-col items-start">
                {NAV.map((item) => (
                  <li key={item.href}>
                    <HeaderLink href={item.href}>{item.label}</HeaderLink>
                  </li>
                ))}
                {email && (
                  <li>
                    <EmailLink email={email} source="mobile_menu" />
                  </li>
                )}
              </ul>
              <div>{search}</div>
            </div>
            <div className="mt-auto flex items-end justify-between gap-8">
              <ThemeSwitcher />
              <div className="flex items-center">
                {availability && <Availability availability={availability} />}
                <Clock />
              </div>
            </div>
          </div>
        </Activity>
      </Portal>
    </>
  );
}
