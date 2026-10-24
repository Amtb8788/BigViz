// Street pack - winter London plane (悬铃木) as street trees in December: pollarded
// 3-scaffold crown, recursive bare branches down to twigs, a few hanging seed balls, mottled
// bark, square pit with a cast-iron grate. One merged mesh + one material for every tree.

import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { makeCanvas } from '../../render/textures.js'
import { colorMat } from '../../render/materials.js'
import { createRng } from '../../core/rng.js'
import { box, group } from '../../prefabs/kit.js'

let barkM = null
function barkMaterial() {
  if (barkM) return barkM
  const c = makeCanvas(256, 256)
  const g = c.getContext('2d')
  const rng = createRng(17)
  g.fillStyle = '#8d8a78'
  g.fillRect(0, 0, 256, 256)
  // plane-tree camouflage: flaking patches olive / cream / grey-brown
  for (let i = 0; i < 160; i++) {
    g.fillStyle = rng.pick(['#b8b293', '#6f6a55', '#a59f84', '#5c5848', '#c9c3a6'])
    g.beginPath()
    g.ellipse(rng.range(0, 256), rng.range(0, 256), rng.range(6, 26), rng.range(4, 18), rng.range(0, 3), 0, Math.PI * 2)
    g.fill()
  }
  for (let i = 0; i < 400; i++) { g.fillStyle = `rgba(30,26,20,${rng.range(0.05, 0.2)})`; g.fillRect(rng.range(0, 256), rng.range(0, 256), 2, rng.range(2, 8)) }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  barkM = new THREE.MeshStandardMaterial({ map: t, roughness: 0.9, metalness: 0, name: 'bark.plane.winter' })
  return barkM
}

const UP = new THREE.Vector3(0, 1, 0)
const _q = new THREE.Quaternion()

/** tapered segment a->b (radii ra, rb), uv: around x length */
function seg(a, b, ra, rb, sides) {
  const d = new THREE.Vector3().subVectors(b, a)
  const len = d.length()
  const g = new THREE.CylinderGeometry(rb, ra, len, sides, 1, true)
  const uv = g.attributes.uv
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i), uv.getY(i) * len * 0.5)
  g.translate(0, len / 2, 0)
  _q.setFromUnitVectors(UP, d.normalize())
  g.applyQuaternion(_q)
  g.translate(a.x, a.y, a.z)
  return g
}

/** grow a limb from p along dir; depth 0 = scaffold */
function limb(out, tips, rng, p, dir, len, r, depth, maxDepth) {
  const n = depth < 2 ? 3 : 2
  let a = p.clone()
  let d = dir.clone()
  let rr = r
  for (let i = 0; i < n; i++) {
    // slight wander + droop on thin wood
    d.add(new THREE.Vector3(rng.jitter(0.22), rng.jitter(0.12) - (depth >= 2 ? 0.06 : 0), rng.jitter(0.22))).normalize()
    const b = a.clone().addScaledVector(d, len / n)
    const rb = Math.max(0.006, rr * 0.8)
    out.push(seg(a, b, rr, rb, depth === 0 ? 7 : depth === 1 ? 5 : 3))
    a = b
    rr = rb
  }
  if (depth >= maxDepth) { tips.push(a); return }
  const k = depth === 0 ? 3 : 2 + (rng.chance(0.4) ? 1 : 0)
  for (let i = 0; i < k; i++) {
    const side = new THREE.Vector3(rng.jitter(1), 0, rng.jitter(1)).normalize()
    const nd = d.clone().multiplyScalar(0.75).addScaledVector(side, 0.65).add(new THREE.Vector3(0, 0.35, 0)).normalize()
    limb(out, tips, rng, a, nd, len * rng.range(0.55, 0.7), rr * 0.72, depth + 1, maxDepth)
  }
}

/** bare plane tree, h ~ total height (m) */
export function winterTree({ h = 10, seed = 1, pit = true } = {}) {
  const rng = createRng(seed * 31 + 7)
  const parts = []
  const tips = []
  const fork = h * rng.range(0.3, 0.36)
  const r0 = h * 0.024
  const top = new THREE.Vector3(rng.jitter(0.15), fork, rng.jitter(0.15))
  parts.push(seg(new THREE.Vector3(0, 0, 0), new THREE.Vector3(top.x * 0.4, fork * 0.5, top.z * 0.4), r0 * 1.15, r0, 9))
  parts.push(seg(new THREE.Vector3(top.x * 0.4, fork * 0.5, top.z * 0.4), top, r0, r0 * 0.9, 9))
  // pollard knuckle at the fork
  parts.push(new THREE.SphereGeometry(r0 * 1.25, 8, 6).translate(top.x, top.y, top.z))
  const k = rng.int(3, 4)
  const rot = rng.range(0, 6)
  for (let i = 0; i < k; i++) {
    const a = rot + (i / k) * Math.PI * 2 + rng.jitter(0.35)
    const dir = new THREE.Vector3(Math.cos(a) * 0.55, 0.83, Math.sin(a) * 0.55).normalize()
    limb(parts, tips, rng, top, dir, (h - fork) * 0.55, r0 * 0.62, 0, 3)
  }
  // seed balls hang on a few tips
  for (const t of tips) if (rng.chance(0.12)) parts.push(new THREE.SphereGeometry(0.035, 5, 4).translate(t.x, t.y - 0.08, t.z))
  const geo = mergeGeometries(parts.map((g) => (g.index ? g.toNonIndexed() : g)), false)
  parts.forEach((g) => g.dispose())
  const wood = new THREE.Mesh(geo, barkMaterial())
  wood.castShadow = true
  wood.receiveShadow = true
  const g = group(wood)
  if (pit) {
    const curb = colorMat('#a3a097', 0.85)
    for (const [x, z, w, d] of [[0, 0.7, 1.5, 0.12], [0, -0.7, 1.5, 0.12], [0.7, 0, 0.12, 1.3], [-0.7, 0, 0.12, 1.3]]) g.add(box(w, 0.2, d, curb, { base: true, x, z }))
    g.add(box(1.3, 0.03, 1.3, colorMat('#2c2b29', 0.6, 0.6), { y: 0.17 }))
  }
  return { object: g }
}
