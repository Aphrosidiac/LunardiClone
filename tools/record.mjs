// Live capture of a web page as video, on the real GPU (headless Chromium + ANGLE/D3D11), through
// the DevTools screencast so frames arrive at display rate with their own timestamps.
// A recipe drives the page (scrolls, drags, hovers) while frames are collected.
import { chromium } from 'playwright';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function record({ url, w = 1600, h = 900, dur = 6, settle = 2500, recipe, out, dpr = 1, mobile = false }) {
  const browser = await chromium.launch({
    headless: true,
    channel: 'chromium',
    args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required', '--hide-scrollbars'],
  });
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dpr, isMobile: mobile, hasTouch: mobile, reducedMotion: 'no-preference' });
  const page = await ctx.newPage();
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rec-'));
  try {
    await page.goto(url, { waitUntil: 'load', timeout: 60000 }).catch(() => {});
    await sleep(settle);
    if (recipe?.before) await recipe.before(page);
    await sleep(300);
    const cdp = await ctx.newCDPSession(page);
    const frames = [];
    cdp.on('Page.screencastFrame', async (f) => {
      frames.push({ t: f.metadata.timestamp, data: f.data });
      cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {});
    });
    await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: w * dpr, maxHeight: h * dpr, everyNthFrame: 1 });
    const t0 = Date.now();
    const run = recipe?.run ? recipe.run(page, { w, h, sleep }) : Promise.resolve();
    // keep recording at least `dur` seconds, and until the recipe finishes
    await Promise.all([run, sleep(dur * 1000)]);
    await cdp.send('Page.stopScreencast');
    await sleep(100);
    if (frames.length < 2) throw new Error(`only ${frames.length} frames captured for ${url}`);
    // concat demuxer with per-frame durations → constant 30 fps
    const lines = [];
    frames.forEach((f, i) => {
      const file = path.join(tmp, `f${String(i).padStart(5, '0')}.jpg`);
      fs.writeFileSync(file, Buffer.from(f.data, 'base64'));
      const next = frames[i + 1]?.t ?? f.t + 1 / 30;
      lines.push(`file '${file.replace(/\\/g, '/')}'`, `duration ${Math.max(0.001, next - f.t).toFixed(4)}`);
    });
    lines.push(`file '${path.join(tmp, `f${String(frames.length - 1).padStart(5, '0')}.jpg`).replace(/\\/g, '/')}'`);
    const list = path.join(tmp, 'list.txt');
    fs.writeFileSync(list, lines.join('\n'));
    const total = Math.min(dur, frames[frames.length - 1].t - frames[0].t);
    const r = spawnSync('ffmpeg', ['-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', list, '-t', String(total), '-vf', `fps=30,scale=${w * dpr}:${h * dpr}:flags=lanczos,format=yuv420p`, '-c:v', 'libx264', '-crf', '14', '-preset', 'fast', out]);
    if (r.status !== 0) throw new Error(r.stderr.toString().slice(0, 500));
    return { frames: frames.length, seconds: total, ms: Date.now() - t0 };
  } finally {
    await browser.close();
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}
