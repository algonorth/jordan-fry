// Stateless sawdust: every frame, position = f(attributes, uniforms). No feedback buffers.
// `TRAIL_N` is injected through ShaderMaterial defines. three prepends precision + matrices.
//
// Written for the strictest mobile compilers (Qualcomm Adreno asserts and refuses to link on
// dynamically indexed uniform arrays, and is fragile around early returns and vector ternaries):
// the trail loop is unrolled by particles.ts into constant indices (the placeholder token below,
// which must appear exactly once), helpers are branchless, and selections use if-assignment or mix().
#define PI 3.141592653589793

attribute vec3 aTarget;     // u, v inside the name box (0..1), z: brightness jitter
attribute vec4 aSeed;       // four uniform seeds
attribute float aSize;      // base size in CSS px
attribute float aWarmth;    // 0 ember … 1 warm white
attribute float aHasTarget; // 1 = takes part in the name

uniform float uTime;
uniform vec2 uField;        // viewport size in CSS px
uniform vec2 uShaftDir;     // unit vector the dust settles along
uniform vec4 uNameBox;      // x, y, w, h of the headline in CSS px (viewport space)
uniform float uMorph;       // 0 dust … 1 name
uniform float uSettle;      // 0 name motes lit … 1 name motes gone (the typeset name has taken over)
uniform float uDissolve;    // 0 name … 1 released
uniform float uAmbient;     // alpha level once dissolved
uniform float uAmbientKeep; // fraction of motes kept once dissolved
uniform vec4 uPointer;      // x, y, strength, radius
uniform vec2 uPointerVel;   // CSS px / s
uniform vec4 uTrail[TRAIL_N];
uniform float uFocalDepth;
uniform float uPixelRatio;
uniform float uMaxPointSize;
uniform float uSizeScale;
uniform float uGlobalAlpha;

varying float vAlpha;
varying float vBright;
varying float vWarmth;

// Displacement from one disturbance (x, y, strength, radius), stretched along `vdir` by `elong`.
vec2 puff(vec2 p, vec4 t, vec2 vdir, float elong) {
  vec2 d = p - t.xy;
  vec2 q = vec2(dot(d, vdir) / elong, dot(d, vec2(-vdir.y, vdir.x)));
  float f = 1.0 - smoothstep(0.0, max(t.w, 1e-3), length(q));
  f *= f;
  float gate = step(0.001, t.z); // inactive puffs contribute nothing, without a branch
  return normalize(d + vec2(1e-3, 0.0)) * (f * t.z * t.w * 0.6 * gate);
}

void main() {
  float t = uTime;
  float depth = position.z;
  float par = mix(1.0, 0.45, depth); // near motes move more than far ones

  // 1. Ambient drift: a coherent flow field plus a small per-mote flutter, wrapped inside an
  //    8%-overscanned field so the seam is always off-screen.
  vec2 rest = position.xy * uField;
  vec3 n = vec3(rest * 0.0035, t * 0.05);
  vec2 flow = vec2(snoise(n), snoise(n + vec3(31.7, 11.3, 5.2))) * 38.0 * par;
  vec2 flutter = vec2(
    snoise(vec3(aSeed.xy * 50.0, t * 0.35)),
    snoise(vec3(aSeed.zw * 50.0, t * 0.35 + 7.0))
  ) * 6.0;
  vec2 drift = flow + flutter;
  vec2 fall = uShaftDir * t * (7.0 + 9.0 * aSeed.w) * par;
  vec2 fMin = -0.08 * uField;
  vec2 fSize = 1.16 * uField;
  vec2 pA = mod(rest + drift + fall - fMin, fSize) + fMin;

  // 2. Name target, breathing very slightly.
  vec2 tgt = uNameBox.xy + aTarget.xy * uNameBox.zw;
  tgt += vec2(
    snoise(vec3(aTarget.xy * 6.0, t * 0.18) + aSeed.xyz * 5.0),
    snoise(vec3(aTarget.yx * 6.0, t * 0.18 + 3.0) + aSeed.zyx * 5.0)
  ) * 1.2;

  // 3. Staggered morph (sweeps left to right with randomness) and staggered release. Each mote
  //    flies for 60% of the morph with an ease-in-out, so the travel itself is visible.
  float stagger = mix(aSeed.x, aTarget.x, 0.6);
  float m = clamp((uMorph - stagger * 0.4) / 0.6, 0.0, 1.0);
  m = m * m * (3.0 - 2.0 * m);
  float dz = clamp((uDissolve - aSeed.y * 0.5) / 0.5, 0.0, 1.0);
  dz = dz * dz * (3.0 - 2.0 * dz);
  float hold = m * (1.0 - dz) * aHasTarget;

  // 4. Flight path: an arc through the drift on the way in; a small sink on the way out.
  vec2 arc = (drift.yx * 1.5 + vec2(0.0, -40.0 * aSeed.z)) * sin(hold * PI)
    + vec2(0.0, 90.0) * sin(dz * PI) * aHasTarget * m;
  vec2 p = mix(pA, tgt, hold) + arc;

  // 5. Pointer: a damped field with a wake, plus decaying trail puffs.
  float speed = length(uPointerVel);
  vec2 vdir = vec2(1.0, 0.0);
  if (speed > 1.0) vdir = uPointerVel / speed;
  float elong = 1.0 + 1.5 * clamp(speed / 1200.0, 0.0, 1.0);
  vec2 disp = puff(p, uPointer, vdir, elong);
  TRAIL_UNROLLED
  p += disp * mix(0.7, 1.3, aSeed.w) * mix(1.0, 0.6, hold);

  // 6. Fake depth of field: away from the focal plane motes get bigger and dimmer; letters snap into focus.
  float dof = abs(depth - uFocalDepth) * (1.0 - hold * 0.85);
  float size = aSize * mix(1.0, 2.2, dof) * uSizeScale * uPixelRatio;
  gl_PointSize = clamp(size, 1.0, uMaxPointSize);

  // 7. Alpha and brightness.
  float shimmer = 0.78 + 0.22 * sin(t * (1.2 + 2.4 * aSeed.y) + aSeed.z * 6.2832);
  float level = mix(1.0, uAmbient, smoothstep(0.2, 1.0, uDissolve));
  float keep = mix(1.0, step(aSeed.z, uAmbientKeep), smoothstep(0.3, 1.0, uDissolve));
  // Once settled, name motes hand over to the headline (staggered per mote) and stay gone.
  float settle = smoothstep(0.0, 1.0, clamp((uSettle - aSeed.w * 0.4) / 0.6, 0.0, 1.0)) * aHasTarget;
  vAlpha = uGlobalAlpha * level * keep * shimmer * mix(0.35, 1.0, 1.0 - dof) * mix(0.55, 0.85, hold);
  vAlpha *= 1.0 - settle;
  vBright = mix(0.45, 1.0, 1.0 - dof) * mix(0.6, 1.0, hold) * shimmer * mix(0.9, 1.1, aTarget.z);
  vWarmth = aWarmth;

  // Invisible motes are clipped away rather than rasterised.
  vec4 clip = projectionMatrix * modelViewMatrix * vec4(p, 0.0, 1.0);
  if (vAlpha <= 0.002) clip = vec4(2.0, 2.0, 2.0, 1.0);
  gl_Position = clip;
}
