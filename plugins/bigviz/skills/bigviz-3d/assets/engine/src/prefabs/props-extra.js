// More site props: workstations, gates, banners, wheel wash, ceremony items, and the
// variable-driven stock pile (shows N items from a world var, e.g. stock.pallet).

import * as THREE from 'three'
import { mat, colorMat, lightMat } from '../render/materials.js'
import { labelTexture } from '../render/sheets.js'
import { box, cyl, cone, group, dynamic, bake } from './kit.js'
import { pallet } from './vehicles.js'
import { PROPS } from './props.js'

function textPlane(text, w, h, o) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: labelTexture(text, o), roughness: 0.6, side: THREE.DoubleSide }))
  m.castShadow = true
  return m
}

Object.assign(PROPS, {
  banner: ({ text = '安全第一 质量为本', bg = '#1f5fbf', fg = '#ffffff', w = 7, h = 1.1 } = {}) => {
    const p = textPlane(text, w, h, { bg, fg, w: 1024, h: 160, font: 'bold 96px sans-serif' })
    p.position.y = h / 2 + 0.4
    p.position.z = 0.08
    return { object: group(p) }
  },
  bendingTable: () => {
    const g = group(box(3, 0.9, 1.1, mat('steel.dark'), { base: true }), box(3.1, 0.08, 1.2, mat('steel'), { y: 0.9 }))
    for (let i = 0; i < 5; i++) g.add(cyl(0.03, 0.03, 2.4, mat('rebar'), { axis: 'x', y: 0.98, z: -0.4 + i * 0.18 }))
    g.add(box(0.5, 0.4, 0.5, mat('paint.blue'), { base: true, x: 1.1, y: 0.94 }))
    return { object: g }
  },
  sawBench: () => ({ object: group(box(2.4, 0.85, 1, mat('timber'), { base: true }), cyl(0.3, 0.3, 0.03, mat('steel'), { axis: 'z', y: 1.05 }), box(0.5, 0.3, 0.4, mat('paint.red'), { base: true, x: 0.8, y: 0.85 })) }),
  mortarMixer: () => {
    const drum = cyl(0.55, 0.7, 0.9, mat('paint.orange'), { x: 0, y: 1, rx: 0.9 })
    return { object: group(box(1.2, 0.5, 1, mat('steel.dark'), { base: true }), drum, cyl(0.25, 0.25, 0.15, mat('rubber'), { axis: 'x', x: 0.65, y: 0.25 }), cyl(0.25, 0.25, 0.15, mat('rubber'), { axis: 'x', x: -0.65, y: 0.25 })) }
  },
  weldBench: () => ({ object: group(box(2, 0.8, 1, mat('steel.dark'), { base: true }), box(0.8, 0.9, 0.6, mat('paint.blue'), { base: true, x: -1.6 }), cyl(0.18, 0.18, 1.2, mat('paint.green'), { base: true, x: -2.3 })) }),
  gate: ({ w = 8, open = true } = {}) => {
    const g = group()
    for (const s of [1, -1]) {
      g.add(box(0.4, 3, 0.4, mat('paint.dark'), { base: true, x: s * (w / 2 + 0.3) }))
      const leaf = box(w / 2, 2.4, 0.1, mat('fence.blue'), { base: true, x: s * (w / 2 + (open ? w / 4 + 0.5 : -w / 4)), z: open ? -0.6 : 0 })
      g.add(leaf)
    }
    const sign = textPlane('ZC 筑城建工 · 施工现场', w + 1.2, 0.9, { bg: '#1f3c6e', fg: '#ffffff', w: 1024, h: 120, font: 'bold 70px sans-serif' })
    sign.position.set(0, 3.5, 0)
    g.add(sign, box(w + 1.2, 0.12, 0.3, mat('paint.dark'), { y: 3.02 }))
    return { object: g, glows: [{ pos: new THREE.Vector3(0, 3.3, 0.6), group: 'site', color: '#fff0c0', size: 2.6, pool: 4 }] }
  },
  wheelWash: () => {
    const g = group(box(4.5, 0.25, 6, mat('concrete.fresh'), { base: true }))
    for (let i = 0; i < 9; i++) g.add(box(4, 0.06, 0.12, mat('steel'), { y: 0.26, z: -2.6 + i * 0.65 }))
    g.add(box(4.2, 0.05, 5.6, mat('water'), { y: 0.12, cast: false }))
    g.add(box(0.6, 1.4, 0.6, mat('paint.blue'), { base: true, x: 2.8, z: -2.5 }))
    return { object: g }
  },
  shed: ({ w = 6, d = 4 } = {}) => {
    const g = group(box(w, 0.08, d, mat('paint.blue'), { y: 3, rx: 0.06 }))
    for (const [x, z] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) g.add(box(0.12, 3, 0.12, mat('steel'), { base: true, x: (x * w) / 2.1, z: (z * d) / 2.1 }))
    return { object: g, glows: [{ pos: new THREE.Vector3(0, 2.9, 0), group: 'site', color: '#fff2d0', size: 1.6, pool: 3 }] }
  },
  carpet: ({ len = 10 } = {}) => ({ object: group(box(2.2, 0.04, len, colorMat('#b5202b', 0.9), { base: true })) }),
  ceremonyArch: ({ text = '竣工大吉 · 筑城之间' } = {}) => {
    const g = group()
    for (const s of [1, -1]) g.add(cyl(0.18, 0.18, 4.4, mat('paint.red'), { base: true, x: s * 4 }))
    const t = textPlane(text, 8.6, 1.2, { bg: '#c9252f', fg: '#ffe08a', w: 1024, h: 150, font: 'bold 92px sans-serif' })
    t.position.y = 4.2
    g.add(t)
    for (let i = 0; i < 8; i++) g.add(cone(0.3, 0.6, colorMat(['#f2c230', '#e0402b', '#3e8a5a', '#2f66b3'][i % 4], 0.5), { x: -3.5 + i, y: 4.9, rx: Math.PI }))
    return { object: g }
  },
  parkingLines: ({ n = 6, w = 2.6, d = 5.2 } = {}) => {
    const g = group()
    for (let i = 0; i <= n; i++) g.add(box(0.12, 0.02, d, mat('marking'), { base: true, x: -((n * w) / 2) + i * w, cast: false }))
    return { object: g }
  },
  zebra: ({ w = 7, len = 4, stripes = 8 } = {}) => {
    const g = group()
    for (let i = 0; i < stripes; i++) g.add(box(0.45, 0.02, len, mat('marking'), { base: true, x: -w / 2 + (i + 0.5) * (w / stripes), cast: false }))
    return { object: g }
  },
  bike: () => ({ object: group(cyl(0.32, 0.32, 0.04, mat('rubber'), { axis: 'x', y: 0.32, z: 0.5 }), cyl(0.32, 0.32, 0.04, mat('rubber'), { axis: 'x', y: 0.32, z: -0.5 }), box(0.05, 0.05, 1, colorMat('#2f66b3', 0.4), { y: 0.6 }), box(0.05, 0.5, 0.05, colorMat('#2f66b3', 0.4), { y: 0.65, z: 0.4 })) }),
  flagPole: ({ color = '#e0402b' } = {}) => ({ object: group(cyl(0.06, 0.06, 8, mat('steel'), { base: true }), box(0.03, 1.2, 1.8, colorMat(color, 0.7), { y: 7.2, z: 0.9 })) }),
  kiosk: () => ({ object: group(box(2.4, 2.6, 2, colorMat('#e9e4da', 0.6), { base: true }), box(2.6, 0.2, 2.4, mat('paint.red'), { y: 2.7 }), box(2, 0.9, 0.05, lightMat('#fff1cf', 1.4, 'street'), { y: 1.6, z: 1.01, cast: false })) })
})

/**
 * Stock pile whose visible item count follows a world variable (rig.setCount from drive).
 * kind: pallet goods kind or 'rebar' | 'form'
 */
export function stockPile({ kind = 'bags', cols = 2, rows = 3, layers = 2 } = {}) {
  const root = new THREE.Group()
  const items = []
  for (let l = 0; l < layers; l++) for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    let it
    if (kind === 'rebar') {
      it = group(...[0, 1, 2, 3, 4, 5].map((i) => cyl(0.05, 0.05, 6, mat('rebar'), { axis: 'z', x: -0.25 + i * 0.1, y: 0.06 })))
      it.position.set(c * 0.9, l * 0.14 + 0.3, r * 0.2)
    } else if (kind === 'form') {
      it = box(1.22, 0.06, 2.44, mat(l % 2 ? 'plywood' : 'formwork'), { base: true })
      it.position.set(c * 1.4, l * 0.07 + 0.16, r * 2.6)
    } else {
      it = pallet(kind)
      it.position.set(c * 1.5, l * 1.0, r * 1.5)
    }
    if (it.isGroup) bake(it, { colors: true })
    dynamic(it)
    root.add(it)
    items.push(it)
  }
  if (kind === 'rebar') for (const x of [-0.5, cols * 0.9]) root.add(box(0.3, 0.3, rows * 0.2 + 5, mat('timber'), { base: true, x, z: rows * 0.1 }))
  const rig = {
    items,
    setCount(n) {
      const k = Math.max(0, Math.min(items.length, Math.round(n)))
      if (k === rig._n) return
      rig._n = k
      items.forEach((it, i) => (it.visible = i < k))
    }
  }
  rig.setCount(items.length)
  return { object: root, rig }
}

/** Growing / shrinking spoil heap (rig.setSize 0..1) */
export function heap({ r = 4, h = 2.6, kind = 'soil' } = {}) {
  const m = kind === 'soil' ? colorMat('#7a5a3c', 0.95) : mat(kind)
  const c = cone(r, h, m, { base: true, seg: 18 })
  const root = group(c)
  const rig = { setSize: (k) => { c.visible = k > 0.02; c.scale.set(Math.max(0.05, k), Math.max(0.05, k), Math.max(0.05, k)) } }
  rig.setSize(0)
  return { object: root, rig }
}
