// Turn a React flight payload (from tools/rsc.mjs) into readable JSX, resolving client
// references to "<ModuleName#id>" so a page's server composition can be read directly.
// usage: node tools/rsc2jsx.mjs <rsc.txt> [--full]   (long strings are elided unless --full)
import fs from 'node:fs';

const file = process.argv[2];
const full = process.argv.includes('--full');
const src = fs.readFileSync(file, 'utf8');

// parse rows: <hexid>:<payload>\n  ; T rows: <id>:T<hexlen>,<text>
const rows = {};
let i = 0;
while (i < src.length) {
  const colon = src.indexOf(':', i);
  if (colon < 0) break;
  const id = src.slice(i, colon);
  if (!/^[0-9a-f]+$/.test(id)) { const nl = src.indexOf('\n', i); if (nl < 0) break; i = nl + 1; continue; }
  if (src[colon + 1] === 'T') {
    const comma = src.indexOf(',', colon);
    const len = parseInt(src.slice(colon + 2, comma), 16);
    // length is in bytes (utf8)
    const buf = Buffer.from(src.slice(comma + 1), 'utf8').subarray(0, len).toString('utf8');
    rows[id] = { t: 'text', v: buf };
    i = comma + 1 + buf.length;
    continue;
  }
  const nl = src.indexOf('\n', colon);
  const line = src.slice(colon + 1, nl < 0 ? src.length : nl);
  i = nl < 0 ? src.length : nl + 1;
  if (line[0] === 'I') { try { const a = JSON.parse(line.slice(1)); rows[id] = { t: 'client', v: `${a[2] || 'default'}#${a[0]}` }; } catch { rows[id] = { t: 'raw', v: line }; } continue; }
  if (line[0] === 'H' || line[0] === 'E' || line[0] === 'W' || line[0] === 'D') { rows[id] = { t: 'meta', v: line }; continue; }
  try { rows[id] = { t: 'json', v: JSON.parse(line) }; } catch { rows[id] = { t: 'raw', v: line }; }
}

const clip = (s) => (full || s.length < 160 ? s : s.slice(0, 120) + `…[${s.length}]`);
function ref(s) {
  // "$L3e" lazy, "$3e" row, "$@3e" promise, "$S..." symbol, "$undefined"
  const m = /^\$(?:L|@)?([0-9a-f]+)$/.exec(s);
  if (!m) return null;
  return rows[m[1]];
}
const seen = new Set();
function val(v, ind) {
  if (typeof v === 'string') {
    if (v === '$undefined') return 'undefined';
    if (v.startsWith('$Sreact.')) return v.slice(2);
    const r = ref(v);
    if (r) {
      if (r.t === 'client') return `{${r.v}}`;
      if (r.t === 'text') return JSON.stringify(clip(r.v));
      if (r.t === 'json') { const key = v; if (seen.has(key) && !full) return `/*${v}*/`; seen.add(key); return node(r.v, ind); }
    }
    return JSON.stringify(clip(v));
  }
  if (Array.isArray(v)) {
    if (v[0] === '$') return node(v, ind);
    return '[' + v.map((x) => val(x, ind)).join(', ') + ']';
  }
  if (v && typeof v === 'object') {
    return '{ ' + Object.entries(v).map(([k, x]) => `${k}: ${val(x, ind)}`).join(', ') + ' }';
  }
  return String(v);
}
function tagName(t) {
  if (typeof t !== 'string') return 'Unknown';
  const r = ref(t);
  if (r && r.t === 'client') return r.v;
  if (t.startsWith('$S')) return t.slice(2);
  return t;
}
function node(n, ind = '') {
  if (n == null) return '';
  if (typeof n === 'string' || typeof n === 'number' || typeof n === 'boolean') return ind + val(n, ind);
  if (!Array.isArray(n)) return ind + val(n, ind);
  if (n[0] !== '$') return n.map((c) => node(c, ind)).join('\n');
  const [, t, , props = {}] = n;
  const name = tagName(t);
  const { children, ...rest } = props || {};
  const attrs = Object.entries(rest).map(([k, v]) => `${k}=${typeof v === 'string' && !v.startsWith('$') ? JSON.stringify(clip(v)) : '{' + val(v, ind + '  ') + '}'}`).join(' ');
  const open = `${ind}<${name}${attrs ? ' ' + attrs : ''}`;
  if (children == null || (Array.isArray(children) && children.length === 0)) return open + ' />';
  const kids = Array.isArray(children) && children[0] !== '$' ? children : [children];
  const inner = kids.map((c) => (typeof c === 'string' && !c.startsWith('$') ? ind + '  ' + clip(c) : node(c, ind + '  '))).filter(Boolean).join('\n');
  return `${open}>\n${inner}\n${ind}</${name}>`;
}

const root = rows['0'];
let out = '';
if (root && root.t === 'json') out = node(root.v.f ? root.v.f : root.v, '');
// Also dump any large element rows not reached (lazy children)
for (const [id, r] of Object.entries(rows)) {
  if (r.t === 'json' && Array.isArray(r.v) && r.v[0] === '$' && !seen.has('$' + id)) out += `\n\n/* row ${id} */\n` + node(r.v, '');
}
console.log(out);
