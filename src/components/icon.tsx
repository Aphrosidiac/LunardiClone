'use client';

// Module 471671. Every glyph is the reference's SVGR output, paths verbatim; the props passed to
// <Icon> are spread last so they win over each glyph's defaults (as SVGR's Object.assign does).
import type { SVGProps } from 'react';
import { cx } from '@/lib/cx';

type SvgProps = SVGProps<SVGSVGElement>;

const STROKE_24 = {
  xmlns: 'http://www.w3.org/2000/svg',
  fill: 'none',
  stroke: 'currentColor',
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  strokeWidth: 1.5,
  viewBox: '0 0 24 24',
} as const;

const OUTLINE_24 = {
  xmlns: 'http://www.w3.org/2000/svg',
  fill: 'none',
  'aria-hidden': 'true',
  viewBox: '0 0 24 24',
} as const;

const icons = {
  plus: (props: SvgProps) => (
    <svg {...STROKE_24} {...props}>
      <path d="M18 12h-6m0 0H6m6 0V6m0 6v6" />
    </svg>
  ),
  minus: (props: SvgProps) => (
    <svg {...STROKE_24} {...props}>
      <path d="M6 12h12" />
    </svg>
  ),
  close: (props: SvgProps) => (
    <svg {...STROKE_24} {...props}>
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  ),
  'folder-open': (props: SvgProps) => (
    <svg {...OUTLINE_24} {...props}>
      <path
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 19V6a1 1 0 0 1 1-1h4.032a1 1 0 0 1 .768.36l1.9 2.28a1 1 0 0 0 .768.36H16a1 1 0 0 1 1 1v1M3 19l3-8h15l-3 8z"
      />
    </svg>
  ),
  'folder-closed': (props: SvgProps) => (
    <svg {...OUTLINE_24} {...props}>
      <path
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M13.5 8H4m0-2v13a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V9a1 1 0 0 0-1-1h-5.032a1 1 0 0 1-.768-.36l-1.9-2.28a1 1 0 0 0-.768-.36H5a1 1 0 0 0-1 1"
      />
    </svg>
  ),
  file: (props: SvgProps) => (
    <svg {...OUTLINE_24} {...props}>
      <path
        stroke="currentColor"
        strokeLinejoin="round"
        d="M10 3v4a1 1 0 0 1-1 1H5m14-4v16a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V7.914a1 1 0 0 1 .293-.707l3.914-3.914A1 1 0 0 1 9.914 3H18a1 1 0 0 1 1 1Z"
      />
    </svg>
  ),
  info: (props: SvgProps) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" {...props}>
      <g fill="currentColor">
        <circle cx={12} cy={7.25} r={1.25} />
        <path d="M11 10h2v8h-2z" />
      </g>
    </svg>
  ),
  search: (props: SvgProps) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 50 50" {...props}>
      <path
        fill="currentColor"
        d="M21 3C11.621 3 4 10.621 4 20s7.621 17 17 17c3.71 0 7.14-1.195 9.938-3.219l13.156 13.125 2.812-2.812-13-13.032A16.92 16.92 0 0 0 38 20c0-9.379-7.621-17-17-17m0 2c8.297 0 15 6.703 15 15s-6.703 15-15 15S6 28.297 6 20 12.703 5 21 5"
      />
    </svg>
  ),
  email: (props: SvgProps) => (
    <svg {...OUTLINE_24} {...props}>
      <path stroke="currentColor" strokeLinejoin="round" strokeWidth={1.5} d="M1 3h22v18H1z" />
      <path stroke="currentColor" strokeLinejoin="round" strokeWidth={1.5} d="m1 3 11 9.5L23 3" />
    </svg>
  ),
  'arrow-right-down': (props: SvgProps) => (
    <svg xmlns="http://www.w3.org/2000/svg" aria-hidden="true" viewBox="0 0 512 512" {...props}>
      <path
        fill="currentColor"
        d="M19 58h377v321l74-74c3.198 1.599 4.664 2.416 7.024 4.797l1.698 1.699 1.794 1.824 1.866 1.875q2.938 2.959 5.868 5.93l3.992 4.02q4.886 4.92 9.758 9.855c-5.514 6.714-11.643 12.777-17.789 18.902l-3.579 3.58q-4.834 4.833-9.674 9.661-5.065 5.057-10.126 10.118-9.575 9.57-19.155 19.134a72539 72539 0 0 0-21.817 21.795Q397.435 440.6 375 463c-3.86-1.588-6.298-4.051-9.227-6.986l-1.557-1.552c-1.72-1.716-3.432-3.44-5.145-5.164l-3.696-3.695a6534 6534 0 0 1-10.022-10.047q-5.235-5.252-10.478-10.494-9.923-9.934-19.836-19.879a39158 39158 0 0 0-22.585-22.628A86246 86246 0 0 1 246 336q1.409-1.658 2.82-3.313l1.586-1.863c2.363-2.703 4.879-5.233 7.43-7.758l1.588-1.584q2.473-2.461 4.951-4.92l3.387-3.373q4.115-4.098 8.238-8.189c2.864 1.3 4.922 2.674 7.138 4.898l1.802 1.793 1.94 1.962 2.07 2.07q3.382 3.386 6.753 6.785l4.691 4.7a8994 8994 0 0 1 12.33 12.379q6.29 6.318 12.589 12.628A27962 27962 0 0 1 350 377c.687-41.438 1.112-82.874 1.316-124.316l.015-3.042c.085-17.068.157-34.136.231-51.204L352 102H19z"
      />
    </svg>
  ),
  theme: (props: SvgProps) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 50 50" {...props}>
      <path
        fill="currentColor"
        d="M5 5h40v40H5zm2 2v36h36V7zm7 7h4v4h-4zm9 0h4v4h-4zm9 0h4v4h-4zm-18 9h4v4h-4zm9 0h4v4h-4zm9 0h4v4h-4zm-18 9h4v4h-4zm9 0h4v4h-4zm9 0h4v4h-4z"
      />
    </svg>
  ),
  'sound-on': (props: SvgProps) => (
    <svg {...OUTLINE_24} {...props}>
      <path stroke="currentColor" strokeLinejoin="round" strokeWidth={1.5} d="M1 8h5l6-5v18l-6-5H1z" />
      <path stroke="currentColor" strokeWidth={1.5} d="M15.5 8.5a5 5 0 0 1 0 7m3-10a9 9 0 0 1 0 13" />
    </svg>
  ),
  'sound-off': (props: SvgProps) => (
    <svg {...OUTLINE_24} {...props}>
      <path stroke="currentColor" strokeLinejoin="round" strokeWidth={1.5} d="M1 8h5l6-5v18l-6-5H1z" />
      <path stroke="currentColor" strokeWidth={1.5} d="m16 9 6 6m0-6-6 6" />
    </svg>
  ),
  'cursors-on': (props: SvgProps) => (
    <svg {...OUTLINE_24} {...props}>
      <path stroke="currentColor" strokeLinejoin="round" strokeWidth={1.5} d="M5 2v17.5l4.6-4.4 3 6.9 3-1.3-3-6.8H19z" />
    </svg>
  ),
  'cursors-off': (props: SvgProps) => (
    <svg {...OUTLINE_24} {...props}>
      <path stroke="currentColor" strokeLinejoin="round" strokeWidth={1.5} d="M5 2v17.5l4.6-4.4 3 6.9 3-1.3-3-6.8H19z" />
      <path stroke="currentColor" strokeWidth={1.5} d="m2 2 20 20" />
    </svg>
  ),
} satisfies Record<string, (props: SvgProps) => React.JSX.Element>;

export type IconName = keyof typeof icons;

export type IconProps = SvgProps & { name: IconName };

export function Icon({ name, className, ...props }: IconProps) {
  const Glyph = icons[name];
  if (!Glyph) return null;
  return <Glyph aria-hidden className={cx('size-[1em] shrink-0', className)} {...props} />;
}
