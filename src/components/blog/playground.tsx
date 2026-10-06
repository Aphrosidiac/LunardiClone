'use client';

// Module 700744. A runnable code window inside a post: an editable, sugar-high-highlighted
// source pane and a sandboxed result iframe, side by side on lg (stacked below), with a
// draggable splitter (15–85%, default 50%). Nothing compiles until the playground is within
// 600px of the viewport; edits recompile (sucrase, TS + JSX, automatic runtime) 400ms after
// typing stops. The dot in the title is red on error, amber while pending, green when current.
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
  type PointerEvent,
  type RefObject,
  type UIEvent,
} from 'react';
import { highlight } from 'sugar-high';
import { useScrollRoot } from '@/components/scroll-root';
import { Window } from '@/components/window/window';
import { useWindow } from '@/components/window/window-context';
import { useBreakpoint } from '@/hooks/use-breakpoint';
import { useWindowEvent } from '@/hooks/use-window-event';
import { cx } from '@/lib/cx';
import { run } from '@/lib/utils';
import {
  buildRunnerDocument,
  DEFAULT_PLAYGROUND_HEIGHT,
  PLAYGROUND_FRAME_PERMISSIONS,
  PLAYGROUND_MESSAGE_SOURCE,
} from './runner-document';

export type PlaygroundView = 'editor' | 'split' | 'preview';

export type PlaygroundProps = {
  id: string;
  className?: string;
  title?: string;
  code: string;
  dependencies?: string[];
  view?: PlaygroundView;
  height?: number;
};

// ---------------------------------------------------------------------------------------------
// Editor

const EDITOR_TEXT = 'font-mono text-body-14 leading-[1.6] tracking-normal [tab-size:2]';
const EDITOR_PADDING = 'py-12';

function Editor({
  title,
  source,
  onSourceChange,
}: {
  title?: string;
  source: string;
  onSourceChange: (value: string) => void;
}) {
  const highlightRef = useRef<HTMLPreElement>(null);
  const gutterRef = useRef<HTMLPreElement>(null);
  const lineCount = source.split('\n').length;
  const gutter = useMemo(() => Array.from({ length: lineCount }, (_, i) => i + 1).join('\n'), [lineCount]);
  const gutterWidth = `calc(${String(lineCount).length}ch + 20px)`;
  const html = useMemo(() => highlight(source), [source]);

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== 'Tab' || event.shiftKey) return;
    event.preventDefault();
    const textarea = event.currentTarget;
    const { selectionStart, selectionEnd, value } = textarea;
    onSourceChange(`${value.slice(0, selectionStart)}  ${value.slice(selectionEnd)}`);
    requestAnimationFrame(() => {
      textarea.selectionStart = selectionStart + 2;
      textarea.selectionEnd = selectionStart + 2;
    });
  };

  const handleScroll = (event: UIEvent<HTMLTextAreaElement>) => {
    const { scrollTop, scrollLeft } = event.currentTarget;
    if (highlightRef.current) {
      highlightRef.current.scrollTop = scrollTop;
      highlightRef.current.scrollLeft = scrollLeft;
    }
    if (gutterRef.current) gutterRef.current.scrollTop = scrollTop;
  };

  return (
    <div className="relative min-h-0 min-w-0 overflow-hidden focus-within:ring-1 focus-within:ring-theme-fg/40">
      <pre
        ref={gutterRef}
        aria-hidden="true"
        style={{ width: gutterWidth }}
        className={cx(
          EDITOR_TEXT,
          EDITOR_PADDING,
          'pointer-events-none absolute inset-y-0 left-0 z-1 select-none overflow-hidden bg-theme-bg pr-8 text-right text-theme-fg/30',
        )}
      >
        {gutter}
      </pre>
      <pre
        ref={highlightRef}
        aria-hidden="true"
        style={{ paddingLeft: `calc(${gutterWidth} + 12px)` }}
        className={cx(EDITOR_TEXT, EDITOR_PADDING, 'pointer-events-none absolute inset-0 overflow-auto pr-12 text-theme-fg')}
      >
        <code dangerouslySetInnerHTML={{ __html: html }} />
      </pre>
      <textarea
        value={source}
        onChange={(event: ChangeEvent<HTMLTextAreaElement>) => onSourceChange(event.target.value)}
        onKeyDown={handleKeyDown}
        onScroll={handleScroll}
        aria-label={title ? `${title} source code` : 'Editable source code'}
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        autoComplete="off"
        style={{ paddingLeft: `calc(${gutterWidth} + 12px)` }}
        className={cx(
          EDITOR_TEXT,
          EDITOR_PADDING,
          'relative z-2 block size-full resize-none overflow-auto whitespace-pre bg-transparent pr-12 text-transparent caret-theme-fg outline-none',
        )}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// View menu

const VIEW_OPTIONS: { value: PlaygroundView; label: string }[] = [
  { value: 'editor', label: 'Code' },
  { value: 'split', label: 'Code and result' },
  { value: 'preview', label: 'Result' },
];

const VIEW_LABELS: Record<PlaygroundView, string> = { editor: 'Code', split: 'Both', preview: 'Result' };

const MENU_ITEM =
  'flex w-full cursor-pointer items-center justify-between gap-16 rounded-2 px-8 py-4 text-left text-body-14 outline-none hover:bg-theme-fg/10 focus-visible:bg-theme-fg/10 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent';

const MENU_ITEM_SELECTOR = '[role^="menuitem"]:not(:disabled)';

function Chevron() {
  return (
    <svg aria-hidden="true" viewBox="0 0 10 10" className="size-8 shrink-0 text-theme-fg/60">
      <path d="M2 3.5 5 6.5 8 3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function ViewMenu({
  view,
  onViewChange,
  canReset,
  onReset,
  canRerun,
  onRerun,
}: {
  view: PlaygroundView;
  onViewChange: (view: PlaygroundView) => void;
  canReset: boolean;
  onReset: () => void;
  canRerun: boolean;
  onRerun: () => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  const close = (refocus: boolean) => {
    setOpen(false);
    if (refocus) buttonRef.current?.focus();
  };

  useEffect(() => {
    if (!open) return;
    const checked = menuRef.current?.querySelector<HTMLElement>('[aria-checked="true"]');
    const first = menuRef.current?.querySelector<HTMLElement>(MENU_ITEM_SELECTOR);
    (checked ?? first)?.focus();
  }, [open]);

  useWindowEvent('pointerdown', (event) => {
    if (!open || (event.target instanceof Node && rootRef.current?.contains(event.target))) return;
    close(false);
  });

  useWindowEvent(
    'keydown',
    (event) => {
      if (open && event.key === 'Escape') {
        event.stopImmediatePropagation();
        close(true);
      }
    },
    true,
  );

  const handleMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const items = Array.from(menuRef.current?.querySelectorAll<HTMLElement>(MENU_ITEM_SELECTOR) ?? []);
    if (items.length === 0) return;
    const index = items.indexOf(document.activeElement as HTMLElement);
    const focus = (next: number) => {
      event.preventDefault();
      items.at(next % items.length)?.focus();
    };
    if (event.key === 'ArrowDown') focus(index + 1);
    else if (event.key === 'ArrowUp') focus(index <= 0 ? items.length - 1 : index - 1);
    else if (event.key === 'Home') focus(0);
    else if (event.key === 'End') focus(items.length - 1);
    else if (event.key === 'Tab') close(false);
  };

  const handleButtonKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      setOpen(true);
    }
  };

  const select = (action: () => void) => {
    action();
    close(true);
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={handleButtonKeyDown}
        className={cx(
          'flex cursor-pointer items-center gap-4 rounded-2 px-8 py-3 text-body-14 hover:bg-theme-fg/10',
          open && 'bg-theme-fg/10',
        )}
      >
        <span>{VIEW_LABELS[view]}</span>
        <Chevron />
      </button>
      {open && (
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          aria-label="Playground"
          onKeyDown={handleMenuKeyDown}
          className="absolute top-full right-0 z-10 mt-2 flex min-w-160 flex-col gap-1 rounded-4 bg-theme-bg p-2 ring-1 ring-theme-fg/30"
        >
          {VIEW_OPTIONS.map((option) => {
            const checked = option.value === view;
            return (
              <button
                key={option.value}
                type="button"
                role="menuitemradio"
                aria-checked={checked}
                tabIndex={-1}
                onClick={() => select(() => onViewChange(option.value))}
                className={MENU_ITEM}
              >
                <span>{option.label}</span>
                <span aria-hidden="true" className={cx('text-theme-fg/60', !checked && 'invisible')}>
                  ✓
                </span>
              </button>
            );
          })}
          <hr className="my-1 border-theme-fg/30 border-t" />
          <button type="button" role="menuitem" tabIndex={-1} disabled={!canReset} onClick={() => select(onReset)} className={MENU_ITEM}>
            Reset code
          </button>
          <button type="button" role="menuitem" tabIndex={-1} disabled={!canRerun} onClick={() => select(onRerun)} className={MENU_ITEM}>
            Re-run
          </button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Splitter

const SPLIT_VAR = '--pg-split';

function clampSplit(value: number) {
  return Number.isNaN(value) ? 50 : Math.min(85, Math.max(15, value));
}

function Splitter({
  containerRef,
  orientation,
  label,
}: {
  containerRef: RefObject<HTMLDivElement | null>;
  orientation: 'horizontal' | 'vertical';
  label: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const split = useRef(50);
  const [dragging, setDragging] = useState(false);
  const vertical = orientation === 'vertical';

  const setSplit = (value: number) => {
    split.current = value;
    containerRef.current?.style.setProperty(SPLIT_VAR, `${value}%`);
    ref.current?.setAttribute('aria-valuenow', String(Math.round(value)));
  };

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button === 0 || event.pointerType !== 'mouse') {
      event.currentTarget.setPointerCapture(event.pointerId);
      event.preventDefault();
      setDragging(true);
    }
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const container = containerRef.current;
    if (!dragging || !container) return;
    const rect = container.getBoundingClientRect();
    const pointer = vertical ? event.clientY : event.clientX;
    const start = vertical ? rect.top : rect.left;
    const size = vertical ? rect.height : rect.width;
    setSplit(size <= 0 ? 50 : clampSplit(((pointer - start) / size) * 100));
  };

  const handlePointerUp = (event: PointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    event.currentTarget.releasePointerCapture(event.pointerId);
    setDragging(false);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const back = vertical ? 'ArrowUp' : 'ArrowLeft';
    const forward = vertical ? 'ArrowDown' : 'ArrowRight';
    const next =
      event.key === back
        ? split.current - 2
        : event.key === forward
          ? split.current + 2
          : event.key === 'Home'
            ? 15
            : event.key === 'End'
              ? 85
              : event.key === 'Enter' || event.key === ' '
                ? 50
                : null;
    if (next !== null) {
      event.preventDefault();
      setSplit(clampSplit(next));
    }
  };

  return (
    <div
      ref={ref}
      role="separator"
      tabIndex={0}
      aria-label={label}
      aria-orientation={vertical ? 'horizontal' : 'vertical'}
      aria-valuenow={50}
      aria-valuemin={15}
      aria-valuemax={85}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onDoubleClick={() => setSplit(50)}
      onKeyDown={handleKeyDown}
      className={cx(
        'group relative flex shrink-0 items-center justify-center outline-none',
        vertical ? 'h-12 w-full cursor-row-resize py-5' : 'h-full w-12 cursor-col-resize px-5',
        'touch-none',
      )}
    >
      <span
        aria-hidden="true"
        className={cx(
          'bg-theme-fg/30 transition-colors group-hover:bg-theme-fg/60 group-focus-visible:bg-theme-fg/60',
          vertical ? 'h-1 w-full' : 'h-full w-1',
          dragging && 'bg-theme-fg/80!',
        )}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Hooks

/** Flips to true (once) when the element comes within `rootMargin` of its scroll root. */
function useNearViewport({ rootMargin = '600px' }: { rootMargin?: string } = {}) {
  const ref = useRef<HTMLDivElement>(null);
  const [isNear, setIsNear] = useState(false);
  const scrollRoot = useScrollRoot();

  useEffect(() => {
    const element = ref.current;
    if (!element || isNear) return;
    const findRoot = (node: HTMLElement, preferred: HTMLElement | null): HTMLElement | null => {
      if (preferred?.contains(node)) return preferred;
      for (let parent = node.parentElement; parent; parent = parent.parentElement) {
        const { overflowY } = getComputedStyle(parent);
        if ((overflowY === 'auto' || overflowY === 'scroll') && parent.scrollHeight > parent.clientHeight) return parent;
      }
      return null;
    };
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) setIsNear(true);
      },
      { root: findRoot(element, scrollRoot?.current ?? null), rootMargin, threshold: 0 },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [isNear, rootMargin, scrollRoot]);

  return { ref, isNear };
}

function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timeout = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timeout);
  }, [value, delay]);
  return debounced;
}

async function compile(source: string): Promise<{ code: string | null; error: string | null }> {
  try {
    const { transform } = await import('sucrase');
    const { code } = transform(source, {
      transforms: ['typescript', 'jsx'],
      jsxRuntime: 'automatic',
      production: true,
    });
    return { code, error: null };
  } catch (error) {
    return { code: null, error: error instanceof Error ? error.message : String(error) };
  }
}

// ---------------------------------------------------------------------------------------------
// Body

function PlaygroundBody({
  bodyRef,
  isNear,
  title,
  source,
  onSourceChange,
  compiled,
  error,
  isPending,
  runId,
  frameRef,
  dependencies,
  showsEditor,
  showsResult,
  height,
}: {
  bodyRef: RefObject<HTMLDivElement | null>;
  isNear: boolean;
  title?: string;
  source: string;
  onSourceChange: (value: string) => void;
  compiled: string | null;
  error: string | null;
  isPending: boolean;
  runId: number;
  frameRef: RefObject<HTMLIFrameElement | null>;
  dependencies?: string[];
  showsEditor: boolean;
  showsResult: boolean;
  height: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { fullscreen } = useWindow();
  const isDesktop = useBreakpoint('lg');
  const runnerDocument = useMemo(() => buildRunnerDocument(dependencies ?? []), [dependencies]);
  const split = showsEditor && showsResult;
  const orientation = isDesktop ? 'horizontal' : 'vertical';
  const template = split ? `minmax(0, var(${SPLIT_VAR}, 50%)) auto minmax(0, 1fr)` : 'minmax(0, 1fr)';
  const style = {
    ...(orientation === 'horizontal' ? { gridTemplateColumns: template } : { gridTemplateRows: template }),
    ...(fullscreen ? null : { height }),
  };

  return (
    <div ref={bodyRef} className="flex min-h-0 flex-1 flex-col gap-4">
      <div ref={containerRef} className={cx('grid min-h-0', fullscreen && 'flex-1')} style={style}>
        {showsEditor && <Editor title={title} source={source} onSourceChange={onSourceChange} />}
        {split && (
          <Splitter
            containerRef={containerRef}
            orientation={orientation}
            label={orientation === 'horizontal' ? 'Resize code and result panes' : 'Resize code and result panes vertically'}
          />
        )}
        {showsResult && (
          <div className="relative min-h-0 min-w-0 overflow-hidden">
            {compiled ? (
              <iframe
                key={runId}
                ref={frameRef}
                srcDoc={runnerDocument}
                title={title ? `${title} preview` : 'Playground preview'}
                sandbox="allow-scripts"
                allow={PLAYGROUND_FRAME_PERMISSIONS}
                referrerPolicy="no-referrer"
                className="block size-full border-0 bg-transparent"
              />
            ) : (
              <p className="flex size-full items-center justify-center text-body-14 text-theme-fg/40">
                {run(() => (error ? 'Fix the error to run' : isNear ? 'Compiling…' : 'Runs when you scroll here'))}
              </p>
            )}
            <div
              aria-hidden="true"
              className={cx(
                'pointer-events-none absolute inset-0 bg-theme-bg/40 transition-opacity duration-150',
                isPending && compiled ? 'opacity-100' : 'opacity-0',
              )}
            />
          </div>
        )}
      </div>
      {run(() =>
        error && showsResult ? (
          <p
            role="alert"
            className="shrink-0 rounded-2 bg-red-500/10 px-12 py-8 font-mono text-body-14 text-red-500 leading-[1.5]"
          >
            {error}
          </p>
        ) : null,
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Playground

export function Playground({
  id,
  className,
  title,
  code,
  dependencies,
  view: initialView,
  height = DEFAULT_PLAYGROUND_HEIGHT,
}: PlaygroundProps) {
  const [view, setView] = useState<PlaygroundView>(initialView === undefined ? 'split' : initialView);
  const [source, setSource] = useState(code);
  const [compiled, setCompiled] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [compiling, setCompiling] = useState(false);
  const [runId, setRunId] = useState(0);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const compiledRef = useRef<string | null>(null);
  const { ref: bodyRef, isNear } = useNearViewport();
  const debouncedSource = useDebouncedValue(source, 400);

  const showsEditor = view !== 'preview';
  const showsResult = view !== 'editor';
  const dirty = source !== code;
  const isPending = source !== debouncedSource || compiling;

  useEffect(() => {
    if (!showsResult || !isNear) return;
    let cancelled = false;
    setCompiling(true);
    compile(debouncedSource).then((result) => {
      if (cancelled) return;
      setCompiling(false);
      if (result.error) {
        setError(result.error);
        return;
      }
      setError(null);
      compiledRef.current = result.code;
      setCompiled(result.code);
      setRunId((current) => current + 1);
    });
    return () => {
      cancelled = true;
    };
  }, [debouncedSource, showsResult, isNear]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const frame = frameRef.current?.contentWindow;
      if (!frame || event.source !== frame || event.data?.source !== PLAYGROUND_MESSAGE_SOURCE) return;
      if (event.data.type === 'ready' && compiledRef.current) {
        frame.postMessage({ source: PLAYGROUND_MESSAGE_SOURCE, type: 'run', code: compiledRef.current }, '*');
      }
      if (event.data.type === 'error') setError(String(event.data.message).slice(0, 2000));
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  return (
    <Window
      id={id}
      className={className}
      left={
        <span className="flex items-center gap-8">
          <span className="truncate">{title ?? 'Playground'}</span>
          <span
            aria-hidden="true"
            className={cx(
              'size-4 shrink-0 rounded-full transition-colors',
              run(() => (error ? 'bg-red-500' : isPending ? 'bg-amber-500' : 'bg-emerald-500/70')),
            )}
          />
        </span>
      }
      right={
        <ViewMenu
          view={view}
          onViewChange={setView}
          canReset={dirty && showsEditor}
          onReset={() => setSource(code)}
          canRerun={showsResult}
          onRerun={() => setRunId((current) => current + 1)}
        />
      }
      allowFullscreen
    >
      <PlaygroundBody
        bodyRef={bodyRef}
        isNear={isNear}
        title={title}
        source={source}
        onSourceChange={setSource}
        compiled={compiled}
        error={error}
        isPending={isPending}
        runId={runId}
        frameRef={frameRef}
        dependencies={dependencies}
        showsEditor={showsEditor}
        showsResult={showsResult}
        height={height}
      />
    </Window>
  );
}
