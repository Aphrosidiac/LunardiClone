// Server: the `article-<id>` post window — `[AUTHOR] [PUBLISHED] [READING TIME] [EXCERPT]`
// header table, then the rich-text body centred at max 800px — and its Suspense skeleton.
import type { ReactNode } from 'react';
import type { Article } from '@/content/types';
import { LineSkel, TableRowSkeleton, WindowSkeleton } from '@/components/lines/list-window';
import { CloseLink } from '@/components/works/work-window';
import { Window } from '@/components/window/window';
import { RichText } from './rich-text';
import { SITE } from '@/content/site';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** `1 Aug 2025` — the reference's date format (always "Sep", never "Sept"). */
export function formatPublished(iso: string): string {
  const date = new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso);
  return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

function HeaderRow({ label, children }: { label: string; children?: ReactNode }) {
  return (
    <div className="grid grid-cols-2 gap-16 font-mono">
      <span className="uppercase">{label}</span>
      {children}
    </div>
  );
}

export function ArticleWindow({ article }: { article: Article }) {
  return (
    <Window
      id={`article-${article._id}`}
      left={<h1 className="truncate">{article.title}</h1>}
      right={<CloseLink href="/blog" />}
      className="size-full col-span-full lg:col-span-8"
      showScrollProgress
    >
      <div className="col-span-full flex flex-col gap-4 border-theme-fg/30 border-b pb-4 lg:col-span-4">
        <HeaderRow label="[Author]">
          <span>{article.author}</span>
        </HeaderRow>
        <HeaderRow label="[Published]">
          <span>{formatPublished(article.publishedAt)}</span>
        </HeaderRow>
        <HeaderRow label="[Reading time]">
          <span>{article.readingMinutes} min</span>
        </HeaderRow>
        {article.excerpt && (
          <HeaderRow label="[Excerpt]">
            <p className="whitespace-pre-line">{article.excerpt}</p>
          </HeaderRow>
        )}
      </div>
      <RichText
        blocks={[
          ...article.body,
          // Reference posts close with the Build Notes window, a rule and an italic follow line.
          { _type: 'buildNotes', id: article._id },
          { _type: 'hr' },
          {
            _type: 'p',
            text: [
              { t: 'Enjoyed the read? The studio is at ', i: true },
              { t: 'ffdev.studio', i: true, href: 'https://ffdev.studio' },
              { t: ', and new projects start on ', i: true },
              { t: 'WhatsApp', i: true, href: SITE.whatsapp },
              { t: '.', i: true },
            ],
          },
        ]}
        className="mx-auto w-full max-w-800 py-16"
      />
    </Window>
  );
}

const HEADER_ROWS = ['50%', '40%', '24%', '90%'];
const BODY_LINES = ['100%', '98%', '94%', '62%', '0%', '100%', '96%', '99%', '90%', '48%'];

export function ArticleWindowSkeleton() {
  return (
    <WindowSkeleton className="size-full col-span-full lg:col-span-8" titleWidth="w-240" controls={3}>
      <div className="flex flex-col gap-4 border-theme-fg/30 border-b pb-4">
        {HEADER_ROWS.map((width) => (
          <TableRowSkeleton key={width} width={width} />
        ))}
      </div>
      <div className="flex flex-col mx-auto w-full max-w-800 py-16">
        {BODY_LINES.map((width, i) => (
          <LineSkel key={i} width={width} />
        ))}
      </div>
    </WindowSkeleton>
  );
}
