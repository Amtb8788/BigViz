// Traffic furniture: signal poles with mast arm + 3-aspect heads, pedestrian heads,
// road markings (stop lines, zebra crossings, centre / lane lines) and stub asphalt.
// Lamps use live materials (never baked / snow-tinted) switched by applyLamps().
// Real-world proportions: pole 6.2 m, mast arm at 5.6 m, vehicle head ~1.05 m tall.

import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { mat, colorMat, surfaceMat } from '../render/materials.js'
import { box, cyl, group, bake } from './kit.js'

const POLE_H = 6.2
const ARM_Y = 5.6

const LAMP = {
  red: ['#3a0d0a', '#ff2d1a'], yellow: ['#3a2a08', '#ffb21a'], green: ['#0a2a14', '#22ff7a'],
  pRed: ['#3a0d0a', '#ff3b22'], pGreen: ['#0a2a14', '#3bff8a']
}

function lampMat(kind) {
  const [off, on] = LAMP[kind]
  const m = new THREE.MeshStandardMaterial({ color: off, emissive: on, emissiveIntensity: 0, roughness: 0.25, metalness: 0 })
  m.name = `signal.${kind}`
  m.userData.live = true
  m.userData.snowable = true // skip snow tint on lenses
  m.userData.off = new THREE.Color(off)
  m.userData.on = new THREE.Color(on).multiplyScalar(0.35)
  return m
}

function setLamp(m, on) {
  if (m.userData.state === on) return
  m.userData.state = on
  m.emissiveIntensity = on ? 3.2 : 0
  m.color.copy(on ? m.userData.on : m.userData.off)
}

/** One junction's lamp materials: vehicle groups ns / ew, pedestrian heads */
export function lampSet() {
  const v = () => ({ red: lampMat('red'), yellow: lampMat('yellow'), green: lampMat('green') })
  return { ns: v(), ew: v(), ped: { red: lampMat('pRed'), green: lampMat('pGreen') } }
}

/** Switch lamps from controller aspects; t = sim seconds (flash timing) */
export function applyLamps(L, aspects, t) {
  const blink = Math.floor(t * 2) % 2 === 0
  for (const g of ['ns', 'ew']) {
    const a = aspects[g]
    setLamp(L[g].red, a === 'red')
    setLamp(L[g].yellow, a === 'yellow' || (a === 'flash' && blink))
    setLamp(L[g].green, a === 'green')
  }
  const p = aspects.ped
  setLamp(L.ped.green, p === 'walk' || (p === 'flash' && blink))
  setLamp(L.ped.red, p === 'dont' || p === 'flash')
}

const housing = () => mat('paint.dark')
const backplate = () => colorMat('#15171a', 0.7, 0.1)

/** 3-aspect vehicle head facing local +z, centred at origin (0.36 x 1.05 x 0.3 m) */
export function signalHead(L) {
  const g = group(box(0.36, 1.05, 0.3, housing()), box(0.56, 1.25, 0.04, backplate(), { z: -0.17 }))
  ;[['red', 0.33], ['yellow', 0], ['green', -0.33]].forEach(([k, y]) => {
    g.add(cyl(0.12, 0.12, 0.04, L[k], { axis: 'z', y, z: 0.15, seg: 16, cast: false }))
    g.add(box(0.3, 0.03, 0.18, housing(), { y: y + 0.15, z: 0.24 }))
  })
  return g
}

/** Pedestrian head (red standing man over green walking man), 0.3 x 0.62 m */
export function pedHead(P) {
  return group(
    box(0.3, 0.62, 0.2, housing()),
    box(0.22, 0.24, 0.03, P.red, { y: 0.15, z: 0.1, cast: false }),
    box(0.22, 0.24, 0.03, P.green, { y: -0.15, z: 0.1, cast: false })
  )
}
/**
 * Signal pole at origin, heads face local +z (toward oncoming drivers), mast arm along
 * local x. arm: lane-centre offsets (local x) to hang a head over; peds: local yaws of
 * pedestrian heads mounted on the pole.
 */
export function signalPole(L, { arm = [], peds = [], P } = {}) {
  const g = group(
    cyl(0.32, 0.4, 0.25, colorMat('#a8a49c', 0.9), { base: true }),
    cyl(0.11, 0.14, POLE_H, mat('steel'), { base: true }),
    cyl(0.13, 0.13, 0.08, mat('steel'), { y: POLE_H })
  )
  const reach = arm.length ? Math.max(...arm.map(Math.abs)) + 0.5 : 0
  if (reach) {
    const s = Math.sign(arm[0]) || -1
    g.add(cyl(0.07, 0.09, reach, mat('steel'), { axis: 'x', x: (s * reach) / 2, y: ARM_Y }))
    // tie rod from the pole top to mid arm
    const tie = cyl(0.025, 0.025, 1, mat('steel'), { y: 0 })
    tie.position.set((s * reach) / 4, ARM_Y + 0.3, 0)
    tie.rotation.z = s * (Math.PI / 2 - Math.atan2(0.6, reach / 2))
    tie.scale.y = Math.hypot(reach / 2, 0.6) / 1
    g.add(tie)
    for (const x of arm) {
      g.add(box(0.06, 0.25, 0.06, mat('steel.dark'), { x, y: ARM_Y - 0.12 }))
      const h = signalHead(L)
      h.position.set(x, ARM_Y - 0.78, 0.1)
      g.add(h)
    }
  }
  // near-side head on the pole (drivers at the stop line)
  const n = signalHead(L)
  n.position.set(0, 3.3, 0.33)
  g.add(n, box(0.05, 0.5, 0.18, mat('steel.dark'), { y: 3.3, z: 0.15 }))
  for (const yaw of peds) {
    const h = pedHead(P)
    h.position.set(Math.sin(yaw) * 0.26, 2.6, Math.cos(yaw) * 0.26)
    h.rotation.y = yaw
    g.add(h)
  }
  return g
}

/** Short post carrying one pedestrian head facing local +z */
export function pedPost(P) {
  const h = pedHead(P)
  h.position.set(0, 2.6, 0.18)
  return group(cyl(0.07, 0.08, 3, mat('steel'), { base: true }), h)
}

/** Flat strip a->b (world xz) of width w at height y, pushed into geos */
function strip(geos, ax, az, bx, bz, w, y = 0.071) {
  const len = Math.hypot(bx - ax, bz - az)
  if (len < 0.05) return
  const g = new THREE.BoxGeometry(len, 0.012, w)
  g.rotateY(-Math.atan2(bz - az, bx - ax))
  g.translate((ax + bx) / 2, y, (az + bz) / 2)
  geos.push(g.toNonIndexed())
}

/** Dashes along a->b */
function dashes(geos, ax, az, bx, bz, w, dash = 3, gapL = 3) {
  const len = Math.hypot(bx - ax, bz - az)
  const ux = (bx - ax) / len
  const uz = (bz - az) / len
  for (let s = 0; s + dash <= len; s += dash + gapL) strip(geos, ax + ux * s, az + uz * s, ax + ux * (s + dash), az + uz * (s + dash), w)
}
function planarUV(geo, tile = 8) {
  const p = geo.attributes.position
  const uv = new Float32Array(p.count * 2)
  for (let i = 0; i < p.count; i++) { uv[i * 2] = p.getX(i) / tile; uv[i * 2 + 1] = p.getZ(i) / tile }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
  return geo
}

/** Distance from (x, z) along (ux, uz) to the board edge */
function toEdge(x, z, ux, uz, board) {
  const tx = ux ? ((ux > 0 ? board.w / 2 : -board.w / 2) - x) / ux : Infinity
  const tz = uz ? ((uz > 0 ? board.d / 2 : -board.d / 2) - z) / uz : Infinity
  return Math.min(tx, tz)
}

/**
 * Lane markings for every public edge, stub asphalt for `stub` edges (to the board edge).
 * Ends are trimmed at signal stop lines / gate mouths; dead ends run to the board edge.
 */
function edgeMarkings(R, T, board, white, yellow, asphalt) {
  const sig = new Map(T.junctions.map((j) => [j.node, j]))
  const trimAt = (id, other, e) => {
    const j = sig.get(id)
    if (j) return j.legs.find((l) => l.to === other)?.stopD ?? 0
    const n = R.node(id)
    const pub = n.adj.filter((a) => a.public)
    if (pub.length === 1) return -1 // dead end: handled by extension
    const site = n.adj.find((a) => a.site)
    return site ? site.width / 2 + 0.4 : 0
  }
  for (const e of R.edges) {
    if (e.site) continue
    const A = R.node(e.a)
    const B = R.node(e.b)
    const len = Math.hypot(B.x - A.x, B.z - A.z)
    const ux = (B.x - A.x) / len
    const uz = (B.z - A.z) / len
    const nx = -uz
    const nz = ux
    let ta = trimAt(e.a, e.b, e)
    let tb = trimAt(e.b, e.a, e)
    if (ta < 0) ta = -Math.max(0, toEdge(A.x, A.z, -ux, -uz, board) - 0.4)
    if (tb < 0) tb = -Math.max(0, toEdge(B.x, B.z, ux, uz, board) - 0.4)
    if (e.stub) {
      // asphalt from the inner node (overlapping the cross road) to the board edge
      const a0 = -e.width / 2
      const b0 = len - tb + 0.4
      const g = new THREE.BoxGeometry(b0 - a0, 0.06, e.width)
      g.rotateY(-Math.atan2(uz, ux))
      g.translate(A.x + ux * (a0 + b0) / 2, 0.034, A.z + uz * (a0 + b0) / 2)
      asphalt.push(planarUV(g.toNonIndexed(), 8))
    }
    const P = (s, o) => [A.x + ux * s + nx * o, A.z + uz * s + nz * o]
    const s0 = ta
    const s1 = len - tb
    if (s1 - s0 < 0.5) continue
    if (e.lanes > 1) {
      for (const o of [-0.1, 0.1]) strip(yellow, ...P(s0, o), ...P(s1, o), 0.12)
      for (const side of [1, -1]) {
        for (let i = 0; i < e.offs.length - 1; i++) {
          const o = side * (e.offs[i] + e.offs[i + 1]) / 2
          // side +1 travels a->b: inbound to b; dividers solid toward a signal, dashed elsewhere
          const toSig = side > 0 ? sig.has(e.b) : sig.has(e.a)
          if (toSig) strip(white, ...P(s0, o), ...P(s1, o), 0.12)
          else dashes(white, ...P(s0, o), ...P(s1, o), 0.12, 2, 4)
        }
      }
    } else if (e.lane > 0) {
      // single yellow: solid for the last 12 m before a signal, dashed otherwise
      const sa = sig.has(e.a) ? Math.min(s1, s0 + 12) : s0
      const sb = sig.has(e.b) ? Math.max(sa, s1 - 12) : s1
      if (sa > s0) strip(yellow, ...P(s0, 0), ...P(sa, 0), 0.14)
      if (sb > sa) dashes(yellow, ...P(sa, 0), ...P(sb, 0), 0.14, 3, 3)
      if (s1 > sb) strip(yellow, ...P(sb, 0), ...P(s1, 0), 0.14)
    }
  }
}
/**
 * Build all traffic furniture. R: RoadGraph, T: TrafficSystem, board: { w, d }.
 * Returns { markings: Object3D, junctions: [{ j, object, lamps }] } (objects in world space).
 */
export function dressTraffic(R, T, board) {
  const white = []
  const yellow = []
  const asphalt = []
  edgeMarkings(R, T, board, white, yellow, asphalt)
  const junctions = []
  for (const j of T.junctions) {
    for (const L of j.legs) {
      // stop line across the inbound lanes
      const st = j.stops.find((s) => s.leg === L.to)
      const ox = L.ux * 0.2
      const oz = L.uz * 0.2
      strip(white, st.a.x + ox, st.a.z + oz, st.b.x + ox, st.b.z + oz, 0.4, 0.072)
      // zebra: stripes parallel to traffic, spread across the carriageway
      const n = Math.max(3, Math.floor((L.hw * 2 - 0.4) / 1))
      const step = (L.hw * 2 - 0.4) / n
      for (let i = 0; i < n; i++) {
        const o = -L.hw + 0.2 + step * (i + 0.5)
        const cx = j.x + L.ux * L.cross + L.rnx * o
        const cz = j.z + L.uz * L.cross + L.rnz * o
        strip(white, cx - L.ux * 1.5, cz - L.uz * 1.5, cx + L.ux * 1.5, cz + L.uz * 1.5, 0.5, 0.072)
      }
    }
    const lamps = lampSet()
    const g = new THREE.Group()
    g.name = `traffic.${j.node}`
    g.position.set(j.x, 0, j.z)
    for (const p of j.poles) {
      const pole = signalPole(lamps[p.group], { arm: p.arm, peds: p.peds, P: lamps.ped })
      pole.position.set(p.x - j.x, 0, p.z - j.z)
      pole.rotation.y = p.yaw
      g.add(pole)
    }
    for (const p of j.posts) {
      const post = pedPost(lamps.ped)
      post.position.set(p.x - j.x, 0, p.z - j.z)
      post.rotation.y = p.yaw
      g.add(post)
    }
    bake(g, { colors: true })
    junctions.push({ j, object: g, lamps })
  }
  const markings = new THREE.Group()
  markings.name = 'traffic.markings'
  const add = (geos, m) => {
    if (!geos.length) return
    const mesh = new THREE.Mesh(mergeGeometries(geos), m)
    mesh.receiveShadow = true
    markings.add(mesh)
  }
  add(asphalt, surfaceMat('asphalt', 1))
  add(white, mat('marking'))
  add(yellow, mat('marking.yellow'))
  return { markings, junctions }
}
