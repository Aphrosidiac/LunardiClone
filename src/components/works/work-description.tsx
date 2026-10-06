'use client';

// Module 656558. Below lg the description collapses behind a `[Description]` row with an
// Expand/Collapse toggle; from lg up it is always shown, pushed to the bottom of the column.
import { useId, useState, type ReactNode } from 'react';
import { cx } from '@/lib/cx';
import { ExpandableTrigger } from './expandable';

export function WorkDescription({ children }: { children?: ReactNode }) {
  const id = useId();
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      <div className="grid grid-cols-2 gap-16 font-mono lg:hidden">
        <span className="uppercase">[Description]</span>
        <button
          type="button"
          className="-my-2 w-full cursor-pointer truncate py-2 text-left"
          onClick={() => setExpanded(!expanded)}
          aria-expanded={expanded}
          aria-controls={id}
          aria-label={expanded ? 'Collapse description' : 'Expand description'}
        >
          <ExpandableTrigger expanded={expanded} />
        </button>
      </div>
      <div id={id} className={cx(expanded ? 'block' : 'hidden lg:block', 'lg:mt-auto lg:pt-16')}>
        {children}
      </div>
    </>
  );
}
