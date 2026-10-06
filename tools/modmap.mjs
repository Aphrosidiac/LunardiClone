// Build a map of turbopack module ids -> chunk, exported names, imported ids, size.
// usage: node tools/modmap.mjs <chunksDir> > modmap.json
import fs from 'node:fs';
import path from 'node:path';

const dir = process.argv[2];
const mods = {};
for (const f of fs.readdirSync(dir).filter((f) => f.endsWith('.js'))) {
  const src = fs.readFileSync(path.join(dir, f), 'utf8');
  // module factories look like: ,123456,(e)=>{ or ,123456,e=>{ or ,123456,function(e){
  const re = /[,\[]\s*(\d{2,7})\s*,\s*(?:\(?\s*([a-zA-Z_$][\w$]*)\s*\)?\s*=>\s*\{|function\s*\(\s*([a-zA-Z_$][\w$]*)[^)]*\)\s*\{)/g;
  const starts = [];
  let m;
  while ((m = re.exec(src))) starts.push({ id: m[1], at: m.index, arg: m[2] || m[3] });
  starts.forEach((s, i) => {
    const body = src.slice(s.at, i + 1 < starts.length ? starts[i + 1].at : src.length);
    const exp = new Set();
    for (const x of body.matchAll(/\.s\(\s*\[([\s\S]*?)\]\s*(?:,\s*\d+)?\)/g)) {
      for (const n of x[1].matchAll(/"([A-Za-z_$][\w$]*)"\s*,\s*\d/g)) exp.add(n[1]);
    }
    const imps = new Set();
    const a = s.arg.replace(/\$/g, '\\$');
    for (const x of body.matchAll(new RegExp(`${a}\\.[irAfx]\\((\\d+)\\)`, 'g'))) imps.add(x[1]);
    const strings = [...body.matchAll(/"([A-Z][A-Za-z ]{3,40})"/g)].map((x) => x[1]).slice(0, 8);
    mods[s.id] = { chunk: f, bytes: body.length, exports: [...exp], imports: [...imps], strings };
  });
}
console.log(JSON.stringify(mods, null, 1));
