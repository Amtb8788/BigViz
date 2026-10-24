// Shared parts for the realistic machine / vehicle variants: decal atlas (logo, hazard and
// red-white stripes, model plate, number plate), rubber tyres on rims, axles, lamps.
// Everything here is plain-colour (folds into vertex-colour batches) or the one decal material.

import * as THREE from 'three'
import { colorMat, mat, lightMat } from '../render/materials.js'
import { makeCanvas } from '../render/textures.js'
import { box, cyl, lathe, pivot, dynamic, detail } from './kit.js'

// ---------------------------------------------------------------- decal atlas (one material)
// rows (v from top): logo | hazard yellow/black | red/white | plates
const ROWS = { logo: 0, hazard: 1, redwhite: 2, model: 3, plate: 3 }
let atlasMat
export function decalMat() {
  if (atlasMat) return atlasMat
  const c = makeCanvas(1024, 512)
  const x = c.getContext('2d')
  x.fillStyle = '#f4f4f0'; x.fillRect(0, 0, 1024, 128)
  x.fillStyle = '#1f3c6e'; x.fillRect(0, 0, 150, 128)
  x.fillStyle = '#f4f4f0'; x.font = 'bold 72px sans-serif'; x.textBaseline = 'middle'; x.fillText('ZC', 22, 66)
  x.fillStyle = '#1f3c6e'; x.font = 'bold 76px sans-serif'; x.fillText('筑城建工', 190, 66)
  x.font = '30px sans-serif'; x.fillText('ZHUCHENG', 800, 66)
  const stripes = (y, a, b) => {
    x.fillStyle = a; x.fillRect(0, y, 1024, 128)
    x.fillStyle = b
    for (let i = -128; i < 1024 + 128; i += 64) { x.beginPath(); x.moveTo(i, y + 128); x.lineTo(i + 32, y + 128); x.lineTo(i + 160, y); x.lineTo(i + 128, y); x.fill() }
  }
  stripes(128, '#e3b221', '#1b1b1b')
  stripes(256, '#f2f2ee', '#c42a22')
  x.fillStyle = '#262a2e'; x.fillRect(0, 384, 512, 128)
  x.fillStyle = '#e8e8e2'; x.font = 'bold 70px sans-serif'; x.fillText('ZC 320', 40, 450)
  x.fillStyle = '#e0b42a'; x.fillRect(560, 392, 440, 112)
  x.strokeStyle = '#1b1b1b'; x.lineWidth = 6; x.strokeRect(566, 398, 428, 100)
  x.fillStyle = '#1b1b1b'; x.font = 'bold 66px sans-serif'; x.fillText('沪C·D0721', 590, 450)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  atlasMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.55, metalness: 0.1, polygonOffset: true, polygonOffsetFactor: -2, name: 'decals' })
  return atlasMat
}

const decalGeo = new Map()
/**
 * Flat decal facing +z (rotate to place). kind: logo | hazard | redwhite | model | plate.
 * Stripe rows repeat every 2.4 m; longer strips just stretch.
 */
export function decal(kind, w, h, p = {}) {
  const key = `${kind}:${w}:${h}`
  if (!decalGeo.has(key)) {
    const g = new THREE.PlaneGeometry(w, h)
    const row = ROWS[kind] ?? 0
    const v0 = 1 - (row + 1) / 4
    const v1 = 1 - row / 4
    const u1 = kind === 'hazard' || kind === 'redwhite' ? Math.min(1, w / 2.4) : 1
    const [ua, ub] = kind === 'model' ? [0, 0.5] : kind === 'plate' ? [0.545, 0.98] : [0, u1]
    const uv = g.attributes.uv
    for (let i = 0; i < uv.count; i++) uv.setXY(i, ua + uv.getX(i) * (ub - ua), v0 + uv.getY(i) * (v1 - v0))
    decalGeo.set(key, g)
  }
  const m = new THREE.Mesh(decalGeo.get(key), decalMat())
  m.position.set(p.x || 0, p.y || 0, p.z || 0)
  if (p.ry) m.rotation.y = p.ry
  if (p.rx) m.rotation.x = p.rx
  m.castShadow = false
  m.receiveShadow = true
  return m
}
// ---------------------------------------------------------------- tyres / wheels
export const RUBBER = () => colorMat('#1d1e20', 0.88)
const RIM = () => colorMat('#c9ccc8', 0.45)
const HUBC = () => colorMat('#5a5e62', 0.5)

function tyrePts(r, w) {
  const h = w / 2
  const ri = r * 0.6
  const pts = [[ri, -h * 0.92], [r * 0.9, -h], [r * 0.97, -h * 0.9], [r, -h * 0.7]]
  if (detail() !== 'low') pts.push([r, -h * 0.2], [r * 0.975, -h * 0.17], [r * 0.975, -h * 0.03], [r, 0], [r, h * 0.2])
  pts.push([r, h * 0.7], [r * 0.97, h * 0.9], [r * 0.9, h], [ri, h * 0.92])
  return pts.map(([a, b]) => [+a.toFixed(3), +b.toFixed(3)])
}

/**
 * Wheel centred at the origin rolling about x. side +1 / -1 puts the rim face outward.
 * dual: twin tyres (truck rear axles). Returns a dynamic group (animator spins rotation.x).
 */
export function tyre(r, w = 0.32, { side = 1, dual = false } = {}) {
  const g = new THREE.Group()
  const seg = detail() === 'low' ? 12 : 20
  const offs = dual ? [-w * 0.52, w * 0.52] : [0]
  for (const o of offs) g.add(lathe(tyrePts(r, w), RUBBER(), { axis: 'x', seg, x: o, cast: true }))
  const span = dual ? w * 1.04 + w * 0.84 : w * 0.84
  const face = side * (span / 2 + 0.01)
  g.add(cyl(r * 0.6, r * 0.6, span, RIM(), { axis: 'x', seg: seg - 4, cast: false }))
  g.add(cyl(r * 0.24, r * 0.3, 0.06, HUBC(), { axis: 'x', seg: 10, x: face, cast: false }))
  if (detail() !== 'low') g.add(cyl(r * 0.42, r * 0.42, 0.02, HUBC(), { axis: 'x', seg: 12, x: face - side * 0.02, cast: false }))
  return dynamic(g)
}

/**
 * Axle: two wheels (+ beam). steer: wheels go into 'steer' pivots (rig.steer).
 * Wheels are pushed to rig.wheels.
 */
export function axle(root, rig, { z, track, r, w = 0.32, dual = false, steer = false, y = r }) {
  for (const s of [1, -1]) {
    const wh = tyre(r, w, { side: s, dual })
    if (steer) {
      const st = dynamic(pivot('steer', s * track / 2, y, z, wh))
      root.add(st)
      rig.steer.push(st)
    } else {
      wh.position.set(s * track / 2, y, z)
      root.add(wh)
    }
    rig.wheels.push(wh)
  }
  root.add(cyl(0.09, 0.09, track - w * 1.6, mat('steel.dark'), { axis: 'x', y, z, seg: 8 }))
  if (!steer) root.add(cyl(0.24, 0.24, 0.32, mat('steel.dark'), { axis: 'x', y, z, seg: 10 }))
}

/** Headlamp cluster: emissive lens + dark housing; s = side (+1 left) */
export function headlamp(root, x, y, z, w = 0.28, h = 0.16) {
  root.add(box(w + 0.04, h + 0.04, 0.06, colorMat('#2a2c2e', 0.5), { x, y, z: z - 0.02, cast: false }))
  root.add(box(w, h, 0.04, lightMat('#fff1cf', 3.2, 'vehicle'), { x, y, z: z + 0.01, cast: false }))
}
