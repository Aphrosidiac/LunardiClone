'use client';

// Ported from reference module 258223. Every primary mouse press anywhere plays "click-down";
// the release plays "click-up", held back so the pair is at least 100ms apart. Touch is silent.
// The synth is preloaded on idle.
import { useEffect, useRef } from 'react';
import { useWindowEvent } from '@/hooks/use-window-event';
import { loadSoundEngine, playSound } from '@/lib/sound';

function playClickUp() {
  playSound('click-up');
}

function preloadOnIdle() {
  if (window.requestIdleCallback) {
    const handle = window.requestIdleCallback(preload, { timeout: 2000 });
    return () => window.cancelIdleCallback(handle);
  }
  const handle = window.setTimeout(preload, 1000);
  return () => window.clearTimeout(handle);
}

function preload() {
  loadSoundEngine().catch(() => {});
}

export function InteractiveSounds() {
  const downAt = useRef<number | null>(null);
  const upTimer = useRef<number | undefined>(undefined);

  useEffect(preloadOnIdle, []);
  useEffect(() => () => window.clearTimeout(upTimer.current), []);

  const onRelease = () => {
    if (downAt.current === null) return;
    const wait = Math.max(0, 100 - (performance.now() - downAt.current));
    downAt.current = null;
    upTimer.current = window.setTimeout(playClickUp, wait);
  };

  const onPress = (event: PointerEvent) => {
    if (event.button !== 0 || event.pointerType === 'touch' || downAt.current !== null) return;
    window.clearTimeout(upTimer.current);
    downAt.current = performance.now();
    playSound('click-down');
  };

  useWindowEvent('pointerdown', onPress, true);
  useWindowEvent('pointerup', onRelease, true);
  useWindowEvent('pointercancel', onRelease, true);

  return null;
}
