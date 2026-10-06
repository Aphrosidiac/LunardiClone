// Server: the `work-list` window (groups "Work ↴", "Recreations ↴", "Open source ↴") and its
// Suspense skeleton. On /works it fills the singleton column; beside a work detail it is the
// left col-span-4 window, hidden below lg, with span titles.
import { EntryLine } from '@/components/lines/entry-line';
import { ListGroup, ListWindow, ListWindowSkeleton } from '@/components/lines/list-window';
import { OPEN_SOURCE, WORKS, WORKS_BLURB } from '@/content/works';
import { WorkLine } from './work-line';

const GROUPS = [
  { group: 'work', label: 'Work' },
  { group: 'recreation', label: 'Recreations' },
] as const;

export function WorkList({ detail = false }: { detail?: boolean }) {
  const titleAs = detail ? 'span' : 'h2';
  const headingAs = detail ? 'p' : 'h3';
  return (
    <ListWindow id="work-list" count={WORKS.length + OPEN_SOURCE.length} detail={detail} blurb={WORKS_BLURB}>
      {GROUPS.map(({ group, label }) => {
        const works = WORKS.filter((work) => work.group === group);
        if (!works.length) return null;
        return (
          <ListGroup key={group} label={label} headingAs={headingAs}>
            {works.map((work) => (
              <li key={work._id}>
                <WorkLine work={{ _id: work._id, href: work.href, title: work.title }} titleAs={titleAs} />
              </li>
            ))}
          </ListGroup>
        );
      })}
      {OPEN_SOURCE.length > 0 && (
        <ListGroup label="Open source" headingAs={headingAs}>
          {OPEN_SOURCE.map((entry) => (
            <li key={entry.href}>
              <EntryLine title={entry.title} href={entry.href} titleAs={titleAs} target="_blank" />
            </li>
          ))}
        </ListGroup>
      )}
    </ListWindow>
  );
}

/** Reference skeleton: 17 work rows + 1 open-source row, whatever the content holds. */
export function WorkListSkeleton({ detail = false }: { detail?: boolean }) {
  return (
    <ListWindowSkeleton
      className={detail ? 'size-full col-span-4 hidden lg:flex' : 'size-full col-span-4'}
      groups={[
        { label: 'Work', rows: 17 },
        { label: 'Open source', rows: 1 },
      ]}
    />
  );
}
