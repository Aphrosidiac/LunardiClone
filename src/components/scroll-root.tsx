'use client';

// Module 271215. A scroll container that publishes itself so descendants (Video's in-view
// playback, infinite scroll) can use it as their IntersectionObserver root.
import { createContext, useContext, type RefObject } from 'react';

export const ScrollRootContext = createContext<RefObject<HTMLElement | null> | null>(null);

export function useScrollRoot() {
  return useContext(ScrollRootContext);
}
