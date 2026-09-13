/**
 * Generates deterministic wood-grain SVG placeholders at the exact sizes the layout expects,
 * so the grid is real before photos exist and swapping a JPEG in later is drop-in.
 * Run: npm run placeholders
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const OUT = 'src/content/work';
const SIZES = { landscape: [1600, 1200], portrait: [1200, 1600], about: [1200, 1500] };

/** slug → cover orientation + gallery orientations (matches each index.md). */
const PROJECTS = {
  'cedar-deck-ligonier': ['landscape', ['landscape', 'portrait', 'landscape']],
  'fireplace-built-ins-greensburg': ['portrait', ['landscape', 'portrait', 'landscape']],
  'kitchen-remodel-latrobe': ['landscape', ['landscape', 'landscape', 'portrait']],
  'oak-stair-rebuild-irwin': ['portrait', ['portrait', 'landscape', 'landscape']],
  'farmhouse-porch-mount-pleasant': ['landscape', ['landscape', 'portrait', 'landscape']],
  'mudroom-lockers-murrysville': ['landscape', ['portrait', 'landscape', 'landscape']],
};

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

function svg(name, [w, h]) {
  const seed = hash(name);
  const rnd = mulberry32(seed);
  const angle = 10 + rnd() * 25;
  const stripes = [];
  const n = 70 + Math.floor(rnd() * 40);
  for (let i = 0; i < n; i++) {
    const y = rnd() * h;
    const sh = 2 + rnd() * 14;
    const light = rnd() > 0.5;
    const op = (0.12 + rnd() * 0.3).toFixed(2);
    stripes.push(
      `<rect y="${y.toFixed(0)}" width="${w}" height="${sh.toFixed(0)}" fill="${light ? '#A87A50' : '#2C1A0E'}" opacity="${op}"/>`,
    );
  }
  const knots = [];
  const kn = rnd() > 0.6 ? 1 + Math.floor(rnd() * 2) : 0;
  for (let i = 0; i < kn; i++) {
    const cx = (0.15 + rnd() * 0.7) * w,
      cy = (0.15 + rnd() * 0.7) * h,
      r = 30 + rnd() * 60;
    knots.push(
      `<ellipse cx="${cx.toFixed(0)}" cy="${cy.toFixed(0)}" rx="${(r * 1.6).toFixed(0)}" ry="${r.toFixed(0)}" fill="none" stroke="#2C1A0E" stroke-width="${(2 + rnd() * 3).toFixed(1)}" opacity="0.35"/>`,
    );
  }
  const vx = (0.2 + rnd() * 0.5).toFixed(2),
    vy = (0.1 + rnd() * 0.4).toFixed(2);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="Placeholder">
<defs>
<linearGradient id="g" gradientTransform="rotate(${angle.toFixed(0)})"><stop offset="0" stop-color="#4A3320"/><stop offset="1" stop-color="#8B5A2B"/></linearGradient>
<filter id="f" x="-5%" y="-10%" width="110%" height="120%"><feTurbulence type="fractalNoise" baseFrequency="0.004 0.08" numOctaves="3" seed="${seed % 1000}" result="t"/><feDisplacementMap in="SourceGraphic" in2="t" scale="42" xChannelSelector="R" yChannelSelector="G"/></filter>
<radialGradient id="v" cx="${vx}" cy="${vy}" r="1"><stop offset="0" stop-color="#E9A23B" stop-opacity="0.16"/><stop offset="0.55" stop-color="#0F0D0B" stop-opacity="0.1"/><stop offset="1" stop-color="#0F0D0B" stop-opacity="0.6"/></radialGradient>
</defs>
<rect width="${w}" height="${h}" fill="url(#g)"/>
<g filter="url(#f)">${stripes.join('')}${knots.join('')}</g>
<rect width="${w}" height="${h}" fill="url(#v)"/>
</svg>
`;
}

function write(path, content) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
  console.log('wrote', path);
}

for (const [slug, [cover, gallery]] of Object.entries(PROJECTS)) {
  write(join(OUT, slug, 'cover.svg'), svg(`${slug}/cover`, SIZES[cover]));
  gallery.forEach((o, i) => write(join(OUT, slug, `0${i + 1}.svg`), svg(`${slug}/${i + 1}`, SIZES[o])));
}
write('src/assets/portrait.svg', svg('portrait', SIZES.about));
