import type { SearchRecord } from '@/components/header/search-input';
import { WORKS } from './works';
import { ARTICLES, PUBLICATIONS } from './blog';
import { EXPERIMENTS } from './lab';

// The header search index (reference: /api/search over Sanity). Built from the same content
// modules the pages render, so it can never list something that does not exist.

const text = (blocks: (typeof ARTICLES)[number]['body']) =>
  blocks
    .flatMap((b) => ('text' in b ? b.text : 'items' in b ? b.items.flat() : []))
    .map((i) => (typeof i === 'string' ? i : i.t))
    .join(' ')
    .slice(0, 4000);

export const SEARCH_INDEX: SearchRecord[] = [
  ...WORKS.map((w) => ({ _type: 'work', title: w.title, url: w.href, client: w.client, description: w.description, stack: w.stack })),
  ...ARTICLES.map((a) => ({ _type: 'article', title: a.title, url: a.href, excerpt: a.excerpt, body: text(a.body) })),
  ...PUBLICATIONS.map((p) => ({ _type: 'publication', title: p.title, url: p.href })),
  ...EXPERIMENTS.map((e) => ({ _type: 'experiment', title: e.title, url: e.href, description: e.description, stack: e.stack })),
];
