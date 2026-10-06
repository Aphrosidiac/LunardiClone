'use client';

// Module 239262.
import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

export function Portal({ children, targetId }: { children?: ReactNode; targetId?: string }) {
  const [container, setContainer] = useState<HTMLElement | null>(null);
  useEffect(() => {
    setContainer(targetId ? document.getElementById(targetId) : document.body);
  }, [targetId]);
  return container ? createPortal(children, container) : null;
}
