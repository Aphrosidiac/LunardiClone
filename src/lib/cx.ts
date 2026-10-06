// Modules 801335 + 207670: the reference `cx` is cva's `cx` with an `onComplete` hook that runs
// the clsx output through an extended tailwind-merge. The extension teaches tailwind-merge that
// the custom `text-title*` / `text-subtitle*` / `text-body*` / `text-caption*` utilities are font
// sizes (so `text-body-14` conflicts with `text-body-10`, but not with `text-theme-fg`).
import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: [(value: string) => ['title', 'subtitle', 'body', 'caption'].some((prefix) => value.startsWith(prefix))],
    },
  },
});

export type { ClassValue };

export function cx(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
