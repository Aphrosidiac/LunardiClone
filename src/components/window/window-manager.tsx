'use client';

// Module 149763. Draggable windows register here; the manager keeps them in stacking order and
// writes `z-index: 5 + index` straight onto each element. Registration inserts a window before the
// first window with a higher `priority`, so high-priority windows start on top; pressing,
// focusing or dragging a window moves it to the end (front).
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

const Z_INDEX_BASE = 5;

export type WindowManagerContextValue = {
  registerWindow: (id: string, element: HTMLElement, priority?: number) => void;
  unregisterWindow: (id: string) => void;
  bringToFront: (id: string) => void;
  getZIndex: (id: string) => number;
};

const WindowManagerContext = createContext<WindowManagerContextValue | null>(null);

export function WindowManagerProvider({ children }: { children?: ReactNode }) {
  const [order, setOrder] = useState<string[]>([]);
  const elements = useRef(new Map<string, HTMLElement>());
  const priorities = useRef(new Map<string, number>());

  const registerWindow = useCallback((id: string, element: HTMLElement, priority = 0) => {
    elements.current.set(id, element);
    priorities.current.set(id, priority);
    setOrder((prev) => {
      const rest = prev.filter((other) => other !== id);
      let index = rest.length;
      for (let i = 0; i < rest.length; i++) {
        const other = rest[i];
        if (other && (priorities.current.get(other) ?? 0) > priority) {
          index = i;
          break;
        }
      }
      const next = [...rest];
      next.splice(index, 0, id);
      return next;
    });
  }, []);

  const unregisterWindow = useCallback((id: string) => {
    elements.current.delete(id);
    priorities.current.delete(id);
    setOrder((prev) => prev.filter((other) => other !== id));
  }, []);

  const bringToFront = useCallback((id: string) => {
    setOrder((prev) => (prev.includes(id) ? [...prev.filter((other) => other !== id), id] : prev));
  }, []);

  const getZIndex = useCallback(
    (id: string) => {
      const index = order.indexOf(id);
      return index === -1 ? Z_INDEX_BASE : Z_INDEX_BASE + index;
    },
    [order],
  );

  useEffect(() => {
    order.forEach((id, index) => {
      const element = elements.current.get(id);
      if (element) element.style.zIndex = (Z_INDEX_BASE + index).toString();
    });
  }, [order]);

  const value = useMemo(
    () => ({ registerWindow, unregisterWindow, bringToFront, getZIndex }),
    [registerWindow, unregisterWindow, bringToFront, getZIndex],
  );

  return <WindowManagerContext.Provider value={value}>{children}</WindowManagerContext.Provider>;
}

export function useWindowManager(): WindowManagerContextValue {
  const context = useContext(WindowManagerContext);
  if (!context) throw new Error('useWindowManager must be used within a WindowManagerProvider');
  return context;
}
