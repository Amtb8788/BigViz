// Bridge pack - beam erection kit: double-girder launching machine (双导梁架桥机 JQ180 class),
// tyred girder transporter (运梁车) and precast yard gantry cranes (提梁龙门吊).
// Local frames: launcher origin = mid leg on the deck at the span start, +x = launch direction
// (toward the river), girders at z = +-8; transporter origin = centre, +x = front (cab).

import * as THREE from 'three'
import { mat, lightMat } from '../../render/materials.js'
import { box, cyl, group, bakeTree } from '../../prefabs/kit.js'

export const LAUNCHER = { x0: -36, x1: 40, gz: 8.6, gy: 7.4, gh: 2.6, front: 31.2, mid: -1.2, rear: -31.5 }

/** box-section lattice girder from x0..x1 (bottom y, height h) as merged boxes */
function girder(g, x0, x1, z, y, h, m, d = 1.4) {
  const L = x1 - x0
  for (const dy of [0, h]) for (const dz of [-d / 2, d / 2]) g.add(box(L, 0.3, 0.3, m, { x: (x0 + x1) / 2, y: y + dy, z: z + dz }))
  for (let x = x0; x <= x1 + 1e-3; x += 2) {
    for (const dz of [-d / 2, d / 2]) g.add(box(0.18, h, 0.18, m, { x, y: y + h / 2, z: z + dz }))
    g.add(box(0.14, 0.14, d, m, { x, y: y + h, z }), box(0.14, 0.14, d, m, { x, y, z }))
  }
  for (let x = x0; x < x1 - 1e-3; x += 2) for (const dz of [-d / 2, d / 2]) {
    const b = box(Math.hypot(2, h), 0.14, 0.14, m, { x: x + 1, y: y + h / 2, z: z + dz })
    b.rotation.z = (Math.round((x - x0) / 2) % 2 ? 1 : -1) * Math.atan2(h, 2)
    g.add(b)
  }
  g.add(box(L, 0.04, d + 0.3, mat('steel.dark'), { x: (x0 + x1) / 2, y: y + h + 0.18, z }))
}

/** portal leg at x: two columns down to `drop` below the girders + crossbeam + wheel boxes */
function leg(x, drop, m, sill = true) {
  const g = group()
  const { gz, gy } = LAUNCHER
  for (const z of [-gz, gz]) {
    g.add(box(0.9, drop, 0.9, m, { x, y: gy - drop / 2, z }))
    g.add(box(1.6, 0.7, 1.4, mat('paint.dark'), { x, y: gy - drop + 0.35, z }))
  }
  g.add(box(1.2, 1.1, gz * 2 + 2, m, { x, y: gy - 0.55, z: 0 }))
  // sill beam on the pier cap (not on the deck: the transporter drives through the rear leg)
  if (sill) g.add(box(1.4, 0.5, gz * 2 + 3, mat('steel.dark'), { x, y: gy - drop - 0.25, z: 0 }))
  return g
}

/** overhead lifting trolley: crossbeam on both girders, winch car, rope + hook + spreader */
function trolley(m) {
  const t = group()
  t.userData.dynamic = true
  const { gz, gy, gh } = LAUNCHER
  const top = gy + gh + 0.3
  t.add(box(2.2, 1.0, gz * 2 + 2.2, m, { y: top + 0.5 }))
  for (const z of [-gz, gz]) t.add(box(2.6, 0.8, 1.6, mat('paint.dark'), { y: top + 0.1, z }))
  const car = group(box(2.4, 1.3, 2.4, mat('paint.dark'), { y: top + 1.65 }), cyl(0.5, 0.5, 1.8, mat('steel'), { axis: 'x', y: top + 1.65 }))
  car.userData.dynamic = true
  const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1, 5).translate(0, -0.5, 0), mat('steel.dark'))
  rope.userData.keep = true
  rope.position.y = top
  const hook = group(box(1.2, 0.8, 1.6, mat('paint.yellow'), { y: -0.4 }), box(1.0, 0.35, 3.0, mat('steel.dark'), { y: -1.0 }))
  hook.userData.dynamic = true
  car.add(rope, hook)
  t.add(car)
  return { t, car, rope, hook, top }
}

export function launcher() {
  const root = new THREE.Group()
  root.name = 'launcher'
  const { x0, x1, gz, gy, gh } = LAUNCHER
  const y = mat('paint.yellow')
  const frame = group()
  for (const z of [-gz, gz]) girder(frame, x0, x1, z, gy, gh, y)
  // front nose (tapered) and end cross frames
  for (const z of [-gz, gz]) { const n = box(6, 0.3, 0.3, y, { x: x1 + 2.6, y: gy + gh * 0.35, z }); n.rotation.z = -0.25; frame.add(n) }
  for (const x of [x0, x1]) frame.add(box(0.6, 0.6, gz * 2, y, { x, y: gy + gh, z: 0 }), box(0.6, 0.6, gz * 2, y, { x, y: gy, z: 0 }))
  frame.add(box(3, 2.4, 2.2, mat('paint.white'), { x: x0 + 3, y: gy + gh + 1.6, z: gz + 1.2, round: 0.1 }), box(3.02, 1, 2.22, mat('glass'), { x: x0 + 3, y: gy + gh + 2.0, z: gz + 1.25 }))
  frame.add(box(2.4, 1.6, 2, mat('paint.dark'), { x: x0 + 7, y: gy + gh + 1.1, z: -gz }))
  const lamp = lightMat('#fff1d0', 5, 'site')
  for (const x of [x0 + 2, 0, LAUNCHER.front]) for (const z of [-gz - 0.8, gz + 0.8]) frame.add(box(0.4, 0.3, 0.4, lamp, { x, y: gy - 0.3, z, cast: false }))
  root.add(frame)
  // legs: front on the next pier cap (drop 9.5 to the cap), mid on the cap at the span start,
  // rear on the erected deck (drop 7.4)
  const legs = { front: leg(LAUNCHER.front, gy + 2.1, y), mid: leg(LAUNCHER.mid, gy + 2.1, y), rear: leg(LAUNCHER.rear, gy, y, false) }
  for (const l of Object.values(legs)) root.add(l)
  const T = [trolley(y), trolley(y)]
  for (const t of T) root.add(t.t)
  bakeTree(root)
  const rig = { root, trolleys: T, legs }
  /** trolley i at local x, winch car at z, hook drop (m below the trolley top) */
  rig.setTrolley = (i, x, z, drop) => {
    const t = T[i]
    t.t.position.x = x
    t.car.position.z = z
    t.rope.scale.y = Math.max(0.5, drop)
    t.hook.position.y = t.top - drop
  }
  rig.setTrolley(0, 28, 0, 3); rig.setTrolley(1, -2, 0, 3)
  return { object: root, rig }
}

/** girder transporter: 32 m frame, two 4-axle bogies, cab, saddles at +-14.9 m */
export function transporter() {
  const root = new THREE.Group()
  root.name = 'transporter'
  const y = mat('paint.yellow')
  root.add(box(32, 0.9, 2.8, y, { y: 1.6 }))
  for (const x of [-14.9, 14.9]) root.add(box(1.4, 0.5, 3.2, mat('paint.dark'), { x, y: 2.3 }), box(0.3, 0.6, 3.0, mat('rubber'), { x, y: 2.7 }))
  root.add(box(2.4, 2.4, 3.2, mat('paint.white'), { x: 16.4, y: 2.0, round: 0.12 }), box(0.05, 1.0, 2.8, mat('glass'), { x: 17.62, y: 2.6 }))
  root.add(box(3.5, 1.5, 2.6, mat('paint.dark'), { x: -12, y: 2.8 }))
  const wheels = []
  for (const bx of [-11, 11]) for (let a = 0; a < 4; a++) for (const z of [-1.25, 1.25]) {
    const w = cyl(0.55, 0.55, 0.5, mat('rubber'), { axis: 'z', x: bx - 2.25 + a * 1.5, y: 0.55, z, seg: 14 })
    w.userData.dynamic = true
    wheels.push(w)
    root.add(w)
  }
  const tail = lightMat('#ff3a2a', 3, 'vehicle')
  for (const z of [-1.2, 1.2]) root.add(box(0.1, 0.2, 0.4, tail, { x: -16.05, y: 1.6, z, cast: false }), box(0.1, 0.25, 0.4, lightMat('#fff6e0', 4, 'vehicle'), { x: 17.62, y: 1.4, z, cast: false }))
  bakeTree(root)
  return { object: root, rig: { root, wheels, wheelR: 0.55 } }
}

export const GANTRY = { span: 38, h: 17, z0: -12, z1: 26 }

/** yard gantry crane: legs at z0 / z1, box girder along z, trolley with twin hooks */
export function gantryCrane() {
  const root = new THREE.Group()
  root.name = 'gantryCrane'
  const { h, z0, z1 } = GANTRY
  const m = mat('paint.blue')
  for (const z of [z0, z1]) {
    for (const dx of [-3, 3]) { const c = box(0.9, h, 0.9, m, { x: dx * 0.6, y: h / 2, z }); c.rotation.z = dx * 0.06; root.add(c) }
    root.add(box(7.6, 1.2, 1.4, m, { y: 0.6, z }), box(8, 0.4, 1.0, mat('steel.dark'), { y: 0.2, z }))
  }
  for (const dx of [-1.1, 1.1]) root.add(box(1.2, 2.2, z1 - z0 + 4, m, { x: dx, y: h + 1.1, z: (z0 + z1) / 2 }))
  root.add(box(2.2, 2.4, 2.6, mat('paint.white'), { x: 2.8, y: h - 3, z: z1 - 1.5, round: 0.1 }))
  const tr = group(box(3.6, 1.3, 3.2, mat('paint.dark'), { y: h + 2.9 }))
  tr.userData.dynamic = true
  const ropes = []
  const hook = group(box(1.0, 0.6, 3.2, mat('paint.yellow'), { y: -0.3 }))
  hook.userData.dynamic = true
  for (const dz of [-1.2, 1.2]) {
    const r = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1, 5).translate(0, -0.5, 0), mat('steel.dark'))
    r.position.set(0, h + 2.3, dz)
    r.userData.keep = true
    ropes.push(r)
    tr.add(r)
  }
  tr.add(hook)
  root.add(tr)
  bakeTree(root)
  const rig = { root, trolley: tr, hook, ropes, h }
  rig.set = (z, drop) => {
    tr.position.z = z
    for (const r of ropes) r.scale.y = Math.max(0.5, drop)
    hook.position.y = h + 2.3 - drop
  }
  rig.set(0, 6)
  return { object: root, rig }
}
