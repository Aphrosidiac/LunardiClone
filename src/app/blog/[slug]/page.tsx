// The reference's `(template)` route: list window (hidden below lg) beside the post window, each
// behind its own Suspense skeleton.
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { ArticleList, ArticleListSkeleton } from '@/components/blog/article-list';
import { ArticleWindow, ArticleWindowSkeleton } from '@/components/blog/article-window';
import { ARTICLES } from '@/content/blog';
import { SITE } from '@/content/site';

type Params = { slug: string };

export const dynamicParams = false;

export function generateStaticParams(): Params[] {
  return ARTICLES.map((article) => ({ slug: article.slug }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await params;
  const article = ARTICLES.find((entry) => entry.slug === slug);
  if (!article) return {};
  const title = `${article.title} | ${SITE.name}`;
  return {
    title: { absolute: title },
    description: article.excerpt,
    alternates: { canonical: article.href },
    openGraph: {
      title,
      description: article.excerpt,
      url: article.href,
      type: 'article',
      publishedTime: article.publishedAt,
      authors: [article.author],
    },
    twitter: { card: 'summary_large_image', title, description: article.excerpt },
  };
}

export default async function ArticlePage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const article = ARTICLES.find((entry) => entry.slug === slug);
  if (!article) notFound();

  const url = `${SITE.url}${article.href}`;
  const webPage = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage',
        '@id': `${url}#webpage`,
        url,
        name: article.title,
        description: article.excerpt,
        isPartOf: { '@id': `${SITE.url}/#website` },
        inLanguage: 'en',
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE.url}/` },
          { '@type': 'ListItem', position: 2, name: 'Blog', item: `${SITE.url}/blog` },
          { '@type': 'ListItem', position: 3, name: article.title, item: url },
        ],
      },
    ],
  };
  const posting = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: article.title,
    description: article.excerpt,
    url,
    mainEntityOfPage: `${url}#webpage`,
    datePublished: article.publishedAt,
    author: { '@type': 'Organization', name: article.author },
    publisher: { '@id': `${SITE.url}/#org` },
  };

  return (
    <div className="grid size-full flex-1 auto-rows-fr grid-cols-12 gap-16">
      <Suspense fallback={<ArticleListSkeleton detail />}>
        <ArticleList detail />
      </Suspense>
      <Suspense fallback={<ArticleWindowSkeleton />}>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(webPage) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(posting) }} />
        <ArticleWindow article={article} />
      </Suspense>
    </div>
  );
}
