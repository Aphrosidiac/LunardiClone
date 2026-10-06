// Server: the `article-list` window (groups "Notes ↴" and "Publications ↴") and its skeleton.
import { ArticleLine } from '@/components/lines/article-line';
import { EntryLine } from '@/components/lines/entry-line';
import { ListGroup, ListWindow, ListWindowSkeleton } from '@/components/lines/list-window';
import { ARTICLES, BLOG_BLURB, PUBLICATIONS } from '@/content/blog';

export function ArticleList({ detail = false }: { detail?: boolean }) {
  const titleAs = detail ? 'span' : 'h2';
  const headingAs = detail ? 'p' : 'h3';
  return (
    <ListWindow id="article-list" count={ARTICLES.length + PUBLICATIONS.length} detail={detail} blurb={BLOG_BLURB}>
      {ARTICLES.length > 0 && (
        <ListGroup label="Notes" headingAs={headingAs}>
          {ARTICLES.map((article) => (
            <li key={article._id}>
              <ArticleLine
                article={{ _id: article._id, excerpt: article.excerpt, href: article.href, title: article.title }}
                titleAs={titleAs}
              />
            </li>
          ))}
        </ListGroup>
      )}
      {PUBLICATIONS.length > 0 && (
        <ListGroup label="Publications" headingAs={headingAs}>
          {PUBLICATIONS.map((publication) => (
            <li key={publication._id}>
              <EntryLine title={publication.title} href={publication.href} titleAs={titleAs} target="_blank" />
            </li>
          ))}
        </ListGroup>
      )}
    </ListWindow>
  );
}

/** Reference skeleton: 13 note rows + 6 publication rows. */
export function ArticleListSkeleton({ detail = false }: { detail?: boolean }) {
  return (
    <ListWindowSkeleton
      className={detail ? 'size-full col-span-4 hidden lg:flex' : 'size-full'}
      groups={[
        { label: 'Notes', rows: 13 },
        { label: 'Publications', rows: 6 },
      ]}
    />
  );
}
