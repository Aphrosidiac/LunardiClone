import { chromium } from 'playwright';
const sites = { ref: 'https://www.edoardolunardi.dev', ours: process.env.OURS || 'http://localhost:3181' };
const b = await chromium.launch({ headless: true, channel: 'chromium', args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
for (const path of ['/', '/blog']) for (const [k, url] of Object.entries(sites)) {
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  await p.addInitScript(() => {
    const log = (window.__log = []);
    new MutationObserver(() => {
      const c = document.querySelector('main canvas');
      if (c && !log.find((l) => l[0] === 'canvas')) log.push(['canvas', Math.round(performance.now())]);
      const ph = document.querySelector('main [aria-hidden] .animate-pulse');
      if (ph && !log.find((l) => l[0] === 'placeholder')) log.push(['placeholder', Math.round(performance.now())]);
    }).observe(document, { childList: true, subtree: true, attributes: true });
    addEventListener('DOMContentLoaded', () => log.push(['dcl', Math.round(performance.now())]));
    addEventListener('load', () => log.push(['load', Math.round(performance.now())]));
  });
  await p.goto(url + path, { waitUntil: 'load' });
  await p.waitForTimeout(4000);
  const r = await p.evaluate(() => ({ log: window.__log, clip: document.querySelector('main canvas')?.closest('[class*=clip]')?.style.clipPath }));
  console.log(path, k, JSON.stringify(r));
  await p.close();
}
await b.close();
