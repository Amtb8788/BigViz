// Park pack - access: plate-recognition gates (island, booth, two boom barriers that lift,
// LPR cameras, LED greeting boards, steel canopy with the park name), garage ramps (sloped
// grooved floor, retaining walls + parapets, arched glass canopy, lit portal with height bar)
// and the perimeter railing (cast-iron style pickets as alpha-tested cards, real posts / rails).

import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { lightMat, colorMat, surfaceMat } from '../../render/materials.js'
import { makeCanvas } from '../../render/textures.js'
import { Quads, boxes, cyls, M, signMaterial, plane } from './kit.js'
import { GATE, RAMP, ROAD, BIKE_W } from './layout.js'

const V = (x, y, z) => new THREE.Vector3(x, y, z)

/** ramp floor depth at s metres down the ramp (0 at the kerb): eased in / out, ~14 % */
export function rampDepth(s) {
  const { L, D, blend: b } = RAMP
  if (s <= 0) return 0
  if (s >= L) return D
  const k = D / (L - b)
  if (s < b) return (k * s * s) / (2 * b)
  if (s > L - b) return D - (k * (L - s) ** 2) / (2 * b)
  return k * (s - b / 2)
}
/** ramp pitch (radians, nose down positive) at s */
export const rampPitch = (s) => Math.atan((rampDepth(s + 0.5) - rampDepth(s - 0.5)))

let stripeMat = null
function armMaterial() {
  if (stripeMat) return stripeMat
  const c = makeCanvas(256, 16)
  const x = c.getContext('2d')
  for (let i = 0; i < 8; i++) { x.fillStyle = i % 2 ? '#d9d6cf' : '#b2261f'; x.fillRect(i * 32, 0, 32, 16) }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  stripeMat = new THREE.MeshStandardMaterial({ map: t, roughness: 0.45, metalness: 0.1, name: 'gate.arm' })
  return stripeMat
}

/** Gate island at the road axis; local +z = south (outbound side). rig.armIn / armOut lift. */
export function parkGate({ sign = '云栖科技园' } = {}) {
  const g = new THREE.Group()
  const I = GATE.island / 2
  const solid = [[0, 0.09, 0, GATE.island, 0.18, 10]]
  const dark = []
  const alu = []
  // booth: glass box on a plinth, flat roof with an overhang
  dark.push([0, 0.35, 0, 1.3, 0.35, 2.3], [0, 2.75, 0, 1.6, 0.18, 2.8])
  const G = new Quads()
  G.ring(0, 0, 1.2, 2.1, 0.55, 2.65, 1, 1)
  g.add(G.mesh(M.clearGlass(), false))
  for (const [x, z] of [[0.6, 1.05], [-0.6, 1.05], [0.6, -1.05], [-0.6, -1.05]]) alu.push([x, 1.6, z, 0.08, 2.1, 0.08])
  g.add(plane(1.0, 0.5, M.lamp('#cfe6ff', 0.5), { y: 2.2, z: 0 }))
  // barrier cabinets + arms (pivot at the cabinet top, arm along +x inbound / -x outbound)
  const arm = (side, z) => {
    const x = side * (I - 0.28)
    dark.push([x, 0.55, z, 0.38, 1.1, 0.34])
    const p = new THREE.Group()
    p.position.set(x, GATE.armY, z)
    const m = new THREE.Mesh(new THREE.BoxGeometry(GATE.arm, 0.09, 0.07).translate(side * (GATE.arm / 2 + 0.1), 0, 0), armMaterial())
    m.castShadow = true
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.08).translate(side * (GATE.arm * 0.5), 0.07, 0), lightMat('#ff4030', 2.4, 'vehicle'))
    p.add(m, lamp)
    g.add(p)
    return p
  }
  const armIn = arm(1, GATE.armIn)
  const armOut = arm(-1, GATE.armOut)
  // LPR cameras on short posts at each island end, LED boards facing the drivers
  for (const [z, dir, txt] of [[-4.6, -1, '欢迎光临'], [4.6, 1, '一路顺风']]) {
    dark.push([0, 1.0, z, 0.12, 2.0, 0.12], [0, 2.05, z + dir * 0.18, 0.22, 0.2, 0.42])
    const b = plane(1.1, 0.42, signMaterial(txt, { bg: '#0c1014', fg: '#3dff8a', glow: '#3dff8a', k: 1.8, w: 512, h: 192 }), { y: 1.45, z: z + dir * 0.08, ry: dir > 0 ? 0 : Math.PI })
    g.add(b)
  }
  // canopy: four columns outside the bike lanes, beam + roof slab, lit soffit, park sign
  const cx = ROAD.half + BIKE_W + 1.25
  for (const x of [-cx, cx]) for (const z of [-2.2, 2.2]) solid.push([x, 3.3, z, 0.7, 6.6, 0.7])
  solid.push([0, 6.85, 0, cx * 2 + 1.4, 0.5, 6.4])
  alu.push([0, 7.35, 0, cx * 2 + 2.2, 0.5, 7.6])
  g.add(boxes([[0, 6.57, 0, cx * 2 - 0.6, 0.04, 5.6]], M.lamp('#fff3dc', 1.2), { cast: false }))
  g.add(plane(cx * 1.6, 1.0, signMaterial(sign, { k: 1.6, sub: 'YUNQI TECH PARK' }), { y: 6.9, z: 3.24 }))
  g.add(boxes(solid, M.stone()), boxes(dark, M.aluDark()), boxes(alu, M.alu()))
  // stop line + "减速慢行" on the inbound lane
  g.add(boxes([[ROAD.lane, 0.07, GATE.armIn - 1.6, 3.2, 0.02, 0.35]], colorMat('#e4e2da', 0.6), { cast: false }))
  g.userData.glows = [{ pos: V(0, 6.3, 0), group: 'street', color: '#ffe0b0', size: 3.2, pool: 9 }]
  return { object: g, rig: { armIn, armOut, liftIn: 0, liftOut: 0 } }
}
/** Garage ramp, local +z = down the ramp, x across, origin at the road kerb (grade 0) */
export function parkRamp({ sign = '地下车库 P1' } = {}) {
  const g = new THREE.Group()
  const { w, open, roof } = RAMP
  const hw = w / 2
  const PAR = 1.05
  // grooved floor (sampled depth), side walls, parapets
  const F = new Quads()
  const groove = new Quads()
  const wall = new Quads()
  for (let s = 0; s < roof; s += 0.5) {
    const y0 = -rampDepth(s)
    const y1 = -rampDepth(s + 0.5)
    F.quad([[-hw, y0, s], [hw, y0, s], [hw, y1, s + 0.5], [-hw, y1, s + 0.5]], [0, 1, 0], [[0, s / 4], [w / 4, s / 4], [w / 4, (s + 0.5) / 4], [0, (s + 0.5) / 4]])
    if (s > 0.5 && s < open + 3 && Math.round(s * 2) % 2 === 0) groove.quad([[-hw + 0.3, y0 + 0.015, s], [hw - 0.3, y0 + 0.015, s], [hw - 0.3, y1 + 0.015, s + 0.12], [-hw + 0.3, y1 + 0.015, s + 0.12]], [0, 1, 0], [[0, 0], [1, 0], [1, 1], [0, 1]])
    const top = s < open ? PAR : -0.25
    for (const sx of [-1, 1]) wall.quad([[sx * hw, y0 - 0.2, s], [sx * hw, y1 - 0.2, s + 0.5], [sx * hw, top, s + 0.5], [sx * hw, top, s]], [-sx, 0, 0], [[s / 2, y0 / 2], [(s + 0.5) / 2, y1 / 2], [(s + 0.5) / 2, top / 2], [s / 2, top / 2]])
  }
  for (const sx of [-1, 1]) wall.quad([[sx * (hw + 0.3), 0.1, 0.3], [sx * (hw + 0.3), 0.1, open], [sx * (hw + 0.3), PAR, open], [sx * (hw + 0.3), PAR, 0.3]], [sx, 0, 0], [[0, 0], [open / 2, 0], [open / 2, 0.5], [0, 0.5]])
  wall.quad([[-hw, -RAMP.D - 0.3, roof], [hw, -RAMP.D - 0.3, roof], [hw, -0.25, roof], [-hw, -0.25, roof]], [0, 0, -1], [[0, 0], [3, 0], [3, 2], [0, 2]])
  g.add(F.mesh(surfaceMat('concrete', 1), false), groove.mesh(colorMat('#6e6b65', 0.95), false), wall.mesh(M.concrete()))
  const cap = [[-hw - 0.15, PAR + 0.06, open / 2 + 0.15, 0.36, 0.12, open - 0.3], [hw + 0.15, PAR + 0.06, open / 2 + 0.15, 0.36, 0.12, open - 0.3]]
  // garage ceiling (under the plaza slab), tube lights, portal fascia + sign, height bar
  const C = new Quads()
  C.rect(-hw, open, hw, roof, -0.25, -1, 2)
  g.add(C.mesh(colorMat('#3b3d40', 0.9), false))
  const tubes = []
  for (let s = open + 1.5; s < roof; s += 3) tubes.push([-1.6, -0.34, s, 0.12, 0.06, 1.4], [1.6, -0.34, s, 0.12, 0.06, 1.4])
  g.add(boxes(tubes, M.lamp('#e8f4ff', 2.2), { cast: false }))
  cap.push([0, PAR / 2 - 0.1, open, w + 0.6, PAR + 0.5, 0.4])
  g.add(boxes(cap, M.stone()))
  g.add(plane(w * 0.82, 0.62, signMaterial(sign, { bg: '#1e3f73', fg: '#ffffff', glow: '#cfe0ff', k: 1.4 }), { y: PAR * 0.55, z: open - 0.21, ry: Math.PI }))
  const bar = [[0, -0.55, open - 2.2, w - 0.6, 0.18, 0.12]]
  g.add(boxes(bar, armMaterial(), { cast: false }), boxes([[-hw + 0.5, 0.25, open - 2.2, 0.03, 1.4, 0.03], [hw - 0.5, 0.25, open - 2.2, 0.03, 1.4, 0.03]], M.black(), { cast: false }))
  // arched glass canopy over the open ramp: steel ribs every 4 m + curved glazing
  const ribs = []
  const prof = Array.from({ length: 9 }, (_, i) => { const a = Math.PI - (i / 8) * Math.PI; return [Math.cos(a) * (hw + 0.2), PAR + 0.12 + Math.sin(a) * 2.4] })
  for (let s = 2; s <= open - 1; s += 4) {
    for (let i = 0; i < 8; i++) {
      const [x0, y0] = prof[i]
      const [x1, y1] = prof[i + 1]
      const L = Math.hypot(x1 - x0, y1 - y0)
      const b = new THREE.BoxGeometry(L + 0.05, 0.14, 0.14)
      b.rotateZ(Math.atan2(y1 - y0, x1 - x0))
      b.translate((x0 + x1) / 2, (y0 + y1) / 2, s)
      ribs.push(b)
    }
  }
  const rm = new THREE.Mesh(mergeG(ribs), M.steel())
  rm.castShadow = true
  const GL = new Quads()
  for (let i = 0; i < 8; i++) {
    const [x0, y0] = prof[i]
    const [x1, y1] = prof[i + 1]
    GL.quad([[x0, y0, 2], [x1, y1, 2], [x1, y1, open - 1], [x0, y0, open - 1]], [-(y1 - y0), x1 - x0, 0], [[0, 0], [1, 0], [1, 1], [0, 1]])
  }
  g.add(rm, GL.mesh(M.balGlass(), false))
  return { object: g, rig: {} }
}

function mergeG(list) {
  const m = mergeGeometries(list, false)
  list.forEach((x) => x.dispose())
  return m
}

let picketMat = null
function picketMaterial() {
  if (picketMat) return picketMat
  const c = makeCanvas(256, 128)
  const x = c.getContext('2d')
  x.clearRect(0, 0, 256, 128)
  x.fillStyle = '#26292c'
  for (let i = 0; i < 16; i++) {
    const px = i * 16 + 7
    x.fillRect(px, 10, 3, 118)
    x.beginPath(); x.moveTo(px - 2, 12); x.lineTo(px + 1.5, 2); x.lineTo(px + 5, 12); x.fill()
  }
  x.fillRect(0, 20, 256, 3)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.wrapS = THREE.RepeatWrapping
  t.anisotropy = 8
  picketMat = new THREE.MeshStandardMaterial({ map: t, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.5, metalness: 0.6, name: 'railing.pickets' })
  return picketMat
}

/** Perimeter railing along polylines [[x, z], ...] (world coordinates; prefab at origin) */
export function parkRailing({ runs = [], h = 1.8 } = {}) {
  const g = new THREE.Group()
  const posts = []
  const rails = []
  const cards = []
  for (const [a, b] of runs) {
    const L = Math.hypot(b[0] - a[0], b[1] - a[1])
    const ry = -Math.atan2(b[1] - a[1], b[0] - a[0])
    const n = Math.max(1, Math.round(L / 2.5))
    for (let i = 0; i <= n; i++) { const t = i / n; posts.push([a[0] + (b[0] - a[0]) * t, h / 2 + 0.05, a[1] + (b[1] - a[1]) * t, 0.1, h + 0.1, 0.1, ry]) }
    const cx = (a[0] + b[0]) / 2
    const cz = (a[1] + b[1]) / 2
    rails.push([cx, h - 0.25, cz, L, 0.05, 0.05, ry], [cx, 0.2, cz, L, 0.06, 0.06, ry], [cx, 0.06, cz, L, 0.12, 0.25, ry])
    const p = new THREE.PlaneGeometry(L, h - 0.2)
    const uv = p.attributes.uv
    for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * (L / 2.5))
    p.rotateY(ry)
    p.translate(cx, (h - 0.2) / 2 + 0.15, cz)
    cards.push(p)
  }
  g.add(boxes(posts, M.black()), boxes(rails, M.black()))
  const cm = new THREE.Mesh(mergeG(cards), picketMaterial())
  cm.castShadow = false
  cm.receiveShadow = true
  g.add(cm)
  return { object: g, rig: {} }
}
