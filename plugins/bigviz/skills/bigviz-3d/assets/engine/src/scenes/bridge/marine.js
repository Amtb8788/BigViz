// Bridge pack - river craft: inland bulk carrier (lofted hull, aft accommodation, hatches),
// 200 t floating crane barge with luffing lattice boom, material barge, channel buoys.
// All origins sit on the waterline; +z = bow for ships (they sail along the river).

import * as THREE from 'three'
import { mat, colorMat, lightMat, glowMat } from '../../render/materials.js'
import { box, cyl, cone, group, bakeTree } from '../../prefabs/kit.js'
import { jibGeo } from '../../prefabs/truss.js'
import { Quads } from './geo.js'

/** hull plan outline (x across, z along), length L, beam B, bow at +z */
function outline(L, B) {
  const pts = []
  const h = L / 2
  const bowStart = h - B * 1.4
  for (let i = 0; i <= 10; i++) { const t = i / 10; pts.push([B / 2 * (1 - Math.pow(t, 2.2)), bowStart + t * (h - bowStart)]) }
  for (let i = 9; i >= 0; i--) { const t = i / 10; pts.push([-B / 2 * (1 - Math.pow(t, 2.2)), bowStart + t * (h - bowStart)]) }
  // stern: rounded corners (radius R), port aft then starboard aft
  const R = 2.2
  for (let i = 0; i <= 4; i++) { const a = Math.PI + (i / 4) * Math.PI / 2; pts.push([-B / 2 + R + Math.cos(a) * R, -h + R + Math.sin(a) * R]) }
  for (let i = 0; i <= 4; i++) { const a = Math.PI * 1.5 + (i / 4) * Math.PI / 2; pts.push([B / 2 - R + Math.cos(a) * R, -h + R + Math.sin(a) * R]) }
  return pts
}

/** lofted hull rings: [y, scale-across, colour]; returns geometry */
function hullGeo(L, B, rings) {
  const P = outline(L, B)
  const q = new Quads()
  for (let r = 0; r < rings.length - 1; r++) {
    const [y0, s0, c] = rings[r]
    const [y1, s1] = rings[r + 1]
    for (let i = 0; i < P.length; i++) {
      const a = P[i]; const b = P[(i + 1) % P.length]
      const v = [new THREE.Vector3(a[0] * s0, y0, a[1]), new THREE.Vector3(b[0] * s0, y0, b[1]), new THREE.Vector3(b[0] * s1, y1, b[1]), new THREE.Vector3(a[0] * s1, y1, a[1])]
      q.quad(v, new THREE.Vector3((a[0] + b[0]) / 2, 0, (a[1] + b[1]) / 2 * 0.15), [[i / 4, y0 / 4], [(i + 1) / 4, y0 / 4], [(i + 1) / 4, y1 / 4], [i / 4, y1 / 4]], c)
    }
  }
  // deck cap
  const top = rings[rings.length - 1]
  const contour = P.map(([x, z]) => new THREE.Vector2(x * top[1], z))
  if (THREE.ShapeUtils.isClockWise(contour)) contour.reverse()
  const dc = new THREE.Color('#6b3a2c')
  for (const t of THREE.ShapeUtils.triangulateShape(contour, [])) {
    const v = t.map((k) => new THREE.Vector3(contour[k].x, top[0], contour[k].y))
    q.quad([v[0], v[1], v[2], v[2]], new THREE.Vector3(0, 1, 0), v.map((p) => [p.x / 4, p.z / 4]).concat([[0, 0]]), dc)
  }
  return q.geometry()
}

const vcm = () => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.3, side: THREE.DoubleSide })

/** inland bulk carrier. params: { L, B, hull, cargo, seed } */
export function cargoShip(p = {}) {
  const L = p.L ?? 72
  const B = p.B ?? 12.6
  const hullC = new THREE.Color(p.hull || '#1f2a38')
  const red = new THREE.Color('#6e2a22')
  const root = new THREE.Group()
  root.name = 'cargoShip'
  const hull = new THREE.Mesh(hullGeo(L, B, [[-3.2, 0.82, red], [-0.15, 0.97, new THREE.Color('#d8d8d2')], [0.2, 1, hullC], [2.6, 1.02, hullC]]), vcm())
  hull.castShadow = hull.receiveShadow = true
  root.add(hull)
  // bulwark, hatch coamings with covers / open cargo
  const h0 = 2.6
  root.add(box(0.2, 0.9, L * 0.62, colorMat(p.hull || '#1f2a38', 0.6, 0.3), { x: B / 2 - 0.15, y: h0 + 0.45, z: L * 0.05 }), box(0.2, 0.9, L * 0.62, colorMat(p.hull || '#1f2a38', 0.6, 0.3), { x: -B / 2 + 0.15, y: h0 + 0.45, z: L * 0.05 }))
  const nh = 4
  const hl = (L * 0.6) / nh
  for (let i = 0; i < nh; i++) {
    const z = -L * 0.2 + hl / 2 + i * hl + L * 0.05
    root.add(box(B - 3.2, 1.2, hl - 1.6, colorMat('#5d6b4f', 0.6, 0.3), { y: h0 + 0.6, z }))
    if (p.cargo === 'sand') root.add(cone(Math.min(B - 3.6, hl - 2) / 2 * 1.3, 1.6, mat('sand'), { y: h0 + 1.2, z, seg: 10 }))
    else root.add(box(B - 3.0, 0.4, hl - 1.4, colorMat(i % 2 ? '#3f5a73' : '#46637d', 0.5, 0.4), { y: h0 + 1.4, z }))
  }
  // aft accommodation: 3 tiers + wheelhouse with bridge wings, funnel, mast
  const ac = -L / 2 + 6.5
  const white = mat('paint.white')
  const win = lightMat('#ffd9a0', 1.6, 'windows')
  for (let t = 0; t < 3; t++) {
    const w = B - 2 - t * 1.2
    root.add(box(w, 2.4, 8 - t * 0.8, white, { y: h0 + 1.2 + t * 2.5, z: ac }))
    root.add(box(w + 0.02, 0.7, 0.05, t === 2 ? mat('glass.dark') : win, { y: h0 + 1.5 + t * 2.5, z: ac + (8 - t * 0.8) / 2 + 0.02, cast: false }))
  }
  root.add(box(B + 1.6, 2.2, 4, white, { y: h0 + 8.8, z: ac + 1 }), box(B + 1.62, 0.9, 0.05, mat('glass.dark'), { y: h0 + 9.2, z: ac + 3.02, cast: false }))
  root.add(box(2.2, 4.2, 2.6, colorMat('#2a2d31', 0.5, 0.3), { y: h0 + 9, z: ac - 3.2 }), box(2.25, 0.8, 2.65, mat('paint.red'), { y: h0 + 10.6, z: ac - 3.2 }))
  root.add(cyl(0.14, 0.14, 6, mat('paint.white'), { base: true, y: h0 + 9.9, z: ac + 1 }), box(2.6, 0.12, 0.3, mat('steel.dark'), { y: h0 + 13.4, z: ac + 1 }))
  root.add(cyl(0.12, 0.12, 7, mat('paint.white'), { base: true, y: h0, z: L / 2 - 6 }))
  // nav lights: masthead white, port red, starboard green (always on)
  root.add(box(0.3, 0.3, 0.3, glowMat('#fff4dc', 3), { y: h0 + 16, z: ac + 1, cast: false }), box(0.3, 0.3, 0.3, glowMat('#ff2a1a', 3), { x: -B / 2 - 0.8, y: h0 + 9, z: ac + 2.6, cast: false }), box(0.3, 0.3, 0.3, glowMat('#20ff6a', 3), { x: B / 2 + 0.8, y: h0 + 9, z: ac + 2.6, cast: false }))
  bakeTree(root)
  return { object: root, rig: { root, hull } }
}

/** 200 t floating crane barge: pontoon, deckhouse, slewing crane with luffing lattice boom */
export function floatingCrane() {
  const root = new THREE.Group()
  root.name = 'floatingCrane'
  const grey = colorMat('#5b6670', 0.55, 0.4)
  root.add(box(18, 3.6, 40, grey, { y: 0.6 }), box(18.1, 0.5, 40.1, colorMat('#6e2a22', 0.6, 0.2), { y: -0.95 }))
  root.add(box(10, 3.2, 8, mat('paint.white'), { base: true, y: 2.4, z: -15 }), box(10.02, 0.8, 0.05, mat('glass.dark'), { y: 4.4, z: -10.98 }))
  for (const [x, z] of [[-8.4, 18], [8.4, 18], [-8.4, -18], [8.4, -18]]) root.add(cyl(0.6, 0.6, 9, mat('paint.yellow'), { base: true, x, y: -6, z, seg: 10 }))
  const slew = group()
  slew.userData.dynamic = true
  slew.position.set(0, 2.4, 9)
  const y = mat('paint.orange')
  slew.add(cyl(3.6, 3.6, 1.2, mat('paint.dark'), { base: true, seg: 24 }), box(8, 4.5, 10, y, { base: true, y: 1.2, z: -2 }), box(3, 3, 3, mat('glass.dark'), { base: true, x: -3.2, y: 1.6, z: 3.8 }))
  // A-frame
  for (const x of [-2.8, 2.8]) { const a = box(0.6, 12, 0.6, y, { x, y: 7, z: -4 }); a.rotation.x = 0.35; slew.add(a) }
  const boom = group()
  boom.userData.dynamic = true
  boom.position.set(0, 3, 3)
  const jib = new THREE.Mesh(jibGeo(46, 2.4, 2.6, 3.2, 0.24), y)
  jib.castShadow = true
  jib.userData.keep = true
  boom.add(jib)
  const tip = group()
  tip.position.set(0, 1.3, 46)
  boom.add(tip)
  slew.add(boom)
  const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1, 5).translate(0, -0.5, 0), mat('steel.dark'))
  rope.userData.keep = true
  const hook = group(box(1.4, 1.6, 1.0, mat('paint.yellow'), { y: -0.8 }))
  hook.userData.dynamic = true
  const load = group(box(1.6, 0.9, 12, colorMat('#4c4035', 0.6, 0.6), { y: -3.4 }))
  load.userData.dynamic = true
  hook.add(load)
  const aTop = group()
  aTop.position.set(0, 12.6, -6)
  slew.add(aTop)
  const pendant = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1, 4).translate(0, 0.5, 0), mat('steel.dark'))
  pendant.userData.keep = true
  root.add(slew, rope, hook, pendant)
  bakeTree(root)
  return { object: root, rig: { root, slew, boom, tip, rope, hook, load, aTop, pendant } }
}

/** steel material barge loaded with sheet-pile bundles */
export function materialBarge() {
  const root = new THREE.Group()
  root.add(box(12, 2.8, 30, colorMat('#4d555c', 0.6, 0.4), { y: 0.3 }))
  for (let i = 0; i < 6; i++) root.add(box(1.4, 0.8, 12, colorMat('#4c4035', 0.6, 0.6), { x: -3.6 + (i % 3) * 3.6, y: 2.1 + Math.floor(i / 3) * 0.85, z: -4 }))
  root.add(box(4, 2.2, 4, mat('paint.white'), { y: 2.8, z: 11 }))
  bakeTree(root)
  return { object: root, rig: {} }
}

/** channel buoy: color 'red' (port, can) | 'green' (starboard, cone) with a flashing light */
export function buoy(p = {}) {
  const red = p.color !== 'green'
  const c = red ? mat('paint.red') : mat('paint.green')
  const root = group(cyl(0.9, 1.1, 1.6, c, { base: true, y: -0.8, seg: 16 }), cyl(0.15, 0.15, 2.6, c, { base: true, y: 0.8 }))
  root.add(red ? cyl(0.5, 0.5, 0.9, c, { base: true, y: 3.0 }) : cone(0.6, 1.0, c, { base: true, y: 3.0 }))
  const lamp = new THREE.MeshStandardMaterial({ color: '#111', emissive: red ? '#ff2a1a' : '#30ff70', emissiveIntensity: 0 })
  lamp.userData.live = true
  root.add(box(0.25, 0.3, 0.25, lamp, { y: 4.2, cast: false }))
  return { object: root, rig: { root, lamp } }
}
