'use client';

// Ported from reference modules 317330 (KeyHint) and 754615 (useHotkey).
import { useEffect, useEffectEvent } from 'react';

export function KeyHint({ letter }: { letter: string }) {
  return (
    <kbd className="hidden h-18 items-center gap-4 rounded-4 border border-theme-fg/30 px-4 group-hover:border-theme-fg xl:keyboard:flex">
      <span className="block">{letter}</span>
    </kbd>
  );
}

const TEXT_ENTRY = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

/** Bare-letter shortcut (no modifiers), ignored while typing in a field. */
export function useHotkey(letter: string, handler: () => void) {
  const onHotkey = useEffectEvent(handler);
  const code = `Key${letter.toUpperCase()}`;
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code !== code || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      const target = event.target;
      if (target instanceof HTMLElement && (target.isContentEditable || TEXT_ENTRY.has(target.tagName))) return;
      event.preventDefault();
      onHotkey();
    };
    document.documentElement.addEventListener('keydown', onKeyDown);
    return () => document.documentElement.removeEventListener('keydown', onKeyDown);
  }, [code]);
}
