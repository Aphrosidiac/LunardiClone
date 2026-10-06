# Provenance — what came from where

## From the reference (edoardolunardi.dev, captured 2026-10-06)
| Taken | Ships? | Notes |
|---|---|---|
| Design: layout, Tailwind class lists, theme tokens, motion numbers, window/canvas/viewer behaviour, shaders | yes | Ported from its client bundle into readable modules; this is the point of the demo. Disclaimer in the notification window, faq.txt, llms.txt and README. |
| Theme palettes (matrix, amber, solarized-dark, monokai, nord, dracula) | yes | Standard terminal palettes. |
| Fonts | yes | Inter and Ubuntu Mono via `next/font/google` (OFL), same as the reference. |
| Copy, photography, videos, award images, avatar, sounds | **no** | Nothing of Edoardo Lunardi's content ships. Sounds are synthesised in code (the reference has no audio files). |
| Snapshot (HTML, chunks, CSS, screenshots, RSC payloads) | no | `docs/reference/2026-10-06/`, git-ignored, research only. |

## FF's own
| Asset | Source |
|---|---|
| Mark, profile badge, favicons | `ffdevstudio/brand-system/logo-production/FF-Brand-Kit` v1.0 |
| OG image | PhantomClone `public/og.jpg` (ffdev.studio's own) |
| Work facts and copy | live ffdev.studio data, PhantomClone `src/data.js` @ d2ad542 → `docs/ff-projects.json` |
| Work clips | Fakhrul's screen recordings `~/Videos/2026-09-24 17-*.mp4` (cut by `tools/media.jobs.mjs`) and live GPU captures of the deployed FF sites (`tools/record.recipes.mjs`, 2026-10-06) |
| Captured screens (works stills, Shots) | PhantomClone `tools/shots.mjs` captures (`public/media/<slug>/s-*.webp`) |
| Lab clips + showreel | FF Ads films `C:/Dev/FFAds/out/final` (rendered from code) and cuts from the recordings |
| Blog articles | written from the studio's own engineering notes; no client-private detail |
| Prices, terms, care plans | `ffdevstudio/SERVICE_ARCHITECTURE.md` |

## Third-party marks inside FF's own captures
The recreation projects (FF Search, FF Shoots, FF Stanzza, FF Frames, FF Siena, Cellar) are FF's demo
recreations of other studios' sites; their captures show those demos as FF already presents them on
ffdev.studio, each crediting its reference in the credits table (`Reference` row).
