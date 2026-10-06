'use client';

// Ported from reference module 113981. Cycles the palettes defined in globals.css
// (`:root[data-theme=…]`); the choice persists in localStorage `theme`, which the inline head
// script in the root layout applies before first paint.
import { useCallback, useEffect } from 'react';
import { Icon } from '@/components/icon';
import { throttle } from '@/lib/utils';
import { track } from '@/lib/track';
import { KeyHint, useHotkey } from './key-hint';

export const THEMES = ['default', 'matrix', 'amber', 'solarized-dark', 'monokai', 'nord', 'dracula'];

const trackToggle = throttle(() => track('toggle_theme'), 2000);

export function ThemeSwitcher() {
  useEffect(() => {
    try {
      const theme = localStorage.getItem('theme');
      if (theme && THEMES.includes(theme)) document.documentElement.setAttribute('data-theme', theme);
    } catch {}
  }, []);

  const cycle = useCallback(() => {
    trackToggle();
    try {
      const current = document.documentElement.getAttribute('data-theme') || 'default';
      const next = THEMES[(THEMES.indexOf(current) + 1) % THEMES.length] || 'default';
      localStorage.setItem('theme', next);
      document.documentElement.setAttribute('data-theme', next);
      document.dispatchEvent(new CustomEvent('theme-change', { detail: next }));
    } catch {}
  }, []);

  useHotkey('T', cycle);

  return (
    <button
      type="button"
      className="group flex h-full cursor-pointer items-center gap-8 p-4 text-theme-fg"
      onClick={cycle}
      aria-label="Toggle theme"
      title="Toggle theme (press T)"
    >
      <span className="flex h-18 w-18 select-none items-center justify-center">
        <Icon name="theme" />
      </span>
      <KeyHint letter="T" />
      <span className="keyboard:hidden font-semibold text-theme-fg/50 group-hover:text-theme-fg">Theme</span>
    </button>
  );
}
