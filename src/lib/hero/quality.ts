export type QualityTier = 0 | 1 | 2;

export interface TierConfig {
  particles: number;
  dprCap: number;
  nameFraction: number;
  sizeScale: number;
  trailCount: number;
}

export const TIERS: Record<QualityTier, TierConfig> = {
  0: { particles: 60_000, dprCap: 2, nameFraction: 0.72, sizeScale: 1.0, trailCount: 8 },
  1: { particles: 24_000, dprCap: 1.5, nameFraction: 0.7, sizeScale: 1.1, trailCount: 8 },
  2: { particles: 8_000, dprCap: 1.25, nameFraction: 0.7, sizeScale: 1.25, trailCount: 8 },
};

export interface DeviceEnv {
  dpr: number;
  cores: number;
  memory: number | undefined;
  coarse: boolean;
  width: number;
  reducedData: boolean;
}

export function readEnv(): DeviceEnv {
  const nav = navigator as Navigator & { deviceMemory?: number };
  return {
    dpr: window.devicePixelRatio || 1,
    cores: navigator.hardwareConcurrency || 4,
    memory: nav.deviceMemory,
    coarse: matchMedia('(pointer: coarse)').matches,
    width: window.innerWidth,
    reducedData: matchMedia('(prefers-reduced-data: reduce)').matches,
  };
}

export function pickTier(env: DeviceEnv = readEnv()): QualityTier {
  if (env.reducedData) return 2;
  if (env.coarse) return env.cores >= 6 && (env.memory ?? 4) >= 4 && env.width >= 768 ? 1 : 2;
  if (env.cores <= 4 || (env.memory !== undefined && env.memory <= 4)) return 2;
  if (env.cores >= 8 && (env.memory === undefined || env.memory >= 8) && env.width >= 1280) return 0;
  return 1;
}

export interface FrameProbe {
  tick(dtMs: number): void;
  stop(): void;
}

/**
 * Watches frame times after a warm-up; steps quality down (never up) when the 75th
 * percentile exceeds the threshold, re-checking once after a pause.
 */
export function createFrameProbe(o: {
  warmupFrames: number;
  sampleFrames: number;
  thresholdMs: number;
  maxSteps: number;
  onStepDown: () => void;
}): FrameProbe {
  let warm = 0;
  let samples: number[] = [];
  let steps = 0;
  let cooldown = 0;
  let stopped = false;
  return {
    tick(dtMs) {
      if (stopped) return;
      if (warm < o.warmupFrames) {
        warm++;
        return;
      }
      if (cooldown > 0) {
        cooldown--;
        return;
      }
      samples.push(dtMs);
      if (samples.length < o.sampleFrames) return;
      const sorted = samples.slice().sort((a, b) => a - b);
      const p75 = sorted[Math.floor(sorted.length * 0.75)] ?? 0;
      samples = [];
      if (p75 > o.thresholdMs && steps < o.maxSteps) {
        steps++;
        o.onStepDown();
        cooldown = 120;
      } else {
        stopped = true;
      }
    },
    stop() {
      stopped = true;
    },
  };
}
