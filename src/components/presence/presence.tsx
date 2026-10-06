'use client';

// Ported from reference module 609433. Boots the live-cursor layer and the visitors lobby on idle,
// only for a real mouse (hover + fine pointer) and never under automation, and drives "follow"
// mode: while following a visitor we navigate wherever they go until any input of ours stops it.
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { replaceHashKey, useHashKey } from '@/lib/hash-key';
import { useWindowEvent } from '@/hooks/use-window-event';
import { cx } from '@/lib/cx';
import { track } from '@/lib/track';
import type { PresenceHandle } from '@/lib/presence/create-presence';
import type { LobbyHandle } from '@/lib/presence/create-lobby';
import {
  getFollowing,
  getNoVisitors,
  getShowOthers,
  getVisitors,
  setFollowing,
  setPageCursors,
  setPagePeople,
  setSelf,
  setVisitors,
  subscribePresence,
  visitorName,
} from './presence-store';

const WHEEL_OPTIONS = { passive: true, capture: true } as const;
const MODIFIERS = new Set(['Shift', 'Control', 'Alt', 'Meta']);

function currentUrl() {
  return `${window.location.pathname}${window.location.search}${window.location.hash}`;
}

/** Go to the followed visitor's URL; same page with a different hash only swaps the hash key. */
function goTo(url: string, push: (href: string) => void) {
  const hashIndex = url.indexOf('#');
  const path = hashIndex === -1 ? url : url.slice(0, hashIndex);
  const hash = hashIndex === -1 ? '' : url.slice(hashIndex);
  if (path !== `${window.location.pathname}${window.location.search}`) return push(url);
  if (hash === window.location.hash) return;
  try {
    replaceHashKey(hash ? decodeURIComponent(hash.slice(1)) : null);
  } catch {
    replaceHashKey(null);
  }
}

export function Presence({ url }: { url: string }) {
  const pathname = usePathname();
  const hashKey = useHashKey();
  const router = useRouter();
  const pathnameRef = useRef(pathname);
  const presenceRef = useRef<PresenceHandle | null>(null);
  const lobbyRef = useRef<LobbyHandle | null>(null);
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState('');
  const showOthers = useSyncExternalStore(subscribePresence, getShowOthers, () => true);
  const following = useSyncExternalStore(subscribePresence, getFollowing, () => null);
  const visitors = useSyncExternalStore(subscribePresence, getVisitors, getNoVisitors);
  const followed = following ? visitors.find((visitor) => visitor.id === following) : undefined;
  const followedName = followed ? visitorName(followed.number) : null;
  const lastNameRef = useRef<string | null>(null);

  useEffect(() => {
    if (!url || navigator.webdriver || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    let cancelled = false;
    let identityTimeout: number | undefined;
    let cancelBoot: () => void;

    const boot = () => {
      Promise.all([import('@/lib/presence/create-presence'), import('@/lib/presence/create-lobby')])
        .then(([{ createPresence }, { createLobby }]) => {
          if (cancelled) return;
          const presence = createPresence({
            url,
            showOthers: getShowOthers(),
            onPeopleChange: setPagePeople,
            onCursorsChange: setPageCursors,
          });
          presence.join(pathnameRef.current);
          const lobby = createLobby({
            url,
            onIdentity: ({ id, number, token }) => {
              window.clearTimeout(identityTimeout);
              setSelf({ id, number });
              presence.setIdentity(token);
            },
            onVisitors: setVisitors,
            onUnavailable: () => {
              setSelf(null);
              presence.setIdentity(null);
            },
          });
          lobby.setWhere(currentUrl());
          // Without a lobby answer in 5s, join the cursor room anonymously.
          identityTimeout = window.setTimeout(() => presence.setIdentity(null), 5000);
          presenceRef.current = presence;
          lobbyRef.current = lobby;
          setReady(true);
        })
        .catch(() => {});
    };

    if (window.requestIdleCallback) {
      const handle = window.requestIdleCallback(boot, { timeout: 3000 });
      cancelBoot = () => window.cancelIdleCallback(handle);
    } else {
      const handle = window.setTimeout(boot, 1500);
      cancelBoot = () => window.clearTimeout(handle);
    }

    return () => {
      cancelled = true;
      cancelBoot();
      window.clearTimeout(identityTimeout);
      presenceRef.current?.destroy();
      lobbyRef.current?.destroy();
      presenceRef.current = null;
      lobbyRef.current = null;
      setSelf(null);
      setVisitors([]);
      setFollowing(null);
    };
  }, [url]);

  useEffect(() => {
    pathnameRef.current = pathname;
    presenceRef.current?.join(pathname);
    lobbyRef.current?.retry();
    lobbyRef.current?.setWhere(currentUrl());
  }, [pathname, hashKey]);

  useEffect(() => {
    presenceRef.current?.setShowOthers(showOthers);
  }, [showOthers]);

  useEffect(() => {
    if (!status) return;
    const timeout = window.setTimeout(() => setStatus(''), 1600);
    return () => window.clearTimeout(timeout);
  }, [status]);

  const followedUrl = followed?.url;
  useEffect(() => {
    if (!following) return;
    if (!followedUrl) {
      setFollowing(null);
      setStatus(`${lastNameRef.current ?? 'They'} left`);
      return;
    }
    goTo(followedUrl, (href) => router.push(href, { scroll: false }));
  }, [following, followedUrl, pathname, hashKey, router]);

  useEffect(() => {
    presenceRef.current?.setHighlight(following && followedName ? { id: following, label: followedName } : null);
    if (followedName) {
      lastNameRef.current = followedName;
      setStatus(`Following ${followedName}`);
    }
  }, [following, followedName]);

  const stopFollowing = (event: Event) => {
    if (!getFollowing()) return;
    const target = event.target instanceof Element ? event.target : null;
    const isEscape = event instanceof KeyboardEvent && event.key === 'Escape';
    if (target?.closest('[data-presence-visitors]')) return;
    if (target?.closest('[data-presence-toggle]') && !isEscape) return;
    if (event instanceof KeyboardEvent && MODIFIERS.has(event.key)) return;
    setFollowing(null);
    track('stop_following');
  };

  useWindowEvent('pointerdown', stopFollowing, true);
  useWindowEvent('wheel', stopFollowing, WHEEL_OPTIONS);
  useWindowEvent('keydown', stopFollowing, true);

  if (!ready) return null;

  return (
    <>
      {followedName && (
        <>
          <div aria-hidden className="pointer-events-none fixed inset-0 z-9998 ring-2 ring-theme-fg ring-inset" />
          <p
            aria-hidden
            className="pointer-events-none fixed top-40 left-1/2 z-9998 -translate-x-1/2 whitespace-nowrap bg-theme-fg px-8 py-2 font-mono text-theme-bg uppercase"
          >
            Following {followedName} · Esc to stop
          </p>
        </>
      )}
      <p
        role="status"
        className={cx(
          'pointer-events-none fixed bottom-16 left-16 z-9999 bg-theme-bg px-8 py-4 font-mono text-theme-fg uppercase ring-1 ring-theme-fg/30 transition-opacity duration-200',
          status ? 'opacity-100' : 'opacity-0',
        )}
      >
        {status}
      </p>
    </>
  );
}
