// Snapshot every route of the reference: rendered HTML, a 1440x900 screenshot, and every
// response body (JS, CSS, fonts, images, JSON) mirrored to disk by host/path.
// usage: node tools/snapshot.mjs [urls.txt] [outDir]
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { chromium } from 'playwright';

const ORIGIN = 'https://www.edoardolunardi.dev';
const list = process.argv[2] || 'docs/reference/2026-10-06/urls.txt';
const out = process.argv[3] || 'docs/reference/2026-10-06';
const urls = fs.readFileSync(list, 'utf8').split(/\r?\n/).filter(Boolean);
if (!urls.includes('/')) urls.unshift('/');

const mirror = path.join(out, 'mirror');
const pages = path.join(out, 'pages');
fs.mkdirSync(mirror, { recursive: true });
fs.mkdirSync(pages, { recursive: true });
const seen = new Set();
const media = new Set();

function filePath(u) {
  const url = new URL(u);
  let p = url.pathname.endsWith('/') ? url.pathname + 'index' : url.pathname;
  if (url.search) p += '__' + crypto.createHash('md5').update(url.search).digest('hex').slice(0, 10) + path.extname(p);
  return path.join(mirror, url.host, decodeURIComponent(p));
}

const browser = await chromium.launch({
  headless: true,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'],
});
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
ctx.on('response', async (res) => {
  const u = res.url();
  if (seen.has(u) || !/^https?:/.test(u)) return;
  seen.add(u);
  const type = res.headers()['content-type'] || '';
  if (/video|audio/.test(type) || /\.(mp4|webm|m3u8|mp3|wav)(\?|$)/.test(u)) { media.add(u); return; }
  try {
    const body = await res.body();
    const f = filePath(u);
    fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.writeFileSync(f, body);
  } catch {}
});

for (const route of urls) {
  const page = await ctx.newPage();
  const name = route === '/' ? 'home' : route.slice(1).replace(/\//g, '__');
  try {
    await page.goto(ORIGIN + route, { waitUntil: 'networkidle', timeout: 45000 }).catch(() => {});
    await page.waitForTimeout(2500);
    // scroll through to trigger lazy content
    await page.evaluate(async () => {
      const el = document.scrollingElement;
      for (let y = 0; y < el.scrollHeight; y += 600) { el.scrollTo(0, y); await new Promise((r) => setTimeout(r, 120)); }
      el.scrollTo(0, 0);
    });
    await page.waitForTimeout(800);
    fs.writeFileSync(path.join(pages, name + '.html'), await page.content());
    await page.screenshot({ path: path.join(pages, name + '.png') }).catch(() => {});
    console.log('ok', route);
  } catch (e) {
    console.log('fail', route, e.message.split('\n')[0]);
  }
  await page.close();
}
fs.writeFileSync(path.join(out, 'media-urls.txt'), [...media].join('\n'));
fs.writeFileSync(path.join(out, 'all-responses.txt'), [...seen].join('\n'));
await browser.close();
