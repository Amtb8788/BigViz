// Bridge pack - rhombic form traveller (菱形挂篮) for balanced-cantilever casting. Local frame:
// origin = front cross-beam station at deck level, +x toward the pier (backward), y up, z across.
// Twin red rhombic trusses over the webs, front / rear upper cross beams, hanger rods, the
// suspended bottom basket (tilts with the soffit), outer side forms, front work platform and the
// rebar cage of the segment being tied. works.js poses it (setSegment / setPhase).

import * as THREE from 'three'
import { mat, lightMat } from '../../render/materials.js'
import { box, cyl, group, bakeTree } from '../../prefabs/kit.js'
import { makeCanvas } from '../../render/textures.js'

const TZ = [-3.7, 3.7]

/** thin bar between (x0, y0) and (x1, y1) at z */
function bar(x0, y0, x1, y1, z, t, m) {
  const len = Math.hypot(x1 - x0, y1 - y0)
  const b = box(len, t, t, m, { x: (x0 + x1) / 2, y: (y0 + y1) / 2, z })
  b.rotation.z = Math.atan2(y1 - y0, x1 - x0)
  return b
}

let cageMat
function rebarMat() {
  if (cageMat) return cageMat
  const c = makeCanvas(128)
  const g = c.getContext('2d')
  g.clearRect(0, 0, 128, 128)
  g.strokeStyle = '#6a4330'
  g.lineWidth = 5
  for (let i = 0; i <= 128; i += 32) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 128); g.moveTo(0, i); g.lineTo(128, i); g.stroke() }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(4, 4)
  cageMat = new THREE.MeshStandardMaterial({ map: t, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.75, metalness: 0.5 })
  return cageMat
}

/** unit cylinder hanging down from its top (scale.y = length) */
const hanger = (x, z, m) => {
  const h = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1, 6).translate(0, -0.5, 0), m)
  h.position.set(x, 0, z)
  h.castShadow = true
  h.userData.keep = true
  return h
}

export function formTraveller() {
  const root = new THREE.Group()
  root.name = 'formTraveller'
  const red = mat('paint.red')
  const dark = mat('steel.dark')
  const frame = group()
  // rhombic main trusses: A front (0, 0.5), B top (4.5, 5.5), C rear (9, 0.5), D lower (4.5, -0.1)
  for (const z of TZ) {
    frame.add(bar(0, 0.6, 4.5, 5.6, z, 0.45, red), bar(4.5, 5.6, 9.2, 0.6, z, 0.45, red), bar(0, 0.6, 4.5, 0.2, z, 0.4, red), bar(4.5, 0.2, 9.2, 0.6, z, 0.4, red), bar(4.5, 0.2, 4.5, 5.6, z, 0.35, red))
    frame.add(box(10.6, 0.35, 0.5, dark, { x: 4.6, y: 0.18, z }))
    frame.add(box(0.6, 0.3, 0.6, mat('paint.yellow'), { x: 9.6, y: 0.35, z }))
  }
  for (const [x, y] of [[4.5, 5.6], [2.2, 3.1], [6.8, 3.1]]) frame.add(box(0.3, 0.3, TZ[1] - TZ[0], red, { x, y, z: 0 }))
  frame.add(bar(2.2, 3.1, 4.5, 5.6, 0, 0.18, red))
  // front / rear upper cross beams
  frame.add(box(0.7, 0.9, 13.4, red, { x: -0.1, y: 1.05, z: 0 }), box(0.6, 0.7, 10.4, red, { x: 9.3, y: 0.95, z: 0 }))
  // jacks on the front beam, lamps
  for (const z of [-4.5, -2.6, 2.6, 4.5]) frame.add(cyl(0.16, 0.16, 0.6, dark, { base: true, x: -0.1, y: 1.5, z }))
  const lamp = lightMat('#fff1d0', 5, 'site')
  for (const z of [-5.5, 5.5]) frame.add(box(0.5, 0.35, 0.5, dark, { x: -0.4, y: 2.0, z }), box(0.46, 0.3, 0.06, lamp, { x: -0.68, y: 2.0, z, cast: false }))
  root.add(frame)

  // hangers: front pairs outside the webs, rear pairs through the cast bottom slab
  const steel = mat('steel')
  const front = [-4.4, -3.2, 3.2, 4.4].map((z) => hanger(-0.1, z, steel))
  const rear = [-3.2, 3.2].map((z) => hanger(4.6, z, steel))
  for (const h of [...front, ...rear]) root.add(h)

  // bottom basket (pivot at the front hanger line, soffit level)
  const basket = group()
  basket.userData.dynamic = true
  basket.add(box(7.4, 0.5, 9.6, red, { x: 3.3, y: -0.45 }))
  for (const z of [-4.4, -2.2, 0, 2.2, 4.4]) basket.add(box(7.6, 0.35, 0.25, dark, { x: 3.3, y: -0.85, z }))
  basket.add(box(7.4, 0.06, 10.2, mat('plywood'), { x: 3.3, y: -0.17 }))
  basket.add(box(0.5, 0.7, 11.2, red, { x: -0.3, y: -0.9 }), box(0.5, 0.7, 11.2, red, { x: 6.9, y: -0.9 }))
  const net = mat('net')
  basket.add(box(7.6, 1.5, 0.05, net, { x: 3.3, y: 0.55, z: 5.1, cast: false }), box(7.6, 1.5, 0.05, net, { x: 3.3, y: 0.55, z: -5.1, cast: false }), box(0.05, 1.5, 10.2, net, { x: -0.5, y: 0.55, cast: false }))
  for (const z of [5.0, -5.0]) basket.add(box(7.6, 0.06, 0.06, mat('paint.yellow'), { x: 3.3, y: 1.25, z }))
  root.add(basket)

  // outer side forms (scaled to the segment), deck-level front platform, rebar cage
  const forms = group()
  forms.userData.dynamic = true
  const fm = mat('steel')
  const webs = TZ.map((z) => box(1, 1, 0.12, fm, { z: z + Math.sign(z) * 0.55 }))
  const wings = TZ.map((z) => box(1, 0.12, 4.0, fm, { z: Math.sign(z) * 6.2, y: -0.45 }))
  const ribs = []
  for (const z of TZ) for (let i = 0; i < 4; i++) ribs.push(box(0.14, 1, 0.3, dark, { z: z + Math.sign(z) * 0.75 }))
  for (const o of [...webs, ...wings, ...ribs]) forms.add(o)
  root.add(forms)
  const plat = group(box(1.6, 0.08, 16.6, mat('plywood'), { x: -1.2, y: -0.05 }), box(0.06, 1.1, 16.6, net, { x: -2.0, y: 0.5, cast: false }), box(0.06, 0.06, 16.6, mat('paint.yellow'), { x: -2.0, y: 1.1 }))
  root.add(plat)
  const cage = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), rebarMat())
  cage.userData.keep = true
  cage.visible = false
  root.add(cage)

  bakeTree(root)
  const rig = { root, basket, forms, cage, front, rear, segLen: 3 }
  /** pose for a segment: len (m), depth at the new tip hF and old tip hR (girder depths) */
  rig.setSegment = (len, hF, hR) => {
    rig.segLen = len
    for (const h of front) h.scale.y = hF + 0.2 - (Math.abs(h.position.z) > 4 ? 0.0 : 0.0)
    for (const h of rear) { h.position.x = len + 0.3; h.scale.y = hR + 0.2 }
    basket.position.set(0, -hF - 0.05, 0)
    basket.rotation.z = Math.atan2(hR - hF, len)
    basket.scale.x = Math.max(0.8, (len + 1.2) / 6.6)
    webs.forEach((w) => { w.scale.set(len, hF - 1.0, 1); w.position.set(len / 2, -(hF - 1.0) / 2 - 0.9, w.position.z) })
    wings.forEach((w) => { w.scale.x = len; w.position.x = len / 2 })
    ribs.forEach((r, i) => { const k = i % 4; r.position.x = 0.3 + (k * (len - 0.6)) / 3; r.scale.y = hF - 1.0; r.position.y = -(hF - 1.0) / 2 - 0.9 })
    cage.scale.set(len * 0.98, hF - 0.3, 7.6)
    cage.position.set(len / 2, -hF / 2 + 0.05, 0)
  }
  /** phase flags: cage (rebar tied, not yet poured), forms (side forms closed) */
  rig.setPhase = ({ cage: c = false, forms: f = true } = {}) => { cage.visible = c; forms.visible = f }
  rig.setSegment(3, 7.6, 8.5)
  return { object: root, rig }
}
