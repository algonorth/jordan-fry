import { Vector2 } from 'three';

export interface PointerState {
  pos: Vector2;
  vel: Vector2;
  strength: number;
  radius: number;
  /** trailCount × (x, y, strength, radius) */
  trail: Float32Array;
}

const OFF = -99999;

/**
 * Damped pointer with velocity, plus a ring of decaying "puffs" left along its path so the
 * dust keeps parting where the pointer was and settles back over about a second.
 */
export function createPointer(o: { coarse: boolean; trailCount: number }) {
  const state: PointerState = {
    pos: new Vector2(OFF, OFF),
    vel: new Vector2(),
    strength: 0,
    radius: 80,
    trail: new Float32Array(o.trailCount * 4),
  };
  const raw = new Vector2(OFF, OFF);
  const prevPos = new Vector2(OFF, OFF);
  const lastPuff = new Vector2(OFF, OFF);
  let hasRaw = false;
  let targetStrength = 0;
  let lastMove = 0;
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
    targetStrength = 1;
    lastMove = now;
    const dist = raw.distanceTo(lastPuff);
    if (dist > 24 || now - lastPuffTime > 90) {
      const speed = state.vel.length();
      const i = head * 4;
      state.trail[i] = raw.x;
      state.trail[i + 1] = raw.y;
      state.trail[i + 2] = Math.min(1, Math.max(0.25, speed / 900)) * gain * 0.7;
      state.trail[i + 3] = (60 + 80 * Math.min(1, speed / 1500)) * radiusGain;
      head = (head + 1) % o.trailCount;
      lastPuff.copy(raw);
      lastPuffTime = now;
    }
  };
  const onLeave = () => {
    targetStrength = 0;
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
      // Position follows the raw pointer with a 60 ms time constant.
      state.pos.lerp(raw, 1 - Math.exp(-dt / 0.06));
      // Velocity from the damped position, smoothed over 120 ms.
      tmp.copy(state.pos).sub(prevPos).divideScalar(Math.max(dt, 1e-3));
      prevPos.copy(state.pos);
      state.vel.lerp(tmp, 1 - Math.exp(-dt / 0.12));
      // Strength rises fast, relaxes slowly; a still pointer relaxes too.
      if (performance.now() - lastMove > 400) targetStrength = 0;
      const tau = targetStrength > state.strength ? 0.08 : 0.6;
      state.strength += (targetStrength - state.strength) * (1 - Math.exp(-dt / tau));
      const speed = state.vel.length();
      state.radius = (80 + 100 * Math.min(1, speed / 1500)) * radiusGain;
      // Trail puffs fade and spread.
      const decay = Math.exp(-dt / 0.8);
      for (let i = 0; i < o.trailCount; i++) {
        state.trail[i * 4 + 2] *= decay;
        state.trail[i * 4 + 3] += 40 * dt;
      }
    },
    dispose() {
      removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerleave', onLeave);
      removeEventListener('pointercancel', onLeave);
      removeEventListener('blur', onLeave);
    },
  };
}
