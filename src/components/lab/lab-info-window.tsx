'use client';

// Module 524777. The draggable info window over the lab canvas: `[count]` on the left, a close
// control on the right. Closing it removes it for the rest of the visit to the page.
import { useState, type ReactNode } from 'react';
import { Icon } from '@/components/icon';
import { Window } from '@/components/window/window';
import { WindowControl } from '@/components/window/window-control';

export function LabInfoWindow({ count, children }: { count: number; children: ReactNode }) {
  const [closed, setClosed] = useState(false);
  if (closed) return null;
  return (
    <Window
      id="lab-info"
      left={
        <>
          <span aria-hidden="true">[{count}]</span>
          <span className="sr-only">{count} experiments</span>
        </>
      }
      right={
        <WindowControl aria-label="Close lab info" onClick={() => setClosed(true)}>
          <Icon name="close" className="size-full" />
        </WindowControl>
      }
      allowFullscreen={false}
      draggable
      className="absolute bottom-8 left-8 z-10 w-320"
    >
      {children}
    </Window>
  );
}
