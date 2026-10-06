'use client';

// Module 539044. The not-found page as a crashed PC: 650ms of black with a blinking cursor, then a
// blue AMIBIOS "no boot device" screen; after 2150ms any key or click beeps and reboots to
// `redirectTo` 220ms later. Reduced motion skips straight to the rebootable BIOS screen.
import { useEffect, useRef, useState } from 'react';
import { SITE } from '@/content/site';
import { useReducedMotion } from '@/hooks/use-media-query';
import { useWindowEvent } from '@/hooks/use-window-event';
import { cx } from '@/lib/cx';
import { loadSoundEngine, playSound } from '@/lib/sound';

const BLACKOUT_MS = 650;
const REBOOT_READY_MS = 2150;
const REBOOT_DELAY_MS = 220;

const BIOS_LINES: { text: string; className?: string }[] = [
  { text: 'BIOS Date: 04/01/2024  22:09:51  Ver: 1.0.B3' },
  { text: `${SITE.name} Web Core(tm) CPU @ 3.40GHz`, className: 'text-white' },
  { text: 'Speed: 3400 MHz' },
  { text: '' },
  { text: 'Press DEL to run Setup,  F11 for Boot Menu', className: 'text-[#54fcfc]' },
  { text: 'Initializing USB Controllers ..  Done.', className: 'text-[#54fcfc]' },
  { text: '65536MB OK', className: 'text-white' },
  { text: '' },
  { text: 'Auto-Detecting SATA drives ...' },
  { text: '  SATA Port0 : None' },
  { text: '  SATA Port1 : None' },
  { text: '  SATA Port2 : None' },
  { text: '  SATA Port3 : None' },
  { text: '' },
  { text: 'Reboot and Select proper Boot device' },
  { text: 'or Insert Boot Media in selected Boot device and press a key' },
];

function BlinkingCursor({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cx('inline-block h-14 w-8 animate-blink align-middle motion-reduce:animate-none', className ?? 'bg-[#d4d4d4]')}
    />
  );
}

function noop() {}

export function CrashScreen({ redirectTo = '/' }: { redirectTo?: string }) {
  const reducedMotion = useReducedMotion();
  const [phase, setPhase] = useState<'blackout' | 'bios'>('blackout');
  const [canReboot, setCanReboot] = useState(false);

  useEffect(() => {
    if (reducedMotion) {
      setPhase('bios');
      setCanReboot(true);
      return;
    }
    const toBios = setTimeout(() => setPhase('bios'), BLACKOUT_MS);
    const toReady = setTimeout(() => setCanReboot(true), REBOOT_READY_MS);
    return () => {
      clearTimeout(toBios);
      clearTimeout(toReady);
    };
  }, [reducedMotion]);

  const rebooting = useRef(false);

  useEffect(() => {
    loadSoundEngine().catch(noop);
  }, []);

  const reboot = () => {
    if (!canReboot || rebooting.current) return;
    rebooting.current = true;
    playSound('beep');
    window.setTimeout(() => window.location.assign(redirectTo), REBOOT_DELAY_MS);
  };

  useWindowEvent('keydown', (event) => {
    if (!canReboot) return;
    event.preventDefault();
    reboot();
  });

  if (phase === 'blackout') {
    return (
      <div className="fixed inset-0 z-10000 flex bg-black p-24 font-mono text-[#d4d4d4] text-body-14 leading-[1.25] sm:p-40">
        <BlinkingCursor />
      </div>
    );
  }

  return (
    <div
      role="alert"
      aria-label="System BIOS. Press any key to reboot the page."
      onClick={reboot}
      className={cx(
        'fixed inset-0 z-10000 flex flex-col bg-[#0000a8] font-mono text-[#c6c6c6] text-body-14 leading-[1.25] selection:bg-[#d4d4d4] selection:text-[#0000a8]',
        canReboot && 'cursor-pointer',
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-6 motion-reduce:hidden"
        style={{
          backgroundImage: 'repeating-linear-gradient(to bottom, #fff 0, #fff 1px, transparent 1px, transparent 3px)',
        }}
      />
      <div className="relative flex shrink-0 items-center justify-between gap-12 bg-[#a8a8a8] px-16 py-4 font-semibold text-[#000080]">
        <span>AMIBIOS(C)2024 American Megatrends, Inc.</span>
        <span className="hidden sm:inline">v1.0.B3</span>
      </div>
      <div className="relative flex min-h-0 flex-1 flex-col overflow-auto px-16 py-16 sm:px-40 sm:py-24">
        <div className="wrap-break-word whitespace-pre-wrap">
          {BIOS_LINES.map((line, index) => (
            <div key={index} className={line.className}>
              {line.text.length > 0 ? line.text : ' '}
            </div>
          ))}
        </div>
      </div>
      <div className="relative flex shrink-0 items-center justify-between gap-12 bg-[#a8a8a8] px-16 py-4 text-[#000080]">
        {canReboot ? (
          <span className="flex items-center gap-8 font-semibold">
            <span>Press any key to reboot</span>
            <BlinkingCursor className="bg-[#000080]" />
          </span>
        ) : (
          <span className="flex items-center gap-8">
            <span className="opacity-70">Halted</span>
            <BlinkingCursor className="bg-[#000080]" />
          </span>
        )}
        <span className="hidden font-semibold sm:inline">F1: Setup   ESC: Boot Menu</span>
      </div>
    </div>
  );
}
