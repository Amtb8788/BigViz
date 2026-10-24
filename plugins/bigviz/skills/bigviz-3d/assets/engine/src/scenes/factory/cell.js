// Body-in-white weld line (one robot cell line): shuttle conveyor on two rails, 6 fixtures
// (load, 4 weld stations, unload) with pneumatic swing clamps, safety fence (mesh panels on
// yellow posts) with light-curtain ends, robot stack lights. Line runs along local x.
// rig: { clamps: [pivotGroup x6], parts: [Mesh x6], stack: { g, a, r } (line materials), X: [...] }

import * as THREE from 'three'
import { mat, colorMat, own } from '../../render/materials.js'
import { box, cyl, pivot, group, dynamic, bakeTree } from '../../prefabs/kit.js'
import { meshMat, sheet } from './mats.js'
import { panelGeometry, panelMaterial } from './robot.js'

const FIX_Y = 1.0

/** @param {{ X: number[], x0: number, x1: number, robots: number[][] (local [x, z]), hw?: number }} p */
export function weldCell({ X, x0, x1, robots, hw = 4.0 }) {
  const g = group()
  const L = x1 - x0
  const cx = (x0 + x1) / 2
  const dark = colorMat('#3b4045', 0.55, 0.5)
  // shuttle rails + posts
  for (const sz of [0.45, -0.45]) g.add(box(L - 2, 0.12, 0.12, mat('steel'), { x: cx, y: 0.78, z: sz }))
  for (let x = x0 + 1.5; x < x1 - 1; x += 2) for (const sz of [0.45, -0.45]) g.add(box(0.12, 0.72, 0.12, dark, { base: true, x, z: sz }))
  const clamps = []
  const parts = []
  for (const x of X) {
    // fixture base: frame + 4 locating blocks + pin posts
    g.add(box(2.2, 0.16, 1.5, dark, { x, y: 0.86 }))
    for (const [dx, dz] of [[0.95, 0.62], [-0.95, 0.62], [0.95, -0.62], [-0.95, -0.62]]) {
      g.add(box(0.14, 0.14, 0.14, colorMat('#5f7f9c', 0.5, 0.4), { x: x + dx, y: 0.98, z: dz }))
      g.add(cyl(0.022, 0.022, 0.16, mat('chrome'), { base: true, x: x + dx * 0.7, y: 0.94, z: dz * 0.4, seg: 6 }))
    }
    // swing clamps (one dynamic group per fixture)
    const cg = dynamic(pivot('clamps', x, 0, 0))
    for (const [dx, dz] of [[0.75, 0.62], [-0.75, 0.62], [0.75, -0.62], [-0.75, -0.62]]) {
      g.add(cyl(0.05, 0.05, 0.28, colorMat('#c9ced2', 0.35, 0.7), { base: true, x: x + dx, y: 0.94, z: dz, seg: 10 }))
      const arm = pivot('arm', dx, 1.24, dz)
      arm.add(box(0.06, 0.06, 0.32, colorMat('#2f4f78', 0.5, 0.3), { z: -Math.sign(dz) * 0.14 }))
      arm.userData.side = Math.sign(dz)
      cg.add(arm)
    }
    g.add(cg)
    clamps.push(cg)
    const p = new THREE.Mesh(panelGeometry(), panelMaterial())
    p.position.set(x, FIX_Y + 0.02, 0)
    p.castShadow = true
    p.userData.keep = true
    g.add(p)
    parts.push(p)
  }
  // fence: long sides at z = +-hw, short sides at x0 / x1 (light curtains in the middle 2 m)
  const fm = meshMat()
  const post = mat('paint.yellow')
  const H = 2.2
  for (const sz of [hw, -hw]) {
    g.add(sheet(L, H - 0.2, fm, 0.4, { x: cx, y: 0.1 + (H - 0.2) / 2, z: sz, cast: true }))
    for (const y of [0.12, H]) g.add(box(L, 0.05, 0.05, post, { x: cx, y, z: sz }))
    for (let x = x0; x <= x1 + 0.01; x += 2) g.add(box(0.08, H, 0.08, post, { base: true, x, z: sz }))
  }
  for (const sx of [x0, x1]) {
    for (const [a, b] of [[-hw, -1.2], [1.2, hw]]) {
      g.add(sheet(b - a, H - 0.2, fm, 0.4, { x: sx, y: 0.1 + (H - 0.2) / 2, z: (a + b) / 2, ry: Math.PI / 2 }))
      for (const y of [0.12, H]) g.add(box(0.05, 0.05, b - a, post, { x: sx, y, z: (a + b) / 2 }))
    }
    // light-curtain columns + operator push-button station
    for (const sz of [1.2, -1.2]) {
      g.add(box(0.1, 1.9, 0.1, colorMat('#e3c32a', 0.5), { base: true, x: sx, z: sz }))
      g.add(box(0.03, 1.6, 0.02, colorMat('#ff4030', 0.4), { base: true, x: sx + (sx < cx ? -0.06 : 0.06), y: 0.2, z: sz - Math.sign(sz) * 0.05, cast: false }))
    }
    g.add(box(0.3, 0.45, 0.2, colorMat('#d5d8d6', 0.5), { x: sx + (sx < cx ? -0.6 : 0.6), y: 1.25, z: 1.7 }))
    g.add(cyl(0.03, 0.03, 1.0, mat('steel.dark'), { base: true, x: sx + (sx < cx ? -0.6 : 0.6), z: 1.7, seg: 6 }))
  }
  // stack lights on the robot pedestals (shared per line: green / amber / red)
  const stack = { g: own(colorMat('#1f6b3a', 0.4)), a: own(colorMat('#7a5a12', 0.4)), r: own(colorMat('#6b1f1f', 0.4)) }
  stack.g.emissive.set('#3bff7a'); stack.a.emissive.set('#ffb21a'); stack.r.emissive.set('#ff3b2a')
  for (const m of Object.values(stack)) m.userData.live = true
  for (const [x, z] of robots) {
    const sx = x + 0.75
    const sz = z + Math.sign(z) * 0.7
    g.add(cyl(0.02, 0.02, 2.4, mat('steel.dark'), { base: true, x: sx, z: sz, seg: 5 }))
    g.add(cyl(0.07, 0.07, 0.14, stack.r, { x: sx, y: 2.7, z: sz, seg: 10 }))
    g.add(cyl(0.07, 0.07, 0.14, stack.a, { x: sx, y: 2.55, z: sz, seg: 10 }))
    g.add(cyl(0.07, 0.07, 0.14, stack.g, { x: sx, y: 2.4, z: sz, seg: 10 }))
  }
  bakeTree(g, { colors: true })
  return { object: g, rig: { clamps, parts, stack, X, FIX_Y } }
}
