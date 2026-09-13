uniform vec3 uEmber;
uniform vec3 uAmber;
uniform vec3 uWhite;
uniform vec3 uLinen;

varying float vAlpha;
varying float vBright;
varying float vWarmth;
varying float vSolid;

void main() {
  vec2 q = gl_PointCoord - 0.5;
  float r2 = dot(q, q) * 4.0;                  // 0 at the centre, 1 at the rim
  float soft = 1.0 - smoothstep(0.05, 1.0, r2);
  soft *= soft;                                // dust: hot core, soft rim, no discard
  float hard = 1.0 - smoothstep(0.6, 1.0, r2); // a pixel: flat (one fragment at the centre when 1 px)
  float a = mix(soft, hard, vSolid) * vAlpha;
  vec3 dust = mix(uEmber, uAmber, smoothstep(0.0, 0.6, vBright));
  dust = mix(dust, uWhite, smoothstep(0.6, 1.0, vBright) * vWarmth) * vBright;
  gl_FragColor = vec4(mix(dust, uLinen, vSolid), 1.0);
  #include <colorspace_fragment>
  gl_FragColor = vec4(gl_FragColor.rgb * a, a); // premultiplied (ONE, ONE) or (ONE, ONE_MINUS_SRC_ALPHA)
}
