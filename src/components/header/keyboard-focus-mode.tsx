'use client';

// Ported from reference module 422414: `html[data-keyboard-focus]` while navigating with Tab,
// cleared on the next pointer press (globals.css draws the focus ring for text fields only then).
import { useEffect } from 'react';

const ATTRIBUTE = 'data-keyboard-focus';

export function KeyboardFocusMode() {
  useEffect(() => {
    const root = document.documentElement;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Tab') root.setAttribute(ATTRIBUTE, '');
    };
    const onPointerDown = () => {
      root.removeAttribute(ATTRIBUTE);
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, []);
  return null;
}
