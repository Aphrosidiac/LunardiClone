// Ported from reference module 598015: module-level presence state read through
// useSyncExternalStore by the header toggle, the visitors menu and <Presence>.
import type { Visitor } from '@/lib/presence/protocol';

/** localStorage key (reference: `presence-others`). CursorsScript reads the same key. */
export const PRESENCE_OTHERS_KEY = 'ff-presence-others';

export type Self = { id: string; number: number };

const NO_VISITORS: Visitor[] = [];

let showOthers: boolean | null = null;
let pagePeople = 0;
let pageCursors = 0;
let self: Self | null = null;
let visitors: Visitor[] = NO_VISITORS;
let activeVisitors = 0;
let following: string | null = null;
let listOpen = false;
const listeners = new Set<() => void>();

function notify() {
  for (const listener of listeners) listener();
}

export function subscribePresence(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getFollowing() {
  return following;
}

export function getListOpen() {
  return listOpen;
}

export function getNoVisitors() {
  return NO_VISITORS;
}

/** Everyone else on the site (lobby) when we have an identity, else everyone else on this page. */
export function getPeople() {
  return self ? Math.max(activeVisitors, pageCursors) : pagePeople;
}

export function getSelf() {
  return self;
}

export function getShowOthers() {
  if (typeof window === 'undefined') return true;
  if (showOthers === null) {
    try {
      showOthers = localStorage.getItem(PRESENCE_OTHERS_KEY) !== 'hidden';
    } catch {
      showOthers = true;
    }
  }
  return showOthers;
}

export function getVisitors() {
  return visitors;
}

export function setFollowing(id: string | null) {
  if (id === following) return;
  following = id;
  notify();
}

export function setListOpen(open: boolean) {
  if (open === listOpen) return;
  listOpen = open;
  notify();
}

export function setPageCursors(count: number) {
  if (count === pageCursors) return;
  pageCursors = count;
  notify();
}

export function setPagePeople(count: number) {
  if (count === pagePeople) return;
  pagePeople = count;
  notify();
}

export function setSelf(next: Self | null) {
  self = next;
  notify();
}

export function setShowOthers(show: boolean) {
  showOthers = show;
  try {
    localStorage.setItem(PRESENCE_OTHERS_KEY, show ? 'visible' : 'hidden');
  } catch {}
  document.documentElement.toggleAttribute('data-cursors-hidden', !show);
  notify();
}

export function setVisitors(next: Visitor[]) {
  visitors = next.length ? next : NO_VISITORS;
  activeVisitors = visitors.filter((visitor) => !visitor.away).length;
  notify();
}

export function visitorName(number: number) {
  return `Visitor ${number}`;
}
