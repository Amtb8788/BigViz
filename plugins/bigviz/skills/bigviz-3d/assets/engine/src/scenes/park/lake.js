// Park pack - central lake: granite coping + stepped revetment, mirror water (three.js Water
// with a procedural normal map; plain PBR water on low quality / in node), lakeside path with
// lawn ring (gaps where the walks join), bollard lights, benches, and a programmed fountain
// (centre column + 12 arcing ring jets, foam). Fountain = GPU points simulated on the CPU,
// white spray by day, colour-cycling additive light at night. Origin = lake centre.

import * as THREE from 'three'
import { Water } from 'three/examples/jsm/objects/Water.js'
import { surfaceMat, lightMat, colorMat } from '../../render/materials.js'
import { fbm, normalFromHeight, radialTexture } from '../../render/textures.js'
import { Quads, boxes, cyls, M } from './kit.js'
import { LAKE } from './layout.js'

const V = (x, y, z) => new THREE.Vector3(x, y, z)
const SEG = 160
const WATER_Y = -0.32
const COPE_Y = 0.32

/** ellipse ring (or arc a0..a1 in degrees) as a flat mesh at height y; x/z world-local */
function ellipseRing(r0x, r0z, r1x, r1z, y, material, { a0 = 0, a1 = 360, tile = 3 } = {}) {
  const full = a1 - a0 >= 360
  const pts = (rx, rz, from, to, n) => Array.from({ length: n + 1 }, (_, i) => { const a = ((from + ((to - from) * i) / n) * Math.PI) / 180; return new THREE.Vector2(rx * Math.cos(a), -rz * Math.sin(a)) })
  let shape
  if (full) {
    shape = new THREE.Shape(pts(r1x, r1z, 0, 360, SEG).slice(0, -1))
    shape.holes.push(new THREE.Path(pts(r0x, r0z, 0, 360, SEG).slice(0, -1).reverse()))
  } else {
    const n = Math.max(6, Math.round(((a1 - a0) / 360) * SEG))
    shape = new THREE.Shape([...pts(r1x, r1z, a0, a1, n), ...pts(r0x, r0z, a1, a0, n)])
  }
  const g = new THREE.ShapeGeometry(shape, 1)
  g.rotateX(-Math.PI / 2)
  g.translate(0, y, 0)
  const p = g.attributes.position
  const uv = new Float32Array(p.count * 2)
  for (let i = 0; i < p.count; i++) { uv[i * 2] = p.getX(i) / tile; uv[i * 2 + 1] = p.getZ(i) / tile }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
  const m = new THREE.Mesh(g, material)
  m.receiveShadow = true
  return m
}

/** filled ellipse at y */
function ellipseDisc(rx, rz, y, material) {
  const g = new THREE.ShapeGeometry(new THREE.Shape(Array.from({ length: SEG }, (_, i) => { const a = (i / SEG) * Math.PI * 2; return new THREE.Vector2(rx * Math.cos(a), -rz * Math.sin(a)) })), 1)
  g.rotateX(-Math.PI / 2)
  g.translate(0, y, 0)
  const m = new THREE.Mesh(g, material)
  m.receiveShadow = true
  return m
}

let normals = null
function waterNormals() {
  if (normals) return normals
  const N = 512
  const h = fbm(N, { scale: 6, octaves: 5, seed: 909 })
  const t = new THREE.CanvasTexture(normalFromHeight(h, N, 9))
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  normals = t
  return t
}

/** mirror water (browser): replaces the placeholder disc; returns the Water mesh */
export function upgradeWater(rig, quality = 'high') {
  if (quality === 'low' || !rig.water) return null
  const geo = rig.water.geometry
  const res = quality === 'high' ? 1024 : 512
  const w = new Water(geo, { textureWidth: res, textureHeight: res, waterNormals: waterNormals(), sunDirection: new THREE.Vector3(0.4, 0.8, 0.3), sunColor: 0xfff2dd, waterColor: 0x0e2a33, distortionScale: 2.6, fog: true, alpha: 1 })
  w.material.uniforms.size.value = 5.5
  w.receiveShadow = true
  w.name = 'lake.water'
  // one mirror render per frame (GTAO / thumbnails would re-trigger it)
  const before = w.onBeforeRender
  w.onBeforeRender = function (r, s, c, ...rest) {
    if (rig.mirrorFrame === rig.frame) return
    rig.mirrorFrame = rig.frame
    before.call(this, r, s, c, ...rest)
  }
  // Water mirrors about its local +z: keep the XY-plane geometry and lay the mesh flat
  w.position.copy(rig.water.position)
  w.rotation.copy(rig.water.rotation)
  rig.water.parent.add(w)
  rig.water.parent.remove(rig.water)
  rig.water = w
  rig.mirror = w
  return w
}
// ---------------------------------------------------------------- fountain
const VERT = `attribute float aSize;
attribute float aAlpha;
uniform float uScale;
varying float vAlpha;
#include <fog_pars_vertex>
void main() {
  vAlpha = aAlpha;
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = aSize * uScale / -mvPosition.z;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`
const FRAG = `uniform sampler2D uMap;
uniform vec3 uColor;
varying float vAlpha;
#include <fog_pars_fragment>
void main() {
  float a = texture2D(uMap, gl_PointCoord).a * vAlpha;
  if (a < 0.01) discard;
  gl_FragColor = vec4(uColor, a);
  #include <colorspace_fragment>
  #include <fog_fragment>
}`
export const JETS = 12
const FR = 6

class Fountain {
  constructor(max = 2600) {
    this.max = max
    this.n = 0
    this.p = new Float32Array(max * 3)
    this.v = new Float32Array(max * 3)
    this.age = new Float32Array(max)
    this.life = new Float32Array(max)
    this.kind = new Uint8Array(max)
    this.size = new Float32Array(max)
    this.alpha = new Float32Array(max)
    this.acc = [0, 0]
    this.t = 0
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(this.p, 3).setUsage(THREE.DynamicDrawUsage))
    geo.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage))
    geo.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage))
    geo.setDrawRange(0, 0)
    geo.boundingSphere = new THREE.Sphere(V(0, 6, 0), 16)
    const make = (additive) => new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uMap: { value: null }, uScale: { value: 1000 }, uColor: { value: new THREE.Color() } }]),
      vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false, fog: true,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending
    })
    this.day = make(false)
    this.night = make(true)
    for (const m of [this.day, this.night]) m.uniforms.uMap.value = radialTexture()
    this.pDay = new THREE.Points(geo, this.day)
    this.pNight = new THREE.Points(geo, this.night)
    for (const p of [this.pDay, this.pNight]) { p.renderOrder = 6; p.name = 'fountain' }
    this.group = new THREE.Group()
    this.group.add(this.pDay, this.pNight)
  }

  /** programme (40 s loop): centre column, ring arcs, both, pulsing centre */
  program(t) {
    const k = t % 40
    if (k < 10) return [0.75 + 0.25 * Math.sin(t * 0.8), 0]
    if (k < 20) return [0, 1]
    if (k < 30) return [1, 0.8]
    return [Math.sin(t * 2.6) > 0 ? 1 : 0, 0.45]
  }

  spawn(kind, x, y, z, vx, vy, vz, life) {
    if (this.n >= this.max) return
    const i = this.n++
    this.p.set([x, y, z], i * 3)
    this.v.set([vx, vy, vz], i * 3)
    this.kind[i] = kind
    this.age[i] = 0
    this.life[i] = life
  }

  /** @param {{ on:boolean, night:number, viewH:number, hue:number, wind:number }} o */
  update(dt, o) {
    this.t += dt
    const r = Math.random
    const [c, ring] = o.on ? this.program(this.t) : [0, 0]
    if (dt > 0) {
      this.acc[0] += dt * 380 * c
      this.acc[1] += dt * 46 * ring
      for (; this.acc[0] >= 1; this.acc[0]--) {
        const a = r() * Math.PI * 2
        const s = r() * 0.25
        this.spawn(0, Math.cos(a) * s, WATER_Y + 0.1, Math.sin(a) * s, Math.cos(a) * r() * 0.5, 13.5 + r() * 2.2 - (1 - c) * 4, Math.sin(a) * r() * 0.5, 4)
      }
      for (; this.acc[1] >= 1; this.acc[1]--) {
        for (let j = 0; j < JETS; j++) {
          const a = (j / JETS) * Math.PI * 2
          const sp = 0.85 + r() * 0.3
          this.spawn(1, Math.cos(a) * FR, WATER_Y + 0.05, Math.sin(a) * FR, -Math.cos(a) * 2.9 * sp, 9.2 * sp, -Math.sin(a) * 2.9 * sp, 3)
        }
      }
    }
    const g = 9.8
    let i = 0
    while (i < this.n) {
      this.age[i] += dt
      const k = this.kind[i]
      const j = i * 3
      if (k !== 2) {
        this.v[j] += (r() - 0.5) * dt * 1.2 + o.wind * dt * 0.6
        this.v[j + 2] += (r() - 0.5) * dt * 1.2
        this.v[j + 1] -= g * dt
      } else this.v[j + 1] -= 0.4 * dt
      this.p[j] += this.v[j] * dt
      this.p[j + 1] += this.v[j + 1] * dt
      this.p[j + 2] += this.v[j + 2] * dt
      const dead = this.age[i] >= this.life[i]
      if (dead || (k !== 2 && this.p[j + 1] < WATER_Y && this.v[j + 1] < 0)) {
        if (!dead && r() < 0.35) this.spawn(2, this.p[j], WATER_Y + 0.05, this.p[j + 2], 0, 0.5 + r() * 0.6, 0, 0.6 + r() * 0.5)
        this._kill(i)
        continue
      }
      const t = this.age[i] / this.life[i]
      const hgt = Math.max(0, this.p[j + 1] - WATER_Y)
      if (k === 0) { this.size[i] = 0.22 + Math.min(1, hgt / 10) * 0.75; this.alpha[i] = 0.5 }
      else if (k === 1) { this.size[i] = 0.16 + Math.min(1, this.age[i] / 1.6) * 0.4; this.alpha[i] = 0.46 }
      else { this.size[i] = 0.5 + t * 1.2; this.alpha[i] = 0.32 * (1 - t) }
      i++
    }
    const geo = this.pDay.geometry
    geo.setDrawRange(0, this.n)
    for (const key of ['position', 'aSize', 'aAlpha']) geo.attributes[key].needsUpdate = true
    const night = o.night > 0.45
    this.pDay.visible = !night && this.n > 0
    this.pNight.visible = night && this.n > 0
    for (const m of [this.day, this.night]) m.uniforms.uScale.value = o.viewH * 1.25
    this.day.uniforms.uColor.value.setRGB(0.86, 0.9, 0.94)
    this.night.uniforms.uColor.value.setHSL(o.hue, 0.75, 0.5).multiplyScalar(1.4)
  }

  _kill(i) {
    const j = --this.n
    if (i === j) return
    for (let q = 0; q < 3; q++) { this.p[i * 3 + q] = this.p[j * 3 + q]; this.v[i * 3 + q] = this.v[j * 3 + q] }
    this.age[i] = this.age[j]; this.life[i] = this.life[j]; this.kind[i] = this.kind[j]; this.size[i] = this.size[j]; this.alpha[i] = this.alpha[j]
  }

  clear() { this.n = 0 }
}
// ---------------------------------------------------------------- lake prefab
const GAPS = [0, 45, 90, 135, 180, 225, 270, 315]
/** half gap (deg) at angle a so the opening in the lawn ring is ~4.4 m wide */
function halfGap(a) {
  const t = (a * Math.PI) / 180
  const r = Math.hypot(LAKE.lawn.rx * Math.sin(t), LAKE.lawn.rz * Math.cos(t))
  return ((2.2 / r) * 180) / Math.PI
}
export const ISLAND = { x: -24, z: LAKE.z - 6, rx: 6, rz: 4 }
/** bench seats (world) facing the lake: { x, z, yaw } */
export const BENCHES = GAPS.map((a) => a + 22.5).map((a) => {
  const t = (a * Math.PI) / 180
  const k = 1.02
  const x = LAKE.path.rx * k * Math.cos(t) * 1.1
  const z = LAKE.path.rz * k * Math.sin(t) * 1.1
  return { x: +x.toFixed(2), z: +(LAKE.z + z).toFixed(2), yaw: Math.atan2(-x, -z), a }
})

export function parkLake() {
  const g = new THREE.Group()
  const { rx, rz, cope } = LAKE
  const PW = LAKE.path.w / 2
  // paving surround (pit rect minus the coping ellipse), world-aligned paving uv
  const s = new THREE.Shape([new THREE.Vector2(-41.5, -25.5), new THREE.Vector2(41.5, -25.5), new THREE.Vector2(41.5, 25.5), new THREE.Vector2(-41.5, 25.5)])
  s.holes.push(new THREE.Path(Array.from({ length: SEG }, (_, i) => { const a = (i / SEG) * Math.PI * 2; return new THREE.Vector2((rx + cope) * Math.cos(a), (rz + cope) * Math.sin(a)) })))
  const sg = new THREE.ExtrudeGeometry(s, { depth: 0.3, bevelEnabled: false, curveSegments: 4 })
  sg.rotateX(-Math.PI / 2)
  sg.translate(0, PAVE - 0.3, 0)
  const sp = sg.attributes.position
  const suv = sg.attributes.uv
  for (let i = 0; i < sp.count; i++) suv.setXY(i, sp.getX(i) / 8, (sp.getZ(i) + LAKE.z) / 8)
  const sm = new THREE.Mesh(sg, surfaceMat('paving', 1))
  sm.receiveShadow = true
  g.add(sm)
  // granite coping (raised 17 cm), revetment wall down into the water, dark lake bed
  const cs = new THREE.Shape(Array.from({ length: SEG }, (_, i) => { const a = (i / SEG) * Math.PI * 2; return new THREE.Vector2((rx + cope) * Math.cos(a), (rz + cope) * Math.sin(a)) }))
  cs.holes.push(new THREE.Path(Array.from({ length: SEG }, (_, i) => { const a = (i / SEG) * Math.PI * 2; return new THREE.Vector2(rx * Math.cos(a), rz * Math.sin(a)) })))
  const cg = new THREE.ExtrudeGeometry(cs, { depth: 0.45, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.04, bevelSegments: 1, curveSegments: 4 })
  cg.rotateX(-Math.PI / 2)
  cg.translate(0, COPE_Y - 0.45, 0)
  const cm = new THREE.Mesh(cg, M.granite())
  cm.receiveShadow = cm.castShadow = true
  g.add(cm)
  const Q = new Quads()
  for (let i = 0; i < SEG; i++) {
    const a0 = (i / SEG) * Math.PI * 2
    const a1 = ((i + 1) / SEG) * Math.PI * 2
    const p0 = [rx * Math.cos(a0), rz * Math.sin(a0)]
    const p1 = [rx * Math.cos(a1), rz * Math.sin(a1)]
    const am = (a0 + a1) / 2
    const n = new THREE.Vector3(-Math.cos(am) / rx, 0, -Math.sin(am) / rz).normalize()
    Q.wall(p0[0], p0[1], p1[0], p1[1], -1.3, COPE_Y - 0.4, [n.x, 0, n.z], 1.5, 1.5)
  }
  g.add(Q.mesh(colorMat('#6d6a64', 0.85), false))
  g.add(ellipseDisc(rx, rz, -1.2, colorMat('#1d2a2a', 0.95)))
  // water placeholder (PBR); upgradeWater() swaps in the mirror shader in the browser
  const wg = new THREE.ShapeGeometry(new THREE.Shape(Array.from({ length: SEG }, (_, i) => { const a = (i / SEG) * Math.PI * 2; return new THREE.Vector2(rx * Math.cos(a), rz * Math.sin(a)) })), 1)
  const water = new THREE.Mesh(wg, colorMat('#1b3640', 0.06, 0.4))
  water.rotation.x = -Math.PI / 2
  water.position.y = WATER_Y
  water.receiveShadow = true
  g.add(water)
  // lakeside path (light granite) + lawn ring with gaps at the walk junctions
  g.add(ellipseRing(LAKE.path.rx - PW - 0.2, LAKE.path.rz - PW - 0.2, LAKE.path.rx + PW, LAKE.path.rz + PW, PAVE + 0.02, surfaceMat('paving', 1, '#d8d2c6'), { tile: 8 }))
  const grass = surfaceMat('grass', 1)
  for (let k = 0; k < GAPS.length; k++) {
    const a0 = GAPS[k] + halfGap(GAPS[k])
    const a1 = GAPS[k] + 45 - halfGap(GAPS[k] + 45)
    g.add(ellipseRing(LAKE.path.rx + PW, LAKE.path.rz + PW, LAKE.lawn.rx, LAKE.lawn.rz, PAVE + 0.04, grass, { a0, a1, tile: 3 }))
  }
  // benches on the lawn edge facing the water, bollard lights on the path edge
  const wood = []
  const steel = []
  for (const b of BENCHES) {
    const lx = b.x
    const lz = b.z - LAKE.z
    const c = Math.cos(b.yaw), sn = Math.sin(b.yaw)
    const at = (u, v) => [lx + c * u + sn * v, lz - sn * u + c * v]
    for (const [u, v, w, h, d, y] of [[0, 0, 1.9, 0.06, 0.48, 0.45], [0, -0.26, 1.9, 0.4, 0.05, 0.72]]) { const [x, z] = at(u, v); wood.push([x, PAVE + y, z, w, h, d, b.yaw]) }
    for (const u of [-0.8, 0.8]) { const [x, z] = at(u, 0); steel.push([x, PAVE + 0.22, z, 0.06, 0.45, 0.45, b.yaw]) }
  }
  const glows = []
  const heads = []
  for (let a = 7.5; a < 360; a += 15) {
    if (GAPS.some((q) => Math.abs(((a - q + 540) % 360) - 180) < halfGap(q) + 1)) continue
    const t = (a * Math.PI) / 180
    const x = (LAKE.path.rx + PW + 0.35) * Math.cos(t)
    const z = (LAKE.path.rz + PW + 0.35) * Math.sin(t)
    steel.push([x, PAVE + 0.45, z, 0.16, 0.9, 0.16])
    heads.push([x, PAVE + 0.95, z, 0.2, 0.12, 0.2])
    glows.push({ pos: V(x, PAVE + 0.95, z), group: 'street', color: '#ffd7a0', size: 0.9, pool: 2.4 })
  }
  g.add(boxes(wood, M.timber()), boxes(steel, M.black()), boxes(heads, lightMat('#ffe2b8', 2.6, 'street'), { cast: false }))
  // island with boulder edge; fountain nozzle ring + underwater light ring
  const isl = ellipseDisc(ISLAND.rx, ISLAND.rz, 0.12, grass)
  isl.position.set(ISLAND.x, 0, ISLAND.z - LAKE.z)
  const base = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1.42, 24), colorMat('#5f5a50', 0.95))
  base.scale.set(ISLAND.rx, 1, ISLAND.rz)
  base.position.set(ISLAND.x, -1.3 + 0.71, ISLAND.z - LAKE.z)
  g.add(isl, base)
  const rocks = []
  for (let i = 0; i < 22; i++) { const a = (i / 22) * Math.PI * 2; rocks.push([ISLAND.x + Math.cos(a) * ISLAND.rx, -0.5, ISLAND.z - LAKE.z + Math.sin(a) * ISLAND.rz, 1.1 + (i % 3) * 0.3, 1.1, 0.9 + (i % 2) * 0.4, a]) }
  g.add(boxes(rocks, colorMat('#7a756c', 0.9)))
  const noz = []
  for (let j = 0; j < JETS; j++) { const a = (j / JETS) * Math.PI * 2; noz.push([Math.cos(a) * FR, WATER_Y - 0.2, Math.sin(a) * FR, 0.22, 0.26, 10]) }
  noz.push([0, WATER_Y - 0.2, 0, 0.5, 0.3, 14])
  g.add(cyls(noz, M.steel()))
  const uw = new THREE.MeshStandardMaterial({ color: '#111', emissive: '#7fc8ff', emissiveIntensity: 0, roughness: 0.4, name: 'fountain.lights' })
  const lamps = []
  for (let j = 0; j < JETS; j++) { const a = ((j + 0.5) / JETS) * Math.PI * 2; lamps.push([Math.cos(a) * (FR - 0.6), WATER_Y - 0.02, Math.sin(a) * (FR - 0.6), 0.35, 0.04, 0.35]) }
  g.add(boxes(lamps, uw, { cast: false }))
  const fountain = new Fountain(3200)
  g.add(fountain.group)
  g.userData.glows = glows
  return { object: g, rig: { water, fountain, lamps: uw, frame: 0, mirrorFrame: -1 } }
}
const PAVE = 0.15
