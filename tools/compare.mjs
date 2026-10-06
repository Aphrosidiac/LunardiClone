// Side-by-side captures: reference vs ours, same viewport, same wait, real GPU.
// usage: node tools/compare.mjs [outDir] [w] [h] [pairs...]   pair = refPath=ourPath
import { chromium } from 'playwright';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const out = process.argv[2] || 'docs/qa/compare';
const W = +(process.argv[3] || 1440), H = +(process.argv[4] || 900);
const REF = 'https://www.edoardolunardi.dev';
const OURS = process.env.OURS || 'http://localhost:3180';
const pairs = (process.argv.slice(5).length ? process.argv.slice(5) : ['/=/', '/works=/works', '/works/blink=/works/ff-search', '/blog=/blog', '/blog/hold-the-line=/blog/measure-motion-not-stills', '/lab=/lab', '/lab/ascii-orb=/lab/fisheye-slider', '/awards=/shots', '/awards/00856c50-f005-4347-8dc2-653e8cf8425f=/shots/ff-search-1']).map((p) => p.split('='));
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: 'chromium', args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required', '--hide-scrollbars'] });
async function shot(url, file) {
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1, isMobile: W < 600, hasTouch: W < 600 });
  const p = await ctx.newPage();
  await p.goto(url, { waitUntil: 'load', timeout: 60000 }).catch(() => {});
  await p.waitForTimeout(+(process.env.WAIT || 6000));
  await p.screenshot({ path: file });
  await ctx.close();
}
for (const [r, o] of pairs) {
  const name = (o === '/' ? 'home' : o.slice(1).replace(/\//g, '_')) + `-${W}`;
  const a = path.join(out, name + '-ref.png'), b = path.join(out, name + '-ours.png');
  await Promise.all([shot(REF + r, a), shot(OURS + o, b)]);
  spawnSync('ffmpeg', ['-v', 'error', '-y', '-i', a, '-i', b, '-filter_complex', 'hstack=2,scale=iw/2:-2', path.join(out, name + '.jpg')]);
  console.log('ok', name);
}
await browser.close();
