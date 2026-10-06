// Module 72440.
import { useEffect, useEffectEvent } from 'react';

export function useWindowEvent<K extends keyof WindowEventMap>(
  type: K,
  listener: (event: WindowEventMap[K]) => void,
  options?: boolean | AddEventListenerOptions,
): void {
  const handler = useEffectEvent(listener);
  useEffect(() => {
    const fn = (event: WindowEventMap[K]) => handler(event);
    window.addEventListener(type, fn, options);
    return () => window.removeEventListener(type, fn, options);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, options]);
}
