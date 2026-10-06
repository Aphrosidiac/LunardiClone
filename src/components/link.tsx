'use client';

// Module 374684.
import NextLink from 'next/link';
import type { ComponentProps } from 'react';
import { cx } from '@/lib/cx';

export type LinkProps = ComponentProps<typeof NextLink>;

export function Link({ href, className, ...props }: LinkProps) {
  return <NextLink href={href} draggable={false} className={cx('select-none', className)} {...props} />;
}
