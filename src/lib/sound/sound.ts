// Ported from reference module 440780. The synth (./clicks) is code-split and loaded on idle
// (InteractiveSounds) or on the first sound. The on/off preference lives in localStorage and is
// mirrored as `data-sound-off` on <html> (set before paint by SoundScript).
import type { SoundName } from './clicks';

/** localStorage key (reference: `sound`). SoundScript reads the same key. */
export const SOUND_STORAGE_KEY = 'ff-sound';

type Engine = typeof import('./clicks');

let engine: Engine | null = null;
let loading: Promise<Engine> | null = null;
let soundOn: boolean | null = null;
const listeners = new Set<() => void>();

export function loadSoundEngine() {
  return (loading ??= import('./clicks')
    .then((mod) => {
      engine = mod;
      return mod;
    })
    .catch((error) => {
      loading = null;
      throw error;
    }));
}

export function isSoundOn() {
  if (typeof window === 'undefined') return true;
  if (soundOn === null) {
    try {
      soundOn = localStorage.getItem(SOUND_STORAGE_KEY) !== 'off';
    } catch {
      soundOn = true;
    }
  }
  return soundOn;
}

export function playSound(name: SoundName) {
  if (typeof window === 'undefined' || !isSoundOn() || window.matchMedia('(pointer: coarse)').matches) return;
  if (engine) {
    engine.play(name);
    return;
  }
  loadSoundEngine()
    .then((mod) => mod.play(name))
    .catch(() => {});
}

export function setSoundOn(on: boolean) {
  soundOn = on;
  try {
    localStorage.setItem(SOUND_STORAGE_KEY, on ? 'on' : 'off');
  } catch {}
  document.documentElement.toggleAttribute('data-sound-off', !on);
  for (const listener of listeners) listener();
}

export function subscribeSound(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export type { SoundName };
