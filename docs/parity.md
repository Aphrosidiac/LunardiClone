# Parity ledger

**28/34 complete** — 25 done, 4 partial, 2 omitted, 3 improved

## blog

| ID | Feature | Status | Evidence | Notes |
| --- | --- | --- | --- | --- |
| B-01 | List with Notes and Publications groups | done | compare blog-1440 | Publications = docs in FF's public GitHub repos |
| B-02 | Post window: [AUTHOR] [PUBLISHED] [READING TIME] [EXCERPT], rich text, sugar-high code | done | compare blog_measure-motion-not-stills-1440; style-diff 68 shared lists | 14 articles written from FF's own build notes |
| B-03 | Runnable Playground (sandboxed iframe, sucrase) | done | tools/interact.mjs: iframe present on touch-is-not-a-small-mouse |  |
| B-04 | Build Notes window + rule + italic outro at the end of each post | done | tools/interact.mjs: email-capture window present in post |  |

## content

| ID | Feature | Status | Evidence | Notes |
| --- | --- | --- | --- | --- |
| X-01 | Analytics, Sanity Live, visual editing, draft mode | omitted |  | Not part of the experience; no CMS |

## global

| ID | Feature | Status | Evidence | Notes |
| --- | --- | --- | --- | --- |
| G-01 | Design tokens (1px spacing, Inter + Ubuntu Mono, theme-bg/fg, fluid body-14, keyboard variant, hit-area utilities) | done | tools/style-diff.mjs 2026-10-06: every reference class list on /, /works, /works/[slug], /blog/[slug], /lab, /awards exists in ours and computes identically (home 100/100, works 63, detail 79, lab 60, shots 58) | Only animation phase and content-length margins differ |
| G-02 | Seven colour themes cycled with T, persisted in localStorage | done | tools/interact.mjs: two T presses → data-theme=amber, body bg rgb(21,14,0) |  |
| G-03 | Dithered WebGL background (R3F, Bayer 8x8, wave field, mouse radius, slot clipping) | done | Shader copied verbatim from module 419053; headless GPU capture matches reference dither colours (black / 156,156,156); slot clip verified on /works and /blog | Postprocessing pass inlined instead of adding two packages |
| G-04 | Window system: drag by title bar, z-stacking from 5, Lenis inside window bodies, fullscreen via ?f= | done | tools/interact.mjs: About dragged +200,+100; z-order after load = reference (exp 5, article 6, gallery 7, about 8) |  |
| G-05 | Header: avatar + name, nav with active state, email/theme/sound/cursors/search buttons with key hints, availability ping, live clock [KUL] | done | compare.mjs 1440 + 390 side by side; clock reads Asia/Kuala_Lumpur time | VIE → KUL |
| G-06 | Search lightbox (K) over all content | done | tools/interact.mjs: 'webgl' → Wrapping WebGL Grid, FF Phantom architecture doc, Tile Collapse Intro, Meridian, FF Phantom | Index imported from src/content/search.ts instead of /api/search (static export) |
| G-07 | UI click sounds (synthesised), M toggles | done | Ported engine 440780 + CLICKS 153213; no audio files in the reference |  |
| G-08 | Live presence: visitor count, live cursors, visitors menu, follow | partial | tools/presence-e2e.mjs against local wrangler dev: both visitors read 'Visitors, 1 person here now' and the remote cursor renders (docs/qa/presence-a.png); presence/test/smoke.mjs 17/17 | Server (presence/, Worker + Durable Objects) is written and tested locally but NOT deployed; the site runs with presence off until NEXT_PUBLIC_PRESENCE_URL is set |
| G-09 | Notification window 5 s after first interaction, dismissed for a day by cookie | improved | Verified it opens on /works after a click (docs/qa/notification.png) | Carries the demo-recreation disclaimer naming Edoardo Lunardi |
| G-10 | 404 BIOS crash screen with beep | done | tools/interact.mjs /nope → crash screen text rendered |  |
| G-11 | Mobile menu and phone layouts | done | compare.mjs at 390x844 for home, works, work detail, post, lab, shots — layouts match the reference |  |
| G-12 | SEO: per-page metadata, OG/Twitter, JSON-LD, sitemap.xml, robots.txt, llms.txt | done | next build route table lists /sitemap.xml /robots.txt /llms.txt; generateMetadata on every dynamic route | Reference robots Content-Signal lines not copied |
| G-13 | Soft navigation prefetch on a static host | improved | tools/postbuild.mjs writes 248 flat segment files; tools/interact.mjs shows no segment 404s afterwards | Next 16.3 export writes nested folders the client never requests |

## home

| ID | Feature | Status | Evidence | Notes |
| --- | --- | --- | --- | --- |
| H-01 | Desktop icon grid toggling six windows | done | tools/interact.mjs: Showreel z9, Build Notes z10 after clicks |  |
| H-02 | About window with copy, B/W photo strip marquee, Learn more | done | compare home-1440 | Strip = FF work covers in black and white |
| H-03 | About folder (ls -l listing, ↑/↓/Esc, file pane) | done | tools/interact.mjs: opens z11, ArrowDown selects pricing.csv, Esc closes | services.md, pricing.csv, care.md, faq.txt from SERVICE_ARCHITECTURE.md |
| H-04 | Featured Article window | done | compare home-1440 |  |
| H-05 | Featured Experiment marquee | done | compare home-1440, presence-a.png |  |
| H-06 | Work Gallery marquee of 240p clips linking to works | done | tools/interact.mjs: first gallery link → /works/hai-awan |  |
| H-07 | Showreel player | partial | tools/interact.mjs: original.mp4 playing t=1.6s | Mux player chrome redrawn around a plain <video>; no HLS quality ladder |
| H-08 | Build Notes signup window | partial | Form, honeypot and timing guard ported | No server: submits to NEXT_PUBLIC_EMAIL_CAPTURE_URL if set, otherwise opens a mail to hello@ffdev.studio |

## lab

| ID | Feature | Status | Evidence | Notes |
| --- | --- | --- | --- | --- |
| L-01 | Infinite pan/zoom canvas (seeded layout, keyboard, pinch, zoom readout) | done | Layout re-run against reference lab.html: 51 positions within 0.005px; interact: zoom 100% → 120% with + | 18 FF experiments |
| L-02 | Experiment modal lightbox with [year] | done | tools/interact.mjs: /lab/brand-film plays lab/brand-film/original.mp4 |  |

## shots

| ID | Feature | Status | Evidence | Notes |
| --- | --- | --- | --- | --- |
| S-01 | Awards canvas → Shots canvas of captured screens | improved | compare shots-1440 / shots-390 | 191 captures from FF's live sites replace 53 award certificates |
| S-02 | 3D image viewer (R3F slab, spin, orbit, dimmed backdrop, title in header) | partial | tools/interact.mjs: /shots/indahnya-1 renders one canvas | Long side capped at 2.6 units because wide captures swing into the lens; reference only shows portraits |

## works

| ID | Feature | Status | Evidence | Notes |
| --- | --- | --- | --- | --- |
| W-01 | List window with groups, count, blurb, active row | done | compare works-1440 / works-390 | Groups: Work, Recreations, Open source |
| W-02 | Detail window: mono credits table, description, media grid with infinite scroll | done | compare works_ff-search-1440; style-diff 79 shared lists |  |
| W-03 | Media lightbox and hover preview on list rows | done | Ported 892759 / 451201 | Hover preview cycles the work's own media instead of /api/works/<id>/preview |
| W-04 | Work awards block | omitted |  | FF has no awards; component ported but unused |

