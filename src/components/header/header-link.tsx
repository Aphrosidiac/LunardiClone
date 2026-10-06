'use client';

// Ported from reference module 472037. Active state is resolved after mount so the static HTML
// never bakes in one route's highlight.
import { useEffect, useState, type ComponentProps } from 'react';
import { usePathname } from 'next/navigation';
import { Link } from '@/components/link';
import { cx } from '@/lib/cx';

export function HeaderLink({ className, children, ...props }: ComponentProps<typeof Link>) {
  const pathname = usePathname();
  const [active, setActive] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    setActive(props.href === '/' ? pathname === '/' : pathname.startsWith(props.href.toString()));
  }, [pathname, props.href, mounted]);

  return (
    <Link
      draggable={false}
      className={cx('flex items-center p-4 font-semibold', active ? 'text-theme-fg' : 'text-theme-fg/50 hover:text-theme-fg', className)}
      {...props}
    >
      {children}
    </Link>
  );
}
