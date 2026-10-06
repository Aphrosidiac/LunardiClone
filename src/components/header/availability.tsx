'use client';

// Ported from reference module 360845.
import { useEffect, useState } from 'react';
import { cx } from '@/lib/cx';

const MONTH_YEAR = new Intl.DateTimeFormat('en', { month: 'short', year: 'numeric', timeZone: 'UTC' });

export type AvailabilityData = {
  /** `available`, or `booked`/`busy` (the reference calls it `booked`). */
  status: string | null;
  /** ISO date the studio opens up again, if booked. */
  availableFrom: string | null;
};

export function Availability({ availability, className }: { availability: AvailabilityData; className?: string }) {
  const { status, availableFrom } = availability;
  const [reopened, setReopened] = useState(false);

  useEffect(() => {
    if ((status === 'booked' || status === 'busy') && availableFrom) setReopened(Date.parse(availableFrom) <= Date.now());
  }, [status, availableFrom]);

  if (!status) return null;

  const available = status === 'available' || reopened;
  const label = available ? 'Available' : availableFrom ? `Available ${MONTH_YEAR.format(new Date(availableFrom))}` : 'Booked';

  return (
    <p className={cx('flex items-center gap-8 p-4 font-mono uppercase', className)}>
      <span aria-hidden className="relative flex size-8">
        {available && (
          <span className="absolute inset-0 animate-ping rounded-full bg-theme-fg/60 motion-reduce:animate-none" />
        )}
        <span className={cx('relative size-8 rounded-full border border-theme-fg', available && 'bg-theme-fg')} />
      </span>
      <span className="whitespace-nowrap">{label}</span>
    </p>
  );
}
