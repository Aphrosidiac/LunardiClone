import type { Article, Block, Inline, Publication } from './types';

// "Notes from the bench": engineering lessons from FF Dev Studio's own builds.
// Small builders keep the bodies readable; the output is plain `Block[]` data.

const p = (...text: Inline[]): Block => ({ _type: 'p', text });
const h2 = (text: string, id: string): Block => ({ _type: 'h2', text: [text], id });
const ul = (...items: Inline[][]): Block => ({ _type: 'ul', items });
const ol = (...items: Inline[][]): Block => ({ _type: 'ol', items });
const quote = (...text: Inline[]): Block => ({ _type: 'quote', text });
const code = (lang: string, src: string, filename?: string): Block =>
  filename ? { _type: 'code', lang, code: src.trim(), filename } : { _type: 'code', lang, code: src.trim() };
const c = (t: string): Inline => ({ t, code: true });
const b = (t: string): Inline => ({ t, b: true });
const i = (t: string): Inline => ({ t, i: true });

const AUTHOR = 'FF Dev Studio';

const article = (a: Omit<Article, '_id' | 'href' | 'author'>): Article => ({
  _id: a.slug,
  href: `/blog/${a.slug}`,
  author: AUTHOR,
  ...a,
});

export const BLOG_BLURB =
  'Notes from the bench. The things that broke, how we caught them, and what we changed. Mostly code, sometimes not, always written down before we forget.';

export const ARTICLES: Article[] = [
  // 1 ──────────────────────────────────────────────────────────────────────────
  article({
    slug: 'measure-motion-not-stills',
    title: 'Measure Motion, Not Stills',
    excerpt:
      'Two screenshots said the flicker was fixed. Both were wrong, because a still picture has no opinion about time.',
    publishedAt: '2026-10-05',
    readingMinutes: 4,
    body: [
      p(
        'FF Phantom puts our work on an infinite WebGL grid behind a barrel lens. You drag it, it glides, it wraps. While it moved, the thin borders between tiles shimmered: not a dramatic flicker, just a restless sparkle along every line that made the whole surface feel cheap.',
      ),
      p(
        'We declared it fixed twice. Both times the evidence was a screenshot of the grid at rest, and both times the borders looked clean. Both times it was still broken. The lesson took longer to learn than the bug took to fix: ',
        b('a temporal defect is invisible in a still image.'),
        ' One frame cannot show you the difference between two frames.',
      ),
      h2('Why the line shimmered', 'mechanism'),
      p(
        'The borders were drawn as an anti-aliased 1px line in the lens pass. When a 1px line lands exactly on a pixel, you get one pixel at full brightness. When it lands halfway between two pixels, anti-aliasing splits it into two pixels at partial brightness. As the grid slides by fractional amounts, every line cycles through those states, and its apparent contrast pulses with it.',
      ),
      p(
        'Any single frame is a perfectly reasonable picture of a line. It is the sequence that is wrong. That is why a screenshot will always pass this bug.',
      ),
      h2('Building a probe that sees time', 'probe'),
      p(
        'The instrument that worked is small. Freeze the render loop so nothing moves on its own. Step the grid offset by sub-pixel amounts. After each step, render one frame synchronously and read back the same row of pixels with ',
        c('gl.readPixels'),
        '. Then compare each grid line’s peak contrast across all the frames.',
      ),
      code(
        'js',
        `
// Paste into the running page. Assumes the grid exposes draw() and an offset.
const gl = grid.renderer.getContext();
const w = gl.drawingBufferWidth;
const row = Math.floor(gl.drawingBufferHeight / 2);
const buf = new Uint8Array(w * 4);
const peaks = [];

grid.pause(); // stop the rAF loop: we own time now
for (let f = 0; f < 60; f++) {
  grid.offset.x += 0.5; // sub-pixel step
  grid.draw();          // synchronous render into the drawing buffer
  gl.readPixels(0, row, w, 1, gl.RGBA, gl.UNSIGNED_BYTE, buf);
  let peak = 0;
  for (let x = 0; x < w; x++) peak = Math.max(peak, buf[x * 4]);
  peaks.push(peak);
}
grid.resume();

const min = Math.min(...peaks), max = Math.max(...peaks);
console.log({ min, max, spread: ((max - min) / max * 100).toFixed(1) + '%' });
`,
        'flicker-probe.js',
      ),
      p(
        'The pass condition is boring on purpose: a line’s minimum contrast equals its maximum. Zero spread.',
      ),
      h2('Prove the probe can fail', 'prove-it-fails'),
      p(
        'Before trusting a probe that says "fixed", run it against the build you know is broken. If it passes the broken build too, it is not measuring the thing you care about. On the old anti-aliased line, our probe reported grid-line contrast swinging ',
        b('from 40 to 77 across frames, roughly 40%'),
        '. That number is the bug, finally written down.',
      ),
      p(
        'The fix was to pixel-snap the line: decide in the shader which whole pixel the line belongs to, and light exactly that one at full strength. There is no partial pixel left to pulse.',
      ),
      code(
        'glsl',
        `
// Screen-space grid line, snapped to whole pixels.
// cellPx: tile pitch in device pixels. offsetPx: current scroll offset.
float gridLine(vec2 fragPx, vec2 cellPx, vec2 offsetPx) {
  vec2 local = mod(floor(fragPx) - floor(offsetPx + 0.5), cellPx);
  vec2 onLine = step(local, vec2(0.5)); // 1.0 only on the first pixel of each cell
  return max(onLine.x, onLine.y);
}
`,
      ),
      p(
        'After the change, the same probe on the same machine read the centre lines at ',
        b('77 and 77, a 0% spread'),
        '. A stricter variant blanked the tiles and counted every lit run on five rows and five columns: 2,725 of 2,725 thin crossings were exactly 1px wide at full brightness over 80 frames, with no partial pixels anywhere.',
      ),
      {
        _type: 'table',
        head: [['Build'], ['Grid-line contrast across frames']],
        rows: [
          [['Sub-pixel gaps between tiles (first build)'], ['Visible flicker, reported by eye']],
          [['Anti-aliased 1px line'], ['40 to 77, about 40% swing']],
          [['Pixel-snapped line'], ['77 / 77, 0% swing']],
        ],
      },
      h2('Suspect the instrument first', 'instrument'),
      p(
        'This is one case of a broader habit. When a check comes back surprising, and especially when it comes back perfect, the instrument is the first suspect. A wrong instrument does not throw. It returns a number that quietly means something other than what it claims.',
      ),
      p('A few that have bitten us on other builds:'),
      ul(
        [
          b('A probe that rounds away its own subject.'),
          ' A check for coplanar surfaces reported every pair as 0.000m apart. It rounded positions to 0.1m, which made it blind to exactly the 40mm offset it existed to find.',
        ],
        [
          b('A measurement derived from a displayed value.'),
          ' Walk speed computed from a rounded on-screen frame rate read 30% slow. Have the system report the quantity directly, and then check its definition: our first "direct" clock also counted idle frames.',
        ],
        [
          b('A matcher that lies.'),
          ' A link checker reported a broken anchor because it never stripped the fragment. A route comparison flagged undocumented routes because ',
          c('head -1'),
          ' collapsed two handlers with the same path.',
        ],
        [
          b('A failing probe that is the finding.'),
          ' A test could not find a button by its accessible name. The label was hidden at that width, so the control genuinely had no name. That was two real accessibility bugs, not a flaky test.',
        ],
      ),
      h2('The checklist', 'checklist'),
      ol(
        ['For any motion, flicker, jitter or shimmer report, measure across frames in a real browser. Headless software GL is fine for layout and useless for this.'],
        ['Run the probe on the old build first. It must detect the defect.'],
        ['A/B the old and new builds in the same session, on the same machine.'],
        ['Report numbers. "Looks fine" is a reading from an instrument that cannot see the problem.'],
      ),
      p(
        'Only then say fixed. It is a slower sentence to earn, and it is the only one worth saying.',
      ),
    ],
  }),

  // 2 ──────────────────────────────────────────────────────────────────────────
  article({
    slug: 'a-sleeping-tab-lies-to-your-screenshots',
    title: 'A Sleeping Tab Lies to Your Screenshots',
    excerpt:
      'Our route sweep reported 58 clean pages. It had measured one page 58 times, because the tab was asleep and nobody told the router.',
    publishedAt: '2026-09-30',
    readingMinutes: 3,
    body: [
      p(
        'We like automated sweeps. Walk every route, check for horizontal overflow, contrast failures, stale classes and console errors, print a table. On a Vue single-page app the table came back perfect: ',
        b('58 routes, all clean'),
        '. It was perfect because every route was the first one.',
      ),
      h2('What actually happened', 'what-happened'),
      p(
        'The harness drove the app from a backgrounded browser tab and moved between pages with ',
        c('router.push'),
        '. The URL changed every time. The header changed too, because it read from a store rather than from the router view. Only ',
        c('<main>'),
        ' never changed.',
      ),
      p(
        'The app wraps its router view in ',
        c('<Transition mode="out-in">'),
        '. Vue applies the ',
        c('-leave-from'),
        ' and ',
        c('-leave-active'),
        ' classes, then swaps to ',
        c('-leave-to'),
        ' on the next animation frame. A hidden tab suspends ',
        c('requestAnimationFrame'),
        '. The swap never happens, the leave never finishes, and the incoming page never mounts. The DOM keeps the old page forever, while everything around it insists you have moved.',
      ),
      p('The tell, once you know to look for it:'),
      code(
        'js',
        `
document.querySelector('main').firstElementChild.className
// "page page-leave-from page-leave-active"   <- stuck mid-transition
`,
      ),
      h2('Fixing the harness, not the app', 'harness-fix'),
      p(
        'The app is fine. Real users have a visible tab. What needs fixing is the instrument, so we patch the globals in the test page only. Give ',
        c('requestAnimationFrame'),
        ' a timer-based clock, and zero the transition durations, because ',
        c('transitionend'),
        ' is frame-driven too.',
      ),
      code(
        'js',
        `
// Injected before the sweep starts. The app code is untouched.
window.requestAnimationFrame = (cb) => setTimeout(() => cb(performance.now()), 16);

const style = document.createElement('style');
style.textContent =
  '*, *::before, *::after { transition-duration: 0s !important; animation-duration: 0s !important; }';
document.head.appendChild(style);
`,
        'sweep-setup.js',
      ),
      p(
        'Then add the assertion that would have caught this on day one: ',
        b('prove the content changed between routes'),
        ' before trusting anything measured on them. A cheap signature is enough.',
      ),
      code(
        'js',
        `
const seen = new Map();
for (const route of routes) {
  await router.push(route);
  await new Promise((r) => setTimeout(r, 50));
  const sig = document.querySelector('main').textContent.trim().slice(0, 40);
  if (seen.has(sig)) throw new Error(route + ' renders the same main as ' + seen.get(sig));
  seen.set(sig, route);
  results.push(await audit(route));
}
`,
      ),
      p(
        'A related trap from the same sweep: reusing one probe element to read ',
        c('getComputedStyle'),
        ' for several classes in a row returns the previous class’s values, because style recalculation is deferred with no frame clock to drive it. Use a fresh node for every read.',
      ),
      h2('The same lie in a real browser', 'occluded-tab'),
      p(
        'Headless tabs are not the only ones that sleep. When we drive a real Chrome window remotely to study a reference site’s motion, Chrome treats a tab behind another window, or a tab that is not the active one, as hidden. Measured on one reference while researching FF Stanzza:',
      ),
      ul(
        [c('document.visibilityState'), ' read ', c('"hidden"'), '.'],
        ['One animation frame fired per screenshot, and none in between.'],
        ['Any script that awaited a frame timed out after 45 seconds.'],
        ['A 4-second preloader appeared to take over a minute.'],
        [
          'Resizing the window reported success while ',
          c('innerWidth'),
          ' kept its old value.',
        ],
      ),
      p(
        'Every one of those first looks like a property of the site. "Their animations are janky" is a very easy conclusion to reach from a tab running at one frame per screenshot.',
      ),
      p(
        'The fix is to front the window and the tab before measuring anything. On macOS that is two lines of AppleScript, wrapped in a tiny script that picks the tab by URL:',
      ),
      code(
        'bash',
        `
#!/bin/sh
# tab.sh <url-substring>: bring the matching Chrome tab to the front
osascript <<EOF
tell application "Google Chrome"
  activate
  repeat with w in windows
    set i to 0
    repeat with t in tabs of w
      set i to i + 1
      if URL of t contains "$1" then
        set active tab index of w to i
        set index of w to 1
        return
      end if
    end repeat
  end repeat
end tell
EOF
`,
        'tools/tab.sh',
      ),
      p(
        'After fronting the tab: 61 animation frames per second and real timings. With two tabs open, the reference and our rebuild, we compare them by fronting each in turn.',
      ),
      h2('Rules we now follow', 'rules'),
      ul(
        [
          'Before any motion judgement or timing measurement, assert ',
          c("document.visibilityState === 'visible'"),
          '. If it is not, the reading is about the tab, not the site.',
        ],
        [
          'Run timing samplers on ',
          c('setInterval'),
          ', not ',
          c('requestAnimationFrame'),
          ', so they keep sampling even when the tab is throttled.',
        ],
        ['In a sweep, assert that each page is different from the last before auditing it.'],
        [
          'Treat a perfect result as a question. Fifty-eight clean routes on the first run of a new audit is not good news, it is a suspicious instrument.',
        ],
      ),
      p(
        'Type checkers have a version of this too: ',
        c('vue-tsc'),
        ' passed an unbalanced template clean for us, and only ',
        c('vite build'),
        ' caught it. A green tick tells you what the tool checked, which is not always what you meant.',
      ),
    ],
  }),

  // 3 ──────────────────────────────────────────────────────────────────────────
  article({
    slug: 'nextjs-static-export-on-cloudflare-pages',
    title: 'Next.js Static Export on Cloudflare Pages',
    excerpt:
      'Four ways a Next 16 static export fails on Cloudflare Pages, two of which fail by succeeding: green build, missing routes.',
    publishedAt: '2026-09-25',
    readingMinutes: 3,
    body: [
      p(
        'Several of our demo builds, FF Shoots among them, are Next 16 apps shipped as a static export to Cloudflare Pages by direct upload. No Node server, no adapter, just ',
        c("output: 'export'"),
        ' and a folder of files. It is a good setup. It also has four traps, and each cost us a full build cycle the first time.',
      ),
      h2('1. Sitemap and robots need to say they are static', 'force-static'),
      p(
        'Under ',
        c("output: 'export'"),
        ', ',
        c('app/sitemap.ts'),
        ' and ',
        c('app/robots.ts'),
        ' fail during page-data collection unless they declare themselves static. The build error names the route, which helps, but it reads like something is wrong with your data rather than with a missing flag.',
      ),
      code(
        'ts',
        `
import type { MetadataRoute } from 'next';

export const dynamic = 'force-static';

export default function sitemap(): MetadataRoute.Sitemap {
  return routes.map((path) => ({ url: 'https://example.com' + path }));
}
`,
        'app/sitemap.ts',
      ),
      h2('2. One file over 25 MiB rejects the whole upload', 'size-cap'),
      p(
        'Pages refuses any single file over 25 MiB, and it refuses the entire deploy rather than skipping the file. Showreels are the usual offender. Check before you build, not after a ten-minute upload:',
      ),
      code(
        'bash',
        `
# fail fast on anything Pages will refuse
big=$(find public -type f -size +25M)
if [ -n "$big" ]; then
  echo "Over the 25 MiB Pages limit:"; echo "$big"; exit 1
fi
`,
        'scripts/deploy.sh',
      ),
      p(
        'Re-encoding is usually enough. A 26.7 MB 720p film came down to 20.7 MB with ',
        c('libx264'),
        ' at CRF 23, with no visible change at the size it plays:',
      ),
      code(
        'bash',
        `
ffmpeg -i reel.mp4 -c:v libx264 -crf 23 -preset slow -movflags +faststart -an reel-720.mp4
`,
      ),
      h2('3. next build waits forever on a lock', 'build-lock'),
      p(
        'If ',
        c('next dev'),
        ' is still running for the same project, ',
        c('next build'),
        ' waits on ',
        c('.next/lock'),
        ' silently. No message, no timeout. It looks like a hang because it is one. Deleting ',
        c('.next'),
        ' mid-build to "unstick" it makes TypeScript fail next, on missing ',
        c('.next/types'),
        '.',
      ),
      p(
        'Stop the dev server first and build from a clean ',
        c('.next'),
        '. On a loaded machine the in-build type check can also take more than ten minutes, so we run ',
        c('tsc --noEmit'),
        ' as its own step and tell the export build not to repeat it:',
      ),
      code(
        'ts',
        `
import type { NextConfig } from 'next';

const config: NextConfig = {
  output: 'export',
  images: { unoptimized: true },
  // type-checked separately by \`tsc --noEmit\` in the deploy script
  typescript: { ignoreBuildErrors: true },
};

export default config;
`,
        'next.config.ts',
      ),
      h2('4. Middleware and POST handlers vanish', 'silent-drops'),
      p(
        'This is the dangerous one. A static export ',
        b('does not fail'),
        ' on ',
        c('middleware.ts'),
        ' or on POST route handlers. It drops them. The build table still lists them as dynamic routes, the build is green, and in production they answer 404 or 405.',
      ),
      p(
        'The answer on Pages is to move them to Pages Functions, which run beside the static files. Middleware becomes ',
        c('functions/_middleware.ts'),
        ', and a rewrite becomes a fetch against the static asset binding:',
      ),
      code(
        'ts',
        `
export const onRequest: PagesFunction = async ({ request, next, env }) => {
  const url = new URL(request.url);
  if (url.pathname === '/old-path') {
    url.pathname = '/new-path/';
    return env.ASSETS.fetch(new Request(url, request));
  }
  return next();
};
`,
        'functions/_middleware.ts',
      ),
      code(
        'ts',
        `
export const onRequestPost: PagesFunction = async ({ request }) => {
  const body = await request.json();
  // validate, forward, store...
  return Response.json({ ok: true });
};
`,
        'functions/api/contact.ts',
      ),
      p(
        'Pages that read ',
        c('searchParams'),
        ' on the server have the same problem in a different shape: there is no server. Move the read into a client component with ',
        c('useSearchParams'),
        ', wrapped in ',
        c('<Suspense>'),
        ', or the export will refuse the page.',
      ),
      h2('How we verify a deploy', 'verify'),
      p(
        'Because two of these four fail by succeeding, a green build is not evidence. Before uploading, we serve the output folder exactly as Pages will, functions included, and request every route that matters:',
      ),
      code(
        'bash',
        `
npx wrangler pages dev out --port 8788
# then, for each route and each POST endpoint:
curl -s -o /dev/null -w "%{http_code} %{url_effective}\\n" http://localhost:8788/sitemap.xml
curl -s -o /dev/null -w "%{http_code}\\n" -X POST http://localhost:8788/api/contact -d '{}'
`,
      ),
      p(
        'A 405 on a POST endpoint locally is the exact signal production would have given you an hour later, in front of a client. We keep all of this in one ',
        c('deploy.sh'),
        ': size check, clean build, separate type check, local Pages smoke test, then the upload. It gets copied into every new demo.',
      ),
    ],
  }),

  // 4 ──────────────────────────────────────────────────────────────────────────
  article({
    slug: 'line-split-text-reveals-that-survive-font-loading',
    title: 'Line-Split Text Reveals That Survive Font Loading',
    excerpt:
      'Splitting a paragraph into lines is easy. Splitting it into the lines the browser will actually draw is the whole job.',
    publishedAt: '2026-09-20',
    readingMinutes: 4,
    body: [
      p(
        'The effect is everywhere: a heading whose lines rise one by one out of a clipping mask. To do it, you have to know where the browser breaks each line, wrap every line in its own mask, and animate them. We rebuilt one for FF Search, and the hard part was not the animation. It was that every obvious way of finding the line breaks gives you the wrong answer, quietly.',
      ),
      p('We found three ways the measurement lies.'),
      h2('1. Spans per word change the layout you are measuring', 'ranges'),
      p(
        'The common approach wraps each word in a span and groups spans by their ',
        c('offsetTop'),
        '. But splitting text into separate inline boxes drops kerning between them. The probe paragraph is now very slightly wider than the real one, so a line that fits in the real render wraps in the probe. We shipped "Page Not / Found" and "A cookie- / free site" before we understood why.',
      ),
      p(
        'Measure the text as one text node instead, and ask the browser where each word landed with a ',
        c('Range'),
        '. The probe sits off-screen, absolutely positioned, at the element’s exact fractional width.',
      ),
      code(
        'ts',
        `
export function measureLines(el: HTMLElement, text: string): string[] {
  const probe = document.createElement('div');
  const cs = getComputedStyle(el);
  probe.style.cssText =
    'position:absolute;visibility:hidden;left:-9999px;top:0;white-space:normal;';
  probe.style.width = el.getBoundingClientRect().width + 'px'; // fractional, not rounded
  probe.style.font = cs.font;
  probe.style.letterSpacing = cs.letterSpacing;
  probe.textContent = text; // ONE text node
  document.body.appendChild(probe);

  const node = probe.firstChild as Text;
  const range = document.createRange();
  const lines: string[] = [];
  let current = '';
  let top: number | null = null;

  for (const m of text.matchAll(/\\S+\\s*/g)) {
    const start = m.index!;
    range.setStart(node, start);
    range.setEnd(node, start + m[0].length);
    const rects = range.getClientRects();
    // More than one rect: the browser broke inside this word (hyphen, dash).
    // Split it char by char where the rect top changes; omitted here for brevity.
    const t = rects[0].top;
    if (top !== null && t > top + 1) { lines.push(current.trimEnd()); current = ''; }
    top = t;
    current += m[0];
  }
  lines.push(current.trimEnd());
  probe.remove();
  return lines;
}
`,
        'measure-lines.ts',
      ),
      p(
        'A word that returns more than one client rect was broken by the browser itself, at a hyphen or an em dash. Walk its characters and split where the rect top changes, or you will put "cookie-free" on one line when the browser puts "cookie-" on the first.',
      ),
      h2('2. document.fonts.ready resolves too early', 'fonts'),
      p(
        'Split before the webfont arrives and you measure the fallback’s metrics. That is wrong on its own, but it gets worse. Rendered as block lines, the wrong split shrinks any ',
        c('w-fit'),
        ' or inline-block container to the widest wrong line. Every later re-split, including the one after the font loads, measures inside that shrunken box and inherits its width. It never recovers. We had a headline settle permanently as "Raise / your / trajectory".',
      ),
      p(
        c('document.fonts.ready'),
        ' is not the signal you want: it can resolve before a face that has not been requested yet. Ask for the exact faces you use:',
      ),
      code(
        'ts',
        `
await Promise.all([
  document.fonts.load('450 16px "Brand Sans"'),
  document.fonts.load('600 16px "Brand Sans"'),
]);
const lines = measureLines(el, el.textContent ?? '');
`,
      ),
      h2('3. Rounding breaks lines by a subpixel', 'rounding'),
      p(
        c('clientWidth'),
        ' floors. Measure at the floored width and the probe is narrower than the real element, so it wraps earlier. The tempting fix, ',
        c('Math.ceil(width) + 1'),
        ', over-allows, and now the probe keeps a word that the real element pushes to the next line.',
      ),
      p(
        'Round nothing. Use ',
        c('getBoundingClientRect().width'),
        ' exactly as returned, and render each finished line with ',
        c('white-space: nowrap'),
        ' so a subpixel disagreement can never produce a second break inside a line you already decided on.',
      ),
      code(
        'css',
        `
.reveal-line { display: block; overflow: hidden; }
.reveal-line > span {
  display: block;
  white-space: nowrap;
  transform: translateY(110%);
}
.is-in .reveal-line > span { transform: none; transition: transform 0.9s cubic-bezier(0.22, 1, 0.36, 1); }
`,
      ),
      h2('How we checked it', 'verify'),
      p(
        'We compared the computed lines against the browser’s own layout of the untouched paragraph, for every animated string on the page, in headless Chromium at desktop and phone widths. Any mismatch is a failure. Then we loaded the page with the font deliberately delayed, which is where the inherited-width bug lives, and checked that the final split still matched. It is a cheap test and it catches every one of the three traps above.',
      ),
      h2('One more from the same build', 'three-color'),
      p(
        'Not about text, but it cost us an afternoon on the same page. Since three.js r152, ',
        c("new THREE.Color('#888')"),
        ' converts from sRGB to linear. A custom shader that expects raw components, which is what the reference fed it, comes out visibly darker. If you want the numbers you wrote, say so:',
      ),
      code(
        'ts',
        `
import { Color, LinearSRGBColorSpace } from 'three';

const c = new Color().setRGB(0x88 / 255, 0x88 / 255, 0x88 / 255, LinearSRGBColorSpace);
`,
      ),
    ],
  }),

  // 5 ──────────────────────────────────────────────────────────────────────────
  article({
    slug: 'touch-is-not-a-small-mouse',
    title: 'Touch Is Not a Small Mouse',
    excerpt:
      'Our interface ran on a phone, dragged on a phone, and was unusable on a phone. "It moves" turned out to be a very low bar.',
    publishedAt: '2026-09-15',
    readingMinutes: 3,
    body: [
      p(
        'Meridian, the WebGL engine behind an earlier version of our studio site, ran the same build on desktop and phone. On a phone it rendered, it scrolled, it dragged. And it was reported as unusable: taps did nothing, drags got stuck, scrolling stopped dead. Every one of those came from treating a finger as a small, imprecise mouse.',
      ),
      h2('A mouse threshold is not a finger threshold', 'slop'),
      p(
        'To tell a tap from a drag, you measure how far the pointer moved between down and up. Six pixels is a fine threshold for a mouse, which does not move while you click. A finger always moves: a real tap drifts somewhere between three and ten pixels. With a 6px slop, most taps were classified as drags. The content twitched and nothing opened, which is exactly what "tapping does nothing" feels like.',
      ),
      code(
        'ts',
        `
const SLOP = { mouse: 6, touch: 14, pen: 10 } as const;

function isDrag(e: PointerEvent, start: { x: number; y: number }) {
  const slop = SLOP[e.pointerType as keyof typeof SLOP] ?? 6;
  return Math.hypot(e.clientX - start.x, e.clientY - start.y) > slop;
}
`,
      ),
      p(
        'Try it below. Tap the pad the way you normally would, with a mouse and then with a finger, and compare what a 6px and a 14px threshold make of the same press.',
      ),
      {
        _type: 'playground',
        id: 'touch-slop',
        title: 'Tap or drag?',
        view: 'split',
        height: 440,
        code: `
import { useRef, useState } from 'react';
import type { PointerEvent as RPointerEvent } from 'react';
import { createRoot } from 'react-dom/client';

type Press = { kind: string; moved: number; at6: string; at14: string };

function Pad() {
  const start = useRef<{ x: number; y: number; id: number } | null>(null);
  const [moved, setMoved] = useState<number | null>(null);
  const [log, setLog] = useState<Press[]>([]);

  const finish = (e: RPointerEvent, cancelled: boolean) => {
    const s = start.current;
    if (!s || e.pointerId !== s.id) return;
    start.current = null;
    setMoved(null);
    const d = Math.hypot(e.clientX - s.x, e.clientY - s.y);
    const verdict = (slop: number) => (cancelled ? 'cancelled' : d > slop ? 'drag' : 'tap');
    const kind = e.pointerType + (cancelled ? ' (cancel, button ' + e.button + ')' : '');
    setLog((l) => [{ kind, moved: d, at6: verdict(6), at14: verdict(14) }, ...l].slice(0, 5));
  };

  return (
    <div style={{ padding: 16, display: 'grid', gap: 12 }}>
      <div
        onPointerDown={(e) => {
          if (start.current) return; // one pointer owns the gesture
          start.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
          e.currentTarget.setPointerCapture(e.pointerId);
          setMoved(0);
        }}
        onPointerMove={(e) => {
          const s = start.current;
          if (s && e.pointerId === s.id) setMoved(Math.hypot(e.clientX - s.x, e.clientY - s.y));
        }}
        onPointerUp={(e) => finish(e, false)}
        onPointerCancel={(e) => finish(e, true)}
        style={{
          height: 120, borderRadius: 12, border: '1px dashed currentColor',
          display: 'grid', placeItems: 'center', touchAction: 'none', userSelect: 'none',
        }}
      >
        {moved === null ? 'Tap here' : 'moved ' + moved.toFixed(1) + 'px'}
      </div>
      <table style={{ borderCollapse: 'collapse', fontVariantNumeric: 'tabular-nums' }}>
        <thead>
          <tr style={{ textAlign: 'left', opacity: 0.6 }}>
            <th>pointer</th><th>moved</th><th>6px slop</th><th>14px slop</th>
          </tr>
        </thead>
        <tbody>
          {log.map((r, i) => (
            <tr key={i}>
              <td>{r.kind}</td><td>{r.moved.toFixed(1)}px</td><td>{r.at6}</td><td>{r.at14}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<Pad />);
`.trim(),
      },
      h2('pointercancel reports button -1', 'pointercancel'),
      p(
        'When the browser takes a gesture over, for a system swipe or a scroll, it sends ',
        c('pointercancel'),
        ', and that event has ',
        c('button: -1'),
        '. An up-handler guarded on ',
        c('button === 0'),
        ' ignores it. The drag flag stays true, and from then on the interface follows a finger that is no longer on the glass, until a reload.',
      ),
      p('Cancel gets its own handler, and that handler only resets:'),
      code(
        'ts',
        `
let owner: number | null = null; // one pointer owns a gesture

el.addEventListener('pointerdown', (e) => {
  if (owner !== null) return;      // a second finger must not re-anchor the drag
  owner = e.pointerId;
  el.setPointerCapture(e.pointerId);
  begin(e);
});

el.addEventListener('pointermove', (e) => {
  if (e.pointerId === owner) move(e);
});

el.addEventListener('pointerup', (e) => {
  if (e.pointerId !== owner) return;
  owner = null;
  end(e); // may open, may throw
});

el.addEventListener('pointercancel', (e) => {
  if (e.pointerId !== owner) return;
  owner = null;
  reset(); // no tap, no throw, nothing else
});
`,
      ),
      p(
        'The ',
        c('owner'),
        ' check is the second fix. Without it, a second finger re-anchors the drag origin to itself and the content jumps mid-gesture.',
      ),
      h2('A scroller that stops dead reads as broken', 'inertia'),
      p(
        'People expect content to carry after a flick. What should carry is how fast the finger was moving when it ',
        i('left'),
        ', not its average speed across the gesture, which includes the slow start. Sample velocity on every move, keep only the recent samples, and cap the throw so a hard flick does not fling the content into next week.',
      ),
      h2('touch-action intersects down the tree', 'touch-action'),
      p(
        c('touch-action'),
        ' is not inherited like a normal property. The browser intersects the values of the element and all its ancestors. A child cannot re-enable what a parent forbade, so ',
        c('touch-action: none'),
        ' on a wrapper and ',
        c('pan-y'),
        ' on the panel inside it gives pan-y to nothing. Set it per state, on the one element that owns the gesture.',
      ),
      h2('44px is not always the right number', 'targets'),
      p(
        'Forcing 44px rows onto stacked link columns grew them until they collided with other controls. Standalone controls get 44px. A stacked list gets around 26px, which clears the 24px floor in WCAG 2.5.8 without moving the design. To grow a hit area without moving the type, use a centred pseudo-element:',
      ),
      code(
        'css',
        `
.nav-link { position: relative; }
.nav-link::after {
  content: '';
  position: absolute;
  left: 0; right: 0;
  top: 50%;
  height: 26px;
  transform: translateY(-50%);
}
`,
      ),
      p(
        'One caution: ',
        c('position: relative'),
        ' is not free. On an element whose descendants are absolutely positioned, it re-anchors them.',
      ),
      h2('Three instruments that lied', 'instruments'),
      p('Each of these first looked like a bug in the site. None were.'),
      ul(
        [
          b('Synthetic touch events do not scroll.'),
          ' Panels driven with ',
          c('Input.dispatchTouchEvent'),
          ' over the DevTools protocol looked unscrollable, because that call does not drive compositor scrolling. ',
          c('Input.synthesizeScrollGesture'),
          ' does.',
        ],
        [
          b('naturalWidth is density-corrected under srcset.'),
          ' It reported 335px for a genuine 1200px file, which made a working image look like it was serving the wrong size.',
        ],
        [
          b('Non-zero is not invisible.'),
          ' Sixteen reveals were flagged as "stuck" because their opacity was not exactly 1. All sixteen were at plus or minus 0.1%, tween rounding residue, fully visible. Measure the magnitude, not the inequality.',
        ],
      ),
      p(
        'Verify touch with real gestures at a real phone viewport, and when a check says the code is broken, check the check first.',
      ),
    ],
  }),

  // 6 ──────────────────────────────────────────────────────────────────────────
  article({
    slug: 'the-backdrop-filter-that-captured-every-fixed-child',
    title: 'The Backdrop Filter That Captured Every Fixed Child',
    excerpt:
      'A frosted header, purely cosmetic, quietly became the viewport for three dialogs and pushed their buttons off the top of the screen.',
    publishedAt: '2026-09-10',
    readingMinutes: 3,
    body: [
      p(
        'Most developers know that ',
        c('position: fixed'),
        ' is laid out against the viewport. Fewer remember the exception list, and almost nobody remembers the last item on it.',
      ),
      p(
        'Any ancestor with a computed ',
        c('transform'),
        ', ',
        c('filter'),
        ', ',
        c('perspective'),
        ', ',
        c('contain'),
        ', a ',
        c('will-change'),
        ' naming one of those, ',
        b('or a backdrop-filter'),
        ', becomes the containing block for its fixed descendants. Your "fixed" element is now fixed to that ancestor.',
      ),
      h2('How it showed up', 'symptom'),
      p(
        'In the SmoothSail admin, the sticky page header has ',
        c('backdrop-blur-md'),
        ': a frosted bar, nothing more. Three dialogs, "Add page", "Add form" and "New register", were rendered inside that header because they were passed in as its actions. Their overlay was ',
        c('fixed inset-0'),
        ', so it should have covered the screen. Measured on production:',
      ),
      code(
        'text',
        `
viewport   698px
overlay     70px   (the header's height)
Add page   258px tall, top at  -49px
Add form   368px tall, top at -104px   -> no Create button on screen
`,
      ),
      p(
        'The "Add form" dialog was unusable: its submit button was above the top edge of the window. Nothing in the dialog’s own CSS was wrong.',
      ),
      h2('The tell, and a tool to find the culprit', 'diagnose'),
      p(
        'The tell is an overlay whose measured height equals some ancestor’s height instead of the viewport’s. Once you see that, walk the ancestor chain and print every property on the exception list. The culprit announces itself:',
      ),
      code(
        'js',
        `
function whoContainsMe(el) {
  const props = ['transform', 'filter', 'perspective', 'contain', 'willChange', 'backdropFilter'];
  for (let n = el.parentElement; n; n = n.parentElement) {
    const cs = getComputedStyle(n);
    const hits = props.filter((p) => cs[p] && cs[p] !== 'none' && cs[p] !== 'auto');
    if (hits.length) console.log(n, hits.map((p) => p + ': ' + cs[p]).join('; '));
  }
}
whoContainsMe(document.querySelector('[role="dialog"]'));
`,
      ),
      p(
        'Check ',
        c('backdrop-filter'),
        ' explicitly. It is the easy one to forget, and a ',
        c("transform: 'none'"),
        ' on a finished entrance animation sends you looking in the wrong place.',
      ),
      h2('The fix: portal to body', 'portal'),
      p(
        'Render the dialog into ',
        c('document.body'),
        '. Nothing above body can capture it, and it survives whatever chrome grows a blur next year.',
      ),
      p(
        'There is a second trap inside the fix. If you resolve the portal target in an effect, the dialog is absent from the DOM on the render where the focus-trap effect runs. That effect never re-runs, because its dependencies did not change, and focus silently stays on the page behind the dialog. Resolve the target during render:',
      ),
      code(
        'tsx',
        `
import { useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

export function BodyPortal({ children }: { children: ReactNode }) {
  // Resolved during render, not in an effect: the dialog exists on the
  // same pass as the focus trap that needs it.
  const [target] = useState(() => (typeof document === 'undefined' ? null : document.body));
  return target ? createPortal(children, target) : null;
}
`,
        'components/ui/body-portal.tsx',
      ),
      p(
        'We reintroduced exactly this bug while fixing the first one, and the project’s motion verification suite caught it: the "dialog: focus moves inside" check failed, 38 of 40 passing. The codebase already had a long comment explaining this trap in its presence hook. Read the comments in the file you are editing.',
      ),
      h2('Seen again, in Vue', 'vue'),
      p(
        'On a later project, a notifications panel in a sticky blurred header could not escape a 64px bar for the same reason. ',
        c('<Teleport to="body">'),
        ' fixed the containing block, and created a consequence people forget: the click-outside handler must now test both the trigger ',
        b('and'),
        ' the teleported panel, because the panel is no longer a descendant of the component that owns the handler.',
      ),
      code(
        'ts',
        `
function onDocumentPointerDown(e: PointerEvent) {
  const t = e.target as Node;
  if (trigger.value?.contains(t) || panel.value?.contains(t)) return;
  open.value = false;
}
`,
      ),
      p(
        'And one layout note from the same panel: anchoring a popover with ',
        c('absolute right-0'),
        ' to a trigger near the right edge ran it off the left of a 390px screen. Pin popovers to the viewport on phones, ',
        c('inset-x-4'),
        ', and give them a fixed width from the small breakpoint up.',
      ),
      h2('Verification', 'verify'),
      p(
        'After the fix, each dialog’s overlay measured the full viewport height, every dialog’s top sat inside the window with its primary button visible, and the focus-trap check passed again. The rule we keep: any element that must cover the screen goes to ',
        c('body'),
        ', always, even when nothing captures it today.',
      ),
    ],
  }),

  // 7 ──────────────────────────────────────────────────────────────────────────
  article({
    slug: 'where-our-layout-shift-actually-came-from',
    title: 'Where Our Layout Shift Actually Came From',
    excerpt:
      'We tuned font metrics for a week. The shift was a ch unit, which changes size the moment the font does.',
    publishedAt: '2026-09-05',
    readingMinutes: 3,
    body: [
      p(
        'On a landing page we rebuilt this year, Cumulative Layout Shift was small but not zero, and it was clearly the font swap. The standard fix is a metric-matched fallback: ',
        c('size-adjust'),
        ', ',
        c('ascent-override'),
        ' and friends, so the fallback occupies the same space as the webfont. We did that carefully. The shift stayed.',
      ),
      p(
        'We stopped reasoning and measured. That found the real cause and four more silent traps on the same page.',
      ),
      h2('ch units were 100% of the CLS', 'ch'),
      p(
        'A ',
        c('ch'),
        ' is the width of the font’s own zero. Different fonts have very different zeros. The webfont had wide figures, 0.666em. The metric-matched fallback had narrow ones, 0.556em. So a paragraph capped at ',
        c('max-w-[46ch]'),
        ' was 613px wide with the webfont and 511px wide with the fallback.',
      ),
      p(
        'With the fallback, the paragraph set in four lines. When the webfont arrived, it set in three. Everything below it moved 28px. That single paragraph was ',
        b('all of the measured CLS'),
        ': 0.0171 with fonts loading, exactly 0 with fonts blocked.',
      ),
      p(
        'The fix is one unit. ',
        c('em'),
        ' is based on font-size, which the swap does not change.',
      ),
      code(
        'diff',
        `
- <p class="max-w-[46ch]">
+ <p class="max-w-[30.6em]">
`,
      ),
      p(
        'Same width in the real face, and CLS dropped to 0.0008. Size-adjust was never the problem. ',
        c('size-adjust'),
        ' can only match one metric; ',
        c('ch'),
        ' measures a different one.',
      ),
      p(
        'A corollary on calibrating ',
        c('size-adjust'),
        ' itself: do it on the corpus of strings the page actually sets, using the median per-string width ratio, not on one sample sentence. One sample gave us 102.56%. The corpus median gave 99.9%.',
      ),
      h2('A prefetch storm from a card grid', 'prefetch'),
      p(
        'The page was a Nuxt app with a gallery of twelve cards and a link to an index page. ',
        c('NuxtLink'),
        ' prefetches the payload of every link that becomes visible. The index page’s payload inlined 24 SVGs. Together, 3.1 MB downloaded before the reader had scrolled at all. It only shows up in a production build, which is why it survived development.',
      ),
      code(
        'vue',
        `
<NuxtLink :to="card.href" prefetch-on="interaction">
  {{ card.title }}
</NuxtLink>
`,
      ),
      p(
        'Prefetching on interaction still warms the route before an aimed click, and never fetches for someone scrolling past.',
      ),
      {
        _type: 'table',
        head: [['Page load'], ['Transferred'], ['Responses']],
        rows: [
          [['Prefetch on visibility'], ['5942 KB'], ['68']],
          [['Prefetch on interaction'], ['2819 KB'], ['33']],
        ],
      },
      h2('scroll-snap cancels your padding', 'scroll-snap'),
      p(
        'A horizontal card rail had ',
        c('padding-inline'),
        ' so the first card would sit in from the edge, and ',
        c('scroll-snap-align: start'),
        ' on the cards. The snap port is the padding box, so the browser scrolls right by exactly the padding and the first card sits flush to the viewport. The padding silently does nothing. The fix is the matching scroll property:',
      ),
      code(
        'css',
        `
.rail {
  padding-inline: 24px;
  scroll-padding-inline: 24px; /* tell snapping where "start" is */
  scroll-snap-type: x mandatory;
}
`,
      ),
      h2('aspect-ratio loses to a grid item', 'aspect-ratio'),
      p(
        'Twelve tiles with ',
        c('aspect-ratio: 4 / 3'),
        ' came out at a dozen different heights. ',
        c('aspect-ratio'),
        ' only sets a ',
        i('preferred'),
        ' size. A grid child also has ',
        c('min-height: auto'),
        ', which means "at least as tall as your content", and each tile held an SVG with its own opinion. Content won.',
      ),
      code(
        'css',
        `
.tile {
  aspect-ratio: 4 / 3;
  min-width: 0;
  min-height: 0; /* let the ratio decide, not the SVG inside */
}
`,
      ),
      h2('Dev servers that lie', 'dev-lies'),
      p(
        'Two smaller ones. Nitro route rules with ',
        c('swr'),
        ' cache in ',
        c('.nuxt/cache'),
        ' during development, so an edit is invisible for the cache window and the page hydrates against stale HTML. Vue reports that as a hydration mismatch, not as a stale cache. Clear the Nitro cache before believing a mismatch. And after a bulk find-and-replace of arbitrary Tailwind values, restart the dev server before deciding the replacement did not work.',
      ),
      h2('How we measured', 'measure'),
      p(
        'Every number above came from the production build in a real browser, with a layout-shift observer recording each entry and its sources, and the same page loaded twice: once normally, once with fonts blocked. If CLS is zero with fonts blocked, the shift is font-dependent, and the shifted element’s sources tell you which box moved. That took ten minutes and replaced a week of tuning the wrong number.',
      ),
    ],
  }),

  // 8 ──────────────────────────────────────────────────────────────────────────
  article({
    slug: 'reading-webflows-interaction-engine-out-of-the-bundle',
    title: "Reading Webflow's Interaction Engine Out of the Bundle",
    excerpt:
      'You can spend a day timing a Webflow animation with a stopwatch, or you can read the exact timeline it ships in its own JavaScript.',
    publishedAt: '2026-08-31',
    readingMinutes: 3,
    body: [
      p(
        'When we rebuild a site as a demo, we measure instead of eyeballing. For motion that usually means recording frames and fitting curves. Webflow sites are a happy exception: every interaction is shipped as data in the page’s ',
        c('webflow.<hash>.js'),
        ' bundle. Durations, eases, staggers, triggers, breakpoints. We used this while building FF Stanzza and FF Siena, and it turned days of observation into an hour of reading.',
      ),
      h2('IX3: the GSAP-based engine', 'ix3'),
      p(
        'Newer Webflow interactions (IX3) are built on GSAP. Their definitions sit inside a call to ',
        c('t.register('),
        ', and the bundle signals completion right after with a ',
        c('__wf_ix3_ready'),
        ' event. Slice the text between the two, and you have an array literal.',
      ),
      code(
        'js',
        `
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const src = readFileSync(process.argv[2], 'utf8');
const start = src.indexOf('t.register(') + 't.register('.length;
const end = src.indexOf('window.dispatchEvent(new CustomEvent("__wf_ix3_ready"))');
const body = src.slice(start, src.lastIndexOf(')', end));

// It is someone else's code: evaluate it in an empty context, not with eval().
const [interactions, timelines] = vm.runInNewContext('[' + body + ']', {}, { timeout: 1000 });
console.log(JSON.stringify({ interactions, timelines }, null, 2));
`,
        'tools/extract-ix3.mjs',
      ),
      p('What comes out is two arrays:'),
      ul(
        [
          b('Interactions'),
          ': scope (page or component), the trigger, such as ',
          c('wf:scroll'),
          ' with a full ScrollTrigger config including ',
          c('clamp(...)'),
          ' strings, and ',
          c('conditionalPlayback'),
          ', the breakpoints on which the interaction should ',
          i('not'),
          ' run.',
        ],
        [
          b('Timelines'),
          ': actions with targets as ',
          c('wf:class'),
          ', ',
          c('wf:attribute'),
          ' or ',
          c('wf:inst'),
          '. The last maps to ',
          c('data-wf-target'),
          ' attributes in the HTML.',
        ],
      ),
      p('A few encodings you need to decode:'),
      ul(
        [
          c('timing.ease'),
          ' is an index into a fixed list starting ',
          c('["none", "power1.in", ...]'),
          ' and ending at ',
          c('"sine.inOut"'),
          '. Index 5 is ',
          c('power2.out'),
          '.',
        ],
        [c('tt: 2'), ' is a fromTo tween, ', c('tt: 3'), ' is a set.'],
        [c('stagger: { amount }'), ' is the total stagger spread, GSAP style.'],
        [
          'Text splitting uses Webflow’s own ',
          c('.gsap_split_word'),
          ' and ',
          c('.gsap_split_letter'),
          ' spans: letters for headings, words for paragraphs.',
        ],
      ),
      h2('IX2: the legacy engine', 'ix2'),
      p(
        'Older interactions live in the object passed to ',
        c('Webflow.require("ix2").init({...})'),
        ', with ',
        c('events'),
        ', ',
        c('actionLists'),
        ' and ',
        c('site'),
        ' keys. The same slicing approach works.',
      ),
      ul(
        [
          'Events carry ',
          c('mediaQueries'),
          '. The names map to breakpoints defined in ',
          c('site'),
          ': main is 992px and up, medium 768 to 991, small 480 to 767, tiny 479 and below.',
        ],
        [
          'Action lists are sequential groups. Group 0 is the reset state, and it completes instantly when the values already match. We measured a hover going straight to the first frame because of this.',
        ],
        [
          c('easeOut'),
          ' is ',
          c('cubic-bezier(0, 0, .58, 1)'),
          '. An empty string means the CSS default, ',
          c('cubic-bezier(.25, .1, .25, 1)'),
          '.',
        ],
        [
          'Initial states are applied at runtime as inline styles, such as ',
          c('height: 0px'),
          ' or ',
          c('display: none'),
          '. Copy them into your CSS, or your rebuild flashes the end state before the script runs.',
        ],
      ),
      h2('Dropdowns and checkboxes', 'components'),
      p(
        'Webflow’s components are defined in the same bundle, and their behaviour is more specific than it looks:',
      ),
      ul(
        [
          'Dropdowns toggle a ',
          c('w--open'),
          ' class on both the toggle and the list. Hover mode is on only when ',
          c('data-hover="true"'),
          ' and the device is not touch.',
        ],
        [
          'Closing fires the IX2 close animation immediately, but removes the class after ',
          c('data-delay'),
          ' milliseconds.',
        ],
        [
          'Opening one dropdown sends ',
          c('w-close'),
          ' to all the others, so you get accordion behaviour for free. Outside mouseup, Escape and focusout all close.',
        ],
        [
          'Custom checkboxes hide the native input with ',
          c('opacity: 0; position: absolute; z-index: -1'),
          ' and mirror a ',
          c('w--redirected-checked'),
          ' class onto the styled sibling.',
        ],
      ),
      h2('Extract first, then measure what is left', 'then-measure'),
      p(
        'The JSON cannot answer everything. Two things we still had to observe: which of two duplicate timelines wins (the later-created one), and the real timings once a smooth-scroll library sits between the wheel and the ScrollTrigger. But we measured those two questions against a known spec, rather than measuring everything against nothing.',
      ),
      p(
        'One note on manners. This is reading data that a public site sends to every visitor, for a rebuild we label clearly as a recreation, with credit to the original. Evaluate it in an isolated context, keep the raw files with the date you fetched them, and do not run anyone’s bundle with access to your machine.',
      ),
    ],
  }),

  // 9 ──────────────────────────────────────────────────────────────────────────
  article({
    slug: 'one-react-three-fiber-canvas-across-routes',
    title: 'One React Three Fiber Canvas Across Routes',
    excerpt:
      'A 3D room should not rebuild itself on every page change. Getting a single R3F root to survive the App Router took more than moving it up a level.',
    publishedAt: '2026-08-26',
    readingMinutes: 3,
    body: [
      p(
        'We built a site where a baked 3D room sits behind every page, and the camera moves between spots in the room as you navigate. That only works if the WebGL context, the loaded models and the scene graph live for the whole session. Remounting on every route means re-uploading textures and a visible reload each time.',
      ),
      p(
        'The obvious move is to put ',
        c('<Canvas>'),
        ' in the root layout of a Next 16 App Router app. It does not work.',
      ),
      h2('Trap 1: a layout-level Canvas mounts twice', 'mounts-twice'),
      p(
        'Next remounts layout client components around hydration. We saw "canvas created" logged twice on every load. The second root inherits half-finished ',
        c('useGLTF'),
        ' promises from the first, and on non-home routes the boot never completes. The room simply never appears.',
      ),
      p(
        'The fix is to stop letting React own the root. Create one imperative root per page load, keep it in module scope, and re-render into it with new props when the route changes. Never unmount it.',
      ),
      h2('Trap 2: an imperative root does not run', 'imperative'),
      p(
        c('<Canvas>'),
        ' does several jobs you do not see until you skip it:',
      ),
      ul(
        [
          'It registers the THREE catalogue. Without ',
          c('extend(THREE)'),
          ', every ',
          c('<color>'),
          ' or ',
          c('<fog>'),
          ' throws "not part of the THREE namespace".',
        ],
        ['It wires pointer events and marks the root active.'],
        ['It drives the frame loop. Without it, the internal loop renders one frame and stops.'],
      ),
      p(
        'We take the loop over completely: ',
        c("frameloop: 'never'"),
        ' and our own ',
        c('requestAnimationFrame'),
        ' calling ',
        c('advance'),
        '. Two details matter. ',
        c('advance'),
        ' takes seconds, not milliseconds, and in never mode that timestamp becomes ',
        c('clock.elapsedTime'),
        '. And a hidden tab stops ',
        c('requestAnimationFrame'),
        ', so we fall back to a timer while ',
        c('document.hidden'),
        ' to keep state moving.',
      ),
      code(
        'tsx',
        `
'use client';
import * as THREE from 'three';
import { advance, createRoot, extend, events, type ReconcilerRoot, type RootState } from '@react-three/fiber';
import { Room } from './room';

extend(THREE as any);

let root: ReconcilerRoot<HTMLCanvasElement> | null = null;
let state: RootState | null = null;

export async function mountScene(canvas: HTMLCanvasElement) {
  if (root) return; // module scope: survives route changes and remounts
  root = createRoot(canvas);
  await root.configure({
    events,
    frameloop: 'never',
    dpr: [1, 2],
    onCreated: (s) => { state = s; },
  });

  const tick = (t: number) => {
    if (state) advance(t / 1000, true, state); // seconds, not ms
    if (document.hidden) setTimeout(() => tick(performance.now()), 100);
    else requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

export function renderScene(route: string) {
  root?.render(<Room route={route} />); // same root, new props
}
`,
        'app/components/scene/scene-root.tsx',
      ),
      p(
        'A small client component in the layout calls ',
        c('mountScene'),
        ' once with a canvas it owns, and calls ',
        c('renderScene(pathname)'),
        ' whenever the pathname changes. Because the root lives in the module, a layout remount finds it already there and does nothing.',
      ),
      h2('Three smaller traps on the way', 'smaller'),
      ul(
        [
          b('Postprocessing needs a live context.'),
          ' ',
          c('EffectComposer'),
          ' threw "reading \'alpha\'" when constructed before the renderer had a context. We mount it one frame later, behind an error boundary, so a failure costs the effect and not the scene.',
        ],
        [
          b('Stores can be duplicated in dev.'),
          ' A Zustand store imported by a ',
          c('next/dynamic'),
          ' chunk existed twice in development, so the page and the scene disagreed about state. Pin the instance on ',
          c('globalThis'),
          '.',
        ],
        [
          b('Baked atlases should not swallow live surfaces.'),
          ' Keep screens, prints, glass and light shafts out of the baked join so they can carry live materials, and convert the baked materials to ',
          c('MeshBasicMaterial'),
          ' with the atlas as ',
          c('map'),
          '. Lighting is already in the texture; lighting it again just darkens it.',
        ],
      ),
      code(
        'ts',
        `
import { create } from 'zustand';

type SceneStore = { route: string; setRoute: (r: string) => void };
const g = globalThis as unknown as { __sceneStore?: ReturnType<typeof make> };
const make = () => create<SceneStore>((set) => ({ route: '/', setRoute: (route) => set({ route }) }));

export const useScene = (g.__sceneStore ??= make());
`,
        'app/components/scene/store.ts',
      ),
      h2('How we verified it', 'verify'),
      p(
        'Three checks, all in a production build. "Canvas created" logs exactly once per load, on every entry route, not just home. Navigating between routes never re-requests a model or texture in the network panel. And the room finishes booting when the first page loaded is a deep link, which is the case the double mount used to kill.',
      ),
    ],
  }),

  // 10 ─────────────────────────────────────────────────────────────────────────
  article({
    slug: 'a-public-bucket-is-not-hiding',
    title: 'A Public Bucket Is Not Hiding',
    excerpt:
      'Moving a photo to hidden/ in a public bucket hides it from everyone except the people who already have the link, which is everyone it mattered to.',
    publishedAt: '2026-08-21',
    readingMinutes: 3,
    body: [
      p(
        'Indahnya is our guest photo gallery for Malaysian weddings: guests scan a QR code, upload photos, and the hosts moderate what everyone else sees. Photos are served from object storage behind a custom domain. The first version shipped a hiding scheme that looked reasonable and was not private at all.',
      ),
      h2('What we built first', 'first'),
      ul(
        [
          'Served photos lived at ',
          c('events/<event>/<media>.jpg'),
          '.',
        ],
        [
          'Originals, kept for downloads, lived beside them at ',
          c('events/<event>/orig/<media>.<ext>'),
          '.',
        ],
        [
          'When a host hid a photo, we moved it to ',
          c('hidden/<same key>'),
          ' in the same bucket.',
        ],
      ),
      p(
        'Keys used unguessable ULIDs, and we believed copied links would die once a photo was hidden.',
      ),
      h2('Why it leaked', 'mechanism'),
      p(
        'A public custom domain in front of an R2 or S3 bucket serves ',
        b('the whole bucket'),
        '. Prefixes are not permissions; they are part of the filename. Anyone who held the old link to a hidden photo only had to prepend ',
        c('hidden/'),
        '. The originals were one guess away from any gallery URL: same event, same media ID, add ',
        c('orig/'),
        ', try the common extensions. And the originals still carried their EXIF, including GPS.',
      ),
      p(
        'Unguessable IDs protect you from strangers enumerating the bucket. They do nothing once one sibling URL is public, because the rest of the path is derived from it. The people most likely to have that sibling URL are exactly the guests at the event.',
      ),
      h2('The fix: two buckets', 'two-buckets'),
      p(
        'Privacy has to be a property of where the object lives, not of what it is called. So there are two buckets:',
      ),
      ul(
        [b('Public'), ': only what may be seen right now, behind the custom domain.'],
        [b('Private'), ': originals, hidden photos, and anything pending approval. No public domain at all.'],
      ),
      p(
        'Hiding and showing become a cross-bucket copy and delete, keeping the same key, so a re-shown photo gets its old URL back:',
      ),
      code(
        'ts',
        `
import { CopyObjectCommand, DeleteObjectCommand, S3Client } from '@aws-sdk/client-s3';

const s3 = new S3Client({ region: 'auto', endpoint: process.env.S3_ENDPOINT });
const PUBLIC = process.env.PUBLIC_BUCKET!;
const PRIVATE = process.env.PRIVATE_BUCKET!;

async function move(key: string, from: string, to: string) {
  await s3.send(new CopyObjectCommand({ Bucket: to, Key: key, CopySource: from + '/' + key }));
  await s3.send(new DeleteObjectCommand({ Bucket: from, Key: key }));
}

export const hidePhoto = (key: string) => move(key, PUBLIC, PRIVATE);
export const showPhoto = (key: string) => move(key, PRIVATE, PUBLIC);
`,
        'server/utils/visibility.ts',
      ),
      p(
        'Copy first, delete second. If the process dies in between, the photo exists in both buckets, which is a cleanup job. The other order can lose it.',
      ),
      p(
        'Hosts still need to see the private objects, and they read them through short-lived presigned GETs, issued only after checking that the requester is a host of that event.',
      ),
      h2('Sign the size into uploads', 'content-length'),
      p(
        'The same audit found a second, quieter hole. Guests upload directly to storage with presigned PUT URLs. If the size is not part of the signature, a URL meant for a 3 MB photo will accept a 5 GB PUT. Put ',
        c('ContentLength'),
        ' in the command and make sure the header is signed, so any other size fails the signature check:',
      ),
      code(
        'ts',
        `
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export async function uploadUrl(key: string, bytes: number, type: string) {
  if (bytes > MAX_UPLOAD_BYTES) throw createError({ statusCode: 413 });
  const cmd = new PutObjectCommand({
    Bucket: PRIVATE, // uploads land private, pending approval
    Key: key,
    ContentType: type,
    ContentLength: bytes,
  });
  return getSignedUrl(s3, cmd, {
    expiresIn: 300,
    signableHeaders: new Set(['content-length', 'content-type']),
  });
}
`,
        'server/utils/upload.ts',
      ),
      h2('Make dev fail the way production should', 'dev'),
      p(
        'The last change is the one that keeps this fixed. In development, the stand-in for the public custom domain reads from the public bucket ',
        b('only'),
        '. If any page ever builds a URL that points at a private object, it 404s on our machines, during development, instead of quietly working in production.',
      ),
      h2('How we verified it', 'verify'),
      p(
        'We took a live gallery URL and tried every derivation an attacker would: the ',
        c('hidden/'),
        ' prefix, the ',
        c('orig/'),
        ' path with each extension, and the old key of a photo after hiding it. Every one returns 404 from the public domain. A hidden photo shown again returns at its original URL. And an upload with a body larger than the size it was signed for is rejected by storage, not by our code.',
      ),
      quote(
        'If an object must not be seen, it must not be in a bucket that can be seen. Everything else is a naming convention.',
      ),
    ],
  }),

  // 11 ─────────────────────────────────────────────────────────────────────────
  article({
    slug: 'horizontal-overflow-is-never-the-element-you-think',
    title: 'Horizontal Overflow Is Never the Element You Think',
    excerpt:
      'The page scrolled sideways on a phone, and every element we inspected was innocent. The guilty one was always an ancestor with min-width: auto.',
    publishedAt: '2026-08-16',
    readingMinutes: 4,
    body: [
      p(
        'Making an app work on a phone, we hit the classic symptom: the page scrolls a little sideways. Three separate causes, and in all three the element that overflowed was not the element at fault. Reading the DOM from the top down finds nothing. Walking it from the bottom up finds everything.',
      ),
      h2('Find it first', 'detector'),
      p(
        'The only reliable detector is the document itself: ',
        c('document.documentElement.scrollWidth > clientWidth'),
        '. To list suspects, find every element whose right edge passes the viewport, skipping anything inside a deliberate horizontal scroller, or a tab strip floods the output with false positives:',
      ),
      code(
        'js',
        `
function overflowSuspects() {
  const vw = document.documentElement.clientWidth;
  const inScroller = (el) => {
    for (let n = el.parentElement; n; n = n.parentElement) {
      const ox = getComputedStyle(n).overflowX;
      if (ox === 'auto' || ox === 'scroll') return true;
    }
    return false;
  };
  return [...document.querySelectorAll('body *')]
    .filter((el) => el.getBoundingClientRect().right > vw + 0.5 && !inScroller(el));
}

function walkUp(el) {
  for (let n = el; n; n = n.parentElement) {
    const cs = getComputedStyle(n);
    console.log(n.tagName, n.className, cs.width, 'min-width:', cs.minWidth, 'overflow-x:', cs.overflowX);
  }
}
`,
        'overflow-probe.js',
      ),
      p(
        'Take the innermost suspect and walk up. The culprit is usually the first ancestor whose computed ',
        c('min-width'),
        ' is ',
        c('auto'),
        '.',
      ),
      h2('1. Grid items and truncated text', 'min-width-auto'),
      p(
        'A grid or flex item defaults to ',
        c('min-width: auto'),
        ', which resolves to its content’s min-content width. Tailwind’s ',
        c('truncate'),
        ' sets ',
        c('white-space: nowrap'),
        ', and the min-content width of a nowrap string is the ',
        i('whole untruncated string'),
        '. So a card with a truncated title cannot shrink below the full title. Our cards came out 426px wide on a 375px screen.',
      ),
      p(
        'The fix is ',
        c('min-w-0'),
        ' on the ',
        b('grid item itself'),
        '. The page already had a ',
        c('min-w-0'),
        ' further down, on a flex child inside the card, and still overflowed. It has to be on the box the grid is sizing.',
      ),
      h2('2. aspect-ratio plus min-height grows the width', 'aspect-ratio'),
      p(
        'This one is nasty. Given ',
        c('width: 100%; aspect-ratio: 4/3; min-height: 309px'),
        ', the browser treats ',
        c('width: 100%'),
        ' as a preferred size that the ratio may override. To honour the minimum height at 4:3, it makes the box 309 times 4/3, which is 411px wide, inside a 343px column.',
      ),
      p(
        c('max-width: 100%'),
        ' alone does not help, because it resolves against a containing block that is itself being pushed wide by the same box. You need both: ',
        c('max-width: 100%'),
        ' on the box, and ',
        c('min-w-0'),
        ' on the wrapper above it, so the chain is allowed to collapse.',
      ),
      h2('3. A three.js canvas that latches', 'canvas'),
      p(
        'three.js sizes its canvas with an inline ',
        c('style.width'),
        ' in pixels, from whatever the host measured the last time ',
        c('setSize'),
        ' ran. A pixel width is a min-content contribution, so the column above cannot shrink past it. And it latches: the ResizeObserver measures the host, the host is only that wide because of the canvas, so the observer agrees with the stale size forever.',
      ),
      code(
        'css',
        `
.viewer-host { min-width: 0; }
.viewer-host canvas { max-width: 100%; } /* breaks the measure-the-thing-you-sized cycle */
`,
      ),
      p(
        'Setting ',
        c("canvas.style.width = '100%'"),
        ' yourself after ',
        c('setSize'),
        ' works too. One component in the same codebase already did that, and never had the bug.',
      ),
      h2('Measuring at phone width is its own problem', 'instruments'),
      p('Our instruments lied almost as much as the CSS did.'),
      ul(
        [
          b('Desktop browsers will not go narrow.'),
          ' The in-app browser pane we use floors at about 522 CSS pixels, and Chrome’s window on macOS at about 544, whatever width you ask for. Resizing reports success, and ',
          c('window.innerWidth'),
          ' keeps returning the old value for a moment afterwards. Use Playwright with a device descriptor, ',
          c("devices['iPhone 13']"),
          ' at 390 by 844. It is the only instrument we have that is actually 390px.',
        ],
        [
          b('Full-page screenshots resize the viewport.'),
          ' Our first audit reported three of eight pages at 441px and 523px in a context configured for 390. Playwright grows the viewport to capture the full page, and the next measurement caught the tail of it. Re-pin the viewport and assert the width before every measurement.',
        ],
        [
          b('elementFromPoint returns null off-screen.'),
          ' Hit-testing controls below the fold "failed" because the function answers null outside the viewport. Scroll each element into view first.',
        ],
      ),
      code(
        'ts',
        `
import { devices, chromium } from 'playwright';

const browser = await chromium.launch();
const page = await (await browser.newContext({ ...devices['iPhone 13'] })).newPage();

for (const route of routes) {
  await page.setViewportSize({ width: 390, height: 844 }); // re-pin every time
  await page.goto(base + route);
  const { vw, sw } = await page.evaluate(() => ({
    vw: document.documentElement.clientWidth,
    sw: document.documentElement.scrollWidth,
  }));
  if (vw !== 390) throw new Error('viewport drifted to ' + vw + ' on ' + route);
  if (sw > vw) console.log('OVERFLOW', route, sw - vw, 'px');
}
`,
        'tools/mobile-overflow.ts',
      ),
      h2('A bonus trap: min-height without min-width', 'targets'),
      p(
        'A coarse-pointer rule set ',
        c('min-height: 42px'),
        ' on buttons and nothing else. Every icon-only control measured 28 to 36px wide and 42px tall, and passed casual inspection: the menu button, sign-out, every edit and delete in a list row. Set both. Text buttons are already wider than the floor, so a blanket ',
        c('min-width'),
        ' only changes the ones that were wrong.',
      ),
      p(
        'Switches are the exception, because the track is the button: a ',
        c('min-width'),
        ' stretches the track and the knob stops short of the edge. Grow the hit area with an invisible pseudo-element instead, and verify it with ',
        c('elementFromPoint'),
        ' just outside the painted box, because ',
        c('getBoundingClientRect'),
        ' cannot see a pseudo-element’s reach.',
      ),
    ],
  }),

  // 12 ─────────────────────────────────────────────────────────────────────────
  article({
    slug: 'read-then-write-sold-twenty-of-five',
    title: 'Read-Then-Write Sold Twenty of Five',
    excerpt:
      'Twenty buyers, five in stock, twenty orders accepted. One storefront hides this race; a second sales channel makes it a weekly event.',
    publishedAt: '2026-08-11',
    readingMinutes: 4,
    body: [
      p(
        'SmoothSail started with one storefront subtracting from one stock number, and it worked. Then a shop counter and two marketplaces started subtracting from the same number. The code had looked fine for as long as there was one writer. It had always been wrong.',
      ),
      h2('The race', 'race'),
      p('The original code did what most code does:'),
      code(
        'ts',
        `
const level = await db.inventoryLevel.findUnique({ where: { id } });
if (level.available < qty) throw new OutOfStock();
await db.inventoryLevel.update({
  where: { id },
  data: { available: level.available - qty },
});
`,
      ),
      p(
        'Between the read and the write, anyone else can read the same number. We measured it on the real code: ',
        b('20 simultaneous buyers, 5 in stock, 20 orders accepted, oversold by 15'),
        '. A single low-traffic storefront rarely has two buyers within the same few milliseconds, so the bug hides. More channels means more writers, and the window gets hit.',
      ),
      h2('Put the guard inside the write', 'conditional-update'),
      p('The fix is one statement, with the check in the WHERE clause:'),
      code(
        'sql',
        `
UPDATE "InventoryLevel"
   SET "available" = "available" - $1,
       "committed" = "committed" + $1
 WHERE "id" = $2
   AND "available" >= $1
RETURNING "available", "committed";
`,
      ),
      p(
        'The database applies the check and the decrement atomically for each row. Zero rows returned means you lost the race and there is no stock for you. Same test afterwards: ',
        b('5 orders accepted, available 0'),
        '.',
      ),
      p('The test itself is short, and worth keeping in the suite permanently:'),
      code(
        'ts',
        `
it('never sells more than it has', async () => {
  const id = await seedLevel({ available: 5 });
  const results = await Promise.allSettled(
    Array.from({ length: 20 }, () => reserve(id, 1)),
  );
  const won = results.filter((r) => r.status === 'fulfilled').length;
  expect(won).toBe(5);
  expect((await getLevel(id)).available).toBe(0);
});
`,
      ),
      h2('"May it go negative" belongs to the caller', 'negative'),
      p(
        'Once the guard is in the statement, it is tempting to apply it everywhere. But different sales have different truths:',
      ),
      ul(
        [b('Storefront'), ': no. Nothing has shipped, and selling what is gone is the failure.'],
        [
          b('Counter'),
          ': yes. The customer is holding the item. Refusing the sale does not put it back on the shelf.',
        ],
        [
          b('Marketplace import'),
          ': yes. The sale already happened somewhere else. Refusing it only hides it.',
        ],
      ),
      p(
        'So the stock function takes the policy as an argument, and each caller states its answer. Getting it wrong in either direction is a real business bug.',
      ),
      h2('Everything else a shared count needs', 'rest'),
      p(
        b('A ledger row for every movement.'),
        ' Delta, reason, source, reference, available-after. Without it, "the marketplace says 4 and we say 6" has no answer, and admin edits, CSV imports and sales are indistinguishable afterwards.',
      ),
      p(
        b('Never call a marketplace inline.'),
        ' A checkout that waits for a marketplace API makes the customer wait for it, and a failure loses either the stock update or the order. Queue the push. Jobs need an idempotency key, backoff, and safe claiming so several workers can run:',
      ),
      code(
        'sql',
        `
-- Collapse bursts: at most one live job per key
CREATE UNIQUE INDEX "Job_live_key" ON "Job" ("key")
  WHERE "status" IN ('QUEUED', 'RUNNING');

-- Claim work without two workers taking the same job
UPDATE "Job" SET "status" = 'RUNNING', "startedAt" = now()
 WHERE "id" IN (
   SELECT "id" FROM "Job"
    WHERE "status" = 'QUEUED' AND "runAt" <= now()
    ORDER BY "runAt"
    LIMIT 10
    FOR UPDATE SKIP LOCKED
 )
RETURNING *;
`,
      ),
      p(
        b('Webhooks: verify, write down, answer 200, then work.'),
        ' Marketplaces expect an answer within a few seconds and retry when they do not get one. Doing the import inside the request turns one slow order fetch into a retry storm, and makes a failed import look like a failed delivery.',
      ),
      p(
        b('Reconcile on a schedule.'),
        ' Some push notifications only say that something changed. Some platforms give up after a few retries. An hourly pull per connection is what makes a lost notification survivable. And run the queue worker every minute, not every fifteen: a stock push that waits fifteen minutes is a stock push that oversells.',
      ),
      p(
        b('Push to every channel except the one the sale came from.'),
        ' It already knows.',
      ),
      p(
        b('Single-variant products carry their SKU twice.'),
        ' Once on the product, once on its only variant. SKU matching that treats the second sighting as ambiguity makes every simple product unmatchable, which is most products. Only two ',
        i('different'),
        ' products sharing a SKU is real ambiguity.',
      ),
      p(
        b('Derive channel state, do not store it.'),
        ' A stored "enabled" flag was written once at setup and never again, so the admin showed a channel as off for every shop, including shops actively selling through it that day.',
      ),
      h2('The general lesson', 'lesson'),
      p(
        'A check followed by a write is two statements, and anything can happen between two statements. When a constraint matters, put it where the write happens, and then write the test that fires twenty requests at once. It takes a minute to run, and it is the only test that actually asks the question.',
      ),
    ],
  }),

  // 13 ─────────────────────────────────────────────────────────────────────────
  article({
    slug: 'toasts-under-modal-dialogs',
    title: 'Toasts Under Modal Dialogs',
    excerpt:
      'Our error toast had z-index 60 and was still invisible, because a modal dialog does not live on the same z-axis as anything else.',
    publishedAt: '2026-08-06',
    readingMinutes: 3,
    body: [
      p(
        'Walking through a storefront build in a real browser, we added a product to the cart from a product sheet and hit the per-order limit. The API answered 409, as it should. The UI showed nothing. No toast, no message, no feedback of any kind. The customer would simply think the button was broken.',
      ),
      p('The toast was there. It was rendering. It was underneath the dialog.'),
      h2('The top layer', 'top-layer'),
      p(
        'The product sheet and the cart drawer were native ',
        c('<dialog>'),
        ' elements opened with ',
        c('showModal()'),
        '. A modal dialog is promoted to the ',
        b('top layer'),
        ', a rendering layer that sits above the entire document. It is not part of any stacking context in the page, so ',
        c('z-index'),
        ' cannot compete with it. Our toast stack had ',
        c('z-index: 60'),
        '. It could have had a million. Every error raised while a sheet or drawer was open was invisible.',
      ),
      h2('Fix: make the toast stack a popover', 'popover'),
      p(
        'The only way into the top layer from your own code is to be a top-layer element yourself. Popovers are. Within the top layer, the most recently shown element is on top. So the toast container becomes a manual popover, and we hide and re-show it every time a toast arrives, which moves it above whatever dialog opened since.',
      ),
      code(
        'html',
        `
<div id="toasts" popover="manual" class="toasts" aria-live="polite"></div>
`,
      ),
      code(
        'ts',
        `
const stack = document.getElementById('toasts')!;

export function toast(message: string, tone: 'info' | 'error' = 'info') {
  const item = document.createElement('div');
  item.className = 'toast toast--' + tone;
  item.textContent = message;
  stack.append(item);

  // Re-enter the top layer so we land above any dialog opened since last time.
  if (stack.matches(':popover-open')) stack.hidePopover();
  stack.showPopover();

  setTimeout(() => {
    item.remove();
    if (!stack.childElementCount) stack.hidePopover();
  }, 4000);
}
`,
        'toast.ts',
      ),
      p(
        'Popovers come with a user-agent box: inset, margin, border, padding and a background, centred in the viewport. Reset it, then position the stack yourself:',
      ),
      code(
        'css',
        `
.toasts {
  inset: auto 16px 16px auto;
  margin: 0;
  padding: 0;
  border: 0;
  background: transparent;
  overflow: visible;
  display: grid;
  gap: 8px;
}
`,
      ),
      p(
        'Here is the whole thing in miniature. Open the sheet and raise the error with the checkbox off: the toast is rendered, at z-index 60, behind the sheet. Tick the checkbox and try again.',
      ),
      {
        _type: 'playground',
        id: 'toast-top-layer',
        title: 'Toast vs. the top layer',
        view: 'split',
        height: 460,
        code: `
import { useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';

type Toast = { id: number; text: string };

function Demo() {
  const sheet = useRef<HTMLDialogElement>(null);
  const stack = useRef<HTMLDivElement>(null);
  const [asPopover, setAsPopover] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const raise = () => {
    const id = Date.now();
    setToasts((t) => [...t, { id, text: 'Max 3 per order (409)' }]);
    const el = stack.current;
    if (asPopover && el) {
      // re-enter the top layer, above whatever opened since
      if (el.matches(':popover-open')) el.hidePopover();
      el.showPopover();
    }
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3000);
  };

  return (
    <div style={{ padding: 16, display: 'grid', gap: 12, justifyItems: 'start' }}>
      <label>
        <input type="checkbox" checked={asPopover} onChange={(e) => setAsPopover(e.target.checked)} />{' '}
        Toast stack is a popover
      </label>
      <button onClick={() => sheet.current?.showModal()}>Open product sheet</button>

      <dialog
        ref={sheet}
        style={{ margin: 'auto 0 0', width: '100%', maxWidth: '100%', height: '60%', border: 0, padding: 16 }}
      >
        <p>Product sheet, opened with showModal().</p>
        <button onClick={raise}>Add 4 to cart</button>{' '}
        <button onClick={() => sheet.current?.close()}>Close</button>
      </dialog>

      <div
        key={String(asPopover)}
        ref={stack}
        popover={asPopover ? 'manual' : undefined}
        style={{
          position: 'fixed', inset: 'auto 16px 16px auto', zIndex: 60,
          margin: 0, padding: 0, border: 0, background: 'transparent', overflow: 'visible',
        }}
      >
        {toasts.map((t) => (
          <div key={t.id} style={{ background: '#d92d20', color: '#fff', padding: '8px 12px', borderRadius: 8, marginTop: 8 }}>
            {t.text}
          </div>
        ))}
      </div>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<Demo />);
`.trim(),
      },
      p(
        'Verification was simple and specific: open the product sheet, trigger the 409, and hit-test the toast’s centre with ',
        c('document.elementFromPoint'),
        '. Before the change it returned the dialog. After, it returns the toast. Same check with the cart drawer open.',
      ),
      h2('A second trap on the same walk: typing before hydration', 'hydration'),
      p(
        'The storefront is server-rendered with Nuxt. The checkout form arrives as real HTML inputs, so a fast customer can start typing immediately. Then Vue hydrates, and ',
        c('v-model'),
        ' sets each input’s value from component state on mount. State is empty. Everything the customer typed disappears.',
      ),
      p(
        'In development, hydration took about 8.7 seconds, which made this impossible to miss. In production it is much faster on a good laptop, and still slow enough on a cheap phone to wipe a name and half an address.',
      ),
      p('The fix is to make the form honest about when it is ready:'),
      code(
        'vue',
        `
<script setup lang="ts">
const live = ref(false);
onMounted(() => { live.value = true; });
</script>

<template>
  <form @submit.prevent="submit">
    <fieldset :disabled="!live">
      <input v-model="form.name" name="name" autocomplete="name" />
      <!-- ... -->
    </fieldset>
  </form>
</template>
`,
        'components/CheckoutForm.vue',
      ),
      p(
        'A disabled fieldset disables every control inside it with one attribute. For forms that do not need to be in the initial HTML at all, rendering them client-only is the other honest answer.',
      ),
      h2('And one about confirm()', 'confirm'),
      p(
        'The same walkthrough stalled on a native ',
        c('window.confirm()'),
        '. It blocks the page’s main thread, and our browser automation timed out waiting for a click to return. Beyond testing, an in-app confirmation is better anyway: it can be styled, it can explain the consequence, and it does not freeze the page. We replaced every native confirm in the project.',
      ),
      h2('What these have in common', 'common'),
      p(
        'Neither bug is visible in a component test. The toast renders correctly in isolation, and the form works perfectly once hydrated. Both only appear when you use the product the way a customer does: open a sheet, make a mistake, type before the page has finished thinking. Click through it like a person, on a slow device, before you call it done.',
      ),
    ],
  }),

  // 14 ─────────────────────────────────────────────────────────────────────────
  article({
    slug: 'rebuilding-generated-3d-parts-from-boxes',
    title: 'Rebuilding Generated 3D Parts From Boxes',
    excerpt:
      'Thirteen beautiful generated meshes made one impossible warehouse. Rebuilt from boxes, the same set cost 180 times fewer triangles.',
    publishedAt: '2026-08-01',
    readingMinutes: 4,
    body: [
      p(
        'For Sunlight Supplies we built a tool that turns a racking layout into a walkable 3D warehouse with a bill of materials. The first parts library came from an image-to-3D generator: thirteen meshes for uprights, beams, decks, base plates and the rest. Each one looked great on its own.',
      ),
      p(
        'Then we instanced them into a real layout. The reference warehouse came to ',
        b('213 million triangles'),
        '.',
      ),
      h2('Instancing shares geometry, not work', 'arithmetic'),
      p(
        'Instancing saves memory and draw calls. It does not save vertex work: the GPU still processes every triangle of every instance, every frame. One layout had 1,672 beams. At roughly 102 thousand triangles each, that is 170 million triangles a frame for the beams alone.',
      ),
      p(
        'No amount of material tuning fixes that. The arithmetic decides the architecture before aesthetics get a vote. So we rebuilt all thirteen parts by hand, from boxes, tapered prisms, folded sheet sections and punched plates.',
      ),
      {
        _type: 'table',
        head: [[''], ['Generated meshes'], ['Box proxies']],
        rows: [
          [['All thirteen parts'], ['586,472 triangles'], ['3,252 triangles']],
          [['Reference warehouse'], ['213 million triangles'], ['1.9 million triangles']],
        ],
      },
      h2('Perforation is the whole cost of an upright', 'perforation'),
      p(
        'A 3,000mm upright carries 59 slots and 59 web holes. Those holes are 2,208 of its 2,268 triangles. With plain walls, the same post is 60 triangles. That single flag is the only level-of-detail switch the range needs: perforated up close, plain further away.',
      ),
      p(
        'How you cut the holes matters too. A column of slots down one face decomposes into two full-height strips plus one small rectangle per gap. Sweeping row by row instead gives three rectangles per slot. Same picture, a third of the triangles.',
      ),
      code(
        'ts',
        `
// A face of width W and height H with a column of slots (x0..x1) at given y ranges.
// Column-first: two full-height side strips, then one filler per gap between slots.
function punchedFace(W: number, H: number, x0: number, x1: number, slots: [number, number][]) {
  const quads: Rect[] = [
    { x: 0, y: 0, w: x0, h: H },          // left strip, full height
    { x: x1, y: 0, w: W - x1, h: H },     // right strip, full height
  ];
  let y = 0;
  for (const [s0, s1] of slots) {         // fillers between slots, inside the column
    if (s0 > y) quads.push({ x: x0, y, w: x1 - x0, h: s0 - y });
    y = s1;
  }
  if (y < H) quads.push({ x: x0, y, w: x1 - x0, h: H - y });
  return quads; // 2 + (slots + 1) quads, versus about 3 per slot row-first
}
`,
      ),
      h2('Measure the original, do not eyeball it', 'probe'),
      p(
        'To rebuild a part faithfully, we measured the generated mesh rather than looking at it. A probe projects the mesh along an axis, finds the enclosed openings, and reports each one in millimetres. That gave us slot pitch (51.5mm), deck apertures (60 to 70mm) and base-plate punchings (29.7 by 16.5mm on 103mm rows). Wall thickness came from clustering the vertices in a thin slab through the middle of the part.',
      ),
      h2('Where the proxy should overrule its original', 'overrule'),
      p(
        'A generated mesh is a guess with good lighting. Where it disagreed with the engineering drawing or with how steel is actually made, the drawing won:',
      ),
      ul(
        ['A symmetric 50mm slot pitch, not the generated 51.5mm with a 21mm bias.'],
        ['The beam section from the drawing, not a 328mm end plate on an 80mm beam.'],
        ['Footplate bolts on the centreline, not crammed into the corners with 19mm of clearance.'],
      ),
      p(
        'Every one of those lowered our similarity score against the generated mesh, and every one was right. Which brings us to the score.',
      ),
      h2('Three ways the comparison harness lied', 'harness'),
      p(
        'To check each proxy, we rendered silhouettes of the proxy and the original from several axes and compared them with intersection over union. It lied three ways.',
      ),
      ol(
        [
          b('Proportion and shape are different questions.'),
          ' The proxies were authored at the drawing’s millimetres; the generated meshes ran fat. On a 2mm wall in a 90mm profile, that alone drove IoU to about 0.1 while saying nothing about shape. We now normalise each axis independently for the shape score, and print proportions separately as numbers.',
        ],
        [
          b('Orientation search needs both.'),
          ' Proportions alone could not catch a 90-degree error on a near-square section (an upright is 99 by 82mm), and laid a channel opening north over one opening west. Shape alone, once both were stretched to a unit box, laid a 42 by 153 plate over a 153 by 42 one. Prune candidate orientations on extents, decide on silhouette, and normalise both extent vectors first, or the prune measures scale instead of proportion.',
        ],
        [
          b('Thin walls cannot be scored by overlap.'),
          ' A section seen down its own length is a 2mm line in a 90mm frame; one pixel of misregistration is a terrible score. We report a tolerance IoU, with a 2px dilation, next to the strict one, and read that view as wall registration, not as a grade.',
        ],
      ),
      h2('And a classic', 'token'),
      p(
        'The comparison viewer’s ',
        c('render()'),
        ' awaited a model load. Two renders in one tick each cleared the scene and each added their part, so we saw two parts on top of each other and briefly suspected the geometry. Async rendering needs a token:',
      ),
      code(
        'ts',
        `
let token = 0;

async function render(part: string) {
  const mine = ++token;
  const gltf = await loader.loadAsync(urlFor(part));
  if (mine !== token) return; // a newer render started while we waited
  scene.clear();
  scene.add(gltf.scene);
}
`,
      ),
      p(
        'Generated models are a fine way to see what a part should look like. For anything you will instance a thousand times, they are a reference to measure, not geometry to ship.',
      ),
    ],
  }),
];

export const PUBLICATIONS: Publication[] = [
  {
    _id: 'ff-phantom-architecture',
    title: 'FF Phantom: architecture of a wrapping WebGL grid',
    href: 'https://github.com/Aphrosidiac/PhantomClone/blob/main/docs/ARCHITECTURE.md',
  },
  {
    _id: 'ff-phantom-verification',
    title: 'FF Phantom: GPU probes for flicker, fringes and scroll',
    href: 'https://github.com/Aphrosidiac/PhantomClone/blob/main/docs/VERIFICATION.md',
  },
  {
    _id: 'indahnya-architecture',
    title: 'Indahnya: one Nuxt process, one Postgres, two buckets',
    href: 'https://github.com/Aphrosidiac/Indahnya/blob/main/docs/architecture.md',
  },
  {
    _id: 'ff-siena-reference-spec',
    title: 'FF Siena: a measured reference spec of a Webflow film site',
    href: 'https://github.com/Aphrosidiac/SienaClone/blob/main/docs/reference-spec.md',
  },
  {
    _id: 'ff-stanzza-reference-spec',
    title: 'FF Stanzza: Webflow interactions, extracted and measured',
    href: 'https://github.com/Aphrosidiac/StanzzaClone/blob/main/docs/reference-spec.md',
  },
  {
    _id: 'ff-shoots-reference-spec',
    title: 'FF Shoots: reverse-engineering a Next.js and R3F portfolio',
    href: 'https://github.com/Aphrosidiac/RemyClone/blob/main/docs/reference-spec.md',
  },
  {
    _id: 'ff-search-reference-spec',
    title: 'FF Search: rebuild spec for a React 19 and three.js landing page',
    href: 'https://github.com/Aphrosidiac/AspenClone/blob/main/docs/reference-spec.md',
  },
];
