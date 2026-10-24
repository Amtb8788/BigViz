// Tunnel pack - the mountain: one non-uniform height-field mesh out to the horizon (dense
// around the portals, coarse far out; duplicated rows / columns give the headwall and wing-
// wall cliffs), vertex colours by slope / height / cut, a river, instanced conifers and
// broadleaf trees (near ones cast shadows) and rock outcrops on the steep faces.

import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { heightAt, isCut, PZ, XL, XR, W2, TOE, fbm2, smooth } from './geom.js'
import { terrainMat, outcropMat } from './mats.js'
import { mat } from '../../render/materials.js'
import { createRng } from '../../core/rng.js'

const EPS = 0.01

function axis(core, step, far, extra) {
  const v = new Set()
  for (let x = -core; x <= core + 1e-6; x += step) v.add(+x.toFixed(3))
  let s = core, d = step
  while (s < far) { d *= 1.13; s += d; v.add(+s.toFixed(2)); v.add(-(+s.toFixed(2))) }
  for (const e of extra) { v.add(+(e - EPS).toFixed(4)); v.add(+(e + EPS).toFixed(4)) }
  return [...v].sort((a, b) => a - b)
}

const C = (h) => new THREE.Color(h)
const COL = { soil: C('#7d6c57'), mud: C('#5a5145'), grass: C('#5f6f3c'), forest: C('#3f4c2b'), rock: C('#7b756a'), cut: C('#6f7a48'), scree: C('#8a8274') }

/** height field + vertex colours */
function heightField() {
  const xs = axis(220, 2, 3200, [XL - W2, XL + W2, XR - W2, XR + W2])
  const zs = axis(220, 2, 3200, [PZ])
  const nx = xs.length, nz = zs.length
  const pos = new Float32Array(nx * nz * 3)
  const uv = new Float32Array(nx * nz * 2)
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const k = j * nx + i
    const x = xs[i], z = zs[j]
    pos[k * 3] = x; pos[k * 3 + 1] = heightAt(x, z); pos[k * 3 + 2] = z
    uv[k * 2] = x; uv[k * 2 + 1] = z
  }
  const idx = []
  for (let j = 0; j < nz - 1; j++) for (let i = 0; i < nx - 1; i++) {
    // headwall openings: the cliff strip across z = PZ inside a notch is the headwall mesh
    const zc = (zs[j] + zs[j + 1]) / 2
    const xc = (xs[i] + xs[i + 1]) / 2
    if (Math.abs(zc - PZ) < EPS * 2 && (Math.abs(xc - XL) < W2 || Math.abs(xc - XR) < W2)) continue
    const a = j * nx + i, b = a + 1, c = a + nx, d = c + 1
    idx.push(a, c, b, b, c, d)
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
  g.setIndex(idx)
  g.computeVertexNormals()
  const n = g.attributes.normal
  const col = new Float32Array(nx * nz * 3)
  const c = new THREE.Color()
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const k = j * nx + i
    const x = xs[i], z = zs[j], h = pos[k * 3 + 1]
    const slope = 1 - n.getY(k)
    const nz2 = fbm2(x / 23, z / 23)
    if (h < -0.6) c.copy(COL.mud)
    else if (z > PZ && h < 0.4) c.copy(COL.soil).lerp(COL.mud, smooth(-0.2, 0.3, nz2) * 0.5)
    else if (isCut(x, z)) c.copy(z > PZ ? COL.grass : COL.cut)
    else {
      c.copy(COL.forest).lerp(COL.grass, smooth(-0.1, 0.25, nz2))
      c.lerp(COL.rock, smooth(0.28, 0.55, slope) + smooth(150, 260, h) * 0.6)
      if (h < 6 && z > PZ) c.lerp(COL.soil, 0.5)
    }
    const v = 0.92 + fbm2(x / 7, z / 7) * 0.35
    col[k * 3] = c.r * v; col[k * 3 + 1] = c.g * v; col[k * 3 + 2] = c.b * v
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3))
  g.computeBoundingSphere()
  return g
}

// ---------------------------------------------------------------- vegetation
function conifer() {
  const parts = [
    new THREE.CylinderGeometry(0.12, 0.18, 2.2, 5).translate(0, 1.1, 0),
    new THREE.ConeGeometry(1.6, 3.6, 7, 1, true).translate(0, 3.4, 0),
    new THREE.ConeGeometry(1.15, 3, 7, 1, true).translate(0, 5.3, 0),
    new THREE.ConeGeometry(0.7, 2.2, 6, 1, true).translate(0, 6.9, 0)
  ]
  const cols = ['#4a3a2c', '#2f4426', '#33492a', '#3a512e']
  return paint(parts, cols)
}
function broadleaf() {
  const a = new THREE.IcosahedronGeometry(2.1, 1)
  jitter(a, 0.35, 5)
  const b = new THREE.IcosahedronGeometry(1.5, 0)
  jitter(b, 0.3, 6)
  const parts = [new THREE.CylinderGeometry(0.14, 0.22, 2.6, 5).translate(0, 1.3, 0), a.translate(0, 3.9, 0), b.translate(0.9, 4.9, 0.4)]
  return paint(parts, ['#4a3a2c', '#4d6230', '#58703a'])
}
function boulder() {
  const g = new THREE.DodecahedronGeometry(1, 1)
  jitter(g, 0.32, 7)
  g.scale(1, 0.62, 0.9)
  return g
}
function jitter(g, k, seed) {
  const p = g.attributes.position
  const rng = createRng(seed)
  const m = new Map()
  for (let i = 0; i < p.count; i++) {
    const key = `${p.getX(i).toFixed(3)},${p.getY(i).toFixed(3)},${p.getZ(i).toFixed(3)}`
    if (!m.has(key)) m.set(key, 1 + rng.range(-k, k))
    const s = m.get(key)
    p.setXYZ(i, p.getX(i) * s, p.getY(i) * s, p.getZ(i) * s)
  }
  g.computeVertexNormals()
}
function paint(parts, cols) {
  const out = parts.map((g, i) => {
    const x = g.index ? g.toNonIndexed() : g
    const c = new THREE.Color(cols[i])
    const n = x.attributes.position.count
    const arr = new Float32Array(n * 3)
    for (let k = 0; k < n; k++) { arr[k * 3] = c.r; arr[k * 3 + 1] = c.g; arr[k * 3 + 2] = c.b }
    x.setAttribute('color', new THREE.BufferAttribute(arr, 3))
    for (const a of Object.keys(x.attributes)) if (!['position', 'normal', 'color'].includes(a)) x.deleteAttribute(a)
    return x
  })
  const g = mergeGeometries(out)
  g.computeVertexNormals()
  return g
}

let vegMat
const veg = () => (vegMat ??= new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.88, metalness: 0, name: 'tunnel.veg' }))

function slopeAt(x, z) {
  const d = 1.5
  const gx = (heightAt(x + d, z) - heightAt(x - d, z)) / (2 * d)
  const gz = (heightAt(x, z + d) - heightAt(x, z - d)) / (2 * d)
  return Math.hypot(gx, gz)
}

function scatter({ x0, x1, z0, z1, step, scale, rng, keep }) {
  const out = []
  for (let z = z0; z < z1; z += step) for (let x = x0; x < x1; x += step) {
    const px = x + rng.range(-0.45, 0.45) * step
    const pz = z + rng.range(-0.45, 0.45) * step
    const r = keep(px, pz)
    if (!r) continue
    out.push({ x: px, z: pz, y: heightAt(px, pz) - 0.3, s: scale[0] + rng.next() * (scale[1] - scale[0]), ry: rng.range(0, 6.3), tint: 0.82 + rng.next() * 0.3, kind: r })
  }
  return out
}

function instanced(geo, material, items, cast) {
  const im = new THREE.InstancedMesh(geo, material, Math.max(1, items.length))
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), s = new THREE.Vector3(), c = new THREE.Color()
  items.forEach((it, i) => {
    q.setFromEuler(e.set(it.rx || 0, it.ry, it.rz || 0))
    m.compose(v.set(it.x, it.y, it.z), q, s.set(it.s * (it.sx || 1), it.s * (it.sy || 1), it.s * (it.sz || 1)))
    im.setMatrixAt(i, m)
    im.setColorAt(i, c.setScalar(it.tint))
  })
  im.count = items.length
  im.castShadow = cast
  im.receiveShadow = true
  im.computeBoundingSphere()
  return im
}

/** forest on the natural slopes (not on cuts, not in the yard) */
function forest(rng) {
  const ok = (dense) => (x, z) => {
    if (z > TOE - 3 && z < 190) return null
    if (isCut(x, z)) return null
    const h = heightAt(x, z)
    if (h < 2.5 && z < 190) return null
    const sl = slopeAt(x, z)
    if (sl > 1.05) return null
    const d = fbm2(x / 60, z / 60) + fbm2(x / 13, z / 13) * 0.4
    if (d < (dense ? -0.12 : -0.05)) return null
    return h > 140 || d > 0.12 ? 'c' : 'b'
  }
  const near = scatter({ x0: -230, x1: 230, z0: -330, z1: TOE, step: 7, scale: [0.85, 1.35], rng, keep: ok(true) })
  const far = scatter({ x0: -1600, x1: 1600, z0: -1400, z1: 1300, step: 24, scale: [1.6, 2.6], rng, keep: (x, z) => (Math.abs(x) < 230 && z > -330 && z < 300 ? null : ok(false)(x, z)) })
  const g = new THREE.Group()
  g.name = 'forest'
  for (const [kind, geo] of [['c', conifer()], ['b', broadleaf()]]) {
    g.add(instanced(geo, veg(), near.filter((t) => t.kind === kind), true))
    g.add(instanced(geo, veg(), far.filter((t) => t.kind === kind), false))
  }
  // boulders / outcrops on the steep natural faces and scree at the toe
  const rocks = []
  for (let z = -260; z < TOE; z += 9) for (let x = -200; x < 200; x += 9) {
    const px = x + rng.range(-4, 4), pz = z + rng.range(-4, 4)
    if (isCut(px, pz) || heightAt(px, pz) < 4) continue
    const sl = slopeAt(px, pz)
    if (sl < 0.75 && rng.next() > 0.04) continue
    rocks.push({ x: px, z: pz, y: heightAt(px, pz) - 0.6, s: 1.2 + rng.next() * (sl > 0.9 ? 5 : 2), ry: rng.range(0, 6), rx: rng.range(-0.3, 0.3), tint: 0.8 + rng.next() * 0.3, sy: 0.8 + rng.next() * 0.6 })
  }
  g.add(instanced(boulder(), outcropMat(), rocks, true))
  return g
}

/** the mountain group: height field, river, forest */
export function buildMountain() {
  const rng = createRng(4242)
  const g = new THREE.Group()
  g.name = 'mountain'
  const ground = new THREE.Mesh(heightField(), terrainMat())
  ground.name = 'mountain.ground'
  ground.receiveShadow = true
  ground.castShadow = true
  g.add(ground)
  const water = new THREE.Mesh(new THREE.PlaneGeometry(8000, 60).rotateX(-Math.PI / 2), mat('water'))
  water.position.set(0, -1.3, 168)
  water.receiveShadow = true
  g.add(water)
  g.add(forest(rng))
  return g
}
