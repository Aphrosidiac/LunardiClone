'use client';

// Ported from reference module 883574: the header "Cursors" control with its live head-count badge
// and the visitors menu (follow someone, show/hide cursors).
import { useEffect, useRef, useSyncExternalStore, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { Icon } from '@/components/icon';
import { useWindowEvent } from '@/hooks/use-window-event';
import { cx } from '@/lib/cx';
import { track } from '@/lib/track';
import {
  PRESENCE_OTHERS_KEY,
  getFollowing,
  getListOpen,
  getNoVisitors,
  getPeople,
  getSelf,
  getShowOthers,
  getVisitors,
  setFollowing,
  setListOpen,
  setShowOthers,
  subscribePresence,
  visitorName,
} from '@/components/presence/presence-store';
import { KeyHint, useHotkey } from './key-hint';

const MENU_ID = 'presence-visitors';
const ITEM_CLASS =
  'flex w-full cursor-pointer items-center gap-8 rounded-2 px-8 py-4 text-left text-body-14 outline-none hover:bg-theme-fg/10 focus-visible:bg-theme-fg/10';
const ITEM_SELECTOR = '[role^="menuitem"]:not(:disabled)';

/** 5×5 mirrored pixel glyph derived from the visitor id: a tiny identicon. */
function VisitorGlyph({ id, className }: { id: string; className?: string }) {
  const bits = Number.parseInt(id, 16);
  const cells: { x: number; y: number }[] = [];
  for (let y = 0; y < 5; y++) {
    for (let x = 0; x < 3; x++) {
      if ((bits >>> (3 * y + x)) & 1) {
        cells.push({ x, y });
        if (x < 2) cells.push({ x: 4 - x, y });
      }
    }
  }
  return (
    <svg aria-hidden viewBox="0 0 5 5" shapeRendering="crispEdges" className={cx('size-12 shrink-0 fill-current', className)}>
      {cells.length ? (
        cells.map(({ x, y }) => <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} />)
      ) : (
        <rect x={2} y={2} width={1} height={1} />
      )}
    </svg>
  );
}

function Check({ on }: { on: boolean }) {
  return (
    <span aria-hidden="true" className={cx('text-theme-fg/60', !on && 'invisible')}>
      ✓
    </span>
  );
}

const returnTrue = () => true;
const returnNull = () => null;
const returnFalse = () => false;
const returnZero = () => 0;

function VisitorsMenu({ onClose }: { onClose: (restoreFocus: boolean) => void }) {
  const self = useSyncExternalStore(subscribePresence, getSelf, returnNull);
  const visitors = useSyncExternalStore(subscribePresence, getVisitors, getNoVisitors);
  const following = useSyncExternalStore(subscribePresence, getFollowing, returnNull);
  const showOthers = useSyncExternalStore(subscribePresence, getShowOthers, returnTrue);
  const ref = useRef<HTMLDivElement>(null);
  const listed = visitors.filter((visitor) => !visitor.away || visitor.id === following);

  useEffect(() => {
    const checked = ref.current?.querySelector<HTMLElement>('[role="menuitemradio"][aria-checked="true"]');
    const first = ref.current?.querySelector<HTMLElement>(ITEM_SELECTOR);
    (checked ?? first)?.focus({ preventScroll: true });
  }, []);

  useWindowEvent(
    'keydown',
    (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopImmediatePropagation();
        onClose(true);
      }
    },
    true,
  );

  useWindowEvent(
    'pointerdown',
    (event: PointerEvent) => {
      if (event.target instanceof Element && !event.target.closest('[data-presence-visitors], [data-presence-toggle]')) onClose(false);
    },
    true,
  );

  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const items = Array.from(ref.current?.querySelectorAll<HTMLElement>(ITEM_SELECTOR) ?? []);
    if (items.length === 0) return;
    const index = items.indexOf(document.activeElement as HTMLElement);
    const focusAt = (next: number) => {
      event.preventDefault();
      items.at(next % items.length)?.focus();
    };
    if (event.key === 'ArrowDown') focusAt(index + 1);
    else if (event.key === 'ArrowUp') focusAt(index <= 0 ? items.length - 1 : index - 1);
    else if (event.key === 'Home') focusAt(0);
    else if (event.key === 'End') focusAt(items.length - 1);
    else if (event.key === 'Tab') onClose(false);
  };

  const follow = (id: string) => {
    const next = following === id ? null : id;
    setFollowing(next);
    track(next ? 'follow_visitor' : 'stop_following');
    onClose(true);
  };

  return (
    <div
      ref={ref}
      id={MENU_ID}
      data-presence-visitors
      role="menu"
      aria-label="Visitors"
      onKeyDown={onKeyDown}
      className="absolute top-full right-0 z-9998 mt-2 flex w-200 flex-col gap-1 rounded-4 bg-theme-bg p-2 ring-1 ring-theme-fg/30"
    >
      {listed.map((visitor) => {
        const checked = following === visitor.id;
        return (
          <button
            key={visitor.id}
            type="button"
            role="menuitemradio"
            aria-checked={checked}
            tabIndex={-1}
            onClick={() => follow(visitor.id)}
            className={ITEM_CLASS}
          >
            <VisitorGlyph id={visitor.id} />
            <span className="flex-1">{visitorName(visitor.number)}</span>
            <Check on={checked} />
          </button>
        );
      })}
      {listed.length === 0 && (
        <p className="px-8 py-4 text-body-14 text-theme-fg/50">{self ? 'Nobody else is here' : 'The list is unavailable'}</p>
      )}
      <hr className="my-1 border-theme-fg/30 border-t" />
      <button
        type="button"
        role="menuitemcheckbox"
        aria-checked={showOthers}
        tabIndex={-1}
        onClick={() => setShowOthers(!showOthers)}
        className={ITEM_CLASS}
      >
        <span className="flex-1">Show cursors</span>
        <Check on={showOthers} />
      </button>
      <p className="px-8 pt-2 pb-4 text-body-10 text-theme-fg/50">
        {self ? `You're ${visitorName(self.number)}` : "You're anonymous"} · / to chat
      </p>
    </div>
  );
}

/** Head script: mark <html data-cursors-hidden> before paint. */
export function CursorsScript() {
  return (
    <script
      dangerouslySetInnerHTML={{
        __html: `
          try {
            if (localStorage.getItem('${PRESENCE_OTHERS_KEY}') === 'hidden') {
              document.documentElement.setAttribute('data-cursors-hidden', '');
            }
          } catch (e) {}
        `,
      }}
    />
  );
}

export function CursorsToggle({ className }: { className?: string }) {
  const people = useSyncExternalStore(subscribePresence, getPeople, returnZero);
  const listOpen = useSyncExternalStore(subscribePresence, getListOpen, returnFalse);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const alone = people === 0;

  useEffect(() => {
    if (alone) setListOpen(false);
  }, [alone]);

  useHotkey('C', () => {
    if (alone) return;
    const visible = !getShowOthers();
    setShowOthers(visible);
    track('toggle_cursors', { visible });
  });

  const closeMenu = (restoreFocus: boolean) => {
    setListOpen(false);
    if (restoreFocus) buttonRef.current?.focus({ preventScroll: true });
  };

  return (
    <div className={cx('relative h-full [@media(pointer:coarse)]:hidden', className)}>
      <button
        ref={buttonRef}
        type="button"
        data-presence-toggle
        className={cx(
          'group flex h-full items-center gap-8 p-4 text-theme-fg transition-opacity duration-200',
          alone ? 'cursor-default opacity-40' : 'cursor-pointer',
        )}
        onClick={() => {
          if (alone) return;
          setListOpen(!listOpen);
          track(listOpen ? 'close_visitors' : 'open_visitors');
        }}
        aria-disabled={alone || undefined}
        aria-haspopup="menu"
        aria-expanded={alone ? undefined : listOpen}
        aria-controls={listOpen ? MENU_ID : undefined}
        aria-label={alone ? 'Visitors, nobody else on the site' : `Visitors, ${people} ${people === 1 ? 'person' : 'people'} here now`}
        title={
          alone
            ? 'Live cursors: nobody else is on the site right now'
            : 'Visitors: see who is on the site and follow them. C shows or hides cursors, / chats.'
        }
      >
        <span className="relative flex h-18 w-18 select-none items-center justify-center">
          <Icon name="cursors-on" className="in-data-cursors-hidden:hidden" />
          <Icon name="cursors-off" className="in-data-cursors-hidden:block hidden" />
          {people > 0 && (
            <span
              aria-hidden
              className="absolute -top-5 -right-7 flex h-12 min-w-12 items-center justify-center rounded-full bg-theme-fg px-3 font-mono text-body-10 text-theme-bg tabular-nums leading-none"
            >
              {people > 9 ? '9+' : people}
            </span>
          )}
        </span>
        <KeyHint letter="C" />
        <span className="keyboard:hidden font-semibold text-theme-fg/50 group-hover:text-theme-fg">Cursors</span>
      </button>
      {listOpen && <VisitorsMenu onClose={closeMenu} />}
    </div>
  );
}
