'use client';

// Module 819358. react-fast-marquee with the reference defaults (autoFill, speed 25, paused under
// reduced motion) and a loader shown until the marquee has measured and mounted.
import { useState, type ReactNode } from 'react';
import FastMarquee, { type MarqueeProps as FastMarqueeProps } from 'react-fast-marquee';
import { useReducedMotion } from '@/hooks/use-media-query';

export type MarqueeProps = FastMarqueeProps & {
  loader?: ReactNode;
};

export function Marquee({ className, loader, play, ...props }: MarqueeProps) {
  const [mounted, setMounted] = useState(false);
  const reducedMotion = useReducedMotion();
  const shouldPlay = play ?? !reducedMotion;

  return (
    <div className={className}>
      <FastMarquee
        autoFill
        speed={25}
        play={shouldPlay}
        onMount={() => setMounted(true)}
        style={{ opacity: Number(mounted), pointerEvents: mounted ? 'auto' : 'none' }}
        {...props}
      />
      {!mounted && loader}
    </div>
  );
}
