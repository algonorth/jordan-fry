// Stateless sawdust: every frame, position = f(attributes, uniforms). No feedback buffers.
// `TRAIL_N` and `BURST_N` are injected through ShaderMaterial defines. three prepends precision + matrices.
//
// Two systems share this shader: the light shaft's ambient dust (aHasTarget = 0, drawn additively)
// and the name (aHasTarget = 1, drawn with normal blending over it): one mote per device pixel of
// the glyphs, which flies in as dust and then sits on its pixel as a flat linen dot with the
// pixel's own coverage as its alpha, so the settled name is the typeset headline pixel for pixel.
// Any mote pushed off its pixel is dust again until it is back.
//
// Written for the strictest mobile compilers (Qualcomm Adreno asserts and refuses to link on
// dynamically indexed uniform arrays, and is fragile around early returns and vector ternaries):
// the trail and gust loops are unrolled by particles.ts into constant indices (the placeholder
// tokens below, each of which must appear exactly once), helpers are branchless, and selections
// use if-assignment or mix().
#define PI 3.141592653589793
#define GUST_CORE 0.45

attribute vec3 aTarget;     // x, y: the mote's pixel in device px from the name origin; z: brightness jitter
attribute vec4 aSeed;       // four uniform seeds
attribute float aSize;      // base size in CSS px
attribute float aWarmth;    // 0 ember … 1 warm white
attribute float aHasTarget; // 1 = a pixel of the name, 0 = ambient dust
attribute float aCover;     // how much of its pixel the glyph covers: the settled mote's alpha
attribute float aShed;      // 1 = a spare grain parked on a pixel that lifts off now and then

uniform float uTime;
uniform vec2 uField;        // viewport size in CSS px
uniform vec2 uShaftDir;     // unit vector the dust settles along
uniform vec2 uNameOrigin;   // top-left of the name in CSS px, on the device pixel grid
uniform vec2 uNameSize;     // the name's box in device px
uniform float uPitch;       // device px per name mote (1 = pixel perfect)
uniform float uMorph;       // 0 dust … 1 name
uniform float uSettle;      // 0 the landed dust still glows … 1 it has become the type
uniform float uDissolve;    // 0 name … 1 released
uniform float uAmbient;     // alpha level once dissolved
uniform float uAmbientKeep; // fraction of motes kept once dissolved
uniform vec4 uPointer;      // x, y, strength, radius
uniform vec2 uPointerVel;   // CSS px / s
uniform vec4 uTrail[TRAIL_N];
uniform vec4 uBurst[BURST_N];     // x, y, strength, radius of a tap on the hero
uniform float uBurstAge[BURST_N]; // seconds since each tap; negative = none
uniform float uFocalDepth;
uniform float uPixelRatio;
uniform float uMaxPointSize;
uniform float uSizeScale;
uniform float uGlobalAlpha;
uniform float uNameDustAlpha; // alpha of a name mote while it is dust, scaled by how many there are
uniform float uNameDustScale; // size factor for the same reason

varying float vAlpha;
varying float vBright;
varying float vWarmth;
varying float vSolid;

// Displacement from one disturbance (x, y, strength, radius), stretched along `vdir` by `elong`.
// The profile is soft to the rim, so the dust thins around the pointer instead of piling up in a ring.
vec2 puff(vec2 p, vec4 t, vec2 vdir, float elong) {
  vec2 d = p - t.xy;
  vec2 q = vec2(dot(d, vdir) / elong, dot(d, vec2(-vdir.y, vdir.x)));
  float f = 1.0 - smoothstep(0.0, max(t.w, 1e-3), length(q));
  f *= mix(f, 1.0, 0.5);
  float gate = step(0.001, t.z); // inactive puffs contribute nothing, without a branch
  return normalize(d + vec2(1e-3, 0.0)) * (f * t.z * t.w * 0.45 * gate);
}

// How deep inside a disturbance (x, y, strength, radius) a point sits: the strength at the
// centre, 0 at the rim. Name motes in a disturbance are thrown further and veer.
float inside(vec2 q, vec4 t) {
  float f = 1.0 - smoothstep(0.0, max(t.w, 1e-3), length(q - t.xy));
  return f * t.z * step(0.001, t.z);
}

// A tap on the hero: motes inside the radius are thrown outward (near ones far, each veering its
// own way), hang for a moment, then drift back home. Returns the displacement and, in z, how much
// this gust still holds the mote. `swirl` is one turbulence sample shared by every gust (noise is
// the costly part of this shader).
vec3 gust(vec2 p, vec4 b, float age, vec4 seed, vec2 swirl) {
  float on = step(0.0, age) * step(0.001, b.z);
  vec2 d = p - b.xy;
  // Flat inside, easing off only near the rim.
  float f = 1.0 - smoothstep(GUST_CORE * b.w, max(b.w, 1e-3), length(d));
  float lag = 0.35 * seed.y;
  float fly = 1.0 - pow(1.0 - clamp(age / 0.25, 0.0, 1.0), 3.0);  // thrown out in a quarter second
  float back = smoothstep(0.4 + lag, 1.5 + lag, age);             // and eased back over a second
  float env = fly * (1.0 - back);
  vec2 dir = normalize(d + vec2(1e-3, 0.0));
  float ang = (seed.x - 0.5) * 1.6;
  dir = vec2(dir.x * cos(ang) - dir.y * sin(ang), dir.x * sin(ang) + dir.y * cos(ang));
  float reach = (0.3 + 0.7 * f) * f * b.w * mix(0.5, 1.5, seed.z);
  return vec3((dir * reach + swirl * 34.0 * f) * env * on, f * b.z * env * on);
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

  // 2. The mote's pixel: its centre on the device grid. It breathes only while the name is forming.
  vec2 tgt = uNameOrigin + aTarget.xy / uPixelRatio;
  tgt += vec2(
    snoise(vec3(aTarget.xy * 0.03, t * 0.18) + aSeed.xyz * 5.0),
    snoise(vec3(aTarget.yx * 0.03, t * 0.18 + 3.0) + aSeed.zyx * 5.0)
  ) * 1.2 * (1.0 - uSettle);

  // 3. Staggered morph (sweeps left to right with randomness) and staggered release. Each mote
  //    flies for 60% of the morph with an ease-in-out, so the travel itself is visible.
  float stagger = mix(aSeed.x, clamp(aTarget.x / max(uNameSize.x, 1.0), 0.0, 1.0), 0.6);
  float m = clamp((uMorph - stagger * 0.4) / 0.6, 0.0, 1.0);
  m = m * m * (3.0 - 2.0 * m);
  // The scroll takes the name from the top down in coherent patches (a smooth spatial field
  // decides the order, not each pixel on its own), the way dust lifts off a surface.
  float lift = 0.5 + 0.5 * snoise(vec3(aTarget.xy / uPixelRatio * 0.03, 1.7));
  float order = mix(clamp(aTarget.y / max(uNameSize.y, 1.0), 0.0, 1.0), lift, 0.45);
  float dz = clamp((uDissolve - order * 0.5) / 0.5, 0.0, 1.0);
  dz = dz * dz * (3.0 - 2.0 * dz);
  float hold = m * (1.0 - dz) * aHasTarget;

  // 4. Flight path: an arc through the drift on the way in; a small sink on the way out.
  vec2 arc = (drift.yx * 1.5 + vec2(0.0, -40.0 * aSeed.z)) * sin(hold * PI)
    + vec2(0.0, 90.0) * sin(dz * PI) * aHasTarget * m;
  vec2 p = mix(pA, tgt, hold) + arc;

  // 5. Disturbances: the pointer's damped field with a wake, its trail puffs, and the gusts of
  //    taps. Name motes inside one are thrown further than the dust around them and veer.
  float speed = length(uPointerVel);
  vec2 vdir = vec2(1.0, 0.0);
  if (speed > 1.0) vdir = uPointerVel / speed;
  float elong = 1.0 + 0.8 * clamp(speed / 1200.0, 0.0, 1.0);
  vec2 disp = puff(p, uPointer, vdir, elong);
  float wake = inside(tgt, uPointer);
  TRAIL_UNROLLED
  vec2 swirl = vec2(
    snoise(vec3(p * 0.012, t * 1.3 + aSeed.w * 9.0)),
    snoise(vec3(p.yx * 0.012, t * 1.3 + 4.0))
  );
  vec3 gusts = vec3(0.0);
  BURST_UNROLLED
  wake = max(wake, min(1.0, gusts.z));
  wake *= (1.0 - smoothstep(0.0, 0.35, uDissolve)) * aHasTarget;

  // Idle grains: the spare motes parked on the letters lift off on their own slow cycles, drift
  // down the shaft for a beat and fade, then are back on their pixel (which was never empty).
  float ph = fract(t * 0.09 + aSeed.z);
  float beat = aShed * step(ph, 0.45) * uSettle;
  vec2 shedDrift = (uShaftDir * 70.0 + flutter * 3.0) * ph * beat;
  float shedEnv = smoothstep(0.0, 0.08, ph) * (1.0 - smoothstep(0.3, 0.45, ph));

  float tum = (aSeed.x - 0.5) * 1.4 * wake; // blown name motes veer instead of radiating
  vec2 tumbled = vec2(disp.x * cos(tum) - disp.y * sin(tum), disp.x * sin(tum) + disp.y * cos(tum));
  disp = mix(disp, tumbled, hold);
  vec2 shift = disp * mix(0.7, 1.3, aSeed.w) * mix(0.45, mix(0.6, 1.5, wake), hold)
    + gusts.xy * mix(0.25, 1.0, hold)
    + shedDrift;
  p += shift;

  // 6. A landed, undisturbed name mote is a pixel of the type: flat, linen, as opaque as the glyph
  //    covers it. Pushed more than a couple of pixels away it is dust until it returns.
  float landed = smoothstep(0.97, 1.0, m) * aHasTarget;
  float freed = smoothstep(0.0, 0.08, dz); // the moment the scroll releases it, it is dust
  float moved = smoothstep(0.35, 2.5, length(shift));
  float solid = landed * uSettle * (1.0 - moved) * (1.0 - freed);

  // 7. Size: dust has depth of field; a pixel is a pixel (a slightly larger dot when a mote
  //    stands for a cell of several pixels, so the cells knit together).
  float dof = abs(depth - uFocalDepth) * (1.0 - hold * 0.85);
  float dustSize = aSize * mix(1.0, 2.2, dof) * uSizeScale * uPixelRatio
    * mix(1.0, uNameDustScale, aHasTarget);
  float solidSize = uPitch * mix(1.0, 1.3, step(1.5, uPitch));
  gl_PointSize = clamp(mix(dustSize, solidSize, solid), 1.0, uMaxPointSize);

  // 8. Alpha and brightness. Dust shimmers; a pixel does not.
  float shimmer = 0.78 + 0.22 * sin(t * (1.2 + 2.4 * aSeed.y) + aSeed.z * 6.2832);
  float level = mix(1.0, uAmbient, smoothstep(0.2, 1.0, uDissolve));
  float keep = mix(1.0, step(aSeed.z, uAmbientKeep), smoothstep(0.3, 1.0, uDissolve));
  float ambientA = uGlobalAlpha * level * keep * shimmer * mix(0.35, 1.0, 1.0 - dof);
  float dustA = mix(uNameDustAlpha * mix(0.35, 1.0, 1.0 - dof), 0.9, landed) * shimmer
    * mix(1.0, shedEnv, aShed);
  float nameA = mix(dustA, aCover, solid) * (1.0 - dz);
  vAlpha = mix(ambientA, nameA, aHasTarget);
  vBright = mix(0.45, 1.0, 1.0 - dof) * mix(0.6, 1.0, hold) * shimmer * mix(0.9, 1.1, aTarget.z);
  vWarmth = aWarmth;
  vSolid = solid;

  // Invisible motes are clipped away rather than rasterised.
  vec4 clip = projectionMatrix * modelViewMatrix * vec4(p, 0.0, 1.0);
  if (vAlpha <= 0.002) clip = vec4(2.0, 2.0, 2.0, 1.0);
  gl_Position = clip;
}
