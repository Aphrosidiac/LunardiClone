# Port contract — FF Desk (edoardolunardi.dev → FF Dev Studio)

We are rebuilding https://www.edoardolunardi.dev 1:1 as an FF Dev Studio portfolio site.
"Exactly the same everything": same DOM structure, same Tailwind class lists, same numbers
(durations, easings, sizes, thresholds), same behaviours. Only identity and content change
(names, copy, media) — content comes from `src/content/*`, never hard-coded in components.

## Stack (matches the reference)
- Next.js 16 App Router, React 19, TypeScript, **static export** (`output: 'export'`, no server at runtime;
  no route handlers, no `headers()`/`cookies()`, every dynamic route has `generateStaticParams`).
- Tailwind v4 via `src/app/globals.css` — the reference theme is already reconstructed there
  (1px spacing unit: `h-34` = 34px; colours `theme-bg`/`theme-fg`; `text-body-10/14`; `keyboard:` variant;
  `hit-x-*`/`hit-y-*` utilities). **Copy class strings verbatim from the reference.** If a class the
  reference uses does not compile, fix globals.css (tell the lead), do not change the class.
- Libraries the reference ships, use the npm package instead of porting the bundled copy:
  `lenis`, `react-fast-marquee`, `sugar-high`, `three` + `@react-three/fiber` (+ drei only if the
  reference clearly uses it), `clsx`, `tailwind-merge` (the reference `cx` = clsx + twMerge; check the
  bundled config for custom class groups and replicate them in `src/lib/cx.ts`).
- `@mux/mux-player-react` is NOT used — the showreel plays our own mp4 through the same UI.

## Reference material (all on disk, read-only)
- Beautified client chunks: `docs/reference/2026-10-06/js/<chunk>.js`
  (raw: `docs/reference/2026-10-06/mirror/www.edoardolunardi.dev/_next/static/immutable/chunks/`).
  Beautify any chunk you need that is not in `js/` with `npx prettier@3 --parser babel`.
- Module map: `docs/reference/2026-10-06/modmap.json` — turbopack module id → chunk, exports, imports.
  Inside a chunk a module looks like `123456, (e) => { … e.s(["ExportName", 0, fn]) }`; `e.i(123456)`
  imports module 123456. The code is React-Compiler output (`(0, n.c)(25)` memo caches) — port it
  back to plain idiomatic React (hooks, no manual memo caches) with identical behaviour.
- Server composition (what each route renders, with every className and prop):
  `docs/reference/2026-10-06/jsx/<route>.jsx` — generated from the RSC payloads; `<Name#id>` is a
  client component reference (module id), `<default#522016>` is `next/link`, `<default#479520>` is
  `next/script` (analytics — drop it). Run `node tools/rsc2jsx.mjs docs/reference/2026-10-06/rsc/<route>.txt --full`
  to see un-elided strings.
- Rendered HTML per route: `docs/reference/2026-10-06/pages/<route>.html` (+ `.png` 1440×900).
- Stylesheet (pretty): `docs/reference/2026-10-06/css/main.pretty.css`.
- Live reference: https://www.edoardolunardi.dev (fine to load in a browser to watch behaviour).

## Conventions
- `'use client'` only where the reference module is a client module. Server components stay server.
- Keep every literal: timing ms, easing curves, spring constants, z-index numbers, aria labels,
  keyboard shortcuts, localStorage keys (prefix them `ff-` instead of whatever the reference used,
  except `theme`, which the inline head script reads).
- Analytics: `track()` → no-op stub (`src/lib/track.ts`). Drop umami, Sanity Live, visual editing,
  draft mode, stega cleaning (`stegaClean(x)` → `x`).
- Media: never point at edoardolunardi.dev / cdn.sanity.io / media.edoardolunardi.dev / mux.
  Content provides our own files (see `src/content/types.ts`: `Img`, `MediaItem`, `Rendition`).
  `SanityImage` → `src/components/media/image.tsx` (`Image`, same props but `image: Img`; srcset from
  `Img.widths` as `<stem>-<w>.webp`). `SanityVideo` → `src/components/media/media-video.tsx`
  (`MediaVideo`, takes a `MediaItem` video with `renditions` — keep the reference tier-picking logic).
  `Video` (231691) stays `Video` with the same `{ sources, poster, … }` props.
- Identity: the person "Edoardo Lunardi" becomes the studio "FF Dev Studio". Clock label `[VIE]` →
  `[KUL]` (Asia/Kuala_Lumpur). Nav item "Awards" → "Shots" at `/shots` (FF has no awards; the grid
  shows captured screens of sites FF shipped). Do not invent any other identity text — read it from
  `src/content/site.tsx`.
- File names kebab-case; one component per file unless the reference module bundles helpers.
- Do not edit files owned by another slice. If you need something from another slice that does not
  exist yet, import it from the path below anyway (the owner is building it in parallel) and code
  against the reference module's API (read that module in the chunk to learn its props/exports).

## Module ownership (module id → file, export names unchanged unless noted)

### A — shell, windows, media, utilities
| id | export | file |
|---|---|---|
| 465942 | Window | src/components/window/window.tsx |
| 149763 | WindowManagerProvider, useWindowManager | src/components/window/window-manager.tsx |
| 49606 | WindowProvider, useWindow | src/components/window/window-context.tsx |
| 26314 | WindowControl | src/components/window/window-control.tsx |
| 458416 | Lightbox | src/components/window/lightbox.tsx |
| 408773 | ModalLightbox | src/components/window/modal-lightbox.tsx |
| 87059 | MediaLightboxTrigger | src/components/window/media-lightbox-trigger.tsx |
| 239262 | Portal | src/components/portal.tsx |
| 471671 | Icon | src/components/icon.tsx |
| 374684 | Link | src/components/link.tsx |
| 539044 | CrashScreen | src/components/crash-screen.tsx |
| 747283 | LineSkeleton | src/components/line-skeleton.tsx |
| 231691 | Video | src/components/media/video.tsx |
| 380103 | SanityVideo → MediaVideo | src/components/media/media-video.tsx |
| 122719 | SanityImage → Image | src/components/media/image.tsx |
| 637695, 54342 | DEFAULT_TIERS, normalizeTiers, pickRendition, LIGHTBOX_VIDEO_QUALITY | src/components/media/tiers.ts |
| 724138 | background video gate | src/components/media/background-video-gate.ts |
| 271215 | ScrollRootContext, useScrollRoot | src/components/scroll-root.tsx |
| 823944 | useFocusTrap | src/hooks/use-focus-trap.ts |
| 820783 | composeRefs, useComposedRefs | src/lib/compose-refs.ts |
| 47686 | useIosViewportZoomGuard | src/hooks/use-ios-viewport-zoom-guard.ts |
| 16565, 72440, 86888, 508756, 537836 | useIsomorphicEffect, useWindowEvent, IS_CLIENT/IS_DEV, useMediaQuery/useReducedMotion, useBreakpoint/useIsTouchDevice | src/hooks/*.ts (one file each) |
| 112726 | screens | src/lib/screens.ts |
| 979118 | hexToRgb, run, throttle | src/lib/utils.ts |
| 801335, 207670 | cx (clsx + tailwind-merge) | src/lib/cx.ts |
| 195908 | track (no-op) | src/lib/track.ts |
| 163527 | readHashKey, replaceHashKey, useHashKey | src/lib/hash-key.ts |

### B — header, global chrome, sound, presence
All of chunk `33w733d84ewwv` (ThemeSwitcher 113981, InteractiveSounds 258223, Availability 360845,
Clock 365175, EmailLink 403352, KeyboardFocusMode 422414, HeaderLink 472037, NotificationWindow 488264,
presence store 598015, Presence 609433, SearchLightbox 739209, KeyHint/useHotkey 754615, MobileMenu 774907,
SoundScript/SoundToggle 852300, CursorsScript/CursorsToggle 883574) → `src/components/header/*` and
`src/components/presence/*`; sound engine 440780 + CLICKS 153213 → `src/lib/sound/*` (sound files we
need go in `public/sounds/`, record their source); createPresence 998374, createLobby 775529, protocol
125559 → `src/lib/presence/*`; EmailCaptureContent 231668 → `src/components/email-capture.tsx`;
createStore (2jq648cstfzyz) → `src/lib/create-store.ts`. Plus: the root layout `src/app/layout.tsx`
(head theme script, fonts, header, providers, JSON-LD, NotificationWindow) and a presence server in
`presence/` (Cloudflare Worker + Durable Object speaking the exact client protocol).

### C — dither background
DitherScene 419053 → `src/components/dither/dither-scene.tsx`; DitherProvider/DitherSlot 248737 →
`src/components/dither/dither-provider.tsx`.

### D — home desktop
AboutFolder 296558, QuickActions 275855, QuickActionLink 982609, MuxPlayerEmbed 203510 (→ `ShowreelPlayer`),
Marquee 819358 → `src/components/home/*`; `src/app/page.tsx`.

### E — works + blog
WorkLine 451201, WorkDetails 478055, WorkAwards 605074, WorkDescription 656558, WorkMediaLightbox 892759,
InfiniteScroll 959966, Expandable 965383 → `src/components/works/*`; ArticleLine 171797, EntryLine 465604
→ `src/components/lines/*`; Playground 700744 + buildRunnerDocument 206154 → `src/components/blog/*`;
blog rich-text renderer for `Block[]` reproducing the reference post markup → `src/components/blog/rich-text.tsx`;
routes `src/app/works/**`, `src/app/blog/**`.

### F — lab + shots (awards)
InfiniteCanvas 174830, LabInfoWindow 524777, ImageModelViewer 454198, ImageViewerPreloader 209793,
ImageViewerLoader 477627, ExperimentLightboxMedia 423393, createStore 408155 (if distinct), plus chunk
`09tqh3cp5d41h` → `src/components/canvas/*`, `src/components/lab/*`, `src/components/shots/*`;
routes `src/app/lab/**`, `src/app/shots/**`.

## Content modules (owned by the lead; import, never edit)
- `src/content/types.ts` — shapes.
- `src/content/site.tsx` — `SITE` (name, email, url, avatar, tz, availability, presenceUrl, nav,
  socials), `NOTIFICATION` ({ title, body: ReactNode }), `JSON_LD`.
- `src/content/home.tsx` — `ABOUT` (ReactNode), `ABOUT_FILES` (AboutFolder files), `ABOUT_DATE`,
  `FEATURED_ARTICLE` (Article ref), `FEATURED_EXPERIMENT` (MediaItem[] + href per item),
  `WORK_GALLERY` ({ href, title, video sources, poster }[]), `SHOWREEL` ({ src, poster, title }),
  `BUILD_NOTES` (ReactNode).
- `src/content/works.ts` — `WORKS: Work[]`, `WORKS_BLURB`, `OPEN_SOURCE` (EntryLine items).
- `src/content/blog.ts` — `ARTICLES: Article[]`, `PUBLICATIONS: Publication[]`, `BLOG_BLURB`.
- `src/content/lab.ts` — `EXPERIMENTS: Experiment[]`, `LAB_BLURB`.
- `src/content/shots.ts` — `SHOTS: Shot[]`, `SHOTS_BLURB`.
If you need a field that is not there, add it to your report; the lead adds it.

## Done means
- `npx tsc --noEmit` clean for your files; `npm run build` passes (static export) once all slices land.
- Your report lists: files written, behaviours ported (with the constants), anything you could not
  port and why, and any class the reference uses that globals.css does not generate.
