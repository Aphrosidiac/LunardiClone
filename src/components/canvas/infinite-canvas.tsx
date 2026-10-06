'use client';

// Module 174830. An endless, pannable, zoomable canvas. Items are laid out once on a jittered grid
// (cells filled centre-out, a hash-seeded offset inside each cell) that forms one "tile"; the tile
// repeats forever, and each item is shifted by whole tiles so it always sits in the copy nearest
// the camera. All motion runs in a single rAF loop that writes transforms directly to the DOM.
import { useCallback, useId, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { preload } from 'react-dom';
import { Link } from '@/components/link';
import { useReducedMotion } from '@/hooks/use-media-query';
import { useWindowEvent } from '@/hooks/use-window-event';
import { cx } from '@/lib/cx';

export type CanvasItem = {
  key: string;
  href: string;
  label: string;
  /** width / height of the media; sizes the item's box. */
  aspectRatio: number;
  /** Image URL preloaded on hover/focus (the detail view's texture). */
  preloadImage?: string;
  children: ReactNode;
};

type InfiniteCanvasProps = {
  items: CanvasItem[];
  className?: string;
  /** aria-label of the canvas section. */
  label?: string;
  /** Plural noun used in the screen-reader description ("Infinite canvas of …"). */
  itemsLabel?: string;
};

type PlacedItem = CanvasItem & {
  originX: number;
  originY: number;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
};

/** Base edge of an item: a square item is 156×156; others keep the same area. */
const ITEM_SIZE = 156;
/** Horizontal/vertical gutter added to the largest item to size a grid cell. */
const CELL_GAP = 132;
/** Inset kept free on each side of an item inside its cell (12px each side). */
const CELL_INSET = 12;
/** The tile must cover the viewport at the minimum zoom, plus one item and this margin. */
const TILE_MARGIN = 48;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 2;
/** Zoom shown as "100%". */
const DEFAULT_ZOOM = 0.7;
/** Per-frame lerp of the rendered camera towards its target. */
const PAN_LERP = 0.12;
/** Per-frame lerp of the zoom, in log space. */
const ZOOM_LERP = 0.2;
const ZOOM_EPSILON = 6e-4;
const PAN_EPSILON = 0.01;
/** Arrow-key pan speed in screen px per frame, and its ease in/out. */
const KEY_PAN_SPEED = 16;
const KEY_PAN_ACCEL = 0.22;
const KEY_PAN_DECEL = 0.09;
const KEY_PAN_STOP = 0.1;
/** Pointer travel (px, either axis) before a press becomes a drag. */
const DRAG_THRESHOLD = 4;
/** Ctrl/⌘ + wheel zoom sensitivity. */
const WHEEL_ZOOM_SPEED = 0.006;
/** Keyboard +/- zoom step. */
const KEY_ZOOM_STEP = 1.2;
/** PageUp/PageDown pan, as a fraction of the canvas height. */
const PAGE_PAN = 0.9;
/** Stagger between items fading in on first paint. */
const REVEAL_STAGGER = 22;
/** deltaMode 1 (lines) → px. */
const LINE_HEIGHT = 100 / 6;

/** Deterministic hash → [0, 1). */
function hash01(seed: number) {
  let t = Math.imul(0x9e3779b9 ^ seed, 0x85ebca6b);
  t ^= t >>> 13;
  t = Math.imul(t, 0xc2b2ae35);
  return ((t ^= t >>> 16) >>> 0) / 0x100000000;
}

function layout(items: CanvasItem[], viewportWidth: number, viewportHeight: number) {
  const sized = items.map((item) => {
    const s = Math.sqrt(item.aspectRatio || 1);
    return { item, width: ITEM_SIZE * s, height: ITEM_SIZE / s };
  });
  const cols = Math.max(3, Math.ceil(Math.sqrt(sized.length)));
  const rows = Math.max(1, Math.ceil(sized.length / cols));
  const maxWidth = sized.reduce((max, s) => Math.max(max, s.width), 0);
  const maxHeight = sized.reduce((max, s) => Math.max(max, s.height), 0);
  const maxEdge = Math.max(maxWidth, maxHeight);
  const tileWidth = Math.max(cols * (maxWidth + CELL_GAP), viewportWidth / MIN_ZOOM + maxEdge + TILE_MARGIN);
  const tileHeight = Math.max(rows * (maxHeight + CELL_GAP), viewportHeight / MIN_ZOOM + maxEdge + TILE_MARGIN);
  const cellWidth = tileWidth / cols;
  const cellHeight = tileHeight / rows;
  const midCol = (cols - 1) / 2;
  const midRow = (rows - 1) / 2;
  // Cells ordered by distance from the centre, so the first items land in the middle.
  const order = Array.from({ length: cols * rows }, (_, i) => i).sort(
    (a, b) =>
      Math.hypot((a % cols) - midCol, Math.floor(a / cols) - midRow) -
      Math.hypot((b % cols) - midCol, Math.floor(b / cols) - midRow),
  );
  const placed: PlacedItem[] = sized.map(({ item, width, height }, index) => {
    const cell = order[index] ?? index;
    const row = Math.floor(cell / cols);
    const slackX = Math.max(0, cellWidth - width - 2 * CELL_INSET);
    const slackY = Math.max(0, cellHeight - height - 2 * CELL_INSET);
    const originX = (cell % cols) * cellWidth + CELL_INSET + slackX * hash01(31 * index + 2) - tileWidth / 2;
    const originY = row * cellHeight + CELL_INSET + slackY * hash01(31 * index + 3) - tileHeight / 2;
    return {
      ...item,
      originX,
      originY,
      width,
      height,
      centerX: originX + width / 2,
      centerY: originY + height / 2,
    };
  });
  return { placed, tileWidth, tileHeight };
}

export function InfiniteCanvas({ items, className, label, itemsLabel }: InfiniteCanvasProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const worldRef = useRef<HTMLDivElement>(null);
  const zoomLabelRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const itemOffsets = useRef<({ kx: number; ky: number } | undefined)[]>([]);
  const frameRef = useRef<number | null>(null);
  /** Camera target (canvas units). */
  const target = useRef({ x: 0, y: 0 });
  /** Rendered camera, eased towards `target`. */
  const camera = useRef({ x: 0, y: 0 });
  const zoom = useRef(DEFAULT_ZOOM);
  const zoomTarget = useRef(DEFAULT_ZOOM);
  /** Screen point the zoom is anchored on. */
  const zoomAnchor = useRef({ x: 0, y: 0 });
  const measured = useRef(false);
  const revealed = useRef(false);
  const lastFrame = useRef({ x: NaN, y: NaN, z: NaN });
  const rect = useRef({ left: 0, top: 0, width: 0, height: 0 });
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const drag = useRef({ id: null as number | null, startX: 0, startY: 0, lastX: 0, lastY: 0, panning: false });
  const pinch = useRef({ active: false, startDistance: 0, startZoom: 1, lastMidX: 0, lastMidY: 0 });
  const keys = useRef(new Set<string>());
  const keyVelocity = useRef({ x: 0, y: 0 });
  /** Set once a gesture moved the canvas, so the click that ends it does not open an item. */
  const suppressClick = useRef(false);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const reducedMotion = useReducedMotion();
  const descriptionId = useId();

  const { placed, tileWidth, tileHeight } = useMemo(() => layout(items, size.width, size.height), [items, size]);

  const measure = useCallback(() => {
    const el = sectionRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    rect.current = { left: r.left, top: r.top, width: r.width, height: r.height };
    setSize((prev) => (prev.width === r.width && prev.height === r.height ? prev : { width: r.width, height: r.height }));
  }, []);

  useLayoutEffect(() => {
    measure();
  }, [measure]);
  useWindowEvent('resize', measure);

  useLayoutEffect(() => {
    itemOffsets.current = [];
    itemRefs.current.length = placed.length;
    for (const el of itemRefs.current) if (el) el.style.transform = '';
    lastFrame.current = { x: NaN, y: NaN, z: NaN };
  }, [placed]);

  useLayoutEffect(() => {
    if (!measured.current && size.width !== 0) measured.current = true;
  }, [size.width]);

  const tick = useCallback(() => {
    const world = worldRef.current;
    if (!world || tileWidth === 0 || tileHeight === 0) {
      frameRef.current = requestAnimationFrame(tick);
      return;
    }
    const tgt = target.current;
    const cam = camera.current;
    const lerp = reducedMotion ? 1 : PAN_LERP;
    const held = keys.current;
    const velocity = keyVelocity.current;

    if (held.size > 0 || velocity.x !== 0 || velocity.y !== 0) {
      const dx = Number(held.has('ArrowRight')) - Number(held.has('ArrowLeft'));
      const dy = Number(held.has('ArrowDown')) - Number(held.has('ArrowUp'));
      const length = Math.hypot(dx, dy);
      const speed = KEY_PAN_SPEED / zoom.current;
      const vx = length > 0 ? (dx / length) * speed : 0;
      const vy = length > 0 ? (dy / length) * speed : 0;
      if (reducedMotion) {
        velocity.x = vx;
        velocity.y = vy;
      } else {
        const ease = length > 0 ? KEY_PAN_ACCEL : KEY_PAN_DECEL;
        velocity.x += (vx - velocity.x) * ease;
        velocity.y += (vy - velocity.y) * ease;
        if (vx === 0 && Math.abs(velocity.x) < KEY_PAN_STOP) velocity.x = 0;
        if (vy === 0 && Math.abs(velocity.y) < KEY_PAN_STOP) velocity.y = 0;
      }
      tgt.x += velocity.x;
      tgt.y += velocity.y;
      cam.x += velocity.x;
      cam.y += velocity.y;
    }

    cam.x = Math.abs(tgt.x - cam.x) < PAN_EPSILON ? tgt.x : cam.x + (tgt.x - cam.x) * lerp;
    cam.y = Math.abs(tgt.y - cam.y) < PAN_EPSILON ? tgt.y : cam.y + (tgt.y - cam.y) * lerp;

    const current = zoom.current;
    const wanted = zoomTarget.current;
    if (current !== wanted) {
      const from = Math.log(current);
      const to = Math.log(wanted);
      const next = reducedMotion || Math.abs(to - from) < ZOOM_EPSILON ? wanted : Math.exp(from + (to - from) * ZOOM_LERP);
      // Keep the anchor point fixed on screen while the scale changes.
      const r = rect.current;
      const ax = zoomAnchor.current.x - (r.left + r.width / 2);
      const ay = zoomAnchor.current.y - (r.top + r.height / 2);
      const shiftX = ax * (1 / current - 1 / next);
      const shiftY = ay * (1 / current - 1 / next);
      cam.x += shiftX;
      cam.y += shiftY;
      tgt.x += shiftX;
      tgt.y += shiftY;
      zoom.current = next;
    }

    const scale = zoom.current;
    const last = lastFrame.current;
    const moved = last.x !== cam.x || last.y !== cam.y;
    const zoomed = last.z !== scale;
    if (moved || zoomed) {
      world.style.transform = `translate3d(${-cam.x * scale}px, ${-cam.y * scale}px, 0) scale(${scale})`;
      if (moved) {
        for (let i = 0; i < placed.length; i++) {
          const el = itemRefs.current[i];
          const item = placed[i];
          if (!el || !item) continue;
          // Wrap each item into the tile copy nearest the camera.
          const kx = Math.round((cam.x - item.centerX) / tileWidth);
          const ky = Math.round((cam.y - item.centerY) / tileHeight);
          const prev = itemOffsets.current[i];
          if (prev && prev.kx === kx && prev.ky === ky) continue;
          itemOffsets.current[i] = { kx, ky };
          el.style.transform = `translate3d(${kx * tileWidth}px, ${ky * tileHeight}px, 0)`;
        }
      }
      if (zoomed && zoomLabelRef.current) zoomLabelRef.current.textContent = `${Math.round((scale / DEFAULT_ZOOM) * 100)}%`;
      last.x = cam.x;
      last.y = cam.y;
      last.z = scale;
    }

    if (measured.current && !revealed.current) {
      revealed.current = true;
      for (let i = 0; i < placed.length; i++) {
        const el = itemRefs.current[i];
        if (!el) continue;
        if (reducedMotion) el.style.opacity = '1';
        else
          setTimeout(() => {
            el.style.opacity = '1';
          }, REVEAL_STAGGER * i);
      }
    }

    frameRef.current = requestAnimationFrame(tick);
  }, [placed, tileWidth, tileHeight, reducedMotion]);

  useLayoutEffect(() => {
    frameRef.current = requestAnimationFrame(tick);
    return () => {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    };
  }, [tick]);

  const zoomTo = useCallback((value: number, anchorX: number, anchorY: number) => {
    zoomTarget.current = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value));
    zoomAnchor.current.x = anchorX;
    zoomAnchor.current.y = anchorY;
  }, []);

  const onWheel = useCallback(
    (event: WheelEvent) => {
      event.preventDefault();
      if (event.ctrlKey || event.metaKey) {
        zoomTo(zoomTarget.current * Math.exp(-(WHEEL_ZOOM_SPEED * event.deltaY)), event.clientX, event.clientY);
        return;
      }
      const unit =
        (event.deltaMode === 1 ? LINE_HEIGHT : event.deltaMode === 2 ? rect.current.height || window.innerHeight : 1) /
        zoom.current;
      target.current.x += event.deltaX * unit;
      target.current.y += event.deltaY * unit;
    },
    [zoomTo],
  );

  // Safari trackpad pinch.
  const onGestureStart = useCallback((event: Event) => {
    event.preventDefault();
    pinch.current.startZoom = zoomTarget.current;
  }, []);

  const onGestureChange = useCallback(
    (event: Event) => {
      event.preventDefault();
      const e = event as Event & { scale: number; clientX: number; clientY: number };
      zoomTo(pinch.current.startZoom * e.scale, e.clientX, e.clientY);
    },
    [zoomTo],
  );

  const onPointerDown = useCallback((event: PointerEvent) => {
    if (event.button !== 0 && event.button !== -1) return;
    const active = pointers.current;
    active.set(event.pointerId, { x: event.clientX, y: event.clientY });
    (event.target as Element).setPointerCapture?.(event.pointerId);
    if (active.size >= 2) {
      const [a, b] = [...active.values()];
      if (a && b) {
        pinch.current.active = true;
        pinch.current.startDistance = Math.hypot(a.x - b.x, a.y - b.y);
        pinch.current.startZoom = zoomTarget.current;
        pinch.current.lastMidX = (a.x + b.x) / 2;
        pinch.current.lastMidY = (a.y + b.y) / 2;
      }
      drag.current.panning = false;
      suppressClick.current = true;
      return;
    }
    const d = drag.current;
    d.id = event.pointerId;
    d.startX = event.clientX;
    d.startY = event.clientY;
    d.lastX = event.clientX;
    d.lastY = event.clientY;
    d.panning = false;
    suppressClick.current = false;
  }, []);

  const onPointerMove = useCallback(
    (event: PointerEvent) => {
      const active = pointers.current;
      const point = active.get(event.pointerId);
      if (!point) return;
      point.x = event.clientX;
      point.y = event.clientY;

      if (pinch.current.active && active.size >= 2) {
        const [a, b] = [...active.values()];
        if (!a || !b) return;
        const distance = Math.hypot(a.x - b.x, a.y - b.y);
        const midX = (a.x + b.x) / 2;
        const midY = (a.y + b.y) / 2;
        if (pinch.current.startDistance > 0) zoomTo((pinch.current.startZoom * distance) / pinch.current.startDistance, midX, midY);
        const scale = zoom.current;
        const dx = (midX - pinch.current.lastMidX) / scale;
        const dy = (midY - pinch.current.lastMidY) / scale;
        camera.current.x -= dx;
        camera.current.y -= dy;
        target.current.x -= dx;
        target.current.y -= dy;
        pinch.current.lastMidX = midX;
        pinch.current.lastMidY = midY;
        return;
      }

      const d = drag.current;
      if (d.id !== event.pointerId) return;
      if (!d.panning) {
        if (!(Math.abs(event.clientX - d.startX) > DRAG_THRESHOLD || Math.abs(event.clientY - d.startY) > DRAG_THRESHOLD)) return;
        d.panning = true;
        suppressClick.current = true;
        if (sectionRef.current) sectionRef.current.style.cursor = 'grabbing';
      }
      const dx = event.clientX - d.lastX;
      const dy = event.clientY - d.lastY;
      d.lastX = event.clientX;
      d.lastY = event.clientY;
      const scale = zoom.current;
      target.current.x -= dx / scale;
      target.current.y -= dy / scale;
    },
    [zoomTo],
  );

  const onPointerUp = useCallback((event: PointerEvent) => {
    const active = pointers.current;
    if (!active.delete(event.pointerId)) return;
    (event.target as Element).releasePointerCapture?.(event.pointerId);
    if (pinch.current.active) {
      if (active.size < 2) pinch.current.active = false;
      // The finger left on the glass continues as a pan.
      const remaining = [...active.entries()][0];
      if (remaining) {
        const [id, p] = remaining;
        const d = drag.current;
        d.id = id;
        d.startX = p.x;
        d.startY = p.y;
        d.lastX = p.x;
        d.lastY = p.y;
        d.panning = true;
      }
      return;
    }
    const d = drag.current;
    if (d.id === event.pointerId) {
      d.id = null;
      sectionRef.current?.style.removeProperty('cursor');
      d.panning = false;
    }
  }, []);

  const onClickCapture = useCallback((event: MouseEvent) => {
    if (!suppressClick.current) return;
    suppressClick.current = false;
    event.preventDefault();
    event.stopPropagation();
  }, []);

  const onKeyDown = useCallback(
    (event: KeyboardEvent) => {
      const el = event.target as HTMLElement;
      if (el.isContentEditable || el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT') return;
      const r = rect.current;
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      switch (event.key) {
        case '+':
        case '=':
          event.preventDefault();
          zoomTo(KEY_ZOOM_STEP * zoomTarget.current, cx, cy);
          return;
        case '-':
        case '_':
          event.preventDefault();
          zoomTo(zoomTarget.current / KEY_ZOOM_STEP, cx, cy);
          return;
        case '0':
          event.preventDefault();
          zoomTo(DEFAULT_ZOOM, cx, cy);
          return;
      }
      switch (event.key) {
        case 'ArrowLeft':
        case 'ArrowRight':
        case 'ArrowUp':
        case 'ArrowDown':
          event.preventDefault();
          keys.current.add(event.key);
          return;
      }
      const page = PAGE_PAN * (r.height || window.innerHeight);
      switch (event.key) {
        case 'PageUp':
          event.preventDefault();
          target.current.y -= page / zoom.current;
          return;
        case 'PageDown':
          event.preventDefault();
          target.current.y += page / zoom.current;
          return;
      }
    },
    [zoomTo],
  );

  const onKeyUp = useCallback((event: KeyboardEvent) => {
    keys.current.delete(event.key);
  }, []);
  useWindowEvent('keyup', onKeyUp);
  useWindowEvent('blur', () => keys.current.clear());

  // Keyboard focus moving onto an item pans it to the centre.
  const onFocusIn = useCallback((event: FocusEvent) => {
    if (!document.documentElement.hasAttribute('data-keyboard-focus')) return;
    const section = sectionRef.current;
    const item = (event.target as Element | null)?.closest?.('[data-canvas-item]');
    if (!section || !(item instanceof HTMLElement)) return;
    const s = section.getBoundingClientRect();
    const i = item.getBoundingClientRect();
    const scale = zoom.current;
    const dx = i.left + i.width / 2 - (s.left + s.width / 2);
    const dy = i.top + i.height / 2 - (s.top + s.height / 2);
    target.current.x = camera.current.x + dx / scale;
    target.current.y = camera.current.y + dy / scale;
  }, []);

  useLayoutEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const prevent = (event: Event) => {
      event.preventDefault();
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('gesturestart', onGestureStart, { passive: false });
    el.addEventListener('gesturechange', onGestureChange, { passive: false });
    el.addEventListener('gestureend', prevent, { passive: false });
    el.addEventListener('pointerdown', onPointerDown);
    el.addEventListener('click', onClickCapture, true);
    el.addEventListener('keydown', onKeyDown);
    el.addEventListener('focusin', onFocusIn);
    el.addEventListener('dragstart', prevent);
    document.addEventListener('pointermove', onPointerMove);
    document.addEventListener('pointerup', onPointerUp);
    document.addEventListener('pointercancel', onPointerUp);
    return () => {
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('gesturestart', onGestureStart);
      el.removeEventListener('gesturechange', onGestureChange);
      el.removeEventListener('gestureend', prevent);
      el.removeEventListener('pointerdown', onPointerDown);
      el.removeEventListener('click', onClickCapture, true);
      el.removeEventListener('keydown', onKeyDown);
      el.removeEventListener('focusin', onFocusIn);
      el.removeEventListener('dragstart', prevent);
      document.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('pointerup', onPointerUp);
      document.removeEventListener('pointercancel', onPointerUp);
    };
  }, [onWheel, onGestureStart, onGestureChange, onPointerDown, onClickCapture, onKeyDown, onFocusIn, onPointerMove, onPointerUp]);

  if (items.length === 0)
    return (
      <div className={cx('grid size-full place-items-center', className)}>
        <p>Coming soon</p>
      </div>
    );

  return (
    <section
      ref={sectionRef}
      aria-label={label}
      aria-describedby={descriptionId}
      tabIndex={0}
      className={cx(
        'relative isolate size-full min-h-0 cursor-grab touch-none select-none overflow-clip overscroll-none outline-none focus-visible:ring-0',
        className,
      )}
    >
      <p id={descriptionId} className="sr-only">
        Infinite canvas of {itemsLabel}. Drag or use the arrow keys to pan; pinch, Ctrl and scroll, or the plus and minus
        keys to zoom; press Tab to move through the items.
      </p>
      <div ref={worldRef} className="absolute top-1/2 left-1/2 origin-top-left will-change-transform">
        {placed.map((item, index) => {
          const warm = item.preloadImage
            ? () => preload(item.preloadImage!, { as: 'image', crossOrigin: 'anonymous' })
            : undefined;
          return (
            <Link
              key={item.key}
              ref={(el: HTMLAnchorElement | null) => {
                itemRefs.current[index] = el;
              }}
              href={item.href}
              aria-label={item.label}
              data-canvas-item
              scroll={false}
              onMouseEnter={warm}
              onFocus={warm}
              className="group absolute block opacity-0"
              style={{ left: item.originX, top: item.originY, width: item.width, height: item.height }}
            >
              <div className="size-full overflow-hidden bg-theme-fg/10 group-hover:scale-[1.03] group-focus-visible:scale-[1.03]">
                {item.children}
              </div>
            </Link>
          );
        })}
      </div>
      <div
        ref={zoomLabelRef}
        aria-hidden
        className="pointer-events-none absolute right-3 bottom-3 select-none font-mono text-caption text-theme-fg/40 tabular-nums"
      >
        100%
      </div>
    </section>
  );
}
