// Realistic people ('realistic' style): one SkinnedMesh per person (one draw call), 1.75 m,
// 7.5-head proportions. Bones carry the same names as the diorama pivots (hips, spine, head,
// legL/R, armL/R, hand, handL, carry) plus kneeL/R and elbowL/R, so animate-people.js and
// render/assets.js keep working. Tools / carried items attach to the hand / carry bones.

import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { tone } from '../render/materials.js'
import { detail, vcSkinMat } from './kit.js'

// bind-pose joint heights (m, world space, person standing at origin facing +z)
export const BODY = { hip: 0.92, knee: 0.5, ankle: 0.085, waist: 1.0, shoulder: 1.44, elbow: 1.15, wrist: 0.9, neck: 1.5, head: 1.63, top: 1.75 }
const SH_X = 0.2
const LEG_X = 0.095

const SKIN = ['#c99a78', '#b8845e', '#a5704c', '#8a5a3a', '#6e4630', '#d2a888', '#9c6a48']
const VEST = { worker: ['#ff7a1a', '#d8f03a'], rigger: ['#ff7a1a'], welder: ['#d8f03a'], flagman: ['#ff7a1a'], foreman: ['#d8f03a'], safety: ['#ff7a1a'] }
const HELMET = { worker: '#f2c21b', welder: '#f2c21b', rigger: '#d63b26', flagman: '#d63b26', safety: '#d63b26', foreman: '#f4f4f0' }
const WORK_SHIRT = ['#2d3b52', '#3a4650', '#4b5560', '#2f4a6a']
const WORK_PANTS = ['#2a3140', '#3b4048', '#4a4234', '#2e3b4e']

/** geometry accumulator: every part is rigid to one bone, or blended between two along y */
class Body {
  constructor(bones) { this.bones = bones; this.parts = [] }
  add(geo, color, bone, blend) {
    const g = geo.index ? geo.toNonIndexed() : geo
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k)
    const n = g.attributes.position.count
    const c = new THREE.Color(color)
    const col = new Float32Array(n * 3)
    const si = new Uint16Array(n * 4)
    const sw = new Float32Array(n * 4)
    const b0 = this.bones.indexOf(bone)
    const b1 = blend ? this.bones.indexOf(blend.to) : b0
    for (let i = 0; i < n; i++) {
      col.set([c.r, c.g, c.b], i * 3)
      let w = 0
      if (blend) {
        const y = g.attributes.position.getY(i)
        // blend.y0 (fully bone) -> blend.y1 (fully blend.to)
        w = THREE.MathUtils.smoothstep(y, Math.min(blend.y0, blend.y1), Math.max(blend.y0, blend.y1))
        if (blend.y1 < blend.y0) w = 1 - w
      }
      si[i * 4] = b0; si[i * 4 + 1] = b1
      sw[i * 4] = 1 - w; sw[i * 4 + 1] = w
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3))
    g.setAttribute('skinIndex', new THREE.BufferAttribute(si, 4))
    g.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4))
    this.parts.push(g)
  }
  merge() { const m = mergeGeometries(this.parts, false); this.parts.forEach((g) => g.dispose()); return m }
}
// raw geometry placed in bind (world) space
const seg = (hi, lo) => (detail() === 'low' ? lo : hi)
function cylG(rt, rb, h, x, y, z, { sx = 1, sz = 1, s = 10, open = false, rx = 0 } = {}) {
  const g = new THREE.CylinderGeometry(rt, rb, h, seg(Math.min(s, 10), 6), 1, open)
  g.scale(sx, 1, sz)
  if (rx) g.rotateX(rx)
  return g.translate(x, y, z)
}
function boxG(w, h, d, x, y, z, r = 0, { rx = 0 } = {}) {
  // rounding only on the big parts (pelvis); small parts stay plain boxes (24 vs ~600 tris)
  const g = r >= 0.05 ? new RoundedBoxGeometry(w, h, d, 1, r) : new THREE.BoxGeometry(w, h, d)
  if (rx) g.rotateX(rx)
  return g.translate(x, y, z)
}
function sphG(r, x, y, z, { sx = 1, sy = 1, sz = 1, s = 12, hemi = false, rx = 0 } = {}) {
  const g = new THREE.SphereGeometry(r, seg(Math.min(s, 12), 8), seg(Math.min(s, 12) >> 1, 4), 0, Math.PI * 2, 0, hemi ? Math.PI / 2 : Math.PI)
  g.scale(sx, sy, sz)
  if (rx) g.rotateX(rx)
  return g.translate(x, y, z)
}

function makeBones() {
  const B = (name, x, y, z, parent) => { const b = new THREE.Bone(); b.name = name; b.position.set(x, y, z); parent?.add(b); return b }
  const { hip, knee, waist, shoulder, elbow, wrist, neck } = BODY
  const hips = B('hips', 0, 0, 0)
  const legL = B('legL', LEG_X, hip, 0, hips)
  const legR = B('legR', -LEG_X, hip, 0, hips)
  const kneeL = B('kneeL', 0, knee - hip, 0, legL)
  const kneeR = B('kneeR', 0, knee - hip, 0, legR)
  const spine = B('spine', 0, waist, 0, hips)
  const head = B('head', 0, neck - waist, 0, spine)
  const armL = B('armL', SH_X, shoulder - waist, 0, spine)
  const armR = B('armR', -SH_X, shoulder - waist, 0, spine)
  const elbowL = B('elbowL', 0, elbow - shoulder, 0, armL)
  const elbowR = B('elbowR', 0, elbow - shoulder, 0, armR)
  // hand slot sits in the palm (grip point) a little below the wrist
  const handL = B('handL', 0, wrist - elbow - 0.07, 0.02, elbowL)
  const hand = B('hand', 0, wrist - elbow - 0.07, 0.02, elbowR)
  const carry = B('carry', 0, 0.32, 0.36, spine)
  return { hips, legL, legR, kneeL, kneeR, spine, head, armL, armR, elbowL, elbowR, hand, handL, carry }
}
function palette(p, civilian) {
  const seed = p.seed ?? 0
  const pick = (a, k = 0) => a[(seed + k) % a.length]
  const role = p.role || 'worker'
  const cloth = (c) => '#' + tone(c).getHexString()
  return {
    skin: p.skin || pick(SKIN, 3),
    shirt: p.shirt ? cloth(p.shirt) : civilian ? '#6b7686' : pick(WORK_SHIRT, 1),
    pants: p.pants ? cloth(p.pants) : civilian ? '#33373d' : pick(WORK_PANTS, 2),
    vest: pick(VEST[role] || VEST.worker),
    helmet: HELMET[role] || HELMET.worker,
    hair: p.hair ? cloth(p.hair) : pick(['#2b211b', '#3d2c20', '#1c1a18', '#5a4632']),
    boot: civilian ? '#2c2c2e' : '#4a3424',
    glove: civilian ? null : pick(['#c8a46a', '#3a3d42', '#d8c9a0'], 4)
  }
}

function legs(b, bn, c, civilian) {
  const { hip, knee, ankle } = BODY
  for (const [s, leg, kn] of [[1, bn.legL, bn.kneeL], [-1, bn.legR, bn.kneeR]]) {
    const x = s * LEG_X
    b.add(cylG(0.082, 0.062, hip - knee + 0.06, x, (hip + knee) / 2 + 0.02, 0, { sz: 1.1 }), c.pants, leg, { y0: knee + 0.08, y1: knee - 0.02, to: kn })
    b.add(cylG(0.06, 0.05, knee - ankle - 0.05, x, (knee + ankle) / 2 + 0.03, 0, { sz: 1.08 }), c.pants, kn)
    // boot: upper, toe cap, sole
    b.add(boxG(0.11, 0.12, 0.17, x, 0.08, 0.025, 0.035), c.boot, kn)
    b.add(boxG(0.1, 0.07, 0.11, x, 0.045, 0.11, 0.03), c.boot, kn)
    b.add(boxG(0.115, 0.03, 0.27, x, 0.015, 0.045, civilian ? 0 : 0.01), civilian ? '#d8d8d4' : '#1e1c1a', kn)
  }
}

function torso(b, bn, c, civilian) {
  const { waist, shoulder, neck, hip } = BODY
  b.add(boxG(0.32, 0.18, 0.2, 0, hip + 0.04, 0, 0.06), c.pants, bn.hips)
  b.add(cylG(0.15, 0.15, 0.05, 0, waist - 0.01, 0, { sz: 0.66 }), '#2a2622', bn.hips)
  // chest: wider at the shoulders, flattened front-back
  b.add(cylG(0.2, 0.155, shoulder - waist + 0.02, 0, (shoulder + waist) / 2, 0, { sz: 0.62, s: 12 }), c.shirt, bn.spine)
  b.add(sphG(0.2, 0, shoulder - 0.01, 0, { sy: 0.32, sz: 0.62, hemi: true }), c.shirt, bn.spine)
  b.add(cylG(0.055, 0.06, 0.1, 0, neck + 0.02, 0.005, { s: 8 }), c.skin, bn.head, { y0: neck + 0.06, y1: neck - 0.04, to: bn.spine })
  if (!civilian) {
    // hi-vis vest over the shirt, two retroreflective bands + braces over the shoulders
    b.add(cylG(0.212, 0.168, 0.4, 0, waist + 0.25, 0, { sz: 0.66, s: 12, open: true }), c.vest, bn.spine)
    const vr = (y) => 0.168 + ((y - waist - 0.05) / 0.4) * 0.044 + 0.005
    for (const y of [waist + 0.12, waist + 0.26]) b.add(cylG(vr(y + 0.018), vr(y - 0.018), 0.036, 0, y, 0, { sz: 0.665, s: 12, open: true }), '#e4e8ea', bn.spine)
    for (const s of [1, -1]) b.add(boxG(0.035, 0.03, 0.26, s * 0.1, shoulder + 0.035, 0, 0.012), '#e4e8ea', bn.spine)
  }
}
function headParts(b, bn, c, civilian) {
  const { head } = BODY
  b.add(sphG(0.1, 0, head, 0.005, { sx: 0.82, sy: 1.08, sz: 0.95, s: 14 }), c.skin, bn.head)
  b.add(boxG(0.022, 0.04, 0.03, 0, head - 0.005, 0.098, 0.01), c.skin, bn.head)
  for (const s of [1, -1]) {
    b.add(sphG(0.024, s * 0.082, head, -0.005, { sx: 0.5, s: 6 }), c.skin, bn.head)
    b.add(boxG(0.024, 0.012, 0.01, s * 0.032, head + 0.02, 0.088), '#2a221c', bn.head)
  }
  if (civilian) {
    b.add(sphG(0.106, 0, head + 0.012, -0.008, { sx: 0.85, sy: 0.95, sz: 1, hemi: true, s: 12, rx: -0.25 }), c.hair, bn.head)
    return
  }
  // hard hat: shell, brim (peak longer at the front), ridge, dark suspension band
  b.add(sphG(0.118, 0, head + 0.035, 0, { sx: 0.92, sy: 0.88, sz: 1.05, hemi: true, s: 14 }), c.helmet, bn.head)
  b.add(cylG(0.13, 0.13, 0.012, 0, head + 0.035, 0.018, { sx: 0.88, sz: 1.16, s: 14 }), c.helmet, bn.head)
  b.add(boxG(0.03, 0.022, 0.2, 0, head + 0.137, 0, 0.01), c.helmet, bn.head)
  b.add(cylG(0.104, 0.104, 0.018, 0, head + 0.026, 0, { sx: 0.86, sz: 1.02, s: 12, open: true }), '#262626', bn.head)
}

function arms(b, bn, c, civilian) {
  const { shoulder, elbow, wrist } = BODY
  for (const [s, arm, el, hand] of [[1, bn.armL, bn.elbowL, bn.handL], [-1, bn.armR, bn.elbowR, bn.hand]]) {
    const x = s * SH_X
    b.add(sphG(0.06, x, shoulder - 0.015, 0, { s: 10 }), c.shirt, arm)
    b.add(cylG(0.052, 0.042, shoulder - elbow + 0.02, x, (shoulder + elbow) / 2, 0), c.shirt, arm, { y0: elbow + 0.07, y1: elbow - 0.02, to: el })
    const fore = civilian ? c.skin : c.shirt
    b.add(cylG(0.04, 0.033, elbow - wrist, x, (elbow + wrist) / 2, 0), fore, el)
    // hand / glove: palm block + thumb
    const hc = c.glove || c.skin
    b.add(boxG(0.045, 0.1, 0.085, x, wrist - 0.05, 0.008, 0.02), hc, hand)
    b.add(boxG(0.025, 0.05, 0.025, x - s * 0.012, wrist - 0.035, 0.045, 0.01), hc, hand)
    if (!civilian) b.add(cylG(0.043, 0.04, 0.035, x, wrist + 0.005, 0, { s: 8 }), hc, el)
  }
}

/**
 * @param {{ role?: string, shirt?: string, pants?: string, civilian?: boolean, hair?: string, child?: boolean, seed?: number, skin?: string }} p
 */
export function realHuman(p = {}) {
  const civilian = !!p.civilian
  const bn = makeBones()
  const list = Object.values(bn)
  const b = new Body(list)
  const c = palette(p, civilian)
  legs(b, bn, c, civilian)
  torso(b, bn, c, civilian)
  headParts(b, bn, c, civilian)
  arms(b, bn, c, civilian)
  const geo = b.merge()
  geo.computeBoundingBox()
  geo.computeBoundingSphere()
  const mesh = new THREE.SkinnedMesh(geo, vcSkinMat())
  mesh.name = 'body'
  mesh.castShadow = true
  mesh.receiveShadow = true
  mesh.userData.keep = true
  const root = new THREE.Group()
  root.name = civilian ? 'civilian' : `worker.${p.role || 'worker'}`
  root.add(bn.hips, mesh)
  root.updateMatrixWorld(true)
  mesh.bind(new THREE.Skeleton(list))
  if (p.child) root.scale.setScalar(0.62)
  for (const o of list) o.userData.dynamic = true
  return { root, bones: bn, mesh }
}
