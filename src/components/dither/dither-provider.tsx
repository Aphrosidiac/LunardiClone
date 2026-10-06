'use client';

// DitherProvider / DitherSlot — port of reference module 248737 (chunk 2dt9_omfwr-7v.js).
//
// One fixed, full-viewport layer hosts the dither canvas for the whole app. Pages place a
// <DitherSlot> where the background should show; the layer clips itself to that slot's rect
// (`clip-path: inset(top right bottom left)`), or fully closed (`inset(50%)`) when no slot is mounted
// or the slot has no size. The scene mounts the first time a slot becomes visible and then stays
// mounted; it only runs its frameloop while a slot is visible (`active`).

import dynamic from 'next/dynamic';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from 'react';

import { useIsomorphicEffect } from '@/hooks/use-isomorphic-effect';
import { useWindowEvent } from '@/hooks/use-window-event';
import { cx } from '@/lib/cx';

import type { DitherSceneProps } from './dither-scene';

function DitherSkeleton({ className }: { className?: string }) {
  return <div className={cx('size-full animate-pulse bg-theme-fg/10', className)} />;
}

const DitherScene = dynamic(() => import('./dither-scene').then((mod) => mod.DitherScene), {
  loading: () => <DitherSkeleton />,
  ssr: false,
});

// Defer loading three.js until the browser is idle (max 300ms), or 200ms without requestIdleCallback.
function LazyDitherScene(props: DitherSceneProps) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const requestIdle = window.requestIdleCallback;
    if (requestIdle) {
      const handle = requestIdle(() => setReady(true), { timeout: 300 });
      return () => window.cancelIdleCallback?.(handle);
    }
    const timeout = window.setTimeout(() => setReady(true), 200);
    return () => window.clearTimeout(timeout);
  }, []);

  if (!ready) return <DitherSkeleton />;
  return <DitherScene {...props} />;
}

type SetSlot = Dispatch<SetStateAction<HTMLElement | null>>;

const DitherSlotContext = createContext<SetSlot | null>(null);

function DitherLayer({ slot }: { slot: HTMLElement | null }) {
  const layer = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (active) setMounted(true);
  }, [active]);

  const updateClip = useCallback(() => {
    const element = layer.current;
    if (!element) return;
    const rect = slot?.getBoundingClientRect();
    const visible = !!rect && rect.width > 0 && rect.height > 0;
    setActive(visible);
    if (!rect || !visible) {
      element.style.clipPath = 'inset(50%)';
      return;
    }
    const top = Math.max(0, rect.top);
    const left = Math.max(0, rect.left);
    const right = Math.max(0, window.innerWidth - rect.right);
    const bottom = Math.max(0, window.innerHeight - rect.bottom);
    element.style.clipPath = `inset(${top}px ${right}px ${bottom}px ${left}px)`;
  }, [slot]);

  useIsomorphicEffect(() => {
    updateClip();
    if (!slot) return;
    const observer = new ResizeObserver(updateClip);
    observer.observe(slot);
    return () => observer.disconnect();
  }, [slot, updateClip]);

  useWindowEvent('resize', updateClip);

  return (
    <div
      ref={layer}
      aria-hidden
      className="pointer-events-none fixed inset-0 [clip-path:inset(50%)]"
    >
      {mounted && <LazyDitherScene active={active} />}
    </div>
  );
}

export function DitherProvider({ children }: { children?: ReactNode }) {
  const [slot, setSlot] = useState<HTMLElement | null>(null);

  return (
    <DitherSlotContext.Provider value={setSlot}>
      <DitherLayer slot={slot} />
      {children}
    </DitherSlotContext.Provider>
  );
}

export function DitherSlot({ className, id }: { className?: string; id?: string }) {
  const setSlot = useContext(DitherSlotContext);
  const element = useRef<HTMLDivElement>(null);

  useIsomorphicEffect(() => {
    if (!setSlot) return;
    const node = element.current;
    setSlot(node);
    return () => {
      setSlot((current) => (current === node ? null : current));
    };
  }, [setSlot]);

  return <div ref={element} id={id} aria-hidden className={className} />;
}
