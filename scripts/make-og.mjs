/**
 * Renders the Open Graph card (1200×630) with the site's real fonts using the Playwright Chromium
 * already installed for the tests. Output: public/og.png. Run: npm run og
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

let seed = 7;
const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
const dust = Array.from({ length: 220 }, () => {
  const x = rnd() * 1200,
    y = rnd() * 630,
    r = 1 + rnd() * rnd() * 4,
    o = 0.15 + rnd() * 0.55;
  return `<i style="left:${x.toFixed(0)}px;top:${y.toFixed(0)}px;width:${r.toFixed(1)}px;height:${r.toFixed(1)}px;opacity:${o.toFixed(2)}"></i>`;
}).join('');

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face{font-family:Fraunces;src:url(data:font/woff2;base64,${fraunces}) format('woff2');font-weight:100 900}
@font-face{font-family:Inter;src:url(data:font/woff2;base64,${inter}) format('woff2');font-weight:100 900}
html,body{margin:0}
body{width:1200px;height:630px;background:#0F0D0B;position:relative;overflow:hidden;font-family:Inter,system-ui,sans-serif}
.glow{position:absolute;inset:0;background:radial-gradient(75% 95% at 14% 112%,rgba(233,162,59,.30),transparent 68%)}
i{position:absolute;border-radius:50%;background:#F2B65E;display:block}
.name{position:absolute;left:80px;bottom:156px;font-family:Fraunces;font-weight:350;font-size:136px;line-height:.95;letter-spacing:-.02em;color:#E9A23B;font-variation-settings:'opsz' 144;text-shadow:0 0 40px rgba(233,162,59,.35)}
.sub{position:absolute;left:86px;bottom:92px;font-size:28px;font-weight:500;color:#B8AC9C;letter-spacing:.01em}
</style></head><body><div class="glow"></div>${dust}<div class="name">${NAME}</div><div class="sub">${SUB}</div></body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
await page.setContent(html);
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(200);
await page.screenshot({ path: new URL('../public/og.png', import.meta.url).pathname, type: 'png' });
await browser.close();
console.log('wrote public/og.png');
