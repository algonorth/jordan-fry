/**
 * Turns the headline's glyphs into particle targets. Sampling happens at a fixed font size on
 * a detached 2D canvas (device independent); results are normalised to the measured DOM line
 * boxes so the particles overlay the real <h1> at any viewport size without re-sampling.
 */
export interface LineMeasure {
  text: string;
  rect: DOMRect;
}

export interface NameFont {
  family: string;
  weight: string;
  letterSpacingPx: number;
  fontSizePx: number;
  transform: string;
}

export interface NameBox {
  left: number;
  top: number;
  docTop: number;
  width: number;
  height: number;
  lines: LineMeasure[];
  font: NameFont;
}

export interface TargetSet {
  count: number;
  /** count × (u, v) normalised to the name box */
  uv: Float32Array;
  /** normalised line geometry, used to detect when a re-sample is needed */
  signature: number[];
}

export interface AssignedTargets {
  target: Float32Array;
  hasTarget: Float32Array;
  assigned: number;
}

const SAMPLE_PX = 200;

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function applyTransform(text: string, transform: string): string {
  if (transform === 'uppercase') return text.toUpperCase();
  if (transform === 'lowercase') return text.toLowerCase();
  if (transform === 'capitalize') return text.replace(/\b\w/g, (c) => c.toUpperCase());
  return text;
}

export function measureNameBox(nameEl: HTMLElement, lineSelector = ':scope > span'): NameBox {
  const spans = Array.from(nameEl.querySelectorAll<HTMLElement>(lineSelector));
  const els = spans.length ? spans : [nameEl];
  const cs = getComputedStyle(els[0]!);
  const lines: LineMeasure[] = els.map((el) => {
    const range = document.createRange();
    range.selectNodeContents(el);
    return { text: el.textContent?.trim() ?? '', rect: range.getBoundingClientRect() };
  });
  const left = Math.min(...lines.map((l) => l.rect.left));
  const top = Math.min(...lines.map((l) => l.rect.top));
  const right = Math.max(...lines.map((l) => l.rect.right));
  const bottom = Math.max(...lines.map((l) => l.rect.bottom));
  const ls = parseFloat(cs.letterSpacing);
  return {
    left,
    top,
    docTop: top + window.scrollY,
    width: Math.max(1, right - left),
    height: Math.max(1, bottom - top),
    lines,
    font: {
      family: cs.fontFamily,
      weight: cs.fontWeight,
      letterSpacingPx: Number.isFinite(ls) ? ls : 0,
      fontSizePx: parseFloat(cs.fontSize) || 16,
      transform: cs.textTransform,
    },
  };
}

function primaryFamily(family: string): string {
  const first = family.split(',')[0]?.trim() ?? family;
  return first.replace(/^["']|["']$/g, '');
}

/** Resolves once the headline font renders on a canvas (Safari can resolve fonts.load() early). */
export async function waitForFont(font: NameFont, timeoutMs = 3000): Promise<boolean> {
  const primary = primaryFamily(font.family);
  const spec = `${font.weight} ${SAMPLE_PX}px "${primary}"`;
  try {
    await document.fonts.load(spec, 'Jordan Fry');
  } catch {
    /* fall through to the probe */
  }
  const ctx = document.createElement('canvas').getContext('2d');
  if (!ctx) return false;
  const probe = (family: string) => {
    ctx.font = `${font.weight} ${SAMPLE_PX}px ${family}`;
    return ctx.measureText('Jordan Fry').width;
  };
  const fallback = probe('monospace');
  const started = performance.now();
  while (performance.now() - started < timeoutMs) {
    if (probe(`"${primary}", monospace`) !== fallback) return true;
    await new Promise((r) => setTimeout(r, 60));
  }
  return false;
}

export function sampleText(nb: NameBox, opts: { alphaThreshold?: number; seed?: number } = {}): TargetSet {
  const threshold = opts.alphaThreshold ?? 128;
  const rnd = mulberry32(opts.seed ?? 7);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const out: number[] = [];
  const signature: number[] = [];
  if (!ctx) return { count: 0, uv: new Float32Array(0), signature };

  const scale = SAMPLE_PX / nb.font.fontSizePx;
  for (const line of nb.lines) {
    const text = applyTransform(line.text, nb.font.transform);
    if (!text) continue;
    const pad = 24;
    ctx.font = `${nb.font.weight} ${SAMPLE_PX}px ${nb.font.family}`;
    if ('letterSpacing' in ctx)
      (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing =
        `${nb.font.letterSpacingPx * scale}px`;
    const m = ctx.measureText(text);
    const asc = m.fontBoundingBoxAscent || SAMPLE_PX * 0.8;
    const desc = m.fontBoundingBoxDescent || SAMPLE_PX * 0.2;
    const W = Math.max(1, m.width);
    const H = asc + desc;
    canvas.width = Math.ceil(W + pad * 2);
    canvas.height = Math.ceil(H + pad * 2);
    ctx.font = `${nb.font.weight} ${SAMPLE_PX}px ${nb.font.family}`;
    if ('letterSpacing' in ctx)
      (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing =
        `${nb.font.letterSpacingPx * scale}px`;
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#fff';
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillText(text, pad, pad + asc);
    const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);

    // Map the canvas line box onto the DOM line rect, then into name-box space.
    const r = line.rect;
    const sx = r.width / W;
    const sy = r.height / H;
    signature.push(
      (r.left - nb.left) / nb.width,
      (r.top - nb.top) / nb.height,
      r.width / nb.width,
      r.height / nb.height,
    );
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if ((data[(y * width + x) * 4 + 3] ?? 0) <= threshold) continue;
        const lx = (x - pad + rnd() - 0.5) * sx;
        const ly = (y - pad + rnd() - 0.5) * sy;
        out.push((r.left + lx - nb.left) / nb.width, (r.top + ly - nb.top) / nb.height);
      }
    }
  }
  return { count: out.length / 2, uv: Float32Array.from(out), signature };
}

/**
 * Deterministically maps sampled points onto particles. Name particles are interleaved with
 * ambient ones (7 of every 10) so any draw-range prefix keeps the same mix.
 */
export function assignTargets(
  set: TargetSet,
  particleCount: number,
  nameFraction: number,
  seed: number,
): AssignedTargets {
  const target = new Float32Array(particleCount * 3);
  const hasTarget = new Float32Array(particleCount);
  const rnd = mulberry32(seed);
  const perm = new Uint32Array(set.count);
  for (let i = 0; i < set.count; i++) perm[i] = i;
  for (let i = set.count - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    const t = perm[i]!;
    perm[i] = perm[j]!;
    perm[j] = t;
  }
  const per10 = Math.round(nameFraction * 10);
  let k = 0;
  let assigned = 0;
  for (let i = 0; i < particleCount; i++) {
    const isName = i % 10 < per10;
    if (isName && k < set.count) {
      const s = perm[k++]!;
      target[i * 3] = set.uv[s * 2]!;
      target[i * 3 + 1] = set.uv[s * 2 + 1]!;
      target[i * 3 + 2] = rnd();
      hasTarget[i] = 1;
      assigned++;
    } else {
      target[i * 3 + 2] = rnd();
      hasTarget[i] = 0;
    }
  }
  return { target, hasTarget, assigned };
}
