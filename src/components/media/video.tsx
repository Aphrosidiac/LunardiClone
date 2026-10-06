'use client';

// Module 231691. Sources render as <source data-src> and are only promoted to `src` when the
// video should load: immediately, or (with `inViewPlayback`) when it scrolls into view of the
// nearest ScrollRoot. Autoplay respects the background-video gate unless the video lives inside
// a dialog.
import { useEffect, useRef, useSyncExternalStore, type SyntheticEvent, type VideoHTMLAttributes } from 'react';
import { useScrollRoot } from '@/components/scroll-root';
import {
  alignToGroup,
  isBackgroundVideoSuspended,
  joinSyncGroup,
  subscribeBackgroundVideoGate,
} from './background-video-gate';

export type VideoSource = { src: string; media?: string };

export type InViewPlayback = {
  enabled?: boolean;
  threshold?: number;
  rootMargin?: string;
  /** Start preloading (metadata) this far outside the viewport, before playback begins. */
  preloadMargin?: string;
};

export type VideoProps = Omit<VideoHTMLAttributes<HTMLVideoElement>, 'src' | 'children'> & {
  src?: string;
  sources?: VideoSource[];
  inViewPlayback?: InViewPlayback | null;
  /** Videos sharing a sync group seek to a playing sibling before they start. */
  syncGroup?: string;
};

function sourceKey(source: VideoSource) {
  return `${source.media ?? ''}|${source.src}`;
}

function preventDefault(event: SyntheticEvent) {
  event.preventDefault();
}

function noop() {}

function ignoreAbort(error: unknown) {
  if ((error as { name?: string } | undefined)?.name === 'AbortError') return;
}

function serverSnapshot() {
  return false;
}

export function Video({ src, sources: sourcesProp, inViewPlayback, autoPlay, syncGroup, preload: preloadProp, ...props }: VideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const sources = sourcesProp ?? (src ? [{ src }] : []);
  const sourcesKey = sources.map(sourceKey).join('\n');
  const loadedRef = useRef(false);
  const inViewRef = useRef(false);
  const scrollRoot = useScrollRoot();
  const suspended = useSyncExternalStore(subscribeBackgroundVideoGate, isBackgroundVideoSuspended, serverSnapshot);
  const inViewEnabled = !!inViewPlayback?.enabled;
  const preload = preloadProp ?? (inViewEnabled ? 'none' : undefined);
  const threshold = inViewPlayback?.threshold;
  const rootMargin = inViewPlayback?.rootMargin;
  const preloadMargin = inViewPlayback?.preloadMargin;

  useEffect(() => {
    const video = videoRef.current;
    const sourceEls = video ? Array.from(video.querySelectorAll('source')) : [];
    if (!video || !sourceEls.length) return;

    const observerThreshold = threshold ?? 0;
    const observerRootMargin = rootMargin ?? '0px';
    let disposed = false;

    loadedRef.current = false;
    for (const el of sourceEls) {
      el.removeAttribute('src');
      el.removeAttribute('type');
    }
    video.removeAttribute('src');
    video.preload = (preload ?? 'auto') as HTMLVideoElement['preload'];
    video.load();

    const loadSources = () => {
      if (disposed || loadedRef.current) return;
      for (const el of sourceEls) {
        const url = el.dataset.src;
        if (!url) continue;
        el.src = url;
        const type = /\.mp4($|\?)/i.test(url) ? 'video/mp4' : /\.webm($|\?)/i.test(url) ? 'video/webm' : '';
        if (type) el.type = type;
      }
      video.load();
      loadedRef.current = true;
    };
    const play = () => {
      const promise = video.play();
      if (promise) promise.catch(ignoreAbort);
    };
    const stop = () => {
      disposed = true;
      if (!video.paused) video.pause();
    };
    const gated = () => isBackgroundVideoSuspended() && !video.closest('[role=dialog]');

    if (!inViewEnabled) {
      const controller = new AbortController();
      loadSources();
      if (!autoPlay)
        return () => {
          stop();
          controller.abort();
        };
      let started = false;
      const start = () => {
        if (disposed || started) return;
        started = true;
        if (disposed || gated()) return;
        play();
      };
      if (video.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) start();
      else {
        video.addEventListener('canplay', start, { once: true, signal: controller.signal });
        video.addEventListener('loadeddata', start, { once: true, signal: controller.signal });
      }
      return () => {
        stop();
        controller.abort();
      };
    }

    const leaveGroup = syncGroup ? joinSyncGroup(syncGroup, video) : undefined;
    const rootEl = scrollRoot?.current ?? null;
    const root = rootEl?.contains(video) ? rootEl : null;
    const playObserver = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;
        inViewRef.current = entry.isIntersecting;
        if (entry.isIntersecting) {
          loadSources();
          if (autoPlay && !gated()) {
            if (syncGroup) alignToGroup(syncGroup, video);
            play();
          }
        } else if (loadedRef.current && !video.paused) video.pause();
      },
      { root, threshold: observerThreshold, rootMargin: observerRootMargin },
    );
    playObserver.observe(video);

    let preloadObserver: IntersectionObserver | undefined;
    if (preloadMargin) {
      preloadObserver = new IntersectionObserver(
        (entries) => {
          if (entries[0]?.isIntersecting) {
            video.preload = 'metadata';
            loadSources();
            preloadObserver?.disconnect();
          }
        },
        { root, threshold: 0, rootMargin: preloadMargin },
      );
      preloadObserver.observe(video);
    }

    return () => {
      stop();
      playObserver.disconnect();
      preloadObserver?.disconnect();
      leaveGroup?.();
    };
    // The reference keys this effect on the joined source list, not the array identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourcesKey, autoPlay, syncGroup, scrollRoot, preload, inViewEnabled, threshold, rootMargin, preloadMargin]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || video.closest('[role=dialog]')) return;
    if (suspended) {
      if (!video.paused) video.pause();
      return;
    }
    if (autoPlay && loadedRef.current && video.paused && (!inViewEnabled || inViewRef.current)) {
      if (syncGroup) alignToGroup(syncGroup, video);
      video.play().catch(noop);
    }
  }, [suspended, autoPlay, inViewEnabled, syncGroup]);

  return (
    <video
      ref={videoRef}
      preload={preload}
      disablePictureInPicture
      controlsList="nodownload noplaybackrate"
      onContextMenu={preventDefault}
      {...props}
    >
      {sources.map((source) => (
        <source key={sourceKey(source)} media={source.media} data-src={source.src} />
      ))}
    </video>
  );
}
