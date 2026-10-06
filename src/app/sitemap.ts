import type { MetadataRoute } from 'next';
import { SITE } from '@/content/site';
import { WORKS } from '@/content/works';
import { ARTICLES } from '@/content/blog';
import { EXPERIMENTS } from '@/content/lab';

export const dynamic = 'force-static';

export default function sitemap(): MetadataRoute.Sitemap {
  const at = (path: string) => `${SITE.url}${path}`;
  return [
    ...['/', '/works', '/blog', '/lab', '/shots'].map((p) => ({ url: at(p) })),
    ...WORKS.map((w) => ({ url: at(w.href) })),
    ...ARTICLES.map((a) => ({ url: at(a.href), lastModified: a.publishedAt })),
    ...EXPERIMENTS.map((e) => ({ url: at(e.href) })),
  ];
}
