// Straight-side mechanical press (2500 t head press / 800 t followers): pit-mounted bed,
// four uprights with tie rods, crown with flywheel + motor + walkway, sliding ram with upper
// die, moving bolster (rolls out on floor rails for die change), light curtains, pendant.
// rig: { slide, flywheel, bolster, part, open (0..1 setter), stroke }

import * as THREE from 'three'
import { mat, colorMat, glowMat } from '../../render/materials.js'
import { box, cyl, pivot, group, dynamic, bakeTree } from '../../prefabs/kit.js'
import { decal } from '../../prefabs/parts-real.js'
import { labelTexture } from '../../render/sheets.js'
import { panelGeometry, panelMaterial } from './robot.js'

const BODY = '#3d5568'
const BODY_DK = '#2c3b48'
const DIE = '#5d6461'

/** @param {{ big?: boolean, label?: string }} p  - line runs along local x */
export function press({ big = false, label = 'P' } = {}) {
  const W = big ? 5.6 : 4.8 // along the line (x)
  const D = big ? 4.6 : 4.0 // across (z)
  const H = big ? 8.4 : 7.0 // crown top above floor
  const bedH = 1.05 // bolster top above floor (bed sits in a pit)
  // open daylight 1.15 m (1.35 big) above the lower die; stroke closes it to ~0.05 m
  const stroke = big ? 1.3 : 1.1
  const crownH = big ? 2.2 : 1.8
  const body = colorMat(BODY, 0.42, 0.35)
  const dark = colorMat(BODY_DK, 0.5, 0.35)
  const yellow = mat('paint.yellow')
  const g = group()
  // pit edge + bed
  g.add(box(W + 1.2, 0.12, D + 1.6, mat('concrete.fresh'), { base: true, y: -0.1 }))
  g.add(box(W, bedH - 0.25, D, body, { base: true }))
  g.add(box(W + 0.02, 0.06, D + 0.02, yellow, { y: bedH - 0.28 }))
  // four uprights (box columns) with front gib faces + tie-rod nuts
  const uw = big ? 1.0 : 0.85
  const ud = big ? 1.0 : 0.85
  const top = H - crownH
  for (const sx of [1, -1]) for (const sz of [1, -1]) {
    const x = sx * (W / 2 - uw / 2)
    const z = sz * (D / 2 - ud / 2)
    g.add(box(uw, top - bedH + 0.25, ud, body, { base: true, x, y: bedH - 0.25, round: 0.04 }))
    g.add(box(0.08, top - bedH - 0.4, 0.42, mat('steel'), { base: true, x: x - sx * (uw / 2 + 0.02), y: bedH + 0.3, z }))
    g.add(cyl(0.16, 0.16, 0.22, mat('steel.dark'), { base: true, x, y: H, z, seg: 8 }))
    g.add(cyl(0.16, 0.16, 0.18, mat('steel.dark'), { x, y: bedH - 0.42, z, seg: 8 }))
  }
  // crown + drive: motor, flywheel guard, clutch, walkway with rails
  g.add(box(W + 0.1, crownH, D + 0.1, body, { base: true, y: top, round: 0.06 }))
  g.add(box(W + 0.14, 0.1, D + 0.14, dark, { y: top + 0.08 }))
  g.add(box(W - 0.4, 0.06, D - 0.6, mat('steel.dark'), { y: H + 0.03 }))
  g.add(box(1.3, 1.0, 1.0, dark, { base: true, x: -W / 2 + 1.0, y: H, z: D / 2 - 0.9, round: 0.05 }))
  g.add(box(0.9, 0.8, 1.3, mat('paint.blue'), { base: true, x: W / 2 - 1.1, y: H, z: -D / 2 + 1.0, round: 0.06 }))
  for (const sx of [1, -1]) for (const sz of [1, -1]) g.add(cyl(0.025, 0.025, 1.05, yellow, { base: true, x: sx * (W / 2 - 0.15), y: H, z: sz * (D / 2 - 0.15), seg: 6 }))
  for (const sz of [1, -1]) g.add(box(W - 0.3, 0.05, 0.05, yellow, { x: 0, y: H + 1.05, z: sz * (D / 2 - 0.15) }))
  for (const sx of [1, -1]) g.add(box(0.05, 0.05, D - 0.3, yellow, { x: sx * (W / 2 - 0.15), y: H + 1.05 }))
  // caged ladder on the back left upright
  const lx = -W / 2 - 0.35
  for (const s of [-0.22, 0.22]) g.add(box(0.05, H, 0.05, yellow, { base: true, x: lx, z: -D / 2 + 0.6 + s }))
  for (let y = 0.3; y < H; y += 0.3) g.add(box(0.03, 0.03, 0.44, yellow, { x: lx, y, z: -D / 2 + 0.6, cast: false }))
  for (let y = 2.4; y < H; y += 1.2) g.add(box(0.7, 0.04, 0.04, yellow, { x: lx - 0.35, y, z: -D / 2 + 0.6 - 0.35, cast: false }))
  // flywheel (spins)
  const flywheel = dynamic(pivot('flywheel', W / 2 - 0.25, top + crownH * 0.55, 0))
  flywheel.add(cyl(crownH * 0.42, crownH * 0.42, 0.34, colorMat('#6d7a83', 0.35, 0.7), { axis: 'x', seg: 28 }))
  flywheel.add(box(0.36, crownH * 0.7, 0.12, colorMat('#a8b0b6', 0.35, 0.7), { cast: false }))
  g.add(flywheel)
  // nameplate + hazard stripes
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.5), new THREE.MeshStandardMaterial({ map: labelTexture(label, { bg: '#e9eef2', fg: '#1d3550', w: 512, h: 116, font: 'bold 54px sans-serif' }), roughness: 0.5 }))
  plate.position.set(0, top + crownH * 0.5, D / 2 + 0.07)
  g.add(plate)
  g.add(decal('hazard', W - 2 * uw, 0.22, { y: bedH - 0.12, z: D / 2 + 0.002 }))
  // slide (ram): moves down by `stroke`
  // slide (ram): open position leaves `stroke + 0.05` daylight over the lower die
  const slideH = big ? 1.5 : 1.25
  const upH = 0.9
  const lowTop = bedH + 0.6
  const yOpen = lowTop + stroke + 0.05 + upH + slideH / 2
  const slide = dynamic(pivot('slide', 0, yOpen, 0))
  slide.add(box(W - 2 * uw - 0.06, slideH, D - 0.5, colorMat('#4a6377', 0.38, 0.4)))
  slide.add(decal('hazard', W - 2 * uw - 0.1, 0.18, { y: -slideH / 2 + 0.12, z: (D - 0.5) / 2 + 0.003 }))
  // connection housing + plunger guides up into the crown (hidden in it when the slide is up)
  const conn = top - (yOpen + slideH / 2) + stroke + 0.3
  slide.add(box(W - 2 * uw - 0.6, conn, D - 1.2, colorMat('#344654', 0.45, 0.4), { y: slideH / 2 + conn / 2 }))
  for (const sx of [1, -1]) slide.add(cyl(0.22, 0.22, conn, mat('chrome'), { x: sx * (W / 2 - uw - 0.6), y: slideH / 2 + conn / 2, z: 0 }))
  // upper die (0.9 m), closes onto the lower die (0.6 m) at the bottom of the stroke
  const dieW = W - 2 * uw - 0.5
  slide.add(box(dieW, upH, D - 1.1, colorMat(DIE, 0.55, 0.5), { y: -slideH / 2 - upH / 2 }))
  slide.add(box(dieW + 0.1, 0.08, D - 1.0, mat('paint.red'), { y: -slideH / 2 - 0.05 }))
  g.add(slide)
  // moving bolster with lower die (rolls out along +z on rails)
  const bolster = dynamic(pivot('bolster', 0, bedH - 0.25, 0))
  const lowH = 0.6
  bolster.add(box(W - 2 * uw - 0.1, 0.25, D - 0.2, colorMat('#5a6f7e', 0.4, 0.5), { base: true }))
  bolster.add(box(dieW, lowH, D - 1.1, colorMat(DIE, 0.55, 0.5), { base: true, y: 0.25 }))
  for (const sx of [1, -1]) for (const sz of [1, -1]) bolster.add(box(0.2, 0.18, 0.12, mat('paint.red'), { x: sx * (dieW / 2 - 0.3), y: 0.25 + lowH - 0.15, z: sz * ((D - 1.1) / 2 + 0.06) }))
  const part = new THREE.Mesh(panelGeometry(), panelMaterial())
  part.position.y = 0.25 + lowH + 0.01
  part.scale.set(1, 1, 1)
  part.castShadow = true
  part.visible = false
  part.userData.keep = true
  bolster.add(part)
  g.add(bolster)
  // floor rails for the moving bolster (front)
  for (const sx of [1, -1]) g.add(box(0.12, 0.05, 5.5, mat('steel'), { base: true, x: sx * 1.1, z: D / 2 + 2.8 }))
  // light curtains at both windows (x faces), pendant control on the front
  for (const sx of [1, -1]) for (const sz of [1, -1]) {
    g.add(box(0.06, 1.8, 0.06, colorMat('#e3c32a', 0.5), { base: true, x: sx * (W / 2 + 0.25), y: 0.3, z: sz * 1.3 }))
    g.add(box(0.07, 0.1, 0.07, glowMat('#ff5040', 0.6), { x: sx * (W / 2 + 0.25), y: 2.15, z: sz * 1.3, cast: false }))
  }
  g.add(box(0.5, 0.75, 0.25, colorMat('#d5d8d6', 0.5), { base: true, x: W / 2 + 0.2, y: 1.05, z: D / 2 + 0.6 }))
  g.add(cyl(0.035, 0.035, 1.05, mat('steel.dark'), { base: true, x: W / 2 + 0.2, z: D / 2 + 0.6 }))
  g.add(box(0.36, 0.3, 0.04, glowMat('#4fa3ff', 0.9), { x: W / 2 + 0.2, y: 1.55, z: D / 2 + 0.74, cast: false }))
  bakeTree(g, { colors: true })
  const rig = { slide, flywheel, bolster, part, stroke, yOpen, dieY: bedH + 0.25 + lowH + 0.01, W, D, H }
  return { object: g, rig }
}

/** Blank destacker: two pallet stacks of blanks + magnetic fanner table (static) */
export function destacker() {
  const g = group()
  g.add(box(3.2, 0.9, 2.4, colorMat('#3d5568', 0.45, 0.35), { base: true }))
  for (const sz of [-0.6, 0.6]) {
    g.add(box(1.9, 0.12, 1.2, mat('timber'), { base: true, x: -0.2, y: 0.9, z: sz }))
  }
  const stack = new THREE.Group()
  for (let i = 0; i < 24; i++) {
    const m = new THREE.Mesh(panelGeometry(), panelMaterial())
    m.scale.set(1, 0.08, 1)
    m.position.set(-0.2, 1.04 + i * 0.022, 0)
    stack.add(m)
  }
  g.add(stack)
  for (const sx of [1.5, -1.5]) g.add(box(0.12, 1.6, 0.12, mat('paint.yellow'), { base: true, x: sx, y: 0.9, z: 1.1 }))
  bakeTree(g, { colors: true })
  return { object: g, rig: {} }
}

/** Line-end belt conveyor with inspection light tunnel (parts ride along +x) */
export function exitConveyor({ L = 10 } = {}) {
  const g = group()
  g.add(box(L, 0.12, 1.6, mat('rubber'), { base: true, y: 0.92 }))
  for (const sz of [0.86, -0.86]) g.add(box(L, 0.22, 0.1, colorMat('#3d5568', 0.45, 0.35), { base: true, y: 0.84, z: sz }))
  for (let x = -L / 2 + 0.5; x < L / 2; x += 1.6) for (const sz of [0.75, -0.75]) g.add(box(0.1, 0.86, 0.1, mat('steel.dark'), { base: true, x, z: sz }))
  // light tunnel
  g.add(box(2, 0.1, 2.2, mat('steel.dark'), { y: 2.6, x: 1.5 }))
  for (const sz of [1.05, -1.05]) g.add(box(2, 1.6, 0.06, mat('steel.dark'), { base: true, x: 1.5, y: 1.0, z: sz }))
  g.add(box(1.8, 0.04, 1.8, glowMat('#eaf3ff', 1.6), { y: 2.53, x: 1.5, cast: false }))
  const items = dynamic(pivot('items', 0, 1.06, 0))
  const parts = []
  for (let i = 0; i < 4; i++) {
    const m = new THREE.Mesh(panelGeometry(), panelMaterial())
    m.castShadow = true
    m.userData.keep = true
    items.add(m)
    parts.push(m)
  }
  g.add(items)
  bakeTree(g, { colors: true })
  return { object: g, rig: { items, parts, L } }
}
