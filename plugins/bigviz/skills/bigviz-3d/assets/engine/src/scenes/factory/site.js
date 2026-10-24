// Factory pack - outdoor buildings: clad sheds (utility station, raw-material warehouse),
// counter-flow cooling tower cells with spinning fans, transformer yard, gatehouse with
// barrier arm, overhead pipe rack.

import * as THREE from 'three'
import { mat, colorMat, glowMat } from '../../render/materials.js'
import { box, cyl, rod, pivot, group, dynamic, bakeTree } from '../../prefabs/kit.js'
import { labelTexture } from '../../render/sheets.js'
import { decal } from '../../prefabs/parts-real.js'
import { cladMat, roofMat, sheet, officeGlass } from './mats.js'

const V = (x, y, z) => new THREE.Vector3(x, y, z)

/** clad portal shed: w (x) x d (z), eave h, doors on the +z face: [{ x, w, h }] */
export function shed({ w = 30, d = 14, h = 7.5, doors = [], label = null, louvres = false } = {}) {
  const g = group()
  const clad = cladMat('#c6cacd', 'wall')
  const band = cladMat('#2f5d8c', 'band')
  const plinth = colorMat('#8f8c86', 0.85, 0)
  const rise = Math.min(1.6, d * 0.08)
  for (const [L, x, z, ry] of [[w, 0, d / 2, 0], [w, 0, -d / 2, Math.PI], [d, w / 2, 0, Math.PI / 2], [d, -w / 2, 0, -Math.PI / 2]]) {
    const wg = new THREE.Group()
    wg.position.set(x, 0, z)
    wg.rotation.y = ry
    wg.add(box(L, 1.0, 0.22, plinth, { base: true }))
    wg.add(sheet(L, h - 2.0, clad, 4, { y: 1.0 + (h - 2.0) / 2, z: 0.02 }))
    wg.add(sheet(L, 1.0, band, 4, { y: h - 0.5, z: 0.04 }))
    if (ry === 0) for (const o of doors) {
      wg.add(box(o.w + 0.4, o.h + 0.2, 0.08, colorMat('#e3c32a', 0.5), { base: true, x: o.x, z: 0.06 }))
      wg.add(sheet(o.w, o.h, cladMat('#b9c0c5', 'shutter'), 2, { x: o.x, y: o.h / 2, z: 0.12 }))
    }
    if (louvres && ry !== 0) for (let u = -L / 2 + 2; u < L / 2 - 1; u += 3.5) wg.add(box(1.8, 1.2, 0.12, colorMat('#7f878c', 0.6, 0.5), { x: u, y: 3.2, z: 0.08 }))
    if (ry === Math.PI) wg.add(box(L - 2, 0.9, 0.05, officeGlass(), { y: 4.6, z: 0.06, cast: false }))
    g.add(wg)
  }
  // low-pitch roof + gables
  const pos = [-w / 2, h, -d / 2, w / 2, h, -d / 2, w / 2, h + rise, 0, -w / 2, h + rise, 0, -w / 2, h + rise, 0, w / 2, h + rise, 0, w / 2, h, d / 2, -w / 2, h, d / 2]
  const rg = new THREE.BufferGeometry()
  rg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  rg.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, w / 4, 0, w / 4, d / 8, 0, d / 8, 0, 0, w / 4, 0, w / 4, d / 8, 0, d / 8], 2))
  rg.setIndex([0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7])
  rg.computeVertexNormals()
  const roof = new THREE.Mesh(rg, roofMat())
  roof.castShadow = true
  roof.receiveShadow = true
  g.add(roof)
  for (const sx of [1, -1]) {
    const tg = new THREE.BufferGeometry()
    tg.setAttribute('position', new THREE.Float32BufferAttribute([sx * w / 2, h, -d / 2, sx * w / 2, h, d / 2, sx * w / 2, h + rise, 0], 3))
    tg.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, d / 4, 0, d / 8, rise / 4], 2))
    tg.computeVertexNormals()
    const t = new THREE.Mesh(tg, clad)
    g.add(t)
  }
  g.add(box(w + 0.3, 0.2, 0.3, colorMat('#d9dcdd', 0.4, 0.6), { y: h + 0.05, z: d / 2 + 0.1 }))
  g.add(box(w + 0.3, 0.2, 0.3, colorMat('#d9dcdd', 0.4, 0.6), { y: h + 0.05, z: -d / 2 - 0.1 }))
  if (label) {
    const s = new THREE.Mesh(new THREE.PlaneGeometry(Math.min(w * 0.5, label.length * 1.1), 1.1), new THREE.MeshStandardMaterial({ map: labelTexture(label, { bg: '#2f5d8c', fg: '#fff', w: 1024, h: 110, font: 'bold 64px sans-serif' }), roughness: 0.5 }))
    s.position.set(-w * 0.18, h - 0.5, d / 2 + 0.08)
    g.add(s)
  }
  bakeTree(g, { colors: true })
  return { object: g, rig: {} }
}

/** one counter-flow cooling tower cell 6 x 6 m; rig.fan spins */
export function coolingTower() {
  const g = group()
  const frp = colorMat('#6c8fa6', 0.55, 0.1)
  g.add(box(6.6, 0.8, 6.6, colorMat('#8f8c86', 0.85, 0), { base: true }))
  g.add(box(6, 2.4, 6, colorMat('#4b5a63', 0.7, 0.2), { base: true, y: 0.8 }))
  for (let y = 1.0; y < 3.1; y += 0.3) for (const [x, z, ry] of [[0, 3.02, 0], [0, -3.02, 0], [3.02, 0, Math.PI / 2], [-3.02, 0, Math.PI / 2]]) g.add(box(5.8, 0.06, 0.1, colorMat('#5f6e77', 0.6, 0.3), { x, y, z, ry, rx: 0.5, cast: false }))
  g.add(box(6, 3.0, 6, frp, { base: true, y: 3.2 }))
  g.add(box(6.1, 0.2, 6.1, colorMat('#d9dcdd', 0.5, 0.2), { y: 6.25 }))
  g.add(cyl(2.3, 2.6, 1.8, frp, { base: true, y: 6.3, seg: 32 }))
  g.add(cyl(2.35, 2.35, 0.1, colorMat('#d9dcdd', 0.5, 0.2), { y: 8.1, seg: 32 }))
  const fan = dynamic(pivot('fan', 0, 7.4, 0))
  for (let i = 0; i < 6; i++) fan.add(box(2.0, 0.04, 0.42, colorMat('#2f3236', 0.5, 0.4), { x: Math.cos((i / 6) * Math.PI * 2) * 1.05, z: Math.sin((i / 6) * Math.PI * 2) * 1.05, ry: -(i / 6) * Math.PI * 2, rx: 0.18 }))
  fan.add(cyl(0.25, 0.25, 0.3, mat('steel.dark')))
  g.add(fan)
  g.add(box(1.0, 0.8, 0.6, mat('paint.blue'), { base: true, y: 6.3, x: 2.6, z: 2.6 }))
  for (const s of [1, -1]) g.add(box(0.05, 1.1, 0.05, mat('paint.yellow'), { base: true, x: s * 2.95, y: 6.3, z: 2.95 }))
  g.add(box(6, 0.05, 0.05, mat('paint.yellow'), { y: 7.4, z: 2.95 }))
  // caged ladder
  for (const s of [-0.22, 0.22]) g.add(box(0.05, 7.6, 0.05, mat('paint.yellow'), { base: true, x: 3.2, z: -1.5 + s }))
  for (let y = 0.4; y < 7.6; y += 0.3) g.add(box(0.03, 0.03, 0.44, mat('paint.yellow'), { x: 3.2, y, z: -1.5, cast: false }))
  // pipes into the basin
  g.add(cyl(0.22, 0.22, 4, mat('paint.green'), { axis: 'x', x: -5, y: 1.4, z: 1.5 }))
  g.add(cyl(0.22, 0.22, 4, colorMat('#2f6aa8', 0.5, 0.3), { axis: 'x', x: -5, y: 4.4, z: -1.5 }))
  bakeTree(g, { colors: true })
  return { object: g, rig: { fan } }
}

/** oil-filled transformer on a pad (radiators, bushings) */
export function transformer() {
  const g = group(box(4, 0.3, 3, colorMat('#8f8c86', 0.85, 0), { base: true }))
  const body = colorMat('#7c8a7c', 0.6, 0.3)
  g.add(box(2.4, 2.2, 1.6, body, { base: true, y: 0.3 }))
  for (let i = 0; i < 8; i++) for (const s of [1, -1]) g.add(box(0.06, 1.8, 0.5, body, { base: true, x: -1.05 + i * 0.3, y: 0.45, z: s * 1.05 }))
  for (const x of [-0.6, 0, 0.6]) g.add(cyl(0.08, 0.12, 0.8, colorMat('#a4553a', 0.4, 0.1), { base: true, x, y: 2.5, z: -0.3 }))
  g.add(cyl(0.35, 0.35, 1.2, body, { axis: 'x', y: 2.75, z: 0.5 }))
  g.add(decal('hazard', 1.6, 0.3, { y: 1.2, z: 0.81 }))
  bakeTree(g, { colors: true })
  return { object: g, rig: {} }
}

/** gatehouse + barrier arm (rig.arm, open 0..1 via rotation.z) */
export function gatehouse({ label = '1# 门' } = {}) {
  const g = group()
  g.add(box(4, 3.0, 3, colorMat('#e4e6e3', 0.6, 0.1), { base: true }))
  g.add(box(4.6, 0.3, 3.6, colorMat('#2f5d8c', 0.5, 0.3), { y: 3.15 }))
  g.add(box(3.4, 1.2, 0.05, officeGlass(), { y: 1.8, z: 1.52, cast: false }))
  g.add(box(0.05, 1.2, 2.2, officeGlass(), { x: 2.02, y: 1.8, cast: false }))
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(3, 0.5), new THREE.MeshStandardMaterial({ map: labelTexture(label, { bg: '#2f5d8c', fg: '#fff', w: 512, h: 86, font: 'bold 52px sans-serif' }) }))
  plate.position.set(0, 3.15, 1.82)
  g.add(plate)
  // barrier post + arm (arm points +x, pivots up)
  g.add(box(0.4, 1.1, 0.4, colorMat('#e9ecef', 0.5, 0.2), { base: true, x: 2.6, z: 2.2 }))
  const arm = dynamic(pivot('arm', 2.6, 1.0, 2.2))
  for (let i = 0; i < 6; i++) arm.add(box(1, 0.12, 0.08, i % 2 ? mat('paint.red') : mat('paint.white'), { x: 0.5 + i, cast: true }))
  g.add(arm)
  g.add(cyl(0.08, 0.08, 0.1, glowMat('#ff3b2a', 1.2), { x: 2.6, y: 1.16, z: 2.2, cast: false }))
  bakeTree(g, { colors: true })
  return { object: g, rig: { arm } }
}

/** overhead pipe rack along local z (L m), steel portals every 6 m, 3 pipes at 6.2 m */
export function pipeRack({ L = 30 } = {}) {
  const g = group()
  const s = colorMat('#9aa1a6', 0.5, 0.5)
  for (let z = -L / 2; z <= L / 2 + 0.01; z += 6) {
    for (const x of [-1.2, 1.2]) g.add(box(0.25, 6.6, 0.25, s, { base: true, x, z }))
    g.add(box(2.8, 0.25, 0.3, s, { y: 6.0, z }))
  }
  for (const [x, c, r] of [[-0.7, '#3e8a5a', 0.2], [0, '#2f6aa8', 0.26], [0.7, '#d9b228', 0.16]]) g.add(cyl(r, r, L, colorMat(c, 0.5, 0.3), { axis: 'z', x, y: 6.15 + r }))
  bakeTree(g, { colors: true })
  return { object: g, rig: {} }
}

/** compressor skid (indoor of the utility station; shown through the open door) */
export function compressor() {
  const g = group(box(3.2, 1.9, 1.6, colorMat('#2f5d8c', 0.45, 0.3), { base: true, round: 0.05 }))
  g.add(box(0.9, 0.5, 0.04, colorMat('#15181b', 0.3), { x: 0.8, y: 1.3, z: 0.81 }))
  g.add(cyl(0.5, 0.5, 2.2, colorMat('#c9ced2', 0.4, 0.6), { base: true, x: -2.4 }))
  bakeTree(g, { colors: true })
  return { object: g, rig: {} }
}
