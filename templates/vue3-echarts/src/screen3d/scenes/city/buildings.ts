/**
 * All buildings in one InstancedMesh (one draw call). A custom shader gives each box a height
 * gradient from primary to accent, glowing edges, procedural lit windows that fade out when they
 * get too small to read, a rising entrance and a highlight where the scan ring passes.
 */
import { BoxGeometry, InstancedBufferAttribute, InstancedMesh, Matrix4, ShaderMaterial, Vector2 } from 'three'
import { SHARED_GLSL, type CityColors, type SharedUniforms } from './colors'
import type { CityLayout } from './layout'

const vertex = /* glsl */ `
attribute float aSeed;
uniform float uGrow;
uniform vec2 uCore;
varying vec3 vWorld;
varying vec3 vLocal;
varying vec3 vNormalW;
varying vec3 vSize;
varying float vSeed;

void main() {
  vec3 size = vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz), length(instanceMatrix[2].xyz));
  vec3 origin = instanceMatrix[3].xyz;
  // Entrance: buildings rise from the core outwards
  float g = clamp(uGrow * 1.8 - distance(origin.xz, uCore) / 1400.0, 0.0, 1.0);
  g = 1.0 - pow(1.0 - g, 3.0);
  vec4 world = modelMatrix * instanceMatrix * vec4(position, 1.0);
  world.y *= max(g, 0.002);
  vWorld = world.xyz;
  vLocal = position;
  vNormalW = normal;
  vSize = size;
  vSeed = aSeed;
  gl_Position = projectionMatrix * viewMatrix * world;
}
`

const fragment = /* glsl */ `
${SHARED_GLSL}
uniform vec3 uBase;
uniform vec3 uPrimary;
uniform vec3 uAccent;
uniform vec3 uWarm;
uniform float uMaxHeight;
varying vec3 vWorld;
varying vec3 vLocal;
varying vec3 vNormalW;
varying vec3 vSize;
varying float vSeed;

void main() {
  vec3 n = normalize(vNormalW);
  float hN = clamp(vWorld.y / uMaxHeight, 0.0, 1.0);
  // With MSAA, varyings are sampled at the pixel centre, which can lie outside the triangle, so
  // vLocal can overshoot [-0.5, 0.5] / [0, 1]. pow() of a negative base is undefined (NaN), and a
  // single NaN pixel spreads into a blob in the bloom blur — clamp before any pow / smoothstep.
  vec3 local = clamp(vLocal, vec3(-0.5, 0.0, -0.5), vec3(0.5, 1.0, 0.5));
  float ly = local.y;
  float ly2 = ly * ly;
  bool roof = n.y > 0.5;

  // Body: dark base rising to primary, accent tint on the tallest towers
  vec3 col = mix(uBase, uPrimary * 0.32, pow(hN, 0.7));
  col = mix(col, uAccent * 0.4, smoothstep(0.5, 1.0, hN) * 0.5);
  col *= roof ? 0.9 : (0.7 + 0.3 * abs(n.x));
  col += uPrimary * 0.1 * ly2 * ly2;

  // Face coordinates in world units (from the face corner)
  vec2 faceSize = roof ? vSize.xz : (abs(n.x) > 0.5 ? vSize.zy : vSize.xy);
  vec2 uvFace = roof ? local.xz + 0.5 : vec2((abs(n.x) > 0.5 ? local.z : local.x) + 0.5, ly);
  vec2 m = uvFace * faceSize;
  vec2 toEdge = min(m, faceSize - m);
  vec2 fw = max(fwidth(m), vec2(1e-4));
  vec2 e = 1.0 - smoothstep(fw * 0.6, fw * 1.6 + 0.35, toEdge);
  float edge = max(e.x, e.y);
  // When a face spans only a few pixels the edge band swallows the whole face and it blooms into
  // a blob; fade edges out by the face's on-screen size (in pixels along its shorter side).
  vec2 facePx = faceSize / fw;
  edge *= smoothstep(6.0, 24.0, min(facePx.x, facePx.y));
  if (!roof) edge *= mix(0.25, 1.0, ly);
  vec3 edgeCol = mix(uPrimary, uAccent, smoothstep(0.1, 0.8, hN));
  col += edgeCol * edge * (0.35 + 1.1 * hN);

  // Windows: a floor / column grid on the side faces, ~30 % lit
  float win = 0.0;
  if (!roof) {
    vec2 g = vec2(m.x, vWorld.y) / vec2(5.5, 4.4);
    vec2 id = floor(g);
    vec2 f = fract(g);
    // smoothstep(e, e, x) is undefined; keep the AA width strictly positive
    vec2 aa = max(fwidth(g), vec2(1e-3));
    float wx = smoothstep(0.2, 0.2 + aa.x, f.x) * (1.0 - smoothstep(0.8 - aa.x, 0.8, f.x));
    float wy = smoothstep(0.3, 0.3 + aa.y, f.y) * (1.0 - smoothstep(0.82 - aa.y, 0.82, f.y));
    float face = n.x * 3.0 + n.z * 7.0;
    float r = hash12(id + vec2(vSeed * 131.0 + face, face * 17.0));
    float lit = step(0.7, r);
    // a few windows blink on and off
    lit *= 1.0 - step(0.992, hash12(id + vec2(floor(uTime * 0.7), vSeed * 7.0)));
    float lod = 1.0 - smoothstep(0.3, 0.75, max(aa.x, aa.y));
    vec3 winCol = mix(uAccent, uWarm, step(0.78, hash12(id * 1.7 + vSeed)));
    win = wx * wy * lit * (1.0 - edge);
    col += winCol * win * lod * 0.95;
    // Far away: average glow instead of aliasing windows
    col += mix(uAccent, uWarm, 0.2) * (1.0 - lod) * 0.05;
  } else {
    // Roof: faint inner frame
    col += uAccent * 0.05;
  }

  // Scan ring highlight (strongest on edges)
  float s = scanBand(vWorld.xz);
  col += uAccent * s * (0.12 + edge * 1.4 + win * 0.6);

  col = mix(col, uFogColor, fogFactor(distance(vWorld, cameraPosition)));
  // Last line of defence for the HDR target: never emit NaN / huge values into the bloom chain
  col = clamp(col, 0.0, 8.0);
  gl_FragColor = vec4(col, 1.0);
}
`

/** Build the instanced buildings mesh for a layout */
export function createBuildings(layout: CityLayout, colors: CityColors, shared: SharedUniforms): InstancedMesh {
  const geometry = new BoxGeometry(1, 1, 1)
  geometry.translate(0, 0.5, 0)
  const count = layout.buildings.length
  const seeds = new Float32Array(count)

  const material = new ShaderMaterial({
    vertexShader: vertex,
    fragmentShader: fragment,
    uniforms: {
      ...shared,
      uCore: { value: new Vector2(layout.core.x, layout.core.z) },
      uBase: { value: colors.base },
      uPrimary: { value: colors.primary },
      uAccent: { value: colors.accent },
      uWarm: { value: colors.warm },
      uMaxHeight: { value: layout.maxHeight }
    }
  })

  const mesh = new InstancedMesh(geometry, material, count)
  const m = new Matrix4()
  layout.buildings.forEach((b, i) => {
    m.makeScale(b.w, b.h, b.d).setPosition(b.x, b.y, b.z)
    mesh.setMatrixAt(i, m)
    seeds[i] = b.seed
  })
  geometry.setAttribute('aSeed', new InstancedBufferAttribute(seeds, 1))
  mesh.instanceMatrix.needsUpdate = true
  // The city is always mostly in view; skip the per-frame bounds test of 2000 instances
  mesh.frustumCulled = false
  mesh.name = 'buildings'
  return mesh
}
