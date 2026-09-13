/**
 * Generates the placeholder artwork as shop drawings: one SVG "sheet" per image, drawn in amber
 * hairlines on ink with a drafting grid, a lamp glow, a few motes of dust and a title block set in
 * the site's own Inter (glyph outlines, so no font is needed at render time). Deterministic, so
 * regenerating never changes a sheet by accident. Sizes match the layout; drop a JPEG beside each
 * index.md later and point `cover:` / `gallery:` at it.
 * Run: npm run placeholders
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { create } from 'fontkitten';

const OUT = 'src/content/work';
/** Sheet sizes. Covers are composed for the grid slot they occupy (see WorkGrid.astro), so nothing crops. */
const SIZES = {
  landscape: [1600, 1200], // 4:3
  portrait: [1200, 1600], // 3:4
  square: [1400, 1400], // 1:1
  wide: [1600, 1000], // 16:10
  photo: [1600, 1067], // 3:2
  about: [1200, 1500], // 4:5
};

const INK = '#171310';
const AMBER = '#E9A23B';
const OAK = '#C99A66';
const LINEN = '#F3EBE0';

/* ------------------------------------------------------------------ */
/* Lettering: Inter glyph outlines, deduplicated per sheet             */
/* ------------------------------------------------------------------ */
const inter = create(
  readFileSync(new URL('../src/assets/fonts/inter-latin-wght-normal.woff2', import.meta.url)),
);
const UPM = inter.unitsPerEm;

function makeLettering() {
  const defs = new Map(); // glyph id -> path d
  const measure = (str, size, tracking = 0) => {
    const glyphs = inter.glyphsForString(str);
    let w = 0;
    for (const g of glyphs) w += (g.advanceWidth / UPM) * size + tracking * size;
    return w - tracking * size;
  };
  /** Text run as <use> references. anchor: start | middle | end. */
  const text = (x, y, str, size, o = {}) => {
    const { tracking = 0, anchor = 'start', fill = LINEN, opacity = 0.7 } = o;
    const glyphs = inter.glyphsForString(str);
    const total = measure(str, size, tracking);
    let cx = anchor === 'middle' ? x - total / 2 : anchor === 'end' ? x - total : x;
    const s = size / UPM;
    const uses = [];
    for (const g of glyphs) {
      if (g.id !== 0 && g.name !== 'space' && !defs.has(g.id)) defs.set(g.id, g.path.toSVG());
      if (g.name !== 'space' && g.id !== 0)
        uses.push(
          `<use href="#g${g.id}" transform="translate(${r(cx)} ${r(y)}) scale(${s.toFixed(5)} ${(-s).toFixed(5)})"/>`,
        );
      cx += (g.advanceWidth / UPM) * size + tracking * size;
    }
    return `<g class="t" fill="${fill}" fill-opacity="${opacity}">${uses.join('')}</g>`;
  };
  const defsSvg = () =>
    `<defs>${Array.from(defs, ([id, d]) => `<path id="g${id}" d="${d}"/>`).join('')}</defs>`;
  return { text, measure, defsSvg };
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */
const r = (n) => (Math.round(n * 10) / 10).toString();
function hash(str) {
  let h = 2166136261;
  for (const c of str) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return h >>> 0;
}
function mulberry32(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const hatchSteps = new Set();
const hatchDefs = () =>
  Array.from(
    hatchSteps,
    (st) =>
      `<pattern id="hatch${st}" width="${st}" height="${st}" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line class="h" x1="0" y1="0" x2="0" y2="${st}"/></pattern>`,
  ).join('');

/**
 * Drafting primitives. Classes: o outline · s secondary · h hatch · f fill · d dimension · x hidden.
 * Solid stroked elements carry `pathLength="1"` and their drafting order in `--k`, so an inline
 * sheet can draw itself line by line with nothing but CSS (see `.sheet` in global.css). Hidden
 * (dashed) lines keep their dash and fade in with the fills instead.
 */
let strokeIndex = 0;
const STROKED = new Set(['o', 's', 'd', 'frame']);
const attrs = (c) =>
  STROKED.has(c) ? ` class="${c}" pathLength="1" style="--k:${strokeIndex++}"` : ` class="${c}"`;
const P = {
  line: (x1, y1, x2, y2, c = 'o') =>
    `<line${attrs(c)} x1="${r(x1)}" y1="${r(y1)}" x2="${r(x2)}" y2="${r(y2)}"/>`,
  rect: (x, y, w, h, c = 'o') =>
    `<rect${attrs(c)} x="${r(x)}" y="${r(y)}" width="${r(w)}" height="${r(h)}"/>`,
  circle: (cx, cy, rad, c = 'o') => `<circle${attrs(c)} cx="${r(cx)}" cy="${r(cy)}" r="${r(rad)}"/>`,
  path: (d, c = 'o') => `<path${attrs(c)} d="${d}"/>`,
  poly: (pts, c = 'o', close = false) =>
    `<path${attrs(c)} d="M${pts.map(([x, y]) => `${r(x)} ${r(y)}`).join('L')}${close ? 'Z' : ''}"/>`,
  /** parallel lines inside a rect: dir 'h' (horizontal lines) or 'v' */
  lines: (x, y, w, h, step, dir = 'h', c = 's', offset = 0) => {
    const out = [];
    if (dir === 'h')
      for (let yy = y + offset; yy <= y + h + 0.01; yy += step) out.push(P.line(x, yy, x + w, yy, c));
    else for (let xx = x + offset; xx <= x + w + 0.01; xx += step) out.push(P.line(xx, y, xx, y + h, c));
    return out.join('');
  },
  /** 45° hatch: a rect filled with a pattern (registered per sheet, see `hatchDefs`) */
  hatch: (x, y, w, h, step = 14) => {
    hatchSteps.add(step);
    return `<rect class="hh" fill="url(#hatch${step})" x="${r(x)}" y="${r(y)}" width="${r(w)}" height="${r(h)}"/>`;
  },
  /** brick running bond inside a rect */
  brick: (x, y, w, h, bw = 44, bh = 18, c = 'h') => {
    const out = [];
    let row = 0;
    for (let yy = y; yy < y + h - 0.01; yy += bh, row++) {
      out.push(P.line(x, yy, x + w, yy, c));
      const off = row % 2 ? bw / 2 : 0;
      for (let xx = x + off; xx < x + w; xx += bw) out.push(P.line(xx, yy, xx, Math.min(yy + bh, y + h), c));
    }
    return out.join('');
  },
};

/**
 * Dimension line between two points with architectural tick ends, extension lines and a label.
 * `off` moves the line perpendicular to the measured segment; positive = to the left of p1→p2.
 */
function dim(L, x1, y1, x2, y2, label, off = 60, o = {}) {
  const dx = x2 - x1,
    dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len,
    ny = dx / len; // left normal
  const ax = x1 + nx * off,
    ay = y1 + ny * off,
    bx = x2 + nx * off,
    by = y2 + ny * off;
  const ext = 12;
  const out = [];
  out.push(P.line(x1 + nx * 8, y1 + ny * 8, ax + nx * ext, ay + ny * ext, 'd'));
  out.push(P.line(x2 + nx * 8, y2 + ny * 8, bx + nx * ext, by + ny * ext, 'd'));
  out.push(P.line(ax - (dx / len) * 6, ay - (dy / len) * 6, bx + (dx / len) * 6, by + (dy / len) * 6, 'd'));
  // ticks: 45° slashes
  const tx = (dx / len + nx) * 7,
    ty = (dy / len + ny) * 7;
  out.push(P.line(ax - tx, ay - ty, ax + tx, ay + ty, 'd'));
  out.push(P.line(bx - tx, by - ty, bx + tx, by + ty, 'd'));
  const size = o.size ?? 20;
  const mx = (ax + bx) / 2 + nx * (size * 0.55),
    my = (ay + by) / 2 + ny * (size * 0.55);
  const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
  const rot = angle >= 90 ? angle - 180 : angle < -90 ? angle + 180 : angle;
  const t = L.text(0, 0, label, size, { anchor: 'middle', opacity: 0.75, tracking: 0.03 });
  out.push(
    `<g transform="translate(${r(mx)} ${r(my)}) rotate(${r(rot)}) translate(0 ${r(size * 0.36)})">${t}</g>`,
  );
  return out.join('');
}

/** Leader note: a short line from (x,y) to (tx,ty) with a label after it. */
function note(L, x, y, tx, ty, label, o = {}) {
  const side = o.side ?? (tx >= x ? 'right' : 'left');
  const tail = 90;
  const ex = side === 'right' ? tx + tail : tx - tail;
  const out = [P.circle(x, y, 3, 'dot'), P.line(x, y, tx, ty, 'd'), P.line(tx, ty, ex, ty, 'd')];
  out.push(
    L.text(side === 'right' ? tx + 8 : tx - 8, ty - 8, label, 19, {
      anchor: side === 'right' ? 'start' : 'end',
      opacity: 0.8,
      tracking: 0.08,
    }),
  );
  return out.join('');
}

/* ------------------------------------------------------------------ */
/* Sheet                                                               */
/* ------------------------------------------------------------------ */
/**
 * Wraps a drawing in the sheet: ground, grid, lamp, dust, border and title block.
 * draw(L, box) returns SVG for the content area `box` = { x, y, w, h, cx, cy }.
 */
function sheet(name, [W, H], meta, draw) {
  const L = makeLettering();
  hatchSteps.clear();
  strokeIndex = 0;
  const rnd = mulberry32(hash(name));
  const M = Math.round(Math.min(W, H) * 0.045); // sheet margin
  const TB = 92; // title block height
  const box = { x: M + 40, y: M + 40, w: W - 2 * (M + 40), h: H - 2 * (M + 40) - TB };
  box.cx = box.x + box.w / 2;
  box.cy = box.y + box.h / 2;

  // lamp: a warm glow from one of the upper corners (varies per sheet)
  const lampLeft = rnd() > 0.5;
  const lx = lampLeft ? 0.12 : 0.88,
    ly = -0.08;
  const dust = [];
  const n = 36 + Math.floor(rnd() * 28);
  for (let i = 0; i < n; i++) {
    // scatter loosely along a shaft from the lamp toward the opposite lower corner
    const s = rnd();
    const gx = lampLeft ? 0.1 + 0.8 * s : 0.9 - 0.8 * s;
    const gy = -0.05 + 1.1 * s;
    const spread = (rnd() + rnd() - 1) * 0.45;
    const x = (gx + spread * (lampLeft ? -0.6 : 0.6)) * W;
    const y = (gy + spread * 0.5) * H;
    const rad = 1.2 + rnd() * rnd() * 3.2;
    const op = 0.12 + rnd() * 0.42;
    if (y > H - M - TB - 6) continue; // never over the title block
    dust.push(`<circle cx="${r(x)}" cy="${r(y)}" r="${r(rad)}" fill="${AMBER}" fill-opacity="${op.toFixed(2)}"/>`);
  }

  const frame = P.rect(M, M, W - 2 * M, H - 2 * M, 'frame') + P.line(M, H - M - TB, W - M, H - M - TB, 'frame');
  const content = draw(L, box);

  // title block: cells separated by hairlines
  const ty = H - M - TB;
  const cells = [];
  const wide = W >= 1400;
  const colW = wide ? [0.34, 0.24, 0.16, 0.14, 0.12] : [0.4, 0.27, 0.2, 0.13];
  let cx = M;
  const inner = W - 2 * M;
  const labels = wide
    ? ['PROJECT', 'LOCATION', 'DRAWING', 'SCALE', 'SHEET']
    : ['PROJECT', 'LOCATION', 'DRAWING', 'SHEET'];
  const values = wide
    ? [meta.title, meta.location, meta.drawing, meta.scale, meta.sheet]
    : [meta.title, meta.location, meta.drawing, meta.sheet];
  colW.forEach((f, i) => {
    const w = inner * f;
    if (i > 0) cells.push(P.line(cx, ty, cx, H - M, 'frame'));
    cells.push(L.text(cx + 22, ty + 34, labels[i], 13, { tracking: 0.16, opacity: 0.42 }));
    cells.push(
      L.text(cx + 22, ty + 68, values[i], i === 0 ? 26 : 21, {
        tracking: i === 0 ? 0.02 : 0.05,
        opacity: i === 0 ? 0.92 : 0.7,
      }),
    );
    cx += w;
  });

  // Every id is namespaced per sheet so several sheets can be inlined in one document.
  const ns = `s${(hash(name) % 46655).toString(36)}`;
  const namespaced = (svg) =>
    svg
      .replace(/ id="([\w-]+)"/g, (_, id) => ` id="${ns}-${id}"`)
      .replace(/url\(#([\w-]+)\)/g, (_, id) => `url(#${ns}-${id})`)
      .replace(/href="#([\w-]+)"/g, (_, id) => `href="#${ns}-${id}"`);
  return namespaced(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${meta.alt}" style="--n:${strokeIndex}">
<style>
.o{fill:none;stroke:${AMBER};stroke-width:3.2;stroke-linecap:round;stroke-linejoin:round;stroke-opacity:.9}
.s{fill:none;stroke:${OAK};stroke-width:2;stroke-linecap:round;stroke-linejoin:round;stroke-opacity:.6}
.h{fill:none;stroke:${AMBER};stroke-width:1.4;stroke-linecap:round;stroke-opacity:.26}
.f{fill:${AMBER};fill-opacity:.07;stroke:none}
.f2{fill:${AMBER};fill-opacity:.14;stroke:none}
.x{fill:none;stroke:${OAK};stroke-width:2;stroke-dasharray:10 9;stroke-linecap:round;stroke-opacity:.6}
.d{fill:none;stroke:${LINEN};stroke-width:1.5;stroke-linecap:round;stroke-opacity:.38}
.dot{fill:${LINEN};fill-opacity:.5;stroke:none}
.frame{fill:none;stroke:${LINEN};stroke-width:1.5;stroke-opacity:.16}
</style>
<defs>
<pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse"><circle cx="20" cy="20" r="1.3" fill="${LINEN}" fill-opacity=".07"/></pattern>
<radialGradient id="lamp" cx="${lx}" cy="${ly}" r="0.9"><stop offset="0" stop-color="${AMBER}" stop-opacity=".22"/><stop offset=".45" stop-color="${AMBER}" stop-opacity=".06"/><stop offset="1" stop-color="${AMBER}" stop-opacity="0"/></radialGradient>
<filter id="paper" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="${hash(name) % 977}" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 .95 0 0 0 0 .92 0 0 0 0 .88 0 0 0 .035 0"/></filter>
</defs>
<rect width="${W}" height="${H}" fill="${INK}"/>
<g class="ground"><rect width="${W}" height="${H}" fill="url(#grid)"/><rect width="${W}" height="${H}" fill="url(#lamp)"/></g>
<g class="dust">${dust.join('')}</g>
${frame}
<defs>${hatchDefs()}</defs>
<g class="drawing">${content}</g>
<g class="tb">${cells.join('')}</g>
<rect class="paper" width="${W}" height="${H}" filter="url(#paper)"/>
${L.defsSvg()}
</svg>
`);
}

/* ------------------------------------------------------------------ */
/* Drawings                                                            */
/* ------------------------------------------------------------------ */
const D = {};

// ---- Cedar deck, Ligonier ----------------------------------------------------------------
D['cedar-deck-ligonier/cover'] = (L, b) => {
  // plan: 20' wide × 14' deep; house wall along the top, stair off the bottom edge
  const S = Math.min(b.w / 23.5, b.h / 29.5); // px per foot
  const W = 20 * S,
    Hd = 14 * S;
  const x0 = b.cx - W / 2,
    y0 = b.y + 2.6 * S;
  const out = [];
  // house wall / ledger
  out.push(P.rect(x0 - 2 * S, y0 - 0.8 * S, W + 4 * S, 0.8 * S, 's'));
  out.push(P.hatch(x0 - 2 * S, y0 - 0.8 * S, W + 4 * S, 0.8 * S, 16));
  // deck outline
  out.push(P.rect(x0, y0, W, Hd, 'o'));
  out.push(`<rect class="f" x="${r(x0)}" y="${r(y0)}" width="${r(W)}" height="${r(Hd)}"/>`);
  // decking boards run along the 20' dimension, 5.5" wide + gap
  const bw = (5.5 / 12) * S,
    gap = (0.25 / 12) * S;
  const cutX = x0 + W - 5.2 * S; // cut-away corner shows joists
  out.push(
    `<clipPath id="deckL"><path d="M${r(x0)} ${r(y0)}H${r(cutX)}V${r(y0 + 5.4 * S)}H${r(x0 + W)}V${r(y0 + Hd)}H${r(x0)}Z"/></clipPath>`,
  );
  out.push(`<g clip-path="url(#deckL)">`);
  for (let y = y0 + bw; y < y0 + Hd; y += bw + gap) out.push(P.line(x0, y, x0 + W, y, 'h'));
  out.push('</g>');
  // joists in the cut-away, 16" o.c.
  out.push(
    `<clipPath id="deckJ"><rect x="${r(cutX)}" y="${r(y0)}" width="${r(x0 + W - cutX)}" height="${r(5.4 * S)}"/></clipPath><g clip-path="url(#deckJ)">`,
  );
  for (let x = x0 + (16 / 12) * S; x < x0 + W; x += (16 / 12) * S)
    out.push(P.rect(x - (1.5 / 24) * S, y0, (1.5 / 12) * S, Hd, 's'));
  out.push('</g>');
  out.push(P.line(cutX, y0, cutX, y0 + 5.4 * S, 'x'));
  out.push(P.line(cutX, y0 + 5.4 * S, x0 + W, y0 + 5.4 * S, 'x'));
  // posts 4x4 along the three open edges
  const post = (x, y) => P.rect(x - 0.17 * S, y - 0.17 * S, 0.34 * S, 0.34 * S, 'o');
  for (let i = 0; i <= 4; i++) out.push(post(x0 + (W / 4) * i, y0 + Hd));
  for (let i = 0; i <= 2; i++) {
    out.push(post(x0, y0 + (Hd / 2) * i));
    out.push(post(x0 + W, y0 + (Hd / 2) * i));
  }
  // stair: 4' wide, 6 treads then landing then 4 treads, off the bottom edge
  const sx = x0 + W * 0.62,
    sw = 4 * S,
    tr = (11 / 12) * S;
  let y = y0 + Hd;
  const stairH = 6 * tr + 3.2 * S + 4 * tr;
  out.push(P.line(sx, y, sx, y + stairH, 'o'));
  out.push(P.line(sx + sw, y, sx + sw, y + stairH, 'o'));
  for (let i = 1; i <= 6; i++) out.push(P.line(sx, y + i * tr, sx + sw, y + i * tr, 's'));
  y += 6 * tr;
  out.push(P.rect(sx, y, sw, 3.2 * S, 'o'));
  out.push(P.lines(sx, y, sw, 3.2 * S, bw + gap, 'v', 'h'));
  y += 3.2 * S;
  for (let i = 1; i <= 4; i++) out.push(P.line(sx, y + i * tr, sx + sw, y + i * tr, 's'));
  out.push(P.line(sx, y + 4 * tr, sx + sw, y + 4 * tr, 'o'));
  // "up" arrow on the stair
  out.push(P.line(sx + sw / 2, y + 2.6 * tr, sx + sw / 2, y0 + Hd + 1.5 * tr, 'd'));
  out.push(
    P.poly(
      [
        [sx + sw / 2 - 8, y0 + Hd + 1.5 * tr + 14],
        [sx + sw / 2, y0 + Hd + 1.5 * tr],
        [sx + sw / 2 + 8, y0 + Hd + 1.5 * tr + 14],
      ],
      'd',
    ),
  );
  out.push(
    L.text(sx + sw / 2, y + 3.4 * tr - 8, 'UP', 18, { anchor: 'middle', tracking: 0.14, opacity: 0.6 }),
  );
  // dimensions
  out.push(dim(L, x0, y0 - 0.8 * S, x0 + W, y0 - 0.8 * S, '20\'-0"', -0.9 * S));
  out.push(dim(L, x0, y0, x0, y0 + Hd, '14\'-0"', 1.2 * S));
  out.push(dim(L, sx + sw, y0 + Hd + 6 * tr + 1.6 * S, sx, y0 + Hd + 6 * tr + 1.6 * S, '4\'-0"', -1.0 * S));
  out.push(note(L, x0 + W - 2.7 * S, y0 + 2.6 * S, x0 + W + 0.8 * S, y0 + 1.2 * S, 'JOISTS 16" O.C.'));
  out.push(
    note(L, x0 + 6 * S, y0 + 9 * S, x0 + 3.4 * S, y0 + 12.2 * S, 'CEDAR, HIDDEN FASTENERS', { side: 'left' }),
  );
  out.push(
    note(L, x0 - 1.2 * S, y0 - 0.4 * S, x0 - 2.2 * S, y0 - 1.7 * S, 'LEDGER + FLASHING', { side: 'left' }),
  );
  return out.join('');
};

// deck 01: decking detail, plan
D['cedar-deck-ligonier/1'] = (L, b) => {
  const out = [];
  const bw = b.h / 7.2,
    gap = bw * 0.05;
  const x0 = b.x + b.w * 0.06,
    w = b.w * 0.88;
  const y0 = b.y + b.h * 0.08;
  const joists = [0.18, 0.5, 0.82].map((f) => x0 + w * f);
  // joists below, hidden
  for (const jx of joists) {
    out.push(P.line(jx - bw * 0.14, y0 - 20, jx - bw * 0.14, y0 + 6 * (bw + gap), 'x'));
    out.push(P.line(jx + bw * 0.14, y0 - 20, jx + bw * 0.14, y0 + 6 * (bw + gap), 'x'));
  }
  for (let i = 0; i < 6; i++) {
    const y = y0 + i * (bw + gap);
    out.push(P.rect(x0, y, w, bw, 'o'));
    out.push(`<rect class="f" x="${r(x0)}" y="${r(y)}" width="${r(w)}" height="${r(bw)}"/>`);
    // grain
    for (let k = 1; k < 4; k++)
      out.push(
        P.line(
          x0 + 30 + k * 7,
          y + (bw * k) / 4 + (k % 2 ? 6 : -4),
          x0 + w - 30 - k * 9,
          y + (bw * k) / 4 + (k % 2 ? -5 : 3),
          'h',
        ),
      );
    // clips in the gaps at each joist
    if (i < 5)
      for (const jx of joists)
        out.push(P.path(`M${r(jx - 9)} ${r(y + bw)}h18M${r(jx)} ${r(y + bw)}v${r(gap)}`, 's'));
  }
  out.push(dim(L, x0 - 0, y0, x0, y0 + bw, '5-1/2"', 0.06 * w, { size: 18 }));
  out.push(
    dim(L, x0 + w, y0 + 3 * (bw + gap) - gap, x0 + w, y0 + 3 * (bw + gap), '3/16"', -0.05 * w, { size: 18 }),
  );
  out.push(
    note(
      L,
      joists[1],
      y0 + 2 * (bw + gap) - gap / 2,
      joists[1] + w * 0.12,
      y0 + 6.2 * (bw + gap) + 10,
      'HIDDEN FASTENER CLIP',
    ),
  );
  out.push(
    note(
      L,
      joists[0] - bw * 0.14,
      y0 + 5.5 * bw,
      joists[0] - w * 0.1,
      y0 + 6.2 * (bw + gap) + 10,
      '2×8 JOIST BELOW',
      { side: 'left' },
    ),
  );
  return out.join('');
};

// deck 02: railing elevation (portrait)
D['cedar-deck-ligonier/2'] = (L, b) => {
  const out = [];
  const S = Math.min(b.w / 7.2, b.h / 7.6); // px per foot
  const x0 = b.cx - 3 * S,
    w = 6 * S;
  const deckY = b.y + b.h * 0.72;
  const railH = 3 * S;
  const top = deckY - railH;
  // posts
  const pw = 0.3 * S;
  for (const px of [x0, x0 + w - pw]) {
    out.push(P.rect(px, top - 0.35 * S, pw, railH + 0.35 * S + 0.9 * S, 'o'));
    out.push(
      P.poly(
        [
          [px - 0.06 * S, top - 0.35 * S],
          [px + pw + 0.06 * S, top - 0.35 * S],
          [px + pw / 2, top - 0.6 * S],
        ],
        'o',
        true,
      ),
    );
    out.push(P.hatch(px, deckY, pw, 0.9 * S, 12));
  }
  // rails
  out.push(P.rect(x0 + pw, top, w - 2 * pw, 0.2 * S, 'o'));
  out.push(P.rect(x0 + pw, deckY - 0.35 * S, w - 2 * pw, 0.16 * S, 'o'));
  // balusters 4" o.c.
  const step = (4 / 12) * S;
  for (let x = x0 + pw + step; x < x0 + w - pw - step / 2; x += step)
    out.push(P.line(x, top + 0.2 * S, x, deckY - 0.35 * S, 's'));
  // deck edge, fascia, joist ends
  out.push(P.line(b.x, deckY, b.x + b.w, deckY, 'o'));
  out.push(P.rect(b.x, deckY, b.w, 0.9 * S, 's'));
  out.push(P.lines(b.x, deckY, b.w, 0.9 * S, (16 / 12) * S, 'v', 'h', 0.5 * S));
  out.push(dim(L, x0 + w + 0.3 * S, deckY, x0 + w + 0.3 * S, top, '36" MIN.', -0.55 * S));
  out.push(
    dim(L, x0 + pw + step * 3, top + 0.2 * S, x0 + pw + step * 4, top + 0.2 * S, '4"', -0.5 * S, {
      size: 18,
    }),
  );
  out.push(note(L, x0 + pw / 2, top + S, x0 - 0.2 * S, top + 1.9 * S, 'CEDAR 4×4', { side: 'left' }));
  out.push(
    note(
      L,
      x0 + pw + step * 7,
      deckY - 1.3 * S,
      x0 + pw + step * 9.5,
      deckY + 1.5 * S,
      'BLACK ALUM. BALUSTERS',
    ),
  );
  return out.join('');
};

// deck 03: stair section with a landing
D['cedar-deck-ligonier/3'] = (L, b) => {
  const out = [];
  const rise = b.h / 12.5,
    run = rise * 1.5;
  const gradeY = b.y + b.h * 0.9;
  // profile: from the yard (left) up 4 treads, landing, up 6 treads to the deck (right)
  const x0 = b.x + b.w * 0.05;
  const pts = [[x0, gradeY]];
  let x = x0 + run * 1.2,
    y = gradeY;
  const stepUp = () => {
    pts.push([x, y]);
    y -= rise;
    pts.push([x, y]);
    x += run;
  };
  for (let i = 0; i < 4; i++) stepUp();
  pts.push([x, y]);
  x += run * 3.2;
  pts.push([x, y]); // landing
  for (let i = 0; i < 6; i++) stepUp();
  pts.push([x + run * 1.6, y]);
  out.push(P.poly(pts, 'o'));
  // stringer body under the sawtooth
  const bottom = pts.map(([px, py]) => [px, py + rise * 1.3]);
  out.push(P.poly([[pts[1][0], pts[1][1] + rise * 1.3], ...bottom.slice(2)], 's'));
  // treads with nosing
  for (let i = 1; i < pts.length - 1; i += 2) {
    const [tx, ty] = pts[i + 1];
    out.push(P.rect(tx - 12, ty - 8, run + 12, 12, 's'));
  }
  // deck framing at the top right
  const dx = pts[pts.length - 1][0],
    dy = pts[pts.length - 1][1];
  out.push(P.rect(dx - run * 1.6, dy, run * 1.6, rise * 1.1, 's'));
  out.push(P.hatch(dx - run * 1.6, dy, run * 1.6, rise * 1.1, 12));
  // landing post + footing
  const lx = pts[10][0] + run * 1.4;
  out.push(P.line(lx, pts[10][1], lx, gradeY + rise * 0.4, 's'));
  out.push(P.rect(lx - 18, gradeY + rise * 0.4, 36, rise, 's'));
  out.push(P.hatch(lx - 18, gradeY + rise * 0.4, 36, rise, 8));
  // grade
  out.push(P.line(b.x, gradeY, b.x + b.w, gradeY, 'o'));
  out.push(P.hatch(b.x, gradeY, b.w, rise * 1.6, 22));
  // dims
  const [sx1, sy1] = pts[13],
    [sx2, sy2] = pts[15];
  out.push(dim(L, sx2, sy2, sx2, sy1, '7-1/4"', -run * 0.5, { size: 18 }));
  out.push(dim(L, sx1, sy1 - rise * 2.2, sx1 + run, sy1 - rise * 2.2, '11"', 0, { size: 18 }));
  out.push(
    note(L, pts[9][0] + run * 1.6, pts[9][1], pts[9][0] + run * 0.6, pts[9][1] - rise * 2.6, 'MID LANDING', {
      side: 'left',
    }),
  );
  out.push(
    note(L, dx - run * 0.8, dy + rise * 0.5, dx - run * 0.2, dy + rise * 3, 'DECK RIM', { side: 'left' }),
  );
  return out.join('');
};

// ---- Fireplace built-ins, Greensburg (portrait cover) --------------------------------------
D['fireplace-built-ins-greensburg/cover'] = (L, b) => {
  const out = [];
  const S = Math.min(b.w / 12.4, b.h / 10.2); // px per foot
  const roomW = 11.6 * S,
    H = 9 * S;
  const x0 = b.cx - roomW / 2,
    floor = b.cy + H / 2 + 0.2 * S,
    ceil = floor - H;
  // room lines
  out.push(P.line(b.x, ceil, b.x + b.w, ceil, 's'));
  out.push(P.line(b.x, floor, b.x + b.w, floor, 'o'));
  out.push(P.hatch(b.x, floor, b.w, 0.35 * S, 14));
  // fireplace: brick surround + firebox + mantel
  const fw = 4.2 * S,
    fx = b.cx - fw / 2;
  out.push(P.rect(fx, floor - 4.6 * S, fw, 4.6 * S, 'o'));
  out.push(P.brick(fx, floor - 4.6 * S, fw, 4.6 * S, 0.66 * S, 0.22 * S));
  const bx = b.cx - 1.5 * S,
    bh = 2.4 * S;
  out.push(
    `<rect class="f2" x="${r(bx)}" y="${r(floor - bh - 0.3 * S)}" width="${r(3 * S)}" height="${r(bh)}"/>`,
  );
  out.push(P.rect(bx, floor - bh - 0.3 * S, 3 * S, bh, 'o'));
  out.push(P.rect(fx - 0.25 * S, floor - 4.6 * S - 0.35 * S, fw + 0.5 * S, 0.35 * S, 'o')); // mantel
  // bookcases
  const cw = 3.2 * S;
  for (const cx of [x0 + 0.3 * S, x0 + roomW - 0.3 * S - cw]) {
    out.push(P.rect(cx, ceil + 0.5 * S, cw, H - 0.5 * S, 'o'));
    out.push(
      `<rect class="f" x="${r(cx)}" y="${r(ceil + 0.5 * S)}" width="${r(cw)}" height="${r(H - 0.5 * S)}"/>`,
    );
    // lower cabinet, two doors
    const lowerY = floor - 2.6 * S;
    out.push(P.line(cx, lowerY, cx + cw, lowerY, 'o'));
    for (const dx of [0, cw / 2]) {
      out.push(P.rect(cx + dx + 0.12 * S, lowerY + 0.15 * S, cw / 2 - 0.24 * S, 2.1 * S, 's'));
      out.push(P.rect(cx + dx + 0.34 * S, lowerY + 0.4 * S, cw / 2 - 0.68 * S, 1.6 * S, 'h'));
      out.push(
        P.circle(dx === 0 ? cx + cw / 2 - 0.3 * S : cx + cw / 2 + 0.3 * S, lowerY + 1.1 * S, 0.06 * S, 's'),
      );
    }
    out.push(P.line(cx, floor - 0.3 * S, cx + cw, floor - 0.3 * S, 's')); // toe kick
    // shelves
    for (let i = 1; i <= 5; i++) {
      const sy = lowerY - 0.2 * S - i * ((lowerY - ceil - 1.4 * S) / 5);
      out.push(P.rect(cx + 0.1 * S, sy, cw - 0.2 * S, 0.08 * S, 's'));
    }
    // face frame stiles
    out.push(P.line(cx + 0.1 * S, ceil + 0.5 * S, cx + 0.1 * S, lowerY, 's'));
    out.push(P.line(cx + cw - 0.1 * S, ceil + 0.5 * S, cx + cw - 0.1 * S, lowerY, 's'));
    // crown
    out.push(
      P.path(
        `M${r(cx - 0.15 * S)} ${r(ceil + 0.5 * S)}q${r(0.1 * S)} ${r(-0.25 * S)} ${r(0.35 * S)} ${r(-0.5 * S)}H${r(cx + cw - 0.2 * S)}q${r(0.25 * S)} ${r(0.25 * S)} ${r(0.35 * S)} ${r(0.5 * S)}`,
        'o',
      ),
    );
  }
  // existing ceiling crown across the room
  out.push(P.line(b.x, ceil + 0.5 * S, b.x + b.w, ceil + 0.5 * S, 'h'));
  // dims
  out.push(dim(L, x0 + 0.3 * S, floor, x0 + 0.3 * S + cw, floor, '3\'-2"', 0.75 * S));
  out.push(dim(L, x0 + roomW + 0.2 * S, floor, x0 + roomW + 0.2 * S, ceil, '9\'-0"', -0.5 * S));
  out.push(
    note(
      L,
      x0 + 0.3 * S + cw / 2,
      ceil + 0.3 * S,
      b.cx - 0.8 * S,
      ceil - 0.45 * S,
      'CROWN RUNS INTO EXISTING',
    ),
  );
  out.push(
    note(L, x0 + roomW - 0.3 * S - cw / 2, ceil + 3.2 * S, b.cx + 1.2 * S, ceil + 2.2 * S, 'ADJ. SHELVES', {
      side: 'left',
    }),
  );
  out.push(
    note(
      L,
      x0 + 0.3 * S + cw * 0.25,
      floor - 1.4 * S,
      x0 + 0.3 * S - 0.3 * S,
      floor - 1.4 * S - 0.9 * S,
      'INSET DOORS',
      { side: 'right' },
    ),
  );
  return out.join('');
};

// fireplace 01: crown section at the ceiling (landscape)
D['fireplace-built-ins-greensburg/1'] = (L, b) => {
  const out = [];
  const u = b.h / 9; // inch-ish unit
  const ceil = b.y + 1.2 * u;
  const wallX = b.cx + 3.2 * u;
  out.push(P.line(b.x, ceil, b.x + b.w, ceil, 'o'));
  out.push(P.hatch(b.x, ceil - 0.5 * u, b.w, 0.5 * u, 16));
  out.push(P.line(wallX, ceil, wallX, b.y + b.h, 'o'));
  out.push(P.hatch(wallX, ceil, 0.5 * u, b.h - 1.2 * u, 16));
  // cabinet top and side
  const topY = ceil + 2.6 * u,
    capX = b.cx - 3.4 * u;
  out.push(P.rect(capX, topY, wallX - capX - 0.3 * u, 0.75 * u, 'o'));
  out.push(P.hatch(capX, topY, wallX - capX - 0.3 * u, 0.75 * u, 10));
  out.push(P.line(capX, topY + 0.75 * u, capX, b.y + b.h, 'o'));
  out.push(P.line(capX + 0.75 * u, topY + 0.75 * u, capX + 0.75 * u, b.y + b.h, 's'));
  // nailer block
  out.push(P.rect(capX - 0.8 * u, topY - 1.4 * u, 0.8 * u, 1.4 * u, 's'));
  out.push(P.hatch(capX - 0.8 * u, topY - 1.4 * u, 0.8 * u, 1.4 * u, 8));
  // crown profile: cove over ogee, with the flat backs that sit against ceiling and cabinet face
  const cw = 2.6 * u,
    ch = 3.05 * u,
    cx0 = capX - cw,
    cy0 = ceil;
  const pt = (fx, fy) => `${r(cx0 + fx * cw)} ${r(cy0 + fy * ch)}`;
  const face = `M${pt(0, 0)}L${pt(0, 0.1)}C${pt(0.02, 0.32)} ${pt(0.18, 0.5)} ${pt(0.42, 0.52)}L${pt(0.47, 0.57)}C${pt(0.7, 0.6)} ${pt(0.72, 0.8)} ${pt(0.86, 0.9)}C${pt(0.95, 0.96)} ${pt(1, 0.98)} ${pt(1, 1)}`;
  const body = `${face}L${pt(1, 0.72)}L${pt(0.28, 0)}Z`;
  out.push(
    `<clipPath id="crownClip"><path d="${body}"/></clipPath><g clip-path="url(#crownClip)">${P.hatch(cx0, cy0, cw, ch, 9)}</g>`,
  );
  out.push(`<path class="f" d="${body}"/>`);
  out.push(P.path(body, 'o'));
  // existing room crown continuing on the wall
  out.push(
    P.path(
      `M${r(wallX)} ${r(ceil + 0.3 * u)}c${r(-0.4 * u)} ${r(0.05 * u)} ${r(-0.6 * u)} ${r(0.5 * u)} ${r(-0.9 * u)} ${r(0.9 * u)}v${r(0.4 * u)}`,
      'x',
    ),
  );
  out.push(
    dim(L, capX - 2.6 * u, ceil + 3.6 * u, capX, ceil + 3.6 * u, '4-5/8" CROWN', 0.4 * u, { size: 18 }),
  );
  out.push(
    note(L, capX - 0.4 * u, topY - 0.7 * u, capX - 1.6 * u, topY - 1.9 * u, 'NAILER', { side: 'left' }),
  );
  out.push(
    note(L, wallX - 0.45 * u, ceil + 0.75 * u, wallX - 1.4 * u, ceil + 5.2 * u, 'EXISTING CROWN, COPED', {
      side: 'left',
    }),
  );
  out.push(L.text(b.x + 10, b.y + b.h - 10, 'SECTION AT CEILING', 19, { tracking: 0.14, opacity: 0.5 }));
  return out.join('');
};

// fireplace 02: shelf and scribed face frame (portrait)
D['fireplace-built-ins-greensburg/2'] = (L, b) => {
  const out = [];
  const u = b.w / 10;
  // wall, slightly out of plumb
  const wx0 = b.x + 1.2 * u,
    wx1 = b.x + 1.55 * u;
  out.push(P.line(wx0, b.y, wx1, b.y + b.h, 'o'));
  out.push(
    `<clipPath id="wall2"><path d="M${r(b.x)} ${r(b.y)}H${r(wx0)}L${r(wx1)} ${r(b.y + b.h)}H${r(b.x)}Z"/></clipPath><g clip-path="url(#wall2)">${P.hatch(b.x, b.y, 1.6 * u, b.h, 18)}</g>`,
  );
  // face frame stile scribed to the wall
  const stileW = 0.55 * u;
  out.push(
    P.poly(
      [
        [wx0 + 2, b.y + 0.6 * u],
        [wx0 + stileW, b.y + 0.6 * u],
        [wx1 + stileW, b.y + b.h - 0.6 * u],
        [wx1 + 2, b.y + b.h - 0.6 * u],
      ],
      'o',
      true,
    ),
  );
  out.push(P.hatch(wx0, b.y + 0.6 * u, stileW + 0.4 * u, b.h - 1.2 * u, 10));
  // case side behind
  out.push(P.line(wx0 + stileW + 0.15 * u, b.y + 0.6 * u, wx1 + stileW + 0.15 * u, b.y + b.h - 0.6 * u, 'x'));
  // shelves with pin holes
  const shelfX = wx0 + stileW,
    shelfW = b.w - 2.6 * u;
  for (let i = 0; i < 4; i++) {
    const sy = b.y + 1.4 * u + i * 2.1 * u;
    out.push(P.rect(shelfX + 0.1 * u + i * 0.03 * u, sy, shelfW, 0.28 * u, 'o'));
    out.push(
      `<rect class="f" x="${r(shelfX + 0.1 * u)}" y="${r(sy)}" width="${r(shelfW)}" height="${r(0.28 * u)}"/>`,
    );
  }
  // pin holes 32 mm
  for (let y = b.y + 0.9 * u; y < b.y + b.h - 0.9 * u; y += 0.42 * u)
    out.push(P.circle(b.x + b.w - 0.9 * u, y, 5, 's'));
  // books, a few spines
  const rnd = mulberry32(42);
  for (let i = 1; i < 4; i++) {
    const sy = b.y + 1.4 * u + i * 2.1 * u;
    let x = shelfX + 0.5 * u;
    while (x < shelfX + shelfW - 0.8 * u) {
      const w = (0.18 + rnd() * 0.3) * u,
        h = (0.9 + rnd() * 0.6) * u;
      out.push(P.rect(x, sy - h, w, h, 'h'));
      x += w + 0.04 * u;
    }
  }
  out.push(
    dim(L, wx0, b.y + 0.35 * u, wx0 + stileW, b.y + 0.35 * u, '1-1/2" STILE', -0.35 * u, { size: 18 }),
  );
  out.push(
    dim(L, wx1, b.y + b.h - 0.35 * u, wx1 + stileW, b.y + b.h - 0.35 * u, 'SCRIBED', 0.35 * u, { size: 18 }),
  );
  out.push(note(L, wx0 + 0.45 * u, b.y + 5.2 * u, wx0 + 2.4 * u, b.y + 4.4 * u, 'WALL 1" OUT OF PLUMB'));
  out.push(
    note(L, b.x + b.w - 0.9 * u, b.y + 7.9 * u, b.x + b.w - 1.8 * u, b.y + 9.2 * u, 'PINS AT 32 MM', {
      side: 'left',
    }),
  );
  return out.join('');
};

// fireplace 03: lower cabinet doors (landscape)
D['fireplace-built-ins-greensburg/3'] = (L, b) => {
  const out = [];
  const u = b.h / 10;
  const w = b.w * 0.74,
    h = 7.2 * u,
    x0 = b.cx - w / 2,
    y0 = b.cy - h / 2 + 0.2 * u;
  out.push(P.rect(x0, y0, w, h, 'o'));
  out.push(`<rect class="f" x="${r(x0)}" y="${r(y0)}" width="${r(w)}" height="${r(h)}"/>`);
  const reveal = 0.08 * u;
  for (let i = 0; i < 2; i++) {
    const dx = x0 + 0.5 * u + (i * (w - 1 * u)) / 2 + (i ? reveal / 2 : 0);
    const dw = (w - 1 * u) / 2 - reveal / 2;
    out.push(P.rect(dx, y0 + 0.5 * u, dw, h - 1 * u, 'o'));
    out.push(P.rect(dx + 0.55 * u, y0 + 1.05 * u, dw - 1.1 * u, h - 2.1 * u, 's'));
    out.push(P.rect(dx + 0.75 * u, y0 + 1.25 * u, dw - 1.5 * u, h - 2.5 * u, 'h'));
    // panel bevel lines
    for (const [ax, ay, bx, by] of [
      [dx + 0.55 * u, y0 + 1.05 * u, dx + 0.75 * u, y0 + 1.25 * u],
      [dx + dw - 0.55 * u, y0 + 1.05 * u, dx + dw - 0.75 * u, y0 + 1.25 * u],
      [dx + 0.55 * u, y0 + h - 1.05 * u, dx + 0.75 * u, y0 + h - 1.25 * u],
      [dx + dw - 0.55 * u, y0 + h - 1.05 * u, dx + dw - 0.75 * u, y0 + h - 1.25 * u],
    ])
      out.push(P.line(ax, ay, bx, by, 'h'));
    // pull
    const px = i === 0 ? dx + dw - 0.4 * u : dx + 0.4 * u;
    out.push(P.circle(px, y0 + h / 2, 0.14 * u, 'o'));
    out.push(P.circle(px, y0 + h / 2, 0.05 * u, 's'));
    // hinges
    const hx = i === 0 ? dx - 0.02 * u : dx + dw + 0.02 * u;
    for (const hy of [y0 + 1.3 * u, y0 + h - 1.3 * u])
      out.push(P.rect(hx - 0.06 * u, hy - 0.35 * u, 0.12 * u, 0.7 * u, 's'));
  }
  out.push(
    dim(
      L,
      x0 + w / 2 - reveal / 2,
      y0 + 0.5 * u,
      x0 + w / 2 + reveal / 2,
      y0 + 0.5 * u,
      '3/32" REVEAL',
      -0.95 * u,
      { size: 18 },
    ),
  );
  out.push(dim(L, x0 + w + 0.3 * u, y0 + h, x0 + w + 0.3 * u, y0, '30"', -0.45 * u, { size: 18 }));
  out.push(
    note(
      L,
      x0 + 0.5 * u + (w - 1 * u) / 2 - 0.4 * u,
      y0 + h / 2,
      x0 + 0.5 * u + (w - 1 * u) / 2 - 0.4 * u - 1.2 * u,
      y0 + h - 0.1 * u,
      'UNLACQUERED BRASS',
      { side: 'left' },
    ),
  );
  out.push(
    note(L, x0 + 0.5 * u + 0.5 * u, y0 + 0.75 * u, x0 - 0.2 * u, y0 - 0.5 * u, 'INSET PANEL, PAINT GRADE', {
      side: 'right',
    }),
  );
  return out.join('');
};

// ---- Kitchen remodel, Latrobe -----------------------------------------------------------
D['kitchen-remodel-latrobe/cover'] = (L, b) => {
  const out = [];
  const S = Math.min(b.w / 14.6, b.h / 9.4); // px per foot
  const Wd = 13 * S,
    x0 = b.cx - Wd / 2;
  const floor = b.cy + 4.2 * S,
    ceil = floor - 8 * S;
  out.push(P.line(b.x, ceil, b.x + b.w, ceil, 's'));
  out.push(P.line(b.x, floor, b.x + b.w, floor, 'o'));
  out.push(P.hatch(b.x, floor, b.w, 0.3 * S, 14));
  const inch = S / 12;
  // base cabinets + toe kick + counter
  const baseTop = floor - 34.5 * inch;
  out.push(P.rect(x0, baseTop, Wd, 30.5 * inch, 'o'));
  out.push(`<rect class="f" x="${r(x0)}" y="${r(baseTop)}" width="${r(Wd)}" height="${r(30.5 * inch)}"/>`);
  out.push(P.rect(x0 + 3 * inch, floor - 4 * inch, Wd - 6 * inch, 4 * inch, 's'));
  out.push(P.rect(x0 - 1 * inch, baseTop - 1.5 * inch, Wd + 2 * inch, 1.5 * inch, 'o'));
  out.push(
    `<rect class="f2" x="${r(x0 - inch)}" y="${r(baseTop - 1.5 * inch)}" width="${r(Wd + 2 * inch)}" height="${r(1.5 * inch)}"/>`,
  );
  // base fronts: drawers | doors | sink base | doors | drawers ...
  const bays = [
    [0, 24, 'drawers'],
    [24, 18, 'doors'],
    [42, 36, 'sink'],
    [78, 24, 'doors'],
    [102, 24, 'drawers'],
    [126, 30, 'doors'],
  ];
  for (const [bx, bw, kind] of bays) {
    const x = x0 + bx * inch,
      w = bw * inch;
    out.push(P.line(x + w, baseTop, x + w, floor - 4 * inch, 's'));
    if (kind === 'drawers')
      for (let i = 1; i < 4; i++)
        out.push(
          P.rect(x + 1.2 * inch, baseTop + (i - 1) * 9.5 * inch + 1.2 * inch, w - 2.4 * inch, 8 * inch, 'h'),
        );
    if (kind === 'doors') {
      out.push(P.rect(x + 1.2 * inch, baseTop + 1.2 * inch, w / 2 - 1.8 * inch, 28 * inch, 'h'));
      out.push(P.rect(x + w / 2 + 0.6 * inch, baseTop + 1.2 * inch, w / 2 - 1.8 * inch, 28 * inch, 'h'));
    }
    if (kind === 'sink') {
      out.push(P.rect(x + 1.2 * inch, baseTop + 1.2 * inch, w - 2.4 * inch, 6 * inch, 'h'));
      out.push(P.rect(x + 1.2 * inch, baseTop + 8.5 * inch, w / 2 - 1.8 * inch, 20.5 * inch, 'h'));
      out.push(P.rect(x + w / 2 + 0.6 * inch, baseTop + 8.5 * inch, w / 2 - 1.8 * inch, 20.5 * inch, 'h'));
    }
  }
  // faucet
  const fx = x0 + 60 * inch;
  out.push(
    P.path(
      `M${r(fx)} ${r(baseTop - 1.5 * inch)}v${r(-7 * inch)}a${r(5 * inch)} ${r(5 * inch)} 0 0 1 ${r(5 * inch)} ${r(-2 * inch)}`,
      's',
    ),
  );
  // window over the sink
  const wx = x0 + 42 * inch,
    ww = 36 * inch,
    wy = floor - 78 * inch,
    wh = 40 * inch;
  out.push(P.rect(wx, wy, ww, wh, 'o'));
  out.push(P.rect(wx + 2 * inch, wy + 2 * inch, ww - 4 * inch, wh - 4 * inch, 's'));
  out.push(P.line(wx + 2 * inch, wy + wh / 2, wx + ww - 2 * inch, wy + wh / 2, 's'));
  out.push(P.hatch(wx + 2 * inch, wy + 2 * inch, ww - 4 * inch, wh - 4 * inch, 30));
  out.push(P.rect(wx - 3.5 * inch, wy - 3.5 * inch, ww + 7 * inch, 3.5 * inch, 'o')); // head casing
  out.push(P.rect(wx - 3.5 * inch, wy, 3.5 * inch, wh, 'o'));
  out.push(P.rect(wx + ww, wy, 3.5 * inch, wh, 'o'));
  out.push(P.rect(wx - 5 * inch, wy + wh, ww + 10 * inch, 1.2 * inch, 'o')); // stool
  out.push(P.rect(wx - 3.5 * inch, wy + wh + 1.2 * inch, ww + 7 * inch, 3 * inch, 's')); // apron
  // uppers left and right of the window, 30" tall, tops at 84"
  const upTop = floor - 84 * inch;
  for (const [ux, uw] of [
    [x0, 42 * inch - 4.5 * inch],
    [wx + ww + 4.5 * inch, x0 + 100 * inch - (wx + ww + 4.5 * inch)],
  ]) {
    out.push(P.rect(ux, upTop, uw, 30 * inch, 'o'));
    out.push(`<rect class="f" x="${r(ux)}" y="${r(upTop)}" width="${r(uw)}" height="${r(30 * inch)}"/>`);
    const n = Math.max(1, Math.round(uw / (15 * inch)));
    for (let i = 0; i < n; i++) {
      const dx = ux + (uw / n) * i;
      if (i) out.push(P.line(dx, upTop, dx, upTop + 30 * inch, 's'));
      out.push(P.rect(dx + 1.2 * inch, upTop + 1.2 * inch, uw / n - 2.4 * inch, 27.6 * inch, 'h'));
    }
  }
  // over-window cabinet, 15" tall
  out.push(P.rect(wx - 4.5 * inch, upTop, ww + 9 * inch, 15 * inch, 'o'));
  out.push(P.rect(wx - 3.3 * inch, upTop + 1.2 * inch, ww + 6.6 * inch, 12.6 * inch, 'h'));
  // stacked crown: frieze + crown to the ceiling
  out.push(P.rect(x0 - 1 * inch, ceil + 6 * inch, 100 * inch + 2 * inch, 6 * inch, 'o'));
  out.push(
    P.path(
      `M${r(x0 - 3 * inch)} ${r(ceil)}H${r(x0 + 102 * inch)}v${r(1 * inch)}c${r(-1.5 * inch)} ${r(1)} ${r(-2 * inch)} ${r(3 * inch)} ${r(-2 * inch)} ${r(5 * inch)}H${r(x0 - 1 * inch)}c0 ${r(-2 * inch)} ${r(-0.5 * inch)} ${r(-4 * inch)} ${r(-2 * inch)} ${r(-5 * inch)}Z`,
      'o',
    ),
  );
  out.push(
    `<path class="f2" d="M${r(x0 - 3 * inch)} ${r(ceil)}H${r(x0 + 102 * inch)}v${r(1 * inch)}c${r(-1.5 * inch)} ${r(1)} ${r(-2 * inch)} ${r(3 * inch)} ${r(-2 * inch)} ${r(5 * inch)}H${r(x0 - 1 * inch)}c0 ${r(-2 * inch)} ${r(-0.5 * inch)} ${r(-4 * inch)} ${r(-2 * inch)} ${r(-5 * inch)}Z"/>`,
  );
  // pass-through on the right: opening with casing and a hidden header
  const px = x0 + 104 * inch,
    pw = 48 * inch,
    py = floor - 80 * inch,
    ph = 44 * inch;
  out.push(P.rect(px, py, pw, ph, 'o'));
  out.push(P.rect(px - 3.5 * inch, py - 3.5 * inch, pw + 7 * inch, 3.5 * inch, 's'));
  out.push(P.rect(px - 3.5 * inch, py, 3.5 * inch, ph + 1.5 * inch, 's'));
  out.push(P.rect(px + pw, py, 3.5 * inch, ph + 1.5 * inch, 's'));
  out.push(P.rect(px - 5.5 * inch, py - 13 * inch, pw + 11 * inch, 9.5 * inch, 'x'));
  out.push(P.hatch(px, py, pw, ph, 46));
  // dims and notes
  out.push(dim(L, x0 - 3 * inch, floor, x0 - 3 * inch, baseTop - 1.5 * inch, '36"', 0.5 * S, { size: 18 }));
  out.push(
    dim(L, x0 - 3 * inch, baseTop - 1.5 * inch, x0 - 3 * inch, upTop + 30 * inch, '18"', 0.5 * S, {
      size: 18,
    }),
  );
  out.push(dim(L, px + pw, py + ph, px, py + ph, '4\'-0" R.O.', -0.5 * S, { size: 18 }));
  out.push(
    note(L, px + pw / 2, py - 8 * inch, px + pw / 2 + 0.6 * S, ceil - 0.6 * S, 'HEADER, SEE 2/4', {
      side: 'right',
    }),
  );
  out.push(
    note(L, x0 + 40 * inch, ceil + 4 * inch, x0 + 30 * inch, ceil - 0.6 * S, 'STACKED CROWN', {
      side: 'left',
    }),
  );
  out.push(
    note(
      L,
      wx + ww + 1.7 * inch,
      wy + wh * 0.5,
      wx + ww + 10 * inch,
      wy + wh + 14 * inch,
      'NEW CASING + STOOL',
    ),
  );
  return out.join('');
};

// kitchen 01: pass-through framing
D['kitchen-remodel-latrobe/1'] = (L, b) => {
  const out = [];
  const S = Math.min(b.w / 10.4, b.h / 9.2);
  const inch = S / 12;
  const x0 = b.cx - 4.5 * S,
    Wd = 9 * S;
  const floor = b.cy + 4.4 * S,
    top = floor - 8 * S;
  // plates
  out.push(P.rect(x0, floor - 1.5 * inch, Wd, 1.5 * inch, 'o'));
  out.push(P.rect(x0, top, Wd, 1.5 * inch, 'o'));
  out.push(P.rect(x0, top + 1.5 * inch, Wd, 1.5 * inch, 'o'));
  out.push(P.hatch(x0, top, Wd, 3 * inch, 8));
  out.push(P.hatch(x0, floor - 1.5 * inch, Wd, 1.5 * inch, 8));
  // opening 4' wide, sill at 36", header at 80"
  const ox = x0 + 30 * inch,
    ow = 48 * inch,
    sillY = floor - 36 * inch,
    headY = floor - 80 * inch;
  const stud = (x, y1, y2, c = 's') => {
    out.push(P.rect(x, Math.min(y1, y2), 1.5 * inch, Math.abs(y2 - y1), c));
  };
  // common studs 16" o.c. outside the opening
  for (let x = x0; x < x0 + Wd - 1; x += 16 * inch) {
    if (x + 1.5 * inch > ox - 3 * inch && x < ox + ow + 3 * inch) continue;
    stud(x, floor - 1.5 * inch, top + 3 * inch);
  }
  // king studs
  stud(ox - 3 * inch, floor - 1.5 * inch, top + 3 * inch, 'o');
  stud(ox + ow + 1.5 * inch, floor - 1.5 * inch, top + 3 * inch, 'o');
  // jack studs
  stud(ox - 1.5 * inch, floor - 1.5 * inch, headY, 'o');
  stud(ox + ow, floor - 1.5 * inch, headY, 'o');
  // header: 2 × 2x10 with a plywood spacer
  const hh = 9.25 * inch;
  out.push(P.rect(ox - 1.5 * inch, headY - hh, ow + 3 * inch, hh, 'o'));
  out.push(P.hatch(ox - 1.5 * inch, headY - hh, ow + 3 * inch, hh, 10));
  out.push(
    `<rect class="f2" x="${r(ox - 1.5 * inch)}" y="${r(headY - hh)}" width="${r(ow + 3 * inch)}" height="${r(hh)}"/>`,
  );
  // cripples above the header and below the sill
  for (let x = ox + 6.5 * inch; x < ox + ow - 1.5 * inch; x += 16 * inch) {
    stud(x, headY - hh, top + 3 * inch);
    stud(x, sillY, floor - 1.5 * inch);
  }
  // sill
  out.push(P.rect(ox, sillY - 1.5 * inch, ow, 1.5 * inch, 'o'));
  out.push(P.hatch(ox, sillY - 1.5 * inch, ow, 1.5 * inch, 8));
  // opening tint
  out.push(
    `<rect class="f" x="${r(ox)}" y="${r(headY)}" width="${r(ow)}" height="${r(sillY - 1.5 * inch - headY)}"/>`,
  );
  // dims and notes
  out.push(dim(L, ox, headY + 0.5 * S, ox + ow, headY + 0.5 * S, '4\'-0" R.O.', 0, { size: 18 }));
  out.push(dim(L, x0 + Wd + 0.3 * S, floor, x0 + Wd + 0.3 * S, headY, '6\'-8"', -0.45 * S, { size: 18 }));
  out.push(
    note(
      L,
      ox + ow - 6 * inch,
      headY - hh / 2,
      ox + ow + 0.9 * S,
      headY - hh - 0.7 * S,
      '2 – 2×10 HEADER, 1/2" PLY BETWEEN',
    ),
  );
  out.push(
    note(
      L,
      ox - 2.25 * inch,
      floor - 48 * inch,
      ox - 2.25 * inch - 0.7 * S,
      floor - 56 * inch,
      'KING + JACK',
      { side: 'left' },
    ),
  );
  out.push(
    note(
      L,
      ox + ow / 2 - 8 * inch,
      sillY - 0.75 * inch,
      ox + ow / 2 - 8 * inch - 0.4 * S,
      sillY + 0.9 * S,
      'SILL AT COUNTER HEIGHT',
      { side: 'left' },
    ),
  );
  return out.join('');
};

// kitchen 02: upper cabinet with stacked crown, section
D['kitchen-remodel-latrobe/2'] = (L, b) => {
  const out = [];
  const u = b.h / 10.6;
  const ceil = b.y + 0.9 * u;
  const wallX = b.cx + 3.6 * u;
  out.push(P.line(b.x, ceil, b.x + b.w, ceil, 'o'));
  out.push(P.hatch(b.x, ceil - 0.45 * u, b.w, 0.45 * u, 16));
  out.push(P.line(wallX, ceil, wallX, b.y + b.h, 'o'));
  out.push(P.hatch(wallX, ceil, 0.45 * u, b.h - 0.9 * u, 16));
  // cabinet box in section: top, back, bottom, door
  const capX = b.cx - 2.4 * u,
    topY = ceil + 2.6 * u,
    botY = topY + 4.6 * u;
  out.push(P.rect(capX, topY, wallX - capX - 0.1 * u, 0.7 * u, 'o'));
  out.push(P.hatch(capX, topY, wallX - capX - 0.1 * u, 0.7 * u, 9));
  out.push(P.rect(capX, botY, wallX - capX - 0.1 * u, 0.7 * u, 'o'));
  out.push(P.hatch(capX, botY, wallX - capX - 0.1 * u, 0.7 * u, 9));
  out.push(P.rect(wallX - 0.6 * u, topY + 0.7 * u, 0.5 * u, botY - topY - 0.7 * u, 's'));
  out.push(P.rect(capX - 0.3 * u, topY - 0.05 * u, 0.3 * u, botY - topY + 0.8 * u, 'o')); // door
  out.push(P.hatch(capX - 0.3 * u, topY - 0.05 * u, 0.3 * u, botY - topY + 0.8 * u, 7));
  // shelf
  out.push(P.rect(capX + 0.05 * u, topY + 2.6 * u, wallX - capX - 0.7 * u, 0.28 * u, 's'));
  // frieze board on the cabinet top, then crown to the ceiling
  const fx = capX - 0.35 * u,
    fH = 1.1 * u;
  out.push(P.rect(fx, topY - fH, 0.3 * u, fH, 'o'));
  out.push(P.hatch(fx, topY - fH, 0.3 * u, fH, 7));
  const cw = 1.6 * u,
    ch = ceil + 2.6 * u - fH - ceil; // from ceiling to the frieze top
  const cx0 = fx - cw,
    cy0 = ceil;
  const pt = (a, c) => `${r(cx0 + a * cw)} ${r(cy0 + c * ch)}`;
  const face = `M${pt(0, 0)}L${pt(0, 0.1)}C${pt(0.02, 0.32)} ${pt(0.18, 0.5)} ${pt(0.42, 0.52)}L${pt(0.47, 0.57)}C${pt(0.7, 0.6)} ${pt(0.72, 0.8)} ${pt(0.86, 0.9)}C${pt(0.95, 0.96)} ${pt(1, 0.98)} ${pt(1, 1)}`;
  const body = `${face}L${pt(1, 0.72)}L${pt(0.28, 0)}Z`;
  out.push(
    `<clipPath id="crownClip2"><path d="${body}"/></clipPath><g clip-path="url(#crownClip2)">${P.hatch(cx0, cy0, cw, ch, 8)}</g>`,
  );
  out.push(`<path class="f" d="${body}"/>`);
  out.push(P.path(body, 'o'));
  // light rail under the cabinet
  out.push(
    P.path(
      `M${r(capX - 0.3 * u)} ${r(botY + 0.75 * u)}v${r(0.35 * u)}c${r(0.15 * u)} 0 ${r(0.25 * u)} ${r(-0.1 * u)} ${r(0.3 * u)} ${r(-0.3 * u)}`,
      'o',
    ),
  );
  out.push(dim(L, fx, topY + 0.2 * u, fx, topY - fH, '5-1/2" FRIEZE', 0.55 * u, { size: 18 }));
  out.push(dim(L, cx0, ceil - 0.2 * u, fx, ceil - 0.2 * u, '3-5/8" CROWN', -0.3 * u, { size: 18 }));
  out.push(
    note(L, wallX - 0.35 * u, topY + 3.8 * u, wallX - 1.1 * u, botY + 1.7 * u, '3/4" PLY BACK', {
      side: 'left',
    }),
  );
  out.push(
    note(L, capX - 0.15 * u, botY + 0.95 * u, capX - 1.3 * u, botY + 1.7 * u, 'LIGHT RAIL', { side: 'left' }),
  );
  out.push(L.text(b.x + 10, b.y + b.h - 10, 'SECTION THROUGH UPPER', 19, { tracking: 0.14, opacity: 0.5 }));
  return out.join('');
};

// kitchen 03: window casing elevation (portrait)
D['kitchen-remodel-latrobe/3'] = (L, b) => {
  const out = [];
  const u = b.w / 10.6;
  const ww = 6 * u,
    wh = 7.6 * u,
    wx = b.cx - ww / 2,
    wy = b.y + 1.5 * u;
  const c = 0.9 * u; // casing width
  // window sash
  out.push(P.rect(wx, wy, ww, wh, 'o'));
  out.push(P.rect(wx + 0.35 * u, wy + 0.35 * u, ww - 0.7 * u, wh / 2 - 0.5 * u, 's'));
  out.push(P.rect(wx + 0.35 * u, wy + wh / 2 + 0.15 * u, ww - 0.7 * u, wh / 2 - 0.5 * u, 's'));
  out.push(P.hatch(wx + 0.35 * u, wy + 0.35 * u, ww - 0.7 * u, wh - 0.7 * u, 34));
  // casing legs and head, mitered corners
  const rev = 0.12 * u;
  out.push(P.rect(wx - rev - c, wy - rev - c, c, wh + 2 * rev + c, 'o'));
  out.push(P.rect(wx + ww + rev, wy - rev - c, c, wh + 2 * rev + c, 'o'));
  out.push(P.rect(wx - rev - c, wy - rev - c, ww + 2 * rev + 2 * c, c, 'o'));
  out.push(P.line(wx - rev - c, wy - rev - c, wx - rev, wy - rev, 's'));
  out.push(P.line(wx + ww + rev + c, wy - rev - c, wx + ww + rev, wy - rev, 's'));
  out.push(
    `<rect class="f" x="${r(wx - rev - c)}" y="${r(wy - rev - c)}" width="${r(ww + 2 * rev + 2 * c)}" height="${r(c)}"/>`,
  );
  out.push(
    `<rect class="f" x="${r(wx - rev - c)}" y="${r(wy - rev)}" width="${r(c)}" height="${r(wh + rev)}"/>`,
  );
  out.push(
    `<rect class="f" x="${r(wx + ww + rev)}" y="${r(wy - rev)}" width="${r(c)}" height="${r(wh + rev)}"/>`,
  );
  // casing profile lines (two beads)
  for (const lx of [wx - rev - c + 0.25 * u, wx + ww + rev + c - 0.25 * u])
    out.push(P.line(lx, wy - rev - c + 0.25 * u, lx, wy + wh + rev, 'h'));
  out.push(
    P.line(
      wx - rev - c + 0.25 * u,
      wy - rev - c + 0.25 * u,
      wx + ww + rev + c - 0.25 * u,
      wy - rev - c + 0.25 * u,
      'h',
    ),
  );
  // stool and apron
  const stoolY = wy + wh + rev;
  out.push(P.rect(wx - rev - c - 0.4 * u, stoolY, ww + 2 * rev + 2 * c + 0.8 * u, 0.3 * u, 'o'));
  out.push(
    `<rect class="f2" x="${r(wx - rev - c - 0.4 * u)}" y="${r(stoolY)}" width="${r(ww + 2 * rev + 2 * c + 0.8 * u)}" height="${r(0.3 * u)}"/>`,
  );
  out.push(P.rect(wx - rev - c, stoolY + 0.3 * u, ww + 2 * rev + 2 * c, 0.7 * u, 'o'));
  out.push(
    P.line(wx - rev - c, stoolY + 0.3 * u + 0.2 * u, wx + ww + rev + c, stoolY + 0.3 * u + 0.2 * u, 'h'),
  );
  // dims and notes
  out.push(
    dim(L, wx - rev - c, stoolY + 1.6 * u, wx - rev, stoolY + 1.6 * u, '3-1/2"', 0.35 * u, { size: 18 }),
  );
  out.push(
    dim(L, wx - rev, wy - rev - c - 0.4 * u, wx, wy - rev - c - 0.4 * u, '1/8" REVEAL', -0.3 * u, {
      size: 18,
    }),
  );
  out.push(
    note(L, wx - rev - c / 2, wy - rev - c / 2, wx - rev - c - 1.0 * u, wy - rev - c - 0.9 * u, 'MITERED', {
      side: 'right',
    }),
  );
  out.push(
    note(
      L,
      wx + ww + rev + c + 0.2 * u,
      stoolY + 0.15 * u,
      wx + ww + rev + c + 0.2 * u,
      stoolY + 1.4 * u,
      'STOOL + APRON',
      { side: 'left' },
    ),
  );
  return out.join('');
};

// ---- Oak stair rebuild, Irwin (portrait cover) --------------------------------------------
function stairProfile(o) {
  const { rises, riseIn, runIn, S } = o;
  const inch = S / 12;
  const rise = riseIn * inch,
    run = runIn * inch;
  const x0 = o.x0,
    floor = o.floor;
  const pts = [
    [x0 - 1.6 * S, floor],
    [x0, floor],
  ];
  let x = x0,
    y = floor;
  for (let i = 0; i < rises; i++) {
    y -= rise;
    pts.push([x, y]);
    x += run;
    pts.push([x, y]);
  }
  return { pts, rise, run, inch, topX: x - run, topY: y };
}
D['oak-stair-rebuild-irwin/cover'] = (L, b) => {
  const out = [];
  const rises = 11;
  const S = Math.min(b.w / 15.5, b.h / 10.6);
  const floor = b.y + b.h * 0.92;
  const x0 = b.x + 2.4 * S;
  const { pts, rise, run, inch, topX, topY } = stairProfile({
    rises,
    riseIn: 7.375,
    runIn: 10,
    S,
    x0,
    floor,
  });
  // upper landing to the right edge
  out.push(P.line(topX, topY, b.x + b.w, topY, 'o'));
  out.push(P.rect(topX, topY, b.x + b.w - topX, 0.9 * S, 's'));
  out.push(P.hatch(topX, topY, b.x + b.w - topX, 0.9 * S, 18));
  // floor
  out.push(P.line(b.x, floor, b.x + b.w, floor, 'o'));
  out.push(P.hatch(b.x, floor, b.w, 0.3 * S, 14));
  // stringer body
  const body = [[x0, floor], ...pts.slice(2), [topX, topY + 0.9 * S], [x0 + run * 1.2, floor]];
  out.push(`<path class="f" d="M${body.map(([px, py]) => `${r(px)} ${r(py)}`).join('L')}Z"/>`);
  out.push(
    P.poly(
      [
        [x0 + run * 1.2, floor],
        [topX, topY + 0.9 * S],
      ],
      's',
    ),
  );
  // risers and treads with nosing
  for (let i = 0; i < rises; i++) {
    const [rx, ry] = pts[2 + i * 2];
    out.push(P.line(rx, ry + rise, rx, ry, 'o')); // riser
    out.push(P.rect(rx - 1 * inch, ry - 1 * inch, run + 1 * inch, 1 * inch, 'o')); // tread with 1" nosing
    out.push(
      `<rect class="f2" x="${r(rx - inch)}" y="${r(ry - inch)}" width="${r(run + inch)}" height="${r(inch)}"/>`,
    );
  }
  // newel at the bottom, balusters, handrail 36" above the nosings
  const nx = x0 - 3.5 * inch - 2 * inch,
    nw = 3.5 * inch;
  const railAt = (x) => {
    const [bx, by] = pts[2];
    const k = (x - bx) / run;
    return by - inch - k * rise - 36 * inch;
  };
  out.push(P.rect(nx, railAt(nx + nw / 2) - 6 * inch, nw, floor - (railAt(nx + nw / 2) - 6 * inch), 'o'));
  out.push(P.rect(nx - 0.5 * inch, railAt(nx + nw / 2) - 8 * inch, nw + 1 * inch, 2 * inch, 'o'));
  for (let i = 0; i < rises - 1; i++) {
    const [rx, ry] = pts[2 + i * 2];
    for (const off of [2.5 * inch, 6.5 * inch]) {
      const bx = rx + off;
      out.push(P.line(bx, ry - inch, bx, railAt(bx) + 0.6 * inch, 's'));
    }
  }
  const railX1 = nx + nw,
    railX2 = topX + 4 * inch;
  out.push(P.line(railX1, railAt(railX1), railX2, railAt(railX2), 'o'));
  out.push(P.line(railX1, railAt(railX1) + 2.4 * inch, railX2, railAt(railX2) + 2.4 * inch, 'o'));
  // upper newel and level rail
  out.push(P.rect(railX2, railAt(railX2) - 6 * inch, nw, topY - (railAt(railX2) - 6 * inch), 'o'));
  out.push(P.line(railX2 + nw, railAt(railX2), b.x + b.w, railAt(railX2), 'o'));
  out.push(P.line(railX2 + nw, railAt(railX2) + 2.4 * inch, b.x + b.w, railAt(railX2) + 2.4 * inch, 'o'));
  for (let x = railX2 + nw + 4 * inch; x < b.x + b.w; x += 4 * inch)
    out.push(P.line(x, railAt(railX2) + 2.4 * inch, x, topY, 's'));
  // dims and notes
  const [r5x, r5y] = pts[2 + 5 * 2];
  out.push(dim(L, r5x, r5y + rise, r5x, r5y, '7-3/8"', 0.55 * S, { size: 18 }));
  out.push(dim(L, r5x, r5y, r5x + run, r5y, '10"', 0.62 * S, { size: 18 }));
  out.push(
    dim(
      L,
      r5x + run * 2 + 1.5 * inch,
      pts[2 + 7 * 2][1] - inch,
      r5x + run * 2 + 1.5 * inch,
      railAt(r5x + run * 2 + 1.5 * inch),
      '36"',
      -0.5 * S,
      { size: 18 },
    ),
  );
  out.push(
    note(
      L,
      pts[2 + 10 * 2][0] + run / 2,
      pts[2 + 10 * 2][1] - inch / 2,
      b.x + 4.6 * S,
      b.y + 1.6 * S,
      'RED OAK TREADS, 1" NOSING',
      { side: 'left' },
    ),
  );
  out.push(
    note(
      L,
      pts[2 + 2 * 2][0],
      pts[2 + 2 * 2][1] + rise / 2,
      pts[2 + 2 * 2][0] + 1.6 * S,
      pts[2 + 2 * 2][1] + 1.7 * S,
      'PAINTED POPLAR RISERS',
    ),
  );
  out.push(
    note(L, nx + nw / 2, floor - 2.2 * S, nx - 0.2 * S, floor - 3.2 * S, 'NEW NEWEL', { side: 'left' }),
  );
  return out.join('');
};

// stairs 01: tread nosing profile (portrait)
D['oak-stair-rebuild-irwin/1'] = (L, b) => {
  const out = [];
  const u = b.w / 10; // 1 inch ≈ u
  const nx = b.cx - 1.5 * u,
    ny = b.cy - 2.2 * u; // nosing tip
  // tread: 1" thick, runs right from the nose, bullnose at the front
  const tT = 1 * u,
    treadW = 5.5 * u;
  const tread = `M${r(nx + tT / 2)} ${r(ny)}H${r(nx + treadW)}V${r(ny + tT)}H${r(nx + tT / 2)}A${r(tT / 2)} ${r(tT / 2)} 0 0 1 ${r(nx + tT / 2)} ${r(ny)}Z`;
  out.push(
    `<clipPath id="treadClip"><path d="${tread}"/></clipPath><g clip-path="url(#treadClip)">${P.hatch(nx, ny, treadW + u, tT, 9)}</g>`,
  );
  out.push(`<path class="f2" d="${tread}"/>`);
  out.push(P.path(tread, 'o'));
  // riser below, set into a dado in the tread
  const rx = nx + 1 * u,
    rT = 0.75 * u;
  out.push(P.rect(rx, ny + tT - 0.3 * u, rT, 6.5 * u, 'o'));
  out.push(P.hatch(rx, ny + tT - 0.3 * u, rT, 6.5 * u, 9));
  out.push(P.line(rx, ny + tT, rx, ny + tT - 0.3 * u, 'x'));
  out.push(P.line(rx + rT, ny + tT, rx + rT, ny + tT - 0.3 * u, 'x'));
  // cove under the nosing
  out.push(
    P.path(`M${r(rx)} ${r(ny + tT + 0.8 * u)}Q${r(rx)} ${r(ny + tT)} ${r(rx - 0.8 * u)} ${r(ny + tT)}`, 'o'),
  );
  // the next tread down
  const ny2 = ny + 7.375 * u;
  out.push(P.path(`M${r(b.x + 0.5 * u)} ${r(ny2)}H${r(rx)}`, 'o'));
  // stringer behind (dashed)
  out.push(P.line(rx + rT + 0.3 * u, ny + tT, rx + rT + 0.3 * u, ny + tT + 7 * u, 'x'));
  // dims and notes
  out.push(dim(L, nx, ny - 0.8 * u, rx, ny - 0.8 * u, '1" NOSING', -0.45 * u, { size: 18 }));
  out.push(dim(L, nx + treadW + 0.5 * u, ny + tT, nx + treadW + 0.5 * u, ny, '1"', -0.5 * u, { size: 18 }));
  out.push(dim(L, rx + rT + 0.9 * u, ny2, rx + rT + 0.9 * u, ny, '7-3/8"', -0.6 * u, { size: 18 }));
  out.push(
    note(L, rx - 0.45 * u, ny + tT + 0.35 * u, rx - 1.6 * u, ny + tT + 2.2 * u, '3/4" COVE', {
      side: 'left',
    }),
  );
  out.push(note(L, rx + rT / 2, ny + tT + 3 * u, rx + rT + 2 * u, ny + tT + 4.2 * u, 'RISER IN 1/4" DADO'));
  out.push(
    note(L, nx + 3.5 * u, ny + tT / 2, nx + 2.6 * u, ny - 3.1 * u, 'SOLID RED OAK, 3 COATS SATIN', {
      side: 'left',
    }),
  );
  return out.join('');
};

// stairs 02: newel and handrail joint (landscape)
D['oak-stair-rebuild-irwin/2'] = (L, b) => {
  const out = [];
  const u = b.h / 48; // 1 inch
  const floor = b.y + b.h * 0.93;
  const nx = b.cx - 10 * u,
    nw = 3.5 * u;
  const capY = floor - 42 * u;
  out.push(P.rect(nx, capY, nw, floor - capY, 'o'));
  out.push(`<rect class="f" x="${r(nx)}" y="${r(capY)}" width="${r(nw)}" height="${r(floor - capY)}"/>`);
  // chamfered cap
  out.push(
    P.poly(
      [
        [nx - 0.6 * u, capY],
        [nx - 0.6 * u, capY - 1.2 * u],
        [nx + nw / 2, capY - 2.6 * u],
        [nx + nw + 0.6 * u, capY - 1.2 * u],
        [nx + nw + 0.6 * u, capY],
      ],
      'o',
      true,
    ),
  );
  // fluting on the post (three lines)
  for (const k of [0.3, 0.5, 0.7])
    out.push(P.line(nx + nw * k, capY + 6 * u, nx + nw * k, floor - 6 * u, 'h'));
  // base block
  out.push(P.rect(nx - 0.4 * u, floor - 6 * u, nw + 0.8 * u, 6 * u, 's'));
  // handrail rising to the right at 36.5° with an easing into the post
  const ang = Math.atan2(7.375, 10);
  const rx0 = nx + nw,
    ry0 = floor - 34 * u;
  const len = 24 * u;
  const rx1 = rx0 + 6 * u + Math.cos(ang) * len,
    ry1 = ry0 - Math.sin(ang) * len;
  const railT = 2.4 * u;
  const railPath = `M${r(rx0)} ${r(ry0)}C${r(rx0 + 5 * u)} ${r(ry0)} ${r(rx0 + 5 * u)} ${r(ry0 - 1.8 * u)} ${r(rx0 + 6 * u + Math.cos(ang) * 4 * u)} ${r(ry0 - Math.sin(ang) * 4 * u)}L${r(rx1)} ${r(ry1)}l${r(Math.sin(ang) * railT)} ${r(Math.cos(ang) * railT)}L${r(rx0 + 6 * u + Math.cos(ang) * 4 * u + Math.sin(ang) * railT)} ${r(ry0 - Math.sin(ang) * 4 * u + Math.cos(ang) * railT)}C${r(rx0 + 5 * u + 0.4 * u)} ${r(ry0 - 1.8 * u + railT)} ${r(rx0 + 5 * u)} ${r(ry0 + railT)} ${r(rx0)} ${r(ry0 + railT)}Z`;
  out.push(`<path class="f2" d="${railPath}"/>`);
  out.push(P.path(railPath, 'o'));
  // rail bolt, hidden
  out.push(P.line(rx0 - 2.6 * u, ry0 + railT / 2, rx0 + 4 * u, ry0 + railT / 2, 'x'));
  out.push(P.circle(rx0 + 3.2 * u, ry0 + railT / 2 + 1.6 * u, 0.9 * u, 'x'));
  // balusters under the rail
  for (const k of [10, 14]) {
    const bx = rx0 + 6 * u + Math.cos(ang) * k * u;
    const by = ry0 - Math.sin(ang) * k * u + Math.cos(ang) * railT;
    out.push(P.line(bx, by, bx, floor - 2 * u + (k - 10) * 0.2 * u, 's'));
  }
  // tread edge suggestion
  out.push(P.line(nx + nw + 4 * u, floor, b.x + b.w, floor, 'o'));
  out.push(P.line(b.x, floor, nx - 4 * u, floor, 'o'));
  out.push(P.hatch(b.x, floor, b.w, 2 * u, 14));
  // dims and notes
  out.push(dim(L, nx - 2.2 * u, floor, nx - 2.2 * u, capY - 2.6 * u, '42"', 0.8 * u, { size: 18 }));
  out.push(note(L, rx0 + 1.2 * u, ry0 + railT / 2, rx0 + 3 * u, ry0 - 9 * u, 'RAIL BOLT, PLUGGED BELOW'));
  out.push(note(L, rx0 + 5.4 * u, ry0 - 0.6 * u, rx0 + 12 * u, ry0 + 8 * u, 'EASING'));
  out.push(note(L, nx + nw / 2, capY - 1.4 * u, nx - 3 * u, capY - 5 * u, 'CHAMFERED CAP', { side: 'left' }));
  return out.join('');
};

// stairs 03: baluster spacing with the 4" sphere (landscape)
D['oak-stair-rebuild-irwin/3'] = (L, b) => {
  const out = [];
  const u = b.w / 50; // 1 inch
  const railY = b.cy - 12 * u,
    shoeY = b.cy + 10 * u;
  const x0 = b.cx - 19 * u,
    w = 38 * u;
  // top rail and shoe rail
  out.push(P.rect(x0, railY, w, 2.4 * u, 'o'));
  out.push(`<rect class="f2" x="${r(x0)}" y="${r(railY)}" width="${r(w)}" height="${r(2.4 * u)}"/>`);
  out.push(P.rect(x0, shoeY, w, 1.6 * u, 'o'));
  out.push(`<rect class="f2" x="${r(x0)}" y="${r(shoeY)}" width="${r(w)}" height="${r(1.6 * u)}"/>`);
  // balusters 1-1/4" square at 5" o.c. (3-3/4" clear)
  const bw = 1.25 * u,
    pitch = 5 * u;
  const xs = [];
  for (let x = x0 + 2 * u; x + bw <= x0 + w - 2 * u + 0.01; x += pitch) {
    xs.push(x);
    out.push(P.rect(x, railY + 2.4 * u, bw, shoeY - railY - 2.4 * u, 'o'));
    out.push(
      `<rect class="f" x="${r(x)}" y="${r(railY + 2.4 * u)}" width="${r(bw)}" height="${r(shoeY - railY - 2.4 * u)}"/>`,
    );
  }
  // the 4" sphere between two balusters
  const i = 3;
  const cx = xs[i] + bw + (pitch - bw) / 2,
    cy = (railY + 2.4 * u + shoeY) / 2;
  out.push(P.circle(cx, cy, 2 * u, 'd'));
  out.push(P.line(cx - 2 * u, cy, cx + 2 * u, cy, 'd'));
  out.push(P.line(cx, cy - 2 * u, cx, cy + 2 * u, 'd'));
  // dims and notes
  out.push(
    dim(L, xs[1] + bw, shoeY + 1.6 * u + 1.4 * u, xs[2], shoeY + 1.6 * u + 1.4 * u, '3-3/4" CLR.', 0.9 * u, {
      size: 18,
    }),
  );
  out.push(dim(L, xs[5], railY - 1.4 * u, xs[5] + bw, railY - 1.4 * u, '1-1/4"', -0.9 * u, { size: 18 }));
  out.push(
    dim(L, xs[0] + bw / 2, railY - 1.4 * u, xs[1] + bw / 2, railY - 1.4 * u, '5" O.C.', -0.9 * u, {
      size: 18,
    }),
  );
  out.push(note(L, cx + 1.4 * u, cy - 1.4 * u, cx + 5 * u, cy - 6 * u, '4" SPHERE MUST NOT PASS'));
  out.push(
    note(L, x0 + w - 1 * u, shoeY + 0.8 * u, x0 + w - 3 * u, shoeY + 5 * u, 'OAK SHOE RAIL, FILLET BETWEEN', {
      side: 'left',
    }),
  );
  return out.join('');
};

// ---- Farmhouse porch, Mount Pleasant ----------------------------------------------------------
/** Turned column outline as a closed path; x = centre, top→bottom = y0→y1, width in px. */
function column(x, y0, y1, w) {
  const H = y1 - y0;
  const half = (f) => (w / 2) * f;
  // profile as (t along height 0..1 from top, half-width factor)
  const prof = [];
  prof.push([0, 1], [0.05, 1]); // abacus block
  for (let i = 0; i <= 6; i++) {
    const t = i / 6;
    prof.push([0.05 + 0.05 * t, 1 - 0.35 * Math.sin((t * Math.PI) / 2)]);
  } // capital flare
  prof.push([0.11, 0.62], [0.12, 0.62]);
  for (let i = 0; i <= 8; i++) {
    const t = i / 8;
    prof.push([0.12 + 0.55 * t, 0.6 - 0.06 * t]);
  } // shaft taper
  prof.push([0.68, 0.7], [0.7, 0.7]); // ring
  for (let i = 0; i <= 10; i++) {
    const t = i / 10;
    prof.push([0.7 + 0.16 * t, 0.62 + 0.3 * Math.sin(t * Math.PI)]);
  } // vase
  prof.push([0.87, 0.78], [0.885, 0.78], [0.9, 0.9], [0.905, 1]); // torus + plinth
  prof.push([1, 1]);
  const right = prof.map(([t, f]) => [x + half(f), y0 + t * H]);
  const left = prof.map(([t, f]) => [x - half(f), y0 + t * H]).reverse();
  return `M${[...right, ...left].map(([px, py]) => `${r(px)} ${r(py)}`).join('L')}Z`;
}
D['farmhouse-porch-mount-pleasant/cover'] = (L, b) => {
  const out = [];
  const S = Math.min(b.w / 27, b.h / 12.2);
  const inch = S / 12;
  const floor = b.cy + 3.4 * S;
  const beamY = floor - 8 * S;
  const x0 = b.cx - 12 * S,
    Wd = 24 * S;
  // roof: fascia band and a shallow shed roof line above
  out.push(P.rect(x0 - 1 * S, beamY - 0.9 * S, Wd + 2 * S, 0.9 * S, 'o'));
  out.push(
    `<rect class="f" x="${r(x0 - S)}" y="${r(beamY - 0.9 * S)}" width="${r(Wd + 2 * S)}" height="${r(0.9 * S)}"/>`,
  );
  out.push(P.line(x0 - 1 * S, beamY - 0.9 * S, x0 - 1 * S + 0.6 * S, beamY - 2.1 * S, 's'));
  out.push(P.line(x0 + Wd + 1 * S, beamY - 0.9 * S, x0 + Wd + 1 * S - 0.6 * S, beamY - 2.1 * S, 's'));
  out.push(P.line(x0 - 0.4 * S, beamY - 2.1 * S, x0 + Wd + 0.4 * S, beamY - 2.1 * S, 's'));
  out.push(P.hatch(x0 - 0.4 * S, beamY - 2.1 * S, Wd + 0.8 * S, 0.5 * S, 22));
  // columns
  const cols = [0, 1, 2, 3].map((i) => x0 + (Wd / 3) * i);
  for (const cx of cols) {
    const d = column(cx, beamY, floor, 10 * inch);
    out.push(`<path class="f" d="${d}"/>`);
    out.push(P.path(d, 'o'));
  }
  // railings in bays 1 and 3, steps in bay 2
  for (const bay of [0, 2]) {
    const a = cols[bay] + 5 * inch,
      c = cols[bay + 1] - 5 * inch;
    out.push(P.rect(a, floor - 32 * inch, c - a, 2 * inch, 'o'));
    out.push(P.rect(a, floor - 5 * inch, c - a, 1.5 * inch, 'o'));
    for (let x = a + 4 * inch; x < c - 1 * inch; x += 4.5 * inch)
      out.push(P.rect(x, floor - 30 * inch, 1.5 * inch, 25 * inch, 's'));
  }
  // floor: T&G board ends
  out.push(P.line(x0 - 1.2 * S, floor, x0 + Wd + 1.2 * S, floor, 'o'));
  out.push(P.rect(x0 - 1.2 * S, floor, Wd + 2.4 * S, 1 * inch, 'o'));
  out.push(P.lines(x0 - 1.2 * S, floor, Wd + 2.4 * S, 1 * inch, 3.2 * inch, 'v', 'h'));
  // skirt / lattice below the floor, posts to grade
  const grade = floor + 2.2 * S;
  out.push(P.rect(x0 - 1.2 * S, floor + 1 * inch, Wd + 2.4 * S, 8 * inch, 's'));
  out.push(P.hatch(x0 - 1.2 * S, floor + 9 * inch, Wd + 2.4 * S, grade - floor - 9 * inch, 26));
  out.push(P.line(b.x, grade, b.x + b.w, grade, 'o'));
  // steps in the centre bay
  const sx = cols[1] + 4 * inch,
    sw = cols[2] - cols[1] - 8 * inch;
  for (let i = 0; i < 3; i++) {
    const y = floor + 1 * inch + (i + 1) * ((grade - floor - inch) / 3);
    out.push(P.rect(sx - i * 3 * inch, y - 1.2 * inch, sw + i * 6 * inch, 1.2 * inch, 'o'));
    out.push(P.line(sx - i * 3 * inch, y, sx - i * 3 * inch, y - (grade - floor - inch) / 3, 's'));
    out.push(P.line(sx + sw + i * 3 * inch, y, sx + sw + i * 3 * inch, y - (grade - floor - inch) / 3, 's'));
  }
  // new footer under the far corner post
  out.push(P.rect(cols[3] - 8 * inch, grade + 0.3 * S, 16 * inch, 0.9 * S, 'x'));
  out.push(P.line(cols[3], floor + 9 * inch, cols[3], grade + 0.3 * S, 'x'));
  // dims and notes
  out.push(dim(L, x0 - 1.6 * S, floor, x0 - 1.6 * S, beamY, '8\'-0"', 0.6 * S, { size: 18 }));
  out.push(
    dim(L, cols[0], beamY - 2.5 * S, cols[1], beamY - 2.5 * S, '8\'-0" O.C.', -0.45 * S, { size: 18 }),
  );
  out.push(
    note(L, cols[3], grade + 0.75 * S, cols[3] - 1.2 * S, grade + 1.6 * S, 'NEW FOOTER, 36" DEEP', {
      side: 'left',
    }),
  );
  out.push(
    note(L, cols[2], floor - 6.4 * S, cols[2] + 1.0 * S, floor - 9.4 * S, 'COLUMNS REPAIRED, NOT REPLACED'),
  );
  out.push(
    note(L, x0 + 2.5 * S, floor + 0.5 * inch, x0 + 1.0 * S, floor + 1.4 * S, 'T&G FIR, PRIMED 6 SIDES', {
      side: 'right',
    }),
  );
  return out.join('');
};

// porch 01: sistered joists and the new rim (landscape)
D['farmhouse-porch-mount-pleasant/1'] = (L, b) => {
  const out = [];
  const u = b.h / 60; // 1 inch
  const x0 = b.x + 6 * u,
    Wd = b.w - 12 * u;
  const jy = b.cy - 14 * u,
    jh = 7.25 * u;
  // existing joist with the rotted end cut off (left)
  const cut = x0 + 26 * u;
  out.push(P.rect(cut, jy, x0 + Wd - cut, jh, 's'));
  out.push(P.hatch(cut, jy, x0 + Wd - cut, jh, 12, 'h'));
  out.push(
    P.poly(
      [
        [x0 + 10 * u, jy],
        [cut, jy],
        [cut, jy + jh],
        [x0 + 10 * u, jy + jh],
        [x0 + 12 * u, jy + jh * 0.7],
        [x0 + 9 * u, jy + jh * 0.35],
      ],
      'x',
      true,
    ),
  );
  // new sister joist, full length, offset down slightly so both read
  out.push(P.rect(x0 + 5 * u, jy + 2.2 * u, Wd - 5 * u, jh, 'o'));
  out.push(
    `<rect class="f2" x="${r(x0 + 5 * u)}" y="${r(jy + 2.2 * u)}" width="${r(Wd - 5 * u)}" height="${r(jh)}"/>`,
  );
  // bolts, staggered 16" o.c.
  for (let i = 0; i < 6; i++) {
    const bx = cut + 6 * u + i * 16 * u;
    const by = jy + 2.2 * u + (i % 2 ? 2 * u : 5.2 * u);
    if (bx < x0 + Wd - 3 * u) {
      out.push(P.circle(bx, by, 0.9 * u, 'o'));
      out.push(P.line(bx - 0.5 * u, by, bx + 0.5 * u, by, 'o'));
    }
  }
  // new rim board on the left, corner post below, new footer
  out.push(P.rect(x0 + 3.5 * u, jy - 1.5 * u, 1.5 * u, jh + 4.5 * u, 'o'));
  out.push(P.hatch(x0 + 3.5 * u, jy - 1.5 * u, 1.5 * u, jh + 4.5 * u, 6));
  out.push(P.rect(x0 + 5 * u, jy + jh + 2.2 * u, 5.5 * u, 22 * u, 'o'));
  out.push(
    `<rect class="f" x="${r(x0 + 5 * u)}" y="${r(jy + jh + 2.2 * u)}" width="${r(5.5 * u)}" height="${r(22 * u)}"/>`,
  );
  const grade = jy + jh + 2.2 * u + 22 * u + 2 * u;
  out.push(P.line(b.x, grade, b.x + b.w, grade, 'o'));
  out.push(P.hatch(b.x, grade, b.w, 2.5 * u, 22));
  out.push(P.rect(x0 + 5 * u + 2.75 * u - 9 * u, grade - 2 * u, 18 * u, 8 * u, 'o'));
  // concrete: dots
  const rnd = mulberry32(9);
  for (let i = 0; i < 40; i++)
    out.push(
      P.circle(
        x0 + 5 * u + 2.75 * u - 9 * u + 1.5 * u + rnd() * 15 * u,
        grade - 2 * u + 1 * u + rnd() * 6 * u,
        1.6,
        'dot',
      ),
    );
  // decking above
  out.push(P.rect(x0, jy - 1.5 * u, Wd, 1 * u, 's'));
  // dims and notes
  out.push(
    dim(
      L,
      cut + 6 * u,
      jy + jh + 2.2 * u + 3 * u,
      cut + 22 * u,
      jy + jh + 2.2 * u + 3 * u,
      '16" O.C. STAGGERED',
      1.4 * u,
      { size: 18 },
    ),
  );
  out.push(
    note(L, cut - 4 * u, jy + jh * 0.5, cut - 6 * u, jy - 6 * u, 'ROT CUT BACK TO SOUND WOOD', {
      side: 'right',
    }),
  );
  out.push(
    note(
      L,
      cut + 40 * u,
      jy + 2.2 * u + jh * 0.75,
      cut + 34 * u,
      jy + jh + 12 * u,
      'NEW 2×8 P.T. SISTER, FULL LENGTH',
      { side: 'left' },
    ),
  );
  out.push(
    note(L, x0 + 4.25 * u, jy + jh - 1 * u, x0 + 4.25 * u - 1.5 * u, jy + jh + 8 * u, 'NEW RIM', {
      side: 'right',
    }),
  );
  out.push(note(L, x0 + 7.75 * u, grade + 3.5 * u, x0 + 16 * u, grade + 6.2 * u, 'NEW FOOTER'));
  return out.join('');
};

// porch 02: turned column (portrait)
D['farmhouse-porch-mount-pleasant/2'] = (L, b) => {
  const out = [];
  const H = b.h * 0.9,
    y0 = b.y + b.h * 0.05,
    y1 = y0 + H;
  const w = H * 0.115;
  const d = column(b.cx, y0, y1, w);
  out.push(`<path class="f" d="${d}"/>`);
  out.push(P.path(d, 'o'));
  // centre line
  out.push(P.line(b.cx, y0 - 20, b.cx, y1 + 20, 'x'));
  // dutchman repair near the base: a dashed patch on the vase
  out.push(P.rect(b.cx - w * 0.42, y0 + H * 0.74, w * 0.3, H * 0.08, 'x'));
  // beam above and floor below
  out.push(P.rect(b.x, y0 - 0.06 * H, b.w, 0.06 * H, 's'));
  out.push(P.hatch(b.x, y0 - 0.06 * H, b.w, 0.06 * H, 16));
  out.push(P.line(b.x, y1, b.x + b.w, y1, 'o'));
  out.push(P.hatch(b.x, y1, b.w, 0.03 * H, 14));
  // dims and notes
  out.push(dim(L, b.cx + w * 0.7, y1, b.cx + w * 0.7, y0, '8\'-0"', 0.09 * H, { size: 18 }));
  out.push(dim(L, b.cx - w / 2, y1 + 0.05 * H, b.cx + w / 2, y1 + 0.05 * H, '10"', 0.035 * H, { size: 18 }));
  out.push(
    note(L, b.cx - w * 0.27, y0 + H * 0.78, b.cx - w * 1.4, y0 + H * 0.7, 'DUTCHMAN REPAIR, EPOXY SET', {
      side: 'left',
    }),
  );
  out.push(note(L, b.cx + w * 0.3, y0 + H * 0.4, b.cx + w * 1.3, y0 + H * 0.3, 'STRIPPED + PRIMED'));
  out.push(note(L, b.cx + w * 0.5, y0 + H * 0.95, b.cx + w * 1.3, y0 + H * 0.87, 'NEW CEDAR PLINTH'));
  return out.join('');
};

// porch 03: beadboard ceiling, reflected plan (landscape)
D['farmhouse-porch-mount-pleasant/3'] = (L, b) => {
  const out = [];
  const x0 = b.x + b.w * 0.06,
    y0 = b.y + b.h * 0.08,
    w = b.w * 0.88,
    h = b.h * 0.82;
  out.push(P.rect(x0, y0, w, h, 'o'));
  out.push(`<rect class="f" x="${r(x0)}" y="${r(y0)}" width="${r(w)}" height="${r(h)}"/>`);
  // cove border
  const cv = h * 0.05;
  out.push(P.rect(x0 + cv, y0 + cv, w - 2 * cv, h - 2 * cv, 's'));
  // beadboard: boards run the long way, bead line beside each joint
  const bw = (h - 2 * cv) / 14;
  for (let i = 1; i < 14; i++) {
    const y = y0 + cv + i * bw;
    out.push(P.line(x0 + cv, y, x0 + w - cv, y, 's'));
    out.push(P.line(x0 + cv, y - bw * 0.16, x0 + w - cv, y - bw * 0.16, 'h'));
  }
  // light fixture at the centre
  out.push(P.circle(b.cx, y0 + h / 2, h * 0.16, 'x'));
  out.push(P.circle(b.cx, y0 + h / 2, h * 0.055, 'o'));
  out.push(P.rect(b.cx - h * 0.03, y0 + h / 2 - h * 0.03, h * 0.06, h * 0.06, 's'));
  // dims and notes
  out.push(
    dim(L, x0 + w + 0.02 * w, y0 + cv + 3 * bw, x0 + w + 0.02 * w, y0 + cv + 4 * bw, '3-1/2"', -0.03 * w, {
      size: 18,
    }),
  );
  out.push(
    note(
      L,
      b.cx + h * 0.11,
      y0 + h / 2 - h * 0.11,
      b.cx + h * 0.32,
      y0 + h * 0.2,
      'ORIGINAL FIXTURE, REWIRED',
    ),
  );
  out.push(note(L, x0 + cv / 2, y0 + h * 0.7, x0 + w * 0.12, y0 + h * 0.84, 'COVE AT PERIMETER'));
  out.push(L.text(b.x + 10, b.y + b.h - 10, 'REFLECTED CEILING PLAN', 19, { tracking: 0.14, opacity: 0.5 }));
  return out.join('');
};

// ---- Mudroom lockers, Murrysville ---------------------------------------------------------------
D['mudroom-lockers-murrysville/cover'] = (L, b) => {
  const out = [];
  const S = Math.min(b.w / 11.4, b.h / 9);
  const inch = S / 12;
  const x0 = b.cx - 5 * S,
    Wd = 10 * S;
  const floor = b.cy + 4 * S,
    ceil = floor - 8 * S;
  out.push(P.line(b.x, ceil, b.x + b.w, ceil, 's'));
  out.push(P.line(b.x, floor, b.x + b.w, floor, 'o'));
  out.push(P.hatch(b.x, floor, b.w, 0.3 * S, 14));
  // shiplap wall behind, 5-1/2" courses
  out.push(
    `<clipPath id="wallML"><rect x="${r(x0)}" y="${r(ceil)}" width="${r(Wd)}" height="${r(8 * S)}"/></clipPath><g clip-path="url(#wallML)">`,
  );
  for (let y = ceil + 5.5 * inch; y < floor; y += 5.5 * inch) {
    out.push(P.line(x0, y, x0 + Wd, y, 'h'));
    out.push(P.line(x0, y + 0.25 * inch, x0 + Wd, y + 0.25 * inch, 'h'));
  }
  out.push('</g>');
  out.push(P.rect(x0, ceil, Wd, 8 * S, 's'));
  // bench 18" high, 8' wide, base 1/2" off the tile
  const bx = x0 + 1 * S,
    bwid = 8 * S,
    benchTop = floor - 18 * inch;
  out.push(P.rect(bx, benchTop, bwid, 1.5 * inch, 'o'));
  out.push(`<rect class="f2" x="${r(bx)}" y="${r(benchTop)}" width="${r(bwid)}" height="${r(1.5 * inch)}"/>`);
  out.push(P.rect(bx, benchTop + 1.5 * inch, bwid, 18 * inch - 1.5 * inch - 0.5 * inch, 'o'));
  out.push(
    `<rect class="f" x="${r(bx)}" y="${r(benchTop + 1.5 * inch)}" width="${r(bwid)}" height="${r(16 * inch)}"/>`,
  );
  out.push(P.line(bx, floor - 0.5 * inch, bx + bwid, floor - 0.5 * inch, 'x'));
  // lockers: 4 bays of 24", partitions from the bench to 84"
  const topY = floor - 84 * inch;
  for (let i = 0; i <= 4; i++) {
    const px = bx + i * 24 * inch;
    out.push(P.rect(px - 0.375 * inch, topY, 0.75 * inch, benchTop - topY, 'o'));
  }
  out.push(P.rect(bx - 0.75 * inch, topY - 1.5 * inch, bwid + 1.5 * inch, 1.5 * inch, 'o')); // top cap
  out.push(
    P.path(
      `M${r(bx - 0.75 * inch)} ${r(topY - 1.5 * inch)}q0 ${r(-2.5 * inch)} ${r(-2.5 * inch)} ${r(-2.5 * inch)}H${r(bx + bwid + 3.25 * inch)}q${r(-2.5 * inch)} 0 ${r(-2.5 * inch)} ${r(2.5 * inch)}`,
      's',
    ),
  ); // crown cap
  for (let i = 0; i < 4; i++) {
    const px = bx + i * 24 * inch + 0.375 * inch,
      pw = 24 * inch - 0.75 * inch;
    out.push(P.rect(px, topY + 12 * inch, pw, 0.75 * inch, 's')); // shelf at 72"
    for (const hx of [px + 7 * inch, px + 17 * inch])
      out.push(
        P.path(
          `M${r(hx)} ${r(floor - 60 * inch)}v${r(3 * inch)}q0 ${r(1.5 * inch)} ${r(1.5 * inch)} ${r(1.5 * inch)}`,
          'o',
        ),
      ); // hooks
    for (const hx of [px + 7 * inch, px + 17 * inch])
      out.push(P.rect(hx - 0.9 * inch, floor - 60.6 * inch, 1.8 * inch, 0.6 * inch, 's'));
  }
  // lift-up seat on bay 2: dashed swing arc
  const hb = bx + 24 * inch,
    hw = 24 * inch;
  out.push(P.path(`M${r(hb + hw)} ${r(benchTop)}A${r(hw)} ${r(hw)} 0 0 0 ${r(hb)} ${r(benchTop - hw)}`, 'x'));
  out.push(P.line(hb, benchTop, hb, benchTop - hw, 'x'));
  // dims and notes
  out.push(dim(L, bx - 0.55 * S, floor, bx - 0.55 * S, benchTop, '18"', 0.45 * S, { size: 18 }));
  out.push(
    dim(L, bx + 48 * inch, ceil - 0.3 * S, bx + 72 * inch, ceil - 0.3 * S, '24"', -0.4 * S, { size: 18 }),
  );
  out.push(
    dim(L, bx + bwid + 0.5 * S, floor, bx + bwid + 0.5 * S, topY - 4 * inch, '7\'-4"', -0.45 * S, {
      size: 18,
    }),
  );
  out.push(
    note(
      L,
      hb + hw * 0.75,
      benchTop - hw * 0.62,
      hb + hw * 1.6,
      benchTop - hw * 1.3,
      'LIFT-UP SEAT, BOOTS BELOW',
    ),
  );
  out.push(
    note(L, bx + 7 * inch, floor - 58 * inch, bx + 0.4 * S, ceil - 0.35 * S, 'HOOKS INTO SOLID SHIPLAP', {
      side: 'right',
    }),
  );
  out.push(
    note(
      L,
      bx + bwid - 12 * inch,
      floor - 0.25 * inch,
      bx + bwid + 0.2 * S,
      floor + 0.8 * S,
      '1/2" ABOVE TILE',
    ),
  );
  return out.join('');
};

// mudroom 01: bench lift-seat section (portrait)
D['mudroom-lockers-murrysville/1'] = (L, b) => {
  const out = [];
  const u = b.w / 30; // 1 inch
  const floor = b.y + b.h * 0.86;
  const wallX = b.x + 3 * u;
  // wall with shiplap in section (small notches)
  out.push(P.line(wallX, b.y, wallX, floor, 'o'));
  out.push(P.hatch(b.x, b.y, wallX - b.x, floor - b.y, 16));
  for (let y = b.y + 5.5 * u; y < floor; y += 5.5 * u)
    out.push(P.path(`M${r(wallX)} ${r(y)}h${r(0.75 * u)}v${r(0.4 * u)}h${r(-0.75 * u)}`, 's'));
  // tile floor with a 1/2" gap under the base
  out.push(P.line(b.x, floor, b.x + b.w, floor, 'o'));
  out.push(P.rect(b.x, floor, b.w, 0.5 * u, 's'));
  out.push(P.hatch(b.x, floor + 0.5 * u, b.w, 1.5 * u, 10));
  // bench box: 18" deep, 18" tall, base 1/2" above the tile
  const bx = wallX + 0.75 * u,
    bd = 18 * u,
    top = floor - 18 * u;
  out.push(P.rect(bx, top + 1.5 * u, bd, 16 * u, 'o'));
  out.push(P.rect(bx + 0.75 * u, top + 1.5 * u, bd - 1.5 * u, 15.25 * u, 's')); // inside
  out.push(P.rect(bx, floor - 4 * u - 0.5 * u, 0.75 * u, 4 * u, 's'));
  // boots inside (two simple profiles)
  out.push(
    P.path(
      `M${r(bx + 3 * u)} ${r(floor - 1.25 * u)}v${r(-9 * u)}h${r(3.5 * u)}v${r(6 * u)}h${r(3 * u)}v${r(3 * u)}Z`,
      'h',
    ),
  );
  out.push(
    P.path(
      `M${r(bx + 10.5 * u)} ${r(floor - 1.25 * u)}v${r(-7 * u)}h${r(3 * u)}v${r(4.5 * u)}h${r(2.5 * u)}v${r(2.5 * u)}Z`,
      'h',
    ),
  );
  // lid open 75° about a hinge at the back top corner
  const hx = bx + 0.75 * u,
    hy = top + 1.5 * u;
  const ang = -75;
  out.push(
    `<g transform="rotate(${ang} ${r(hx)} ${r(hy)})"><rect class="o" x="${r(hx)}" y="${r(hy - 1.5 * u)}" width="${r(bd - 0.75 * u)}" height="${r(1.5 * u)}"/><rect class="f2" x="${r(hx)}" y="${r(hy - 1.5 * u)}" width="${r(bd - 0.75 * u)}" height="${r(1.5 * u)}"/></g>`,
  );
  out.push(P.circle(hx, hy, 0.6 * u, 'o'));
  out.push(
    P.path(
      `M${r(hx + bd - 0.75 * u)} ${r(hy - 0.75 * u)}A${r(bd - 0.75 * u)} ${r(bd - 0.75 * u)} 0 0 0 ${r(hx + (bd - 0.75 * u) * Math.cos((ang * Math.PI) / 180))} ${r(hy + (bd - 0.75 * u) * Math.sin((ang * Math.PI) / 180))}`,
      'x',
    ),
  );
  // closed-lid ghost
  out.push(P.rect(bx, top, bd, 1.5 * u, 'x'));
  // stay
  out.push(
    P.line(
      bx + bd - 2 * u,
      top + 6 * u,
      hx + 5 * u * Math.cos((ang * Math.PI) / 180),
      hy + 5 * u * Math.sin((ang * Math.PI) / 180),
      's',
    ),
  );
  // dims and notes
  out.push(dim(L, bx + bd + 1.5 * u, floor, bx + bd + 1.5 * u, top, '18"', 1.2 * u, { size: 18 }));
  out.push(dim(L, bx, top - 1.5 * u, bx + bd, top - 1.5 * u, '18" DEEP', -1.0 * u, { size: 18 }));
  out.push(dim(L, bx + bd + 4 * u, floor, bx + bd + 4 * u, floor - 0.5 * u, '1/2"', -1.2 * u, { size: 18 }));
  out.push(note(L, hx, hy, hx + 5 * u, hy - 6 * u, 'PIANO HINGE'));
  out.push(note(L, bx + bd - 2 * u, top + 6 * u, bx + bd + 3 * u, top + 9 * u, 'SOFT-CLOSE STAY'));
  return out.join('');
};

// mudroom 02: hooks on shiplap (landscape)
D['mudroom-lockers-murrysville/2'] = (L, b) => {
  const out = [];
  const u = b.h / 22; // 1 inch
  const x0 = b.x + 2 * u,
    w = b.w - 4 * u;
  const y0 = b.y + 1.5 * u;
  // three shiplap courses with the shadow gap
  for (let i = 0; i < 3; i++) {
    const y = y0 + i * 5.75 * u;
    out.push(P.rect(x0, y, w, 5.5 * u, 'o'));
    out.push(`<rect class="f" x="${r(x0)}" y="${r(y)}" width="${r(w)}" height="${r(5.5 * u)}"/>`);
    out.push(P.line(x0, y + 5.5 * u, x0 + w, y + 5.5 * u, 's'));
    for (let k = 0; k < 3; k++)
      out.push(
        P.line(
          x0 + 4 * u + k * 9 * u,
          y + 1.2 * u + k * 1.1 * u,
          x0 + w - 6 * u - k * 7 * u,
          y + 1.5 * u + k * 1.2 * u,
          'h',
        ),
      );
  }
  // blocking behind, hidden
  out.push(P.rect(x0 + 6 * u, y0 + 5.75 * u + 1 * u, w - 12 * u, 3.5 * u, 'x'));
  // two double hooks 16" o.c.
  for (const hx of [b.cx - 8 * u, b.cx + 8 * u]) {
    const hy = y0 + 5.75 * u + 2.75 * u;
    out.push(P.rect(hx - 1.25 * u, hy - 2 * u, 2.5 * u, 4 * u, 'o'));
    out.push(P.circle(hx, hy - 1.2 * u, 0.3 * u, 's'));
    out.push(P.circle(hx, hy + 1.2 * u, 0.3 * u, 's'));
    out.push(
      P.path(
        `M${r(hx)} ${r(hy - 0.5 * u)}v${r(4.5 * u)}q0 ${r(2 * u)} ${r(2 * u)} ${r(2 * u)}q${r(1.6 * u)} 0 ${r(1.6 * u)} ${r(-1.6 * u)}`,
        'o',
      ),
    );
    out.push(
      P.path(
        `M${r(hx)} ${r(hy - 0.5 * u)}v${r(-2.5 * u)}q0 ${r(-1.6 * u)} ${r(1.2 * u)} ${r(-1.6 * u)}`,
        'o',
      ),
    );
  }
  // dims and notes
  out.push(
    dim(
      L,
      b.cx - 8 * u,
      y0 + 3 * 5.75 * u + 1.5 * u,
      b.cx + 8 * u,
      y0 + 3 * 5.75 * u + 1.5 * u,
      '16" O.C.',
      1.2 * u,
      { size: 18 },
    ),
  );
  out.push(
    note(
      L,
      x0 + 8 * u,
      y0 + 5.75 * u + 2.75 * u,
      x0 + 3 * u,
      y0 + 3 * 5.75 * u + 2.6 * u,
      '2×4 BLOCKING BEHIND',
      { side: 'right' },
    ),
  );
  out.push(
    note(
      L,
      b.cx + 8 * u + 1.25 * u,
      y0 + 5.75 * u + 1.5 * u,
      x0 + w - 2 * u,
      y0 + 3 * 5.75 * u + 2.6 * u,
      'DOUBLE HOOK, BRONZE',
      { side: 'left' },
    ),
  );
  out.push(
    note(L, x0 + 8 * u, y0 + 2.5 * u, x0 + 3 * u, y0 - 0.35 * u, '3/4" SHIPLAP, PAINTED', { side: 'right' }),
  );
  return out.join('');
};

// mudroom 03: base detail at the tile (landscape)
D['mudroom-lockers-murrysville/3'] = (L, b) => {
  const out = [];
  const u = b.h / 14; // 1 inch
  const floor = b.cy + 3 * u;
  const bx = b.cx - 9 * u;
  // subfloor, thinset, tile
  out.push(P.rect(b.x, floor + 0.5 * u, b.w, 0.75 * u, 's'));
  out.push(P.hatch(b.x, floor + 0.5 * u, b.w, 0.75 * u, 8));
  out.push(P.rect(b.x, floor + 0.2 * u, b.w, 0.3 * u, 's'));
  out.push(P.rect(b.x, floor - 0.4 * u, b.w, 0.6 * u, 'o'));
  out.push(
    `<rect class="f2" x="${r(b.x)}" y="${r(floor - 0.4 * u)}" width="${r(b.w)}" height="${r(0.6 * u)}"/>`,
  );
  for (let x = b.x + 6 * u; x < b.x + b.w; x += 12 * u)
    out.push(P.line(x, floor - 0.4 * u, x, floor + 0.2 * u, 's'));
  // bench base: toe kick + bottom + front, sitting 1/2" above the tile on a ledger cleat at the wall
  const wallX = bx + 14 * u;
  out.push(P.line(wallX, b.y, wallX, floor - 0.4 * u, 'o'));
  out.push(P.hatch(wallX, b.y, 0.5 * u, floor - 0.4 * u - b.y, 12));
  const baseY = floor - 0.4 * u - 0.5 * u;
  out.push(P.rect(bx, baseY - 0.75 * u, wallX - bx, 0.75 * u, 'o'));
  out.push(P.hatch(bx, baseY - 0.75 * u, wallX - bx, 0.75 * u, 7));
  out.push(P.rect(bx, baseY - 4.75 * u, 0.75 * u, 4 * u, 'o'));
  out.push(P.hatch(bx, baseY - 4.75 * u, 0.75 * u, 4 * u, 7));
  out.push(P.rect(bx + 0.75 * u, baseY - 4.75 * u, wallX - bx - 0.75 * u, 0.75 * u, 'o'));
  out.push(P.hatch(bx + 0.75 * u, baseY - 4.75 * u, wallX - bx - 0.75 * u, 0.75 * u, 7));
  out.push(P.rect(wallX - 1.5 * u, baseY - 4.75 * u, 1.5 * u, 4.75 * u, 's'));
  out.push(P.line(bx + 0.75 * u, baseY - 5.5 * u, bx + 0.75 * u, b.y + 1 * u, 'x'));
  out.push(P.line(bx, baseY - 4.75 * u, bx, b.y + 1 * u, 'o'));
  // dims and notes
  out.push(dim(L, bx - 2.2 * u, floor - 0.4 * u, bx - 2.2 * u, baseY, '1/2"', 1.4 * u, { size: 18 }));
  out.push(dim(L, bx - 2.2 * u, baseY, bx - 2.2 * u, baseY - 4.75 * u, '4"', 1.4 * u, { size: 18 }));
  out.push(
    note(L, bx + 6 * u, baseY + 0.25 * u, bx + 8 * u, floor + 2.3 * u, 'GAP CLEARS A WET MOP', {
      side: 'right',
    }),
  );
  out.push(
    note(L, wallX - 0.75 * u, baseY - 2.4 * u, wallX - 3 * u, b.y + 1.2 * u, 'LEDGER CLEAT AT WALL', {
      side: 'left',
    }),
  );
  out.push(
    note(L, b.x + 3 * u, floor - 0.1 * u, b.x + 2 * u, floor + 3.5 * u, 'TILE BY OTHERS', { side: 'right' }),
  );
  return out.join('');
};

// ---- The shop (about portrait) --------------------------------------------------------------------
D['portrait'] = (L, b) => {
  const out = [];
  const u = b.w / 80; // 1 inch
  // workbench: top, aprons, legs, shelf, vise, dog holes
  const bx = b.cx - 36 * u,
    bw = 72 * u,
    topY = b.y + b.h * 0.62,
    tT = 3.5 * u;
  out.push(P.rect(bx, topY, bw, tT, 'o'));
  out.push(`<rect class="f2" x="${r(bx)}" y="${r(topY)}" width="${r(bw)}" height="${r(tT)}"/>`);
  for (let x = bx + 8 * u; x < bx + bw - 6 * u; x += 4 * u)
    out.push(P.rect(x - 0.4 * u, topY + 0.2 * u, 0.8 * u, 0.8 * u, 's'));
  const legH = 30 * u;
  for (const lx of [bx + 4 * u, bx + bw - 8 * u]) {
    out.push(P.rect(lx, topY + tT, 4 * u, legH, 'o'));
    out.push(P.hatch(lx, topY + tT, 4 * u, legH, 9));
  }
  out.push(P.rect(bx + 8 * u, topY + tT + 2 * u, bw - 16 * u, 5 * u, 'o')); // stretcher/apron
  out.push(P.rect(bx + 8 * u, topY + tT + legH - 8 * u, bw - 16 * u, 1.5 * u, 's')); // shelf
  // front vise at the left: chop, two guide bars, screw handle
  out.push(P.rect(bx - 3 * u, topY - 0.5 * u, 3 * u, 9 * u, 'o'));
  out.push(P.hatch(bx - 3 * u, topY - 0.5 * u, 3 * u, 9 * u, 7));
  out.push(P.line(bx - 3 * u, topY + 6 * u, bx - 9 * u, topY + 6 * u, 'o'));
  out.push(P.line(bx - 9 * u, topY + 3 * u, bx - 9 * u, topY + 9 * u, 'o'));
  out.push(P.line(bx - 3 * u, topY + 2.5 * u, bx + 3 * u, topY + 2.5 * u, 'x'));
  out.push(P.line(bx - 3 * u, topY + 8 * u, bx + 3 * u, topY + 8 * u, 'x'));
  // floor
  const floor = topY + tT + legH;
  out.push(P.line(b.x, floor, b.x + b.w, floor, 'o'));
  out.push(P.hatch(b.x, floor, b.w, 1.5 * u, 14));
  // tool wall above: a french cleat line, a hand plane, four chisels, a square, a mallet
  const cleatY = b.y + 6 * u;
  out.push(P.line(bx, cleatY, bx + bw, cleatY, 's'));
  out.push(P.line(bx, cleatY + 1.5 * u, bx + bw, cleatY + 1.5 * u, 'h'));
  // hand plane (side view) hanging left
  const px = bx + 2 * u,
    py = cleatY + 6 * u,
    pl = 22 * u,
    ph = 3 * u;
  out.push(
    P.path(
      `M${r(px)} ${r(py + ph + 4 * u)}H${r(px + pl)}V${r(py + ph)}q0 ${r(-1.5 * u)} ${r(-2 * u)} ${r(-1.5 * u)}H${r(px + 2 * u)}q${r(-2 * u)} 0 ${r(-2 * u)} ${r(1.5 * u)}Z`,
      'o',
    ),
  );
  out.push(
    `<path class="f" d="M${r(px)} ${r(py + ph + 4 * u)}H${r(px + pl)}V${r(py + ph)}q0 ${r(-1.5 * u)} ${r(-2 * u)} ${r(-1.5 * u)}H${r(px + 2 * u)}q${r(-2 * u)} 0 ${r(-2 * u)} ${r(1.5 * u)}Z"/>`,
  );
  out.push(P.circle(px + 3.5 * u, py + 0.2 * u, 1.6 * u, 'o')); // knob
  out.push(
    P.path(
      `M${r(px + 15 * u)} ${r(py + ph)}q${r(-1 * u)} ${r(-6 * u)} ${r(3 * u)} ${r(-6.5 * u)}q${r(2.5 * u)} 0 ${r(1.5 * u)} ${r(6.5 * u)}`,
      'o',
    ),
  ); // tote
  out.push(P.line(px + 9 * u, py + ph + 4 * u, px + 12 * u, py - 3 * u, 'o')); // iron
  out.push(P.line(px + 9.6 * u, py + ph + 4 * u, px + 12.6 * u, py - 3 * u, 's'));
  out.push(P.rect(px + 10.2 * u, py - 1.2 * u, 2.4 * u, 1.6 * u, 's')); // lever cap
  // chisels, handles up
  for (let i = 0; i < 4; i++) {
    const cx = bx + 34 * u + i * 6 * u,
      w = 1.6 * u + i * 0.5 * u;
    out.push(
      P.path(
        `M${r(cx - 1.4 * u)} ${r(cleatY + 3 * u)}v${r(6 * u)}q0 ${r(1.2 * u)} ${r(1.4 * u)} ${r(1.2 * u)}q${r(1.4 * u)} 0 ${r(1.4 * u)} ${r(-1.2 * u)}v${r(-6 * u)}q0 ${r(-1.5 * u)} ${r(-1.4 * u)} ${r(-1.5 * u)}q${r(-1.4 * u)} 0 ${r(-1.4 * u)} ${r(1.5 * u)}Z`,
        'o',
      ),
    );
    out.push(P.rect(cx - 0.5 * u, cleatY + 10.2 * u, 1 * u, 2.5 * u, 's')); // ferrule/neck
    out.push(
      P.poly(
        [
          [cx - w / 2, cleatY + 12.7 * u],
          [cx + w / 2, cleatY + 12.7 * u],
          [cx + w / 2, cleatY + 12.7 * u + 9 * u],
          [cx - w / 2, cleatY + 12.7 * u + 9 * u],
        ],
        'o',
        true,
      ),
    );
    out.push(P.line(cx - w / 2, cleatY + 12.7 * u + 8.2 * u, cx + w / 2, cleatY + 12.7 * u + 9 * u, 's'));
  }
  // framing square
  const sx = bx + 60 * u,
    sy = cleatY + 3.5 * u;
  out.push(
    P.poly(
      [
        [sx, sy],
        [sx + 12 * u, sy],
        [sx + 12 * u, sy + 1.6 * u],
        [sx + 1.6 * u, sy + 1.6 * u],
        [sx + 1.6 * u, sy + 18 * u],
        [sx, sy + 18 * u],
      ],
      'o',
      true,
    ),
  );
  for (let k = 1; k < 10; k++)
    out.push(
      P.line(sx + 1.6 * u + k * 1.1 * u, sy, sx + 1.6 * u + k * 1.1 * u, sy + (k % 2 ? 0.5 : 0.8) * u, 'h'),
    );
  for (let k = 1; k < 15; k++)
    out.push(
      P.line(sx, sy + 1.6 * u + k * 1.1 * u, sx + (k % 2 ? 0.5 : 0.8) * u, sy + 1.6 * u + k * 1.1 * u, 'h'),
    );
  // mallet
  const mx = bx + 62 * u,
    my = cleatY + 26 * u;
  out.push(P.rect(mx, my, 10 * u, 4.5 * u, 'o'));
  out.push(P.hatch(mx, my, 10 * u, 4.5 * u, 9));
  out.push(P.rect(mx + 4.4 * u, my + 4.5 * u, 1.2 * u, 12 * u, 'o'));
  // a few notes
  out.push(note(L, bx + 20 * u, topY + tT / 2, bx + 24 * u, topY - 6 * u, 'MAPLE TOP, 3-1/2"'));
  out.push(note(L, bx - 1.5 * u, topY + 4 * u, bx - 6 * u, topY + 14 * u, 'FRONT VISE', { side: 'right' }));
  out.push(
    note(L, px + 11 * u, py + ph + 2 * u, px + 6 * u, py + ph + 12 * u, 'NO. 4 SMOOTHER', { side: 'right' }),
  );
  out.push(
    note(L, bx + 46 * u, cleatY + 18 * u, bx + 40 * u, cleatY + 28 * u, 'BENCH CHISELS', { side: 'right' }),
  );
  return out.join('');
};

export { sheet, D, SIZES, P, dim, note, hash, mulberry32 };

/* ------------------------------------------------------------------ */
/* Projects                                                            */
/* ------------------------------------------------------------------ */
const PROJECTS = {
  'cedar-deck-ligonier': {
    title: 'Cedar Deck and Stairs',
    location: 'Ligonier, PA',
    scale: '1/4" = 1\'-0"',
    cover: ['landscape', 'Plan'],
    gallery: [
      ['landscape', 'Decking detail'],
      ['portrait', 'Railing elevation'],
      ['landscape', 'Stair section'],
    ],
  },
  'fireplace-built-ins-greensburg': {
    title: 'Fireplace Built-ins',
    location: 'Greensburg, PA',
    scale: '1/2" = 1\'-0"',
    cover: ['portrait', 'Elevation'],
    gallery: [
      ['landscape', 'Crown section'],
      ['portrait', 'Shelf detail'],
      ['landscape', 'Door elevation'],
    ],
  },
  'kitchen-remodel-latrobe': {
    title: 'Kitchen Remodel and Trim',
    location: 'Latrobe, PA',
    scale: '1/2" = 1\'-0"',
    cover: ['square', 'Elevation'],
    gallery: [
      ['landscape', 'Header framing'],
      ['landscape', 'Crown section'],
      ['portrait', 'Window casing'],
    ],
  },
  'oak-stair-rebuild-irwin': {
    title: 'Oak Stair Rebuild',
    location: 'Irwin, PA',
    scale: '3/4" = 1\'-0"',
    cover: ['wide', 'Section'],
    gallery: [
      ['portrait', 'Nosing detail'],
      ['landscape', 'Newel joint'],
      ['landscape', 'Baluster spacing'],
    ],
  },
  'farmhouse-porch-mount-pleasant': {
    title: 'Farmhouse Porch Restoration',
    location: 'Mount Pleasant, PA',
    scale: '1/4" = 1\'-0"',
    cover: ['photo', 'Elevation'],
    gallery: [
      ['landscape', 'Joist repair'],
      ['portrait', 'Column'],
      ['landscape', 'Ceiling plan'],
    ],
  },
  'mudroom-lockers-murrysville': {
    title: 'Mudroom Bench and Lockers',
    location: 'Murrysville, PA',
    scale: '1/2" = 1\'-0"',
    cover: ['landscape', 'Elevation'],
    gallery: [
      ['portrait', 'Seat section'],
      ['landscape', 'Hook detail'],
      ['landscape', 'Base detail'],
    ],
  },
};
const PORTRAIT = {
  title: 'The Shop',
  location: 'Greensburg, PA',
  drawing: 'Tool wall',
  scale: '1" = 1\'-0"',
  sheet: '1 / 1',
  alt: "Drawing of Jordan's workbench and tool wall: a hand plane, four chisels, a framing square and a mallet",
};

function write(path, content) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
  console.log('wrote', path, `${(content.length / 1024).toFixed(1)}kB`);
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop())) {
  for (const [slug, p] of Object.entries(PROJECTS)) {
    const total = p.gallery.length + 1;
    const key = `${slug}/cover`;
    if (D[key]) {
      write(
        join(OUT, slug, 'cover.svg'),
        sheet(
          key,
          SIZES[p.cover[0]],
          {
            title: p.title,
            location: p.location,
            drawing: p.cover[1],
            scale: p.scale,
            sheet: `1 / ${total}`,
            alt: `${p.title}: ${p.cover[1].toLowerCase()} drawing`,
          },
          D[key],
        ),
      );
    }
    p.gallery.forEach(([orient, drawing], i) => {
      const k = `${slug}/${i + 1}`;
      if (!D[k]) return;
      write(
        join(OUT, slug, `0${i + 1}.svg`),
        sheet(
          k,
          SIZES[orient],
          {
            title: p.title,
            location: p.location,
            drawing,
            scale: p.scale,
            sheet: `${i + 2} / ${total}`,
            alt: `${p.title}: ${drawing.toLowerCase()} drawing`,
          },
          D[k],
        ),
      );
    });
  }
  write('src/assets/portrait.svg', sheet('portrait', SIZES.about, PORTRAIT, D['portrait']));
}
