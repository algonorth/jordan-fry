/**
 * Turns the headline's glyphs into particle targets: the name is rasterised at the canvas's own
 * device resolution and every inked pixel becomes one mote, with the pixel's coverage as the
 * mote's alpha, so the settled dust reproduces the type pixel for pixel. When the glyphs hold more
 * pixels than the tier allows, cells of two or more device pixels are used instead.
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
  /** device px per cell: 1 is one mote per device pixel */
  pitch: number;
  /** count × (x, y): cell centres in device px from the name box's top-left corner */
  xy: Float32Array;
  /** count × coverage 0..1 */
  cover: Float32Array;
  /** indices of cells whose whole 3×3 neighbourhood is inked (safe places to probe a pixel) */
  interior: Uint32Array;
  /** normalised line geometry and the pitch, used to detect when a re-sample is needed */
  signature: number[];
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

const PROBE_PX = 200;

/** Resolves once the headline font renders on a canvas (Safari can resolve fonts.load() early). */
export async function waitForFont(font: NameFont, timeoutMs = 3000): Promise<boolean> {
  const primary = primaryFamily(font.family);
  const spec = `${font.weight} ${PROBE_PX}px "${primary}"`;
  try {
    await document.fonts.load(spec, 'Jordan Fry');
  } catch {
    /* fall through to the probe */
  }
  const ctx = document.createElement('canvas').getContext('2d');
  if (!ctx) return false;
  const probe = (family: string) => {
    ctx.font = `${font.weight} ${PROBE_PX}px ${family}`;
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

const EMPTY: TargetSet = {
  count: 0,
  pitch: 1,
  xy: new Float32Array(0),
  cover: new Float32Array(0),
  interior: new Uint32Array(0),
  signature: [],
};

/**
 * Samples the name at `dpr` device pixels per CSS pixel, one mote per `pitch` device pixels,
 * choosing the smallest pitch whose mote count fits `cap`.
 */
export function sampleText(nb: NameBox, o: { dpr: number; cap: number }): TargetSet {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return EMPTY;
  let set = rasterise(ctx, canvas, nb, o.dpr, 1);
  if (set.count > o.cap) {
    let pitch = Math.max(2, Math.ceil(Math.sqrt(set.count / o.cap)));
    set = rasterise(ctx, canvas, nb, o.dpr, pitch);
    while (set.count > o.cap && pitch < 6) set = rasterise(ctx, canvas, nb, o.dpr, ++pitch);
  }
  return set;
}

function rasterise(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  nb: NameBox,
  dpr: number,
  pitch: number,
): TargetSet {
  const scale = dpr / pitch; // canvas px per CSS px
  const xy: number[] = [];
  const cover: number[] = [];
  const interior: number[] = [];
  const signature: number[] = [pitch];
  const pad = 16;
  const setFont = () => {
    ctx.font = `${nb.font.weight} ${nb.font.fontSizePx * scale}px ${nb.font.family}`;
    if ('letterSpacing' in ctx)
      (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing =
        `${nb.font.letterSpacingPx * scale}px`;
  };
  for (const line of nb.lines) {
    const text = applyTransform(line.text, nb.font.transform);
    if (!text) continue;
    const r = line.rect;
    setFont();
    const m = ctx.measureText(text);
    const asc = m.fontBoundingBoxAscent || nb.font.fontSizePx * scale * 0.8;
    const desc = m.fontBoundingBoxDescent || nb.font.fontSizePx * scale * 0.2;
    const boxH = r.height * scale;
    canvas.width = Math.ceil(Math.max(m.width, r.width * scale)) + pad * 2;
    canvas.height = Math.ceil(Math.max(boxH, asc + desc)) + pad * 2;
    setFont(); // resizing the canvas resets its state
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#fff';
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // The baseline sits where the browser puts it in a line box: half the leading, then the ascent.
    ctx.fillText(text, pad, pad + (boxH - (asc + desc)) / 2 + asc);
    const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    // The line's origin in device px from the name box corner, on the device pixel grid.
    const ox = Math.round((r.left - nb.left) * dpr);
    const oy = Math.round((r.top - nb.top) * dpr);
    signature.push(
      (r.left - nb.left) / nb.width,
      (r.top - nb.top) / nb.height,
      r.width / nb.width,
      r.height / nb.height,
    );
    const alpha = (x: number, y: number) => data[(y * width + x) * 4 + 3] ?? 0;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const a = alpha(x, y);
        if (a < 6) continue;
        if (a >= 250 && x > 0 && y > 0 && x < width - 1 && y < height - 1) {
          let full = true;
          for (let j = -1; j <= 1 && full; j++)
            for (let i = -1; i <= 1; i++)
              if (alpha(x + i, y + j) < 250) {
                full = false;
                break;
              }
          if (full) interior.push(xy.length / 2);
        }
        xy.push(ox + (x - pad) * pitch + pitch / 2, oy + (y - pad) * pitch + pitch / 2);
        cover.push(a / 255);
      }
    }
  }
  return {
    count: xy.length / 2,
    pitch,
    xy: Float32Array.from(xy),
    cover: Float32Array.from(cover),
    interior: Uint32Array.from(interior),
    signature,
  };
}
