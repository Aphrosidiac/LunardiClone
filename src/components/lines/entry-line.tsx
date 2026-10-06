'use client';

// Module 465604. One row of a list window: a folder glyph (open while active) and a title, the
// whole row a link. Rows without children are a fixed 28px tall and truncate their title.
import type { ReactNode } from 'react';
import { Icon } from '@/components/icon';
import { Link, type LinkProps } from '@/components/link';
import { cx } from '@/lib/cx';

export type EntryLineProps = Omit<LinkProps, 'href' | 'title' | 'children'> & {
  title: string;
  href: string;
  active?: boolean;
  titleAs?: 'h1' | 'h2' | 'h3' | 'h4' | 'p' | 'span' | 'div';
  className?: string;
  children?: ReactNode;
};

export function EntryLine({
  title,
  href,
  active = false,
  titleAs: Title = 'h2',
  className,
  children,
  ...props
}: EntryLineProps) {
  return (
    <Link
      href={href}
      className={cx(
        'block w-full border-theme-fg/30 border-b py-4 text-left outline-none',
        !children && 'h-28',
        'hover:bg-theme-fg/10',
        active && 'bg-theme-fg/10',
        className,
      )}
      {...props}
    >
      <div className="flex items-start gap-4">
        <span className="flex h-lh shrink-0 items-center">
          <Icon name={active ? 'folder-open' : 'folder-closed'} />
        </span>
        <Title className={children ? undefined : 'truncate'}>{title}</Title>
      </div>
      {children}
    </Link>
  );
}
