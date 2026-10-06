'use client';

// Module 171797. An EntryLine for a blog article: active (and linking back to /blog) while its
// post is open, optionally showing the excerpt under the title, optionally tracked as a quick
// action click.
import { usePathname } from 'next/navigation';
import type { MouseEvent } from 'react';
import { track } from '@/lib/track';
import { EntryLine, type EntryLineProps } from './entry-line';

export type ArticleLineArticle = {
  _id?: string;
  href: string;
  title?: string | null;
  excerpt?: string | null;
};

export type ArticleLineProps = Omit<EntryLineProps, 'title' | 'href' | 'active' | 'children'> & {
  article: ArticleLineArticle;
  showExcerpt?: boolean;
  trackClick?: { panel: string };
};

export function ArticleLine({ article, showExcerpt = false, trackClick, className, onClick, ...props }: ArticleLineProps) {
  const active = usePathname() === article.href;
  const href = active ? '/blog' : article.href;
  const title = article.title ?? '';

  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event);
    if (!event.defaultPrevented && trackClick) {
      track('quick_action_click', {
        panel: trackClick.panel,
        href: href.slice(0, 500),
        title: (article.title ?? '').slice(0, 500),
      });
    }
  };

  return (
    <EntryLine title={title} href={href} active={active} className={className} onClick={handleClick} {...props}>
      {showExcerpt && article.excerpt && (
        <p className="mt-4 ml-[calc(1em+--spacing(4))] text-theme-fg/50">{article.excerpt}</p>
      )}
    </EntryLine>
  );
}
