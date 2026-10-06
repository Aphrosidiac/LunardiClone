# Reference spec — edoardolunardi.dev (2026-10-06)

Markers: `[measured]` extracted from the page, bundle or a response body · `[observed]` seen happen ·
`[inferred]` reasoned from the public surface.

## 1. Snapshot
- 51 sitemap routes + 36 lab routes, crawled headless at 1440×900 on 2026-10-06 → `docs/reference/2026-10-06/` (HTML, screenshots, every response body, RSC payloads, JSX trees from the payloads). [measured]
- Next.js 16.3.6 App Router (Turbopack), React 19.3 canary, Tailwind v4, Sanity CMS, three r186 + R3F 9.8, Lenis 1.3.26, react-fast-marquee, sugar-high, Fuse.js, Mux, umami, Cloudflare in front. [measured]

## 2. Sitemap
`/` desktop · `/works` + 20 `/works/[slug]` · `/blog` + 14 `/blog/[slug]` · `/lab` + 36 `/lab/[slug]` (lightbox over the canvas) · `/awards` + 53 `/awards/[id]` (3D viewer over the canvas) · 404 crash screen · sitemap.xml · robots.txt · llms.txt. [measured]

## 3–4. Pages and components
Every route is one window system inside `main` (8px inset, ring-1 theme-fg/30). Components and their exact markup are in `docs/reference/2026-10-06/jsx/<route>.jsx`; their behaviour is in the client modules listed in `docs/port-contract.md`. [measured]
- Header: 34px, 12-col grid at lg; avatar 16px + name; nav (current = fg, others fg/50); email E, theme T, sound M, cursors C, search K with `kbd` hints on keyboard devices at xl; availability ping; HH:MM clock + `[VIE]`. [measured]
- Window: title bar 26px mono, 13px round close (`hit-x-2 hit-y-6`), body `rounded-2 p-4 ring-1` with its own Lenis; draggable by the title bar; z = 5 + stack index. [measured]
- Home: 2-col icon grid; About, Featured Article, Featured Experiment, Work Gallery open by default (the featured pair only from lg); Showreel and Build Notes closed; About folder (`ls -l`) from "Learn more". After load the stack reads Experiment 5 < Article 6 < Gallery 7 < About 8. [measured]
- Lab/Awards canvas: items 156·√ar × 156/√ar on a centre-out seeded grid, wrapping tile, zoom 0.5–2 (0.7 = 100%), camera lerp 0.12, zoom lerp 0.2 in log space, 4px drag threshold. [measured]
- Awards viewer: FOV 40, zoom 4, plane height 2, max width ratio 0.8, slab depth 0.02, spin 0.2 rad/s, OrbitControls damping 0.05, distance 2–8. [measured]

## 5. Tokens [measured]
`--spacing: .0625rem`; Inter (400/600) + Ubuntu Mono 400; body = `text-body-14` = clamp(12px → 14px, 375 → 1600 viewport), line-height 1.3; `text-body-10`; theme-bg #232323 / theme-fg #fff / dither #232323 plus six alternate themes; radius 2/4/full; breakpoints 40/48/64/80/96rem; default transition .15s cubic-bezier(.4,0,.2,1). Reconstructed in `src/app/globals.css`.

## 6. Motion [measured]
Dither: wave speed .015, frequency 3, amplitude .4, 4 colour levels, pixel size 2, mouse radius .5 with `1-exp(-12·dt)` smoothing, dt ≤ .1, internal resolution ≤ 3,686,400 px. Marquees speed 25, pause on hover. Notification 5 s after first interaction. Crash screen 650 / 2150 / 220 ms. Shared videos load at 800px, play at 400px from view.

## 7. Content model [measured]
Work: title, client, credits rows, year, stack, link, description, media blocks (video ladder original/720/480/240 + poster + placeholder, or image). Article: author, published, reading time, excerpt, portable text (code, media, playground, tables). Experiment: title, year, media. Award: title, image.

## 8. Responsive [observed]
Below lg: header collapses to "Open Menu"; list pages show only the list or only the detail; featured windows stay closed; About centres; canvases keep working with touch and pinch.

## 9. SEO [measured]
Per-page title/description, OG + Twitter (large image), Person JSON-LD graph, sitemap.xml, robots.txt with Content-Signal lines, llms.txt.

## 10–11. Performance, accessibility [observed]
Static HTML + RSC streaming; videos lazy via `data-src`; WebGL only where used. Visible focus ring (2px inset theme-fg) under a keyboard-focus mode; reduced motion stops marquees and Lenis.

## 12. Provenance
See `docs/provenance.md`.
