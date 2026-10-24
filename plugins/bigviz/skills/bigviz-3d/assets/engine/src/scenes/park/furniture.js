// Park pack - street furniture: smart lamp pole (LED head, camera dome, environment sensor,
// speaker, 5G cell, info screen, SOS box), shared-bike docks (three operator colours),
// bikes / delivery e-bikes (shared builder), metro exit canopy, park sign monolith, flagpoles,
// bike-lane surfacing with pictograms.

import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { lightMat, colorMat, glowMat } from '../../render/materials.js'
import { makeCanvas } from '../../render/textures.js'
import { createRng } from '../../core/rng.js'
import { Quads, boxes, cyls, M, signMaterial, plane } from './kit.js'

const V = (x, y, z) => new THREE.Vector3(x, y, z)

/** Smart pole (10 m), arm toward local +z */
export function smartPole({ h = 10, arm = 2.2, screen = true } = {}) {
  const g = new THREE.Group()
  g.add(cyls([[0, 0, 0, 0.13, h, 14, 0.19]], M.aluDark()))
  g.add(boxes([[0, 0.25, 0, 0.62, 0.5, 0.62], [0, h - 0.05, arm / 2, 0.1, 0.1, arm], [0, h - 0.1, arm, 0.36, 0.14, 0.95], [0, 4.6, 0.2, 0.26, 0.55, 0.22], [0, 6.1, 0.45, 0.06, 0.06, 0.5], [0.18, 8, 0, 0.12, 0.9, 0.24], [0, 1.25, 0.16, 0.24, 0.4, 0.12]], M.aluDark()))
  g.add(boxes([[0, h - 0.19, arm, 0.3, 0.03, 0.85]], lightMat('#fff1d6', 3.2, 'street'), { cast: false }))
  // camera dome, horn speaker, SOS button
  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), colorMat('#151719', 0.1, 0.4))
  dome.position.set(0, 6.05, 0.7)
  g.add(dome, cyls([[0, 6.08, 0.7, 0.15, 0.08, 12]], M.white()))
  const horn = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.16, 0.32, 10).rotateX(Math.PI / 2), M.white())
  horn.position.set(0, 5.3, 0.22)
  g.add(horn, boxes([[0, 1.3, 0.225, 0.08, 0.08, 0.02]], glowMat('#ff3a2a', 1.2), { cast: false }))
  if (screen) {
    g.add(boxes([[0, 3.1, 0.2, 0.62, 1.05, 0.1]], M.black()))
    g.add(plane(0.54, 0.96, signMaterial('云栖 · 智慧园区', { bg: '#0d2a44', fg: '#bfe3ff', glow: '#6fc1ff', k: 1.2, w: 256, h: 448, font: 'bold 44px sans-serif', sub: 'PM2.5 32 · 24℃' }), { y: 3.1, z: 0.256 }))
  }
  return { object: g, glows: [{ pos: V(0, h - 0.35, arm), group: 'street', color: '#ffe0b0', size: 3.2, pool: 7 }] }
}

/** cylinder between two points */
function tubeG(a, b, r, seg = 6) {
  const d = new THREE.Vector3().subVectors(b, a)
  const g = new THREE.CylinderGeometry(r, r, d.length(), seg)
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()))
  g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2)
  return g
}

/**
 * Bike geometry, along local +z (front). kind: 'shared' | 'ebike'. Returns geometry lists by
 * part so racks can merge many bikes; wheels separately (riders spin them).
 */
export function bikeParts({ kind = 'shared' } = {}) {
  const e = kind === 'ebike'
  const R = e ? 0.3 : 0.33
  const wb = e ? 0.62 : 0.55
  const rear = V(0, R, -wb)
  const front = V(0, R, wb)
  const bb = V(0, R - 0.02, -0.05)
  const seat = V(0, e ? 0.85 : 0.88, -0.28)
  const head = V(0, e ? 0.82 : 0.86, wb - 0.16)
  const frame = []
  const T = e ? 0.04 : 0.022
  frame.push(tubeG(bb, head, T), tubeG(bb, seat, T * 0.9), tubeG(bb, rear, T * 0.7), tubeG(seat, rear, T * 0.7), tubeG(head, front, T * 0.8))
  if (!e) frame.push(tubeG(seat.clone().add(V(0, -0.05, 0.05)), head.clone().add(V(0, -0.06, 0)), T * 0.8))
  const dark = [tubeG(head, head.clone().add(V(0, 0.16, -0.05)), 0.018), tubeG(V(-0.28, head.y + 0.16, head.z - 0.06), V(0.28, head.y + 0.16, head.z - 0.06), 0.014), new THREE.BoxGeometry(0.16, 0.06, 0.26).translate(0, seat.y + 0.04, seat.z), tubeG(seat, seat.clone().add(V(0, 0.04, 0)), 0.016)]
  const extra = []
  if (e) {
    extra.push(new THREE.BoxGeometry(0.46, 0.42, 0.44).translate(0, 1.02, -0.52), new THREE.BoxGeometry(0.3, 0.22, 0.5).translate(0, 0.42, -0.05))
    dark.push(new THREE.BoxGeometry(0.4, 0.04, 0.4).translate(0, 0.79, -0.52))
  } else extra.push(new THREE.BoxGeometry(0.34, 0.2, 0.26).translate(0, head.y - 0.02, head.z + 0.16))
  const wheel = () => new THREE.TorusGeometry(R - 0.03, 0.03, 6, 20).rotateY(Math.PI / 2)
  const hubs = () => new THREE.CylinderGeometry(R - 0.06, R - 0.06, 0.012, 16).rotateZ(Math.PI / 2)
  return { frame, dark, extra, R, rear, front, wheel, hubs }
}

const merge = (list) => { const m = mergeGeometries(list.map((g) => (g.index ? g.toNonIndexed() : g)), false); list.forEach((g) => g.dispose()); return m }
const SHARED = ['#f2c81e', '#2f7fd8', '#3cc0a8']

/** Dock of n shared bikes in a row along local x (bikes face +z) */
export function bikeDock({ n = 12, seed = 1, brand } = {}) {
  const rng = createRng(seed * 11 + 3)
  const col = brand ?? rng.int(0, 2)
  const frame = [], dark = [], extra = [], tyres = [], disc = []
  for (let i = 0; i < n; i++) {
    const P = bikeParts({ kind: 'shared' })
    const m = new THREE.Matrix4().makeRotationY(rng.jitter(0.12)).setPosition((i - (n - 1) / 2) * 0.72, 0, rng.jitter(0.12))
    const add = (list, g) => list.push(g.applyMatrix4(m))
    P.frame.forEach((g) => add(frame, g)); P.dark.forEach((g) => add(dark, g)); P.extra.forEach((g) => add(extra, g))
    for (const c of [P.rear, P.front]) { add(tyres, P.wheel().translate(c.x, c.y, c.z)); add(disc, P.hubs().translate(c.x, c.y, c.z)) }
  }
  const g = new THREE.Group()
  const paint = colorMat(SHARED[col], 0.4, 0.2)
  for (const [list, mtl] of [[frame, paint], [dark, M.black()], [extra, paint], [tyres, colorMat('#18191b', 0.85)], [disc, colorMat('#9aa0a4', 0.4, 0.6)]]) {
    const mesh = new THREE.Mesh(merge(list), mtl)
    mesh.castShadow = true
    mesh.receiveShadow = true
    g.add(mesh)
  }
  // painted dock bay on the paving
  g.add(boxes([[0, 0.17, 0, n * 0.72 + 0.6, 0.01, 2.0]], colorMat('#d9d6cc', 0.7), { cast: false }), boxes([[0, 0.172, 0, n * 0.72 + 0.4, 0.012, 1.8]], colorMat('#5b6066', 0.8), { cast: false }))
  return { object: g }
}

/** Metro exit: glass canopy over the escalator, mouth toward local +z (12 m long) */
export function metroExit({ line = '地铁 6 号线 · 云栖科技园站', exit = 'B' } = {}) {
  const g = new THREE.Group()
  const W = 6.4, L = 12, H = 3.6
  const frame = []
  for (let z = 0; z <= L + 0.01; z += 2.4) for (const x of [-W / 2, W / 2]) frame.push([x, H / 2 + 0.15, -z, 0.12, H, 0.12])
  frame.push([0, H + 0.15, 0, W, 0.18, 0.18], [-W / 2, H + 0.15, -L / 2, 0.14, 0.18, L], [W / 2, H + 0.15, -L / 2, 0.14, 0.18, L])
  const G = new Quads()
  G.wall(-W / 2, -L, -W / 2, 0, 0.6, H + 0.15, [-1, 0, 0]); G.wall(W / 2, 0, W / 2, -L, 0.6, H + 0.15, [1, 0, 0])
  G.wall(W / 2, -L, -W / 2, -L, 0.6, H + 0.15, [0, 0, -1])
  G.rect(-W / 2, -L, W / 2, 0, H + 0.25, 1, 2)
  // low granite curb on three sides (open at the mouth), glass above it
  const stone = [[-W / 2, 0.38, -L / 2, 0.4, 0.46, L], [W / 2, 0.38, -L / 2, 0.4, 0.46, L], [0, 0.38, -L, W + 0.4, 0.46, 0.4]]
  // escalator well: dark floor with lit step nosings descending away from the mouth
  const steps = []
  for (let i = 0; i < 9; i++) steps.push([0, 0.18, -1.6 - i * 1.05, W - 1.6, 0.012, 0.08])
  g.add(boxes(frame, M.alu()), G.mesh(M.clearGlass(), false), boxes(stone, M.granite()), boxes([[0, 0.165, -L / 2 - 0.4, W - 0.8, 0.012, L - 1.2]], colorMat('#202224', 0.6), { cast: false }), boxes(steps, M.lamp('#dfe9f2', 0.7), { cast: false }))
  // totem: metro logo + line name
  g.add(boxes([[W / 2 + 0.9, 1.6, -0.2, 0.5, 3.2, 0.5]], M.aluDark()))
  g.add(plane(0.45, 0.45, signMaterial('M', { bg: '#c8102e', fg: '#ffffff', glow: '#ff9aa8', k: 1.6, w: 128, h: 128, font: 'bold 96px sans-serif' }), { x: W / 2 + 0.9, y: 2.9, z: 0.06 }))
  g.add(plane(0.45, 1.6, signMaterial(exit, { bg: '#1c1f22', fg: '#ffd34a', glow: '#ffd34a', k: 1.2, w: 128, h: 448, font: 'bold 110px sans-serif' }), { x: W / 2 + 0.9, y: 1.7, z: 0.06 }))
  g.add(plane(W - 0.6, 0.5, signMaterial(line, { bg: '#13161a', fg: '#ffffff', glow: '#cfe6ff', k: 1.2 }), { y: H - 0.1, z: 0.1 }))
  return { object: g, glows: [{ pos: V(0, H - 0.4, -2), group: 'street', color: '#e8f2ff', size: 2.4, pool: 4 }] }
}

/** Park name monolith (stone wall, brushed steel letters lit at night) */
export function parkSign({ text = '云栖科技园', sub = 'YUNQI SCIENCE & TECHNOLOGY PARK', w = 16 } = {}) {
  const g = new THREE.Group()
  g.add(boxes([[0, 1.3, 0, w, 2.6, 1.2], [0, 0.12, 0, w + 0.8, 0.24, 2]], M.stoneDark()))
  g.add(plane(w * 0.86, w * 0.16, signMaterial(text, { k: 1.6, sub, fg: '#e8e2d4', glow: '#ffe9c4' }), { y: 1.45, z: 0.61 }))
  g.add(boxes([[0, 0.3, 0.9, w, 0.1, 0.25]], lightMat('#fff0d8', 2.2, 'street'), { cast: false }))
  return { object: g, glows: [{ pos: V(0, 0.4, 1.1), group: 'street', color: '#ffe4bc', size: 2.2, pool: 6 }] }
}

/** Three flagpoles (12 m) */
export function flagpoles() {
  const g = new THREE.Group()
  g.add(cyls([[-2.5, 0, 0, 0.07, 12, 10, 0.1], [0, 0, 0, 0.07, 13, 10, 0.1], [2.5, 0, 0, 0.07, 12, 10, 0.1]], M.steel()), boxes([[0, 0.2, 0, 7.4, 0.4, 1.6]], M.granite()))
  const flag = (x, y, col) => { const m = plane(2.4, 1.6, colorMat(col, 0.8), { x: x + 1.25, y, z: 0 }); m.material.side = THREE.DoubleSide; m.castShadow = true; return m }
  g.add(flag(-2.5, 11, '#2f5fa8'), flag(0, 12, '#c8202a'), flag(2.5, 11, '#2f8a6a'))
  return { object: g }
}

/** Red bike-lane surfacing: rects [[x0, z0, x1, z1]], white edge lines + bike pictograms */
export function bikeLane({ rects = [], marks = [] } = {}) {
  const Q = new Quads()
  for (const [x0, z0, x1, z1] of rects) Q.rect(x0, z0, x1, z1, 0.072, 1, 4)
  const g = new THREE.Group()
  g.add(Q.mesh(colorMat('#8e3b31', 0.85), false))
  g.add(boxes(marks.map(([x, z, w, d]) => [x, 0.075, z, w, 0.006, d]), colorMat('#e6e4dc', 0.6), { cast: false }))
  return { object: g }
}

let bikeIcon = null
export function bikeIconMat() {
  if (bikeIcon) return bikeIcon
  const c = makeCanvas(128, 128)
  const x = c.getContext('2d')
  x.strokeStyle = '#fff'
  x.lineWidth = 7
  x.beginPath(); x.arc(32, 82, 22, 0, Math.PI * 2); x.stroke()
  x.beginPath(); x.arc(96, 82, 22, 0, Math.PI * 2); x.stroke()
  x.beginPath(); x.moveTo(32, 82); x.lineTo(56, 46); x.lineTo(88, 46); x.lineTo(96, 82); x.moveTo(56, 46); x.lineTo(66, 82); x.lineTo(88, 46); x.moveTo(50, 36); x.lineTo(64, 36); x.moveTo(84, 30); x.lineTo(88, 46); x.stroke()
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  bikeIcon = new THREE.MeshStandardMaterial({ map: t, transparent: true, alphaTest: 0.4, roughness: 0.7, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, name: 'bike.icon' })
  return bikeIcon
}
