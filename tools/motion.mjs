// Record a scripted interaction on a site at display rate (CDP screencast, real GPU) and dump
// timestamped frames, so motion can be compared frame by frame instead of from stills.
// usage: node tools/motion.mjs <baseUrl> <outDir> <scenario>
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const [base, out, scenario = 'nav'] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const b = await chromium.launch({ headless: true, channel: 'chromium', args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--hide-scrollbars', '--autoplay-policy=no-user-gesture-required'] });
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
const p = await ctx.newPage();
const cdp = await ctx.newCDPSession(p);
const frames = [];
const marks = [];
let t0 = 0;
cdp.on('Page.screencastFrame', (f) => {
  frames.push({ t: f.metadata.timestamp, data: f.data });
  cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {});
});
const mark = (label) => marks.push({ label, t: Date.now() / 1000 });
const clickText = async (sel, text) => {
  mark('click ' + text);
  await p.evaluate(([sel, text]) => { const el = [...document.querySelectorAll(sel)].find((e) => e.textContent.trim() === text); el?.click(); }, [sel, text]);
};
const clickSel = async (sel, label) => { mark('click ' + label); await p.evaluate((sel) => document.querySelector(sel)?.click(), sel); };

await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 80, maxWidth: 1440, maxHeight: 900, everyNthFrame: 1 });
mark('goto');
const startPath = { nav: '/', windows: '/', canvas: process.env.CANVAS || '/lab', worklist: '/works', fullscreen: process.env.FS || '/works' }[scenario] ?? '/' + scenario;
await p.goto(base + startPath, { waitUntil: 'commit' });
if (scenario === 'nav') {
  await sleep(5000);
  await clickText('header nav a', 'Works'); await sleep(2500);
  await clickSel('main a[href^="/works/"]', 'first work'); await sleep(2500);
  await clickSel('[id^="work-"]:not(#work-list) a[aria-label="Close"], [id^="work-"]:not(#work-list) [aria-label="Close"]', 'close work'); await sleep(2500);
  await clickText('header nav a', 'Blog'); await sleep(2500);
  await clickSel('main a[href^="/blog/"]', 'first post'); await sleep(2500);
  await clickText('header nav a', 'Lab'); await sleep(3000);
  await clickText('header nav a', 'Home'); await sleep(3000);
} else if (scenario === 'windows') {
  await sleep(5000);
  for (const name of ['Showreel', 'About', 'About', 'Build Notes', 'Work Gallery', 'Work Gallery']) {
    await clickText('main ul button', name); await sleep(1500);
  }
  await p.mouse.move(700, 450); await sleep(300);
  for (let i = 0; i < 30; i++) { await p.mouse.move(700 + i * 12, 450 + Math.sin(i / 4) * 120); await sleep(33); }
  await sleep(1500);
} else if (scenario === 'canvas') {
  await sleep(5000);
  // open the item nearest the centre, then close with the close control, then drag
  mark('click item');
  await p.evaluate(() => {
    const as = [...document.querySelectorAll('main a[href]')].filter((a) => /\/(lab|awards|shots)\//.test(a.getAttribute('href')));
    const c = [innerWidth / 2, innerHeight / 2];
    as.sort((a, b) => { const r = a.getBoundingClientRect(), q = b.getBoundingClientRect(); return Math.hypot(r.x + r.width / 2 - c[0], r.y + r.height / 2 - c[1]) - Math.hypot(q.x + q.width / 2 - c[0], q.y + q.height / 2 - c[1]); });
    as[0]?.click();
  });
  await sleep(3500);
  mark('escape'); await p.keyboard.press('Escape'); await sleep(2500);
  mark('drag');
  await p.mouse.move(720, 450); await p.mouse.down();
  for (let i = 1; i <= 20; i++) { await p.mouse.move(720 - i * 15, 450 - i * 8); await sleep(16); }
  await p.mouse.up(); await sleep(2500);
  mark('wheel zoom'); await p.keyboard.down('Control'); for (let i = 0; i < 5; i++) { await p.mouse.wheel(0, -60); await sleep(30); } await p.keyboard.up('Control'); await sleep(2000);
} else if (scenario === 'fullscreen') {
  await sleep(4500);
  await clickSel('[id^="work-"]:not(#work-list) [aria-label="Enter fullscreen"]', 'enter fullscreen'); await sleep(2500);
  await clickSel('[aria-label="Exit fullscreen"]', 'exit fullscreen'); await sleep(2500);
  mark('enter again'); await p.evaluate(() => document.querySelector('[id^="work-"]:not(#work-list) [aria-label="Enter fullscreen"]')?.click()); await sleep(1500);
  mark('escape'); await p.keyboard.press('Escape'); await sleep(2000);
} else if (scenario === 'worklist') {
  await sleep(4000);
  const box = await p.evaluate(() => { const a = document.querySelectorAll('main a[href^="/works/"]')[2]; const r = a.getBoundingClientRect(); return [r.x + 40, r.y + r.height / 2]; });
  mark('hover line'); await p.mouse.move(box[0], box[1], { steps: 4 }); await sleep(3000);
  mark('click line'); await p.mouse.click(box[0], box[1]); await sleep(3000);
  mark('click media');
  await p.evaluate(() => { const w = [...document.querySelectorAll('[id^=work-]')].find((e) => e.id !== 'work-list'); const t = w?.querySelector('button, [role=button]'); const all = [...(w?.querySelectorAll('button') ?? [])].filter((b) => b.querySelector('video, img')); (all[0] ?? t)?.click(); });
  await sleep(2500);
  mark('escape'); await p.keyboard.press('Escape'); await sleep(2000);
} else {
  await sleep(6000);
}
await cdp.send('Page.stopScreencast');
await sleep(200);
frames.sort((a, b) => a.t - b.t); // the screencast can deliver frames out of order
t0 = frames[0].t;
const index = frames.map((f, i) => {
  const name = `f${String(i).padStart(4, '0')}.jpg`;
  fs.writeFileSync(path.join(out, name), Buffer.from(f.data, 'base64'));
  return { name, t: +(f.t - t0).toFixed(3) };
});
fs.writeFileSync(path.join(out, 'index.json'), JSON.stringify({ frames: index, marks: marks.map((m) => ({ ...m, t: +(m.t - t0).toFixed(3) })) }, null, 1));
console.log(frames.length, 'frames', marks.map((m) => `${m.label}@${(m.t - t0).toFixed(2)}`).join(' | '));
await b.close();
