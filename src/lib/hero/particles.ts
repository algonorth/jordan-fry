import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  Points,
  ShaderMaterial,
  Vector2,
  Vector4,
} from 'three';
import type { TierConfig } from './quality';
import type { AssignedTargets } from './sampleText';
import snoise from './shaders/snoise.glsl?raw';
import vert from './shaders/particles.vert.glsl?raw';
import frag from './shaders/particles.frag.glsl?raw';

export interface Palette {
  ember: string;
  amber: string;
  white: string;
}

export type HeroUniforms = {
  uTime: { value: number };
  uField: { value: Vector2 };
  uShaftDir: { value: Vector2 };
  uNameBox: { value: Vector4 };
  uMorph: { value: number };
  uSettle: { value: number };
  uDissolve: { value: number };
  uAmbient: { value: number };
  uAmbientKeep: { value: number };
  uPointer: { value: Vector4 };
  uPointerVel: { value: Vector2 };
  uTrail: { value: Float32Array };
  uFocalDepth: { value: number };
  uPixelRatio: { value: number };
  uMaxPointSize: { value: number };
  uSizeScale: { value: number };
  uGlobalAlpha: { value: number };
  uEmber: { value: Color };
  uAmber: { value: Color };
  uWhite: { value: Color };
};

export interface ParticleSystem {
  points: Points;
  geometry: BufferGeometry;
  material: ShaderMaterial;
  uniforms: HeroUniforms;
  count: number;
  setTargets(t: AssignedTargets): void;
  setDrawCount(n: number): void;
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
  const count = cfg.particles;
  const rnd = mulberry32(seed);
  const position = new Float32Array(count * 3);
  const seeds = new Float32Array(count * 4);
  const sizes = new Float32Array(count);
  const warmth = new Float32Array(count);

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
  }

  const target = new Float32Array(count * 3);
  const hasTarget = new Float32Array(count);

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(position, 3));
  geometry.setAttribute('aTarget', new BufferAttribute(target, 3));
  geometry.setAttribute('aSeed', new BufferAttribute(seeds, 4));
  geometry.setAttribute('aSize', new BufferAttribute(sizes, 1));
  geometry.setAttribute('aWarmth', new BufferAttribute(warmth, 1));
  geometry.setAttribute('aHasTarget', new BufferAttribute(hasTarget, 1));

  const uniforms: HeroUniforms = {
    uTime: { value: 0 },
    uField: { value: new Vector2(1, 1) },
    uShaftDir: { value: new Vector2(0.28, 0.96) },
    uNameBox: { value: new Vector4(0, 0, 1, 1) },
    uMorph: { value: 0 },
    uSettle: { value: 0 },
    uDissolve: { value: 0 },
    uAmbient: { value: 0.35 },
    uAmbientKeep: { value: 0.45 },
    uPointer: { value: new Vector4(-99999, -99999, 0, 80) },
    uPointerVel: { value: new Vector2() },
    uTrail: { value: new Float32Array(cfg.trailCount * 4) },
    uFocalDepth: { value: 0.15 },
    uPixelRatio: { value: 1 },
    uMaxPointSize: { value: maxPointSize },
    uSizeScale: { value: cfg.sizeScale },
    uGlobalAlpha: { value: 1 },
    uEmber: { value: new Color(palette.ember) },
    uAmber: { value: new Color(palette.amber) },
    uWhite: { value: new Color(palette.white) },
  };

  const material = new ShaderMaterial({
    vertexShader: `${snoise}\n${vert}`,
    fragmentShader: frag,
    uniforms,
    defines: { TRAIL_N: cfg.trailCount },
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: AdditiveBlending,
    premultipliedAlpha: true,
  });

  const points = new Points(geometry, material);
  points.frustumCulled = false;
  points.matrixAutoUpdate = false;

  return {
    points,
    geometry,
    material,
    uniforms,
    count,
    setTargets(t) {
      target.set(t.target);
      hasTarget.set(t.hasTarget);
      (geometry.getAttribute('aTarget') as BufferAttribute).needsUpdate = true;
      (geometry.getAttribute('aHasTarget') as BufferAttribute).needsUpdate = true;
    },
    setDrawCount(n) {
      geometry.setDrawRange(0, Math.max(0, Math.min(count, Math.floor(n))));
    },
    dispose() {
      geometry.dispose();
      material.dispose();
    },
  };
}
