'use client';

// Ported from reference module 251685 (SearchInput, chunk 1cs-jd0xrhc68, lazy-loaded by
// SearchLightbox). The reference fetches `/api/search` (one flat record per page) and fuzzy-matches
// it with Fuse.js over every string/array field. A static export has no API, so the same records
// come from `src/content/search.ts`, imported on demand to keep the same "load on open" timing.
import Fuse, { type FuseResult } from 'fuse.js';
import { useCallback, useEffect, useEffectEvent, useId, useMemo, useRef, useState, type ChangeEvent, type KeyboardEvent } from 'react';
import { EntryLine } from '@/components/lines/entry-line';
import { Icon } from '@/components/icon';
import { useIosViewportZoomGuard } from '@/hooks/use-ios-viewport-zoom-guard';
import { cx } from '@/lib/cx';
import { track } from '@/lib/track';

/**
 * One searchable page, as the reference `/api/search` returns it. Every string or string-array
 * field except `url` is searched; `url` starting with `http` opens in a new tab.
 */
export type SearchRecord = {
  _type: string;
  title: string;
  url: string;
  [field: string]: string | number | string[];
};

const NO_KEYS: string[] = [];
const NO_RESULTS: FuseResult<SearchRecord>[] = [];

function focusOnMount(element: HTMLInputElement | null) {
  element?.focus({ preventScroll: true });
}

function hasTitleAndUrl(result: FuseResult<SearchRecord>) {
  return result.item.title && result.item.url;
}

function useDebouncedCallback<A extends unknown[]>(callback: (...args: A) => void, delay: number) {
  const onFire = useEffectEvent(callback);
  const timer = useRef<number | null>(null);
  const cancel = useCallback(() => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);
  useEffect(() => cancel, [cancel]);
  return useCallback(
    (...args: A) => {
      cancel();
      timer.current = window.setTimeout(() => {
        timer.current = null;
        onFire(...args);
      }, delay);
    },
    [cancel, delay],
  );
}

export function SearchInput({
  query,
  onQueryChange,
  onClose,
  className,
}: {
  query: string;
  onQueryChange: (query: string) => void;
  onClose: () => void;
  className?: string;
}) {
  const [records, setRecords] = useState<SearchRecord[] | null>(null);
  const [debounced, setDebounced] = useState('');
  const [results, setResults] = useState(NO_RESULTS);
  const [activeIndex, setActiveIndex] = useState(0);
  const listId = useId();

  useEffect(() => {
    let cancelled = false;
    import('@/content/search')
      .then(({ SEARCH_INDEX }) => {
        if (!cancelled) setRecords(SEARCH_INDEX as SearchRecord[]);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const keys = useMemo(() => {
    if (!records || records.length === 0) return NO_KEYS;
    const skip = new Set(['url']);
    const found = new Set<string>();
    for (const record of records) {
      for (const key of Object.keys(record)) {
        if (skip.has(key) || found.has(key)) continue;
        const value = record[key];
        if (typeof value === 'string' || Array.isArray(value)) found.add(key);
      }
    }
    return Array.from(found);
  }, [records]);

  const fuse = useMemo(
    () =>
      new Fuse(records ?? [], {
        keys,
        threshold: 0.2,
        includeScore: true,
        ignoreLocation: true,
        ignoreDiacritics: true,
        minMatchCharLength: 2,
        distance: 100,
      }),
    [records, keys],
  );

  const zoomGuard = useIosViewportZoomGuard();

  useEffect(() => {
    setActiveIndex(0);
    if (debounced.trim()) setResults(fuse.search(debounced, { limit: 50 }).filter(hasTitleAndUrl));
    else setResults([]);
  }, [fuse, debounced]);

  const optionId = (index: number) => `${listId}-${index}`;

  const debounceQuery = useDebouncedCallback((value: string) => setDebounced(value), 300);

  const onChange = (event: ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    onQueryChange(value);
    debounceQuery(value);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (results.length === 0 || event.nativeEvent.isComposing) return;
    if (event.key === 'Enter') {
      event.preventDefault();
      document.getElementById(optionId(activeIndex))?.click();
      return;
    }
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    const next = (activeIndex + (event.key === 'ArrowDown' ? 1 : -1) + results.length) % results.length;
    setActiveIndex(next);
    document.getElementById(optionId(next))?.scrollIntoView({ block: 'nearest' });
  };

  return (
    <div className={cx('w-full max-w-400 bg-theme-bg p-4 ring-1 ring-theme-fg/30', className)}>
      <div className="flex items-center gap-8">
        <Icon name="search" />
        <input
          ref={focusOnMount}
          data-autofocus
          type="text"
          aria-label="Search"
          aria-controls={listId}
          aria-activedescendant={results.length > 0 ? optionId(activeIndex) : undefined}
          value={query}
          onChange={onChange}
          onKeyDown={onKeyDown}
          onFocus={zoomGuard.onFocus}
          onTouchStart={zoomGuard.onTouchStart}
          onBlur={zoomGuard.onBlur}
          placeholder="Search..."
          className="flex h-28 w-full items-center outline-none"
        />
      </div>
      {results.length > 0 && (
        <ul id={listId} aria-label="Search results" className="mt-4">
          {results.map((result, index) => {
            const { title, url } = result.item;
            if (!title || !url) return null;
            return (
              <li key={url} onMouseMove={() => setActiveIndex(index)}>
                <EntryLine
                  id={optionId(index)}
                  title={title}
                  href={url}
                  titleAs="span"
                  active={index === activeIndex}
                  tabIndex={-1}
                  onClick={() => {
                    track('search_click', { query: debounced.slice(0, 500), title: title.slice(0, 500), url: url.slice(0, 500) });
                    onClose();
                  }}
                  target={url.startsWith('http') ? '_blank' : '_self'}
                />
              </li>
            );
          })}
        </ul>
      )}
      {records !== null && debounced.trim() && results.length === 0 && <div className="mt-4">No results found</div>}
    </div>
  );
}
