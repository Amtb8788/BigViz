// Overhead bridge crane (20 t, double box girder) on the hall's runway beams. The entity sits
// on the runway centre line; rig.bridge travels along x, rig.trolley along z, rig.block
// (hook block) drops along y. payload: null | 'coil' | 'die'. animator 'bridgeCrane'.

import * as THREE from 'three'
import { mat, colorMat, glowMat } from '../../render/materials.js'
import { box, cyl, pivot, group, dynamic, bakeTree } from '../../prefabs/kit.js'
import { decal } from '../../prefabs/parts-real.js'
import { coil } from './storage.js'

/** @param {{ span?: number, railY?: number }} p */
export function bridgeCrane({ span = 22.6, railY = 10.4 } = {}) {
  const g = group()
  const yel = mat('paint.yellow')
  const bridge = dynamic(pivot('bridge', 0, railY, 0))
  // two box girders + end trucks with wheels, walkway + rail on the girders
  for (const sx of [1.05, -1.05]) {
    bridge.add(box(0.5, 1.1, span + 0.6, yel, { base: true, x: sx, y: 0.55 }))
    bridge.add(box(0.06, 0.12, span - 1, mat('steel'), { base: true, x: sx, y: 1.65 }))
  }
  bridge.add(decal('model', 3, 0.5, { x: 1.31, y: 1.1, z: 0, ry: Math.PI / 2 }))
  bridge.add(decal('hazard', 0.6, 1.0, { x: 1.31, y: 1.1, z: span / 2 - 0.2, ry: Math.PI / 2 }))
  for (const sz of [1, -1]) {
    bridge.add(box(3.4, 0.8, 0.9, yel, { base: true, y: 0.15, z: sz * (span / 2 + 0.1) }))
    for (const sx of [1.2, -1.2]) bridge.add(cyl(0.3, 0.3, 0.22, mat('steel.dark'), { axis: 'z', x: sx, y: 0.3, z: sz * (span / 2 + 0.1) }))
    bridge.add(box(0.7, 0.55, 0.5, mat('paint.dark'), { x: 0.9, y: 0.75, z: sz * (span / 2 - 0.6) }))
  }
  bridge.add(box(0.9, 0.06, span - 2, colorMat('#5e6266', 0.7, 0.5), { x: -1.75, y: 1.1 }))
  for (let z = -span / 2 + 1; z < span / 2; z += 2) bridge.add(box(0.05, 1.0, 0.05, yel, { base: true, x: -2.18, y: 1.1, z, cast: false }))
  bridge.add(box(0.05, 0.05, span - 2, yel, { x: -2.18, y: 2.1 }))
  // cab-less (pendant / remote); warning beacon + floor spot lamps
  bridge.add(cyl(0.1, 0.1, 0.18, glowMat('#ffae2a', 1.4), { x: 0, y: 0.06, z: span / 2 - 1.6, cast: false }))
  // trolley
  const trolley = dynamic(pivot('trolley', 0, 1.72, 0))
  trolley.add(box(3.0, 0.35, 2.6, colorMat('#d9a520', 0.45, 0.2), { base: true }))
  trolley.add(cyl(0.45, 0.45, 1.6, mat('steel.dark'), { axis: 'x', y: 0.85, z: 0.2 }))
  trolley.add(box(0.7, 0.6, 0.6, mat('paint.blue'), { base: true, x: 1.15, y: 0.35, z: -0.8, round: 0.05 }))
  trolley.add(box(0.6, 0.5, 0.6, mat('paint.dark'), { base: true, x: -1.1, y: 0.35, z: -0.8 }))
  for (const sx of [1.05, -1.05]) for (const sz of [1, -1]) trolley.add(cyl(0.18, 0.18, 0.12, mat('steel.dark'), { axis: 'x', x: sx, y: 0.05, z: sz * 0.95 }))
  bridge.add(trolley)
  // hook block hangs from the trolley; ropes are scaled each frame
  const block = dynamic(pivot('block', 0, -4, 0))
  block.add(box(0.7, 0.75, 0.35, yel, { y: 0.1 }))
  block.add(cyl(0.3, 0.3, 0.42, mat('steel'), { axis: 'z', y: 0.35 }))
  block.add(decal('hazard', 0.68, 0.3, { y: -0.12, z: 0.18 }))
  block.add(cyl(0.07, 0.05, 0.5, mat('steel.dark'), { y: -0.5 }))
  const cargo = dynamic(pivot('cargo', 0, -0.75, 0))
  block.add(cargo)
  trolley.add(block)
  const ropeMat = colorMat('#3a3c3e', 0.5, 0.8)
  const ropes = [-0.22, 0.22].flatMap((x) => [-0.06, 0.06].map((z) => {
    const r = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 1, 5).translate(0, -0.5, 0), ropeMat)
    r.position.set(x, 0.85, z)
    r.castShadow = true
    r.userData.keep = true
    trolley.add(r)
    return r
  }))
  g.add(bridge)
  bakeTree(g, { colors: true })
  return { object: g, rig: { bridge, trolley, block, cargo, ropes, railY, span } }
}

let coilProto
let dieProto
function payloadMesh(kind) {
  if (kind === 'coil') {
    coilProto ??= (() => {
      // coil eye along z; C-hook tong: back leg, top arm, finger through the eye
      const c = coil({ r: 0.85, w: 1.25 }).object
      const t = group(c)
      c.position.y = -1.75
      const y = colorMat('#d9a520', 0.45, 0.2)
      t.add(box(0.3, 2.2, 0.22, y, { z: -0.98, y: -0.85 }))
      t.add(box(0.3, 0.3, 1.2, y, { z: -0.45, y: 0.1 }))
      t.add(box(0.26, 0.2, 1.4, y, { z: -0.22, y: -1.75 }))
      return t
    })()
    return coilProto.clone()
  }
  if (kind === 'die') {
    dieProto ??= (() => {
      const d = group(box(2.6, 1.0, 2.0, colorMat('#5d6461', 0.55, 0.5), { y: -2.1 }), box(2.7, 0.08, 2.1, mat('paint.red'), { y: -1.58 }))
      const ch = colorMat('#3a3c3e', 0.5, 0.8)
      for (const [x, z] of [[1.1, 0.8], [-1.1, 0.8], [1.1, -0.8], [-1.1, -0.8]]) {
        const a = new THREE.Vector3(0, 0, 0)
        const b = new THREE.Vector3(x, -1.6, z)
        const len = a.distanceTo(b)
        const r = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, len, 5).translate(0, -len / 2, 0), ch)
        r.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), b.clone().normalize())
        d.add(r)
      }
      return d
    })()
    return dieProto.clone()
  }
  return null
}

/** animator: agent { bx, tz, hy (hook height above floor), payload } */
export function animateBridgeCrane(e, dt, time) {
  const a = e.agent
  const r = e.rig
  r.bridge.position.x = a.bx ?? 0
  r.trolley.position.z = a.tz ?? 0
  // hook height above the floor -> block y in trolley space
  const top = r.railY + 1.72
  const by = Math.min(-1.2, (a.hy ?? 6) - top)
  r.block.position.y = by
  for (const rope of r.ropes) rope.scale.y = Math.max(0.1, -by + 0.85 - 0.35)
  const kind = a.payload || null
  if ((r.cargo.userData.kind || null) !== kind) {
    r.cargo.clear()
    const m = payloadMesh(kind)
    if (m) r.cargo.add(m)
    r.cargo.userData.kind = kind
  }
  // slight swing while travelling
  const v = a._px == null ? 0 : ((a.bx ?? 0) - a._px) / Math.max(dt, 1e-3)
  a._px = a.bx ?? 0
  a._sw = (a._sw || 0) + ((-v * 0.012 - (a._sw || 0)) * Math.min(1, dt * 2))
  r.block.rotation.z = a._sw
}
