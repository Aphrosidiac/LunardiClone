'use client';

// Ported from reference module 403352.
import { useRef } from 'react';
import { Icon } from '@/components/icon';
import { cx } from '@/lib/cx';
import { track } from '@/lib/track';
import { KeyHint, useHotkey } from './key-hint';

export function EmailLink({ email, source, className }: { email: string; source: string; className?: string }) {
  const inMobileMenu = source === 'mobile_menu';
  const ref = useRef<HTMLAnchorElement>(null);

  useHotkey('E', () => {
    if (!inMobileMenu) ref.current?.click();
  });

  return (
    <a
      ref={ref}
      href={`mailto:${email}`}
      className={cx('group flex items-center gap-8 p-4 text-theme-fg', className)}
      aria-label={`Email ${email}`}
      title={inMobileMenu ? undefined : `${email} (press E)`}
      onClick={() => track('email_click', { source })}
    >
      {!inMobileMenu && (
        <span className="flex h-18 w-18 select-none items-center justify-center">
          <Icon name="email" />
        </span>
      )}
      {inMobileMenu ? (
        <span className="font-semibold text-theme-fg/50 group-hover:text-theme-fg">{email}</span>
      ) : (
        <>
          <KeyHint letter="E" />
          <span className="keyboard:hidden font-semibold text-theme-fg/50 group-hover:text-theme-fg">Email</span>
        </>
      )}
    </a>
  );
}
