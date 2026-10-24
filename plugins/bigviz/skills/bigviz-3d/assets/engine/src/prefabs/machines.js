// Construction machines with articulated rigs: forklift, excavator, mobile crane, pump truck.
// Pivot convention: a part extending along +z rotates UP with negative rotation.x.

import * as THREE from 'three'
import { mat, colorMat } from '../render/materials.js'
import { box, cyl, sphere, pivot, dynamic, bakeTree, isReal } from './kit.js'
import { realExcavator, mobileCraneExtras, pumpExtras } from './machines-real.js'
import { truck, wheel } from './vehicles.js'
import { human } from './people.js'

export function forklift() {
  const root = new THREE.Group()
  const rig = { wheels: [], steer: [], beacons: [], wheelR: 0.42 }
  root.add(box(1.5, 0.9, 2.6, mat('paint.yellow'), { base: true, y: 0.3, z: -0.2, round: 0.12 }))
  root.add(box(1.4, 0.8, 0.7, mat('paint.dark'), { base: true, y: 0.6, z: -1.3, round: 0.1 }))
  for (const [x, z] of [[0.62, 0.5], [-0.62, 0.5], [0.62, -0.9], [-0.62, -0.9]]) root.add(box(0.08, 1.4, 0.08, mat('paint.dark'), { base: true, x, y: 1.2, z }))
  root.add(box(1.4, 0.06, 1.5, mat('paint.dark'), { y: 2.62, z: -0.2 }))
  const driver = human({ role: 'worker' })
  driver.object.position.set(0, 0.62, -0.5)
  driver.rig.legL.rotation.x = driver.rig.legR.rotation.x = -1.4
  if (driver.rig.kneeL) driver.rig.kneeL.rotation.x = driver.rig.kneeR.rotation.x = 1.4
  driver.object.scale.setScalar(0.82)
  root.add(driver.object)
  const mast = pivot('mast', 0, 0.3, 1.25)
  mast.add(box(0.1, 2.8, 0.14, mat('steel.dark'), { base: true, x: 0.45 }), box(0.1, 2.8, 0.14, mat('steel.dark'), { base: true, x: -0.45 }), box(1, 0.1, 0.12, mat('steel.dark'), { y: 2.75 }))
  const forks = dynamic(pivot('forks', 0, 0.12, 0.12))
  forks.add(box(1.0, 0.6, 0.08, mat('steel.dark'), { base: true }))
  for (const x of [0.3, -0.3]) forks.add(box(0.12, 0.06, 1.3, mat('steel'), { x, y: 0.03, z: 0.65 }))
  const load = dynamic(pivot('load', 0, 0.06, 0.7))
  forks.add(load)
  mast.add(forks)
  root.add(dynamic(mast))
  for (const [x, z, r] of [[0.72, 0.65, 0.42], [-0.72, 0.65, 0.42], [0.72, -1.05, 0.34], [-0.72, -1.05, 0.34]]) {
    const w = wheel(r, 0.3)
    w.position.set(x, r, z)
    root.add(w)
    rig.wheels.push(w)
  }
  const bm = new THREE.MeshStandardMaterial({ color: '#7a4a00', emissive: '#ffa21a', emissiveIntensity: 0.2 })
  root.add(cyl(0.1, 0.1, 0.15, bm, { base: true, y: 2.65, z: -0.8, cast: false }))
  rig.beacons.push(bm)
  rig.exhaust = pivot('exhaust', 0.5, 1.4, -1.5)
  root.add(rig.exhaust)
  Object.assign(rig, { mast, forks, load, driver: driver.rig })
  bakeTree(root, { colors: true })
  return { object: root, rig }
}

export function excavator() {
  if (isReal()) {
    const r = realExcavator()
    bakeTree(r.root, { colors: true })
    return { object: r.root, rig: r.rig }
  }
  const root = new THREE.Group()
  const rig = { wheels: [], steer: [], beacons: [], tracks: true }
  for (const s of [1, -1]) {
    root.add(box(0.8, 0.9, 5, mat('rubber'), { base: true, x: s * 1.35, round: 0.35 }))
    root.add(box(0.5, 0.5, 4.2, mat('steel.dark'), { base: true, x: s * 1.35, y: 0.2 }))
  }
  root.add(box(2, 0.5, 2.4, mat('steel.dark'), { base: true, y: 0.6 }))
  const upper = dynamic(pivot('upper', 0, 1.1, 0))
  upper.add(box(2.9, 1.2, 3.6, mat('paint.yellow'), { base: true, z: -0.3, round: 0.18 }))
  upper.add(box(2.9, 0.9, 0.9, mat('paint.dark'), { base: true, z: -2.3, y: 0.1, round: 0.2 }))
  upper.add(box(1.3, 1.5, 1.6, mat('paint.yellow'), { base: true, x: 0.7, y: 1.2, z: 0.6, round: 0.14 }))
  upper.add(box(1.32, 1, 1.4, mat('glass.dark'), { x: 0.7, y: 2.15, z: 0.6 }))
  upper.add(cyl(0.08, 0.08, 1, mat('chrome'), { base: true, x: -1, y: 1.2, z: -1.4 }))
  const bm = new THREE.MeshStandardMaterial({ color: '#7a4a00', emissive: '#ffa21a', emissiveIntensity: 0.2 })
  upper.add(cyl(0.12, 0.12, 0.18, bm, { base: true, x: 0.7, y: 2.7, z: 0.6, cast: false }))
  rig.beacons.push(bm)
  rig.exhaust = pivot('exhaust', -1, 2.3, -1.4)
  upper.add(rig.exhaust)
  // boom (4.6 m) -> arm (3.2 m) -> bucket
  const bucketLoad = dynamic(sphere(0.5, colorMat('#7a5a3c', 0.95), { hemi: true, y: -0.1, z: 0.45 }))
  bucketLoad.scale.set(1, 0.6, 1)
  bucketLoad.visible = false
  const bucket = dynamic(pivot('bucket', 0, 0, 3.2, box(1.1, 0.8, 0.9, mat('steel.dark'), { y: -0.35, z: 0.4 }), bucketLoad))
  const arm = dynamic(pivot('arm', 0, 0, 4.6, box(0.36, 0.4, 3.3, mat('paint.yellow'), { z: 1.6 }), bucket))
  const boom = dynamic(pivot('boom', -0.3, 1.0, 1.4, box(0.5, 0.6, 4.7, mat('paint.yellow'), { z: 2.3 }), arm))
  boom.add(cyl(0.08, 0.08, 2.6, mat('chrome'), { axis: 'z', y: -0.4, z: 1.4 }))
  upper.add(boom)
  root.add(upper)
  Object.assign(rig, { upper, boom, arm, bucket, bucketLoad })
  bakeTree(root, { colors: true })
  return { object: root, rig }
}

export function mobileCrane() {
  const t = truck({ L: 11, W: 2.7, cab: 'paint.red', axles: [-3.8, -2.4, 2.6, 4] })
  const rig = t.rig
  const upper = dynamic(pivot('upper', 0, t.deckY + 0.2, -1.6))
  upper.add(box(2.6, 1.3, 3.4, mat('paint.red'), { base: true, round: 0.15 }))
  upper.add(box(1.0, 1.3, 1.4, mat('paint.red'), { base: true, x: 0.9, y: 1.3, z: 0.8, round: 0.1 }))
  upper.add(box(1.02, 0.7, 1.2, mat('glass.dark'), { x: 0.9, y: 2.15, z: 0.8 }))
  upper.add(box(2.4, 1.1, 0.9, mat('paint.dark'), { base: true, z: -1.9 }))
  const sections = []
  const luff = dynamic(pivot('luff', -0.3, 1.5, -0.8))
  let parent = luff
  for (let i = 0; i < 3; i++) {
    const w = 0.9 - i * 0.18
    const sec = dynamic(pivot(`sec${i}`, 0, 0, i === 0 ? 0 : 0.6))
    sec.add(box(w, w * 0.9, 7, mat(i % 2 ? 'paint.white' : 'paint.yellow'), { z: 3.5 }))
    parent.add(sec)
    sections.push(sec)
    parent = sec
  }
  const tip = pivot('tip', 0, -0.2, 7)
  parent.add(tip)
  upper.add(luff)
  t.root.add(upper)
  const outriggers = []
  for (const [x, z] of [[1, 3.4], [-1, 3.4], [1, -4.2], [-1, -4.2]]) {
    const o = dynamic(pivot('outrigger', x * 1.2, t.deckY - 0.4, z))
    const beam = box(2.2, 0.3, 0.4, mat('paint.dark'), { x: x * 1.1 })
    const leg = dynamic(pivot('leg', x * 2.1, 0, 0, box(0.3, 1.2, 0.3, mat('steel'), { y: -0.6 }), box(0.9, 0.1, 0.9, mat('timber'), { y: -1.2 })))
    o.add(beam, leg)
    o.userData.side = x
    o.userData.leg = leg
    t.root.add(o)
    outriggers.push(o)
  }
  Object.assign(rig, { upper, luff, sections, tip, outriggers })
  if (isReal()) mobileCraneExtras(t, rig)
  bakeTree(t.root, { colors: true })
  return { object: t.root, rig }
}

export function pumpTruck() {
  const t = truck({ L: 10.5, W: 2.6, cab: 'paint.white', axles: [-3.6, -2.2, 3.2] })
  const rig = t.rig
  t.root.add(box(2.4, 0.9, 6.2, mat('paint.grey'), { base: true, y: t.deckY, z: -1.6 }))
  t.root.add(box(1.6, 0.9, 1.1, mat('paint.dark'), { base: true, y: t.deckY - 0.6, z: -5.2 }))
  rig.hopper = pivot('hopper', 0, t.deckY + 0.2, -5.4)
  t.root.add(rig.hopper)
  const turret = dynamic(pivot('turret', 0, t.deckY + 0.9, -3.4, cyl(0.8, 0.9, 0.8, mat('paint.white'), { base: true })))
  const lens = [14, 12, 7]
  const booms = []
  let parent = turret
  for (let i = 0; i < 3; i++) {
    const b = dynamic(pivot(`boom${i}`, 0, i === 0 ? 0.9 : 0, i === 0 ? 0 : lens[i - 1]))
    b.add(box(0.5 - i * 0.08, 0.55 - i * 0.08, lens[i], mat(i === 1 ? 'paint.orange' : 'paint.white'), { z: lens[i] / 2 }))
    b.add(cyl(0.06, 0.06, lens[i] * 0.9, mat('steel.dark'), { axis: 'z', y: 0.35, z: lens[i] / 2 }))
    parent.add(b)
    booms.push(b)
    parent = b
  }
  const hose = dynamic(pivot('hose', 0, 0, lens[2], cyl(0.14, 0.14, 2.6, mat('rubber'), { y: -1.3 })))
  booms[2].add(hose)
  t.root.add(turret)
  const outriggers = []
  for (const [x, z] of [[1, 1.8], [-1, 1.8], [1, -4.6], [-1, -4.6]]) {
    const o = dynamic(pivot('outrigger', x * 1.1, t.deckY - 0.3, z, box(2, 0.28, 0.36, mat('paint.dark'), { x: x * 1 })))
    const leg = dynamic(pivot('leg', x * 1.9, 0, 0, box(0.28, 1.2, 0.28, mat('steel'), { y: -0.6 }), box(0.8, 0.1, 0.8, mat('timber'), { y: -1.2 })))
    o.add(leg)
    o.userData.side = x
    o.userData.leg = leg
    t.root.add(o)
    outriggers.push(o)
  }
  Object.assign(rig, { turret, booms, lens, hose, outriggers })
  if (isReal()) pumpExtras(t, rig)
  bakeTree(t.root, { colors: true })
  return { object: t.root, rig }
}
