'use client';

// Module 965383. A disclosure: a full-width button toggles a section kept mounted under
// <Activity> (hidden while collapsed), optionally portalled elsewhere. ExpandableTrigger is the
// stock "Expand / Collapse" label with a round +/− glyph.
import { Activity, useId, useState, type HTMLAttributes, type KeyboardEvent, type ReactNode } from 'react';
import { Icon } from '@/components/icon';
import { Portal } from '@/components/portal';

export type ExpandableProps = Omit<HTMLAttributes<HTMLDivElement>, 'children'> & {
  defaultOpen?: boolean;
  openTrigger?: ReactNode;
  closeTrigger?: ReactNode;
  children?: ReactNode;
  portalTargetId?: string;
};

export function Expandable({ defaultOpen, openTrigger, closeTrigger, children, portalTargetId, ...props }: ExpandableProps) {
  const [open, setOpen] = useState(defaultOpen ?? false);
  const id = useId();

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      setOpen(!open);
    }
  };

  const handleClick = () => {
    setOpen(!open);
  };

  const content = (
    <Activity mode={open ? 'visible' : 'hidden'}>
      <section id={id} aria-hidden={!open} data-content>
        {children}
      </section>
    </Activity>
  );

  return (
    <div {...props}>
      <button
        type="button"
        className="-my-2 w-full cursor-pointer truncate py-2 text-left"
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        aria-expanded={open}
        aria-controls={id}
        aria-label={open ? 'Collapse' : 'Expand'}
      >
        {open ? closeTrigger : openTrigger}
      </button>
      {portalTargetId ? <Portal targetId={portalTargetId}>{content}</Portal> : content}
    </div>
  );
}

export function ExpandableTrigger({ expanded }: { expanded: boolean }) {
  return (
    <span className="flex w-full items-center justify-between gap-2">
      <span>{expanded ? 'Collapse' : 'Expand'}</span>
      <span className="flex size-13 items-center rounded-full bg-theme-fg text-theme-bg">
        <Icon name={expanded ? 'minus' : 'plus'} className="size-full" />
      </span>
    </span>
  );
}
