'use client';

// Ported from reference module 488264. A small draggable window that greets a visitor 5s after
// their first interaction; closing it sets a 1-day cookie so it stays away.
import { useEffect, useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { Icon } from '@/components/icon';
import { Window } from '@/components/window/window';
import { WindowControl } from '@/components/window/window-control';

/** Cookie name (reference: `site-notification-dismissed`). */
const DISMISSED_COOKIE = 'ff-site-notification-dismissed';
const FIRST_INTERACTION = ['pointermove', 'pointerdown', 'touchstart', 'keydown', 'wheel', 'scroll'] as const;

function readCookie(name: string) {
  for (const pair of document.cookie ? document.cookie.split('; ') : []) {
    const [key, ...rest] = pair.split('=');
    try {
      if (decodeURIComponent(key ?? '') === name) return rest.join('=');
    } catch {}
  }
  return undefined;
}

function setCookie(name: string, value: string, days: number) {
  const expires = new Date(Date.now() + 864e5 * days).toUTCString();
  document.cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)}; path=/; expires=${expires}`;
}

function isSkipped(pathname: string, skipOn: string | string[] | undefined) {
  if (!skipOn) return false;
  const paths = Array.isArray(skipOn) ? skipOn : [skipOn];
  const current = pathname.endsWith('/') && pathname !== '/' ? pathname.slice(0, -1) : pathname;
  return paths.some((path) => {
    const normalized = path.startsWith('/') ? path : `/${path}`;
    return current === normalized || current.startsWith(`${normalized}/`);
  });
}

export function NotificationWindow({
  title,
  skipOn,
  children,
}: {
  title: ReactNode;
  skipOn?: string | string[];
  children: ReactNode;
}) {
  const pathname = usePathname() ?? '';
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [interacted, setInteracted] = useState(false);
  const skipped = isSkipped(pathname, skipOn);

  useEffect(() => {
    if (readCookie(DISMISSED_COOKIE)) setDismissed(true);
  }, []);

  useEffect(() => {
    const onFirst = () => {
      setInteracted(true);
      for (const type of FIRST_INTERACTION) window.removeEventListener(type, onFirst);
    };
    for (const type of FIRST_INTERACTION) window.addEventListener(type, onFirst, { passive: true });
    return () => {
      for (const type of FIRST_INTERACTION) window.removeEventListener(type, onFirst);
    };
  }, []);

  useEffect(() => {
    if (dismissed || skipped || !interacted) return;
    const timeout = window.setTimeout(() => setOpen(true), 5000);
    return () => window.clearTimeout(timeout);
  }, [dismissed, skipped, interacted]);

  if (skipped || dismissed || !open) return null;

  const close = () => {
    setCookie(DISMISSED_COOKIE, 'true', 1);
    setDismissed(true);
    setOpen(false);
  };

  return (
    <Window
      id="notification"
      left={<span>{title}</span>}
      draggable
      allowFullscreen={false}
      className="fixed top-38 right-12 z-50 w-320 md:w-400"
      right={
        <WindowControl aria-label="Close notification" onClick={close}>
          <Icon name="close" className="size-full" />
        </WindowControl>
      }
    >
      {children}
    </Window>
  );
}
