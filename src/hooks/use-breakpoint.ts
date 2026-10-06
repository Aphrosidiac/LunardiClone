// Module 537836.
import { screens, type Screen } from '@/lib/screens';
import { useMediaQuery } from './use-media-query';

export function useBreakpoint(breakpoint: Screen, initialValue = false): boolean {
  return useMediaQuery(`(min-width: ${screens[breakpoint]})`, initialValue);
}

export function useIsTouchDevice(initialValue = false): boolean {
  return useMediaQuery('(pointer: coarse)', initialValue);
}
