'use client';

// Module 478055. The credits column of a work window; dropped below lg while the window is
// fullscreen so the media grid gets the whole screen.
import type { HTMLAttributes } from 'react';
import { useWindow } from '@/components/window/window-context';
import { useBreakpoint } from '@/hooks/use-breakpoint';

export function WorkDetails(props: HTMLAttributes<HTMLDivElement>) {
  const isDesktop = useBreakpoint('lg');
  const { fullscreen } = useWindow();
  if (!isDesktop && fullscreen) return null;
  return <div {...props} />;
}
