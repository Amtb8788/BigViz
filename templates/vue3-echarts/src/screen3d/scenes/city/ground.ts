/**
 * Ground plane drawn analytically in one shader: road grid with glowing edges, a winding river,
 * a holographic grid and range rings beyond the city edge, and the scan ring on the asphalt.
 */
import { Mesh, PlaneGeometry, ShaderMaterial, Vector4 } from 'three'
import { SHARED_GLSL, type CityColors, type SharedUniforms } from './colors'
import { CITY, type CityLayout } from './layout'

const vertex = /* glsl */ `
varying vec3 vWorld;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`

const fragment = /* glsl */ `
${SHARED_GLSL}
uniform vec3 uGround;
uniform vec3 uPrimary;
uniform vec3 uAccent;
uniform vec3 uViolet;
uniform float uPitch;
uniform float uRoad;
uniform float uRadius;
/** offset, amp, freq, phase */
uniform vec4 uRiver;
uniform float uRiverHalf;
varying vec3 vWorld;

/** Distance (world units) to the nearest grid line of spacing p */
float lineDist(float v, float p) {
  float f = mod(v + p * 0.5, p) - p * 0.5;
  return abs(f);
}

void main() {
  vec2 p = vWorld.xz;
  float r = length(p);
  float inCity = 1.0 - smoothstep(uRadius * 0.98, uRadius * 1.1, r);
  vec3 col = uGround;

  // Roads: distance to the nearest centre line on each axis
  float dx = lineDist(p.x, uPitch);
  float dz = lineDist(p.y, uPitch);
  float d = min(dx, dz);
  float halfRoad = uRoad * 0.5;
  float aa = fwidth(d) + 0.001;
  float road = 1.0 - smoothstep(halfRoad - aa, halfRoad + aa, d);
  float rim = gauss((d - halfRoad) / max(aa * 1.5, 0.8));
  // Major avenues
  float majorP = uPitch * ${CITY.majorEvery.toFixed(1)};
  float dm = min(lineDist(p.x, majorP), lineDist(p.y, majorP));
  float major = 1.0 - step(halfRoad + 1.0, dm);

  // River (drawn before roads so the roads read as bridges)
  float rx = uRiver.x + uRiver.y * sin(p.y * uRiver.z + uRiver.w);
  float rd = abs(p.x - rx);
  float water = (1.0 - smoothstep(uRiverHalf - 6.0, uRiverHalf, rd)) * inCity;
  float shimmer = 0.5 + 0.5 * sin(p.y * 0.05 - uTime * 1.2 + sin(p.x * 0.03) * 2.0);
  col = mix(col, uPrimary * 0.12 + uViolet * 0.04 * shimmer, water);
  float bank = gauss((rd - uRiverHalf) / 2.0) * inCity;
  col += uAccent * bank * 0.35;

  vec3 roadCol = uGround * 1.6 + uPrimary * 0.05;
  col = mix(col, roadCol, road * inCity * (water > 0.5 ? 0.6 : 1.0));
  col += uPrimary * rim * inCity * (0.22 + 0.25 * major) * uGrow;
  // Dashed centre line on avenues
  float dash = step(0.5, fract((dx < dz ? p.y : p.x) / 14.0));
  col += uAccent * major * (1.0 - smoothstep(0.4, 0.9 + aa, d)) * dash * 0.18 * inCity;

  // Outside: fine holographic grid + dashed range rings
  float grid = 1.0 - smoothstep(0.0, fwidth(p.x) * 1.2 + 0.4, min(lineDist(p.x, 40.0), lineDist(p.y, 40.0)));
  float outside = smoothstep(uRadius * 0.95, uRadius * 1.15, r) * (1.0 - smoothstep(uRadius * 1.8, uRadius * 3.0, r));
  col += uPrimary * grid * outside * 0.12;
  float ringD = abs(mod(r, 300.0) - 150.0);
  float rings = (1.0 - smoothstep(149.0 - fwidth(r) * 1.5, 150.0, ringD));
  float ringDash = step(0.35, fract(atan(p.y, p.x) * 48.0 / 6.2832));
  col += uAccent * rings * ringDash * outside * 0.18;
  // City boundary glow
  col += uAccent * gauss((r - uRadius * 1.1) / 6.0) * 0.25;

  // Scan ring on the ground
  col += uAccent * scanBand(p) * (0.06 + rim * 0.9 + road * 0.06);

  col = mix(col, uFogColor, fogFactor(distance(vWorld, cameraPosition)));
  gl_FragColor = vec4(col, 1.0);
}
`

/** Big ground plane centred on the city */
export function createGround(layout: CityLayout, colors: CityColors, shared: SharedUniforms): Mesh {
  const size = CITY.radius * 8
  const geometry = new PlaneGeometry(size, size)
  geometry.rotateX(-Math.PI / 2)
  const { river } = layout
  const material = new ShaderMaterial({
    vertexShader: vertex,
    fragmentShader: fragment,
    uniforms: {
      ...shared,
      uGround: { value: colors.ground },
      uPrimary: { value: colors.primary },
      uAccent: { value: colors.accent },
      uViolet: { value: colors.violet },
      uPitch: { value: CITY.pitch },
      uRoad: { value: CITY.road },
      uRadius: { value: CITY.radius },
      uRiver: { value: new Vector4(river.offset, river.amp, river.freq, river.phase) },
      uRiverHalf: { value: river.half }
    }
  })
  const mesh = new Mesh(geometry, material)
  mesh.name = 'ground'
  return mesh
}
