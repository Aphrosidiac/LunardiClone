// Module 163527: a URL-hash-backed key (e.g. the open lightbox item) as an external store.
import { useSyncExternalStore } from 'react';

const HASH_KEY_EVENT = 'hashkeychange';

export function readHashKey(): string | null {
  return decodeURIComponent(window.location.hash.slice(1)) || null;
}

function subscribe(callback: () => void) {
  window.addEventListener('hashchange', callback);
  window.addEventListener(HASH_KEY_EVENT, callback);
  return () => {
    window.removeEventListener('hashchange', callback);
    window.removeEventListener(HASH_KEY_EVENT, callback);
  };
}

export function replaceHashKey(key: string | null | undefined): void {
  const { pathname, search } = window.location;
  const url = key ? `${pathname}${search}#${encodeURIComponent(key)}` : `${pathname}${search}`;
  window.history.replaceState(window.history.state, '', url);
  window.dispatchEvent(new Event(HASH_KEY_EVENT));
}

export function useHashKey(): string | null {
  return useSyncExternalStore(subscribe, readHashKey, () => null);
}
