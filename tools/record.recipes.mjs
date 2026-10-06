// Live-capture recipes: what to record on each deployed FF site and how to drive it.
// `load` clips start right after navigation (intros); `scroll` clips glide down the page with
// wheel steps; `drag` clips pull a canvas around. Consent banners are declined first.

const dismiss = async (page) => {
  for (const re of [/^decline/i, /^reject/i, /^dismiss/i, /enter without/i, /^no thanks/i]) {
    const b = page.getByRole('button', { name: re }).first();
    if (await b.isVisible().catch(() => false)) await b.click({ timeout: 2000 }).catch(() => {});
  }
};

const scroll = (url, { dur = 7, px = 2600, settle = 3500, w, h } = {}) => ({
  url, dur, settle, w, h,
  recipe: {
    before: dismiss,
    run: async (page, { sleep }) => {
      await page.mouse.move(800, 450);
      const steps = Math.round(dur * 20);
      for (let i = 0; i < steps; i++) {
        await page.mouse.wheel(0, px / steps);
        await sleep(50);
      }
    },
  },
});

const load = (url, { dur = 6, settle = 200, w, h } = {}) => ({ url, dur, settle, w, h, recipe: { before: async () => {} } });
// an intro clip still wants the consent banner gone; ffdev.studio remembers the choice per context, so
// these load clips simply accept that the banner may slide in late

const drag = (url, { dur = 7, settle = 6000, path = [[0.6, 0.55], [0.3, 0.35], [0.45, 0.7], [0.7, 0.4]] } = {}) => ({
  url, dur, settle,
  recipe: {
    before: dismiss,
    run: async (page, { w, h, sleep }) => {
      let [x, y] = [w * 0.5, h * 0.5];
      await page.mouse.move(x, y);
      for (const [px, py] of path) {
        await page.mouse.down();
        const [tx, ty] = [w * px, h * py];
        const n = 30;
        for (let i = 1; i <= n; i++) {
          const k = i / n;
          const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
          await page.mouse.move(x + (tx - x) * e, y + (ty - y) * e);
          await sleep(16);
        }
        await page.mouse.up();
        [x, y] = [tx, ty];
        await sleep(650);
      }
    },
  },
});

export const RECIPES = {
  // works without a screen recording on this machine
  'works/hai-awan/load': load('https://awan.ffdev.studio/', { settle: 1500 }),
  'works/hai-awan/scroll': scroll('https://awan.ffdev.studio/'),
  'works/ff-member/load': load('https://ff-member.pages.dev/', { dur: 7 }),
  'works/ff-member/scroll': scroll('https://ff-member.pages.dev/', { settle: 6000 }),
  'works/indahnya/load': load('https://indahnya-86v.pages.dev/', { settle: 1200 }),
  'works/indahnya/scroll': scroll('https://indahnya-86v.pages.dev/', { px: 3200 }),
  'works/big-brain-furniture/load': load('https://bbf.lewix.ai/', { settle: 2500 }),
  'works/big-brain-furniture/scroll': scroll('https://bbf.lewix.ai/', { px: 3400 }),
  'works/ascend-peptides/load': load('https://ascendpeptides.my/', { settle: 2500 }),
  'works/ascend-peptides/scroll': scroll('https://ascendpeptides.my/', { px: 3000 }),
  'works/obys-translation/load': load('https://ff-concepts.pages.dev/concepts/02/', { settle: 400 }),
  'works/obys-translation/scroll': scroll('https://ff-concepts.pages.dev/concepts/02/'),
  'works/basement-translation/load': load('https://ff-concepts.pages.dev/concepts/01/', { settle: 400 }),
  'works/basement-translation/scroll': scroll('https://ff-concepts.pages.dev/concepts/01/'),
  'works/ff-phantom/intro': load('https://ffdev.studio/?ff_internal=1', { dur: 6, settle: 100 }),
  'works/ff-phantom/grid': drag('https://ffdev.studio/?ff_internal=1'),
  'works/ff-siena/load': load('https://ff-siena.pages.dev/', { settle: 300, dur: 7 }),
  'works/ff-cellar/load': load('https://ff-cellar.pages.dev/', { settle: 1500 }),
  'works/ff-cellar/scroll': scroll('https://ff-cellar.pages.dev/', { px: 3000 }),

  // lab captures
  'lab/wrapping-grid': drag('https://ffdev.studio/?ff_internal=1', { path: [[0.25, 0.3], [0.7, 0.75], [0.35, 0.65]] }),
  'lab/lockup-intro': load('https://ffdev.studio/about?ff_internal=1', { dur: 4, settle: 50 }),
};
