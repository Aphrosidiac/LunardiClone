'use client';

// Module 465942. A desktop window: a title bar (mono title on the left, controls on the right)
// over a scrollable body that runs its own Lenis instance. Draggable windows register with the
// WindowManager for z-ordering and move by their title bar; fullscreen pins the window to the
// viewport (8px inset) and traps focus until Escape or the minus control.
import Lenis from 'lenis';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type HTMLAttributes,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  type RefObject,
  type SyntheticEvent,
} from 'react';
import { Icon } from '@/components/icon';
import { useFocusTrap } from '@/hooks/use-focus-trap';
import { useIsomorphicEffect } from '@/hooks/use-isomorphic-effect';
import { useReducedMotion } from '@/hooks/use-media-query';
import { cx } from '@/lib/cx';
import { useWindow, WindowProvider } from './window-context';
import { WindowControl } from './window-control';
import { useWindowManager } from './window-manager';

/** One 60fps frame, used to seed Lenis' clock when its rAF loop restarts. */
const FRAME_MS = 1000 / 60;

export type WindowProps = Omit<HTMLAttributes<HTMLDivElement>, 'draggable'> & {
  /** Window id: z-order key, `?f=` fullscreen value and presence anchor. */
  id: string;
  /** Title-bar content, left (rendered in a truncating mono div). */
  left?: ReactNode;
  /** Title-bar controls, right (after the scroll progress and fullscreen control). */
  right?: ReactNode;
  /** Show the plus/minus fullscreen control. Default true. */
  allowFullscreen?: boolean;
  /** Drag by the title bar and take part in z-ordering. Default false. */
  draggable?: boolean;
  /** Initial stacking priority among draggable windows (higher starts in front). Default 0. */
  priority?: number;
  /** Ring progress indicator for the body's scroll position. Default false. */
  showScrollProgress?: boolean;
  children?: ReactNode;
};

function isInteractive(target: HTMLElement) {
  return target.tagName === 'A' || target.tagName === 'BUTTON' || !!target.closest('a') || !!target.closest('button');
}

type DraggableOptions = {
  disabled?: boolean;
  onDragStart?: (event: PointerEvent) => void;
  onDrag?: (event: PointerEvent, position: { x: number; y: number }) => void;
  onDragEnd?: (event: PointerEvent, position: { x: number; y: number }) => void;
};

/**
 * Pointer drag without a library: the trigger (title bar) starts the drag, the node moves by a
 * `translate()` appended to whatever transform it had when it first became visible. A click that
 * ends a real drag is swallowed (capture phase) so it does not activate anything under it.
 */
function useDraggable({ disabled = false, onDragStart, onDrag, onDragEnd }: DraggableOptions) {
  const [trigger, setTrigger] = useState<HTMLElement | null>(null);
  const [node, setNode] = useState<HTMLElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const position = useRef({ x: 0, y: 0 });
  const startPointer = useRef({ x: 0, y: 0 });
  const startPosition = useRef({ x: 0, y: 0 });
  const moved = useRef(false);
  const baseTransform = useRef('');
  const frame = useRef(0);

  const applyTransform = useCallback(() => {
    if (!node) return;
    const translate = `translate(${position.current.x}px, ${position.current.y}px)`;
    node.style.transform = baseTransform.current ? `${baseTransform.current} ${translate}` : translate;
  }, [node]);

  const onPointerDown = useCallback(
    (event: PointerEvent) => {
      if (disabled || !node || (event.button !== 0 && event.button !== -1)) return;
      const target = event.target as HTMLElement;
      if (isInteractive(target)) return;
      event.preventDefault();
      event.stopPropagation();
      startPointer.current = { x: event.clientX, y: event.clientY };
      startPosition.current = { ...position.current };
      setIsDragging(true);
      moved.current = false;
      target.setPointerCapture(event.pointerId);
      if (trigger) trigger.style.cursor = 'grabbing';
      onDragStart?.(event);
    },
    [disabled, node, onDragStart, trigger],
  );

  const onPointerMove = useCallback(
    (event: PointerEvent) => {
      if (!isDragging || !node) return;
      const dx = event.clientX - startPointer.current.x;
      const dy = event.clientY - startPointer.current.y;
      const next = { x: startPosition.current.x + dx, y: startPosition.current.y + dy };
      position.current = next;
      moved.current = true;
      if (frame.current) cancelAnimationFrame(frame.current);
      frame.current = requestAnimationFrame(applyTransform);
      onDrag?.(event, next);
    },
    [isDragging, node, onDrag, applyTransform],
  );

  const onPointerUp = useCallback(
    (event: PointerEvent) => {
      if (!isDragging) return;
      event.stopPropagation();
      setIsDragging(false);
      if (frame.current) cancelAnimationFrame(frame.current);
      const target = event.target as HTMLElement;
      if (target.releasePointerCapture) target.releasePointerCapture(event.pointerId);
      if (trigger && !disabled) trigger.style.cursor = 'grab';
      onDragEnd?.(event, position.current);
    },
    [disabled, isDragging, onDragEnd, trigger],
  );

  const reset = useCallback(() => {
    position.current = { x: 0, y: 0 };
    setIsDragging(false);
    startPointer.current = { x: 0, y: 0 };
    startPosition.current = { x: 0, y: 0 };
    if (node) node.style.transform = baseTransform.current || '';
  }, [node]);

  useEffect(() => {
    if (!trigger) return;
    const swallowClickAfterDrag = (event: MouseEvent) => {
      if (!moved.current) return;
      if (isInteractive(event.target as HTMLElement)) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
    };
    trigger.addEventListener('pointerdown', onPointerDown);
    trigger.addEventListener('click', swallowClickAfterDrag, true);
    return () => {
      trigger.removeEventListener('pointerdown', onPointerDown);
      trigger.removeEventListener('click', swallowClickAfterDrag, true);
    };
  }, [trigger, onPointerDown]);

  useEffect(() => {
    document.addEventListener('pointermove', onPointerMove);
    document.addEventListener('pointerup', onPointerUp);
    document.addEventListener('pointercancel', onPointerUp);
    return () => {
      document.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('pointerup', onPointerUp);
      document.removeEventListener('pointercancel', onPointerUp);
    };
  }, [onPointerMove, onPointerUp]);

  // Capture the node's own (CSS) transform once it is actually rendered, so dragging composes
  // with e.g. a centring translate instead of replacing it.
  useEffect(() => {
    if (!node) return;
    const captureBase = () => {
      const style = window.getComputedStyle(node);
      if (style.display === 'none' || style.visibility === 'hidden') return false;
      const transform = style.transform !== 'none' ? style.transform : '';
      baseTransform.current = transform;
      position.current = { x: 0, y: 0 };
      node.style.transform = transform;
      return true;
    };
    if (captureBase()) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry?.isIntersecting && captureBase()) observer.disconnect();
      },
      { threshold: 0 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [node]);

  useEffect(() => {
    if (!node || disabled) return;
    const previous = node.style.willChange;
    node.style.willChange = 'transform';
    return () => {
      node.style.willChange = previous;
    };
  }, [node, disabled]);

  useEffect(() => {
    if (!trigger) return;
    const previousCursor = trigger.style.cursor;
    const previousTouchAction = trigger.style.touchAction;
    trigger.style.touchAction = 'none';
    if (!disabled) trigger.style.cursor = 'grab';
    return () => {
      trigger.style.cursor = previousCursor;
      trigger.style.touchAction = previousTouchAction;
    };
  }, [trigger, disabled]);

  return { triggerRef: setTrigger, nodeRef: setNode, isDragging, reset };
}

/** Lenis on the window body, driven by an on-demand rAF loop that only runs while smoothing. */
function useBodySmoothScroll(bodyRef: RefObject<HTMLDivElement | null>) {
  const reducedMotion = useReducedMotion();
  useEffect(() => {
    const body = bodyRef.current;
    if (!body || reducedMotion) return;
    const lenis = new Lenis({
      wrapper: body,
      content: body,
      eventsTarget: body,
      allowNestedScroll: true,
      naiveDimensions: true,
    });
    let raf = 0;
    const tick = (time: number) => {
      if (lenis.time === 0) lenis.time = time - FRAME_MS;
      lenis.raf(time);
      raf = lenis.isSmooth ? requestAnimationFrame(tick) : 0;
    };
    lenis.on('virtual-scroll', () => {
      if (!raf) {
        lenis.time = 0;
        raf = requestAnimationFrame(tick);
      }
    });
    return () => {
      cancelAnimationFrame(raf);
      lenis.destroy();
    };
  }, [bodyRef, reducedMotion]);
}

const RING_CIRCUMFERENCE = 2 * Math.PI * 18;

function ScrollProgress({ progressRef }: { progressRef: RefObject<HTMLDivElement | null> }) {
  return (
    <div
      ref={progressRef}
      className="flex size-13 items-center justify-center"
      role="progressbar"
      aria-valuenow={0}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label="Scroll progress"
    >
      <svg viewBox="0 0 40 40" className="size-full text-theme-fg">
        <title>Scroll progress</title>
        <circle
          cx="20"
          cy="20"
          r={18}
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          className="text-theme-fg/50"
          transform="rotate(-90 20 20)"
        />
        <circle
          cx="20"
          cy="20"
          r={18}
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeDasharray={RING_CIRCUMFERENCE}
          style={{
            strokeDashoffset: `calc(${RING_CIRCUMFERENCE} - (var(--scroll-progress, 0) * ${RING_CIRCUMFERENCE}))`,
          }}
          strokeLinecap="round"
          className="text-theme-fg"
          transform="rotate(-90 20 20)"
        />
      </svg>
    </div>
  );
}

function WindowFrame({
  left,
  right,
  allowFullscreen = true,
  children,
  className,
  draggable = false,
  priority = 0,
  showScrollProgress = false,
  ...props
}: WindowProps) {
  const { fullscreen: fullscreenState, toggleFullscreen, prefetchFullscreen } = useWindow();
  const fullscreen = fullscreenState && allowFullscreen;
  const id = props.id;
  const { registerWindow, unregisterWindow, bringToFront } = useWindowManager();

  const windowRef = useRef<HTMLDivElement | null>(null);
  const titleBarRef = useRef<HTMLDivElement | null>(null);
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const progressRef = useRef<HTMLDivElement | null>(null);

  useIsomorphicEffect(() => {
    bodyRef.current?.scrollTo({ top: 0, behavior: 'instant' });
  }, []);

  useBodySmoothScroll(bodyRef);

  useEffect(() => {
    if (!draggable) return;
    const element = windowRef.current;
    if (!element) return;
    registerWindow(id, element, priority);
    return () => unregisterWindow(id);
  }, [id, registerWindow, unregisterWindow, priority, draggable]);

  // Pressing or focusing anywhere in a draggable window raises it, except on a title-bar control.
  const raiseOnInteract = (event: SyntheticEvent<HTMLDivElement>) => {
    if (!draggable || event.currentTarget !== windowRef.current) return;
    const target = event.target as HTMLElement;
    if (isInteractive(target) && titleBarRef.current?.contains(target)) return;
    bringToFront(id);
  };

  const { triggerRef, nodeRef, reset, isDragging } = useDraggable({
    disabled: fullscreen || !draggable,
    onDragStart: () => bringToFront(id),
  });
  const focusTrapRef = useFocusTrap(fullscreen);

  const windowRefCallback = useCallback(
    (node: HTMLDivElement | null) => {
      if (windowRef.current !== node) windowRef.current = node;
      nodeRef(node);
      focusTrapRef(node);
    },
    [focusTrapRef, nodeRef],
  );

  useEffect(() => {
    if (!showScrollProgress) return;
    const body = bodyRef.current;
    if (!body) return;
    const update = () => {
      const { scrollTop, scrollHeight, clientHeight } = body;
      const max = scrollHeight - clientHeight;
      if (max <= 0) {
        progressRef.current?.style.setProperty('--scroll-progress', '0');
        progressRef.current?.setAttribute('aria-valuenow', '0');
        return;
      }
      const progress = Math.min(1, Math.max(0, scrollTop / max));
      const percent = Math.round(100 * progress);
      progressRef.current?.style.setProperty('--scroll-progress', progress.toString());
      progressRef.current?.setAttribute('aria-valuenow', percent.toString());
    };
    let raf = 0;
    const onScroll = () => {
      if (!raf)
        raf = requestAnimationFrame(() => {
          raf = 0;
          update();
        });
    };
    update();
    body.addEventListener('scroll', onScroll, { passive: true });
    const resizeObserver = new ResizeObserver(update);
    resizeObserver.observe(body);
    return () => {
      body.removeEventListener('scroll', onScroll);
      if (raf) cancelAnimationFrame(raf);
      resizeObserver.disconnect();
    };
  }, [showScrollProgress]);

  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (draggable && (event.key === 'Enter' || event.key === ' ')) {
      if (event.target === event.currentTarget) event.preventDefault();
      bringToFront(id);
    }
  };

  const titleBarRefCallback = (node: HTMLDivElement | null) => {
    titleBarRef.current = node;
    triggerRef(node);
  };

  return (
    <div
      ref={windowRefCallback}
      data-presence-anchor={id}
      className={cx(
        'flex flex-col bg-theme-bg px-4 pb-4 ring-1 ring-theme-fg/30',
        fullscreen ? 'fixed! transform-none! inset-8! z-10 m-0! size-auto!' : 'relative',
        className,
      )}
      onMouseDown={raiseOnInteract}
      onFocus={raiseOnInteract}
      onKeyDown={onKeyDown}
      {...props}
    >
      <div className="flex h-26 shrink-0 items-center justify-between gap-4" ref={titleBarRefCallback}>
        <div className="truncate font-mono">{left}</div>
        <div className={cx('flex items-center gap-4', isDragging && 'pointer-events-none')}>
          {showScrollProgress && <ScrollProgress progressRef={progressRef} />}
          {allowFullscreen && (
            <WindowControl
              onMouseEnter={prefetchFullscreen}
              aria-label={fullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
              onClick={() => {
                toggleFullscreen?.();
                bringToFront(id);
                if (draggable) reset();
              }}
            >
              <Icon name={fullscreen ? 'minus' : 'plus'} className="size-full" />
            </WindowControl>
          )}
          {right}
        </div>
      </div>
      <div
        ref={bodyRef}
        className="relative isolate flex h-full flex-1 flex-col gap-4 overflow-clip overflow-y-auto rounded-2 p-4 ring-1 ring-theme-fg/30 [scrollbar-width:none]"
      >
        {children}
      </div>
    </div>
  );
}

export function Window(props: WindowProps) {
  return (
    <WindowProvider windowId={props.id}>
      <WindowFrame {...props} />
    </WindowProvider>
  );
}
