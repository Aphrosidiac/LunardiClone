import { chromium } from 'playwright';
const out = process.argv[2];
const sites = { phantom: 'https://ffdev.studio/', siena: 'https://ff-siena.pages.dev/', cellar: 'https://ff-cellar.pages.dev/', bbf: 'https://bbf.lewix.ai/', ascend: 'https://ascendpeptides.my/', obys: 'https://ff-concepts.pages.dev/concepts/02/', basement: 'https://ff-concepts.pages.dev/concepts/01/', shoots: 'https://ff-shoots.pages.dev/' };
const b = await chromium.launch({ headless: true, channel: 'chromium', args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
for (const [k, u] of Object.entries(sites)) {
  const p = await b.newPage({ viewport: { width: 1600, height: 900 } });
  try { await p.goto(u, { waitUntil: 'load', timeout: 45000 }); } catch (e) { console.log(k, 'load', e.message.split('\n')[0]); }
  await p.waitForTimeout(5000);
  await p.screenshot({ path: `${out}/${k}.jpg`, quality: 60 });
  const btns = await p.$$eval('button, a', (els) => els.filter((e) => e.offsetParent).slice(0, 12).map((e) => (e.innerText || e.getAttribute('aria-label') || '').trim().slice(0, 30)).filter(Boolean));
  console.log(k, (await p.title()).slice(0, 60), '|', btns.join(' / '));
  await p.close();
}
await b.close();
