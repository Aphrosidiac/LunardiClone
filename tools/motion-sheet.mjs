// Contact sheets around each marked action of a tools/motion.mjs recording:
// row per action, `n` frames every `step` seconds from `pre` before the action.
// usage: node tools/motion-sheet.mjs <recDir> <out.jpg> [step=0.1] [n=12] [pre=0.1] [scale=360]
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
const [dir, out, step = '0.1', n = '12', pre = '0.1', scale = '360'] = process.argv.slice(2);
const { frames, marks } = JSON.parse(fs.readFileSync(path.join(dir, 'index.json'), 'utf8'));
const pick = (t) => { let best = frames[0]; for (const f of frames) { if (f.t <= t) best = f; else break; } return best; };
const rows = marks.map((m) => Array.from({ length: +n }, (_, i) => pick(Math.max(0, m.t - +pre + i * +step))));
const tmp = fs.mkdtempSync(path.join(dir, 'sheet-'));
const list = [];
rows.forEach((r) => r.forEach((f) => list.push(path.join(dir, f.name))));
list.forEach((f, i) => fs.copyFileSync(f, path.join(tmp, `s${String(i).padStart(4, '0')}.jpg`)));
const r = spawnSync('ffmpeg', ['-v', 'error', '-y', '-framerate', '1', '-i', path.join(tmp, 's%04d.jpg'), '-vf', `scale=${scale}:-2,tile=${n}x${marks.length}:padding=2:color=red`, '-frames:v', '1', out]);
fs.rmSync(tmp, { recursive: true, force: true });
if (r.status) console.log(r.stderr.toString());
console.log(marks.map((m) => m.label).join(' / '));
