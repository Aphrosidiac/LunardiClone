// Dither A/B: lossless captures of reference and ours at the same times after the canvas mounts,
// so a faithful port should match pixel for pixel (the shader is deterministic in time).
// usage: node tools/dither-ab.mjs <outDir> [times=1000,3000,6000] [w=1440] [h=900]
import { chromium } from 'playwright';
import fs from 'node:fs';
const [out = '.media-cache/dither', times = '1000,3000,6000', W = '1440', H = '900'] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const sites = { ref: 'https://www.edoardolunardi.dev/', ours: process.env.OURS || 'http://localhost:3181/' };
const b = await chromium.launch({ headless: true, channel: 'chromium', args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--hide-scrollbars'] });
for (const [k, url] of Object.entries(sites)) {
  const p = await b.newPage({ viewport: { width: +W, height: +H }, deviceScaleFactor: +(process.env.DPR || 1) });
  await p.addInitScript((THEME_PLACEHOLDER) => {
    window.__canvasAt = 0;
    if (THEME_PLACEHOLDER) try { localStorage.setItem('theme', THEME_PLACEHOLDER); } catch {}
    new MutationObserver(() => { if (!window.__canvasAt && document.querySelector('main canvas')) window.__canvasAt = performance.now(); }).observe(document, { childList: true, subtree: true });
  }, process.env.THEME || '');
  await p.goto(url, { waitUntil: 'load' });
  await p.waitForFunction(() => window.__canvasAt > 0, null, { timeout: 30000 });
  if (process.env.MOUSE) {
    // same cursor path on both, driven relative to canvas mount
    await p.waitForFunction(() => performance.now() - window.__canvasAt >= 1500, null, { polling: 'raf' });
    for (let i = 0; i <= 60; i++) {
      const a = (i / 60) * Math.PI * 2;
      await p.mouse.move(1240 + Math.cos(a) * 140, 280 + Math.sin(a) * 140);
      await p.waitForTimeout(16);
    }
  }
  for (const t of times.split(',').map(Number)) {
    await p.waitForFunction((t) => performance.now() - window.__canvasAt >= t, t, { timeout: 60000, polling: 'raf' });
    const at = await p.evaluate(() => performance.now() - window.__canvasAt);
    await p.screenshot({ path: `${out}/${k}-${t}.png` });
    console.log(k, t, 'captured at', Math.round(at));
  }
  // canvas facts
  console.log(k, await p.evaluate(() => { const c = document.querySelector('main canvas'); const r = c.getBoundingClientRect(); return { w: c.width, h: c.height, css: [r.width, r.height], style: c.style.cssText.slice(0, 120), dpr: devicePixelRatio, wrapper: c.closest('[class*=clip]')?.getAttribute('style') }; }));
  await p.close();
}
await b.close();
