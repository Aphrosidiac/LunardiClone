// Content model. Shapes deliberately mirror what the reference's server components hand to its
// client components (see docs/reference/2026-10-06/jsx/*.jsx), minus the Sanity specifics, so
// ported components keep their props unchanged.

/** A raster image we host. Width variants live beside it as `<stem>-<w>.webp`. */
export type Img = {
  /** Path of the largest variant, e.g. `/media/works/ff-search/home.webp`. */
  src: string;
  width: number;
  height: number;
  alt: string;
  /** Tiny base64 placeholder (`data:image/webp;base64,…`). */
  lqip?: string;
  /** Widths that exist on disk as `<stem>-<w>.webp`; the largest is `src` itself. */
  widths?: number[];
};

/** One encoded height of a video, as the reference's resolution ladder stores it. */
export type Rendition = {
  /** `original` or a tier height such as `240`, `480`, `720`. */
  quality: string;
  url: string;
  poster?: string;
};

/** Media block in a work's gallery, a lab entry, etc. Mirrors the reference payload. */
export type MediaItem =
  | {
      _key: string;
      _type: 'video';
      dimensions: { width: number; height: number };
      placeholder?: string;
      playback: { autoplay: boolean | null; controls: boolean | null; loop: boolean | null; muted: boolean | null };
      renditions: Rendition[];
    }
  | {
      _key: string;
      _type: 'image';
      dimensions: { width: number; height: number };
      placeholder?: string;
      image: Img;
    };

export type Credit = { label: string; value: string; href?: string };

export type Work = {
  _id: string;
  slug: string;
  href: string;
  title: string;
  /** Group in the works list: `Work` or `Recreations`. */
  group: 'work' | 'recreation';
  client: string;
  year: number;
  stack: string[];
  link?: { label: string; href: string };
  credits: Credit[];
  description: string;
  media: MediaItem[];
};

export type Article = {
  _id: string;
  slug: string;
  href: string;
  title: string;
  excerpt: string;
  publishedAt: string; // ISO date
  readingMinutes: number;
  author: string;
  /** Rich text body as an ordered list of blocks. */
  body: Block[];
};

export type Publication = { _id: string; title: string; href: string };

export type Block =
  | { _type: 'p'; text: Inline[] }
  | { _type: 'h2' | 'h3'; text: Inline[]; id?: string }
  | { _type: 'ul' | 'ol'; items: Inline[][] }
  | { _type: 'quote'; text: Inline[] }
  | { _type: 'code'; lang: string; code: string; filename?: string }
  | { _type: 'media'; media: MediaItem; caption?: string }
  | { _type: 'hr' }
  // Appended by slice E (blog rich text):
  /** Runnable code window (reference Playground). `code` is TS/TSX run in a sandboxed iframe. */
  | {
      _type: 'playground';
      id: string;
      title?: string;
      code: string;
      /** Extra esm.sh packages, e.g. `three@0.180.0`; React/ReactDOM are always mapped. */
      dependencies?: string[];
      view?: 'editor' | 'split' | 'preview';
      /** Pane height in px (default 420). */
      height?: number;
    }
  /** Data table: header cells and body rows of rich-text cells. */
  | { _type: 'table'; head?: Inline[][]; rows: Inline[][][] }
  /** The Build Notes signup window the reference drops at the end of each post. */
  | { _type: 'buildNotes'; id: string };

export type Inline = string | { t: string; b?: boolean; i?: boolean; code?: boolean; href?: string };

export type Experiment = {
  _id: string;
  slug: string;
  href: string;
  title: string;
  year: number;
  description: string;
  stack: string[];
  /** Position on the infinite canvas, in canvas units. */
  media: MediaItem[];
};

/** The Awards slot. FF has no awards, so this grid shows captured screens of shipped sites. */
export type Shot = {
  _id: string;
  href: string;
  title: string;
  /** e.g. `FF Search · Home` */
  subtitle: string;
  date: string;
  image: Img;
  site?: string;
};
