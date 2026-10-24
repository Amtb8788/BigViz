// Greenery, background city blocks and the instanced site fence.

import * as THREE from 'three'
import { mat, colorMat, lightMat, registerNightLit, materialStyle, tone } from '../render/materials.js'
import { makeCanvas } from '../render/textures.js'
import { createRng } from '../core/rng.js'
import { box, cyl, sphere, cone, group, dynamic, bake, bakeTree } from './kit.js'
import { labelTexture } from '../render/sheets.js'
import { realTree, realShrub, realPlanter } from './trees.js'
import { cityBlockReal } from './city.js'

// realistic style swaps in leaf-card trees and atlas-textured buildings (same params)
const real = () => materialStyle() === 'realistic'

/** Stylised tree: round | cone | tall. Canopy is `dynamic` so wind sway can rotate it. */
export function tree({ kind = 'round', h = 5, seed = 1, ...rest } = {}) {
  if (real()) return realTree({ kind, h, seed, ...rest })
  const rng = createRng(seed)
  const g = group(cyl(0.14, 0.2, h * 0.5, mat('bark'), { base: true }))
  const canopy = dynamic(new THREE.Group())
  canopy.position.y = h * 0.45
  const fol = rng.chance(0.5) ? mat('foliage') : mat('foliage.light')
  if (kind === 'cone') {
    canopy.add(cone(h * 0.28, h * 0.7, fol, { base: true, seg: 9 }))
  } else if (kind === 'tall') {
    canopy.add(sphere(h * 0.18, fol, { y: h * 0.35, seg: 9 }))
    canopy.add(sphere(h * 0.16, fol, { y: h * 0.12, seg: 9 }))
  } else {
    for (let i = 0; i < 4; i++) canopy.add(sphere(h * rng.range(0.16, 0.22), fol, { x: rng.jitter(h * 0.12), y: h * 0.18 + rng.range(0, h * 0.15), z: rng.jitter(h * 0.12), seg: 9 }))
  }
  canopy.scale.y = rng.range(0.9, 1.1)
  g.add(canopy)
  bakeTree(g)
  return { object: g, rig: { canopy, phase: rng.range(0, 6) } }
}

export function shrub({ seed = 2, r = 0.7, ...rest } = {}) {
  if (real()) return realShrub({ seed, r, ...rest })
  const rng = createRng(seed)
  const g = group()
  for (let i = 0; i < 3; i++) g.add(sphere(r * rng.range(0.6, 1), rng.chance(0.5) ? mat('foliage') : mat('foliage.light'), { x: rng.jitter(r * 0.6), y: r * 0.4, z: rng.jitter(r * 0.6), seg: 8 }))
  return { object: g }
}

export function planter({ w = 4, d = 1.6, seed = 3 } = {}) {
  if (real()) return realPlanter({ w, d, seed, curb: box(w, 0.6, d, mat('concrete.fresh'), { base: true }) })
  const rng = createRng(seed)
  const g = group(box(w, 0.6, d, mat('concrete.fresh'), { base: true }), box(w - 0.3, 0.05, d - 0.3, colorMat('#4a3826', 0.95), { y: 0.6 }))
  for (let i = 0; i < Math.round(w * 1.5); i++) {
    g.add(sphere(rng.range(0.25, 0.4), rng.chance(0.3) ? colorMat(rng.pick(['#e86a8f', '#f2c230', '#ffffff', '#b06ad8']), 0.8) : mat('foliage.light'), { x: rng.range(-w / 2 + 0.4, w / 2 - 0.4), y: 0.75, z: rng.range(-d / 2 + 0.3, d / 2 - 0.3), seg: 7 }))
  }
  return { object: g }
}

function facadeTexture(seed, cols, rows, base) {
  const c = makeCanvas(256, 256)
  const ctx = c.getContext('2d')
  const rng = createRng(seed)
  ctx.fillStyle = base
  ctx.fillRect(0, 0, 256, 256)
  const cw = 256 / cols
  const rh = 256 / rows
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
    ctx.fillStyle = `hsl(205,25%,${rng.range(22, 36)}%)`
    ctx.fillRect(x * cw + cw * 0.18, y * rh + rh * 0.2, cw * 0.64, rh * 0.6)
  }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  const e = makeCanvas(256, 256)
  const ex = e.getContext('2d')
  ex.fillStyle = '#000'
  ex.fillRect(0, 0, 256, 256)
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
    if (!rng.chance(0.4)) continue
    ex.fillStyle = `hsl(${rng.range(30, 46)},85%,${rng.range(55, 70)}%)`
    ex.fillRect(x * cw + cw * 0.18, y * rh + rh * 0.2, cw * 0.64, rh * 0.6)
  }
  const et = new THREE.CanvasTexture(e)
  et.colorSpace = THREE.SRGBColorSpace
  return { map: t, emissiveMap: et }
}

/** Background city block: simple massing + window texture that lights at night */
export function cityBlock({ w = 12, d = 10, h = 18, seed = 5, color = '#d9d2c3', sign } = {}) {
  if (real()) return cityBlockReal({ w, d, h, seed, color, sign })
  const rows = Math.max(2, Math.round(h / 3.2))
  const cols = Math.max(2, Math.round(w / 2.6))
  // canvas facade bypasses the role palette: tone the base colour for the realistic style
  const base = materialStyle() === 'realistic' ? '#' + tone(color).multiplyScalar(0.82).getHexString() : color
  const { map, emissiveMap } = facadeTexture(seed, cols, rows, base)
  const m = registerNightLit(new THREE.MeshStandardMaterial({ map, emissiveMap, emissive: '#ffffff', roughness: 0.75 }), 1.4, 'windows')
  const roofM = colorMat('#7d7f80', 0.85)
  const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d).translate(0, h / 2, 0), [m, m, roofM, roofM, m, m])
  body.castShadow = body.receiveShadow = true
  const g = group(body, box(w + 0.3, 0.6, d + 0.3, colorMat(color, 0.7), { base: true, y: h }))
  const rng = createRng(seed)
  if (rng.chance(0.7)) g.add(box(w * 0.3, 1.4, d * 0.3, mat('paint.grey'), { base: true, x: rng.jitter(w * 0.2), y: h + 0.6, z: rng.jitter(d * 0.2) }))
  g.add(box(w + 0.1, 3.2, d + 0.1, colorMat('#5c636b', 0.4, 0.3), { base: true }))
  if (sign) {
    const s = new THREE.Mesh(new THREE.PlaneGeometry(Math.min(w * 0.8, 8), 1.2), new THREE.MeshStandardMaterial({ map: labelTexture(sign, { bg: '#2b2f35', fg: '#ffd27a', font: 'bold 56px sans-serif' }), emissive: '#ffffff', emissiveIntensity: 0.15 }))
    s.position.set(0, 3.8, d / 2 + 0.08)
    g.add(s)
  }
  g.add(box(w * 0.4, 0.08, 1.2, lightMat('#ffe6b0', 1.5, 'street'), { y: 3.25, z: d / 2 + 0.5, cast: false }))
  return { object: g }
}

/**
 * Instanced site fence along a closed or open polyline. Panels can be removed one by one
 * (staged) by the LifecycleSystem via rig.setRemoved(t 0..1).
 * @param {{x:number,z:number}[]} pts
 */
export function fenceLine(pts, { panel = 2.4, h = 2.3, gaps = [], style = 'blue' } = {}) {
  const panels = []
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i]
    const b = pts[i + 1]
    const len = Math.hypot(b.x - a.x, b.z - a.z)
    const n = Math.max(1, Math.round(len / panel))
    for (let k = 0; k < n; k++) {
      const t = (k + 0.5) / n
      const x = a.x + (b.x - a.x) * t
      const z = a.z + (b.z - a.z) * t
      if (gaps.some((g) => Math.hypot(g.x - x, g.z - z) < g.r)) continue
      panels.push({ x, z, ry: Math.atan2(b.x - a.x, b.z - a.z) + Math.PI / 2, w: len / n })
    }
  }
  const pm = style === 'white' ? mat('fence.white') : mat('fence.blue')
  const geo = new THREE.BoxGeometry(1, h, 0.12).translate(0, h / 2, 0)
  const inst = new THREE.InstancedMesh(geo, pm, panels.length)
  const stripe = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 0.35, 0.14).translate(0, h - 0.4, 0), mat('paint.white'), panels.length)
  const post = new THREE.InstancedMesh(new THREE.BoxGeometry(0.16, h + 0.2, 0.16).translate(0, (h + 0.2) / 2, 0), mat('steel.dark'), panels.length)
  for (const m of [inst, stripe, post]) { m.castShadow = true; m.receiveShadow = true; m.userData.keep = true; m.frustumCulled = false }
  const m4 = new THREE.Matrix4()
  const q = new THREE.Quaternion()
  const y = new THREE.Vector3(0, 1, 0)
  const order = panels.map((_, i) => i)
  const rig = {
    panels,
    setRemoved(t) {
      const cut = Math.floor(t * panels.length + 1e-6)
      if (rig._cut === cut) return
      rig._cut = cut
      order.forEach((pi, idx) => {
        const p = panels[pi]
        const gone = idx < cut
        q.setFromAxisAngle(y, p.ry)
        m4.compose(new THREE.Vector3(p.x, gone ? -50 : 0, p.z), q, new THREE.Vector3(gone ? 0.001 : p.w - 0.04, 1, 1))
        inst.setMatrixAt(pi, m4)
        stripe.setMatrixAt(pi, m4)
        m4.compose(new THREE.Vector3(p.x + Math.cos(p.ry) * p.w * 0.5, gone ? -50 : 0, p.z - Math.sin(p.ry) * p.w * 0.5), q, new THREE.Vector3(1, 1, 1))
        post.setMatrixAt(pi, m4)
      })
      for (const m of [inst, stripe, post]) m.instanceMatrix.needsUpdate = true
    }
  }
  rig.setRemoved(0)
  return { object: group(inst, stripe, post), rig }
}
