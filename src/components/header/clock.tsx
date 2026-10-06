'use client';

// Ported from reference module 365175. Wall-clock time in the studio's zone, ticking every second
// but only re-rendering when the minute changes.
import { useEffect, useState } from 'react';
import { SITE } from '@/content/site';
import { cx } from '@/lib/cx';

function now() {
  return new Date(new Date().toLocaleString('en', { timeZone: SITE.timeZone }));
}

function tick(previous: Date | null) {
  const next = now();
  return previous && next.getMinutes() === previous.getMinutes() ? previous : next;
}

export function Clock({ className }: { className?: string }) {
  const [time, setTime] = useState<Date | null>(null);

  useEffect(() => {
    setTime(now());
    const interval = window.setInterval(() => setTime(tick), 1000);
    return () => window.clearInterval(interval);
  }, []);

  const hours = time ? time.getHours().toString().padStart(2, '0') : '--';
  const minutes = time ? time.getMinutes().toString().padStart(2, '0') : '--';

  return (
    <div className={cx('flex items-center gap-8 p-4 font-mono', className)}>
      <div>
        <span>{hours}</span>
        <span>:</span>
        <span>{minutes}</span>
      </div>
      <span className="uppercase">{`[${SITE.timeZoneLabel}]`}</span>
    </div>
  );
}
