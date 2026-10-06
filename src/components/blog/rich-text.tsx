// Server: renders a post body (`Block[]`) into the reference's portable-text markup. Every
// non-text block carries `rt-block` plus the spacing utilities that collapse the gap between two
// consecutive blocks; code is highlighted on the server with sugar-high (`--sh-*` colours).
import dynamic from 'next/dynamic';
import { Fragment, type ReactNode } from 'react';
import { highlight } from 'sugar-high';
import { lang as normalizeLang } from 'sugar-high/lang';
import type { Block, Inline } from '@/content/types';
import { Link } from '@/components/link';
import { Image } from '@/components/media/image';
import { MediaVideo } from '@/components/media/media-video';
import { MediaLightboxTrigger } from '@/components/window/media-lightbox-trigger';
import { cx } from '@/lib/cx';
import { Window } from '@/components/window/window';
import { EmailCaptureContent } from '@/components/email-capture';
import { BUILD_NOTES, BUILD_NOTES_AUDIENCE_IDS, BUILD_NOTES_CTA, BUILD_NOTES_LEGAL } from '@/content/home';

const Playground = dynamic(() => import('./playground').then((module) => module.Playground));

const RT_BLOCK = 'rt-block not-first:mt-[1em] not-last:mb-[1em] [.rt-block+&]:mt-0';
const LINK = 'underline underline-offset-2 hover:decoration-dashed';

/** Text with `\n` turned into <br /> as portable text does. */
function Text({ value }: { value: string }) {
  const lines = value.split('\n');
  return lines.map((line, i) => (
    <Fragment key={i}>
      {i > 0 && <br />}
      {line}
    </Fragment>
  ));
}

function Span({ value }: { value: Inline }) {
  if (typeof value === 'string') return <Text value={value} />;
  let node: ReactNode = <Text value={value.t} />;
  if (value.code) node = <code className="rounded-4 bg-theme-fg/10 p-2 font-mono">{node}</code>;
  if (value.b) node = <strong className="font-semibold">{node}</strong>;
  if (value.i) node = <em className="italic">{node}</em>;
  if (value.href) {
    const external = /^(https?:)?\/\//.test(value.href) || value.href.startsWith('mailto:');
    node = (
      <Link
        href={value.href}
        className={LINK}
        target={external && !value.href.startsWith('mailto:') ? '_blank' : undefined}
        rel={external && !value.href.startsWith('mailto:') ? 'noopener' : undefined}
      >
        {node}
      </Link>
    );
  }
  return node;
}

export function Inlines({ value }: { value: Inline[] }) {
  return value.map((span, i) => <Span key={i} value={span} />);
}

function RichBlock({ block }: { block: Block }) {
  switch (block._type) {
    case 'p':
      return (
        <p>
          <Inlines value={block.text} />
        </p>
      );
    case 'h2':
      return (
        <h2 id={block.id} className="not-first:mt-[1em] font-semibold text-[200%]">
          <Inlines value={block.text} />
        </h2>
      );
    case 'h3':
      return (
        <h3 id={block.id} className="not-first:mt-[1em] font-semibold text-[150%]">
          <Inlines value={block.text} />
        </h3>
      );
    case 'ul':
      return (
        <ul className="flex list-disc flex-col gap-8 pl-[1em]">
          {block.items.map((item, i) => (
            <li key={i}>
              <Inlines value={item} />
            </li>
          ))}
        </ul>
      );
    case 'ol':
      return (
        <ol className="flex list-decimal flex-col gap-8 pl-[1.2em]">
          {block.items.map((item, i) => (
            <li key={i}>
              <Inlines value={item} />
            </li>
          ))}
        </ol>
      );
    case 'quote':
      return (
        <div className={cx(RT_BLOCK, 'flex flex-col gap-4 border-theme-fg/30 border-l-2 pl-8')}>
          <blockquote className="whitespace-pre-line italic">
            <Inlines value={block.text} />
          </blockquote>
        </div>
      );
    case 'code':
      return (
        <pre className={cx(RT_BLOCK, 'block w-full overflow-x-auto rounded-4 border border-theme-fg/30 bg-theme-bg p-16')}>
          <code dangerouslySetInnerHTML={{ __html: highlight(block.code, { lang: normalizeLang(block.lang) }) }} />
        </pre>
      );
    case 'media': {
      const { media, caption } = block;
      return (
        <figure className={cx(RT_BLOCK, 'flex flex-col gap-8')}>
          <MediaLightboxTrigger value={{ ...media, isLightbox: true }}>
            {media._type === 'image' ? (
              <Image image={media.image} className="w-full" sizes="lg:50vw" />
            ) : (
              <MediaVideo video={media} quality="720" className="w-full" playsInline inViewPlayback={{ enabled: true }} />
            )}
          </MediaLightboxTrigger>
          {caption && (
            <figcaption className="text-body-14 text-theme-fg/50">
              <div className="flex flex-col gap-[1em]">
                <p>{caption}</p>
              </div>
            </figcaption>
          )}
        </figure>
      );
    }
    case 'hr':
      return <div className="rt-block not-first:mt-[2em] h-1 w-full bg-theme-fg/30 [.rt-block+&]:mt-0" aria-hidden="true" />;
    case 'playground':
      return (
        <Playground
          className={RT_BLOCK}
          id={block.id}
          title={block.title}
          code={block.code}
          dependencies={block.dependencies}
          view={block.view ?? 'split'}
          height={block.height}
        />
      );
    case 'table':
      return (
        <section
          aria-label="Table"
          tabIndex={0}
          className={cx(RT_BLOCK, 'w-full overflow-x-auto focus-visible:outline-2 focus-visible:outline-theme-fg')}
        >
          <table className="w-full border-collapse text-left">
            {block.head && block.head.length > 0 && (
              <thead>
                <tr>
                  {block.head.map((cell, i) => (
                    <th key={i} scope="col" className="whitespace-nowrap border-theme-fg/30 border-b px-8 py-4 font-semibold">
                      <Inlines value={cell} />
                    </th>
                  ))}
                </tr>
              </thead>
            )}
            <tbody>
              {block.rows.map((row, r) => (
                <tr key={r}>
                  {row.map((cell, c) => (
                    <td key={c} className="border-theme-fg/15 border-b px-8 py-4">
                      <Inlines value={cell} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      );
    case 'buildNotes':
      return (
        <Window id={`email-capture-${block.id}`} left={<h2>Build Notes</h2>} allowFullscreen={false} draggable className={RT_BLOCK}>
          <EmailCaptureContent text={BUILD_NOTES} ctaText={BUILD_NOTES_CTA} audienceIds={BUILD_NOTES_AUDIENCE_IDS} legalText={BUILD_NOTES_LEGAL} />
        </Window>
      );
    default:
      return null;
  }
}

export function RichText({ blocks, className }: { blocks: Block[]; className?: string }) {
  return (
    <div className={cx('flex flex-col gap-[1em]', className)}>
      {blocks.map((block, i) => (
        <RichBlock key={i} block={block} />
      ))}
    </div>
  );
}
