'use client';

// Ported from reference module 852300.
import { useSyncExternalStore } from 'react';
import { Icon } from '@/components/icon';
import { isSoundOn, setSoundOn, subscribeSound, SOUND_STORAGE_KEY } from '@/lib/sound';
import { cx } from '@/lib/cx';
import { track } from '@/lib/track';
import { KeyHint, useHotkey } from './key-hint';

/** Head script: mark <html data-sound-off> before paint so the icon never flickers. */
export function SoundScript() {
  return (
    <script
      dangerouslySetInnerHTML={{
        __html: `
          try {
            if (localStorage.getItem('${SOUND_STORAGE_KEY}') === 'off') {
              document.documentElement.setAttribute('data-sound-off', '');
            }
          } catch (e) {}
        `,
      }}
    />
  );
}

function toggleSound() {
  const on = !isSoundOn();
  setSoundOn(on);
  track('toggle_sound', { on });
}

export function SoundToggle({ className }: { className?: string }) {
  const on = useSyncExternalStore(subscribeSound, isSoundOn, () => true);
  useHotkey('M', toggleSound);

  return (
    <button
      type="button"
      className={cx(
        'group flex cursor-pointer items-center gap-8 p-4 text-theme-fg [@media(pointer:coarse)]:hidden',
        className,
      )}
      onClick={toggleSound}
      aria-label="Sound"
      aria-pressed={on}
      title="Toggle sound (press M)"
    >
      <span className="flex h-18 w-18 select-none items-center justify-center">
        <Icon name="sound-on" className="in-data-sound-off:hidden" />
        <Icon name="sound-off" className="in-data-sound-off:block hidden" />
      </span>
      <KeyHint letter="M" />
      <span className="keyboard:hidden font-semibold text-theme-fg/50 group-hover:text-theme-fg">Sound</span>
    </button>
  );
}
