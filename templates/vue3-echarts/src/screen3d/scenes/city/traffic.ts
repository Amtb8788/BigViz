/**
 * Road light trails: two lanes per road as thin additive quads, all in one geometry. The fragment
 * shader moves comet-shaped streaks along each lane (opposite directions per lane, a per-lane
 * speed and density), so the whole traffic layer is one draw call with no per-frame CPU work.
 */
import { AdditiveBlending, BufferAttribute, BufferGeometry, Color, DoubleSide, Mesh, ShaderMaterial } from 'three'
import { SHARED_GLSL, type CityColors, type SharedUniforms } from './colors'
import { CITY, type CityLayout } from './layout'

const vertex = /* glsl */ `
attribute float aAlong;
attribute float aAcross;
attribute vec3 aLane;
varying vec3 vWorld;
varying float vAlong;
varying float vAcross;
varying vec3 vLane;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  vAlong = aAlong;
  vAcross = aAcross;
  vLane = aLane;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`

const fragment = /* glsl */ `
${SHARED_GLSL}
uniform vec3 uHead;
uniform vec3 uTail;
uniform vec3 uWarm;
uniform float uRadius;
varying vec3 vWorld;
varying float vAlong;
varying float vAcross;
/** x: direction (±1), y: lane seed, z: major (0/1) */
varying vec3 vLane;

void main() {
  float major = vLane.z;
  float speed = mix(70.0, 150.0, fract(vLane.y * 7.31)) * (1.0 + major * 0.4);
  float spacing = mix(150.0, 320.0, fract(vLane.y * 3.17)) * (1.0 - major * 0.45);
  float s = vAlong * vLane.x - uTime * speed + vLane.y * 1000.0;
  float cell = floor(s / spacing);
  float f = fract(s / spacing);
  // Skip some cars so the rhythm is irregular
  float alive = step(0.3, hash12(vec2(cell, vLane.y * 91.0)));
  // f near 1 = head, trail fades behind it
  float len = mix(0.18, 0.4, major);
  float trail = smoothstep(1.0 - len, 1.0, f) * (1.0 - smoothstep(0.985, 1.0, f));
  float head = smoothstep(0.96, 0.99, f) * (1.0 - smoothstep(0.995, 1.0, f));
  float across = 1.0 - abs(vAcross);
  across *= across;
  vec3 col = mix(uTail, uHead, trail * trail) * trail + uHead * head * 1.5;
  // Most lanes cool; a few warm lanes (tail lights)
  col = mix(col, col * uWarm * 1.4, step(0.82, fract(vLane.y * 13.7)));
  float edge = 1.0 - smoothstep(uRadius * 0.9, uRadius * 1.08, length(vWorld.xz));
  float fog = 1.0 - fogFactor(distance(vWorld, cameraPosition));
  float k = alive * across * edge * fog * uGrow * (0.75 + 0.75 * major);
  gl_FragColor = vec4(col * k * 1.4, 1.0);
}
`

/** Build the traffic layer for a layout */
export function createTraffic(layout: CityLayout, colors: CityColors, shared: SharedUniforms): Mesh {
  const laneOffset = CITY.road * 0.22
  const laneWidth = 2.6
  const y = 0.6
  const lanes = layout.roads.flatMap((road, i) => [
    { road, dir: 1, off: -laneOffset, seed: (i * 2 + 0.5) / (layout.roads.length * 2) },
    { road, dir: -1, off: laneOffset, seed: (i * 2 + 1.5) / (layout.roads.length * 2) }
  ])
  const n = lanes.length
  const pos = new Float32Array(n * 4 * 3)
  const along = new Float32Array(n * 4)
  const across = new Float32Array(n * 4)
  const lane = new Float32Array(n * 4 * 3)
  const index = new Uint32Array(n * 6)

  lanes.forEach((l, i) => {
    const { road } = l
    const c = road.offset + l.off
    const w = laneWidth / 2
    // Corners: (from, -w) (to, -w) (to, +w) (from, +w) in road space
    const corners: [number, number][] = [
      [road.from, -w],
      [road.to, -w],
      [road.to, w],
      [road.from, w]
    ]
    corners.forEach(([a, b], k) => {
      const v = i * 4 + k
      const x = road.axis === 'x' ? a : c + b
      const z = road.axis === 'x' ? c + b : a
      pos.set([x, y, z], v * 3)
      along[v] = a
      across[v] = b / w
      lane.set([l.dir, l.seed, road.major ? 1 : 0], v * 3)
    })
    const v0 = i * 4
    index.set([v0, v0 + 2, v0 + 1, v0, v0 + 3, v0 + 2], i * 6)
  })

  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(pos, 3))
  geometry.setAttribute('aAlong', new BufferAttribute(along, 1))
  geometry.setAttribute('aAcross', new BufferAttribute(across, 1))
  geometry.setAttribute('aLane', new BufferAttribute(lane, 3))
  geometry.setIndex(new BufferAttribute(index, 1))

  const material = new ShaderMaterial({
    vertexShader: vertex,
    fragmentShader: fragment,
    uniforms: {
      ...shared,
      // Head: accent pushed towards the text colour (white-hot)
      uHead: { value: colors.accent.clone().lerp(new Color(colors.palette.text), 0.5) },
      uTail: { value: colors.primary },
      uWarm: { value: colors.warm },
      uRadius: { value: CITY.radius }
    },
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    side: DoubleSide
  })
  const mesh = new Mesh(geometry, material)
  mesh.frustumCulled = false
  mesh.renderOrder = 2
  mesh.name = 'traffic'
  return mesh
}
