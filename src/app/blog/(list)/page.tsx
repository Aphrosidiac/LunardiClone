import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ArticleList, ArticleListSkeleton } from '@/components/blog/article-list';
import { ARTICLES, BLOG_BLURB } from '@/content/blog';
import { SITE } from '@/content/site';

const TITLE = `Blog | ${SITE.name}`;

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: BLOG_BLURB,
  alternates: { canonical: '/blog' },
  openGraph: { title: TITLE, description: BLOG_BLURB, url: '/blog', type: 'website' },
  twitter: { card: 'summary_large_image', title: TITLE, description: BLOG_BLURB },
};

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Blog',
      '@id': `${SITE.url}/blog#webpage`,
      url: `${SITE.url}/blog`,
      name: TITLE,
      description: BLOG_BLURB,
      isPartOf: { '@id': `${SITE.url}/#website` },
      publisher: { '@id': `${SITE.url}/#org` },
      inLanguage: 'en',
      blogPost: ARTICLES.map((article) => ({
        '@type': 'BlogPosting',
        headline: article.title,
        description: article.excerpt,
        url: `${SITE.url}${article.href}`,
        datePublished: article.publishedAt,
      })),
    },
  ],
};

export default function BlogPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <h1 className="sr-only">Blog</h1>
      <Suspense fallback={<ArticleListSkeleton />}>
        <ArticleList />
      </Suspense>
    </>
  );
}
