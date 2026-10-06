// FF media pipeline: turns screen recordings, live-site captures, films and stills into the same
// "resolution ladder" the reference serves (original / 720 / 480 / 240 mp4 + webp posters + a tiny
// placeholder), and records everything in src/content/media.json for the content modules.
//
//   node tools/media.mjs [filter]        run every job in tools/media.jobs.mjs (or ids matching filter)
//   FORCE=1 node tools/media.mjs ...     re-encode even if outputs exist
//
// Job kinds (see media.jobs.mjs):
//   { id, cut: { file, at, dur, speed?, crop? } }       a stretch of an existing video
//   { id, record: { url, w?, h?, dur, recipe? } }      a live capture (headless Chromium on the GPU)
//   { id, still: { file, crop? } }                      an image → webp widths + lqip
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { JOBS } from './media.jobs.mjs';
import { record } from './record.mjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1')), '..');
const PUB = path.join(ROOT, 'public');
const MANIFEST = path.join(ROOT, 'src/content/media.json');
const CACHE = path.join(ROOT, '.media-cache');
const FORCE = !!process.env.FORCE;
const filter = process.argv[2];

const manifest = fs.existsSync(MANIFEST) ? JSON.parse(fs.readFileSync(MANIFEST, 'utf8')) : {};
fs.mkdirSync(CACHE, { recursive: true });

function ff(args, opts = {}) {
  const r = spawnSync('ffmpeg', ['-v', 'error', '-y', ...args], { stdio: ['ignore', 'pipe', 'pipe'], ...opts });
  if (r.status !== 0) throw new Error('ffmpeg failed: ' + r.stderr.toString().slice(0, 800) + '\nargs: ' + args.join(' '));
  return r;
}
function probe(file) {
  const r = spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-show_entries', 'format=duration', '-of', 'json', file]);
  const j = JSON.parse(r.stdout.toString());
  return { width: j.streams[0].width, height: j.streams[0].height, duration: +j.format.duration };
}
const even = (n) => Math.max(2, Math.round(n / 2) * 2);

// Tiers: height of the shorter side for portrait, of the height for landscape (the reference
// names tiers by height; a 9:16 film's "720" is 720 wide x 1280 tall there too).
const TIERS = [
  { quality: '240', short: 240, crf: 31 },
  { quality: '480', short: 480, crf: 30 },
  { quality: '720', short: 720, crf: 29 },
  { quality: 'original', short: 1080, crf: 28 },
];

function ladder(id, master) {
  const outDir = path.join(PUB, 'media', id);
  fs.mkdirSync(outDir, { recursive: true });
  const { width, height } = probe(master);
  const short = Math.min(width, height);
  const renditions = [];
  for (const t of TIERS) {
    const s = Math.min(t.short, short);
    if (t.quality !== 'original' && t.short > short) continue;
    // a source under ~1000px tall has no tier above 720: "original" points at the 720 file
    if (t.quality === 'original' && short < 1000 && renditions.length) {
      const top = renditions[renditions.length - 1];
      renditions.push({ quality: 'original', url: top.url, poster: top.poster });
      continue;
    }
    const scale = width <= height ? `${even(s)}:-2` : `-2:${even(s)}`;
    const file = path.join(outDir, `${t.quality}.mp4`);
    const poster = path.join(outDir, `${t.quality}-poster.webp`);
    if (FORCE || !fs.existsSync(file)) {
      ff(['-i', master, '-an', '-vf', `scale=${scale}:flags=lanczos,format=yuv420p`, '-c:v', 'libx264', '-preset', 'slow', '-crf', String(t.crf), '-profile:v', 'high', '-movflags', '+faststart', file]);
      ff(['-ss', '0.4', '-i', file, '-frames:v', '1', '-c:v', 'libwebp', '-quality', '80', poster]);
    }
    renditions.push({ quality: t.quality, url: `/media/${id}/${t.quality}.mp4`, poster: `/media/${id}/${t.quality}-poster.webp` });
  }
  // tiny placeholder, like the reference's 24px webp data URIs
  const ph = path.join(CACHE, id.replace(/\//g, '__') + '-ph.webp');
  ff(['-ss', '0.4', '-i', master, '-frames:v', '1', '-vf', 'scale=24:-2', '-c:v', 'libwebp', '-quality', '50', ph]);
  const placeholder = 'data:image/webp;base64,' + fs.readFileSync(ph).toString('base64');
  return { type: 'video', width, height, placeholder, renditions };
}

function cut(job) {
  const c = job.cut;
  const speed = c.speed || 1;
  const master = path.join(CACHE, job.id.replace(/\//g, '__') + '.mp4');
  if (FORCE || !fs.existsSync(master)) {
    const vf = [c.crop ? `crop=${c.crop}` : null, speed !== 1 ? `setpts=PTS/${speed}` : null, `fps=${c.fps || 30}`, 'format=yuv420p'].filter(Boolean).join(',');
    ff(['-ss', String(c.at), '-t', String(c.dur * speed), '-i', c.file, '-an', '-vf', vf, '-c:v', 'libx264', '-crf', '14', '-preset', 'fast', master]);
  }
  return master;
}

async function rec(job) {
  const master = path.join(CACHE, job.id.replace(/\//g, '__') + '.mp4');
  if (FORCE || !fs.existsSync(master)) await record({ ...job.record, out: master });
  return master;
}

function still(job) {
  const { file, crop, widths = [480, 960, 1440, 2400] } = job.still;
  const outDir = path.join(PUB, 'media', path.dirname(job.id));
  fs.mkdirSync(outDir, { recursive: true });
  const stem = path.join(outDir, path.basename(job.id));
  const src = path.join(CACHE, job.id.replace(/\//g, '__') + '-src.png');
  ff(['-i', file, ...(crop ? ['-vf', `crop=${crop}`] : []), '-frames:v', '1', src]);
  const { width, height } = probe(src);
  const ws = widths.filter((w) => w < width);
  const top = Math.min(width, widths[widths.length - 1]);
  for (const w of [...ws, top]) {
    const out = w === top ? `${stem}.webp` : `${stem}-${w}.webp`;
    if (FORCE || !fs.existsSync(out)) ff(['-i', src, '-vf', `scale=${w}:-2:flags=lanczos`, '-c:v', 'libwebp', '-quality', '82', out]);
  }
  const ph = path.join(CACHE, job.id.replace(/\//g, '__') + '-ph.webp');
  ff(['-i', src, '-vf', 'scale=24:-2', '-c:v', 'libwebp', '-quality', '50', ph]);
  const h = Math.round((height * top) / width);
  return {
    type: 'image',
    src: `/media/${job.id}.webp`,
    width: top,
    height: h,
    widths: ws,
    lqip: 'data:image/webp;base64,' + fs.readFileSync(ph).toString('base64'),
    alt: job.alt || '',
  };
}

for (const job of JOBS) {
  if (filter && !job.id.includes(filter)) continue;
  if (process.env.KIND && !job[process.env.KIND]) continue;
  if (!FORCE && manifest[job.id] && !job.redo) continue;
  try {
    let entry;
    if (job.still) entry = still(job);
    else {
      const master = job.cut ? cut(job) : await rec(job);
      entry = ladder(job.id, master);
    }
    if (job.alt) entry.alt = job.alt;
    manifest[job.id] = entry;
    fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 1));
    console.log('ok', job.id, entry.type, entry.width + 'x' + entry.height);
  } catch (e) {
    console.log('FAIL', job.id, e.message.split('\n').slice(0, 3).join(' | '));
  }
}
