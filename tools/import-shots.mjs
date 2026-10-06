// Copy PhantomClone's captured project screens (C:/Dev/PhantomClone/public/media/<slug>/s-*.webp,
// manifest src/shots.json) into public/media/shots and write src/content/shots.json with lqips.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
const PC = 'C:/Dev/PhantomClone';
const shots = JSON.parse(fs.readFileSync(`${PC}/src/shots.json`, 'utf8'));
const out = {};
const cache = '.media-cache/lqip';
fs.mkdirSync(cache, { recursive: true });
for (const [slug, s] of Object.entries(shots)) {
  const items = [s.cover, ...s.rows.flatMap((r) => r.items.map((i) => ({ ...i, row: r.kind })))];
  out[slug] = [];
  for (const it of items) {
    const dst = path.join('public/media/shots', slug);
    fs.mkdirSync(dst, { recursive: true });
    const base = path.basename(it.src, '.webp');
    fs.copyFileSync(`${PC}/public${it.src}`, path.join(dst, base + '.webp'));
    let widths = [];
    if (it.sm) { fs.copyFileSync(`${PC}/public${it.sm}`, path.join(dst, `${base}-${it.smw}.webp`)); widths = [it.smw]; }
    const ph = path.join(cache, `${slug}-${base}.webp`);
    spawnSync('ffmpeg', ['-v', 'error', '-y', '-i', `${PC}/public${it.src}`, '-vf', 'scale=24:-2', '-c:v', 'libwebp', '-quality', '50', ph]);
    out[slug].push({ src: `/media/shots/${slug}/${base}.webp`, width: it.w, height: it.h, widths, alt: it.alt || '', page: it.page || '', row: it.row || 'cover', lqip: 'data:image/webp;base64,' + fs.readFileSync(ph).toString('base64') });
  }
}
fs.writeFileSync('src/content/shots.json', JSON.stringify(out, null, 1));
console.log(Object.entries(out).map(([k, v]) => `${k}:${v.length}`).join(' '));
