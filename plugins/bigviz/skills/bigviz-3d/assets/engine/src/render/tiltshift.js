// Single-pass miniature tilt-shift: golden-angle disk blur whose radius grows away from a
// horizontal focus band. Pixels inside the band take one texture fetch (cheap on iGPUs).

export const TiltShiftShader = {
  uniforms: {
    tDiffuse: { value: null },
    focus: { value: 0.5 },
    band: { value: 0.16 },
    amount: { value: 1 },
    maxPx: { value: 7 },
    texel: { value: [1 / 1600, 1 / 900] }
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float focus, band, amount, maxPx;
    uniform vec2 texel;
    varying vec2 vUv;
    void main() {
      float d = max(0.0, abs(vUv.y - focus) - band) / max(0.001, 0.5 - band);
      float r = amount * maxPx * pow(clamp(d, 0.0, 1.0), 1.4);
      vec4 c = texture2D(tDiffuse, vUv);
      if (r < 0.6) { gl_FragColor = c; return; }
      vec4 acc = c;
      float w = 1.0;
      for (int i = 1; i < 12; i++) {
        float fi = float(i);
        float a = fi * 2.39996;
        vec2 o = vec2(cos(a), sin(a)) * sqrt(fi / 11.0) * r * texel;
        acc += texture2D(tDiffuse, vUv + o);
        w += 1.0;
      }
      gl_FragColor = acc / w;
    }`
}
