// Realistic road vehicles ('realistic' style): cab-over truck kit (frame rails, bevelled cab,
// raked glass, grille, steps, mirrors, fuel tank, fenders, dual rear tyres, hazard bumper),
// mixer / dump / flatbed bodies and extruded car / van / bus bodies. Same rig keys as the
// diorama builders in vehicles.js (wheels, steer, beacons, tail, exhaust, drum, chute, bed...).

import * as THREE from 'three'
import { mat, colorMat, lightMat, own } from '../render/materials.js'
import { makeCanvas } from '../render/textures.js'
import { box, cyl, lathe, extrude, rod, pivot, dynamic, detail } from './kit.js'
import { decal, axle, headlamp, RUBBER } from './parts-real.js'

export const beamMatReal = { mat: null }
const beamGeo = new THREE.ConeGeometry(2.2, 12, 14, 1, true).rotateX(-Math.PI / 2).translate(0, 0, 6).rotateX(0.12)
const DARK = () => colorMat('#24272a', 0.6)
const GLASS = () => mat('glass.dark')

/** headlight beam cone (shared material from vehicles.js, driven at night) */
export function beam(root, material, x, y, z, s = 1) {
  const b = new THREE.Mesh(beamGeo, material)
  b.position.set(x, y, z)
  b.scale.setScalar(s)
  b.castShadow = false
  b.renderOrder = 3
  b.userData.keep = true
  root.add(b)
}

/** wheel arch over an axle: 3 angled plates around the tyre (radius r) */
export function fender(root, x, y, z, r, w, material) {
  for (const a of [-0.75, 0, 0.75]) {
    const R = r + 0.1
    root.add(box(w, 0.04, R * 0.82, material, { x, y: y + Math.cos(a) * R, z: z + Math.sin(a) * R, rx: a, cast: false }))
  }
}

/** Cab-over truck base. Same contract as vehicles.js truck(). */
export function realTruck({ L = 8, W = 2.5, wheelR = 0.55, axles = [-2.6, -1.3, 2.4], cab = 'paint.yellow', cabL = 2.3, cabH = 2.2, beacon = true, logo = true, beamMat } = {}) {
  const root = new THREE.Group()
  const rig = { wheels: [], steer: [], beacons: [], wheelR }
  const deckY = wheelR + 0.38
  const cz = L / 2 - cabL / 2
  const z0 = L / 2 - 0.12
  const zb = z0 - cabL
  const y0 = wheelR + 0.42
  const H = cabH + 0.15
  const paint = mat(cab)
  // frame rails + cross members
  for (const s of [1, -1]) root.add(box(0.16, 0.32, L - 0.5, mat('steel.dark'), { base: true, x: s * 0.45, y: wheelR - 0.08 }))
  for (let z = -L / 2 + 0.6; z < zb; z += 1.6) root.add(box(0.9, 0.12, 0.12, mat('steel.dark'), { x: 0, y: wheelR + 0.05, z }))
  // cab shell: side profile extruded across, raked windscreen, rounded edges
  const prof = [[zb, y0], [z0, y0], [z0, y0 + 1.05], [z0 - 0.14, y0 + H - 0.28], [z0 - 0.36, y0 + H], [zb, y0 + H]]
  root.add(extrude(`cab:${L}:${cabL}:${H}:${y0}`, prof, W, paint, { bevel: 0.07 }))
  const rake = Math.atan2(0.14, H - 1.33)
  root.add(box(W * 0.86, H - 1.45, 0.03, GLASS(), { y: y0 + 1.05 + (H - 1.33) / 2, z: z0 + 0.02, rx: -rake, cast: false }))
  root.add(box(W + 0.03, 0.78, cabL * 0.52, GLASS(), { y: y0 + 1.55, z: z0 - cabL * 0.36, cast: false }))
  root.add(box(W * 0.94, 0.07, 0.34, paint, { y: y0 + H - 0.08, z: z0 - 0.26 }))
  // grille, badge, bumper, lamps
  root.add(box(W * 0.66, 0.6, 0.04, DARK(), { y: y0 + 0.52, z: z0 + 0.075, cast: false }))
  for (let i = 0; i < 4; i++) root.add(box(W * 0.64, 0.03, 0.02, mat('chrome'), { y: y0 + 0.3 + i * 0.15, z: z0 + 0.1, cast: false }))
  root.add(box(W + 0.08, 0.36, 0.32, DARK(), { y: wheelR + 0.12, z: z0 + 0.12 }))
  for (const s of [1, -1]) {
    headlamp(root, s * (W / 2 - 0.32), wheelR + 0.14, z0 + 0.3, 0.34, 0.15)
    if (beamMat) beam(root, beamMat, s * (W / 2 - 0.32), wheelR + 0.14, z0 + 0.34)
    // mirrors on arms
    root.add(box(0.04, 0.04, 0.42, mat('steel.dark'), { x: s * (W / 2 + 0.12), y: y0 + 1.75, z: z0 - 0.3, ry: s * 0.6, cast: false }))
    root.add(box(0.07, 0.42, 0.2, DARK(), { x: s * (W / 2 + 0.28), y: y0 + 1.55, z: z0 - 0.12 }))
    // steps + grab handle under the door
    for (const y of [wheelR - 0.02, wheelR + 0.3]) root.add(box(0.32, 0.05, 0.5, mat('steel'), { x: s * (W / 2 - 0.12), y, z: z0 - cabL * 0.55 }))
    root.add(cyl(0.02, 0.02, 0.8, mat('chrome'), { x: s * (W / 2 + 0.06), y: y0 + 1.0, z: zb + 0.18, seg: 6, cast: false }))
    if (logo) root.add(decal('logo', 1.3, 0.3, { x: s * (W / 2 + 0.006), y: y0 + 0.72, z: z0 - cabL * 0.55, ry: s * Math.PI / 2 }))
    root.add(box(0.06, 0.04, 0.12, lightMat('#ffb23a', 1.5, 'vehicle'), { x: s * (W / 2 - 0.1), y: y0 + H + 0.02, z: z0 - 0.3, cast: false }))
  }
  // fuel tank + battery box between the front axle and the rear tandem
  const rearMax = Math.max(...axles.filter((z) => z < 0))
  const frontMin = Math.min(...axles.filter((z) => z > 0))
  const gap = frontMin - rearMax - wheelR * 2 - 0.4
  if (gap > 0.5) {
    const tz = (frontMin + rearMax) / 2
    root.add(cyl(0.3, 0.3, Math.min(1.4, gap), mat('steel'), { axis: 'z', x: W / 2 - 0.42, y: wheelR + 0.1, z: tz, seg: 14 }))
    root.add(box(0.5, 0.45, Math.min(0.8, gap), DARK(), { x: -(W / 2 - 0.45), y: wheelR + 0.1, z: tz }))
  }
  // tail: lamps, underride bar with hazard stripes, mud flaps
  rig.tail = own(lightMat('#ff2a1a', 1.2, 'vehicle'))
  const zr = -L / 2 + 0.15
  root.add(box(W - 0.1, 0.16, 0.12, mat('steel.dark'), { y: wheelR - 0.1, z: zr }))
  root.add(decal('hazard', W - 0.12, 0.14, { y: wheelR - 0.1, z: zr + 0.062, ry: Math.PI }))
  for (const s of [1, -1]) {
    root.add(box(0.3, 0.16, 0.06, rig.tail, { x: s * (W / 2 - 0.3), y: wheelR + 0.16, z: zr - 0.02, cast: false }))
    root.add(box(0.12, 0.16, 0.06, lightMat('#ffb23a', 1.2, 'vehicle'), { x: s * (W / 2 - 0.08), y: wheelR + 0.16, z: zr - 0.02, cast: false }))
  }
  // exhaust stack behind the cab
  root.add(cyl(0.08, 0.08, cabH + 0.4, mat('chrome'), { base: true, x: W / 2 - 0.2, y: deckY, z: zb - 0.16, seg: 10 }))
  root.add(cyl(0.12, 0.12, 0.8, mat('steel.dark'), { base: true, x: W / 2 - 0.2, y: deckY + 0.4, z: zb - 0.16, seg: 10 }))
  rig.exhaust = pivot('exhaust', W / 2 - 0.2, deckY + cabH + 0.45, zb - 0.16)
  root.add(rig.exhaust)
  if (beacon) {
    const bm = own(new THREE.MeshStandardMaterial({ color: '#7a4a00', emissive: '#ffa21a', emissiveIntensity: 0.2, roughness: 0.3 }))
    root.add(cyl(0.11, 0.13, 0.2, bm, { base: true, y: y0 + H + 0.02, z: z0 - cabL * 0.5, cast: false }))
    rig.beacons.push(bm)
  }
  // axles: front steer singles, rear duals; arches over each
  for (const z of axles) {
    const front = z > 0
    axle(root, rig, { z, track: W - 0.5, r: wheelR, w: 0.3, dual: !front, steer: front })
    for (const s of [1, -1]) {
      if (front) fender(root, s * (W / 2 - 0.22), wheelR, z, wheelR, 0.5, paint)
      else root.add(box(0.03, 0.55, 0.5, RUBBER(), { x: s * (W / 2 - 0.22), y: wheelR * 0.65, z: z - wheelR - 0.12, cast: false }))
    }
  }
  const rz = axles.filter((z) => z < 0)
  if (rz.length) {
    const mid = (Math.min(...rz) + Math.max(...rz)) / 2
    const span = Math.max(...rz) - Math.min(...rz) + wheelR * 2 + 0.3
    for (const s of [1, -1]) root.add(box(0.62, 0.05, span, mat('steel.dark'), { x: s * (W / 2 - 0.22), y: wheelR * 2 + 0.1, z: mid, cast: false }))
  }
  return { root, rig, deckY, L, W, cz, cabL }
}

// ---------------------------------------------------------------- mixer
let drumM
function drumMat() {
  if (drumM) return drumM
  const c = makeCanvas(512, 256)
  const x = c.getContext('2d')
  x.fillStyle = '#d9dad5'; x.fillRect(0, 0, 512, 256)
  // two-start spiral band (u = around, v = along the drum) + grime toward the opening
  for (const [col, off] of [['#c8642a', 0], ['#2f4f78', 256]]) {
    x.fillStyle = col
    for (let k = -1; k <= 1; k++) { const o = off + k * 512; x.beginPath(); x.moveTo(o, 256); x.lineTo(o + 70, 256); x.lineTo(o + 330, 0); x.lineTo(o + 260, 0); x.fill() }
  }
  const g = x.createLinearGradient(0, 0, 0, 256)
  g.addColorStop(0, 'rgba(90,86,78,0)'); g.addColorStop(0.75, 'rgba(90,86,78,0.15)'); g.addColorStop(1, 'rgba(110,104,96,0.65)')
  x.fillStyle = g; x.fillRect(0, 0, 512, 256)
  for (let i = 0; i < 260; i++) { x.fillStyle = `rgba(120,116,108,${0.1 + Math.random() * 0.25})`; x.fillRect(Math.random() * 512, 160 + Math.random() * 96, 2 + Math.random() * 6, 2 + Math.random() * 10) }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.wrapS = THREE.RepeatWrapping
  drumM = new THREE.MeshStandardMaterial({ map: t, roughness: 0.42, metalness: 0.35, name: 'drum.real' })
  return drumM
}

/** drum (rotating, with spiral band + riding ring), pedestals, rollers, hopper, chute, water tank, ladder */
export function mixerBody(t) {
  const { root, deckY } = t
  const s = detail() === 'low' ? 16 : 28
  const prof = [[0.05, -2.45], [0.85, -2.4], [1.22, -1.9], [1.36, -1.0], [1.36, 0.1], [1.18, 1.25], [0.82, 2.2], [0.5, 2.62], [0.46, 2.7]]
  const drumMesh = lathe(prof, drumMat(), { seg: s, rx: Math.PI / 2 })
  const drum = dynamic(pivot('drum', 0, 0, 0, drumMesh))
  drum.add(lathe([[1.37, -0.3], [1.42, -0.25], [1.42, 0.05], [1.37, 0.1]], mat('steel.dark'), { seg: s, rx: Math.PI / 2, z: -1.2 }))
  const tilt = pivot('drumTilt', 0, deckY + 1.45, -0.9, drum)
  tilt.rotation.x = 0.2
  root.add(tilt)
  // front pedestal (gearbox) and rear A-frame with rollers
  root.add(box(0.9, 1.0, 0.5, mat('steel.dark'), { base: true, y: deckY, z: 1.55 }))
  root.add(cyl(0.42, 0.42, 0.5, DARK(), { axis: 'z', y: deckY + 1.15, z: 1.62 }))
  for (const sx of [1, -1]) {
    root.add(rod(new THREE.Vector3(sx * 0.5, deckY, -3.0), new THREE.Vector3(sx * 0.35, deckY + 1.95, -3.25), 0.07, mat('paint.dark')))
    root.add(cyl(0.16, 0.16, 0.22, mat('steel'), { axis: 'x', x: sx * 0.7, y: deckY + 1.72, z: -2.9 }))
  }
  root.add(box(1.2, 0.12, 0.2, mat('paint.dark'), { y: deckY + 1.95, z: -3.25 }))
  // hopper + collector + chute
  root.add(lathe([[0.18, 0], [0.32, 0.25], [0.75, 0.75], [0.78, 0.8]], mat('steel'), { seg: 14, y: deckY + 2.05, z: -3.85, rx: -0.25 }))
  root.add(cyl(0.25, 0.2, 0.5, mat('steel.dark'), { y: deckY + 1.6, z: -3.95 }))
  const chute = dynamic(pivot('chute', 0, deckY + 1.1, -4.2))
  chute.add(box(0.5, 0.05, 1.8, mat('steel'), { z: -0.9 }))
  for (const sx of [1, -1]) chute.add(box(0.04, 0.18, 1.8, mat('steel'), { x: sx * 0.25, y: 0.08, z: -0.9 }))
  chute.rotation.x = -0.5
  root.add(chute)
  // water tank behind the cab + rear ladder
  root.add(cyl(0.36, 0.36, 1.0, mat('paint.blue'), { axis: 'x', y: deckY + 0.45, z: 1.15 }))
  for (const sx of [0.3, -0.3]) root.add(box(0.05, 2.0, 0.05, mat('steel'), { base: true, x: sx, y: deckY - 0.2, z: -4.05 }))
  for (let i = 0; i < 6; i++) root.add(box(0.6, 0.035, 0.035, mat('steel'), { x: 0, y: deckY + 0.1 + i * 0.32, z: -4.05, cast: false }))
  Object.assign(t.rig, { drum, chute })
}

// ---------------------------------------------------------------- dump body
/** ribbed tipper bed hinged at the rear (rig.bed), sand load (rig.load), canopy over the cab */
export function dumpBody(t, paintRole = 'paint.grey') {
  const bedL = 5
  const W = t.W
  const pm = mat(paintRole)
  const bed = dynamic(pivot('bed', 0, t.deckY + 0.1, -t.L / 2 + 0.3))
  bed.add(box(W, 0.14, bedL, mat('steel.dark'), { base: true, z: bedL / 2 }))
  for (const s of [1, -1]) {
    // tapered side wall + vertical ribs + top rail
    bed.add(box(0.06, 1.25, bedL, pm, { base: true, x: s * (W / 2 - 0.03), y: 0.1, z: bedL / 2 }))
    for (let i = 0; i < 5; i++) bed.add(box(0.08, 1.2, 0.1, pm, { base: true, x: s * (W / 2 + 0.02), y: 0.12, z: 0.4 + i * 1.05, cast: false }))
    bed.add(box(0.12, 0.1, bedL, pm, { x: s * (W / 2), y: 1.38, z: bedL / 2 }))
    bed.add(box(0.1, 0.2, 4.6, mat('steel.dark'), { x: s * 0.45, y: -0.08, z: bedL / 2 }))
  }
  bed.add(box(W, 1.35, 0.1, pm, { base: true, y: 0.1, z: bedL - 0.05 }))
  bed.add(box(W + 0.1, 0.1, 0.9, pm, { y: 1.45, z: bedL + 0.35, rx: -0.12 }))
  // tailgate with hazard band
  bed.add(box(W, 1.2, 0.1, pm, { base: true, y: 0.15, z: 0.05 }))
  bed.add(decal('hazard', W - 0.1, 0.18, { y: 0.4, z: -0.01, ry: Math.PI }))
  bed.add(box(W + 0.12, 0.08, 0.08, mat('steel.dark'), { y: 1.36, z: 0.0 }))
  const load = dynamic(new THREE.Mesh(new THREE.SphereGeometry(1, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat('sand')))
  load.scale.set(W * 0.47, 0.001, bedL * 0.46)
  load.position.set(0, 1.2, bedL / 2)
  load.castShadow = true
  bed.add(load)
  t.root.add(bed)
  // tipping ram housing under the bed front (static)
  t.root.add(cyl(0.16, 0.16, 0.9, mat('steel.dark'), { base: true, y: t.deckY - 0.5, z: -t.L / 2 + 0.3 + bedL - 0.6 }))
  Object.assign(t.rig, { bed, load })
}

// ---------------------------------------------------------------- flatbed
export function flatbedBody(t, pallet) {
  const W = t.W
  t.root.add(box(W, 0.14, 6.4, mat('timber'), { base: true, y: t.deckY, z: -1.15 }))
  for (const s of [1, -1]) {
    t.root.add(box(0.08, 0.22, 6.4, mat('steel.dark'), { base: true, x: s * (W / 2), y: t.deckY - 0.08, z: -1.15 }))
    for (let i = 0; i < 6; i++) t.root.add(box(0.1, 0.12, 0.1, mat('steel.dark'), { x: s * (W / 2 + 0.03), y: t.deckY + 0.02, z: -4 + i * 1.15, cast: false }))
    t.root.add(box(0.45, 0.5, 1.0, mat('paint.dark'), { x: s * (W / 2 - 0.3), y: t.deckY - 0.45, z: -1.5 }))
  }
  // ladder-rack headboard
  t.root.add(box(W, 0.1, 0.1, mat('steel.dark'), { y: t.deckY + 1.15, z: 2.0 }))
  for (let i = 0; i < 5; i++) t.root.add(box(0.07, 1.1, 0.07, mat('steel.dark'), { base: true, x: -W / 2 + 0.05 + i * ((W - 0.1) / 4), y: t.deckY + 0.1, z: 2.0 }))
  for (const y of [0.45, 0.8]) t.root.add(box(W, 0.05, 0.05, mat('steel.dark'), { y: t.deckY + y, z: 2.0, cast: false }))
  const cargo = dynamic(pivot('cargo', 0, t.deckY + 0.14, -1.2))
  t.root.add(cargo)
  const slots = []
  for (let i = 0; i < 4; i++) {
    const s = pallet(i % 2 ? 'bricks' : 'bags')
    s.position.set(-0.55, 0, -2.3 + i * 1.55)
    s.userData.dynamic = true
    cargo.add(s)
    slots.push(s)
  }
  Object.assign(t.rig, { cargo, slots })
}
// ---------------------------------------------------------------- cars
// side profiles [z, y] (front = +z), wheel arches cut around the axles
function arch(z, r, y0, n = 6) {
  const out = []
  const R = r + 0.06
  for (let i = 0; i <= n; i++) { const a = Math.PI - (i / n) * Math.PI; out.push([z + Math.cos(a) * R, y0 + Math.sin(a) * R * 0.95]) }
  return out
}
const CAR = {
  sedan: { L: 4.6, W: 1.82, r: 0.33, ax: 1.38, body: (L, r, ax) => [[-L / 2, 0.32], ...arch(-ax, r, 0.32), ...arch(ax, r, 0.32), [L / 2, 0.32], [L / 2, 0.62], [L / 2 - 0.12, 0.8], [1.25, 0.94], [0.45, 1.42], [-0.75, 1.44], [-1.6, 0.98], [-L / 2 + 0.06, 0.92], [-L / 2, 0.7]] },
  van: { L: 5.2, W: 1.95, r: 0.36, ax: 1.62, body: (L, r, ax) => [[-L / 2, 0.36], ...arch(-ax, r, 0.36), ...arch(ax, r, 0.36), [L / 2, 0.36], [L / 2, 0.75], [L / 2 - 0.15, 0.95], [1.75, 1.1], [1.15, 1.95], [-L / 2 + 0.05, 1.97], [-L / 2, 1.85]] },
  bus: { L: 10.5, W: 2.5, r: 0.5, ax: 3.3, body: (L, r, ax) => [[-L / 2, 0.38], ...arch(-ax, r, 0.38), ...arch(ax + 0.6, r, 0.38), [L / 2, 0.38], [L / 2, 2.6], [L / 2 - 0.15, 3.0], [-L / 2 + 0.1, 3.0], [-L / 2, 2.85]] }
}
CAR.taxi = CAR.sedan
// glass band: windscreen / rear-glass edges of the body offset outward past the bevel, so the
// glass reads on the slopes and (being a little wider than the body) on the sides
CAR.sedan.win = { f: [[1.25, 0.94], [0.45, 1.42]], r: [[-1.6, 0.98], [-0.75, 1.44]], y0: 0.97, y1: 1.37 }
CAR.van.win = { f: [[1.75, 1.1], [1.15, 1.95]], rz: -2.66, y0: 1.13, y1: 1.86 }
CAR.bus.win = { f: [[5.25, 1.0], [5.25, 2.6]], rz: -5.36, y0: 1.3, y1: 2.72 }
function edgeAt(a, b, o, y, sign) {
  const l = Math.hypot(b[0] - a[0], b[1] - a[1])
  const ux = (b[0] - a[0]) / l
  const uy = (b[1] - a[1]) / l
  const px = a[0] + sign * uy * o
  const py = a[1] - sign * ux * o
  return [+(px + (ux * (y - py)) / uy).toFixed(3), y]
}
function glassPts(w, o) {
  const f0 = edgeAt(w.f[0], w.f[1], o, w.y0, 1)
  const f1 = edgeAt(w.f[0], w.f[1], o, w.y1, 1)
  const r0 = w.r ? edgeAt(w.r[0], w.r[1], o, w.y0, -1) : [w.rz, w.y0]
  const r1 = w.r ? edgeAt(w.r[0], w.r[1], o, w.y1, -1) : [w.rz, w.y1]
  return [r0, f0, f1, r1]
}

/** realistic car / taxi / van / bus. Same rig as vehicles.js car(). */
export function realCar({ type = 'sedan', body, beamMat }) {
  const d = CAR[type] || CAR.sedan
  const { L, W, r } = d
  const ax = d.ax
  const root = new THREE.Group()
  const rig = { wheels: [], steer: [], beacons: [], wheelR: r }
  const bev = type === 'bus' ? 0.08 : 0.12
  root.add(extrude(`car:${type}`, d.body(L, r, ax), W, body, { bevel: bev, bevelSeg: detail() === 'low' ? 1 : 3 }))
  root.add(extrude(`carglass:${type}`, glassPts(d.win, bev + 0.015), W + 0.02, GLASS(), { bevel: 0, cast: false }))
  const front = L / 2 + bev
  const back = -L / 2 - bev
  // pillars break the side glass
  const pillars = type === 'bus' ? [-3, -1, 1, 3] : type === 'van' ? [0.3] : [-0.12]
  for (const z of pillars) root.add(box(W + 0.04, type === 'bus' ? 1.4 : 0.5, 0.1, body, { y: type === 'bus' ? 2.05 : type === 'van' ? 1.55 : 1.18, z, cast: false }))
  // bumpers, grille, plates, lamps, mirrors, sills
  const by = r + 0.05
  root.add(box(W + 0.04, 0.2, 0.14, DARK(), { y: by, z: front - 0.02 }))
  root.add(box(W + 0.04, 0.2, 0.14, DARK(), { y: by, z: back + 0.02 }))
  root.add(box(W * 0.42, 0.14, 0.03, DARK(), { y: by + 0.24, z: front + 0.005, cast: false }))
  root.add(decal('plate', 0.44, 0.12, { y: by, z: front + 0.075 }))
  root.add(decal('plate', 0.44, 0.12, { y: by + 0.2, z: back - 0.012, ry: Math.PI }))
  rig.tail = own(lightMat('#ff2a1a', 1.2, 'vehicle'))
  const ly = type === 'bus' ? 0.9 : by + 0.3
  for (const s of [1, -1]) {
    headlamp(root, s * (W / 2 - 0.3), ly, front - 0.02, 0.36, 0.12)
    if (beamMat) beam(root, beamMat, s * (W / 2 - 0.3), ly, front + 0.05, 0.7)
    root.add(box(0.3, 0.14, 0.05, rig.tail, { x: s * (W / 2 - 0.25), y: ly + 0.05, z: back + 0.005, cast: false }))
    const my = type === 'bus' ? 2.4 : type === 'van' ? 1.25 : 1.0
    root.add(box(0.2, 0.12, 0.08, body, { x: s * (W / 2 + 0.12), y: my, z: type === 'bus' ? front + 0.2 : 0.95, cast: false }))
    const zf = type === 'bus' ? ax + 0.6 : ax
    root.add(box(0.04, 0.08, zf + ax - r * 2 - 0.3, DARK(), { x: s * (W / 2 + bev - 0.01), y: r + 0.04, z: (zf - ax) / 2, cast: false }))
  }
  if (type === 'taxi') root.add(box(0.6, 0.16, 0.24, lightMat('#ffe9a0', 2, 'vehicle'), { base: true, y: 1.44 + bev, z: -0.15 }))
  if (type === 'bus') {
    root.add(box(1.6, 0.26, 0.04, lightMat('#ffb23a', 2, 'vehicle'), { y: 2.85, z: front + 0.01, cast: false }))
    root.add(box(0.06, 2.1, 1.1, GLASS(), { x: W / 2 + bev, y: 1.45, z: ax + 2.2, cast: false }))
  }
  const zf = type === 'bus' ? ax + 0.6 : ax
  for (const [z, steer] of [[zf, true], [-ax, false]]) axle(root, rig, { z, track: W - 0.2, r, w: type === 'bus' ? 0.3 : 0.22, dual: type === 'bus' && !steer, steer })
  rig.exhaust = pivot('exhaust', W / 2 - 0.4, r * 0.7, back)
  root.add(rig.exhaust)
  return { root, rig }
}
