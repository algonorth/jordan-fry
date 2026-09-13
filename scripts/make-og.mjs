/**
 * Renders the Open Graph card (1200×630) with the site's real fonts using the Playwright Chromium
 * already installed for the tests. The name is set in sawdust, the way the hero forms it, with the
 * last letters blowing off into the shaft, so the preview card promises what the page does.
 * Output: public/og.png. Run: npm run og
 */
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require('@playwright/test');

const b64 = (p) => readFileSync(new URL(p, import.meta.url)).toString('base64');
const fraunces = b64('../src/assets/fonts/fraunces-latin-opsz-normal.woff2');
const inter = b64('../src/assets/fonts/inter-latin-wght-normal.woff2');

// TODO: area (kept in sync with src/data/site.ts by hand; this runs outside Astro)
const NAME = 'Jordan Fry';
const SUB = 'Carpenter and contractor · Westmoreland County, PA';
const NAME_LEFT = 80;
const NAME_TOP = 342; // the name's line box sits above the subtitle, as on the page
const NAME_CSS =
  "font-family:Fraunces;font-weight:350;font-size:136px;line-height:.95;letter-spacing:-.02em;font-variation-settings:'opsz' 144;white-space:nowrap";

const fonts = `
@font-face{font-family:Fraunces;src:url(data:font/woff2;base64,${fraunces}) format('woff2');font-weight:100 900}
@font-face{font-family:Inter;src:url(data:font/woff2;base64,${inter}) format('woff2');font-weight:100 900}`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });

// Pass 1: typeset the name alone (real optical size and kerning) and keep its alpha as an image.
await page.setContent(
  `<!doctype html><html><head><meta charset="utf-8"><style>${fonts}
html,body{margin:0;background:transparent}
.name{position:absolute;left:0;top:0;color:#fff;${NAME_CSS}}
</style></head><body><div class="name">${NAME}</div></body></html>`,
);
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(100);
const glyphs = (
  await page.screenshot({ omitBackground: true, clip: { x: 0, y: 0, width: 700, height: 150 } })
).toString('base64');

// Pass 2: the card. The glyph image is sampled into motes on a canvas; the ground, glow and the
// subtitle are plain HTML.
await page.setContent(
  `<!doctype html><html><head><meta charset="utf-8"><style>${fonts}
html,body{margin:0}
body{width:1200px;height:630px;background:#0F0D0B;position:relative;overflow:hidden;font-family:Inter,system-ui,sans-serif}
.shaft{position:absolute;inset:0;background:radial-gradient(60% 80% at 24% -10%,rgba(233,162,59,.16),transparent 70%)}
.glow{position:absolute;inset:0;background:radial-gradient(75% 95% at 14% 112%,rgba(233,162,59,.26),transparent 68%)}
.halo{position:absolute;left:${NAME_LEFT}px;top:${NAME_TOP}px;color:#E9A23B;opacity:.28;filter:blur(26px);${NAME_CSS}}
.under{position:absolute;left:${NAME_LEFT}px;top:${NAME_TOP}px;color:#F3EBE0;opacity:.3;${NAME_CSS}}
canvas{position:absolute;inset:0}
.sub{position:absolute;left:86px;bottom:92px;font-size:28px;font-weight:500;color:#B8AC9C;letter-spacing:.01em}
</style></head><body><div class="shaft"></div><div class="glow"></div><div class="halo">${NAME}</div><div class="under">${NAME}</div>
<canvas id="c" width="1200" height="630"></canvas><div class="sub">${SUB}</div>
<img id="g" src="data:image/png;base64,${glyphs}" hidden>
<script>
(async () => {
  const img = document.getElementById('g');
  await img.decode();
  const src = document.createElement('canvas');
  src.width = img.width; src.height = img.height;
  const sctx = src.getContext('2d', { willReadFrequently: true });
  sctx.drawImage(img, 0, 0);
  const { data, width, height } = sctx.getImageData(0, 0, src.width, src.height);
  // Extent of the inked pixels: the wind grows from the last fifth of the name.
  let x0 = width, x1 = 0;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++)
    if (data[(y * width + x) * 4 + 3] > 96) { if (x < x0) x0 = x; if (x > x1) x1 = x; }
  const span = Math.max(1, x1 - x0);

  let seed = 7;
  const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
  const ctx = document.getElementById('c').getContext('2d');
  ctx.globalCompositeOperation = 'lighter';
  const mote = (x, y, r, a, warm) => {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    const c = warm > 0.7 ? '255,241,214' : '233,162,59';
    g.addColorStop(0, 'rgba(' + c + ',' + a.toFixed(3) + ')');
    g.addColorStop(0.55, 'rgba(' + c + ',' + (a * 0.55).toFixed(3) + ')');
    g.addColorStop(1, 'rgba(' + c + ',0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  };
  // Ambient dust in the shaft, sparse, as on the page.
  for (let i = 0; i < 260; i++) {
    const x = rnd() * 1200, y = rnd() * 630;
    const near = rnd();
    mote(x, y, 1 + near * near * 3.2, 0.18 + rnd() * 0.5, rnd());
  }
  // The name: one mote per inked 2×2 cell, jittered. Over the last eighth of the width the
  // letters loosen: a growing share of their motes lifts off and blows up the shaft, the rest stay
  // put, so the last letter still reads while it sheds.
  const wind = [0.86, -0.5]; // up and to the right
  for (let y = 0; y < height; y += 2) {
    for (let x = 0; x < width; x += 2) {
      if (data[(y * width + x) * 4 + 3] <= 110) continue;
      const u = (x - x0) / span;
      const loose = Math.max(0, (u - 0.87) / 0.13);
      const flies = rnd() < loose * 0.75;
      const throwK = flies ? loose * (0.25 + rnd() * 1.0) : 0;
      const dx = wind[0] * 150 * throwK + (flies ? (rnd() - 0.5) * 70 * loose : 0);
      const dy = wind[1] * 150 * throwK + (flies ? (rnd() - 0.5) * 70 * loose : 0);
      const jx = (rnd() - 0.5) * 1.4, jy = (rnd() - 0.5) * 1.4;
      const r = 1.35 + rnd() * rnd() * 1.4 + (flies ? rnd() * 1.2 : 0);
      const a = (0.7 + rnd() * 0.3) * (flies ? 0.7 : 1);
      mote(${NAME_LEFT} + x + jx + dx, ${NAME_TOP} + y + jy + dy, r, a, rnd() + 0.25 * loose);
    }
  }
  // A few strays already gone up the shaft.
  for (let i = 0; i < 70; i++) {
    const t = rnd();
    const x = ${NAME_LEFT} + x1 + 30 + t * 380 + (rnd() - 0.5) * 110;
    const y = ${NAME_TOP} + 60 - t * 220 + (rnd() - 0.5) * 120;
    mote(x, y, 1 + rnd() * 1.8, 0.2 + rnd() * 0.45, rnd());
  }
  window.__done = true;
})();
</script></body></html>`,
);
await page.evaluate(() => document.fonts.ready);
await page.waitForFunction(() => window.__done === true);
await page.waitForTimeout(150);
await page.screenshot({ path: new URL('../public/og.png', import.meta.url).pathname, type: 'png' });
await browser.close();
console.log('wrote public/og.png');
