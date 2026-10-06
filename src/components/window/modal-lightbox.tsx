'use client';

// Module 408773. An always-open Lightbox for intercepted (modal) routes: closing navigates to
// `closeHref`, or back in history when there is none.
import { useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { Lightbox } from './lightbox';

export type ModalLightboxProps = {
  title: string;
  closeHref?: string;
  heading?: ReactNode;
  meta?: ReactNode;
  contentClickable?: boolean;
  children?: ReactNode;
};

export function ModalLightbox({ title, closeHref, heading, meta, contentClickable, children }: ModalLightboxProps) {
  const router = useRouter();
  const onClose = () => {
    if (closeHref) router.push(closeHref);
    else router.back();
  };
  return (
    <Lightbox
      open
      onClose={onClose}
      title={title}
      heading={heading}
      meta={meta}
      focusTrap
      contentClickable={contentClickable}
      className="size-full"
    >
      {children}
    </Lightbox>
  );
}
