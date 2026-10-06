// Next 16.3's static export writes per-segment prefetch payloads as nested folders
// (`works/__next.works/!KGxpc3Qp/__PAGE__.txt`), but the client router requests the flat dotted
// name (`works/__next.works.!KGxpc3Qp.__PAGE__.txt`). On a plain static host every prefetch then
// 404s and each navigation falls back to a full fetch. Write the flat names beside the folders.
import fs from 'node:fs';
import path from 'node:path';
const OUT = process.argv[2] || 'out';
let n = 0;
function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (!e.isDirectory()) continue;
    if (e.name.startsWith('__next.')) flatten(p, dir, e.name);
    else if (e.name !== '_next' && e.name !== 'media' && e.name !== 'brand') walk(p);
  }
}
function flatten(segDir, parent, prefix) {
  for (const e of fs.readdirSync(segDir, { withFileTypes: true })) {
    const p = path.join(segDir, e.name);
    const name = `${prefix}.${e.name}`;
    if (e.isDirectory()) flatten(p, parent, name);
    else {
      const target = path.join(parent, name);
      if (!fs.existsSync(target)) { fs.copyFileSync(p, target); n++; }
    }
  }
}
walk(OUT);
console.log(`postbuild: wrote ${n} flat segment files`);
