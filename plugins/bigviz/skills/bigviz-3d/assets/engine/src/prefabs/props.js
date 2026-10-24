// Static props. Each returns { object, glows? } where glows are local-space lamp markers
// { pos, group, color, size, pool } that the scene builder registers with the GlowField.
// Props are baked into a few draw calls per lifecycle bucket by the SceneBuilder.

import * as THREE from 'three'
import { mat, colorMat, lightMat, materialStyle } from '../render/materials.js'
import { labelTexture } from '../render/sheets.js'
import { box, cyl, cone, sphere, group } from './kit.js'
import { pallet } from './vehicles.js'
import { STREET } from './street.js'

const V = (x, y, z) => new THREE.Vector3(x, y, z)

export const PROPS = {
  streetLight: ({ h = 6.5, arm = 1.8 } = {}) => ({
    object: group(
      cyl(0.14, 0.18, h, mat('paint.dark'), { base: true }),
      box(0.12, 0.12, arm, mat('paint.dark'), { y: h, z: arm / 2 }),
      box(0.5, 0.18, 0.9, mat('paint.dark'), { y: h - 0.05, z: arm }),
      box(0.42, 0.06, 0.8, lightMat('#ffd9a0', 3, 'street'), { y: h - 0.16, z: arm, cast: false })
    ),
    glows: [{ pos: V(0, h - 0.3, arm), group: 'street', color: '#ffcf8a', size: 3.4, pool: 5 }]
  }),
  // big yellow site floodlight mast (the "大黄灯")
  floodMast: ({ h = 9, heads = 3, ry = 0 } = {}) => {
    const g = group(cyl(0.16, 0.22, h, mat('paint.yellow'), { base: true }), box(1, 0.5, 1, colorMat('#a8a49c', 0.9), { base: true }))
    const bar = box(heads * 1.1, 0.12, 0.12, mat('steel.dark'), { y: h })
    g.add(bar)
    const glows = []
    for (let i = 0; i < heads; i++) {
      const x = (i - (heads - 1) / 2) * 1.05
      g.add(box(0.9, 0.7, 0.3, mat('paint.dark'), { x, y: h - 0.1, z: 0.25, rx: 0.5 }))
      g.add(box(0.78, 0.58, 0.04, lightMat('#ffd27a', 5, 'site'), { x, y: h - 0.12, z: 0.42, rx: 0.5, cast: false }))
      glows.push({ pos: V(x, h - 0.2, 0.6), group: 'site', color: '#ffc36b', size: 4.4, pool: 0 })
    }
    g.rotation.y = ry
    return { object: g, glows, spot: { pos: V(0, h, 0.5), color: '#ffc06a' } }
  },
  workLight: () => ({
    object: group(
      ...[0, 1, 2].map((i) => cyl(0.03, 0.03, 1.7, mat('steel.dark'), { base: true, x: Math.cos(i * 2.1) * 0.4, z: Math.sin(i * 2.1) * 0.4, rz: Math.cos(i * 2.1) * 0.22, rx: -Math.sin(i * 2.1) * 0.22 })),
      cyl(0.04, 0.04, 1.2, mat('steel.dark'), { base: true, y: 1.5 }),
      box(0.6, 0.45, 0.22, mat('paint.yellow'), { y: 2.7, rx: 0.4 }),
      box(0.5, 0.36, 0.04, lightMat('#fff1cf', 4, 'site'), { y: 2.7, z: 0.12, rx: 0.4, cast: false })
    ),
    glows: [{ pos: V(0, 2.65, 0.25), group: 'site', color: '#fff0c0', size: 2.4, pool: 3.5 }]
  }),
  cone: () => ({ object: group(cone(0.28, 0.75, mat('paint.orange'), { base: true }), cyl(0.2, 0.22, 0.1, mat('paint.white'), { y: 0.42 }), box(0.6, 0.06, 0.6, mat('paint.orange'), { base: true })) }),
  barrier: () => ({ object: group(box(2, 0.8, 0.5, mat('paint.red'), { base: true, round: 0.1 }), box(2.02, 0.2, 0.52, mat('paint.white'), { y: 0.45 })) }),
  jersey: () => ({ object: group(box(3, 0.9, 0.6, mat('concrete.fresh'), { base: true, round: 0.12 }), box(3.02, 0.12, 0.62, mat('paint.yellow'), { y: 0.75 })) }),
  guardrail: ({ len = 6 } = {}) => {
    const g = group(box(len, 0.3, 0.08, mat('steel'), { y: 0.7 }))
    for (let x = -len / 2; x <= len / 2 + 0.01; x += 2) g.add(box(0.12, 0.8, 0.12, mat('steel.dark'), { base: true, x }))
    return { object: g }
  },
  sign: ({ text = '施工重地', bg = '#1f5fbf', fg = '#ffffff' } = {}) => {
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1), new THREE.MeshStandardMaterial({ map: labelTexture(text, { bg, fg, w: 256, h: 160, font: 'bold 42px sans-serif' }), roughness: 0.5 }))
    plate.position.set(0, 2.1, 0.06)
    plate.castShadow = true
    return { object: group(cyl(0.05, 0.05, 2.6, mat('steel'), { base: true }), box(1.66, 1.06, 0.06, mat('paint.dark'), { y: 2.1 }), plate) }
  },
  stopSign: () => ({ object: group(cyl(0.05, 0.05, 2.4, mat('steel'), { base: true }), cyl(0.45, 0.45, 0.05, mat('paint.red'), { y: 2.3, axis: 'z', seg: 8 })) }),
  trafficLight: () => ({
    object: group(
      cyl(0.1, 0.12, 4.4, mat('paint.dark'), { base: true }),
      box(0.45, 1.3, 0.4, mat('paint.dark'), { y: 3.9 }),
      sphere(0.13, lightMat('#ff3b2a', 2, 'street'), { y: 4.3, z: 0.2, cast: false }),
      sphere(0.13, colorMat('#4a3a10', 0.4), { y: 3.9, z: 0.2, cast: false }),
      sphere(0.13, lightMat('#3bff7a', 2, 'street'), { y: 3.5, z: 0.2, cast: false })
    )
  }),
  rebarStack: ({ n = 3, len = 6 } = {}) => {
    const g = group(box(0.3, 0.3, len * 0.8, mat('timber'), { base: true, x: -0.7 }), box(0.3, 0.3, len * 0.8, mat('timber'), { base: true, x: 0.7 }))
    for (let l = 0; l < n; l++) for (let i = 0; i < 9; i++) g.add(cyl(0.05, 0.05, len, mat('rebar'), { axis: 'z', x: -0.8 + i * 0.2, y: 0.36 + l * 0.11 }))
    g.rotation.y = Math.PI / 2
    return { object: g }
  },
  planks: ({ n = 8 } = {}) => {
    const g = group()
    for (let i = 0; i < n; i++) g.add(box(0.3, 0.06, 3.6, mat('plywood'), { base: true, x: -0.6 + (i % 5) * 0.31, y: Math.floor(i / 5) * 0.07 }))
    return { object: g }
  },
  formStack: ({ n = 10 } = {}) => {
    const g = group(box(1.3, 0.16, 2.5, mat('timber'), { base: true }))
    for (let i = 0; i < n; i++) g.add(box(1.22, 0.06, 2.44, mat(i % 3 ? 'formwork' : 'plywood'), { base: true, y: 0.16 + i * 0.065 }))
    return { object: g }
  },
  cementBags: () => ({ object: pallet('bags') }),
  bricks: () => ({ object: pallet('bricks') }),
  blocks: () => ({ object: pallet('blocks') }),
  wrapped: () => ({ object: pallet('wrap') }),
  tubes: ({ n = 18 } = {}) => {
    const g = group(box(0.25, 0.25, 1.8, mat('timber'), { base: true, x: -2 }), box(0.25, 0.25, 1.8, mat('timber'), { base: true, x: 2 }))
    for (let i = 0; i < n; i++) g.add(cyl(0.05, 0.05, 6, mat('steel'), { axis: 'x', z: -0.7 + (i % 6) * 0.26, y: 0.3 + Math.floor(i / 6) * 0.11 }))
    return { object: g }
  },
  pipes: () => {
    const g = group()
    for (let i = 0; i < 5; i++) g.add(cyl(0.5, 0.5, 4, colorMat('#8d8f8a', 0.8), { axis: 'z', x: -1.6 + (i % 3) * 1.05 + (i > 2 ? 0.52 : 0), y: 0.5 + (i > 2 ? 0.88 : 0) }))
    return { object: g }
  },
  sandPile: ({ r = 2.2, h = 1.4, kind = 'sand' } = {}) => ({ object: group(cone(r, h, mat(kind), { base: true, seg: 16 })) }),
  container: ({ color = '#c0503a', L = 6, H = 2.6 } = {}) => {
    const m = colorMat(color, 0.55, 0.45)
    const g = group(box(2.44, H, L, m, { base: true }))
    for (let z = -L / 2 + 0.3; z < L / 2; z += 0.45) for (const s of [1, -1]) g.add(box(0.05, H - 0.2, 0.18, m, { base: true, x: s * 1.24, y: 0.1, z }))
    g.add(box(2.3, H - 0.3, 0.06, colorMat(color, 0.5, 0.5), { base: true, y: 0.15, z: L / 2 + 0.02 }))
    return { object: g }
  },
  siteOffice: ({ floors = 2, n = 3 } = {}) => {
    const g = group()
    const glows = []
    for (let f = 0; f < floors; f++) {
      for (let i = 0; i < n; i++) {
        g.add(box(6, 2.7, 2.44, mat('paint.white'), { base: true, x: i * 6.1 - ((n - 1) * 6.1) / 2, y: f * 2.75 }))
        g.add(box(1.4, 0.9, 0.05, lightMat('#fff2d0', 1.8, 'site'), { x: i * 6.1 - ((n - 1) * 6.1) / 2 + 1.2, y: f * 2.75 + 1.6, z: 1.24, cast: false }))
        g.add(box(0.9, 2, 0.05, mat('paint.blue'), { base: true, x: i * 6.1 - ((n - 1) * 6.1) / 2 - 1.6, y: f * 2.75, z: 1.24 }))
      }
      g.add(box(n * 6.1, 0.12, 0.06, mat('paint.blue'), { y: f * 2.75 + 2.6, z: 1.25 }))
    }
    if (floors > 1) {
      g.add(box(n * 6.1, 0.08, 1.2, mat('steel'), { y: 2.75, z: 1.85 }))
      g.add(box(n * 6.1, 0.05, 0.05, mat('paint.yellow'), { y: 3.8, z: 2.4 }))
      for (let i = 0; i < 8; i++) g.add(box(1.2, 0.06, 0.3, mat('steel'), { x: (n * 6.1) / 2 + 0.7, y: 0.34 * i, z: 1.5 - i * 0.35 }))
    }
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(7, 1), new THREE.MeshStandardMaterial({ map: labelTexture('项目部 SITE OFFICE', { bg: '#1f3c6e', fg: '#fff', w: 512, h: 72, font: 'bold 40px sans-serif' }) }))
    plate.position.set(0, floors * 2.75 + 0.5, 1.23)
    g.add(plate)
    return { object: g, glows }
  },
  toilet: () => ({ object: group(box(1.2, 2.3, 1.2, mat('paint.blue'), { base: true, round: 0.08 }), box(1.25, 0.12, 1.25, mat('paint.white'), { y: 2.3 })) }),
  waterTank: () => ({ object: group(cyl(0.9, 0.9, 1.6, mat('paint.white'), { base: true, y: 1.2, seg: 18 }), box(1.8, 1.2, 1.8, mat('steel.dark'), { base: true })) }),
  dumpster: ({ color = '#2f6a46' } = {}) => ({ object: group(box(2.2, 1.3, 1.4, colorMat(color, 0.6, 0.3), { base: true, round: 0.06 }), box(2.3, 0.1, 1.5, colorMat('#203a28', 0.5), { y: 1.35, rx: -0.1 })) }),
  skip: () => ({ object: group(box(3.6, 1.4, 1.9, mat('paint.yellow'), { base: true }), cone(1.3, 0.8, mat('gravel'), { base: true, y: 0.7, seg: 9 })) }),
  trashBin: () => ({ object: group(cyl(0.3, 0.26, 0.9, colorMat('#3d4a55', 0.5, 0.4), { base: true })) }),
  electricBox: () => ({ object: group(box(1, 1.5, 0.5, colorMat('#c7cbc8', 0.5, 0.3), { base: true }), box(0.3, 0.3, 0.05, colorMat('#f2c230', 0.5), { y: 1.1, z: 0.26 })) }),
  generator: () => ({ object: group(box(2.6, 1.4, 1.2, mat('paint.green'), { base: true, round: 0.1 }), cyl(0.08, 0.08, 0.6, mat('chrome'), { base: true, x: 1, y: 1.4 })) }),
  bench: () => ({ object: group(box(1.8, 0.08, 0.5, mat('timber'), { y: 0.45 }), box(1.8, 0.4, 0.06, mat('timber'), { y: 0.75, z: -0.25 }), box(0.08, 0.45, 0.5, mat('steel.dark'), { base: true, x: 0.8 }), box(0.08, 0.45, 0.5, mat('steel.dark'), { base: true, x: -0.8 })) }),
  bollard: () => ({ object: group(cyl(0.12, 0.12, 0.9, mat('paint.dark'), { base: true }), cyl(0.125, 0.125, 0.1, mat('paint.yellow'), { y: 0.7 })) }),
  hydrant: () => ({ object: group(cyl(0.16, 0.18, 0.7, mat('paint.red'), { base: true }), sphere(0.17, mat('paint.red'), { y: 0.7, hemi: true }), cyl(0.06, 0.06, 0.5, mat('paint.red'), { axis: 'x', y: 0.45 })) }),
  busStop: () => ({ object: group(box(4, 0.1, 1.6, mat('steel.dark'), { y: 2.6 }), box(0.1, 2.6, 0.1, mat('steel.dark'), { base: true, x: -1.9, z: -0.7 }), box(0.1, 2.6, 0.1, mat('steel.dark'), { base: true, x: 1.9, z: -0.7 }), box(3.8, 2, 0.05, mat('glass'), { base: true, y: 0.4, z: -0.75 }), box(3, 0.08, 0.4, mat('timber'), { y: 0.45, z: -0.4 })) })
}

export function makeProp(type, params) {
  // realistic style: real-proportion street furniture (prefabs/street.js), same keys / params
  const f = (materialStyle() === 'realistic' && STREET[type]) || PROPS[type]
  if (!f) throw new Error(`Unknown prop: ${type}`)
  return f(params || {})
}
