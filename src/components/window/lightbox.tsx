'use client';

// Module 458416. A full-viewport dialog portalled to <body>: title bar with optional mono meta and
// a close control, content centred below. Opening suspends background videos and locks body
// scroll; Escape (capture phase), a click outside any button, or Enter/Space on the dialog itself
// close it. Content ignores pointer events unless `contentClickable`.
import { useCallback, useEffect, useRef, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent as ReactMouseEvent, type ReactNode } from 'react';
import { Icon } from '@/components/icon';
import { Portal } from '@/components/portal';
import { suspendBackgroundVideos } from '@/components/media/background-video-gate';
import { useFocusTrap } from '@/hooks/use-focus-trap';
import { useWindowEvent } from '@/hooks/use-window-event';
import { useComposedRefs } from '@/lib/compose-refs';
import { cx } from '@/lib/cx';
import { WindowControl } from './window-control';

export type LightboxProps = {
  children?: ReactNode;
  open: boolean;
  onClose: () => void;
  /** Accessible name; also the visible heading unless `heading` is given. */
  title: string;
  heading?: ReactNode;
  meta?: ReactNode;
  className?: string;
  /** Trap Tab inside the dialog and autofocus its first control. Default false. */
  focusTrap?: boolean;
  /** Let clicks reach the content instead of closing the lightbox. Default false. */
  contentClickable?: boolean;
};

export function Lightbox({
  children,
  open,
  onClose,
  title,
  heading,
  meta,
  className,
  focusTrap = false,
  contentClickable = false,
}: LightboxProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const focusTrapRef = useFocusTrap(focusTrap && open);
  const ref = useComposedRefs<HTMLDivElement>(dialogRef, focusTrap ? focusTrapRef : null);
  const releaseVideos = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!open) return;
    releaseVideos.current = suspendBackgroundVideos();
    return () => {
      releaseVideos.current?.();
      releaseVideos.current = null;
    };
  }, [open]);

  const close = useCallback(() => {
    releaseVideos.current?.();
    releaseVideos.current = null;
    onClose();
  }, [onClose]);

  useWindowEvent(
    'keydown',
    (event) => {
      if (event.key === 'Escape' && open) close();
    },
    true,
  );

  useEffect(() => {
    if (open && !focusTrap) dialogRef.current?.focus();
  }, [open, focusTrap]);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  const onClick = (event: ReactMouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (target.closest('button') || (contentClickable && contentRef.current?.contains(target))) return;
    close();
  };

  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.target !== dialogRef.current) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      close();
    }
  };

  if (!open) return null;

  return (
    <Portal>
      <div
        ref={ref}
        className="fixed inset-0 isolate z-9999 flex flex-col bg-black/70 backdrop-blur-xs"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        onClick={onClick}
        onKeyDown={onKeyDown}
      >
        <header className="flex items-center justify-between gap-8 px-8 pt-8">
          <h2 className="truncate">{heading ?? title}</h2>
          <div className="flex items-center gap-8">
            {meta && <span className="shrink-0 font-mono">{meta}</span>}
            <WindowControl onClick={close} aria-label="Close">
              <Icon name="close" className="size-full" />
            </WindowControl>
          </div>
        </header>
        <div className="flex min-h-0 flex-1 items-center justify-center overflow-y-auto p-8">
          <div ref={contentRef} className={cx('min-h-0 min-w-0', contentClickable ? '' : 'pointer-events-none **:pointer-events-none', className)}>
            {children}
          </div>
        </div>
      </div>
    </Portal>
  );
}
