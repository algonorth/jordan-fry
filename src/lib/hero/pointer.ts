import { Vector2 } from 'three';

export interface PointerState {
  pos: Vector2;
  vel: Vector2;
  strength: number;
  radius: number;
  /** trailCount × (x, y, strength, radius) */
  trail: Float32Array;
  /** true while the pointer or any of its trail still disturbs the dust */
  active: boolean;
}

const OFF = -99999;

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/**
 * Damped pointer with velocity, plus a ring of "puffs" left along its path so the dust keeps
 * parting where the pointer was. The pointer's own field follows its movement with no hold: it
 * rises in 50 ms and, the moment the pointer stops, closes over about half a second. Puffs ease in
 * over 80 ms (so a new one never pops), are laid no more than one per 45 ms, and are gone, not
 * merely faint, 0.7 s later: sooner than the ring of slots comes round again, so an old puff never
 * vanishes mid-air. Ages run on the wall clock, so a slow frame skips rather than slows.
 */
export function createPointer(o: { coarse: boolean; trailCount: number }) {
  const state: PointerState = {
    pos: new Vector2(OFF, OFF),
    vel: new Vector2(),
    strength: 0,
    radius: 80,
    trail: new Float32Array(o.trailCount * 4),
    active: false,
  };
  const puffs = Array.from({ length: o.trailCount }, () => ({ x: OFF, y: OFF, s: 0, r: 60, born: -1 }));
  const raw = new Vector2(OFF, OFF);
  const prevPos = new Vector2(OFF, OFF);
  const lastPuff = new Vector2(OFF, OFF);
  let hasRaw = false;
  let lastMove = -Infinity;
  let lastPuffTime = 0;
  let head = 0;
  const gain = o.coarse ? 0.7 : 1;
  const radiusGain = o.coarse ? 0.6 : 1;

  const onMove = (e: PointerEvent) => {
    const now = performance.now();
    raw.set(e.clientX, e.clientY);
    if (!hasRaw) {
      hasRaw = true;
      state.pos.copy(raw);
      prevPos.copy(raw);
    }
    lastMove = now;
    const dist = raw.distanceTo(lastPuff);
    const since = now - lastPuffTime;
    if ((dist > 24 && since > 45) || since > 90) {
      const speed = state.vel.length();
      const p = puffs[head]!;
      p.x = raw.x;
      p.y = raw.y;
      p.s = Math.min(1, 0.3 + speed / 900) * gain * 0.6;
      p.r = (55 + 70 * Math.min(1, speed / 1500)) * radiusGain;
      p.born = now;
      head = (head + 1) % o.trailCount;
      lastPuff.copy(raw);
      lastPuffTime = now;
    }
  };
  const onLeave = () => {
    lastMove = -Infinity;
  };

  addEventListener('pointermove', onMove, { passive: true });
  document.addEventListener('pointerleave', onLeave);
  addEventListener('pointercancel', onLeave);
  addEventListener('blur', onLeave);

  const tmp = new Vector2();
  return {
    state,
    update(dt: number) {
      if (!hasRaw) return;
      const now = performance.now();
      // Position follows the raw pointer with a 60 ms time constant.
      state.pos.lerp(raw, 1 - Math.exp(-dt / 0.06));
      // Velocity from the damped position, smoothed over 120 ms.
      tmp.copy(state.pos).sub(prevPos).divideScalar(Math.max(dt, 1e-3));
      prevPos.copy(state.pos);
      state.vel.lerp(tmp, 1 - Math.exp(-dt / 0.12));
      // The field is the pointer's movement: any motion opens it (more with speed), stillness
      // closes it, with no hold either way.
      const speed = state.vel.length();
      const moving = now - lastMove < 120;
      const targetStrength = moving ? Math.min(1, 0.25 + speed / 400) : 0;
      const tau = targetStrength > state.strength ? 0.05 : 0.22;
      state.strength += (targetStrength - state.strength) * (1 - Math.exp(-dt / tau));
      if (!moving && state.strength < 0.003) state.strength = 0;
      state.radius = (70 + 80 * Math.min(1, speed / 1500)) * radiusGain;
      let active = state.strength > 0;
      for (let i = 0; i < o.trailCount; i++) {
        const p = puffs[i]!;
        const k = i * 4;
        const age = p.born < 0 ? 99 : (now - p.born) / 1000;
        const env = smoothstep(0, 0.08, age) * Math.max(0, Math.exp(-age / 0.28) - age * 0.12);
        const s = p.s * env;
        state.trail[k] = p.x;
        state.trail[k + 1] = p.y;
        state.trail[k + 2] = s > 0.002 ? s : 0;
        state.trail[k + 3] = p.r + 25 * Math.min(age, 1);
        if (s > 0.002) active = true;
      }
      state.active = active;
    },
    dispose() {
      removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerleave', onLeave);
      removeEventListener('pointercancel', onLeave);
      removeEventListener('blur', onLeave);
    },
  };
}
