// Prefab building blocks: cached primitives, shadow flags, pivots and static baking.
// Prefabs are pure functions of params -> { object, rig }. They never contain behaviour.

import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { vcMaterials, styleVC, materialStyle } from '../render/materials.js'

const geoCache = new Map()

function cached(key, make) {
  if (!geoCache.has(key)) {
    const g = make()
    g.userData.shared = true
    geoCache.set(key, g)
  }
  return geoCache.get(key)
}

/**
 * Box mesh. `base: true` puts the origin on the bottom face (handy for anything standing).
 * p: { x, y, z, rx, ry, rz, base, round, cast, recv }
 */
export function box(w, h, d, material, p = {}) {
  const r = p.round || 0
  const key = `box:${w}:${h}:${d}:${p.base ? 1 : 0}:${r}`
  const geo = cached(key, () => {
    const g = r > 0 ? new RoundedBoxGeometry(w, h, d, 2, r) : new THREE.BoxGeometry(w, h, d)
    if (p.base) g.translate(0, h / 2, 0)
    return g
  })
  return place(new THREE.Mesh(geo, material), p)
}

/** Cylinder; axis = 'y' | 'x' | 'z' */
export function cyl(rTop, rBot, h, material, p = {}) {
  const seg = p.seg || 14
  const key = `cyl:${rTop}:${rBot}:${h}:${seg}:${p.base ? 1 : 0}:${p.axis || 'y'}`
  const geo = cached(key, () => {
    const g = new THREE.CylinderGeometry(rTop, rBot, h, seg)
    if (p.base) g.translate(0, h / 2, 0)
    if (p.axis === 'x') g.rotateZ(Math.PI / 2)
    if (p.axis === 'z') g.rotateX(Math.PI / 2)
    return g
  })
  return place(new THREE.Mesh(geo, material), p)
}

export function sphere(r, material, p = {}) {
  const key = `sph:${r}:${p.seg || 12}:${p.hemi ? 1 : 0}`
  const geo = cached(key, () => new THREE.SphereGeometry(r, p.seg || 12, Math.max(6, (p.seg || 12) >> 1), 0, Math.PI * 2, 0, p.hemi ? Math.PI / 2 : Math.PI))
  return place(new THREE.Mesh(geo, material), p)
}

export function cone(r, h, material, p = {}) {
  const key = `cone:${r}:${h}:${p.seg || 12}:${p.base ? 1 : 0}`
  const geo = cached(key, () => {
    const g = new THREE.ConeGeometry(r, h, p.seg || 12)
    if (p.base) g.translate(0, h / 2, 0)
    return g
  })
  return place(new THREE.Mesh(geo, material), p)
}

/** Thin rod between two points (cables, braces, rails) */
export function rod(a, b, radius, material, seg = 5) {
  const dir = new THREE.Vector3().subVectors(b, a)
  const len = dir.length()
  const m = new THREE.Mesh(cached(`rod:${radius}:${seg}`, () => new THREE.CylinderGeometry(radius, radius, 1, seg).translate(0, 0.5, 0)), material)
  m.scale.y = len
  m.position.copy(a)
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize())
  m.castShadow = true
  return m
}

export function place(mesh, p = {}) {
  mesh.position.set(p.x || 0, p.y || 0, p.z || 0)
  if (p.rx) mesh.rotation.x = p.rx
  if (p.ry) mesh.rotation.y = p.ry
  if (p.rz) mesh.rotation.z = p.rz
  if (p.s) mesh.scale.setScalar(p.s)
  mesh.castShadow = p.cast ?? true
  mesh.receiveShadow = p.recv ?? true
  return mesh
}

/** Group with a pivot position; children are added in pivot space */
export function pivot(name, x = 0, y = 0, z = 0, ...children) {
  const g = new THREE.Group()
  g.name = name
  g.position.set(x, y, z)
  children.forEach((c) => g.add(c))
  return g
}

export function group(...children) {
  const g = new THREE.Group()
  children.forEach((c) => c && g.add(c))
  return g
}

const vcMats = new Map()
/** Shared vertex-colour material per (metal, gloss) class */
function vcMat(metal, gloss) {
  const key = `${metal}:${gloss}`
  if (!vcMats.has(key)) {
    const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: gloss ? 0.22 : 0.62, metalness: metal ? 0.75 : 0.08 })
    m.name = `vc.${key}`
    vcMats.set(key, m)
    vcMaterials.add(styleVC(m))
  }
  return vcMats.get(key)
}

/** Can this mesh be folded into a vertex-coloured batch? (plain colour, no map, not live) */
function colorable(m) {
  return m.isMeshStandardMaterial && !m.map && !m.emissiveMap && !m.transparent && !m.userData.live && !m.userData.owned && !m.vertexColors && m.emissiveIntensity * m.emissive.getHex() === 0
}

const noShadow = (m) => m.isMeshBasicMaterial || m.name === 'decals' || m.name?.startsWith('light.')

/**
 * Merge static meshes under `root` into few draw calls. Meshes below a `dynamic` node are
 * skipped (they are baked separately by bakeTree). colors:true folds plain-colour materials
 * into shared vertex-colour materials (people, vehicles); otherwise one mesh per material.
 */
export function bake(root, { colors = false, name = 'baked' } = {}) {
  root.updateMatrixWorld(true)
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert()
  const buckets = new Map()
  const victims = []
  const col = new THREE.Color()
  root.traverse((o) => {
    if (!o.isMesh || o.isInstancedMesh || o.userData.keep) return
    for (let p = o.parent; p && p !== root; p = p.parent) if (p.userData.dynamic) return
    if (o !== root && o.userData.dynamic) return
    if (Array.isArray(o.material) || o.material.transparent) return
    const g = o.geometry.clone()
    g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld))
    const keep = o.material.vertexColors ? ['position', 'normal', 'uv', 'color'] : ['position', 'normal', 'uv']
    for (const k of Object.keys(g.attributes)) if (!keep.includes(k)) g.deleteAttribute(k)
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2))
    let material = o.material
    if (colors && colorable(material)) {
      col.copy(material.color)
      const n = g.attributes.position.count
      const arr = new Float32Array(n * 3)
      for (let i = 0; i < n; i++) { arr[i * 3] = col.r; arr[i * 3 + 1] = col.g; arr[i * 3 + 2] = col.b }
      g.setAttribute('color', new THREE.Float32BufferAttribute(arr, 3))
      material = vcMat(material.metalness > 0.5, material.roughness < 0.3)
    }
    // realistic: one bucket per material (small cast:false trims cast anyway, halving calls)
    const real = isReal()
    // emissive light parts, decals and unlit meshes add shadow-pass draw calls but no visible shadow
    const cast = (real || o.castShadow) && !noShadow(material)
    const key = material.uuid + (cast ? 'c' : '')
    if (!buckets.has(key)) buckets.set(key, { material, cast, geos: [] })
    buckets.get(key).geos.push(g)
    victims.push(o)
  })
  for (const v of victims) v.parent.remove(v)
  const out = new THREE.Group()
  out.name = name
  for (const b of buckets.values()) {
    const vc = b.geos.some((g) => g.attributes.color)
    const geos = b.geos.map((g) => {
      let x = g.index ? g.toNonIndexed() : g
      if (vc && !x.attributes.color) x.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(x.attributes.position.count * 3).fill(1), 3))
      return x
    })
    const merged = mergeGeometries(geos, false)
    b.geos.forEach((g) => g.dispose())
    if (!merged) continue
    const m = new THREE.Mesh(merged, b.material)
    m.castShadow = b.cast
    m.receiveShadow = true
    m.userData.baked = true
    out.add(m)
  }
  if (out.children.length) root.add(out)
  return out
}

/** Bake the root and every `dynamic` node separately so rigs keep moving parts */
export function bakeTree(root, opts = {}) {
  const nodes = [root]
  root.traverse((o) => { if (o !== root && o.userData.dynamic && !o.isMesh) nodes.push(o) })
  for (const n of nodes) {
    const was = n.userData.dynamic
    n.userData.dynamic = false
    bake(n, opts)
    n.userData.dynamic = was
  }
  return root
}

/** 'realistic' style builds the detailed prefab variants (diorama keeps the toy ones) */
export const isReal = () => materialStyle() === 'realistic'

// Build-time detail level. Prefabs are built before stage.setQuality runs, so the initial
// value comes from ?quality=; setDetail() lets the engine change it for later builds.
let DETAIL = (typeof location !== 'undefined' && new URLSearchParams(location.search).get('quality')) || 'high'
export const detail = () => (DETAIL === 'low' ? 'low' : 'high')
export function setDetail(q) { DETAIL = q }

let skinMat
/** Shared vertex-colour material for skinned people (one per scene, never per person) */
export function vcSkinMat() {
  if (!skinMat) {
    skinMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.78, metalness: 0 })
    skinMat.name = 'vc.people'
  }
  return skinMat
}

/** Lathe around y from [[r, y], ...]; axis 'x' turns it into a wheel / drum lying along x */
export function lathe(pts, material, p = {}) {
  const seg = p.seg || 16
  const key = `lathe:${pts.join(';')}:${seg}:${p.axis || 'y'}`
  const geo = cached(key, () => {
    const g = new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg)
    if (p.axis === 'x') g.rotateZ(-Math.PI / 2)
    if (p.axis === 'z') g.rotateX(Math.PI / 2)
    return g
  })
  return place(new THREE.Mesh(geo, material), p)
}

/**
 * Side profile [[z, y], ...] extruded across x (width w, centred), with bevelled edges.
 * Used for car bodies, buckets, bed sides. key names the cache slot.
 */
export function extrude(key, pts, w, material, p = {}) {
  const bev = p.bevel ?? 0
  const geo = cached(`ext:${key}:${w}:${bev}`, () => {
    const s = new THREE.Shape(pts.map(([z, y]) => new THREE.Vector2(z, y)))
    const g = new THREE.ExtrudeGeometry(s, { depth: Math.max(0.001, w - bev * 2), bevelEnabled: bev > 0, bevelThickness: bev, bevelSize: bev, bevelSegments: p.bevelSeg || 2, curveSegments: p.curve || 8 })
    // shape x -> world z, shape y -> world y, extrusion -> world x (centred)
    g.translate(0, 0, -(w - bev * 2) / 2)
    g.rotateY(-Math.PI / 2)
    // shape UVs are in metres; scale so grime / wear maps tile like on unit boxes
    const uv = g.attributes.uv
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 0.22, uv.getY(i) * 0.22)
    return g
  })
  return place(new THREE.Mesh(geo, material), p)
}
const _m4 = new THREE.Matrix4()
const _v = new THREE.Vector3()
const _y = new THREE.Vector3(0, 1, 0)

/**
 * Hydraulic rams for one machine as a single SkinnedMesh (one draw call for all of them).
 * Each spec: { a: Object3D, pa: [x,y,z] in a, b: Object3D (a or a descendant), pb: [x,y,z] in b,
 *   r: barrel radius, k?: barrel length / rest distance }. Barrel and rod bones live under `a`
 * and re-aim at each other in updateMatrixWorld, so the rams follow whatever animates the joints.
 */
export function rams(specs, { barrel, rod, seg = 10 } = {}) {
  const bones = []
  const geos = []
  for (const s of specs) {
    const pa = new THREE.Vector3(...s.pa)
    const pb = new THREE.Vector3(...s.pb)
    const relB = () => {
      // b's matrix relative to a, from current local transforms (no stale world matrices)
      _m4.identity()
      for (let o = s.b; o && o !== s.a; o = o.parent) { o.updateMatrix(); _m4.premultiply(o.matrix) }
      return _v.copy(pb).applyMatrix4(_m4)
    }
    const d0 = pa.distanceTo(relB())
    const L = d0 * (s.k ?? 0.62)
    const bar = new THREE.Bone()
    const rd = new THREE.Bone()
    bar.name = 'ram'; rd.name = 'ram'
    s.a.add(bar, rd)
    const solve = () => {
      const q = relB()
      const dir = q.clone().sub(pa)
      if (dir.lengthSq() < 1e-8) return
      dir.normalize()
      bar.position.copy(pa)
      bar.quaternion.setFromUnitVectors(_y, dir)
      rd.position.copy(q)
      rd.quaternion.setFromUnitVectors(_y, dir.negate())
    }
    const up = bar.updateMatrixWorld.bind(bar)
    bar.updateMatrixWorld = (force) => { solve(); up(force) }
    const upR = rd.updateMatrixWorld.bind(rd)
    rd.updateMatrixWorld = (force) => { solve(); upR(force) }
    solve()
    const bi = bones.length
    bones.push(bar, rd)
    const r = s.r || 0.09
    const parts = [
      [new THREE.CylinderGeometry(r, r, L, seg).translate(0, L / 2, 0), bi, barrel],
      [new THREE.CylinderGeometry(r * 1.25, r * 1.25, 0.12, seg).translate(0, L - 0.06, 0), bi, barrel],
      [new THREE.CylinderGeometry(r * 0.55, r * 0.55, L, seg).translate(0, L / 2, 0), bi + 1, rod]
    ]
    for (const [g, b, m] of parts) {
      const n = g.attributes.position.count
      g.setAttribute('skinIndex', new THREE.BufferAttribute(new Uint16Array(n * 4).fill(0).map((_, i) => (i % 4 === 0 ? b : 0)), 4))
      g.setAttribute('skinWeight', new THREE.BufferAttribute(new Float32Array(n * 4).map((_, i) => (i % 4 === 0 ? 1 : 0)), 4))
      const c = new THREE.Color(m)
      g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3).map((_, i) => [c.r, c.g, c.b][i % 3]), 3))
      geos.push(g.toNonIndexed())
      g.dispose()
    }
  }
  const mesh = new THREE.SkinnedMesh(mergeGeometries(geos, false), ramMat())
  geos.forEach((g) => g.dispose())
  mesh.name = 'rams'
  mesh.castShadow = true
  mesh.receiveShadow = true
  mesh.frustumCulled = false
  mesh.userData.keep = true
  // bones are posed in world space directly: identity inverses, bind = identity
  mesh.bind(new THREE.Skeleton(bones, bones.map(() => new THREE.Matrix4())), new THREE.Matrix4())
  return mesh
}

let _ramMat
function ramMat() {
  _ramMat ??= styleVC(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.3, metalness: 0.75, name: 'vc.rams' }))
  vcMaterials.add(_ramMat)
  return _ramMat
}

/** Mark an object so `bake` leaves it (and its children) alone */
export function dynamic(o) {
  o.userData.dynamic = true
  return o
}
