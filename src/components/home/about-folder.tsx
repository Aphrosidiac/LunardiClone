'use client';

// Module 296558. "Learn more" under the About copy opens a draggable `~/about` window: an
// `ls -l`-style listing of files (↑/↓ to move, Esc to close) with the selected file's content
// printed below it, like `cat`.
import { Activity, useEffect, useEffectEvent, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { Icon } from '@/components/icon';
import { Portal } from '@/components/portal';
import { Window } from '@/components/window/window';
import { WindowControl } from '@/components/window/window-control';
import { useWindowManager } from '@/components/window/window-manager';
import { cx } from '@/lib/cx';
import { track } from '@/lib/track';

export type AboutFolderFile = {
  key: string;
  name: string;
  icon: 'file' | 'folder';
  note: string | null;
  size: string;
  content: ReactNode;
};

const WINDOW_ID = 'about-folder';

function trackOpenFile(file: AboutFolderFile) {
  track('open_about_file', { name: file.name });
}

function focusFile(root: HTMLElement | null, key: string) {
  root?.querySelector<HTMLElement>(`[data-about-file="${key}"]`)?.focus({ preventScroll: true });
}

function FileBrowser({ files, date, onClose }: { files: AboutFolderFile[]; date: string; onClose: () => void }) {
  const [selectedKey, setSelectedKey] = useState(files[0]?.key);
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = files.find((file) => file.key === selectedKey) ?? files[0];

  // Runs on mount and every time the folder window is shown again (Activity re-runs effects).
  const onShow = useEffectEvent(() => {
    if (!selected) return;
    trackOpenFile(selected);
    focusFile(rootRef.current, selected.key);
  });
  useEffect(() => {
    onShow();
  }, []);

  const select = (file: AboutFolderFile) => {
    if (file.key !== selected?.key) trackOpenFile(file);
    setSelectedKey(file.key);
    focusFile(rootRef.current, file.key);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const index = files.findIndex((file) => file.key === selected?.key);
    const step = event.key === 'ArrowDown' ? 1 : event.key === 'ArrowUp' ? -1 : 0;
    if (event.key === 'Escape') {
      onClose();
    } else {
      if (!step || !files.length) return;
      select(files[(index + step + files.length) % files.length]);
    }
    event.preventDefault();
    event.stopPropagation();
  };

  return (
    <div ref={rootRef} className="@container flex flex-col gap-2 py-4 font-mono" onKeyDown={onKeyDown}>
      <div className="grid @min-[480px]:grid-cols-[auto_auto_auto_auto_minmax(0,1fr)] grid-cols-[auto_auto_minmax(0,1fr)] gap-x-[2ch]">
        {files.map((file) => {
          const active = file.key === selected?.key;
          return (
            <button
              key={file.key}
              type="button"
              data-about-file={file.key}
              aria-pressed={active}
              aria-controls="about-cat"
              className={cx(
                'col-span-full grid min-h-28 cursor-pointer grid-cols-subgrid items-center px-4 text-left',
                active ? 'bg-theme-fg text-theme-bg' : 'hover:bg-theme-fg/10',
              )}
              onClick={() => select(file)}
            >
              <span aria-hidden className="@min-[480px]:block hidden opacity-60">
                {file.icon === 'folder' ? 'drwxr-xr-x' : '-rw-r--r--'}
              </span>
              <span aria-hidden className="text-right opacity-60">
                {file.size}
              </span>
              <span aria-hidden className="@min-[480px]:block hidden opacity-60">
                {date}
              </span>
              <span className="font-semibold">{file.name}</span>
              <span className="truncate opacity-60">{file.note ? `# ${file.note}` : null}</span>
            </button>
          );
        })}
      </div>
      {selected ? (
        <div id="about-cat" className="px-4 pt-14">
          {selected.content}
        </div>
      ) : null}
    </div>
  );
}

export function AboutFolder({ files, date }: { files: AboutFolderFile[]; date: string }) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const { bringToFront } = useWindowManager();

  const close = () => {
    setOpen(false);
    triggerRef.current?.focus({ preventScroll: true });
  };

  const openFolder = () => {
    track('open_about_folder');
    setOpen(true);
    bringToFront(WINDOW_ID);
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={open}
        aria-controls={WINDOW_ID}
        className="mt-[1em] cursor-pointer select-none underline decoration-dotted underline-offset-2"
        onClick={openFolder}
      >
        Learn more
      </button>
      <Portal>
        <Activity mode={open ? 'visible' : 'hidden'}>
          <Window
            id={WINDOW_ID}
            left={<h2>~/about</h2>}
            className="fixed top-1/2 left-1/2 max-h-[85svh] w-320 -translate-x-1/2 -translate-y-1/2 md:w-620 lg:top-[12%] lg:translate-y-0"
            draggable
            allowFullscreen={false}
            right={
              <WindowControl aria-label="Close" onClick={close}>
                <Icon name="close" className="size-full" />
              </WindowControl>
            }
          >
            <FileBrowser files={files} date={date} onClose={close} />
          </Window>
        </Activity>
      </Portal>
    </>
  );
}
