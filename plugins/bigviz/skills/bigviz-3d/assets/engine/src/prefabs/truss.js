// Lattice steel geometry (tower crane mast/jib, hoist mast, scaffold frames).
// Built as merged thin bars so a whole jib is one draw call.

import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

const up = new THREE.Vector3(0, 1, 0)

/** Thin square bar from a to b as raw geometry */
export function barGeo(a, b, t = 0.12) {
  const dir = new THREE.Vector3().subVectors(b, a)
  const len = dir.length()
  const g = new THREE.BoxGeometry(t, len, t)
  g.translate(0, len / 2, 0)
  const q = new THREE.Quaternion().setFromUnitVectors(up, dir.normalize())
  g.applyMatrix4(new THREE.Matrix4().makeRotationFromQuaternion(q).setPosition(a))
  return g
}

/** Square mast section (height h, width w) with X bracing on all four faces, origin at base centre */
export function mastSectionGeo(w = 2, h = 3.6, t = 0.16) {
  const r = w / 2
  const c = [[r, r], [-r, r], [-r, -r], [r, -r]]
  const bars = []
  for (let i = 0; i < 4; i++) {
    const [x0, z0] = c[i]
    const [x1, z1] = c[(i + 1) % 4]
    bars.push(barGeo(new THREE.Vector3(x0, 0, z0), new THREE.Vector3(x0, h, z0), t))
    bars.push(barGeo(new THREE.Vector3(x0, 0, z0), new THREE.Vector3(x1, h, z1), t * 0.6))
    bars.push(barGeo(new THREE.Vector3(x0, h, z0), new THREE.Vector3(x1, h, z1), t * 0.6))
  }
  return mergeGeometries(bars)
}

/**
 * Triangular truss along +z (jib). Bottom chords at y=0 (x = +-w/2), top chord at y = h.
 * @param {number} len @param {number} w @param {number} h @param {number} seg panel length
 */
export function jibGeo(len, w = 1.6, h = 1.8, seg = 2.4, t = 0.14) {
  const bars = []
  const L = new THREE.Vector3(w / 2, 0, 0)
  const R = new THREE.Vector3(-w / 2, 0, 0)
  const T = new THREE.Vector3(0, h, 0)
  const at = (p, z) => p.clone().setZ(z)
  for (const p of [L, R, T]) bars.push(barGeo(at(p, 0), at(p, len), t))
  let flip = false
  for (let z = 0; z < len - 1e-3; z += seg) {
    const z1 = Math.min(len, z + seg)
    const a = flip ? z : z1
    const b = flip ? z1 : z
    bars.push(barGeo(at(L, a), at(T, b), t * 0.6))
    bars.push(barGeo(at(R, a), at(T, b), t * 0.6))
    bars.push(barGeo(at(L, z), at(R, z1), t * 0.5))
    bars.push(barGeo(at(L, z1), at(R, z1), t * 0.5))
    flip = !flip
  }
  return mergeGeometries(bars)
}

/** Scaffold bay: 2 standards, ledgers every lift, one diagonal; origin at base, along +x */
export function scaffoldBayGeo(bay = 2.4, lift = 2, lifts = 1, depth = 1.1, t = 0.07) {
  const bars = []
  const H = lift * lifts
  for (const z of [0, depth]) {
    bars.push(barGeo(new THREE.Vector3(0, 0, z), new THREE.Vector3(0, H, z), t))
    for (let l = 1; l <= lifts; l++) {
      const y = l * lift
      bars.push(barGeo(new THREE.Vector3(0, y, z), new THREE.Vector3(bay, y, z), t))
      bars.push(barGeo(new THREE.Vector3(0, y - lift * 0.5, depth), new THREE.Vector3(bay, y - lift * 0.5, depth), t * 0.8))
    }
  }
  for (let l = 0; l < lifts; l++) bars.push(barGeo(new THREE.Vector3(0, l * lift, depth), new THREE.Vector3(bay, (l + 1) * lift, depth), t * 0.8))
  for (let l = 1; l <= lifts; l++) bars.push(barGeo(new THREE.Vector3(0, l * lift, 0), new THREE.Vector3(0, l * lift, depth), t))
  return mergeGeometries(bars)
}
