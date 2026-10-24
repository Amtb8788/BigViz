// Factory storage: steel coils on saddles, blue tote bins + gravity flow racks, selective
// high-bay pallet racking (blue uprights / orange beams), stamped-part returnable racks,
// die blocks, QC inspection tables. All static (baked by the builder per bucket).

import * as THREE from 'three'
import { mat, colorMat } from '../../render/materials.js'
import { box, cyl, lathe, group } from '../../prefabs/kit.js'
import { createRng } from '../../core/rng.js'
import { panelGeometry, panelMaterial } from './robot.js'

const STEEL_BLUE = '#6f7d88'

/** hot-rolled steel coil, eye axis along z, centre at (0, r, 0) */
export function coil({ r = 0.9, w = 1.25, eye = 0.3, seed = 1 } = {}) {
  const rng = createRng(seed)
  const shade = ['#6f7d88', '#66737e', '#7b8791', '#5f6b75'][seed % 4]
  const m = colorMat(shade, 0.42, 0.75)
  const h = w / 2
  const body = lathe([[eye, -h], [r - 0.02, -h], [r, -h + 0.03], [r, h - 0.03], [r - 0.02, h], [eye, h], [eye, -h]], m, { seg: 30, axis: 'z' })
  body.position.y = r
  const g = group(body)
  // steel bands: two around the circumference, three radial through the eye
  const band = colorMat('#2d3136', 0.5, 0.6)
  for (const z of [-h * 0.55, h * 0.55]) g.add(cyl(r + 0.008, r + 0.008, 0.035, band, { axis: 'z', y: r, z, seg: 30, cast: false }))
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + rng.next()
    g.add(box(0.035, r - eye + 0.02, w + 0.02, band, { x: Math.sin(a) * (r + eye) / 2, y: r + Math.cos(a) * (r + eye) / 2, rz: -a, cast: false }))
  }
  return { object: g }
}

/** coil saddle (V-cradle) with a coil (or empty) */
export function coilSaddle({ r = 0.9, w = 1.25, seed = 1, empty = false } = {}) {
  const g = group(box(1.9, 0.12, w + 0.2, mat('steel.dark'), { base: true }))
  for (const s of [1, -1]) g.add(box(0.5, 0.36, w + 0.2, colorMat('#3d4449', 0.6, 0.5), { x: s * 0.62, y: 0.2, rz: s * 0.5 }))
  if (!empty) {
    const c = coil({ r, w, seed }).object
    c.position.y = 0.16
    g.add(c)
  }
  return { object: g }
}

/** blue industrial tote 600 x 400 x 280 mm */
function tote(g, x, y, z, ry = 0, color = '#2f5f9c') {
  const c = colorMat(color, 0.6)
  g.add(box(0.6, 0.25, 0.4, c, { base: true, x, y, z, ry }))
  g.add(box(0.62, 0.04, 0.42, colorMat('#244b7d', 0.6), { x, y: y + 0.26, z, ry, cast: false }))
}

/** gravity flow rack: 4 levels x n lanes of totes, inclined rollers, label rail */
export function flowRack({ lanes = 4, deep = 4, seed = 1 } = {}) {
  const rng = createRng(seed)
  const W = lanes * 0.7
  const D = deep * 0.44 + 0.3
  const g = group()
  const frame = colorMat('#2d6aa8', 0.5, 0.4)
  for (const sx of [1, -1]) for (const sz of [1, -1]) g.add(box(0.06, 2.1, 0.06, frame, { base: true, x: sx * W / 2, z: sz * D / 2 }))
  for (let l = 0; l < 4; l++) {
    const y = 0.25 + l * 0.48
    g.add(box(W, 0.04, D, mat('steel'), { y, rx: 0.06, cast: false }))
    g.add(box(W, 0.06, 0.04, colorMat('#e3c32a', 0.6), { y: y + 0.03, z: D / 2 }))
    for (let i = 0; i < lanes; i++) {
      const n = Math.floor(rng.next() * (deep + 1))
      for (let k = 0; k < n; k++) tote(g, -W / 2 + 0.35 + i * 0.7, y + 0.03 - k * 0.026, D / 2 - 0.24 - k * 0.44, Math.PI / 2, rng.next() < 0.12 ? '#c9392b' : '#2f5f9c')
    }
  }
  return { object: g }
}

/** stack of totes on a pallet (line side) */
export function toteStack({ n = 3, seed = 1 } = {}) {
  const rng = createRng(seed)
  const g = group(pallet())
  for (let i = 0; i < 2; i++) for (let j = 0; j < 3; j++) {
    const h = 1 + Math.floor(rng.next() * n)
    for (let k = 0; k < h; k++) tote(g, -0.3 + i * 0.62, 0.15 + k * 0.29, -0.42 + j * 0.42)
  }
  return { object: g }
}

function pallet() {
  const w = colorMat('#a07d52', 0.85)
  return group(box(1.2, 0.03, 1.0, w, { base: true, y: 0.12 }), ...[-0.5, 0, 0.5].map((x) => box(0.12, 0.12, 1.0, w, { base: true, x })))
}

/** pallet load: wrapped cartons / wire cage with parts / plastic crate */
export function load(rng) {
  const g = group(pallet())
  const k = rng.next()
  if (k < 0.5) {
    const h = 0.6 + rng.next() * 0.6
    g.add(box(1.16, h, 0.96, colorMat(['#b68b5a', '#a98153', '#c3a073'][Math.floor(rng.next() * 3)], 0.85), { base: true, y: 0.15, round: 0.02 }))
    g.add(box(1.18, h * 0.85, 0.98, colorMat('#d8dde2', 0.25, 0), { base: true, y: 0.17, cast: false }))
  } else if (k < 0.8) {
    g.add(box(1.16, 0.85, 0.96, colorMat('#5e6a72', 0.55, 0.6), { base: true, y: 0.15 }))
    g.add(box(1.0, 0.6, 0.8, colorMat('#8a9298', 0.4, 0.8), { base: true, y: 0.2 }))
  } else {
    g.add(box(1.16, 0.75, 0.96, colorMat('#2f5f9c', 0.6), { base: true, y: 0.15 }))
  }
  return g
}

/** selective pallet rack row, bays along x, depth along z */
export function palletRack({ bays = 11, levels = 6, bay = 2.8, depth = 1.1, lh = 1.5, fill = 0.78, seed = 1, holes = [] } = {}) {
  const rng = createRng(seed)
  const L = bays * bay
  const g = group()
  const up = colorMat('#2d6aa8', 0.5, 0.4)
  const beam = colorMat('#e0702a', 0.5, 0.3)
  const H = levels * lh + 0.3
  for (let i = 0; i <= bays; i++) {
    const x = -L / 2 + i * bay
    for (const sz of [1, -1]) g.add(box(0.1, H, 0.08, up, { base: true, x, z: sz * depth / 2 }))
    for (let y = 0.6; y < H; y += 1.2) g.add(box(0.04, 0.04, depth, up, { x, y, cast: false }))
    g.add(box(0.28, 0.02, 0.2, mat('steel.dark'), { base: true, x, z: depth / 2 }))
  }
  // level 0 on the floor, level l on beam l (top face at l * lh)
  for (let l = 1; l < levels; l++) for (const sz of [1, -1]) g.add(box(L, 0.12, 0.06, beam, { x: 0, y: l * lh - 0.06, z: sz * depth / 2 }))
  for (let i = 0; i < bays; i++) for (let l = 0; l < levels; l++) for (const k of [0, 1]) {
    if (rng.next() > fill || holes.some((h) => h[0] === i && h[1] === k && h[2] === l)) continue
    const p = load(rng)
    p.position.set(-L / 2 + i * bay + 0.75 + k * 1.3, l * lh, 0)
    p.rotation.y = Math.PI / 2
    p.scale.set(0.98, 1, 0.98)
    g.add(p)
  }
  // aisle-end protector + rack label
  for (const sx of [1, -1]) g.add(box(0.3, 0.4, depth + 0.2, mat('paint.yellow'), { base: true, x: sx * (L / 2 + 0.25) }))
  return { object: g }
}

/** single pallet load (rack slot entity / staging) */
export function palletLoad({ seed = 1 } = {}) {
  return { object: load(createRng(seed)) }
}

/** returnable steel rack holding stamped panels upright */
export function partRack({ n = 10, full = 1 } = {}) {
  const g = group()
  const f = colorMat('#4a5258', 0.55, 0.55)
  for (const sx of [1, -1]) for (const sz of [1, -1]) g.add(box(0.08, 1.6, 0.08, f, { base: true, x: sx * 1.1, z: sz * 0.85 }))
  g.add(box(2.3, 0.12, 1.8, f, { base: true, y: 0.1 }))
  for (const sz of [1, -1]) g.add(box(2.3, 0.06, 0.06, f, { y: 1.6, z: sz * 0.85 }))
  const k = Math.round(n * full)
  for (let i = 0; i < k; i++) {
    const m = new THREE.Mesh(panelGeometry(), panelMaterial())
    m.rotation.set(0, 0, Math.PI / 2 - 0.12)
    m.position.set(-0.9 + i * 0.19, 0.95, 0)
    m.castShadow = true
    g.add(m)
  }
  return { object: g }
}

/** die set on floor blocks */
export function dieBlock({ w = 2.6, d = 2.0, seed = 1 } = {}) {
  const c = ['#5d6461', '#596360', '#626a66'][seed % 3]
  return { object: group(
    ...[-0.9, 0.9].map((x) => box(0.4, 0.3, d + 0.2, mat('timber'), { base: true, x })),
    box(w, 0.5, d, colorMat(c, 0.55, 0.5), { base: true, y: 0.3 }),
    box(w - 0.3, 0.5, d - 0.3, colorMat(c, 0.55, 0.5), { base: true, y: 0.8 }),
    box(w + 0.05, 0.06, d + 0.05, mat('paint.red'), { y: 0.83 }),
    box(w - 0.2, 0.08, d - 0.2, colorMat('#3e4446', 0.6, 0.5), { base: true, y: 1.3 })
  ) }
}

/** QC table: granite surface plate, CMM-style bridge, monitor */
export function qcTable() {
  const g = group(
    box(2.4, 0.8, 1.4, colorMat('#c9ccc8', 0.5, 0.2), { base: true }),
    box(2.2, 0.2, 1.3, colorMat('#2b2d30', 0.25, 0.1), { base: true, y: 0.8 })
  )
  for (const sx of [1, -1]) g.add(box(0.12, 0.8, 0.12, colorMat('#c9ccc8', 0.4, 0.5), { base: true, x: sx * 0.95, y: 1.0, z: -0.4 }))
  g.add(box(2.1, 0.14, 0.14, colorMat('#c9ccc8', 0.4, 0.5), { y: 1.85, z: -0.4 }))
  g.add(cyl(0.03, 0.03, 0.5, mat('steel'), { y: 1.55, z: -0.4 }))
  const m = new THREE.Mesh(panelGeometry(), panelMaterial())
  m.position.set(0.1, 1.02, 0.1)
  m.castShadow = true
  g.add(m)
  g.add(box(0.55, 0.36, 0.04, colorMat('#15181b', 0.3), { x: 1.3, y: 1.4, z: 0.5, ry: -0.5 }))
  return { object: g }
}

/** blanking line (uncoiler -> leveler -> shear -> stacker), strip along +x */
export function blankingLine() {
  const g = group()
  const body = colorMat('#3d5568', 0.45, 0.35)
  g.add(box(2.4, 2.2, 2.2, body, { base: true, x: -8 }))
  g.add(cyl(0.3, 0.3, 1.9, mat('steel'), { axis: 'z', x: -8, y: 1.6 }))
  g.add(box(3.2, 1.8, 2.0, body, { base: true, x: -3 }))
  for (let i = 0; i < 6; i++) g.add(cyl(0.12, 0.12, 1.8, mat('chrome'), { axis: 'z', x: -4.2 + i * 0.48, y: 1.25 + (i % 2) * 0.22 }))
  g.add(box(2.6, 3.2, 2.4, body, { base: true, x: 1.5 }))
  g.add(box(2.7, 0.2, 2.5, mat('paint.yellow'), { y: 1.3, x: 1.5 }))
  g.add(box(5, 0.9, 1.8, mat('rubber'), { base: true, x: 6 }))
  g.add(box(5.2, 0.12, 2.0, body, { y: 0.92, x: 6 }))
  for (let i = 0; i < 18; i++) {
    const m = new THREE.Mesh(panelGeometry(), panelMaterial())
    m.scale.set(1, 0.08, 1)
    m.position.set(7.5, 1.0 + i * 0.022, 0)
    g.add(m)
  }
  // strip between uncoiler and leveler
  g.add(box(4.4, 0.02, 1.4, colorMat(STEEL_BLUE, 0.35, 0.8), { x: -5.6, y: 1.2, rz: -0.08, cast: false }))
  return { object: g }
}
