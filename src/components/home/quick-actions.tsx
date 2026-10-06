'use client';

// Module 275855. The home desktop: a two-column grid of file icons (top left) that toggle the
// desktop windows. About and Work Gallery open by default; Featured Article and Featured
// Experiment open once the viewport first reaches `lg`; Showreel and Build Notes start closed.
// Hidden windows stay mounted inside <Activity> (Showreel unmounts, so the video stops).
import { Activity, useEffect, useRef, useState, type ComponentProps, type ReactNode } from 'react';
import { Icon } from '@/components/icon';
import { Window } from '@/components/window/window';
import { useWindowManager } from '@/components/window/window-manager';
import { WindowControl } from '@/components/window/window-control';
import { useBreakpoint } from '@/hooks/use-breakpoint';
import { cx } from '@/lib/cx';
import { track } from '@/lib/track';

type QuickActionButtonProps = ComponentProps<'button'> & { active: boolean };

function QuickActionButton({ active, className, children, ...props }: QuickActionButtonProps) {
  return (
    <button type="button" className={cx('flex cursor-pointer items-center gap-4 p-4 hover:bg-theme-bg', className)} {...props}>
      <Icon name="file" className={cx(active && 'fill-theme-fg')} />
      <span className="whitespace-nowrap">{children}</span>
    </button>
  );
}

const toggleEmailCapture = (open: boolean) => (track(open ? 'close_email_capture' : 'open_email_capture'), !open);
const toggleShowreel = (open: boolean) => (track(open ? 'close_showreel' : 'open_showreel'), !open);
const toggleFeaturedExperiment = (open: boolean) => (track(open ? 'close_featured_experiment' : 'open_featured_experiment'), !open);
const toggleFeaturedArticle = (open: boolean) => (track(open ? 'close_featured_article' : 'open_featured_article'), !open);
const toggleWorkGallery = (open: boolean) => (track(open ? 'close_work_gallery' : 'open_work_gallery'), !open);
const toggleAbout = (open: boolean) => (track(open ? 'close_about' : 'open_about'), !open);

function CloseControl({ onClick }: { onClick: () => void }) {
  return (
    <WindowControl aria-label="Close" onClick={onClick}>
      <Icon name="close" className="size-full" />
    </WindowControl>
  );
}

export type QuickActionsProps = {
  workGallery: ReactNode;
  about: ReactNode;
  featuredArticle: ReactNode;
  featuredExperiment: ReactNode;
  showReel: ReactNode;
  emailCapture: ReactNode;
};

export function QuickActions({ workGallery, about, featuredArticle, featuredExperiment, showReel, emailCapture }: QuickActionsProps) {
  const isDesktop = useBreakpoint('lg');
  const [aboutOpen, setAboutOpen] = useState(true);
  const [workGalleryOpen, setWorkGalleryOpen] = useState(true);
  const [featuredArticleOpen, setFeaturedArticleOpen] = useState(false);
  const [featuredExperimentOpen, setFeaturedExperimentOpen] = useState(false);
  const [showreelOpen, setShowreelOpen] = useState(false);
  const [emailCaptureOpen, setEmailCaptureOpen] = useState(false);
  const openedForDesktop = useRef(false);

  // The first time the viewport is `lg` or wider, open the two featured windows. Only once:
  // closing them and resizing does not bring them back.
  useEffect(() => {
    if (!openedForDesktop.current && isDesktop) {
      openedForDesktop.current = true;
      setFeaturedArticleOpen(true);
      setFeaturedExperimentOpen(true);
    }
  }, [isDesktop]);

  // Measured on the reference after load (2026-10-06): the stack settles as Featured Experiment (5)
  // < Featured Article (6) < Work Gallery (7) < About (8). There the two always-open windows end up
  // registering after the featured pair; here they mount first, so lift them once the pair is in.
  const { bringToFront } = useWindowManager();
  const settled = useRef(false);
  useEffect(() => {
    if (settled.current || !featuredArticleOpen || !featuredExperimentOpen) return;
    settled.current = true;
    const raf = requestAnimationFrame(() => {
      bringToFront('quick-actions-work-gallery');
      bringToFront('quick-actions-about');
    });
    return () => cancelAnimationFrame(raf);
    // once, when the desktop pair first opens
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [featuredArticleOpen && featuredExperimentOpen]);

  return (
    <>
      <ul className="grid w-fit grid-cols-2">
        <li>
          <QuickActionButton active={aboutOpen} onClick={() => setAboutOpen(toggleAbout)}>
            About
          </QuickActionButton>
        </li>
        <li>
          <QuickActionButton active={workGalleryOpen} onClick={() => setWorkGalleryOpen(toggleWorkGallery)}>
            Work Gallery
          </QuickActionButton>
        </li>
        <li>
          <QuickActionButton active={featuredArticleOpen} onClick={() => setFeaturedArticleOpen(toggleFeaturedArticle)}>
            Featured Article
          </QuickActionButton>
        </li>
        <li>
          <QuickActionButton active={featuredExperimentOpen} onClick={() => setFeaturedExperimentOpen(toggleFeaturedExperiment)}>
            Featured Experiment
          </QuickActionButton>
        </li>
        <li>
          <QuickActionButton active={showreelOpen} onClick={() => setShowreelOpen(toggleShowreel)}>
            Showreel
          </QuickActionButton>
        </li>
        <li>
          <QuickActionButton active={emailCaptureOpen} onClick={() => setEmailCaptureOpen(toggleEmailCapture)}>
            Build Notes
          </QuickActionButton>
        </li>
      </ul>

      <Activity mode={featuredExperimentOpen ? 'visible' : 'hidden'}>
        <Window
          id="quick-actions-featured-experiment"
          left={<h2>Featured Experiment</h2>}
          className="absolute right-[30%] bottom-[20%] w-320 md:w-400 lg:bottom-[30%]"
          allowFullscreen={false}
          draggable
          right={
            <CloseControl
              onClick={() => {
                track('close_featured_experiment');
                setFeaturedExperimentOpen(false);
              }}
            />
          }
        >
          {featuredExperiment}
        </Window>
      </Activity>

      <Activity mode={featuredArticleOpen ? 'visible' : 'hidden'}>
        <Window
          id="quick-actions-featured-article"
          left={<h2>Featured Article</h2>}
          className="absolute top-[15%] left-[30%] w-320 md:w-400"
          allowFullscreen={false}
          draggable
          right={
            <CloseControl
              onClick={() => {
                track('close_featured_article');
                setFeaturedArticleOpen(false);
              }}
            />
          }
        >
          {featuredArticle}
        </Window>
      </Activity>

      {/* No className: stays in the desktop's flex flow, so `justify-between` pins it to the bottom. */}
      <Activity mode={workGalleryOpen ? 'visible' : 'hidden'}>
        <Window
          id="quick-actions-work-gallery"
          left={<h2>Work Gallery</h2>}
          allowFullscreen={false}
          draggable
          right={
            <CloseControl
              onClick={() => {
                track('close_work_gallery');
                setWorkGalleryOpen(false);
              }}
            />
          }
        >
          {workGallery}
        </Window>
      </Activity>

      <Activity mode={aboutOpen ? 'visible' : 'hidden'}>
        <Window
          id="quick-actions-about"
          left={<h2>About</h2>}
          allowFullscreen={false}
          draggable
          className="absolute top-1/2 left-1/2 w-320 -translate-x-1/2 -translate-y-[60%] md:w-400 lg:-translate-y-[70%]"
          right={
            <CloseControl
              onClick={() => {
                track('close_about');
                setAboutOpen(false);
              }}
            />
          }
        >
          {about}
        </Window>
      </Activity>

      {showreelOpen && (
        <Window
          id="quick-actions-showreel"
          left={<h2>Showreel</h2>}
          className="absolute top-[20%] right-[20%] w-320 md:w-600"
          allowFullscreen={false}
          draggable
          right={
            <CloseControl
              onClick={() => {
                track('close_showreel');
                setShowreelOpen(false);
              }}
            />
          }
        >
          {showReel}
        </Window>
      )}

      <Activity mode={emailCaptureOpen ? 'visible' : 'hidden'}>
        <Window
          id="quick-actions-email-capture"
          left={<h2>Build Notes</h2>}
          allowFullscreen={false}
          draggable
          className="absolute top-[10%] right-[10%] z-10 w-320 md:w-400"
          right={
            <CloseControl
              onClick={() => {
                track('close_email_capture');
                setEmailCaptureOpen(false);
              }}
            />
          }
        >
          {emailCapture}
        </Window>
      </Activity>
    </>
  );
}
