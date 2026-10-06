'use client';

// Ported from reference module 739209.
import dynamic from 'next/dynamic';
import { useState } from 'react';
import { Icon } from '@/components/icon';
import { Lightbox } from '@/components/window/lightbox';
import { track } from '@/lib/track';
import { KeyHint, useHotkey } from './key-hint';

const SearchInput = dynamic(() => import('./search-input').then((mod) => mod.SearchInput), { ssr: false });

export function SearchLightbox() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const openSearch = () => {
    setQuery('');
    track('open_search');
    setOpen(true);
  };

  const closeSearch = () => {
    if (query.trim()) track('search', { query: query.trim().slice(0, 500) });
    track('close_search');
    setOpen(false);
  };

  useHotkey('K', openSearch);

  return (
    <>
      <button
        type="button"
        className="group flex h-full cursor-pointer items-center gap-8 p-4 text-theme-fg"
        aria-label="Open search"
        title="Open search (press K)"
        onClick={openSearch}
      >
        <span className="flex h-18 w-18 select-none items-center justify-center">
          <Icon name="search" />
        </span>
        <KeyHint letter="K" />
        <span className="keyboard:hidden font-semibold text-theme-fg/50 group-hover:text-theme-fg">Search</span>
      </button>
      <Lightbox open={open} onClose={closeSearch} title="Search" className="block w-full" focusTrap contentClickable>
        <div className="flex size-full justify-center">
          <SearchInput query={query} onQueryChange={setQuery} onClose={closeSearch} />
        </div>
      </Lightbox>
    </>
  );
}
