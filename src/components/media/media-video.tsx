'use client';

// Module 380103 (SanityVideo → MediaVideo). Turns a video media item's rendition ladder into
// <Video> sources. `quality` is either a rung (`'720'`, `'original'`) or a responsive list in the
// `sizes` style — `"(min-width: 48rem) original, 720"` — which becomes one <source media> per
// condition plus a fallback; trailing media sources that resolve to the fallback URL are dropped.
import type { CSSProperties } from 'react';
import type { MediaItem, Rendition } from '@/content/types';
import { pickRendition } from './tiers';
import { Video, type VideoProps, type VideoSource } from './video';

type VideoItem = Extract<MediaItem, { _type: 'video' }>;

/** The fields MediaVideo reads. A `MediaItem` of `_type: 'video'` satisfies it. */
export type MediaVideoSource = {
  dimensions?: Partial<VideoItem['dimensions']> | null;
  placeholder?: string | null;
  playback?: Partial<VideoItem['playback']> | null;
  renditions?: Rendition[] | null;
};

export type QualityEntry = { media?: string; quality: string };

export type MediaVideoProps = Omit<VideoProps, 'sources' | 'src'> & {
  video: MediaVideoSource | null | undefined;
  /** `'original'` (default), a rung height, a responsive string, or parsed entries. */
  quality?: string | QualityEntry[];
  /** Shared videos (same file shown in several places) sync up and only play in view. */
  shared?: boolean;
};

function splitTopLevelCommas(value: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < value.length; i++) {
    const char = value[i];
    if (char === '(') depth++;
    else if (char === ')') depth = Math.max(0, depth - 1);
    else if (char === ',' && depth === 0) {
      parts.push(value.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(value.slice(start));
  return parts.map((part) => part.trim()).filter(Boolean);
}

function parseQuality(quality: string, entry: string): string {
  if (quality === 'original' || /^\d+$/.test(quality)) return quality;
  throw new Error(`Invalid quality "${quality}" in "${entry}": end each entry with a tier height like 720, or original.`);
}

function parseQualityList(value: string): QualityEntry[] {
  return splitTopLevelCommas(value).map((entry) => {
    const space = entry.lastIndexOf(' ');
    const media = space === -1 ? '' : entry.slice(0, space).trim();
    const quality = parseQuality(entry.slice(space + 1), entry);
    return media ? { media, quality } : { quality };
  });
}

function resolveSources(renditions: Rendition[], quality: string | QualityEntry[]): VideoSource[] {
  const entries = typeof quality === 'string' ? parseQualityList(quality) : quality;
  const fallbackIndex = entries.findIndex((entry) => !entry.media?.trim());
  const conditional = fallbackIndex === -1 ? entries : entries.slice(0, fallbackIndex);
  const urlFor = (q: string) => pickRendition(renditions, q)?.url ?? undefined;

  const fallback = urlFor(fallbackIndex === -1 ? 'original' : (entries[fallbackIndex]?.quality ?? 'original'));
  if (!fallback) return [];

  const sources = conditional.flatMap((entry) => {
    const url = urlFor(entry.quality);
    return url && entry.media ? [{ media: entry.media.trim(), src: url }] : [];
  });
  let end = sources.length;
  while (end > 0 && sources[end - 1]?.src === fallback) end--;
  return [...sources.slice(0, end), { src: fallback }];
}

export function MediaVideo({ video, quality = 'original', shared = false, ...props }: MediaVideoProps) {
  if (!video) return null;

  const sources = resolveSources(video.renditions ?? [], quality);
  const firstSrc = sources[0]?.src;
  if (!firstSrc) return null;

  const width = video.dimensions?.width;
  const height = video.dimensions?.height;
  const poster = video.placeholder ?? undefined;
  const { className, style, ...rest } = props;
  const aspectRatio = width && height ? width / height : undefined;
  const mergedStyle: CSSProperties = { aspectRatio, ...style };

  const playback = video.playback;
  const autoPlay = playback?.autoplay ?? true;
  const muted = playback?.muted ?? true;
  const loop = playback?.loop ?? true;
  const controls = playback?.controls ?? false;

  const sharedProps = shared
    ? { syncGroup: firstSrc, inViewPlayback: { enabled: true, rootMargin: '400px', preloadMargin: '800px' } }
    : null;

  return (
    <Video
      sources={sources}
      poster={poster}
      style={mergedStyle}
      autoPlay={autoPlay}
      muted={muted}
      loop={loop}
      controls={controls}
      className={className}
      {...rest}
      {...sharedProps}
    />
  );
}
