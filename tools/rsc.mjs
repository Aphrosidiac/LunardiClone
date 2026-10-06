// Pull the concatenated React flight payload out of each snapshot page.
import fs from 'node:fs';
import path from 'node:path';
const dir = process.argv[2], out = process.argv[3];
fs.mkdirSync(out, { recursive: true });
for (const f of fs.readdirSync(dir).filter((f) => f.endsWith('.html'))) {
  const html = fs.readFileSync(path.join(dir, f), 'utf8');
  let flight = '';
  for (const m of html.matchAll(/self\.__next_f\.push\((\[[\s\S]*?\])\)<\/script>/g)) {
    try { const a = JSON.parse(m[1]); if (a[0] === 1 && typeof a[1] === 'string') flight += a[1]; } catch {}
  }
  fs.writeFileSync(path.join(out, f.replace('.html', '.txt')), flight);
}
