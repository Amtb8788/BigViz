// Realistic-style street furniture (same PROPS keys / params as props.js). Plain-colour parts
// fold into the bucket's vertex-colour batch, so extra detail costs triangles, not draw calls.
// Glass is one merged transparent mesh per shelter; the ad board is one emissive canvas.

import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { mat, colorMat, lightMat } from '../render/materials.js'
import { makeCanvas } from '../render/textures.js'
import { box, cyl, sphere, group, rod } from './kit.js'

const V = (x, y, z) => new THREE.Vector3(x, y, z)
const pole = () => colorMat('#4b5157', 0.45, 0.7)
const steel = () => colorMat('#a9afb3', 0.3, 0.9)

/** road lamp: tapered galvanised pole, curved outreach arm, flat LED head (h ~ 9 m) */
function streetLight({ h = 6.5, arm = 1.8 } = {}) {
  // scene heights were toy scale (6.5 m road, 5 m plaza): road -> 9 m, plaza -> 4.5 m post-top
  if (h <= 5) return parkLight({ h: 4.5 })
  const H = Math.max(8.5, h * 1.4)
  const A = Math.max(2.2, arm * 1.3)
  const P = pole()
  const g = group(
    cyl(0.07, 0.13, H, P, { base: true, seg: 10 }),
    cyl(0.2, 0.22, 0.5, P, { base: true, seg: 10 }),
    box(0.16, 0.5, 0.08, colorMat('#6b7075', 0.5, 0.5), { y: 1.1, z: 0.12 })
  )
  // arm: rises then reaches out (rod segments along a bend)
  const pts = [V(0, H - 0.6, 0), V(0, H, 0.35), V(0, H + 0.2, A * 0.55), V(0, H + 0.25, A)]
  for (let i = 0; i < pts.length - 1; i++) g.add(rod(pts[i], pts[i + 1], 0.045, P, 6))
  g.add(box(0.36, 0.1, 0.8, colorMat('#5a6066', 0.4, 0.6), { y: H + 0.22, z: A + 0.25 }))
  g.add(box(0.3, 0.03, 0.66, lightMat('#f4ecdc', 3.2, 'street'), { y: H + 0.155, z: A + 0.25, cast: false }))
  return { object: g, glows: [{ pos: V(0, H, A + 0.25), group: 'street', color: '#ffe7c2', size: 3.6, pool: 6 }] }
}

/** plaza post-top lantern */
function parkLight({ h = 4.5 } = {}) {
  const P = colorMat('#30353a', 0.5, 0.6)
  const g = group(
    cyl(0.06, 0.09, h, P, { base: true, seg: 10 }),
    cyl(0.13, 0.15, 0.4, P, { base: true, seg: 10 }),
    cyl(0.24, 0.12, 0.12, P, { y: h + 0.06, seg: 12 }),
    cyl(0.2, 0.2, 0.32, lightMat('#ffe2b0', 2.6, 'street'), { y: h + 0.28, seg: 12, cast: false }),
    cyl(0.28, 0.22, 0.08, P, { y: h + 0.48, seg: 12 })
  )
  return { object: g, glows: [{ pos: V(0, h + 0.28, 0), group: 'street', color: '#ffd9a0', size: 2.6, pool: 4 }] }
}

let adMat = null
function adBoard() {
  if (adMat) return adMat
  const c = makeCanvas(256, 384)
  const x = c.getContext('2d')
  const g = x.createLinearGradient(0, 0, 0, 384)
  g.addColorStop(0, '#2a5d8f')
  g.addColorStop(1, '#e9b04a')
  x.fillStyle = g
  x.fillRect(0, 0, 256, 384)
  x.fillStyle = 'rgba(255,255,255,0.85)'
  x.beginPath(); x.arc(128, 170, 70, 0, Math.PI * 2); x.fill()
  x.fillStyle = '#ffffff'
  x.font = 'bold 40px sans-serif'
  x.textAlign = 'center'
  x.fillText('城市新生活', 128, 60)
  x.font = '24px sans-serif'
  x.fillText('ZC TOWER 即将启幕', 128, 320)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  adMat = new THREE.MeshStandardMaterial({ map: t, emissiveMap: t, emissive: '#ffffff', emissiveIntensity: 0.15, roughness: 0.25, name: 'busStop.ad' })
  return adMat
}

/** cantilever bus shelter: steel frame, merged glass panels, lit ad box, perforated bench */
function busStop() {
  const F = colorMat('#3b4046', 0.4, 0.75)
  const g = group(
    box(4.4, 0.14, 1.9, F, { y: 2.65, z: -0.05 }),
    box(4.4, 0.3, 0.06, F, { y: 2.55, z: 0.9 }),
    box(4.3, 0.04, 1.8, colorMat('#e8e6df', 0.6), { y: 2.57, z: -0.05, cast: false }),
    box(1.6, 0.04, 0.4, lightMat('#f2f0ea', 1.6, 'street'), { y: 2.55, z: -0.1, cast: false }),
    box(3.0, 0.05, 0.42, steel(), { y: 0.46, z: -0.45 }),
    box(3.0, 0.3, 0.04, steel(), { y: 0.7, z: -0.68 })
  )
  for (const x of [-2.05, 0, 2.05]) g.add(box(0.12, 2.65, 0.12, F, { base: true, x, z: -0.8 }))
  for (const x of [-1.3, 1.3]) g.add(box(0.06, 0.46, 0.38, F, { base: true, x, z: -0.45 }))
  // glass: back (2 panes) + one side pane, one transparent mesh
  const panes = [
    new THREE.BoxGeometry(1.95, 2.0, 0.03).translate(-1.02, 1.35, -0.8),
    new THREE.BoxGeometry(1.95, 2.0, 0.03).translate(1.02, 1.35, -0.8),
    new THREE.BoxGeometry(0.03, 2.0, 1.2).translate(2.05, 1.35, -0.15)
  ]
  const glass = new THREE.Mesh(mergeGeometries(panes), mat('glass'))
  glass.receiveShadow = true
  g.add(glass)
  // ad light box at the open end + route sign post
  g.add(box(0.22, 2.1, 1.3, F, { base: true, x: -2.3, y: 0.1, z: -0.15 }))
  const ad = new THREE.Mesh(new THREE.PlaneGeometry(1.15, 1.85), adBoard())
  ad.position.set(-2.42, 1.15, -0.15)
  ad.rotation.y = -Math.PI / 2
  g.add(ad)
  g.add(cyl(0.04, 0.04, 3, F, { base: true, x: 2.6, z: 0.6 }), box(0.04, 0.9, 0.5, colorMat('#1f5fa0', 0.4), { x: 2.6, y: 2.5, z: 0.6 }))
  return { object: g, glows: [{ pos: V(0, 2.4, -0.1), group: 'street', color: '#f4f1e8', size: 2.2, pool: 3 }] }
}

/** sorting bin: recyclable (blue) + other (grey) on a steel base */
function trashBin() {
  const g = group(box(0.95, 0.08, 0.5, steel(), { base: true }))
  for (const [x, c] of [[-0.23, '#2c5d97'], [0.23, '#5b6066']]) {
    const m = colorMat(c, 0.45, 0.25)
    g.add(box(0.44, 0.82, 0.44, m, { base: true, x, y: 0.08, round: 0.03 }))
    g.add(box(0.46, 0.06, 0.46, m, { x, y: 0.93 }))
    g.add(box(0.26, 0.1, 0.02, colorMat('#15181b', 0.6), { x, y: 0.75, z: 0.225, cast: false }))
    g.add(box(0.2, 0.2, 0.01, colorMat('#f2f2ee', 0.5), { x, y: 0.45, z: 0.226, cast: false }))
  }
  return { object: g }
}

/** park bench: cast-iron ends, 5 seat + 3 back slats */
function bench() {
  const T = mat('timber')
  const I = colorMat('#2a2d30', 0.5, 0.6)
  const g = group()
  for (let i = 0; i < 5; i++) g.add(box(1.8, 0.04, 0.085, T, { y: 0.45, z: 0.2 - i * 0.1 }))
  for (let i = 0; i < 3; i++) g.add(box(1.8, 0.085, 0.035, T, { y: 0.6 + i * 0.12, z: -0.27, rx: -0.15 }))
  for (const x of [-0.8, 0.8]) {
    g.add(box(0.06, 0.44, 0.06, I, { base: true, x, z: 0.2 }), box(0.06, 0.88, 0.06, I, { base: true, x, z: -0.25 }))
    g.add(box(0.06, 0.05, 0.55, I, { x, y: 0.43 }), box(0.06, 0.05, 0.45, I, { x, y: 0.68, z: 0 }))
  }
  return { object: g }
}

/** stainless bollard with reflective band */
function bollard() {
  const S = steel()
  return { object: group(cyl(0.1, 0.1, 0.85, S, { base: true, seg: 12 }), sphere(0.1, S, { y: 0.85, hemi: true, seg: 12 }), cyl(0.102, 0.102, 0.06, colorMat('#e9e7e0', 0.3), { y: 0.68, seg: 12 }), cyl(0.102, 0.102, 0.06, colorMat('#e9e7e0', 0.3), { y: 0.58, seg: 12 })) }
}

/** pit-edge railing: red/white striped tube rails, posts every 2 m, toe board */
function guardrail({ len = 6 } = {}) {
  const R = colorMat('#b3312a', 0.5, 0.2)
  const W = colorMat('#e3e2dc', 0.5, 0.1)
  const g = group()
  const n = Math.max(2, Math.round(len / 0.5))
  const s = len / n
  for (let i = 0; i < n; i++) {
    const x = -len / 2 + (i + 0.5) * s
    const m = i % 2 ? R : W
    g.add(cyl(0.024, 0.024, s, m, { axis: 'x', x, y: 1.2, seg: 6 }), cyl(0.024, 0.024, s, m, { axis: 'x', x, y: 0.6, seg: 6 }), box(s, 0.18, 0.02, m, { base: true, x }))
  }
  for (let x = -len / 2; x <= len / 2 + 0.01; x += 2) g.add(cyl(0.024, 0.024, 1.2, R, { base: true, x, seg: 6 }))
  return { object: g }
}

export const STREET = { streetLight, busStop, trashBin, bench, bollard, guardrail }
