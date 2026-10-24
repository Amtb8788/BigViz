// Bridge pack - approach viaducts (30 m precast T-beam spans on twin-column piers), transition
// piers, west abutment, deck finishing (asphalt + parapets) and the side-span falsework.
// West downstream span beams are an InstancedMesh revealed in erection order (works.js).

import * as THREE from 'three'
import { mat, surfaceMat } from '../../render/materials.js'
import { box, cyl, group, extrude, bakeTree } from '../../prefabs/kit.js'
import { DN, UP, TP, SPAN, ABUT_W, WEST_PIERS, EAST_PIERS, BEAM, SIDE_CIP, deckY, deckSlope, capTop, groundY } from './layout.js'
import { concreteVC } from './piers.js'
import { Quads, prism, boxQ } from './geo.js'

/** T-beam section [z, y] (top at 0): 2.36 m flange, 0.2 m web, 0.6 m heel, 2 m deep */
const T_SECTION = [[-1.17, 0], [1.17, 0], [1.17, -0.16], [0.3, -0.3], [0.1, -0.42], [0.1, -1.6], [0.3, -1.78], [0.3, -2], [-0.3, -2], [-0.3, -1.78], [-0.1, -1.6], [-0.1, -0.42], [-0.3, -0.3], [-1.17, -0.16]]

let beamGeo
export function tBeamGeometry() {
  if (beamGeo) return beamGeo
  // extrude() maps shape [z, y] and extrudes across x (centred), which is the beam axis here
  const m = extrude('tbeam', T_SECTION, BEAM.len, mat('concrete.fresh'))
  beamGeo = m.geometry.clone()
  const uv = beamGeo.attributes.uv
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 0.8, uv.getY(i) * 0.8)
  return beamGeo
}
const beamMat = () => {
  const s = surfaceMat('concrete', 1)
  return new THREE.MeshStandardMaterial({ map: s.map, normalMap: s.normalMap, color: '#d4d0c7', roughness: 0.9, metalness: 0 })
}

/** spans as [x0, x1] for a pier line (from the abutment / transition pier) */
const pairs = (a) => a.slice(0, -1).map((x, i) => [x, a[i + 1]])
export const WEST_SPANS = pairs([ABUT_W, ...[...WEST_PIERS].sort((a, b) => a - b), -TP])
export const EAST_SPANS = pairs([TP, ...EAST_PIERS])

const _m = new THREE.Matrix4()
const _q = new THREE.Quaternion()
const _e = new THREE.Euler()
const _v = new THREE.Vector3()
const _s = new THREE.Vector3(1, 1, 1)
/** transform of beam `slot` (0..6) in span [x0, x1] of carriageway cz; ox shifts the beam along x */
export function beamMatrix(x0, x1, slot, cz, out = _m, lift = 0) {
  const cx = (x0 + x1) / 2
  const z = cz + (slot - (BEAM.n - 1) / 2) * BEAM.pitch
  _e.set(0, 0, Math.atan(deckSlope(cx)))
  _q.setFromEuler(_e)
  _v.set(cx, deckY(cx) - 0.18 + lift, z)
  return out.compose(_v, _q, _s)
}

/** approach pier: twin columns per carriageway + cap beam + bearing stones */
function approachPier(q, x) {
  const ct = capTop(x)
  for (const cz of [DN, UP]) {
    const g = groundY(x, cz)
    boxQ(q, x - 1.1, ct - 1.6, cz - 8.6, x + 1.1, ct, cz + 8.6, new THREE.Color(0.9, 0.89, 0.86))
    for (let s = 0; s < BEAM.n; s++) for (const dx of [-0.55, 0.55]) boxQ(q, x + dx - 0.3, ct, cz + (s - 3) * BEAM.pitch - 0.3, x + dx + 0.3, ct + 0.1, cz + (s - 3) * BEAM.pitch + 0.3, new THREE.Color(0.25, 0.25, 0.26))
    for (const dz of [-3.6, 3.6]) prism(q, x, cz + dz, 1.7, 1.7, 0.5, g - 1, ct - 1.6, new THREE.Color(0.92, 0.91, 0.88), false)
    if (ct - g > 22) boxQ(q, x - 0.7, (g + ct) / 2 - 0.6, cz - 3.6, x + 0.7, (g + ct) / 2 + 0.6, cz + 3.6, new THREE.Color(0.88, 0.87, 0.84))
    boxQ(q, x - 3.4, g - 1.5, cz - 6.5, x + 3.4, g + 0.3, cz + 6.5, new THREE.Color(0.8, 0.79, 0.76))
  }
}

/** transition pier at +-TP: wall per carriageway, stepped cap (girder seat low, T-beam seat high) */
function transitionPier(q, s) {
  const x = s * TP
  const lowSeat = deckY(x) - 3.2 - 0.25
  const hiSeat = capTop(x)
  for (const cz of [DN, UP]) {
    const g = groundY(x, cz)
    prism(q, x, cz, 2.6, 11, 0.5, g - 1, lowSeat - 1.8, new THREE.Color(0.92, 0.91, 0.88), false)
    boxQ(q, x - 2.3, lowSeat - 1.8, cz - 8.6, x + 2.3, lowSeat, cz + 8.6, new THREE.Color(0.9, 0.89, 0.86))
    boxQ(q, x + s * 0.5, lowSeat, cz - 8.6, x + s * 2.3, hiSeat, cz + 8.6, new THREE.Color(0.88, 0.87, 0.84))
    boxQ(q, x - 4, g - 1.8, cz - 7.5, x + 4, g + 0.3, cz + 7.5, new THREE.Color(0.8, 0.79, 0.76))
  }
}

/** west abutment: seat + backwall + wing walls, retaining the yard fill */
function abutment(q) {
  const x = ABUT_W
  const seat = capTop(x)
  for (const cz of [DN, UP]) {
    const g = groundY(x + 2, cz) - 1
    boxQ(q, x - 3, g, cz - 8.6, x + 1.2, seat, cz + 8.6, new THREE.Color(0.88, 0.87, 0.83))
    boxQ(q, x - 3, seat, cz - 8.6, x - 0.6, deckY(x) - 0.05, cz + 8.6, new THREE.Color(0.86, 0.85, 0.81))
  }
  for (const z of [-18.2, 18.2]) boxQ(q, x - 14, groundY(x, z) - 1, z - 0.4, x + 1.2, deckY(x) + 0.9, z + 0.4, new THREE.Color(0.86, 0.85, 0.81))
}

/** InstancedMesh of T-beams: list of [x0, x1, slot, cz] */
function beams(list, material) {
  const g = tBeamGeometry()
  const m = new THREE.InstancedMesh(g, material, list.length)
  const c = new THREE.Color()
  list.forEach(([x0, x1, s, cz], i) => {
    m.setMatrixAt(i, beamMatrix(x0, x1, s, cz))
    m.setColorAt(i, c.setScalar(0.9 + ((i * 29) % 13) / 130))
  })
  m.castShadow = m.receiveShadow = true
  m.userData.keep = true
  m.frustumCulled = false
  return m
}
const slots = (spans, cz) => spans.flatMap(([a, b]) => Array.from({ length: BEAM.n }, (_, s) => [a, b, s, cz]))

/** per-span deck finish (asphalt + 2 parapets) as instanced boxes; list of [x0, x1, cz] */
function finish(list) {
  const asph = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), surfaceMat('asphalt', 1), list.length)
  const par = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), concreteVC('parapet', '#e1ded6'), list.length * 2)
  par.geometry.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(24 * 3).fill(0.92), 3))
  const q = new THREE.Quaternion()
  list.forEach(([x0, x1, cz], i) => {
    const cx = (x0 + x1) / 2
    q.setFromEuler(new THREE.Euler(0, 0, Math.atan(deckSlope(cx))))
    asph.setMatrixAt(i, new THREE.Matrix4().compose(new THREE.Vector3(cx, deckY(cx) + 0.06, cz), q, new THREE.Vector3(x1 - x0, 0.1, 15.4)))
    for (const [k, dz] of [[0, -7.95], [1, 7.95]]) par.setMatrixAt(i * 2 + k, new THREE.Matrix4().compose(new THREE.Vector3(cx, deckY(cx) + 0.55, cz + dz), q, new THREE.Vector3(x1 - x0 - 0.04, 1.1, 0.5)))
  })
  for (const m of [asph, par]) { m.castShadow = m.receiveShadow = true; m.userData.keep = true; m.frustumCulled = false }
  return { asph, par }
}

/**
 * Approach viaducts + transition piers + abutment.
 * rig.setBeams(n) west downstream beams placed (0..49, erection order span 0..6, slot 0..6)
 * rig.setFinished(n) west downstream spans finished (asphalt + parapets)
 * rig.carry: the beam being moved by the launcher (Mesh, world transform set by works.js)
 */
export function viaduct() {
  const root = new THREE.Group()
  root.name = 'viaduct'
  const q = new Quads()
  for (const x of WEST_PIERS) approachPier(q, x)
  for (const x of EAST_PIERS) approachPier(q, x)
  transitionPier(q, -1); transitionPier(q, 1)
  abutment(q)
  const sub = new THREE.Mesh(q.geometry(), concreteVC('pier', '#e6e3dc'))
  sub.castShadow = sub.receiveShadow = true
  sub.userData.keep = true
  root.add(sub)
  const bm = beamMat()
  const fixed = beams([...slots(WEST_SPANS, UP), ...slots(EAST_SPANS, DN), ...slots(EAST_SPANS, UP)], bm)
  const live = beams(slots(WEST_SPANS, DN), bm)
  const doneF = finish([...WEST_SPANS.map(([a, b]) => [a, b, UP]), ...EAST_SPANS.flatMap(([a, b]) => [[a, b, DN], [a, b, UP]])])
  const liveF = finish(WEST_SPANS.map(([a, b]) => [a, b, DN]))
  const carry = new THREE.Mesh(tBeamGeometry(), bm)
  carry.castShadow = carry.receiveShadow = true
  carry.userData.keep = true
  carry.matrixAutoUpdate = false
  carry.visible = false
  root.add(fixed, live, doneF.asph, doneF.par, liveF.asph, liveF.par, carry)
  const rig = { root, live, carry }
  rig.setBeams = (n) => { live.count = Math.max(0, Math.min(49, n | 0)) }
  rig.setFinished = (n) => { n = Math.max(0, Math.min(7, n | 0)); liveF.asph.count = n; liveF.par.count = n * 2 }
  rig.setBeams(0); rig.setFinished(0)
  return { object: root, rig }
}

/** main bridge deck finish (asphalt + parapets) for one carriageway, revealed from x = 0 out */
export function deckFinish(p = {}) {
  const cz = p.cz ?? DN
  const qa = new Quads()
  const qp = new Quads()
  const step = 3
  const N = Math.ceil(SIDE_CIP.to / step)
  const ranges = []
  const grey = new THREE.Color(0.92, 0.92, 0.92)
  const V = (x, y, z) => new THREE.Vector3(x, y, z)
  for (let i = 0; i < N; i++) {
    for (const s of [1, -1]) {
      const a = s * i * step
      const b = s * Math.min(SIDE_CIP.to, (i + 1) * step)
      const ya = deckY(a); const yb = deckY(b)
      qa.quad([V(a, ya + 0.1, cz - 7.7), V(b, yb + 0.1, cz - 7.7), V(b, yb + 0.1, cz + 7.7), V(a, ya + 0.1, cz + 7.7)], V(0, 1, 0), [[a / 6, 0], [b / 6, 0], [b / 6, 2.5], [a / 6, 2.5]], grey)
      for (const e of [-1, 1]) {
        const zi = cz + e * 7.7; const zo = cz + e * 8.2
        qp.quad([V(a, ya, zi), V(b, yb, zi), V(b, yb + 1.1, zi), V(a, ya + 1.1, zi)], V(0, 0, -e), [[a / 6, 0], [b / 6, 0], [b / 6, 0.2], [a / 6, 0.2]], grey)
        qp.quad([V(a, ya - 0.2, zo), V(b, yb - 0.2, zo), V(b, yb + 1.1, zo), V(a, ya + 1.1, zo)], V(0, 0, e), [[a / 6, 0], [b / 6, 0], [b / 6, 0.22], [a / 6, 0.22]], grey)
        qp.quad([V(a, ya + 1.1, zi), V(b, yb + 1.1, zi), V(b, yb + 1.1, zo), V(a, ya + 1.1, zo)], V(0, 1, 0), [[a / 6, 0], [b / 6, 0], [b / 6, 0.1], [a / 6, 0.1]], grey)
      }
    }
    ranges.push([qa.count, qp.count])
  }
  const asph = new THREE.Mesh(qa.geometry(), surfaceMat('asphalt', 1))
  const par = new THREE.Mesh(qp.geometry(), concreteVC('parapet', '#e1ded6'))
  asph.geometry.deleteAttribute('color')
  for (const m of [asph, par]) { m.castShadow = m.receiveShadow = true; m.userData.keep = true }
  const root = group(asph, par)
  const rig = { root }
  /** f: 0..1 of the half-length done (from the centre outward, both directions) */
  rig.set = (f) => {
    const k = Math.round(Math.max(0, Math.min(1, f)) * N)
    root.visible = k > 0
    if (k > 0) { asph.geometry.setDrawRange(0, ranges[k - 1][0]); par.geometry.setDrawRange(0, ranges[k - 1][1]) }
  }
  rig.set(0)
  return { object: root, rig }
}

/** side-span falsework (steel pipe bents + distribution beams) under x = side * 141..149.5 */
export function falsework(p = {}) {
  const s = p.side ?? 1
  const cz = p.cz ?? DN
  const root = new THREE.Group()
  const soffit = deckY(s * 145) - 3.2
  const pipe = mat('steel')
  for (const x of [141.8, 145.4, 149]) for (const dz of [-3.6, 0, 3.6]) {
    const g = groundY(s * x, cz + dz)
    root.add(cyl(0.32, 0.32, soffit - 1.3 - g, pipe, { base: true, x: s * x, y: g, z: cz + dz, seg: 10 }))
  }
  for (let y = groundY(s * 145, cz) + 5; y < soffit - 2; y += 6) {
    for (const x of [141.8, 145.4, 149]) root.add(box(0.2, 0.2, 7.4, pipe, { x: s * x, y, z: cz }))
    for (const dz of [-3.6, 0, 3.6]) root.add(box(7.4, 0.2, 0.2, pipe, { x: s * 145.4, y, z: cz + dz }))
  }
  for (const x of [141.8, 145.4, 149]) root.add(box(0.5, 0.6, 9, mat('steel.dark'), { x: s * x, y: soffit - 1.0, z: cz }))
  for (const dz of [-3, -1, 1, 3]) root.add(box(9.4, 0.5, 0.4, mat('paint.orange'), { x: s * 145.4, y: soffit - 0.45, z: cz + dz }))
  root.add(box(9.4, 0.1, 8.4, mat('plywood'), { x: s * 145.4, y: soffit - 0.12, z: cz }))
  bakeTree(root)
  return { object: root, rig: {} }
}
