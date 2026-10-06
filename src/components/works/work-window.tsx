// Server: the `work-<id>` detail window — credits table + description on the left (WorkDetails),
// the media grid on an InfiniteScroll on the right, the hash-driven media lightbox — and its
// Suspense skeleton.
import { Fragment, type ReactNode } from 'react';
import type { Work } from '@/content/types';
import { Icon } from '@/components/icon';
import { Link } from '@/components/link';
import { LineSkel, Skel, TableRowSkeleton, WindowSkeleton } from '@/components/lines/list-window';
import { Image } from '@/components/media/image';
import { MediaVideo } from '@/components/media/media-video';
import { Window } from '@/components/window/window';
import { cx } from '@/lib/cx';
import { InfiniteScroll } from './infinite-scroll';
import { WorkDescription } from './work-description';
import { WorkDetails } from './work-details';
import { WorkMediaLightbox } from './work-media-lightbox';

const CLOSE_CONTROL =
  'hit-x-2 hit-y-6 flex size-13 cursor-pointer items-center rounded-full border border-transparent bg-theme-fg text-theme-bg hover:border-theme-fg hover:bg-transparent hover:text-theme-fg';

const LINK = 'break-all underline underline-offset-2';

export function CloseLink({ href }: { href: string }) {
  return (
    <Link href={href} className={CLOSE_CONTROL} aria-label="Close">
      <Icon name="close" className="size-full" />
    </Link>
  );
}

function CreditRow({ label, children }: { label: string; children?: ReactNode }) {
  return (
    <div className="grid grid-cols-2 gap-16 font-mono">
      <span className="uppercase">[{label}]</span>
      {children}
    </div>
  );
}

/** Plain-text rich text the reference stores for descriptions: one <p> per blank-line block. */
function Paragraphs({ text }: { text: string }) {
  return (
    <div className="flex flex-col gap-[1em]">
      {text
        .split(/\n\s*\n/)
        .map((paragraph) => paragraph.trim())
        .filter(Boolean)
        .map((paragraph, i) => (
          <p key={i}>{paragraph}</p>
        ))}
    </div>
  );
}

export function WorkWindow({ work }: { work: Work }) {
  const hasClientCredit = work.credits.some((credit) => credit.label.toLowerCase() === 'client');
  const total = work.media.length;

  return (
    <Window
      id={`work-${work._id}`}
      left={<h1 className="truncate">{work.title}</h1>}
      right={<CloseLink href="/works" />}
      className="size-full col-span-full lg:col-span-8"
    >
      <div className="grid h-full grid-cols-12 gap-16">
        <WorkDetails className="col-span-full flex flex-col gap-4 lg:col-span-4">
          {!hasClientCredit && work.client && <CreditRow label="Client">{work.client}</CreditRow>}
          {work.credits.map((credit) => (
            <CreditRow key={credit.label} label={credit.label}>
              {credit.href ? (
                <Link href={credit.href} className={LINK} target="_blank" rel="noopener">
                  {credit.value}
                </Link>
              ) : (
                credit.value
              )}
            </CreditRow>
          ))}
          <CreditRow label="Year">{work.year}</CreditRow>
          {work.stack.length > 0 && <CreditRow label="Stack">{work.stack.join(', ')}</CreditRow>}
          {work.link && (
            <CreditRow label="Link">
              <Link href={work.link.href} className={LINK} target="_blank" rel="noopener">
                {work.link.label}
              </Link>
            </CreditRow>
          )}
          {work.description && (
            <WorkDescription>
              <Paragraphs text={work.description} />
            </WorkDescription>
          )}
        </WorkDetails>
        <InfiniteScroll className="col-span-full lg:col-span-8">
          <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-2">
            {work.media.map((item, i) => (
              <a
                key={item._key}
                href={`#${item._key}`}
                aria-label={`View media ${i + 1} of ${total} in fullscreen`}
                className="relative flex aspect-square cursor-zoom-in items-center justify-center bg-theme-fg/10 p-16"
              >
                <div className={cx('flex size-full items-center justify-center', i >= 2 && '[content-visibility:auto]')}>
                  {item._type === 'video' ? (
                    <MediaVideo video={item} quality="720" shared className="size-full object-contain" playsInline />
                  ) : (
                    <Image image={item.image} sizes="lg:50vw" priority={i < 2} className="size-full object-contain" />
                  )}
                </div>
              </a>
            ))}
          </div>
        </InfiniteScroll>
        {total > 0 && <WorkMediaLightbox title={work.title} media={work.media} />}
      </div>
    </Window>
  );
}

const DETAIL_ROWS = ['48%', '72%', '56%', '90%', '24%', '64%'];

export function WorkWindowSkeleton() {
  return (
    <WindowSkeleton className="size-full col-span-full lg:col-span-8" titleWidth="w-120" controls={2}>
      <div className="grid h-full grid-cols-12 gap-16">
        <div className="col-span-full flex flex-col gap-4 lg:col-span-4">
          {DETAIL_ROWS.map((width) => (
            <TableRowSkeleton key={width} width={width} />
          ))}
          <div className="grid grid-cols-2 gap-16 lg:hidden">
            <LineSkel className="w-80" />
            <LineSkel className="w-60" />
          </div>
          <div className="flex-col mt-auto hidden pt-16 lg:flex">
            <LineSkel width="100%" />
            <LineSkel width="96%" />
            <LineSkel width="88%" />
            <LineSkel width="60%" />
          </div>
        </div>
        <div className="col-span-full min-h-0 overflow-clip lg:col-span-8">
          <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-2">
            {Array.from({ length: 16 }, (_, i) => (
              <Fragment key={i}>
                <Skel className="aspect-square" />
              </Fragment>
            ))}
          </div>
        </div>
      </div>
    </WindowSkeleton>
  );
}
