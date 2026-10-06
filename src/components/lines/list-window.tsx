// Server pieces shared by the works and blog list windows: the `(singleton)` grid that pins the
// list left of the dither, a list group ("Work ↴" + <ul>), the window body with its blurb at the
// bottom, and the Suspense skeleton the reference streams first.
import type { ReactNode } from 'react';
import { DitherSlot } from '@/components/dither/dither-provider';
import { Icon } from '@/components/icon';
import { Window } from '@/components/window/window';
import { cx } from '@/lib/cx';

/** The `(singleton)` route-group layout: list window on the left, the dither slot (`#portal`) right. */
export function SingletonGrid({ children }: { children?: ReactNode }) {
  return (
    <div className="grid size-full flex-1 auto-rows-fr grid-cols-12 gap-x-16 gap-y-8">
      <div className="col-span-full min-h-0 lg:col-span-4">{children}</div>
      <div className="relative hidden ring-1 ring-theme-fg/30 lg:col-span-8 lg:block">
        <DitherSlot id="portal" className="absolute inset-0" />
      </div>
    </div>
  );
}

type HeadingTag = 'h3' | 'p';

const GROUP_HEADING = 'mb-4 flex items-center gap-4 text-theme-fg/50';

function GroupHeading({ as: Heading, label }: { as: HeadingTag; label: string }) {
  return (
    <Heading className={GROUP_HEADING}>
      {`${label} `}
      <Icon name="arrow-right-down" className="size-[0.8em]" />
    </Heading>
  );
}

export function ListGroup({ label, headingAs, children }: { label: string; headingAs: HeadingTag; children?: ReactNode }) {
  return (
    <div>
      <GroupHeading as={headingAs} label={label} />
      <ul>{children}</ul>
    </div>
  );
}

/**
 * The list window. On the list route the count sits in an <h2> and rows title with <h2>, group
 * headings are <h3>; beside an open detail the count is a <span>, rows <span>, headings <p>.
 */
export function ListWindow({
  id,
  count,
  detail,
  blurb,
  children,
}: {
  id: string;
  count: number;
  /** Rendered beside an open detail window (hidden below lg). */
  detail?: boolean;
  blurb: ReactNode;
  children?: ReactNode;
}) {
  const Count = detail ? 'span' : 'h2';
  return (
    <Window id={id} left={<Count>[{count}]</Count>} className={detail ? 'size-full col-span-4 hidden lg:flex' : 'size-full'}>
      <div className="flex flex-col gap-8">{children}</div>
      <div className="mt-auto pt-40">
        <div className="flex flex-col gap-[1em]">
          <p>{blurb}</p>
        </div>
      </div>
    </Window>
  );
}

// ---------------------------------------------------------------------------------------------
// Skeletons (server-rendered Suspense fallbacks, markup and widths verbatim from the reference)

export function Skel({ className, width }: { className?: string; width?: string }) {
  return <div className={cx('animate-pulse bg-theme-fg/10', className)} style={width === undefined ? undefined : { width }} />;
}

export function LineSkel({ className, width }: { className?: string; width?: string }) {
  return <Skel className={cx('my-[0.15em] h-[1em]', className)} width={width} />;
}

/** Window chrome around a skeleton body: title line + one round control per `controls`. */
export function WindowSkeleton({
  className,
  titleWidth,
  controls,
  children,
}: {
  className?: string;
  titleWidth: string;
  controls: number;
  children?: ReactNode;
}) {
  return (
    <div className={cx('flex flex-col bg-theme-bg px-4 pb-4 ring-1 ring-theme-fg/30', 'relative', className)} aria-hidden>
      <div className="flex h-26 shrink-0 items-center justify-between gap-4">
        <LineSkel className={titleWidth} />
        <div className="flex items-center gap-4">
          {Array.from({ length: controls }, (_, i) => (
            <Skel key={i} className="size-13 rounded-full" />
          ))}
        </div>
      </div>
      <div className="relative isolate flex h-full flex-1 flex-col gap-4 overflow-clip overflow-y-auto rounded-2 p-4 ring-1 ring-theme-fg/30 [scrollbar-width:none]">
        {children}
      </div>
    </div>
  );
}

const ROW_WIDTHS = ['38%', '62%', '44%', '50%', '36%', '70%', '28%', '24%', '34%', '26%', '52%', '40%'];

/** Skeleton of a list window: groups of folder rows, then the blurb lines at the bottom. */
export function ListWindowSkeleton({ className, groups }: { className?: string; groups: { label: string; rows: number }[] }) {
  return (
    <WindowSkeleton className={className} titleWidth="w-24" controls={1}>
      <div className="flex flex-col gap-8">
        {groups.map((group) => (
          <div key={group.label}>
            <GroupHeading as="p" label={group.label} />
            <ul className={undefined}>
              {Array.from({ length: group.rows }, (_, i) => (
                <li key={i}>
                  <div className="flex h-28 w-full items-center gap-4 border-theme-fg/30 border-b py-4">
                    <Skel className="size-[1em] shrink-0" />
                    <LineSkel width={ROW_WIDTHS[i % ROW_WIDTHS.length]} />
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="mt-auto flex flex-col gap-[1em] pt-40">
        <div className="flex flex-col">
          <LineSkel width="100%" />
          <LineSkel width="94%" />
          <LineSkel width="42%" />
        </div>
        <div className="flex flex-col">
          <LineSkel width="32%" />
        </div>
      </div>
    </WindowSkeleton>
  );
}

/** `[LABEL]` rows of a credits / article header table: a fixed 80px label beside a value. */
export function TableRowSkeleton({ width, className }: { width: string; className?: string }) {
  return (
    <div className={cx('grid grid-cols-2 gap-16', className)}>
      <LineSkel className="w-80" />
      <LineSkel width={width} />
    </div>
  );
}
