uniform vec3 uEmber;
uniform vec3 uAmber;
uniform vec3 uWhite;

varying float vAlpha;
varying float vBright;
varying float vWarmth;

void main() {
  vec2 q = gl_PointCoord - 0.5;
  float r2 = dot(q, q) * 4.0;                  // 0 at the centre, 1 at the rim
  float falloff = 1.0 - smoothstep(0.05, 1.0, r2);
  falloff *= falloff;                          // hot core, soft rim, no discard
  float a = falloff * vAlpha;
  vec3 c = mix(uEmber, uAmber, smoothstep(0.0, 0.6, vBright));
  c = mix(c, uWhite, smoothstep(0.6, 1.0, vBright) * vWarmth);
  gl_FragColor = vec4(c * vBright, 1.0);
  #include <colorspace_fragment>
  gl_FragColor = vec4(gl_FragColor.rgb * a, a); // premultiplied for additive (ONE, ONE)
}
