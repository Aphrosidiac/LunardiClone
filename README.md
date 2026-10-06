# FF Desk

**A demo recreation of [edoardolunardi.dev](https://www.edoardolunardi.dev) by FF Dev Studio.** The layout,
interactions and motion follow Edoardo Lunardi's original exactly; every word, project, image and film
on it is FF Dev Studio's own. Not affiliated with Edoardo Lunardi.

A desktop-style portfolio: draggable windows over a dithered WebGL field, a work gallery, notes from the
bench, a pannable lab of experiments, a 3D viewer for captured screens, live cursors of other visitors,
seven terminal colour themes and synthesised click sounds.

## Run

```sh
npm install
npm run dev        # http://localhost:3180
npm run build      # static export → out/  (next build + tools/postbuild.mjs)
npx serve out -l 3181
```

Live cursors need the presence worker: `cd presence && npm install && npm run dev`, then
`NEXT_PUBLIC_PRESENCE_URL=ws://127.0.0.1:8787` in `.env.local`. Unset = presence off.

## Stack

Next.js 16 (App Router, static export) · React 19 · Tailwind v4 · three.js + React Three Fiber · Lenis ·
react-fast-marquee · sugar-high · Fuse.js · Cloudflare Worker + Durable Objects (presence). The same
libraries the reference ships; every component is ported from its client bundle (see `docs/port-contract.md`).

## Layout

| Path | What |
|---|---|
| `src/app/` | routes: `/`, `/works`, `/works/[slug]`, `/blog`, `/blog/[slug]`, `/lab`, `/lab/[slug]`, `/shots`, `/shots/[id]`, sitemap, robots, llms.txt |
| `src/components/` | window system, header, dither, home desktop, works, blog, canvas, lab, shots, media |
| `src/content/` | everything the site says: `site.tsx`, `home.tsx`, `works.ts`, `blog.ts`, `lab.ts`, `shots.ts`, generated `media.json` + `shots.json` |
| `presence/` | live cursor server (not deployed) |
| `tools/` | media pipeline (`media.mjs` + `media.jobs.mjs` + `record.mjs`), shot import, comparison and verification probes |
| `docs/` | brief, port contract, spec, parity ledger, QA log, provenance |

## Media

`node tools/media.mjs` cuts clips from the screen recordings in `~/Videos`, records live captures of
the deployed FF sites on the GPU (`tools/record.recipes.mjs`), and excerpts the FF ad films
(`C:/Dev/FFAds`), then encodes each into a 240 / 480 / 720 / original ladder with posters and a
placeholder, as the reference does. `node tools/import-shots.mjs` copies the captured screens from
PhantomClone. Both write manifests in `src/content/`.

## Verify

```sh
node tools/compare.mjs docs/qa/compare 1440 900          # reference vs ours, side by side
MSYS_NO_PATHCONV=1 node tools/style-diff.mjs / /          # computed-style diff by class list
node tools/interact.mjs                                   # functional pass over every control
node tools/presence-e2e.mjs                               # two visitors, live cursors
```
(Git Bash rewrites a bare `/` argument into a Windows path; hence `MSYS_NO_PATHCONV=1`.)

## Deploy

Not deployed. `scripts/deploy.sh` uploads `out/` to the Cloudflare Pages project `ff-desk` on the FF
account — run it only on an explicit go.
