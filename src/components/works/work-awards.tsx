'use client';

// Module 605074. The `[Awards]` cell of a work's credits: an Expandable (open by default on lg)
// whose content is a marquee of award titles plus an optional preview (click opens the full
// marquee in a Lightbox titled "Awards"). FF Desk renders no awards; kept for parity.
import { useState, type ReactNode } from 'react';
import { Marquee } from '@/components/home/marquee';
import { LineSkeleton } from '@/components/line-skeleton';
import { Lightbox } from '@/components/window/lightbox';
import { useBreakpoint } from '@/hooks/use-breakpoint';
import { Expandable, ExpandableTrigger } from './expandable';

export type WorkAward = { key: string; title: string };

function AwardTitle({ title }: { title: string }) {
  return <span className="whitespace-nowrap">{title}, </span>;
}

export function WorkAwards({ awards, preview, full }: { awards: WorkAward[]; preview?: ReactNode; full?: ReactNode }) {
  const isDesktop = useBreakpoint('lg');
  const [open, setOpen] = useState(false);

  return (
    <>
      <Expandable
        key={isDesktop ? 'open' : 'closed'}
        defaultOpen={isDesktop}
        openTrigger={<ExpandableTrigger expanded={false} />}
        closeTrigger={<ExpandableTrigger expanded />}
      >
        <Marquee className="mt-2" loader={<LineSkeleton className="w-full" />}>
          {awards.map((award) => (
            <AwardTitle key={award.key} title={award.title} />
          ))}
        </Marquee>
        {preview && (
          <button type="button" aria-label="Open lightbox" className="cursor-zoom-in" onClick={() => setOpen(true)}>
            {preview}
          </button>
        )}
      </Expandable>
      {full && (
        <Lightbox open={open} onClose={() => setOpen(false)} title="Awards">
          {full}
        </Lightbox>
      )}
    </>
  );
}
