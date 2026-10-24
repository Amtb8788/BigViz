// Bridge pack - main pier prefab: pile cap in a dewatered sheet-pile cofferdam, twin thin-wall
// piers for both carriageways, 0# block brackets, climbing formwork on the upstream walls and
// the balanced-cantilever box girders (17 segments each way) revealed segment by segment.

import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { mat, surfaceMat } from '../../render/materials.js'
import { box, group, bakeTree } from '../../prefabs/kit.js'
import { CAP, COFFER, WALL, WALL_X, DN, UP, MP, TIPS, SEGS, TIP, SIDE_CIP, H_PIER, WATER, deckY } from './layout.js'
import { Quads, boxStrip, capGeo, prism, boxQ, sheetPileGeo } from './geo.js'

const cache = new Map()
/** concrete with vertex tint (pour joints, wet concrete) */
export function concreteVC(key = 'girder', tint = '#ffffff') {
  if (cache.has(key)) return cache.get(key)
  const s = surfaceMat('concrete', 1)
  const m = new THREE.MeshStandardMaterial({ map: s.map, normalMap: s.normalMap, roughnessMap: s.roughnessMap, color: tint, vertexColors: true, roughness: 1, metalness: 0, side: THREE.DoubleSide })
  m.name = `bridge.${key}`
  cache.set(key, m)
  return m
}
const CURED = new THREE.Color('#d9d6cf')
const WET = new THREE.Color('#77736b')
const segTint = (i) => CURED.clone().multiplyScalar(0.93 + ((i * 37) % 11) / 110)

const tinted0 = (g, v = 0.86) => { g.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 3).fill(v), 3)); return g }
const mesh = (g, m, keep = true) => {
  const o = new THREE.Mesh(g, m)
  o.castShadow = true
  o.receiveShadow = true
  if (keep) o.userData.keep = true
  return o
}

/** One carriageway's cantilever girder on pier at px: geometry ordered 0#, W1, E1, W2, E2 ... */
function cantilever(px, oz, salt) {
  const q = new Quads()
  boxStrip(q, px - TIPS[0], px + TIPS[0], { ox: px, oz, col: segTint(salt), step: 1, inner: true })
  const ranges = [q.count]
  for (let i = 1; i < TIPS.length; i++) {
    boxStrip(q, px - TIPS[i - 1], px - TIPS[i], { ox: px, oz, col: segTint(salt + i * 2), step: 1.5 })
    const mid = q.count
    boxStrip(q, px + TIPS[i - 1], px + TIPS[i], { ox: px, oz, col: segTint(salt + i * 2 + 1), step: 1.5 })
    ranges.push(q.count)
    ranges[`m${i}`] = mid
  }
  const g = q.geometry()
  const base = g.attributes.color.array.slice()
  const m = mesh(g, concreteVC())
  m.name = 'girder'
  const caps = [mesh(new THREE.BufferGeometry(), concreteVC()), mesh(new THREE.BufferGeometry(), concreteVC())]
  const capCache = new Map()
  const capFor = (side, k) => {
    const key = `${side}:${k}`
    if (!capCache.has(key)) capCache.set(key, tinted0(capGeo(px + side * TIPS[k], side, { ox: px, oz })))
    return capCache.get(key)
  }
  let shown = -1
  let tinted = -1
  let lastWet = -1
  /** k = pairs cast (0..17, -1 = nothing), wet 0..1 for the newest pair, closed: hide tip caps */
  const set = (k, wet = 0, closed = [false, false]) => {
    m.visible = k >= 0
    if (k >= 0) g.setDrawRange(0, ranges[Math.min(k, ranges.length - 1)])
    const col = g.attributes.color
    if (tinted >= 0 && tinted !== k) { for (let i = ranges[tinted - 1] ?? 0; i < ranges[tinted]; i++) col.array.set(base.subarray(i * 3, i * 3 + 3), i * 3); col.needsUpdate = true; tinted = -1 }
    if (k >= 1 && wet > 0.001 && (tinted !== k || Math.abs(wet - lastWet) > 0.01)) {
      lastWet = wet
      const c = new THREE.Color()
      for (let i = ranges[k - 1]; i < ranges[k]; i++) {
        c.fromArray(base, i * 3).lerp(WET, wet)
        col.array[i * 3] = c.r; col.array[i * 3 + 1] = c.g; col.array[i * 3 + 2] = c.b
      }
      col.needsUpdate = true
      tinted = k
    }
    if (k !== shown && k >= 0) { caps[0].geometry = capFor(-1, k); caps[1].geometry = capFor(1, k); shown = k }
    caps[0].visible = k >= 0 && !closed[0]
    caps[1].visible = k >= 0 && !closed[1]
  }
  return { meshes: [m, ...caps], set }
}

/** closure / side span piece between world x0..x1 (solid end cap at `endX` if given) */
function piece(px, oz, x0, x1, endX = null) {
  const q = new Quads()
  boxStrip(q, x0, x1, { ox: px, oz, col: segTint(Math.round(x0)), step: 1 })
  const geos = [q.geometry()]
  if (endX != null) geos.push(tinted0(capGeo(endX, Math.sign(endX), { ox: px, oz, hollow: false })))
  const g = mergeGeometries(geos)
  const base = g.attributes.color.array.slice()
  const m = mesh(g, concreteVC())
  m.visible = false
  let last = -1
  m.set = (on, wet = 0) => {
    m.visible = on
    if (!on || Math.abs(wet - last) < 0.01) return
    last = wet
    const a = g.attributes.color.array
    const c = new THREE.Color()
    for (let i = 0; i < a.length; i += 3) { c.fromArray(base, i).lerp(WET, wet); a[i] = c.r; a[i + 1] = c.g; a[i + 2] = c.b }
    g.attributes.color.needsUpdate = true
  }
  return m
}

const SOFFIT = deckY(MP) - H_PIER // underside of the 0# block
const LIFT = 4.5

/** walls of one carriageway: lifts ordered bottom-up across both walls (drawRange = k lifts) */
function walls(px, cz) {
  const q = new Quads()
  const top = SOFFIT + 0.3
  const n = Math.ceil((top - CAP.top) / LIFT)
  const per = []
  for (let l = 0; l < n; l++) {
    const y0 = CAP.top + l * LIFT
    const y1 = Math.min(top, y0 + LIFT)
    const c = new THREE.Color(1, 1, 1).multiplyScalar(0.84 + ((l * 53) % 7) / 60)
    for (const wx of WALL_X) prism(q, wx, cz, WALL.t, WALL.w, 0.35, y0, y1, c)
    per.push(q.count)
  }
  const m = mesh(q.geometry(), concreteVC('pier', '#e6e3dc'))
  m.name = 'walls'
  return { m, per, n, top, lift: (k) => CAP.top + Math.min(k, n) * LIFT }
}

/** cap, seal, sheet piles, walers + struts, plank walkway with handrail (static, baked) */
function foundation() {
  const out = []
  const q = new Quads()
  boxQ(q, -CAP.w / 2, CAP.top - CAP.h, -CAP.d / 2, CAP.w / 2, CAP.top, CAP.d / 2, new THREE.Color(0.9, 0.9, 0.88))
  out.push(mesh(q.geometry(), concreteVC('pier', '#e6e3dc'), false))
  const seal = box(COFFER.w - 1, 0.2, COFFER.d - 1, mat('concrete.wet'), { y: CAP.top - CAP.h + 0.1 })
  const piles = new THREE.Mesh(sheetPileGeo(0, COFFER.w, COFFER.d, 4, COFFER.bottom, COFFER.top), new THREE.MeshStandardMaterial({ color: '#5a4a3e', roughness: 0.72, metalness: 0.55, side: THREE.DoubleSide }))
  piles.castShadow = piles.receiveShadow = true
  // wet / mud band below the waterline is just darker steel: second skin slightly inside
  const wetBand = new THREE.Mesh(sheetPileGeo(0, COFFER.w - 0.05, COFFER.d - 0.05, 4, COFFER.bottom, WATER + 0.6), new THREE.MeshStandardMaterial({ color: '#2f2822', roughness: 0.5, metalness: 0.4, side: THREE.DoubleSide }))
  const steel = mat('steel.dark')
  const ring = []
  for (const y of [WATER + 1.6, -6.2]) {
    const iw = COFFER.w / 2 - 1.2
    const id = COFFER.d / 2 - 1.2
    ring.push(box(iw * 2, 0.7, 0.5, steel, { y, z: id }), box(iw * 2, 0.7, 0.5, steel, { y, z: -id }), box(0.5, 0.7, id * 2, steel, { y, x: iw }), box(0.5, 0.7, id * 2, steel, { y, x: -iw }))
    for (const sx of [1, -1]) for (const sz of [1, -1]) {
      const b = box(0.5, 0.5, 9, steel, { y, x: sx * (iw - 2.6), z: sz * (id - 2.6) })
      b.rotation.y = sx * sz * Math.PI / 4
      ring.push(b)
    }
  }
  // walkway planks + handrail posts on the pile top
  const walk = []
  const wy = COFFER.top + 0.05
  walk.push(box(COFFER.w + 1.4, 0.08, 1.2, mat('timber'), { y: wy, z: COFFER.d / 2 + 0.2 }), box(COFFER.w + 1.4, 0.08, 1.2, mat('timber'), { y: wy, z: -COFFER.d / 2 - 0.2 }))
  walk.push(box(1.2, 0.08, COFFER.d, mat('timber'), { y: wy, x: COFFER.w / 2 + 0.2 }), box(1.2, 0.08, COFFER.d, mat('timber'), { y: wy, x: -COFFER.w / 2 - 0.2 }))
  const rail = mat('paint.yellow')
  for (const [L, ax, o] of [[COFFER.w + 1.4, 'x', COFFER.d / 2 + 0.75], [COFFER.w + 1.4, 'x', -COFFER.d / 2 - 0.75], [COFFER.d, 'z', COFFER.w / 2 + 0.75], [COFFER.d, 'z', -COFFER.w / 2 - 0.75]]) {
    walk.push(ax === 'x' ? box(L, 0.06, 0.06, rail, { y: wy + 1.1, z: o }) : box(0.06, 0.06, L, rail, { y: wy + 1.1, x: o }))
    for (let s = -L / 2; s <= L / 2; s += 2) walk.push(ax === 'x' ? box(0.06, 1.1, 0.06, rail, { y: wy + 0.55, x: s, z: o }) : box(0.06, 1.1, 0.06, rail, { y: wy + 0.55, z: s, x: o }))
  }
  out.push(seal, piles, wetBand, ...ring, ...walk)
  return out
}

/** 0# block brackets (triangular steel trusses on both wall faces), one carriageway */
function brackets(cz) {
  const g = group()
  const steel = mat('paint.red')
  const y = SOFFIT - 0.15
  for (const s of [-1, 1]) {
    const x0 = s * (WALL_X[1] + WALL.t / 2)
    for (const dz of [-3.2, -1, 1, 3.2]) {
      g.add(box(2.2, 0.35, 0.3, steel, { x: x0 + s * 1.1, y, z: cz + dz }))
      const d = box(0.22, 3.2, 0.22, steel, { x: x0 + s * 0.95, y: y - 1.5, z: cz + dz })
      d.rotation.z = s * 0.62
      g.add(d)
    }
    g.add(box(2.4, 0.12, WALL.w + 2, mat('timber'), { x: x0 + s * 1.2, y: y + 0.24, z: cz }))
  }
  return g
}

/** climbing formwork (爬模) for one wall: 3 platform decks + mesh screen + jack gantry */
function climbForm(wx, cz) {
  const g = group()
  const W = WALL.t + 2.6
  const D = WALL.w + 2.6
  const net = mat('net')
  for (const dy of [0.3, -2.2, -4.7]) {
    g.add(box(W, 0.1, D, mat('plywood'), { y: dy }))
    g.add(box(W, 0.18, 0.18, mat('paint.yellow'), { y: dy + 1.1, z: D / 2 }), box(W, 0.18, 0.18, mat('paint.yellow'), { y: dy + 1.1, z: -D / 2 }))
  }
  for (const [w, d, x, z] of [[W, 0.05, 0, D / 2], [W, 0.05, 0, -D / 2], [0.05, D, W / 2, 0], [0.05, D, -W / 2, 0]]) g.add(box(w, 7, d, net, { x, y: -1.8, z, cast: false }))
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(box(0.25, 8.2, 0.25, mat('steel.dark'), { x: sx * (W / 2 - 0.2), y: -1.2, z: sz * (D / 2 - 0.2) }))
  g.add(box(W, 0.5, 0.4, mat('paint.yellow'), { y: 2.6, z: 0 }), box(0.3, 2.2, 0.3, mat('steel'), { y: 1.5, x: 0 }))
  g.position.set(wx, 0, cz)
  return g
}

/** stair tower (scaffold) beside a wall, cap to deck */
function stairTower(x, z, y0, y1) {
  const g = group()
  const H = y1 - y0
  for (const sx of [-1.2, 1.2]) for (const sz of [-1.2, 1.2]) g.add(box(0.06, H, 0.06, mat('steel'), { x: x + sx, y: y0 + H / 2, z: z + sz }))
  for (let y = y0 + 2; y < y1; y += 2) {
    g.add(box(2.5, 0.05, 2.5, mat('plywood'), { x, y, z }))
    const st = box(0.9, 0.05, 2.9, mat('steel.dark'), { x: x + ((y / 2) % 2 ? 0.6 : -0.6), y: y - 1, z })
    st.rotation.x = 0.6
    g.add(st)
  }
  g.add(box(2.6, H, 2.6, mat('net'), { x, y: y0 + H / 2, z, cast: false }))
  return g
}

/** concrete delivery pipe: pump on the trestle platform -> over the cofferdam -> up the wall */
function deliveryPipe(side) {
  const P = (x, y, z) => new THREE.Vector3(side * x, y, z)
  const top = deckY(MP) + 0.4
  const wx = WALL_X[1] + WALL.t / 2 + 0.25
  const pts = [P(12.4, 1.5, 34), P(12.4, 1.5, 27), P(11, 1.5, 24.2), P(wx + 0.4, -1.2, 21), P(wx, -1.2, DN + WALL.w / 2 + 0.3), P(wx, top, DN + WALL.w / 2 + 0.3), P(wx - 3, top, DN + 2)]
  const g = group()
  const m = mat('steel.dark')
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]; const b = pts[i]
    const len = a.distanceTo(b)
    const c = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, len, 8), m)
    c.position.copy(a).add(b).multiplyScalar(0.5)
    c.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize())
    c.castShadow = true
    g.add(c)
    if (i > 1 && i < pts.length - 1 && i % 1 === 0) g.add(box(0.5, 0.5, 0.5, m, { x: a.x, y: a.y, z: a.z }))
  }
  for (let y = 4; y < top; y += 4.5) g.add(box(0.5, 0.12, 0.7, m, { x: side * wx, y, z: DN + WALL.w / 2 + 0.05 }))
  return g
}

/**
 * Main pier prefab (placed at x = +-MP). params: { side: -1 | 1 }
 * rig.setState({ dn, up, closures }) - see works.js for the state shape
 */
export function mainPier(p = {}) {
  const side = p.side ?? 1
  const px = side * MP
  const root = new THREE.Group()
  root.name = `mainPier.${side > 0 ? 'E' : 'W'}`
  for (const o of foundation()) root.add(o)
  root.add(stairTower(-side * 6.5, DN + 7, CAP.top, deckY(MP) - 0.2), deliveryPipe(side))
  const cw = { dn: walls(px, DN), up: walls(px, UP) }
  root.add(cw.dn.m, cw.up.m)
  const br = { dn: brackets(DN), up: brackets(UP) }
  const forms = WALL_X.map((wx) => climbForm(wx, UP))
  for (const o of [br.dn, br.up, ...forms]) { o.userData.dynamic = true; root.add(o) }
  const can = { dn: cantilever(px, DN, 3 + side), up: cantilever(px, UP, 40 + side) }
  for (const c of Object.values(can)) for (const m of c.meshes) root.add(m)
  // outer side: closure (TIP..TIP+2) + cast-in-place on falsework (to the transition pier)
  const outer = (oz) => ({
    closure: piece(px, oz, px + side * TIP, px + side * (TIP + 2)),
    cip: piece(px, oz, side * SIDE_CIP.from, side * SIDE_CIP.to, side * SIDE_CIP.to)
  })
  const sides = { dn: outer(DN), up: outer(UP) }
  const main = p.mainClosure ? { dn: piece(px, DN, -1, 1), up: piece(px, UP, -1, 1) } : null
  for (const s of Object.values(sides)) root.add(s.closure, s.cip)
  if (main) root.add(main.dn, main.up)

  const rig = { root, can, sides, main, walls: cw, forms }
  const out = side // index of the outer (side span) tip in [W, E] order
  rig.setState = (st) => {
    for (const key of ['dn', 'up']) {
      const s = st[key]
      if (!s) continue
      const W = cw[key]
      W.m.geometry.setDrawRange(0, W.per[Math.max(0, Math.min(W.n, s.lifts ?? W.n)) - 1] ?? 0)
      W.m.visible = (s.lifts ?? W.n) > 0
      br[key].visible = !!s.brackets
      const sideClosed = !!s.sideClosure
      const mainClosed = !!s.mainClosure
      const closed = out > 0 ? [mainClosed, sideClosed] : [sideClosed, mainClosed]
      can[key].set(s.pairs ?? -1, s.wet ?? 0, closed)
      sides[key].cip.set(!!s.cip, s.cipWet ?? 0)
      sides[key].closure.set(sideClosed, s.sideWet ?? 0)
      if (main) main[key].set(mainClosed, s.mainWet ?? 0)
      if (key === 'up') {
        const y = W.lift(s.lifts ?? W.n)
        forms.forEach((f) => { f.visible = !!s.climbing; f.position.y = y })
      }
    }
  }
  root.traverse((o) => { if (o.isMesh && !o.userData.keep) o.castShadow = o.receiveShadow = true })
  bakeTree(root)
  return { object: root, rig }
}

export { SOFFIT, LIFT }
