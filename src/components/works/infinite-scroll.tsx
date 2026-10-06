'use client';

// Module 959966. An endless vertical scroller with no scroll container: the children are
// rendered N times (N = copies needed to cover the viewport + 3, max 12), each copy is parked on
// a ring with translateY so the set wraps, and the track moves by one transform driven by a
// single lerped value. Wheel, touch (2x), arrows/PageUp/PageDown/Space and focus-into-view all
// feed the same target. Only copy 0 is exposed to assistive tech and the tab order.
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { ScrollRootContext } from '@/components/scroll-root';
import { cx } from '@/lib/cx';

const FRAME_MS = 1000 / 60;
const LINE_HEIGHT = 100 / 6;
const mod = (value: number, n: number) => ((value % n) + n) % n;

export function InfiniteScroll({ children, className }: { children?: ReactNode; className?: string }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number | null>(null);
  const targetRef = useRef(0);
  const currentRef = useRef(0);
  const periodRef = useRef(0);
  const viewportRef = useRef(0);
  const ringRef = useRef({ base: Number.NaN, period: 0 });
  const touchRef = useRef<{ id: number; y: number } | null>(null);
  const [copies, setCopies] = useState(4);

  const applyRef = useRef((force?: boolean) => {
    const track = trackRef.current;
    const period = periodRef.current;
    if (!track || period === 0) return;
    const current = currentRef.current;
    const ring = ringRef.current;
    const count = track.children.length;
    const base = Math.floor(current / period) - 1;
    if ((force !== undefined && force) || base !== ring.base || period !== ring.period) {
      for (let i = 0; i < count; i++) {
        const slot = base + mod(i - base, count);
        const child = track.children[i] as HTMLElement;
        const transform = `translateY(${slot * period - (child.offsetTop - track.offsetTop)}px)`;
        if (child.style.transform !== transform) child.style.transform = transform;
      }
      ring.base = base;
      ring.period = period;
    }
    const dpr = window.devicePixelRatio || 1;
    const transform = `translate3d(0, ${-Math.round(current * dpr) / dpr}px, 0)`;
    if (track.style.transform !== transform) track.style.transform = transform;
  });
  const apply = applyRef.current;

  useLayoutEffect(() => {
    const root = rootRef.current;
    const track = trackRef.current;
    if (!root || !track) return;

    const tick = (time: number) => {
      rafRef.current = null;
      const period = periodRef.current;
      if (period === 0) return;
      const last = lastTimeRef.current;
      const delta = last === null ? FRAME_MS : Math.min(time - last, 4 * FRAME_MS);
      lastTimeRef.current = time;
      let target = targetRef.current;
      let current = currentRef.current;
      const distance = target - current;
      current = Math.abs(distance) < 0.1 ? target : current + distance * (1 - 0.9 ** (delta / FRAME_MS));
      const span = period * track.children.length;
      if (current < 0 || current >= span) {
        const shift = Math.floor(current / span) * span;
        current -= shift;
        target -= shift;
      }
      currentRef.current = current;
      targetRef.current = target;
      apply();
      if (current === target) {
        lastTimeRef.current = null;
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    const start = () => {
      if (rafRef.current === null) {
        lastTimeRef.current = null;
        rafRef.current = requestAnimationFrame(tick);
      }
    };

    const scrollBy = (delta: number) => {
      targetRef.current = targetRef.current + delta;
      start();
    };

    const onWheel = (event: WheelEvent) => {
      if (event.ctrlKey || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
      event.preventDefault();
      const { deltaY, deltaMode } = event;
      scrollBy(deltaY * (deltaMode === 1 ? LINE_HEIGHT : deltaMode === 2 ? viewportRef.current || window.innerHeight : 1) * 1);
    };

    const onTouchStart = (event: TouchEvent) => {
      if (event.touches.length > 1) {
        touchRef.current = null;
        return;
      }
      const touch = event.touches[0];
      if (touch) touchRef.current = { id: touch.identifier, y: touch.clientY };
    };

    const onTouchMove = (event: TouchEvent) => {
      if (event.touches.length > 1) {
        touchRef.current = null;
        return;
      }
      event.preventDefault();
      const touch = event.touches[0];
      if (!touch) return;
      const previous = touchRef.current;
      if (!previous || previous.id !== touch.identifier) {
        touchRef.current = { id: touch.identifier, y: touch.clientY };
        return;
      }
      const delta = -(2 * (touch.clientY - previous.y));
      previous.y = touch.clientY;
      scrollBy(delta);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (target.isContentEditable || target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') {
        return;
      }
      const page = 0.9 * (viewportRef.current || window.innerHeight);
      const line = 3 * LINE_HEIGHT;
      let delta: number;
      switch (event.key) {
        case 'ArrowDown':
          delta = line;
          break;
        case 'ArrowUp':
          delta = -line;
          break;
        case 'PageDown':
          delta = page;
          break;
        case 'PageUp':
          delta = -page;
          break;
        case ' ':
          if (target.tagName === 'BUTTON' || target.tagName === 'A') return;
          delta = event.shiftKey ? -page : page;
          break;
        default:
          return;
      }
      event.preventDefault();
      scrollBy(delta);
    };

    const onFocusIn = (event: FocusEvent) => {
      const target = event.target;
      if (!(target instanceof HTMLElement) || target === root) return;
      const current = currentRef.current;
      const viewport = viewportRef.current;
      const rect = target.getBoundingClientRect();
      const top = rect.top - root.getBoundingClientRect().top + current;
      const bottom = top + rect.height;
      if (top < current) targetRef.current = top;
      else {
        if (!(bottom > current + viewport)) return;
        targetRef.current = bottom - viewport;
      }
      start();
    };

    const measure = () => {
      const first = track.children[0];
      const period = first ? first.getBoundingClientRect().height : 0;
      const viewport = root.clientHeight;
      const periodChanged = Math.abs(period - periodRef.current) > 0.05;
      const viewportChanged = Math.abs(viewport - viewportRef.current) > 0.05;
      if (periodChanged || viewportChanged) {
        periodRef.current = period;
        viewportRef.current = viewport;
        setCopies(period === 0 || viewport === 0 ? 4 : Math.min(12, Math.ceil(viewport / period) + 3));
        apply(true);
        start();
      }
    };

    const observer = new ResizeObserver(measure);
    observer.observe(root);
    if (track.children[0]) observer.observe(track.children[0]);
    measure();
    root.addEventListener('wheel', onWheel, { passive: false });
    root.addEventListener('touchstart', onTouchStart, { passive: false });
    root.addEventListener('touchmove', onTouchMove, { passive: false });
    root.addEventListener('keydown', onKeyDown);
    root.addEventListener('focusin', onFocusIn);
    return () => {
      observer.disconnect();
      root.removeEventListener('wheel', onWheel);
      root.removeEventListener('touchstart', onTouchStart);
      root.removeEventListener('touchmove', onTouchMove);
      root.removeEventListener('keydown', onKeyDown);
      root.removeEventListener('focusin', onFocusIn);
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [apply]);

  // Every render: re-park the copies and keep the clones out of the tab order.
  useLayoutEffect(() => {
    apply(true);
    const track = trackRef.current;
    if (!track) return;
    for (const clone of track.querySelectorAll(':scope > [aria-hidden="true"]')) {
      for (const element of clone.querySelectorAll<HTMLElement>('a[href], button, input, select, textarea, [tabindex]')) {
        element.tabIndex = -1;
      }
    }
  });

  return (
    <ScrollRootContext.Provider value={rootRef}>
      <div ref={rootRef} tabIndex={0} data-lenis-prevent className={cx('relative min-h-0 overflow-clip', className)}>
        <div ref={trackRef} className="will-change-transform">
          {Array.from({ length: copies }, (_, i) => (
            <div key={i} aria-hidden={i !== 0 || undefined} className="flex flex-col">
              {children}
            </div>
          ))}
        </div>
      </div>
    </ScrollRootContext.Provider>
  );
}
