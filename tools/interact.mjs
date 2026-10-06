// Functional pass: drive every control on the built site and report errors and outcomes.
import { chromium } from 'playwright';
const BASE = process.env.OURS || 'http://localhost:3181';
const b = await chromium.launch({ headless: true, channel: 'chromium', args: ['--use-angle=d3d11', '--enable-gpu', '--autoplay-policy=no-user-gesture-required'] });
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
const p = await ctx.newPage();
const errors = [];
p.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message.slice(0, 300)));
p.on('console', (m) => { if (m.type() === 'error') errors.push('console ' + m.text().slice(0, 300)); });
p.on('response', (r) => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
const log = (...a) => console.log(...a);
const sleep = (ms) => p.waitForTimeout(ms);
const z = (id) => p.evaluate((id) => { const e = document.getElementById(id); return e ? `${getComputedStyle(e).display}/z${getComputedStyle(e).zIndex}` : 'missing'; }, id);

await p.goto(BASE + '/', { waitUntil: 'load' });
await sleep(4000);
log('home windows', await Promise.all(['quick-actions-about', 'quick-actions-featured-article', 'quick-actions-featured-experiment', 'quick-actions-work-gallery'].map(z)));

// notification window
log('notification', await p.evaluate(() => document.body.innerText.includes('Demo recreation')), await p.evaluate(() => document.cookie));

// drag About by its title bar
const about = p.locator('#quick-actions-about');
const bb = await about.boundingBox();
await p.mouse.move(bb.x + 60, bb.y + 12); await p.mouse.down(); await p.mouse.move(bb.x + 260, bb.y + 112, { steps: 8 }); await p.mouse.up();
const bb2 = await about.boundingBox();
log('drag about', Math.round(bb2.x - bb.x), Math.round(bb2.y - bb.y));

// toggle windows via desktop icons
for (const name of ['Showreel', 'Build Notes']) {
  await p.getByRole('button', { name, exact: true }).first().click(); await sleep(800);
}
log('showreel', await z('quick-actions-showreel'), 'build notes', await z('quick-actions-email-capture'));
log('showreel video', await p.evaluate(() => { const v = document.querySelector('#quick-actions-showreel video'); return v ? `${v.currentSrc.split('/').slice(-3).join('/')} paused=${v.paused} t=${v.currentTime.toFixed(1)}` : 'none'; }));

// Learn more → about folder, keyboard nav
await p.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.textContent === 'Learn more').click()); await sleep(600);
log('folder', await z('about-folder'));
await p.keyboard.press('ArrowDown'); await sleep(200);
log('folder selected', await p.evaluate(() => document.querySelector('[data-about-file][aria-pressed=true]')?.textContent?.slice(0, 60)));
await p.keyboard.press('Escape'); await sleep(400);
log('folder after esc', await z('about-folder'));

// theme cycle
for (let i = 0; i < 2; i++) { await p.keyboard.press('t'); await sleep(300); }
log('theme', await p.evaluate(() => document.documentElement.dataset.theme + ' ' + getComputedStyle(document.body).backgroundColor));
await p.evaluate(() => { localStorage.removeItem('theme'); document.documentElement.removeAttribute('data-theme'); });

// search
await p.keyboard.press('k'); await sleep(800);
log('search open', await p.evaluate(() => document.activeElement?.outerHTML.slice(0, 120)));
await p.keyboard.type('webgl', { delay: 40 }); await sleep(1500);
log('search results', await p.evaluate(() => [...document.querySelectorAll('[aria-label="Search results"] li')].slice(0, 5).map((l) => l.textContent.trim().slice(0, 50))));
await p.keyboard.press('Escape'); await sleep(400);

// gallery link → work page
await p.evaluate(() => document.querySelector('#quick-actions-work-gallery a').click()); await sleep(2500);
log('gallery click →', p.url().replace(BASE, ''));
// work media lightbox
const media = p.locator('[id^="work-"] button, [id^="work-"] [role=button]').first();
log('work page windows', await p.evaluate(() => [...document.querySelectorAll('[id^=work-]')].map((e) => e.id)));
await p.evaluate(() => document.querySelector('main a[href^="/works/ff-shoots"]').click()); await sleep(2000);
log('list → shoots', p.url().replace(BASE, ''));

// blog post + playground
await p.goto(BASE + '/blog/touch-is-not-a-small-mouse', { waitUntil: 'load' }); await sleep(5000);
log('playground iframe', await p.evaluate(() => document.querySelectorAll('iframe').length));
log('build notes in post', await p.evaluate(() => !!document.querySelector('[id^=email-capture-]')));

// lab modal
await p.goto(BASE + '/lab', { waitUntil: 'load' }); await sleep(4000);
const zoomBefore = await p.evaluate(() => document.body.innerText.match(/\d+%/)?.[0]);
await p.mouse.move(720, 450); await p.mouse.down(); await p.mouse.move(420, 300, { steps: 10 }); await p.mouse.up(); await sleep(600);
await p.keyboard.press('+'); await sleep(600);
log('lab zoom', zoomBefore, '→', await p.evaluate(() => document.body.innerText.match(/\d+%/)?.[0]));
await p.goto(BASE + '/lab/brand-film', { waitUntil: 'load' }); await sleep(4000);
log('lab modal', await p.evaluate(() => { const v = document.querySelector('[role=dialog] video, dialog video'); return v ? v.currentSrc.split('/').slice(-3).join('/') : document.querySelector('[role=dialog]')?.textContent?.slice(0, 80) ?? 'no dialog'; }));

// shots viewer
await p.goto(BASE + '/shots/indahnya-1', { waitUntil: 'load' }); await sleep(5000);
log('shots viewer canvases', await p.evaluate(() => document.querySelectorAll('canvas').length), 'title', await p.evaluate(() => document.querySelector('header')?.innerText.slice(0, 40)));

// 404
await p.goto(BASE + '/nope', { waitUntil: 'load' }); await sleep(2500);
log('404', await p.evaluate(() => document.body.innerText.slice(0, 120).replace(/\s+/g, ' ')));

log('\nERRORS', errors.length ? '\n' + [...new Set(errors)].join('\n') : 'none');
await b.close();
