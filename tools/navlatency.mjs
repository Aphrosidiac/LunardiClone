// What happens on the network between a click and the page swap, on both sites.
import { chromium } from 'playwright';
const runs = { ref: ['https://www.edoardolunardi.dev/works', 2], ours: [(process.env.OURS || 'http://localhost:3181') + '/works', 2] };
const b = await chromium.launch({ headless: true, channel: 'chromium', args: ['--use-angle=d3d11', '--enable-gpu'] });
for (const [k, [url, n]] of Object.entries(runs)) {
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  await p.goto(url, { waitUntil: 'load' }); await p.waitForTimeout(4000);
  const reqs = [];
  let t0 = 0;
  p.on('request', (r) => reqs.push([Date.now() - t0, 'REQ', r.url().replace(/^https?:\/\/[^/]+/, '').slice(0, 110)]));
  p.on('requestfinished', (r) => reqs.push([Date.now() - t0, 'DONE', r.url().replace(/^https?:\/\/[^/]+/, '').slice(0, 110)]));
  const box = await p.evaluate((n) => { const a = document.querySelectorAll('main a[href^="/works/"]')[n]; const r = a.getBoundingClientRect(); return [r.x + 40, r.y + r.height / 2, a.getAttribute('href')]; }, n);
  t0 = Date.now();
  await p.mouse.move(box[0], box[1]); await p.waitForTimeout(700);
  const tc = Date.now() - t0;
  await p.mouse.down(); await p.mouse.up();
  await p.waitForFunction((h) => location.pathname === h && [...document.querySelectorAll('[id^=work-]')].some((e) => e.id !== 'work-list'), box[2], { polling: 'raf', timeout: 10000 });
  const tsw = Date.now() - t0;
  console.log(`\n${k}: hover@0 click@${tc} swapped@${tsw} (click→swap ${tsw - tc}ms) ${box[2]}`);
  for (const r of reqs.filter((r) => !/\.(mp4|webp|jpg|png|woff2)/.test(r[2]) && !/umami|cloudflareinsights|rum\?/.test(r[2]))) console.log('  ', r.join(' '));
  await p.close();
}
await b.close();
