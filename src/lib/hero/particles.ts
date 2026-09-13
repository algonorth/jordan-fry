import {
  AdditiveBlending,
  type Blending,
  BufferAttribute,
  BufferGeometry,
  Color,
  NormalBlending,
  Points,
  ShaderMaterial,
  Vector2,
  Vector4,
} from 'three';
import type { TierConfig } from './quality';
import type { TargetSet } from './sampleText';
import snoise from './shaders/snoise.glsl?raw';
import vert from './shaders/particles.vert.glsl?raw';
import frag from './shaders/particles.frag.glsl?raw';

export interface Palette {
  ember: string;
  amber: string;
  white: string;
  /** the headline's text color: what a settled name mote is */
  linen: string;
}

export type HeroUniforms = {
  uTime: { value: number };
  uField: { value: Vector2 };
  uShaftDir: { value: Vector2 };
  uNameOrigin: { value: Vector2 };
  uNameSize: { value: Vector2 };
  uPitch: { value: number };
  uMorph: { value: number };
  uSettle: { value: number };
  uDissolve: { value: number };
  uAmbient: { value: number };
  uAmbientKeep: { value: number };
  uPointer: { value: Vector4 };
  uPointerVel: { value: Vector2 };
  uTrail: { value: Float32Array };
  uBurst: { value: Float32Array };
  uBurstAge: { value: Float32Array };
  uFocalDepth: { value: number };
  uPixelRatio: { value: number };
  uMaxPointSize: { value: number };
  uSizeScale: { value: number };
  uGlobalAlpha: { value: number };
  uNameDustAlpha: { value: number };
  uNameDustScale: { value: number };
  uEmber: { value: Color };
  uAmber: { value: Color };
  uWhite: { value: Color };
  uLinen: { value: Color };
};

/** Taps kept in flight at once; a fourth tap recycles the oldest gust. */
export const BURST_N = 3;
/** Spare grains parked on random pixels of the name that lift off while idle. */
export const SHED = 400;

export interface ParticleSystem {
  /** the light shaft's dust, drawn additively */
  ambient: Points;
  /** the name, one mote per pixel, drawn with normal blending over the dust */
  name: Points;
  uniforms: HeroUniforms;
  /** motes drawn per frame: name pixels, idle grains and ambient dust */
  readonly motes: number;
  setTargets(set: TargetSet): void;
  setAmbientCount(n: number): void;
  dispose(): void;
}

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createParticles(
  cfg: TierConfig,
  seed: number,
  palette: Palette,
  maxPointSize: number,
): ParticleSystem {
  const rnd = mulberry32(seed);

  // Rest positions: 70% along a tilted light shaft (normalised field coords, 8% overscan), 30% scattered.
  const ax = 0.2,
    ay = -0.1,
    bx = 0.65,
    by = 1.1;
  const dx = bx - ax,
    dy = by - ay;
  const len = Math.hypot(dx, dy);
  const px = -dy / len,
    py = dx / len;

  const build = (count: number, isName: boolean) => {
    const position = new Float32Array(count * 3);
    const seeds = new Float32Array(count * 4);
    const sizes = new Float32Array(count);
    const warmth = new Float32Array(count);
    const target = new Float32Array(count * 3);
    const hasTarget = new Float32Array(count);
    const cover = new Float32Array(count);
    const shed = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      let x: number, y: number;
      if (rnd() < 0.7) {
        const s = rnd();
        const g = (rnd() + rnd() + rnd() - 1.5) * 0.32; // ≈ normal, σ 0.16
        x = ax + dx * s + px * g;
        y = ay + dy * s + py * g;
      } else {
        x = -0.08 + rnd() * 1.16;
        y = -0.08 + rnd() * 1.16;
      }
      position[i * 3] = x;
      position[i * 3 + 1] = y;
      position[i * 3 + 2] = Math.pow(rnd(), 0.7);
      seeds[i * 4] = rnd();
      seeds[i * 4 + 1] = rnd();
      seeds[i * 4 + 2] = rnd();
      seeds[i * 4 + 3] = rnd();
      const r = rnd();
      sizes[i] = 1.6 + 1.6 * r * r;
      const w = rnd();
      warmth[i] = w * w;
      target[i * 3 + 2] = rnd(); // brightness jitter
      hasTarget[i] = isName ? 1 : 0;
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(position, 3));
    geometry.setAttribute('aTarget', new BufferAttribute(target, 3));
    geometry.setAttribute('aSeed', new BufferAttribute(seeds, 4));
    geometry.setAttribute('aSize', new BufferAttribute(sizes, 1));
    geometry.setAttribute('aWarmth', new BufferAttribute(warmth, 1));
    geometry.setAttribute('aHasTarget', new BufferAttribute(hasTarget, 1));
    geometry.setAttribute('aCover', new BufferAttribute(cover, 1));
    geometry.setAttribute('aShed', new BufferAttribute(shed, 1));
    return { geometry, target, cover, shed };
  };
  const ambientGeo = build(cfg.ambient, false);
  const nameGeo = build(cfg.nameCap + SHED, true);
  nameGeo.geometry.setDrawRange(0, 0);
  let ambientCount = cfg.ambient;
  let nameCount = 0;

  const uniforms: HeroUniforms = {
    uTime: { value: 0 },
    uField: { value: new Vector2(1, 1) },
    uShaftDir: { value: new Vector2(0.28, 0.96) },
    uNameOrigin: { value: new Vector2(0, 0) },
    uNameSize: { value: new Vector2(1, 1) },
    uPitch: { value: 1 },
    uMorph: { value: 0 },
    uSettle: { value: 0 },
    uDissolve: { value: 0 },
    uAmbient: { value: 0.35 },
    uAmbientKeep: { value: 0.45 },
    uPointer: { value: new Vector4(-99999, -99999, 0, 80) },
    uPointerVel: { value: new Vector2() },
    uTrail: { value: new Float32Array(cfg.trailCount * 4) },
    uBurst: { value: new Float32Array(BURST_N * 4) },
    uBurstAge: { value: new Float32Array(BURST_N).fill(-1) },
    uFocalDepth: { value: 0.15 },
    uPixelRatio: { value: 1 },
    uMaxPointSize: { value: maxPointSize },
    uSizeScale: { value: cfg.sizeScale },
    uGlobalAlpha: { value: 1 },
    uNameDustAlpha: { value: 1 },
    uNameDustScale: { value: 1 },
    uEmber: { value: new Color(palette.ember) },
    uAmber: { value: new Color(palette.amber) },
    uWhite: { value: new Color(palette.white) },
    uLinen: { value: new Color(palette.linen) },
  };

  // Constant indices only: Adreno's compiler refuses dynamically indexed uniform arrays.
  const trail = Array.from(
    { length: cfg.trailCount },
    (_, i) =>
      `disp += puff(p, uTrail[${i}], vec2(1.0, 0.0), 1.0);\n` +
      `  wake = max(wake, min(1.0, inside(tgt, uTrail[${i}]) * 1.4));`,
  ).join('\n  ');
  const bursts = Array.from(
    { length: BURST_N },
    (_, i) => `gusts += gust(p, uBurst[${i}], uBurstAge[${i}], aSeed, swirl);`,
  ).join('\n  ');
  const vertexShader = `${snoise}\n${vert.replace('TRAIL_UNROLLED', trail).replace('BURST_UNROLLED', bursts)}`;
  const material = (blending: Blending) =>
    new ShaderMaterial({
      vertexShader,
      fragmentShader: frag,
      uniforms,
      defines: { TRAIL_N: cfg.trailCount, BURST_N },
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending,
      premultipliedAlpha: true,
    });

  // The dust glows where it overlaps (additive); the name's pixels do not (normal), so a pixel
  // over a pixel is still that pixel. The name is drawn after the dust.
  const ambient = new Points(ambientGeo.geometry, material(AdditiveBlending));
  const name = new Points(nameGeo.geometry, material(NormalBlending));
  for (const p of [ambient, name]) {
    p.frustumCulled = false;
    p.matrixAutoUpdate = false;
  }
  ambient.renderOrder = 0;
  name.renderOrder = 1;

  const pick = mulberry32(seed + 1);
  return {
    ambient,
    name,
    uniforms,
    get motes() {
      return nameCount + (nameCount ? SHED : 0) + ambientCount;
    },
    setTargets(set) {
      const n = Math.min(set.count, cfg.nameCap);
      const { target, cover, shed } = nameGeo;
      for (let i = 0; i < n; i++) {
        target[i * 3] = set.xy[i * 2]!;
        target[i * 3 + 1] = set.xy[i * 2 + 1]!;
        cover[i] = set.cover[i]!;
        shed[i] = 0;
      }
      // The idle grains sit on random pixels of the name (a pixel over a pixel is still that pixel).
      for (let j = 0; j < SHED; j++) {
        const i = n + j;
        const k = n ? Math.floor(pick() * n) : 0;
        target[i * 3] = set.xy[k * 2] ?? 0;
        target[i * 3 + 1] = set.xy[k * 2 + 1] ?? 0;
        cover[i] = 1;
        shed[i] = 1;
      }
      nameCount = n;
      nameGeo.geometry.setDrawRange(0, n ? n + SHED : 0);
      for (const key of ['aTarget', 'aCover', 'aShed']) {
        (nameGeo.geometry.getAttribute(key) as BufferAttribute).needsUpdate = true;
      }
      uniforms.uPitch.value = set.pitch;
      // The more motes the name takes, the fainter and smaller each is while it is still dust, so
      // the cloud that forms the name looks the same at any resolution.
      uniforms.uNameDustAlpha.value = Math.min(1, Math.max(0.22, 24_000 / Math.max(1, n)));
      uniforms.uNameDustScale.value = Math.min(1, Math.max(0.5, Math.sqrt(40_000 / Math.max(1, n))));
    },
    setAmbientCount(count) {
      ambientCount = Math.max(0, Math.min(cfg.ambient, Math.floor(count)));
      ambientGeo.geometry.setDrawRange(0, ambientCount);
    },
    dispose() {
      ambientGeo.geometry.dispose();
      nameGeo.geometry.dispose();
      (ambient.material as ShaderMaterial).dispose();
      (name.material as ShaderMaterial).dispose();
    },
  };
}
