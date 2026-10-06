// Two visitors against the local presence worker: do they see each other and each other's cursor?
import { chromium } from 'playwright';
const URL = process.env.OURS || 'http://localhost:3180/';
const b = await chromium.launch({ headless: true, channel: 'chromium', args: ['--use-angle=d3d11', '--enable-gpu'] });
async function visitor() {
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript(() => Object.defineProperty(Navigator.prototype, 'webdriver', { get: () => false }));
  const p = await ctx.newPage();
  p.on('pageerror', (e) => console.log('PAGEERROR', e.message.slice(0, 200)));
  await p.goto(URL, { waitUntil: 'load' });
  return p;
}
const a = await visitor(), c = await visitor();
await a.waitForTimeout(6000);
for (let i = 0; i < 20; i++) { await a.mouse.move(400 + i * 20, 300 + i * 10); await c.mouse.move(900 - i * 15, 600 - i * 5); await a.waitForTimeout(60); }
await a.waitForTimeout(1500);
const state = (p) => p.evaluate(() => ({
  toggle: document.querySelector('[data-presence-toggle]')?.getAttribute('aria-label'),
  cursors: document.querySelectorAll('[data-presence-cursor], [data-cursor-id]').length,
}));
console.log('A', await state(a)); console.log('C', await state(c));
await a.screenshot({ path: 'docs/qa/presence-a.png' });
await b.close();
