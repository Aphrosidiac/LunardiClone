// Computed-style diff keyed by class list. Our markup copies the reference's class strings, so an
// element with the same tag + class list should compute identically; any difference is a CSS gap
// (a utility our Tailwind build does not generate, a theme token off, a font metric).
// usage: node tools/style-diff.mjs refPath ourPath [w h]
import { chromium } from 'playwright';
const [refPath = '/', ourPath = '/', W = '1440', H = '900'] = process.argv.slice(2);
const REF = 'https://www.edoardolunardi.dev', OURS = process.env.OURS || 'http://localhost:3181';
const PROPS = ['display', 'position', 'font-family', 'font-size', 'font-weight', 'line-height', 'letter-spacing', 'color', 'background-color', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left', 'margin-top', 'margin-bottom', 'gap', 'border-top-width', 'border-top-color', 'border-radius', 'box-shadow', 'height', 'width', 'opacity', 'text-decoration-line', 'text-underline-offset', 'grid-template-columns', 'transition-duration', 'transition-timing-function', 'z-index', 'overflow-y', 'translate', 'transform', 'white-space', 'text-wrap'];
const browser = await chromium.launch({ headless: true, channel: 'chromium', args: ['--use-angle=d3d11', '--enable-gpu'] });
async function collect(url) {
  const p = await browser.newPage({ viewport: { width: +W, height: +H } });
  await p.goto(url, { waitUntil: 'load' }).catch(() => {});
  await p.waitForTimeout(6000);
  const r = await p.evaluate((PROPS) => {
    const out = {};
    for (const el of document.querySelectorAll('body *')) {
      const cls = typeof el.className === 'string' ? el.className.trim().split(/\s+/).sort().join(' ') : '';
      if (!cls || el.closest('svg')) continue;
      const key = el.tagName.toLowerCase() + '|' + cls;
      if (out[key]) continue;
      const cs = getComputedStyle(el);
      const o = {};
      for (const pr of PROPS) {
        let v = cs.getPropertyValue(pr);
        if ((pr === 'width' || pr === 'height') && /^\d/.test(v)) v = Math.round(parseFloat(v)) + 'px';
        o[pr] = v;
      }
      out[key] = o;
    }
    return out;
  }, PROPS);
  await p.close();
  return r;
}
const [a, b] = await Promise.all([collect(REF + refPath), collect(OURS + ourPath)]);
let common = 0, diffs = 0;
for (const k of Object.keys(a)) {
  if (!b[k]) continue;
  common++;
  const d = PROPS.filter((p) => a[k][p] !== b[k][p] && !['width', 'height', 'font-family'].includes(p));
  const fam = a[k]['font-family'].split(',')[0] !== b[k]['font-family'].split(',')[0];
  if (d.length || fam) {
    diffs++;
    console.log(k.slice(0, 140));
    for (const p of d) console.log(`   ${p}: ref=${a[k][p]}  ours=${b[k][p]}`);
    if (fam) console.log(`   font-family: ref=${a[k]['font-family'].slice(0, 50)}  ours=${b[k]['font-family'].slice(0, 50)}`);
  }
}
const onlyRef = Object.keys(a).filter((k) => !b[k]);
console.log(`\n${common} shared class lists, ${diffs} with differences; ${onlyRef.length} ref-only class lists`);
if (process.env.SHOW_ONLY) console.log(onlyRef.map((k) => '  ' + k.slice(0, 160)).join('\n'));
await browser.close();
