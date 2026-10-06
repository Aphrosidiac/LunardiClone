// Module 47686. iOS Safari zooms into any focused input under 16px; while an input is focused or
// touched this pins the viewport meta to maximum-scale=1, and restores the original on blur.
import { useCallback, useEffect, useMemo, useRef } from 'react';

const VIEWPORT_SELECTOR = 'meta[name="viewport"]';
const LOCKED_CONTENT = 'width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=1';

export function useIosViewportZoomGuard() {
  const originalContent = useRef<string | null | undefined>(undefined);
  const createdMeta = useRef(false);
  const restoreTimer = useRef<number | null>(null);

  const restore = useCallback(() => {
    const meta = document.head.querySelector<HTMLMetaElement>(VIEWPORT_SELECTOR);
    if (createdMeta.current) {
      meta?.remove();
      createdMeta.current = false;
      originalContent.current = undefined;
      return;
    }
    if (!meta || originalContent.current === undefined) return;
    const original = originalContent.current;
    originalContent.current = undefined;
    if (original === null) meta.removeAttribute('content');
    else {
      meta.setAttribute('content', original);
      meta.content = original;
    }
  }, []);

  const lock = useCallback(() => {
    let meta = document.head.querySelector<HTMLMetaElement>(VIEWPORT_SELECTOR);
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', 'viewport');
      meta.setAttribute('content', LOCKED_CONTENT);
      meta.content = LOCKED_CONTENT;
      document.head.appendChild(meta);
      createdMeta.current = true;
      return;
    }
    if (originalContent.current === undefined) originalContent.current = meta.getAttribute('content');
    meta.setAttribute('content', LOCKED_CONTENT);
    meta.content = LOCKED_CONTENT;
  }, []);

  const engage = useCallback(() => {
    if (restoreTimer.current !== null) {
      window.clearTimeout(restoreTimer.current);
      restoreTimer.current = null;
    }
    lock();
  }, [lock]);

  const onFocus = useCallback(() => engage(), [engage]);
  const onTouchStart = useCallback(() => engage(), [engage]);
  const onBlur = useCallback(() => {
    restoreTimer.current = window.setTimeout(() => {
      restoreTimer.current = null;
      restore();
    }, 0);
  }, [restore]);

  useEffect(
    () => () => {
      if (restoreTimer.current !== null) window.clearTimeout(restoreTimer.current);
      restore();
    },
    [restore],
  );

  return useMemo(() => ({ onFocus, onBlur, onTouchStart }), [onBlur, onFocus, onTouchStart]);
}
