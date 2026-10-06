'use client';

// Module 747283.
import type { HTMLAttributes } from 'react';
import { cx } from '@/lib/cx';

export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cx('animate-pulse bg-theme-fg/10', className)} {...props} />;
}

export function LineSkeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <Skeleton className={cx('my-[0.15em] h-[1em]', className)} {...props} />;
}
