// Tunnel pack - one tube as a rig (prefab 'tunnelTube'): layered shells drawn by chainage
// range (rough rock, sprayed shotcrete, membrane, cast lining), floors, the stepped face
// with drill holes / charge wires, the muck pile, steel arches + mesh + rock bolts at the
// face, the ventilation duct, wall services, LED strips, chainage signs, work lights and
// named anchors for twin devices. rig.setDay(day) poses everything from tunnelState(day).
// Local frame: x across (east +), y up, z = -chainage (the group sits at the portal).

import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { profile, halfWidth, OFF, fbm2, vnoise, tunnelState, TRESTLE, CROWN, KM } from './geom.js'
import { rockMat, shotMat, liningMat, membraneMat, plain } from './mats.js'
import { surfaceMat, mat, glowMat } from '../../render/materials.js'
import { makeCanvas } from '../../render/textures.js'

export const LEN = 160 //   modelled length (m)
const N = 48 //            ring points

/** shell ring geometry from chainage 0 to LEN, `step` m per segment; jit(s, i) radial offset */
function shell(off, { step = 1, jit = null, faceted = false } = {}) {
  const prof = profile(off, N)
  const nrm = prof.map((p, i) => {
    const a = prof[Math.max(0, i - 1)], b = prof[Math.min(N - 1, i + 1)]
    const tx = b[0] - a[0], ty = b[1] - a[1], l = Math.hypot(tx, ty) || 1
    return [ty / l, -tx / l]
  })
  const arc = [0]
  for (let i = 1; i < N; i++) arc.push(arc[i - 1] + Math.hypot(prof[i][0] - prof[i - 1][0], prof[i][1] - prof[i - 1][1]))
  const rings = Math.round(LEN / step) + 1
  const pos = new Float32Array(rings * N * 3)
  const uv = new Float32Array(rings * N * 2)
  for (let r = 0; r < rings; r++) {
    const s = r * step
    for (let i = 0; i < N; i++) {
      const k = r * N + i
      const d = jit ? jit(s, arc[i], i) : 0
      const end = i === 0 || i === N - 1
      pos[k * 3] = prof[i][0] + nrm[i][0] * d
      pos[k * 3 + 1] = end ? 0 : prof[i][1] + nrm[i][1] * d
      pos[k * 3 + 2] = -s
      uv[k * 2] = arc[i]; uv[k * 2 + 1] = s
    }
  }
  const idx = []
  for (let r = 0; r < rings - 1; r++) for (let i = 0; i < N - 1; i++) {
    const a = r * N + i, b = a + 1, c = a + N, d = c + 1
    // wound so the front faces look at the tube axis
    idx.push(a, c, b, b, c, d)
  }
  let g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
  g.setIndex(idx)
  if (faceted) g = g.toNonIndexed()
  g.computeVertexNormals()
  g.userData.per = (N - 1) * 6
  g.userData.step = step
  return g
}

/** draw the shell between chainages a..b (whole segments, rounded outward) */
function range(mesh, a, b) {
  const g = mesh.geometry
  const st = g.userData.step
  const i0 = Math.max(0, Math.floor(a / st))
  const i1 = Math.min(Math.round(LEN / st), Math.ceil(b / st))
  mesh.visible = i1 > i0
  g.setDrawRange(i0 * g.userData.per, Math.max(0, i1 - i0) * g.userData.per)
}

/** floor strip (y), width w, 1 m segments, planar uv */
function strip(w, y, tile = 4) {
  const pos = [], uv = []
  for (let s = 0; s < LEN; s++) {
    const v = [[-w, s], [w, s], [w, s + 1], [-w, s], [w, s + 1], [-w, s + 1]]
    for (const [x, ss] of v) { pos.push(x, y, -ss); uv.push(x / tile, ss / tile) }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  g.computeVertexNormals()
  g.userData.per = 6
  g.userData.step = 1
  return g
}

/** flat ring band between two profile offsets (front edge of a layer), facing +z */
function band(o0, o1) {
  const a = profile(o0, N), b = profile(o1, N)
  const pos = []
  for (let i = 0; i < N - 1; i++) {
    const p = [a[i], a[i + 1], b[i + 1], b[i]]
    for (const k of [0, 1, 2, 0, 2, 3]) pos.push(p[k][0], p[k][1], 0)
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(pos.filter((_, i) => i % 3 !== 2).map((v) => v / 3), 2))
  g.computeVertexNormals()
  return g
}

const rockJit = (seed) => (s, a) => 0.25 + 0.42 * (fbm2(s / 2.2 + seed, a / 2.2) + 0.5) + 0.28 * (vnoise(s * 1.7 + seed, a * 1.7) - 0.5)
const shotJit = (seed) => (s, a) => 0.12 * Math.max(0, fbm2(s / 1.3 + seed, a / 1.3) + 0.3)

// ---------------------------------------------------------------- the face (two benches)
const BENCH = 3.5 //  upper / lower split height
const BENCH_L = 3 //  lower face trails the upper face

/** displaced grid in the face plane; keep cells inside the outline between y0..y1 */
function faceGrid(y0, y1, seed, depth = 0.55) {
  const w = halfWidth(OFF.rock, 3) + 1.4
  const pos = []
  const st = 0.45
  const inside = (x, y) => y >= y0 - 0.01 && y <= y1 + 0.01 && Math.abs(x) <= halfWidth(OFF.rock + 0.6, Math.max(0, y))
  const dz = (x, y) => depth * (fbm2(x / 1.6 + seed, y / 1.6) + 0.35 * (vnoise(x * 1.3 + seed, y * 1.3) - 0.5)) + 0.25
  for (let y = y0; y < y1 - 1e-6; y += st) for (let x = -w; x < w; x += st) {
    const ya = y, yb = Math.min(y1, y + st), xa = x, xb = x + st
    if (!inside((xa + xb) / 2, (ya + yb) / 2) && !inside(xa, ya) && !inside(xb, yb)) continue
    const p = [[xa, ya], [xb, ya], [xb, yb], [xa, yb]].map(([px, py]) => [px, py, -dz(px, py)])
    for (const k of [0, 1, 2, 0, 2, 3]) pos.push(...p[k])
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(pos.filter((_, i) => i % 3 !== 2).map((v) => v / 4), 2))
  g.computeVertexNormals()
  return g
}

/** bench top: rough horizontal strip at y = BENCH between the upper and lower faces */
function benchTop(seed) {
  const w = halfWidth(OFF.rock, BENCH) + 0.8
  const pos = []
  for (let z = 0; z < BENCH_L; z += 0.5) for (let x = -w; x < w; x += 0.5) {
    const p = [[x, z], [x + 0.5, z], [x + 0.5, z + 0.5], [x, z + 0.5]].map(([px, pz]) => [px, BENCH + 0.18 * fbm2(px / 1.1 + seed, pz / 1.1) - 0.05, pz])
    for (const k of [0, 2, 1, 0, 3, 2]) pos.push(...p[k])
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(pos.filter((_, i) => i % 3 !== 1).map((v) => v / 4), 2))
  g.computeVertexNormals()
  return g
}

/** muck pile: lumpy half dome, unit size (scaled by the rig) */
function muckGeo() {
  const g = new THREE.SphereGeometry(1, 28, 10, 0, Math.PI * 2, 0, Math.PI / 2)
  const p = g.attributes.position
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i)
    const k = 1 + 0.18 * fbm2(x * 3 + 5, z * 3) + 0.12 * (vnoise(x * 9, z * 9) - 0.5)
    p.setXYZ(i, x * k, y * (0.8 + 0.4 * vnoise(x * 4, z * 4)), z * k)
  }
  g.computeVertexNormals()
  return g.toNonIndexed()
}

/** blast-hole layout (local face coordinates); shuffled so three booms drill different areas */
function holeLayout() {
  const pts = []
  const up = profile(OFF.rock - 0.35, 60).filter(([, y]) => y > BENCH + 0.4)
  for (let i = 0; i < up.length; i += 2) pts.push([up[i][0], up[i][1], 0])
  for (let y = BENCH + 1.2; y < 8.6; y += 0.95) {
    const w = halfWidth(OFF.rock, y) - 1.1
    for (let x = -w; x <= w + 1e-6; x += 1.05) pts.push([x + ((y * 3.1) % 0.5), y, 0])
  }
  for (const [x, y] of [[0, 6], [0.35, 6], [-0.35, 6], [0, 6.35], [0, 5.65], [0.6, 6.4], [-0.6, 5.6], [0.6, 5.6], [-0.6, 6.4]]) pts.push([x, y, 0])
  for (let y = 0.6; y < BENCH - 0.3; y += 0.95) {
    const w = halfWidth(OFF.rock, y) - 0.9
    for (let x = -w; x <= w + 1e-6; x += 1.1) pts.push([x, y, BENCH_L])
  }
  let s = 7
  for (let i = pts.length - 1; i > 0; i--) { s = (s * 16807) % 2147483647; const j = s % (i + 1); [pts[i], pts[j]] = [pts[j], pts[i]] }
  return pts
}

// ---------------------------------------------------------------- arches, mesh, bolts
/** one HW150 steel arch (inner flange, web, outer flange) along the rib offset */
function ribGeo() {
  const a = profile(OFF.rib, 40), b = profile(OFF.rib + 0.15, 40)
  const pos = []
  const q = (p0, p1, p2, p3) => { for (const p of [p0, p1, p2, p0, p2, p3]) pos.push(...p) }
  for (let i = 0; i < a.length - 1; i++) {
    const [x0, y0] = a[i], [x1, y1] = a[i + 1], [u0, v0] = b[i], [u1, v1] = b[i + 1]
    for (const [p0, p1] of [[[x0, y0], [x1, y1]], [[u0, v0], [u1, v1]]]) q([p0[0], p0[1], -0.08], [p1[0], p1[1], -0.08], [p1[0], p1[1], 0.08], [p0[0], p0[1], 0.08])
    q([x0, y0, 0], [x1, y1, 0], [u1, v1, 0], [u0, v0, 0])
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.computeVertexNormals()
  return g
}

let meshMatC
function meshMat() {
  if (meshMatC) return meshMatC
  const c = makeCanvas(128)
  const x = c.getContext('2d')
  x.clearRect(0, 0, 128, 128)
  x.strokeStyle = '#4a3b30'
  x.lineWidth = 5
  for (let i = 0; i <= 128; i += 32) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, 128); x.stroke(); x.beginPath(); x.moveTo(0, i); x.lineTo(128, i); x.stroke() }
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(1 / 0.6, 1 / 0.6)
  meshMatC = new THREE.MeshStandardMaterial({ map: t, alphaTest: 0.5, transparent: false, roughness: 0.6, metalness: 0.6, side: THREE.DoubleSide, name: 'tunnel.mesh' })
  return meshMatC
}

function bolts(maxS) {
  const plate = new THREE.BoxGeometry(0.2, 0.2, 0.04)
  const im = new THREE.InstancedMesh(plate, mat('steel.dark'), 2000)
  const prof = profile(OFF.shot - 0.03, 18)
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), z = new THREE.Vector3(0, 0, 1), n = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1), p = new THREE.Vector3()
  let k = 0
  const cum = []
  for (let s = 0.6; s < maxS && k < 2000; s += 1.2) {
    // staggered pattern: odd rings use the odd profile points
    for (let i = 2 + (Math.round(s / 1.2) % 2); i < prof.length - 2; i += 2) {
      const [x, y] = prof[i]
      if (y < 1.2) continue
      n.set(-x, 2.75 - y, 0).normalize()
      q.setFromUnitVectors(z, n)
      im.setMatrixAt(k++, m.compose(p.set(x, y, -s), q, one))
    }
    // cumulative instance count up to (and including) the ring at chainage s
    cum.push([s, k])
  }
  im.userData.cum = cum
  im.count = 0
  im.castShadow = false
  im.receiveShadow = true
  return im
}

// ---------------------------------------------------------------- services, duct, LEDs, signs
/** sagging duct along the left shoulder, chainage 0..LEN (drawn up to the duct end) */
function ductGeo() {
  const pts = []
  for (let s = 0; s <= LEN; s += 1) pts.push(new THREE.Vector3(-3.05, 7.05 - 0.16 * Math.sin(((s % 6) / 6) * Math.PI), -s))
  const g = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), LEN * 2, 0.9, 16, false)
  g.userData.per = 16 * 6
  g.userData.step = 0.5
  return g
}

let ductM
const ductMat = () => (ductM ??= (() => {
  const c = makeCanvas(256, 64)
  const x = c.getContext('2d')
  x.fillStyle = '#d8a22c'; x.fillRect(0, 0, 256, 64)
  x.fillStyle = 'rgba(0,0,0,0.22)'; for (let i = 0; i < 256; i += 32) x.fillRect(i, 0, 3, 64)
  x.fillStyle = 'rgba(60,40,10,0.25)'; x.fillRect(0, 40, 256, 24)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(LEN / 3, 1)
  return new THREE.MeshStandardMaterial({ map: t, roughness: 0.75, metalness: 0, side: THREE.DoubleSide, name: 'tunnel.duct' })
})())

/** straight pipe along z from chainage 0..1 (scaled by the rig) */
function pipe(r, color, x, y) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 1, 12).rotateX(Math.PI / 2).translate(0, 0, -0.5), plain(color, 0.45, 0.4))
  m.position.set(x, y, 0)
  m.castShadow = true
  m.receiveShadow = true
  return m
}

function signTexture(text, sub) {
  const c = makeCanvas(256, 128)
  const x = c.getContext('2d')
  x.fillStyle = '#1f5fbf'; x.fillRect(0, 0, 256, 128)
  x.strokeStyle = '#ffffff'; x.lineWidth = 6; x.strokeRect(6, 6, 244, 116)
  x.fillStyle = '#ffffff'; x.textAlign = 'center'; x.textBaseline = 'middle'
  x.font = 'bold 40px sans-serif'; x.fillText(text, 128, 50)
  x.font = 'bold 24px "Microsoft YaHei", sans-serif'; x.fillText(sub, 128, 95)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}
const km = (s) => `DK${Math.floor((KM + s) / 1000)}+${String(Math.round((KM + s) % 1000)).padStart(3, '0')}`

const faceDz = (seed, depth = 0.55) => (x, y) => depth * (fbm2(x / 1.6 + seed, y / 1.6) + 0.35 * (vnoise(x * 1.3 + seed, y * 1.3) - 0.5)) + 0.25

/**
 * @param {{ side?: 'L'|'R', seed?: number }} p  L = main heading (membrane, pump line),
 *   R = trailing heading (no membrane / pump line, fewer lights)
 */
export function buildTube({ side = 'L', seed = 1 } = {}) {
  const g = new THREE.Group()
  g.name = `tube.${side}`
  const main = side === 'L'
  const add = (o, name) => { o.name = name; o.castShadow ??= true; o.receiveShadow = true; g.add(o); return o }
  const mesh = (geo, m, name, cast = true) => { const o = new THREE.Mesh(geo, m); o.castShadow = cast; return add(o, name) }

  // shells (inner layers hide outer ones where both exist)
  const rock = mesh(shell(OFF.rock, { jit: rockJit(seed * 3.1), faceted: true }), rockMat(), 'rock')
  const shot = mesh(shell(OFF.shot, { jit: shotJit(seed * 1.7) }), shotMat(), 'shotcrete')
  const memb = main ? mesh(shell(OFF.membrane, { step: 1 }), membraneMat(), 'membrane') : null
  const lining = mesh(shell(OFF.lining, { step: 1 }), liningMat(), 'lining')
  const liningEdge = mesh(band(OFF.lining, OFF.membrane + 0.02), liningMat(), 'lining.edge')
  liningEdge.material = liningMat().clone(); liningEdge.material.side = THREE.DoubleSide
  const shotEdge = mesh(band(OFF.shot, OFF.rock + 0.05), shotMat(), 'shot.edge')
  // floors: paved (behind the trestle) / rough muck floor (trestle front .. face)
  const paved = mesh(strip(halfWidth(OFF.lining, 0) + 0.15, 0.02), surfaceMat('concrete', 1), 'floor.paved', false)
  const rough = mesh(strip(halfWidth(OFF.rock, 0) + 0.4, 0.0, 3), rockMat(), 'floor.rough', false)
  // the face: upper heading, bench top, lower bench
  const upper = mesh(faceGrid(BENCH, 10.5, seed * 7), rockMat(), 'face.upper')
  const benchM = mesh(benchTop(seed * 5), rockMat(), 'face.bench')
  const lower = mesh(faceGrid(-0.05, BENCH, seed * 11), rockMat(), 'face.lower')
  const muck = mesh(muckGeo(), rockMat(), 'muck')
  // blast holes + charge wires
  const holes = holeLayout()
  const dzU = faceDz(seed * 7), dzL = faceDz(seed * 11)
  const holeIM = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.05, 0.05, 0.06, 8).rotateX(Math.PI / 2), plain('#121110', 0.95), holes.length)
  const wireIM = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.008, 0.008, 1, 4).translate(0, -0.5, 0), plain('#e8641c', 0.6), holes.length)
  const hm = new THREE.Matrix4(), hv = new THREE.Vector3(), hq = new THREE.Quaternion(), hs = new THREE.Vector3(1, 1, 1)
  holes.forEach(([x, y, zb], i) => {
    const z = (zb ? -dzL(x, y) + zb : -dzU(x, y)) + 0.035
    holeIM.setMatrixAt(i, hm.compose(hv.set(x, y, z), hq, hs))
    const len = 0.6 + ((i * 37) % 10) / 10
    wireIM.setMatrixAt(i, hm.compose(hv.set(x, y, z + 0.04), hq.setFromAxisAngle(new THREE.Vector3(1, 0, 0), 0.25), hs.set(1, len, 1)))
    hs.set(1, 1, 1); hq.identity()
  })
  holeIM.castShadow = false; wireIM.castShadow = false
  add(holeIM, 'holes'); add(wireIM, 'wires')
  // arches + mesh near the face, rock bolts on the shotcrete
  const ribIM = new THREE.InstancedMesh(ribGeo(), mat('paint.dark'), 40)
  ribIM.castShadow = true
  add(ribIM, 'ribs')
  const meshPanel = mesh(shell(OFF.rib + 0.06, { step: 1 }), meshMat(), 'mesh', false)
  const boltIM = add(bolts(LEN), 'bolts')
  // ventilation duct, services
  const duct = mesh(ductGeo(), ductMat(), 'duct')
  const water = add(pipe(0.08, '#2f5f9a', -5.35, 0.9), 'pipe.water')
  const air = add(pipe(0.12, '#3a3d42', -5.2, 1.35), 'pipe.air')
  const pump = main ? add(pipe(0.08, '#9aa2aa', -5.1, 1.8), 'pipe.concrete') : null
  const escape = add(pipe(0.4, '#e26a1c', -4.8, 0.45), 'pipe.escape')
  const tray = add(pipe(0.06, '#202224', 5.3, 3.1), 'cable.tray')
  // LED strips (both walls, every 6 m) - always on, independent of night
  const nLed = Math.floor(LEN / 6) * 2
  const ledIM = new THREE.InstancedMesh(new THREE.BoxGeometry(0.08, 0.06, 1.2), glowMat('#fff1d6', 2.6), nLed)
  ledIM.castShadow = false
  add(ledIM, 'leds')
  // chainage signs every 20 m (east wall)
  const signs = []
  for (let s = 20; s < LEN; s += 20) {
    const sm = new THREE.Mesh(new THREE.PlaneGeometry(1, 0.5), new THREE.MeshStandardMaterial({ map: signTexture(km(s), `距洞口 ${s} m`), roughness: 0.5 }))
    sm.userData.s = s
    sm.castShadow = false
    signs.push(add(sm, `sign.${s}`))
  }
  // work lights (real point lights; no shadows)
  const light = (name, color, intensity, dist) => { const l = new THREE.PointLight(color, intensity, dist, 1.6); l.name = name; l.castShadow = false; g.add(l); return l }
  const lights = main
    ? { face: light('light.face', '#fff0d8', 420, 30), front: light('light.front', '#ffe9c8', 260, 26), trestle: light('light.trestle', '#fff1dc', 220, 26), wpj: light('light.wpj', '#fff1dc', 200, 24), jumbo: light('light.jumbo', '#fff4e6', 260, 28), lined: light('light.lined', '#fff4e6', 160, 30) }
    : { face: light('light.face', '#fff0d8', 360, 30), front: light('light.front', '#ffe9c8', 220, 26), lined: light('light.lined', '#fff4e6', 160, 30), lined2: light('light.lined2', '#fff4e6', 150, 30) }
  // twin anchors (component nodes 'tube-l.face', 'tube-l.sec120', ...)
  const anchor = (name, x, y, z) => { const o = new THREE.Object3D(); o.name = name; o.position.set(x, y, z); g.add(o); return o }
  const rig = { root: g }
  rig.face = anchor('face', 0, 5, 0)
  rig.bench = anchor('bench', 0, BENCH, 0)
  rig.trestle = anchor('trestle', 0, 2, 0)
  rig.lining = anchor('lining', 0, 6, 0)
  rig.portal = anchor('portal', 0, 3, -2)
  const fixed = []
  for (const s of [60, 90, 120, 135]) fixed.push((rig[`sec${s}`] = anchor(`sec${s}`, 0, 8.4, -s)))
  for (let s = 25; s < LEN; s += 25) fixed.push((rig[`uwb${s}`] = anchor(`uwb${s}`, 5.2, 3.4, -s)))

  let last = null
  rig.setDay = (day) => {
    const key = Math.round(day * 40000)
    if (key === last) return
    last = key
    const S = tunnelState(day)
    const t = main ? S.L : S.R
    rig.state = S
    rig.t = t
    const F = t.face, lined = Math.max(0, t.lined), trestle = main ? t.trestle : -100
    // shells
    range(rock, 0, F)
    range(shot, 0, t.shot)
    if (memb) range(memb, 0, t.membrane)
    range(lining, 0, lined)
    liningEdge.position.z = -lined
    liningEdge.visible = lined > 0.5
    shotEdge.position.z = -t.shot
    // floors (the trestle prefab carries the invert pit)
    const tr0 = trestle - TRESTLE.half, tr1 = trestle + TRESTLE.half
    range(paved, 0, main ? tr0 : F - 28)
    rough.geometry.setDrawRange(Math.max(0, Math.floor(main ? tr1 : F - 28)) * 6, Math.max(0, Math.ceil(F - BENCH_L) - Math.floor(main ? tr1 : F - 28)) * 6)
    // face
    upper.position.z = -F
    benchM.position.z = -F
    lower.position.z = -(F - BENCH_L)
    const mk = main ? t.muck : 0
    muck.visible = mk > 0.02
    muck.position.set(0.3, -0.05, -(F - BENCH_L - 3.2))
    muck.scale.set(5.2 * (0.55 + 0.45 * mk), 2.6 * mk + 0.05, 4.2 * (0.6 + 0.4 * mk))
    const nh = Math.floor((main ? t.holes : 0) * holes.length)
    holeIM.count = nh
    holeIM.position.z = -F
    wireIM.count = Math.floor((main ? t.wires : 0) * holes.length)
    wireIM.position.z = -F
    // arches (every 0.8 m from the shotcrete front to the rib front) + mesh panel between
    const m4 = new THREE.Matrix4()
    let nr = 0
    for (let s = Math.max(0, t.shot - 2.4); s < t.ribs && nr < 40; s += 0.8) ribIM.setMatrixAt(nr++, m4.makeTranslation(0, 0, -s))
    ribIM.count = nr
    ribIM.instanceMatrix.needsUpdate = true
    range(meshPanel, Math.max(0, t.shot), Math.max(t.shot, t.ribs))
    const cum = boltIM.userData.cum
    let nb = 0
    for (const [s, k] of cum) { if (s > t.shot - 0.4) break; nb = k }
    boltIM.count = nb
    // duct ends ~30 m short of the face; services up to the lined / support front
    range(duct, 0, F - 30)
    const span = (o, a, b) => { o.visible = b > a + 0.5; o.position.z = -a; o.scale.z = Math.max(0.01, b - a) }
    span(water, 0, F - 8); span(air, 0, F - 8)
    if (pump) span(pump, 0, t.jRear + 6)
    span(escape, lined, main ? tr0 - 1 : F - 20)
    span(tray, 0, t.shot - 2)
    // LEDs: lining wall / shotcrete wall, up to 10 m from the face
    let nl = 0
    const lm = new THREE.Matrix4(), lq = new THREE.Quaternion(), lv = new THREE.Vector3(), ls = new THREE.Vector3(1, 1, 1)
    for (let s = 3; s < F - 10 && nl < nLed - 1; s += 6) {
      const off = s < lined ? OFF.lining : OFF.shot
      const w = halfWidth(off, 3.4) - 0.05
      for (const sx of [-1, 1]) { lq.setFromAxisAngle(new THREE.Vector3(0, 0, 1), sx * 0.3); ledIM.setMatrixAt(nl++, lm.compose(lv.set(sx * w, 3.4, -s), lq, ls)) }
    }
    ledIM.count = nl
    ledIM.instanceMatrix.needsUpdate = true
    for (const sm of signs) {
      const s = sm.userData.s
      sm.visible = s < t.shot - 2
      const w = halfWidth(s < lined ? OFF.lining : OFF.shot, 2.4) - 0.04
      sm.position.set(w, 2.4, -s)
      sm.rotation.set(0, -Math.PI / 2, 0)
    }
    // lights follow the work
    lights.face.position.set(0, 6.5, -(F - 7))
    lights.front.position.set(0, 6.4, -(F - 20))
    lights.lined.position.set(0, 7.2, -Math.max(12, lined * 0.45))
    if (main) {
      lights.trestle.position.set(0, 6.6, -trestle)
      lights.wpj.position.set(0, 6.2, -t.wpj)
      lights.jumbo.position.set(0, 6.4, -(t.jRear + 6))
    } else lights.lined2.position.set(0, 7.2, -Math.max(20, lined * 0.85))
    // anchors
    rig.face.position.z = -(F - 0.8)
    rig.bench.position.z = -(F - BENCH_L - 1)
    rig.trestle.position.z = -trestle
    rig.lining.position.z = -(t.jRear + 6)
    for (const o of fixed) o.visible = -o.position.z < F - 1
  }
  return { object: g, rig }
}
