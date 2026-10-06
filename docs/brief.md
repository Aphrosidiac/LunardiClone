# Brief — FF Desk

| Field | Answer |
|---|---|
| Reference | https://www.edoardolunardi.dev (Edoardo Lunardi, Creative Web Engineer, Vienna) — snapshot 2026-10-06 in `docs/reference/2026-10-06/` |
| Whose site | A third party's. Recreated as an FF Dev Studio portfolio demo. |
| New identity | FF Dev Studio, Kuala Lumpur. Mark from `ffdevstudio/brand-system/logo-production/FF-Brand-Kit` (profile badge, favicons). |
| Instruction | "copy it, make it for FF Dev Studio, one of our portfolio sites; complete FF rebrand and content, but exactly the same everything" (Fakhrul, 2026-10-06) |
| Mode | SITE (no accounts). One SYSTEM-ish piece: live presence (cursors, visitors) needs a small realtime server. |
| Stack | Same as the reference: Next.js 16 App Router + React 19 + Tailwind v4 + Lenis + react-fast-marquee + sugar-high + three/R3F. Static export (`out/`). |
| Hosting | Cloudflare Pages direct upload, project `ff-desk` on the FF (personal) account, like the other `ff-*` demos. **Not deployed until Fakhrul says so.** Presence server = Cloudflare Worker + Durable Object (`presence/`), also not deployed. |
| What stays theirs | Nothing ships of theirs except the design: layout, class lists, motion numbers and behaviour. No copy, images, video, fonts beyond the same Google fonts (Inter, Ubuntu Mono), no sounds unless re-sourced (see provenance). |
| Disclaimer | Notification window on every first visit ("Demo recreation … Not affiliated"), the About folder's faq.txt, and the README. Owner named as "Edoardo Lunardi". |

## Content mapping
| Reference | FF |
|---|---|
| Edoardo Lunardi / Creative Web Engineer | FF Dev Studio / Independent Web Studio |
| [VIE] clock | [KUL] (Asia/Kuala_Lumpur) |
| 20 works + 1 open source | 20 FF works (12 work, 8 recreations) + 2 open source repos (HaiAwan, Shoal) |
| 14 notes + 7 publications | 14 notes written from FF's own build lessons + publications = docs in FF's public repos |
| 36 lab experiments | 18 FF experiments (ad films rendered from code, WebGL pieces cut from the sites) |
| Awards (53 certificates) | **Shots** (`/shots`): 215 screens captured from FF's live sites. FF has no awards; inventing any is not on. |
| Showreel (Mux) | FF brand film (FF Ads 01), our own mp4 |
| Build Notes newsletter (Resend) | Same form; static site, so it opens a mail to hello@ffdev.studio (or POSTs to `NEXT_PUBLIC_EMAIL_CAPTURE_URL` if one is set) |
| About folder: services/pricing/awards/faq | services.md, pricing.csv (SERVICE_ARCHITECTURE bands), care.md (care plans), faq.txt |

## Not building
- Sanity Studio, draft mode, visual editing, Sanity Live, umami analytics, Cloudflare email obfuscation.
- Mux player internals (HLS, quality ladder via Mux) — replaced by our own mp4 ladder.
