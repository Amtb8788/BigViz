/**
 * Atmosphere: a sky dome that fades from fog at the horizon to deep navy overhead with a faint
 * primary glow band, and sparse rising "data motes" (one Points draw call, shader-animated).
 */
import { AdditiveBlending, BackSide, BufferAttribute, BufferGeometry, Mesh, Points, ShaderMaterial, SphereGeometry } from 'three'
import { mulberry32 } from '@/kit/core/random'
import { SHARED_GLSL, type CityColors, type SharedUniforms } from './colors'
import { CITY } from './layout'

export function createSky(colors: CityColors): Mesh {
  const geometry = new SphereGeometry(9000, 32, 16)
  const material = new ShaderMaterial({
    side: BackSide,
    depthWrite: false,
    uniforms: {
      uFog: { value: colors.fog },
      uTop: { value: colors.fog.clone().multiplyScalar(0.35) },
      uGlow: { value: colors.primary }
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uFog;
      uniform vec3 uTop;
      uniform vec3 uGlow;
      varying vec3 vDir;
      void main() {
        float h = max(vDir.y, 0.0);
        vec3 col = mix(uFog, uTop, smoothstep(0.0, 0.5, h));
        col += uGlow * exp(-h * 14.0) * 0.18;
        gl_FragColor = vec4(col, 1.0);
      }`
  })
  const sky = new Mesh(geometry, material)
  sky.name = 'sky'
  sky.renderOrder = -1
  sky.frustumCulled = false
  return sky
}

export function createMotes(seed: number, colors: CityColors, shared: SharedUniforms, count = 500): Points<BufferGeometry, ShaderMaterial> {
  const rnd = mulberry32(seed ^ 0x9e3779b9)
  const pos = new Float32Array(count * 3)
  const rand = new Float32Array(count)
  for (let i = 0; i < count; i++) {
    const a = rnd() * Math.PI * 2
    const r = Math.sqrt(rnd()) * CITY.radius * 1.05
    pos.set([Math.cos(a) * r, rnd() * 500, Math.sin(a) * r], i * 3)
    rand[i] = rnd()
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(pos, 3))
  geometry.setAttribute('aRand', new BufferAttribute(rand, 1))
  const material = new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    uniforms: { ...shared, uColor: { value: colors.accent }, uScale: { value: 1 } },
    vertexShader: /* glsl */ `
      uniform float uTime;
      uniform float uScale;
      attribute float aRand;
      varying float vAlpha;
      varying vec3 vWorld;
      void main() {
        vec3 p = position;
        float life = fract(p.y / 500.0 + uTime * (0.02 + aRand * 0.03));
        p.y = life * 500.0;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        float depth = -mv.z;
        // Fade out motes near the camera: perspective sizing would otherwise blow them up into
        // screen-filling additive blobs that wash out the whole scene
        float nearFade = smoothstep(120.0, 420.0, depth);
        vAlpha = sin(life * 3.14159) * (0.4 + aRand * 0.6) * nearFade;
        vWorld = (modelMatrix * vec4(p, 1.0)).xyz;
        gl_PointSize = min((2.0 + aRand * 3.0) * uScale * (900.0 / max(depth, 1.0)), 6.0 * uScale);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      ${SHARED_GLSL}
      uniform vec3 uColor;
      varying float vAlpha;
      varying vec3 vWorld;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float a = (1.0 - smoothstep(0.1, 0.5, d)) * vAlpha;
        a *= 1.0 - fogFactor(distance(vWorld, cameraPosition));
        gl_FragColor = vec4(uColor * a * 0.8, 1.0);
      }`
  })
  const points = new Points(geometry, material)
  points.frustumCulled = false
  points.renderOrder = 5
  points.name = 'motes'
  return points
}
