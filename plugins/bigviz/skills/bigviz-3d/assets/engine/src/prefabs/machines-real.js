// Realistic machines ('realistic' style): 20 t excavator with segmented steel tracks
// (instanced pads), banana boom, J bucket with teeth and skinned hydraulic rams that follow
// the joints; mobile crane / pump truck extras (rams, hazard outriggers, boom detail).
// Pivots and rig keys match machines.js, so animate-machines.js drives them unchanged.

import * as THREE from 'three'
import { mat, colorMat } from '../render/materials.js'
import { box, cyl, sphere, extrude, pivot, dynamic, rams, detail } from './kit.js'
import { decal } from './parts-real.js'

const PAINT = () => mat('paint.yellow')
const STEEL = () => mat('steel.dark')
const GLASS = () => mat('glass.dark')

/** steel track loop as one InstancedMesh of shoes (both sides) + frame, idler, sprocket, rollers */
function tracks(root) {
  const R = 0.42
  const half = 1.9
  const pitch = detail() === 'low' ? 0.3 : 0.2
  const per = 2 * half * 2 + 2 * Math.PI * R
  const n = Math.floor(per / pitch)
  const shoe = new THREE.BoxGeometry(0.72, 0.07, pitch * 0.9)
  const im = new THREE.InstancedMesh(shoe, colorMat('#141413', 0.75, 0.3), n * 2)
  const m = new THREE.Matrix4()
  const q = new THREE.Quaternion()
  const p = new THREE.Vector3()
  const one = new THREE.Vector3(1, 1, 1)
  let k = 0
  for (const s of [1, -1]) {
    for (let i = 0; i < n; i++) {
      // walk the loop: bottom straight, front arc, top straight, rear arc
      let d = (i / n) * per
      let y, z, a
      if (d < 2 * half) { z = -half + d; y = 0.45 - R; a = Math.PI }
      else if ((d -= 2 * half) < Math.PI * R) { const t = d / R; z = half + Math.sin(t) * R; y = 0.45 - Math.cos(t) * R; a = Math.PI - t }
      else if ((d -= Math.PI * R) < 2 * half) { z = half - d; y = 0.45 + R; a = 0 }
      else { d -= 2 * half; const t = d / R; z = -half - Math.sin(t) * R; y = 0.45 + Math.cos(t) * R; a = -t }
      // shoe normal = rotate +y by a about x -> (0, cos a, sin a); keep it pointing outward
      q.setFromAxisAngle(new THREE.Vector3(1, 0, 0), a)
      im.setMatrixAt(k++, m.compose(p.set(s * 1.35, y, z), q, one))
    }
    root.add(box(0.36, 0.42, 3.6, STEEL(), { x: s * 1.35, y: 0.45 }))
    root.add(cyl(0.38, 0.38, 0.44, STEEL(), { axis: 'x', x: s * 1.35, y: 0.45, z: half, seg: 14 }))
    root.add(cyl(0.36, 0.36, 0.5, colorMat('#3a3a38', 0.6, 0.5), { axis: 'x', x: s * 1.35, y: 0.45, z: -half, seg: 12 }))
    for (let i = 0; i < (detail() === 'low' ? 0 : 6); i++) root.add(cyl(0.12, 0.12, 0.5, STEEL(), { axis: 'x', x: s * 1.35, y: 0.16, z: -1.4 + i * 0.56, seg: 8 }))
    for (const z of [-0.8, 0.8]) root.add(cyl(0.08, 0.08, 0.3, STEEL(), { axis: 'x', x: s * 1.35, y: 0.84, z, seg: 8 }))
  }
  im.castShadow = true
  im.receiveShadow = true
  im.userData.keep = true
  root.add(im)
  root.add(box(2.0, 0.42, 2.2, STEEL(), { base: true, y: 0.5 }))
  root.add(cyl(0.95, 0.95, 0.18, STEEL(), { base: true, y: 0.92, seg: 18 }))
}
/** box between two [z, y] points in a pivot's frame (boom / arm plates) */
function beamZY(a, b, w, h, material, x = 0) {
  const dz = b[0] - a[0]
  const dy = b[1] - a[1]
  return box(w, h, Math.hypot(dz, dy) + h * 0.5, material, { x, y: (a[1] + b[1]) / 2, z: (a[0] + b[0]) / 2, rx: -Math.atan2(dy, dz) })
}

// J bucket side profile (pivot at 0,0; opens toward +z / up when rotation.x = 0)
const ARC = (cz, cy, r, a0, a1, n) => Array.from({ length: n + 1 }, (_, i) => { const a = a0 + ((a1 - a0) * i) / n; return [+(cz + Math.cos(a) * r).toFixed(3), +(cy + Math.sin(a) * r).toFixed(3)] })
const BUCKET = [...ARC(0.42, -0.42, 0.58, 2.4, 4.9, 8), [1.25, -0.62], [1.32, -0.5], ...ARC(0.42, -0.42, 0.46, 4.85, 2.45, 8)]

export function realExcavator() {
  const root = new THREE.Group()
  const rig = { wheels: [], steer: [], beacons: [], tracks: true }
  tracks(root)
  const upper = dynamic(pivot('upper', 0, 1.1, 0))
  // deck, engine hood, rounded counterweight, tool box, walkway plates
  upper.add(box(2.8, 0.35, 3.7, STEEL(), { base: true, z: -0.25 }))
  upper.add(box(2.8, 0.9, 1.7, PAINT(), { base: true, y: 0.35, z: -1.2, round: 0.08 }))
  const cw = cyl(1.4, 1.4, 1.05, mat('paint.dark'), { base: true, y: 0.25, z: -1.55, seg: 20 })
  cw.scale.z = 0.5
  upper.add(cw)
  upper.add(box(1.0, 0.75, 1.3, PAINT(), { base: true, x: -0.9, y: 0.35, z: 0.95, round: 0.06 }))
  for (let i = 0; i < 5; i++) upper.add(box(0.02, 0.4, 0.06, STEEL(), { x: 1.41, y: 0.85, z: -1.8 + i * 0.16, cast: false }))
  upper.add(decal('model', 0.8, 0.2, { x: 1.41, y: 0.95, z: -0.5, ry: Math.PI / 2 }))
  upper.add(decal('logo', 1.2, 0.26, { x: -1.41, y: 0.95, z: -1.1, ry: -Math.PI / 2 }))
  // cab: frame + glass shell + roof, left front
  upper.add(box(0.95, 1.65, 1.55, mat('steel.dark'), { base: true, x: 0.8, y: 0.35, z: 0.75, round: 0.05 }))
  upper.add(box(0.98, 1.1, 1.5, GLASS(), { x: 0.8, y: 1.45, z: 0.78, cast: false }))
  upper.add(box(1.02, 0.08, 1.62, PAINT(), { x: 0.8, y: 2.04, z: 0.75 }))
  upper.add(box(0.08, 0.6, 0.08, STEEL(), { x: 1.28, y: 1.2, z: 1.5, cast: false }))
  // handrails, exhaust, beacon, mirror
  for (let i = 0; i < 3; i++) upper.add(box(0.04, 0.5, 0.04, mat('paint.yellow'), { base: true, x: -1.35, y: 1.25, z: -1.8 + i * 0.7, cast: false }))
  upper.add(box(0.04, 0.04, 1.45, mat('paint.yellow'), { x: -1.35, y: 1.75, z: -1.1, cast: false }))
  upper.add(cyl(0.08, 0.08, 0.9, mat('chrome'), { base: true, x: -0.6, y: 1.2, z: -1.0 }))
  const bm = new THREE.MeshStandardMaterial({ color: '#7a4a00', emissive: '#ffa21a', emissiveIntensity: 0.2 })
  upper.add(cyl(0.11, 0.13, 0.18, bm, { base: true, x: 0.8, y: 2.08, z: 0.4, cast: false }))
  rig.beacons.push(bm)
  rig.exhaust = pivot('exhaust', -0.6, 2.15, -1.0)
  upper.add(rig.exhaust)
  // boom: banana in two plates (pivot -> knee -> tip at z 4.6)
  const K = [2.3, 1.15]
  const boom = dynamic(pivot('boom', -0.3, 1.0, 1.4))
  boom.add(beamZY([0, 0], K, 0.55, 0.7, PAINT()))
  boom.add(beamZY(K, [4.6, 0], 0.5, 0.62, PAINT()))
  boom.add(cyl(0.2, 0.2, 0.7, STEEL(), { axis: 'x', seg: 12 }))
  boom.add(cyl(0.18, 0.18, 0.66, STEEL(), { axis: 'x', z: 4.6, seg: 12 }))
  // arm (stick) with tail for the arm ram
  const arm = dynamic(pivot('arm', 0, 0, 4.6))
  arm.add(beamZY([-0.5, 0.45], [3.2, -0.05], 0.38, 0.5, PAINT()))
  arm.add(cyl(0.14, 0.14, 0.5, STEEL(), { axis: 'x', z: 3.2, seg: 10 }))
  // bucket + teeth + load
  const bucketLoad = dynamic(sphere(0.5, colorMat('#7a5a3c', 0.95), { hemi: true, y: -0.1, z: 0.45 }))
  bucketLoad.scale.set(0.95, 0.55, 0.8)
  bucketLoad.visible = false
  const bucket = dynamic(pivot('bucket', 0, 0, 3.2))
  bucket.add(extrude('bucket', BUCKET, 1.15, STEEL(), { bevel: 0.03, bevelSeg: 1 }))
  for (let i = 0; i < 5; i++) bucket.add(box(0.1, 0.06, 0.2, colorMat('#4a4846', 0.5, 0.6), { x: -0.44 + i * 0.22, y: -0.56, z: 1.36, rx: 0.3 }))
  bucket.add(box(1.15, 0.5, 0.05, STEEL(), { y: -0.35, z: -0.05, cast: false }))
  bucket.add(bucketLoad)
  arm.add(bucket)
  boom.add(arm)
  upper.add(boom)
  root.add(upper)
  // hydraulic rams (one skinned draw call): 2 boom rams, arm ram, bucket ram
  const ramsMesh = rams([
    { a: upper, pa: [-0.05, 0.7, 1.75], b: boom, pb: [0.25, -0.3, 2.0], r: 0.1 },
    { a: upper, pa: [-0.55, 0.7, 1.75], b: boom, pb: [-0.25, -0.3, 2.0], r: 0.1 },
    { a: boom, pa: [0, 1.5, 2.0], b: arm, pb: [0, 0.6, -0.45], r: 0.09 },
    { a: arm, pa: [0, 0.35, 0.4], b: bucket, pb: [0, 0.2, -0.15], r: 0.07, k: 0.55 }
  ], { barrel: '#c99a1a', rod: '#d8dcdf' })
  root.add(ramsMesh)
  Object.assign(rig, { upper, boom, arm, bucket, bucketLoad, rams: ramsMesh })
  return { root, rig }
}
/** tower crane detail on top of the truss build (rig keys untouched) */
export function towerExtras(root, { slew, trolley, hook, jibLen, counter }) {
  // foundation: anchor plinths + hazard band
  for (const [x, z] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) root.add(box(0.7, 0.35, 0.7, colorMat('#8e8a82', 0.9), { base: true, x: x * 1.0, y: 1.2, z: z * 1.0 }))
  for (const ry of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) root.add(decal('hazard', 5.4, 0.25, { y: 1.05, x: Math.sin(ry) * 2.76, z: Math.cos(ry) * 2.76, ry }))
  // cab frame + wipers / AC box, walkway + handrails along the jib, ballast stripes
  slew.add(box(0.08, 1.0, 0.08, mat('paint.dark'), { x: 2.68, y: 1.85, z: 2.12, cast: false }))
  slew.add(box(0.08, 1.0, 0.08, mat('paint.dark'), { x: 1.12, y: 1.85, z: 2.12, cast: false }))
  slew.add(box(0.5, 0.35, 0.4, colorMat('#d8d8d4', 0.5), { x: 1.9, y: 2.65, z: 0.8 }))
  // counter-jib walkway (the main jib keeps its bottom clear for the trolley)
  slew.add(box(1.6, 0.04, counter - 2, mat('steel'), { y: 1.25, z: -counter / 2 - 0.5, cast: false }))
  for (let i = 0; i < 4; i++) for (const s of [1, -1]) slew.add(decal('redwhite', 0.85, 0.3, { x: s * 1.205, y: -0.2, z: -counter + 0.6 + i * 0.95, ry: s * Math.PI / 2 }))
  slew.add(decal('logo', 1.8, 0.4, { x: 1.21, y: 1.0, z: -0.6, ry: Math.PI / 2 }))
  // hoist winch drum on the counter-jib
  slew.add(cyl(0.45, 0.45, 1.2, STEEL(), { axis: 'x', y: 1.75, z: -6, seg: 14 }))
  // trolley: wheels + sheaves
  for (const sx of [1, -1]) for (const sz of [0.5, -0.5]) trolley.add(cyl(0.12, 0.12, 0.08, STEEL(), { axis: 'x', x: sx * 0.75, y: 0.25, z: sz, seg: 8, cast: false }))
  for (const sx of [0.25, -0.25]) trolley.add(cyl(0.22, 0.22, 0.08, mat('steel'), { axis: 'x', x: sx, y: -0.25, seg: 12, cast: false }))
  // hook block: cheek plates, sheaves, swivel and a curved hook
  for (const sx of [1, -1]) hook.add(box(0.06, 0.75, 0.62, mat('paint.yellow'), { x: sx * 0.48, y: 0.15 }))
  hook.add(cyl(0.26, 0.26, 0.7, STEEL(), { axis: 'x', y: 0.25, seg: 12 }))
  hook.add(decal('hazard', 0.6, 0.3, { y: 0.0, z: 0.27 }))
  const tor = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.05, 6, 12, Math.PI * 1.5), mat('steel.dark'))
  tor.position.set(0, -0.72, 0)
  tor.rotation.set(0, Math.PI / 2, Math.PI / 4)
  tor.castShadow = true
  hook.add(tor)
}

/** red/white hazard skin on outrigger beams + pads */
function outriggerSkin(list, len) {
  for (const o of list) {
    const s = o.userData.side
    for (const ry of [0, Math.PI]) o.add(decal('redwhite', len, 0.22, { x: s * len / 2, z: ry ? -0.21 : 0.21, ry }))
  }
}

/** mobile crane: luff ram, counterweight stack, hazard outriggers, boom-head sheaves */
export function mobileCraneExtras(t, rig) {
  const { upper, sections } = rig
  for (let i = 0; i < 3; i++) upper.add(box(2.2, 0.28, 0.8, mat('paint.dark'), { base: true, y: 0.1 + i * 0.3, z: -2.05 }))
  upper.add(decal('logo', 1.4, 0.3, { x: 1.31, y: 0.7, z: 0.2, ry: Math.PI / 2 }))
  const head = sections[2]
  head.add(cyl(0.28, 0.28, 0.4, STEEL(), { axis: 'x', y: 0.05, z: 7.05, seg: 12 }))
  for (const sec of sections) sec.add(box(0.06, 0.06, 6.6, STEEL(), { y: 0.42 - sections.indexOf(sec) * 0.08, z: 3.5, cast: false }))
  outriggerSkin(rig.outriggers, 2.2)
  const m = rams([{ a: upper, pa: [-0.3, 0.6, 1.0], b: sections[0], pb: [0, -0.42, 3.0], r: 0.17, k: 0.6 }], { barrel: '#b8261c', rod: '#d8dcdf' })
  t.root.add(m)
  rig.rams = m
}

/** pump truck: boom-lift ram, pipe clamps, hazard outriggers, hopper funnel */
export function pumpExtras(t, rig) {
  const [b0, b1] = rig.booms
  outriggerSkin(rig.outriggers, 2)
  for (const [b, L] of [[b0, 14], [b1, 12]]) for (let z = 1; z < L; z += 2.4) b.add(box(0.2, 0.06, 0.12, STEEL(), { y: 0.38, z, cast: false }))
  t.root.add(cyl(0.7, 0.35, 0.6, mat('steel'), { base: true, y: t.deckY + 0.4, z: -5.4, seg: 14 }))
  const m = rams([{ a: rig.turret, pa: [0, 0.75, 0.75], b: b0, pb: [0, -0.3, 2.4], r: 0.14, k: 0.85 }], { barrel: '#e8e8e4', rod: '#d8dcdf' })
  t.root.add(m)
  rig.rams = m
}
