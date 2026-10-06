'use client';

// Module 49606. Per-window fullscreen state, mirrored in the URL as `?f=<windowId>` so a
// fullscreen window survives reloads and can be linked to. Escape (capture phase) exits it.
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { createContext, Suspense, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useWindowEvent } from '@/hooks/use-window-event';

export type WindowContextValue = {
  fullscreen: boolean;
  prefetchFullscreen: () => void;
  toggleFullscreen: () => void;
  openFullscreen: () => void;
  closeFullscreen: () => void;
};

const WindowContext = createContext<WindowContextValue | null>(null);

/** Reads `?f=` inside Suspense so the static prerender does not bail out on useSearchParams. */
function FullscreenParamSync({ target, onChange }: { target: string; onChange: (fullscreen: boolean) => void }) {
  const searchParams = useSearchParams();
  const active = searchParams.get('f') === target;
  useEffect(() => {
    onChange(active);
  }, [active, onChange]);
  return null;
}

export function WindowProvider({ children, windowId }: { children?: ReactNode; windowId?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const [fullscreen, setFullscreenState] = useState(false);
  const target = windowId ?? 'true';

  const setFullscreen = useCallback(
    (next: boolean) => {
      const params = new URLSearchParams(window.location.search);
      if (next) params.set('f', target);
      else params.delete('f');
      const url = params.toString() ? `${pathname}?${params.toString()}` : pathname;
      setFullscreenState(next);
      router.replace(url);
    },
    [pathname, router, target],
  );

  const toggleFullscreen = useCallback(() => setFullscreen(!fullscreen), [fullscreen, setFullscreen]);
  const prefetchFullscreen = useCallback(() => router.prefetch(`${pathname}?f=true`), [pathname, router]);
  const openFullscreen = useCallback(() => setFullscreen(true), [setFullscreen]);
  const closeFullscreen = useCallback(() => setFullscreen(false), [setFullscreen]);

  useWindowEvent(
    'keydown',
    (event) => {
      if (event.key === 'Escape' && fullscreen) {
        closeFullscreen();
        event.stopPropagation();
      }
    },
    true,
  );

  const value = useMemo(
    () => ({ fullscreen, prefetchFullscreen, toggleFullscreen, openFullscreen, closeFullscreen }),
    [closeFullscreen, fullscreen, openFullscreen, prefetchFullscreen, toggleFullscreen],
  );

  return (
    <WindowContext.Provider value={value}>
      <Suspense fallback={null}>
        <FullscreenParamSync target={target} onChange={setFullscreenState} />
      </Suspense>
      {children}
    </WindowContext.Provider>
  );
}

export function useWindow(): WindowContextValue {
  const context = useContext(WindowContext);
  if (!context) throw new Error('useWindow must be used within a WindowProvider');
  return context;
}
