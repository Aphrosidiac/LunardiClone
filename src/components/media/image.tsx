'use client';

// Module 122719 (SanityImage → Image). Same props and markup as the reference — a
// `<picture class="contents">` around an <img> with an LQIP background until it loads — but the
// srcset comes from our own width variants (`<stem>-<w>.webp`, see `Img.widths`) instead of the
// Sanity image CDN, so crops cannot be generated: `aspectRatio` only sets the width/height
// attributes, exactly as the reference's attribute maths does.
import { useCallback, useEffect, useRef, useState, type CSSProperties, type ImgHTMLAttributes, type Ref } from 'react';
import { preload } from 'react-dom';
import type { Img } from '@/content/types';
import { useComposedRefs } from '@/lib/compose-refs';
import { cx } from '@/lib/cx';
import { screens } from '@/lib/screens';
import { run } from '@/lib/utils';

type Breakpoint = keyof typeof screens;
type ResponsiveEntry = { value: string; resolvedWidth?: string };

const DEFAULT_SOURCE_WIDTHS = [600, 1024, 1440, 2048];
const MAX_DIMENSION = 3840;

function remToNumber(value: string) {
  return Number.parseFloat(value.replace('rem', ''));
}

/** Parses `"50vw lg:20vw"`-style responsive values, largest breakpoint first, DEFAULT last. */
function parseResponsive(value: string): Record<string, ResponsiveEntry> {
  const entries: Record<string, ResponsiveEntry> = {};
  const names = Object.keys(screens).join('|');
  const pattern = new RegExp(`^(${names}):(.+)$`);
  for (const token of value.split(/\s+/)) {
    const match = token.match(pattern);
    if (match) {
      const [, bp, v] = match;
      if (v && bp) entries[bp] = { value: v, resolvedWidth: screens[bp as Breakpoint] };
    } else entries.DEFAULT = { value: token };
  }
  return Object.fromEntries(
    Object.entries(entries).sort(([, { resolvedWidth: a }], [, { resolvedWidth: b }]) =>
      a || b ? (a ? (b ? remToNumber(b) - remToNumber(a) : -1) : 1) : 0,
    ),
  );
}

function toSizes(value: string): string {
  let fallback = '100vw';
  const queries = Object.entries(parseResponsive(value))
    .map(([bp, { value: v, resolvedWidth }]) => (bp === 'DEFAULT' ? ((fallback = v), null) : `(min-width: ${resolvedWidth}) ${v}`))
    .filter(Boolean);
  return queries.length ? `${queries.join(', ')}, ${fallback}` : fallback;
}

function parseAspectRatio(value: string) {
  const [w = 1, h = 1] = value.split(/[:/]/).map(Number);
  return w / h;
}

type SizeOptions = { width?: number; height?: number; aspectRatio?: number; maxWidth?: number; maxHeight?: number };

function resolveDimensions(image: Img, options: SizeOptions = {}) {
  const { width, height, aspectRatio, maxWidth = MAX_DIMENSION, maxHeight = MAX_DIMENSION } = options;
  const intrinsicRatio = image.width && image.height ? image.width / image.height : undefined;
  const ratio = aspectRatio ?? intrinsicRatio;
  const fallbackWidth = Math.min(DEFAULT_SOURCE_WIDTHS[DEFAULT_SOURCE_WIDTHS.length - 1], image.width ?? Infinity);

  const fromSize = (w: number | undefined, h: number | undefined): { width: number; height: number } => {
    if (w && h) return { width: w, height: h };
    if (w && !h) return ratio ? { width: w, height: Math.round(w / ratio) } : { width: w, height: w };
    if (h && !w) return ratio ? { width: Math.round(h * ratio), height: h } : { width: h, height: h };
    return fromSize(fallbackWidth, undefined);
  };

  let { width: w, height: h } = fromSize(width, height);
  if (maxWidth && w > maxWidth) {
    const scale = maxWidth / w;
    w = maxWidth;
    h = Math.round(h * scale);
  }
  if (maxHeight && h > maxHeight) {
    const scale = maxHeight / h;
    h = maxHeight;
    w = Math.round(w * scale);
  }
  return { width: w, height: h };
}

/** Every width we have on disk for this image, ascending, each with its URL. */
function variants(image: Img): { width: number; url: string }[] {
  const stem = image.src.replace(/\.[^./]+$/, '');
  const list = (image.widths ?? [])
    .filter((w) => w < image.width)
    .map((w) => ({ width: w, url: `${stem}-${w}.webp` }));
  list.push({ width: image.width, url: image.src });
  return list.sort((a, b) => a.width - b.width);
}

function variantFor(image: Img, width: number) {
  const list = variants(image);
  return list.find((v) => v.width >= width) ?? list[list.length - 1];
}

function buildSrc(image: Img, options: SizeOptions) {
  return variantFor(image, resolveDimensions(image, options).width).url;
}

function buildSrcSet(image: Img, options: SizeOptions) {
  const intrinsicWidth = image.width;
  return run(() => {
    if (options.width || options.height || (intrinsicWidth && intrinsicWidth < DEFAULT_SOURCE_WIDTHS[0])) {
      const display = resolveDimensions(image, options).width;
      return [2, 3].map((dpr) => `${variantFor(image, display * dpr).url} ${dpr}x`);
    }
    return variants(image).map((v) => `${v.url} ${v.width}w`);
  }).join(', ');
}

type ResponsiveImgProps = ImgHTMLAttributes<HTMLImageElement> & {
  ref?: Ref<HTMLImageElement>;
  priority?: boolean;
  src: string;
};

function ResponsiveImg({
  sizes,
  src,
  srcSet,
  priority,
  alt = '',
  loading = priority ? 'eager' : 'lazy',
  decoding = loading === 'lazy' ? 'async' : 'auto',
  ...props
}: ResponsiveImgProps) {
  if (priority) preload(src, { as: 'image', fetchPriority: 'high' });
  return (
    <img
      loading={loading}
      decoding={decoding}
      alt={alt}
      src={src}
      srcSet={srcSet}
      sizes={sizes ? toSizes(sizes) : undefined}
      {...props}
    />
  );
}

function useImageLoaded() {
  const [loaded, setLoaded] = useState(false);
  const ref = useRef<HTMLImageElement | null>(null);
  const onLoaded = useCallback(() => setLoaded(true), []);
  useEffect(() => {
    if (ref.current?.complete) onLoaded();
  }, [onLoaded]);
  return [ref, loaded, onLoaded] as const;
}

export type ImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, 'src' | 'srcSet' | 'width' | 'height'> & {
  ref?: Ref<HTMLImageElement>;
  image: Img | null | undefined;
  /** `"16:9"`, `"4/5"`, or responsive (`"1:1 lg:16:9"`). */
  aspectRatio?: string;
  /** Sanity image-builder options in the reference; accepted for API parity (width/height/aspectRatio honoured). */
  builderOptions?: SizeOptions;
  /** Responsive sizes, `"50vw lg:20vw"` style. */
  sizes?: string;
  width?: number | string;
  height?: number | string;
  noPlaceholder?: boolean;
  priority?: boolean;
};

export function Image({
  image,
  aspectRatio,
  builderOptions,
  style,
  alt,
  sizes,
  onLoad,
  width,
  height,
  noPlaceholder,
  className,
  ref,
  ...props
}: ImageProps) {
  const [loadedRef, loaded, markLoaded] = useImageLoaded();
  const imgRef = useComposedRefs(loadedRef, ref);
  const handleLoad: ImgHTMLAttributes<HTMLImageElement>['onLoad'] = (event) => {
    markLoaded();
    onLoad?.(event);
  };

  if (!image?.src) return null;

  const pictureSources = run(() => {
    if (!aspectRatio) return undefined;
    return Object.entries(parseResponsive(String(aspectRatio)))
      .map(([bp, { value, resolvedWidth }]) => {
        if (!resolvedWidth) return null;
        const options: SizeOptions = {
          width: width ? Number(width) : undefined,
          height: height ? Number(height) : undefined,
          aspectRatio: value ? parseAspectRatio(value) : undefined,
          ...builderOptions,
        };
        const dims = resolveDimensions(image, options);
        return {
          bp,
          srcSet: buildSrcSet(image, options),
          sizes: sizes ? toSizes(sizes) : undefined,
          width: dims.width,
          height: dims.height,
          media: `(min-width: ${resolvedWidth})`,
        };
      })
      .filter((s) => !!s);
  });

  const defaultAspect = run(() => {
    if (!aspectRatio) return undefined;
    const value = parseResponsive(String(aspectRatio)).DEFAULT?.value;
    return value ? parseAspectRatio(value) : undefined;
  });
  const options: SizeOptions = {
    width: width ? Number(width) : undefined,
    height: height ? Number(height) : undefined,
    aspectRatio: defaultAspect,
    ...builderOptions,
  };
  const dims = resolveDimensions(image, options);
  const src = buildSrc(image, options);
  const srcSet = buildSrcSet(image, options);

  const placeholder: CSSProperties | null | undefined =
    loaded || noPlaceholder ? undefined : image.lqip ? { backgroundImage: `url(${image.lqip})`, backgroundSize: 'cover' } : null;
  const resolvedAlt = alt ?? image.alt ?? '';
  const mergedStyle = {
    '--desired-width': width ? `${width}px` : 'auto',
    '--desired-height': height ? `${height}px` : 'auto',
    ...placeholder,
    ...style,
  } as CSSProperties;

  return (
    <picture className="contents">
      {pictureSources?.map(({ bp, ...source }) => <source key={bp} {...source} />)}
      <ResponsiveImg
        {...props}
        ref={imgRef}
        onLoad={handleLoad}
        src={src}
        sizes={sizes}
        srcSet={srcSet}
        alt={resolvedAlt}
        width={dims.width}
        height={dims.height}
        style={mergedStyle}
        className={cx('h-(--desired-height,auto) w-(--desired-width,auto) max-w-full', className)}
      />
    </picture>
  );
}
