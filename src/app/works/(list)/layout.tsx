// The reference's `(singleton)` route group: the list window beside the dither.
import type { ReactNode } from 'react';
import { SingletonGrid } from '@/components/lines/list-window';

export default function WorksListLayout({ children }: { children: ReactNode }) {
  return <SingletonGrid>{children}</SingletonGrid>;
}
