'use client';

// Module 982609. A Link inside a home window: optional prefetch on intent (hover / touch start)
// instead of viewport prefetch, plus a click event tagged with the panel it lives in.
import { useRouter } from 'next/navigation';
import type { MouseEvent, TouchEvent } from 'react';
import { Link, type LinkProps } from '@/components/link';
import { track } from '@/lib/track';

export type QuickActionLinkProps = LinkProps & {
  panel: string;
  eventTitle: string;
  prefetchOnIntent?: boolean;
};

export function QuickActionLink({
  panel,
  eventTitle,
  prefetchOnIntent = false,
  prefetch,
  onClick,
  onMouseEnter,
  onTouchStart,
  href,
  ...props
}: QuickActionLinkProps) {
  const router = useRouter();
  const path = typeof href === 'string' ? href : (href.pathname ?? '');

  const prefetchIntent = () => {
    if (prefetchOnIntent && path) router.prefetch(path);
  };

  return (
    <Link
      href={href}
      prefetch={!prefetchOnIntent && prefetch}
      onMouseEnter={(event: MouseEvent<HTMLAnchorElement>) => {
        onMouseEnter?.(event);
        prefetchIntent();
      }}
      onTouchStart={(event: TouchEvent<HTMLAnchorElement>) => {
        onTouchStart?.(event);
        prefetchIntent();
      }}
      onClick={(event: MouseEvent<HTMLAnchorElement>) => {
        onClick?.(event);
        if (event.defaultPrevented) return;
        track('quick_action_click', { panel, href: path.slice(0, 500), title: eventTitle.slice(0, 500) });
      }}
      {...props}
    />
  );
}
