# QA log

## 2026-10-06 — first full pass (static export on :3181, GPU headless Chromium)
| Check | How | Result |
|---|---|---|
| Visual, 9 routes at 1440×900 | `tools/compare.mjs` side by side with the reference | match; content differs by design |
| Visual, 6 routes at 390×844 | same | match |
| Computed styles | `tools/style-diff.mjs`: elements keyed by class list | 0 reference-only class lists on home, works, work detail, lab, shots; only animation phase and content-length margins differ |
| Window stacking | z-indexes read live on the reference | fixed ours to settle Experiment 5 < Article 6 < Gallery 7 < About 8 |
| Functional | `tools/interact.mjs` | drag, toggles, showreel playback, About folder keys, themes, search, gallery → work, list → detail, playground, Build Notes in posts, lab pan/zoom/modal, shots viewer, 404 |
| Prefetch | network log | Next 16.3 export: nested segment files never requested → 404 on every soft prefetch. Fixed with `tools/postbuild.mjs` |
| Shots viewer | screenshot | wide captures swung into the lens while spinning; long side capped at 2.6 units |
| Notification / disclaimer | `/works`, click, wait 6 s | opens with the disclaimer |
| Presence | `tools/presence-e2e.mjs` vs local `wrangler dev` | each visitor sees the other ("1 person here now") and the remote cursor; server smoke 17/17 |
| Dev server | console + server log | reload loop came from a stale Turbopack task for a deleted test route; clearing `.next/dev` fixed it |

Traps hit (kept for next time): Git Bash rewrites a bare `/` argument into `C:/Program Files/Git/`
(use `MSYS_NO_PATHCONV=1`); the Claude browser pane is throttled, so judge rendering headless on the GPU
(`--use-angle=d3d11` gets the real RTX 4060); `next build` beside a running `next dev` is fine on 16.3.
