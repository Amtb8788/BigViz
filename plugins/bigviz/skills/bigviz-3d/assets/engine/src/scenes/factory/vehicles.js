// Factory pack - vehicles: latent (jacking) AGV with tote cart, electric counterbalance
// forklift, reach truck, coil truck (3 coils on cradles), box truck for finished goods.

import * as THREE from 'three'
import { mat, colorMat, glowMat, own } from '../../render/materials.js'
import { box, cyl, pivot, group, dynamic, bakeTree } from '../../prefabs/kit.js'
import { truck } from '../../prefabs/vehicles.js'
import { human } from '../../prefabs/people.js'
import { decal } from '../../prefabs/parts-real.js'
import { animateVehicle } from '../../systems/animate-machines.js'
import { createRng } from '../../core/rng.js'
import { coil, load, partRack } from './storage.js'

function wheel(r, w, color = '#1d1e20') {
  const g = new THREE.Group()
  g.add(cyl(r, r, w, colorMat(color, 0.85), { axis: 'x', seg: 16, cast: false }))
  g.add(cyl(r * 0.5, r * 0.5, w + 0.02, colorMat('#c9ccc8', 0.45, 0.6), { axis: 'x', seg: 10, cast: false }))
  return dynamic(g)
}

/** latent AGV (1.6 x 1.0 m) + tote cart on the lift plate. rig: lift, cart, led, lidar */
export function agv({ seed = 1 } = {}) {
  const rng = createRng(seed)
  const root = group()
  const rig = { wheels: [], steer: [], beacons: [], wheelR: 0.11 }
  const body = colorMat('#d9dcdd', 0.4, 0.2)
  root.add(box(1.0, 0.26, 1.6, body, { base: true, y: 0.04, round: 0.06 }))
  root.add(box(1.02, 0.08, 1.62, colorMat('#2b2e33', 0.6), { base: true, y: 0.04 }))
  for (const sz of [0.81, -0.81]) root.add(box(0.9, 0.12, 0.05, colorMat('#e3c32a', 0.5), { y: 0.18, z: sz }))
  root.add(decal('hazard', 0.88, 0.1, { y: 0.18, z: 0.837 }))
  const led = own(glowMat('#3bff7a', 1.6))
  led.userData.live = true
  for (const sx of [0.505, -0.505]) root.add(box(0.01, 0.03, 1.3, led, { x: sx, y: 0.24, cast: false }))
  for (const sz of [0.805, -0.805]) root.add(box(0.7, 0.03, 0.01, led, { y: 0.27, z: sz, cast: false }))
  const lidar = dynamic(pivot('lidar', 0, 0.3, 0.68))
  lidar.add(cyl(0.06, 0.06, 0.06, colorMat('#15181b', 0.3)))
  lidar.add(box(0.02, 0.03, 0.04, glowMat('#ff3030', 1.2), { x: 0.06, cast: false }))
  root.add(lidar)
  for (const [x, z] of [[0.42, 0], [-0.42, 0]]) { const w = wheel(0.11, 0.08); w.position.set(x, 0.11, z); root.add(w); rig.wheels.push(w) }
  const lift = dynamic(pivot('lift', 0, 0.3, 0))
  lift.add(cyl(0.36, 0.36, 0.04, colorMat('#4a5056', 0.5, 0.5), { base: true, seg: 20 }))
  const cart = dynamic(pivot('cart', 0, 0.04, 0))
  const f = colorMat('#2f5d8c', 0.5, 0.4)
  for (const sx of [0.5, -0.5]) for (const sz of [0.7, -0.7]) cart.add(box(0.04, 1.35, 0.04, f, { base: true, x: sx, z: sz }))
  for (const y of [0.05, 0.6, 1.15]) {
    cart.add(box(1.04, 0.04, 1.44, colorMat('#9aa1a6', 0.5, 0.6), { y }))
    for (let i = 0; i < 2; i++) for (let j = 0; j < 3; j++) {
      if (rng.next() < 0.18) continue
      cart.add(box(0.4, 0.26, 0.42, colorMat(rng.next() < 0.15 ? '#c9392b' : '#2f5f9c', 0.6), { base: true, x: -0.22 + i * 0.44, y: y + 0.02, z: -0.46 + j * 0.46 }))
    }
  }
  cart.visible = false
  lift.add(cart)
  root.add(lift)
  bakeTree(root, { colors: true })
  Object.assign(rig, { lift, cart, led, lidar })
  return { object: root, rig }
}

export function animateAgv(e, dt, time) {
  const a = e.agent
  const r = e.rig
  const roll = (a.speed * dt) / 0.11
  for (const w of r.wheels) w.rotation.x += roll
  r.lift.position.y = 0.3 + (a.lift || 0) * 0.06
  r.cart.visible = !!a.loaded
  r.lidar.rotation.y += dt * 12
  const st = a.ledState || (a.speed > 0.05 ? 'run' : 'idle')
  const col = st === 'charge' ? '#ffb21a' : st === 'load' ? '#3aa0ff' : st === 'idle' ? '#9cffc0' : '#3bff7a'
  r.led.emissive.set(col)
  r.led.emissiveIntensity = st === 'charge' ? 0.8 + Math.sin(time * 3) * 0.7 : st === 'load' ? (Math.sin(time * 8) > 0 ? 2 : 0.4) : 1.6
}

/** electric counterbalance forklift (2.5 t) or reach truck. rig follows the forklift contract */
export function eForklift({ reach = false, seed = 1 } = {}) {
  const root = group()
  const rig = { wheels: [], steer: [], beacons: [], wheelR: 0.3 }
  const paint = colorMat(reach ? '#d8a21e' : '#c23b2e', 0.42, 0.25)
  const dark = colorMat('#2b2e33', 0.55, 0.3)
  const L = reach ? 2.4 : 2.3
  // chassis + counterweight / battery box
  root.add(box(1.15, 0.7, L, paint, { base: true, y: 0.18, z: -0.15, round: 0.08 }))
  root.add(box(1.18, 0.75, 0.6, dark, { base: true, y: 0.2, z: -L / 2 + 0.15, round: 0.1 }))
  root.add(box(1.0, 0.12, 0.9, dark, { y: 0.92, z: -0.25 }))
  // seat, steering column, overhead guard
  root.add(box(0.5, 0.12, 0.45, colorMat('#1f2124', 0.8), { y: 1.05, z: -0.45 }))
  root.add(box(0.5, 0.55, 0.1, colorMat('#1f2124', 0.8), { base: true, y: 1.08, z: -0.7 }))
  root.add(cyl(0.025, 0.025, 0.6, dark, { y: 1.2, z: 0.2, rx: -0.5 }))
  root.add(cyl(0.16, 0.16, 0.03, dark, { y: 1.45, z: 0.06, rx: -0.5, seg: 14 }))
  for (const [x, z] of [[0.52, 0.42], [-0.52, 0.42], [0.52, -0.8], [-0.52, -0.8]]) root.add(box(0.06, 1.25, 0.06, dark, { base: true, x, y: 0.9, z }))
  root.add(box(1.1, 0.05, 1.3, dark, { y: 2.17, z: -0.19 }))
  for (let i = 0; i < 5; i++) root.add(box(0.04, 0.05, 1.3, dark, { x: -0.44 + i * 0.22, y: 2.2, z: -0.19, cast: false }))
  const beacon = own(new THREE.MeshStandardMaterial({ color: '#7a4a00', emissive: '#ffa21a', emissiveIntensity: 0.2 }))
  root.add(cyl(0.07, 0.07, 0.12, beacon, { base: true, y: 2.22, z: -0.75, cast: false }))
  rig.beacons.push(beacon)
  root.add(decal('hazard', 0.9, 0.12, { y: 0.55, z: -L / 2 - 0.152, ry: Math.PI }))
  // driver
  const d = human({ role: 'worker', seed: seed + 40, shirt: '#2d3b52' })
  d.object.position.set(0, 0.62, -0.42)
  d.rig.legL.rotation.x = d.rig.legR.rotation.x = -1.45
  if (d.rig.kneeL) d.rig.kneeL.rotation.x = d.rig.kneeR.rotation.x = 1.45
  d.rig.armL.rotation.x = d.rig.armR.rotation.x = -0.9
  root.add(d.object)
  // mast: outer channels (static), inner stage + carriage (move)
  const H0 = reach ? 3.6 : 2.4
  const mast = dynamic(pivot('mast', 0, 0.15, L / 2 - 0.1))
  for (const sx of [0.38, -0.38]) mast.add(box(0.1, H0, 0.14, dark, { base: true, x: sx }))
  mast.add(box(0.86, 0.1, 0.12, dark, { y: H0 }))
  const inner = dynamic(pivot('inner', 0, 0, 0.1))
  for (const sx of [0.3, -0.3]) inner.add(box(0.08, H0, 0.1, colorMat('#3a3d42', 0.5, 0.4), { base: true, x: sx }))
  inner.add(box(0.7, 0.08, 0.1, colorMat('#3a3d42', 0.5, 0.4), { y: H0 }))
  mast.add(inner)
  const forks = dynamic(pivot('forks', 0, 0.06, 0.2))
  forks.add(box(0.9, 0.45, 0.06, dark, { base: true }))
  for (let i = 0; i < 5; i++) forks.add(box(0.04, 0.6, 0.04, dark, { base: true, x: -0.36 + i * 0.18, y: 0.45, cast: false }))
  for (const sx of [0.28, -0.28]) forks.add(box(0.11, 0.05, 1.1, mat('steel'), { x: sx, y: 0.025, z: 0.58 }))
  const lp = dynamic(pivot('load', 0, 0.05, 0.62))
  forks.add(lp)
  mast.add(forks)
  root.add(mast)
  // wheels: front drive (big), rear steer
  for (const sx of [0.5, -0.5]) { const w = wheel(0.3, 0.24); w.position.set(sx, 0.3, L / 2 - 0.55); root.add(w); rig.wheels.push(w) }
  for (const sx of [0.42, -0.42]) {
    const s = dynamic(pivot('steer', sx, 0.22, -L / 2 + 0.45))
    const w = wheel(0.22, 0.18)
    s.add(w)
    root.add(s)
    rig.wheels.push(w)
    rig.steer.push(s)
  }
  // blue safety spot projected on the floor ahead
  const spot = new THREE.Mesh(new THREE.CircleGeometry(0.35, 16).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#3a7bff', transparent: true, opacity: 0.55, depthWrite: false }))
  spot.position.set(0, 0.08, L / 2 + 3)
  spot.userData.keep = true
  root.add(spot)
  bakeTree(root, { colors: true })
  Object.assign(rig, { mast, inner, forks, load: lp, spot, H0, maxLift: reach ? 8.2 : 3.2, driver: d.rig })
  return { object: root, rig }
}

let _lr = createRng(77)
export function animateForklift(e, dt, time, env, fx) {
  const a = e.agent
  const r = e.rig
  const roll = ((a.reversing ? -1 : 1) * a.speed * dt) / 0.3
  for (const w of r.wheels) w.rotation.x += roll
  for (const s of r.steer) s.rotation.y = -(a.steer || 0) * 1.4
  const on = a.speed > 0.05 || a.reversing
  for (const b of r.beacons) b.emissiveIntensity = on ? (Math.sin(time * 9) > 0 ? 4 : 0.3) : 0.15
  const h = (a.lift || 0) * r.maxLift
  r.forks.position.y = 0.06 + h
  // inner stage follows once the free lift (1/2 of H0) is used
  r.inner.position.y = Math.max(0, h - r.H0 * 0.5) * (r.maxLift > 4 ? 0.55 : 1)
  if (r.maxLift > 4) r.inner.position.y = Math.min(r.inner.position.y, r.H0 * 0.95)
  r.mast.rotation.x = -(a.tilt ?? 0.04)
  const want = a.loaded ? (a.loaded === true ? 'pallet' : a.loaded) : null
  if ((r.load.userData.kind || null) !== want) {
    r.load.clear()
    if (want === 'rack') { const p = partRack({ n: 10 }).object; p.rotation.y = Math.PI / 2; p.scale.setScalar(0.9); r.load.add(p) }
    else if (want) { const p = load(_lr); p.rotation.y = Math.PI / 2; p.position.z = 0.1; r.load.add(p) }
    r.load.userData.kind = want
  }
  r.spot.visible = on && !a.reversing
}

/** coil truck: 4-axle flatbed with 3 coils on cradles (slots follow agent.cargo) */
export function coilTruck() {
  const t = truck({ L: 11, axles: [-4.0, -2.7, 2.2, 3.5], cab: 'paint.blue', cabL: 2.3, cabH: 2.3 })
  const W = t.W
  t.root.add(box(W, 0.18, 8.0, mat('steel.dark'), { base: true, y: t.deckY, z: -1.4 }))
  for (const s of [1, -1]) t.root.add(box(0.1, 0.25, 8.0, mat('paint.blue'), { base: true, x: s * W / 2, y: t.deckY - 0.08, z: -1.4 }))
  const cargo = dynamic(pivot('cargo', 0, t.deckY + 0.18, 0))
  const slots = []
  for (const z of [-4.3, -1.9, 0.5]) {
    cargo.add(box(2.0, 0.3, 1.3, colorMat('#3d4449', 0.6, 0.5), { base: true, z }))
    const c = coil({ r: 0.85, w: 1.25, seed: Math.round(z * 3 + 9) }).object
    c.rotation.y = Math.PI / 2
    c.position.set(0, 0.18, z)
    c.userData.dynamic = true
    cargo.add(c)
    slots.push(c)
  }
  t.root.add(cargo)
  bakeTree(t.root, { colors: true })
  t.rig.slots = slots
  return { object: t.root, rig: t.rig }
}

/** box truck (finished goods). rig: truck contract + door (rear roller) */
export function boxTruck({ color = '#eef0ee', band = '#2f5d8c' } = {}) {
  const t = truck({ L: 9.6, axles: [-3.2, -1.9, 2.4], cab: 'paint.white', cabL: 2.2, cabH: 2.2 })
  const W = t.W
  const bl = 6.8
  const bz = -t.L / 2 + bl / 2 + 0.1
  t.root.add(box(W + 0.05, 2.6, bl, colorMat(color, 0.4, 0.2), { base: true, y: t.deckY + 0.05, z: bz, round: 0.04 }))
  for (const s of [1, -1]) t.root.add(box(0.02, 0.5, bl - 0.2, colorMat(band, 0.45, 0.2), { x: s * (W / 2 + 0.035), y: t.deckY + 1.0, z: bz }))
  t.root.add(box(W * 0.9, 2.3, 0.03, colorMat('#b9c0c5', 0.45, 0.6), { y: t.deckY + 1.35, z: bz - bl / 2 - 0.01, cast: false }))
  for (let i = 0; i < 6; i++) t.root.add(box(W * 0.9, 0.02, 0.04, colorMat('#8d9499', 0.5, 0.6), { y: t.deckY + 0.4 + i * 0.38, z: bz - bl / 2 - 0.03, cast: false }))
  bakeTree(t.root, { colors: true })
  return { object: t.root, rig: t.rig }
}
