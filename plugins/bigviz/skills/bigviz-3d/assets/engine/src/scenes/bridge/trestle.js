// Bridge pack - steel access trestles (钢栈桥) from both banks to the main pier platforms:
// pipe piles, cap beams, Bailey truss girders (alpha-cut texture), I-beam distribution, chequer
// plate deck, yellow / black handrails; bank pads; trailer concrete pumps.

import * as THREE from 'three'
import { mat, colorMat } from '../../render/materials.js'
import { box, cyl, group, bakeTree } from '../../prefabs/kit.js'
import { makeCanvas } from '../../render/textures.js'
import { TRESTLE, PLATFORM, PAD, groundY } from './layout.js'

let baileyMat
/** Bailey panel (3 m x 1.5 m): chords, verticals, diagonals as an alpha-tested texture */
function bailey() {
  if (baileyMat) return baileyMat
  const W = 256; const H = 128
  const c = makeCanvas(W, H)
  const g = c.getContext('2d')
  g.clearRect(0, 0, W, H)
  g.strokeStyle = '#b5512c'
  g.lineCap = 'square'
  g.lineWidth = 12
  g.beginPath(); g.moveTo(0, 8); g.lineTo(W, 8); g.moveTo(0, H - 8); g.lineTo(W, H - 8); g.stroke()
  g.lineWidth = 7
  g.beginPath()
  for (const x of [4, W / 2, W - 4]) { g.moveTo(x, 8); g.lineTo(x, H - 8) }
  g.moveTo(4, H - 8); g.lineTo(W / 2, 8); g.lineTo(W - 4, H - 8)
  g.moveTo(4, 8); g.lineTo(W / 4, H - 8); g.moveTo(W - 4, 8); g.lineTo(W * 0.75, H - 8)
  g.stroke()
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.wrapS = THREE.RepeatWrapping
  t.anisotropy = 8
  baileyMat = new THREE.MeshStandardMaterial({ map: t, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.6, metalness: 0.35, color: '#c9c3bd' })
  baileyMat.name = 'bridge.bailey'
  return baileyMat
}

/** Bailey girder line along x from x0 to x1 at z, top at y (two panels side by side) */
function baileyLine(root, x0, x1, z, y) {
  const len = Math.abs(x1 - x0)
  for (const dz of [-0.25, 0.25]) {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(len, 1.5), bailey())
    p.geometry.attributes.uv.array.forEach((v, i, a) => { if (i % 2 === 0) a[i] = v * (len / 3) })
    p.position.set((x0 + x1) / 2, y - 0.75, z + dz)
    p.castShadow = true
    p.userData.keep = true
    root.add(p)
  }
}

/** handrail along x at z: posts every 1.5 m, 2 rails, toe board; yellow/black */
function railX(root, x0, x1, z, y) {
  const yel = mat('paint.yellow')
  const len = Math.abs(x1 - x0)
  root.add(box(len, 0.06, 0.06, yel, { x: (x0 + x1) / 2, y: y + 1.15, z }), box(len, 0.05, 0.05, yel, { x: (x0 + x1) / 2, y: y + 0.6, z }), box(len, 0.18, 0.03, mat('paint.dark'), { x: (x0 + x1) / 2, y: y + 0.09, z }))
  for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x += 1.5) root.add(box(0.06, 1.15, 0.06, (Math.round(x / 1.5) % 2) ? yel : mat('paint.dark'), { x, y: y + 0.58, z }))
}

/** deck span: piles every 12 m, cap beams, Bailey lines, cross beams, plate */
function deckSpan(root, x0, x1, z0, z1, y, pileStep = 12) {
  const pile = colorMat('#6f5a48', 0.6, 0.6)
  const cz = (z0 + z1) / 2
  const w = z1 - z0
  const capY = y - 0.25 - 1.5 - 0.45
  for (let x = x0 + 1; x <= x1 - 0.5; x += pileStep) {
    for (const dz of [-w / 2 + 0.8, w / 2 - 0.8]) {
      const g = groundY(x, cz + dz) - 4
      root.add(cyl(0.32, 0.32, capY - g, pile, { base: true, x, y: g, z: cz + dz, seg: 12 }))
    }
    root.add(box(0.7, 0.6, w, mat('steel.dark'), { x, y: capY + 0.15, z: cz }))
    const br = box(0.12, 0.12, Math.hypot(w - 1.6, 3), mat('steel.dark'), { x, y: capY - 1.6, z: cz })
    br.rotation.x = Math.atan2(3, w - 1.6)
    root.add(br)
  }
  for (const dz of [-w / 2 + 1.2, -1.1, 1.1, w / 2 - 1.2]) baileyLine(root, x0, x1, cz + dz, y - 0.25)
  for (let x = x0 + 0.3; x < x1; x += 0.75) root.add(box(0.2, 0.2, w, mat('steel.dark'), { x, y: y - 0.15, z: cz, cast: false }))
  root.add(box(x1 - x0, 0.05, w, colorMat('#5f6266', 0.55, 0.7), { x: (x0 + x1) / 2, y: y - 0.02, z: cz }))
}

/** both trestles + pier platforms + bank pads. params none (world coordinates) */
export function trestles() {
  const root = new THREE.Group()
  root.name = 'trestles'
  for (const s of [1, -1]) {
    // mirrored by coordinates (not by scale: baked negative scale would flip the faces)
    const X = (a, b) => (s > 0 ? [a, b] : [-b, -a])
    const g = group()
    const { z, w, y, xNear, xFar } = TRESTLE
    deckSpan(g, ...X(xNear, xFar), z - w / 2, z + w / 2, y)
    deckSpan(g, ...X(PLATFORM.x0, PLATFORM.x1), PLATFORM.z0, PLATFORM.z1, y, 10)
    railX(g, ...X(xNear, xFar), z + w / 2, y)
    railX(g, ...X(PLATFORM.x1, xFar), z - w / 2, y)
    railX(g, ...X(PLATFORM.x0, PLATFORM.x1), PLATFORM.z0 + 0.1, y)
    railX(g, ...X(PLATFORM.x0, xNear), PLATFORM.z1 - 0.1, y)
    // bank pad (gravel) where the trestle lands
    g.add(box(PAD.x1 - PAD.x0, PAD.y + 1.2, PAD.z1 - PAD.z0, mat('gravel'), { base: true, x: s * (PAD.x0 + PAD.x1) / 2, y: -1.2, z: (PAD.z0 + PAD.z1) / 2 }))
    // sign at the trestle head
    g.add(box(0.1, 3, 0.1, mat('steel'), { base: true, x: s * (xFar - 1), y, z: z + w / 2 + 0.4 }), box(1.4, 0.9, 0.05, colorMat('#1f5fbf', 0.5), { x: s * (xFar - 1), y: y + 2.6, z: z + w / 2 + 0.45 }))
    root.add(g)
  }
  root.traverse((o) => { if (o.isMesh) o.receiveShadow = true })
  bakeTree(root)
  return { object: root, rig: {} }
}

/** trailer-mounted concrete pump (HBT80 class): hopper at +x, outlet at -x */
export function concretePump() {
  const root = new THREE.Group()
  const or = mat('paint.orange')
  root.add(box(5.6, 1.5, 2.1, or, { base: true, y: 0.75, round: 0.08 }))
  root.add(box(2.2, 0.9, 2.12, mat('paint.grey'), { base: true, y: 2.25, x: -1, round: 0.06 }))
  root.add(box(1.4, 0.9, 1.8, mat('steel.dark'), { base: true, x: 3.1, y: 1.1 }))
  root.add(box(1.6, 0.18, 2, mat('steel'), { x: 3.1, y: 2.06 }))
  for (const z of [-0.95, 0.95]) root.add(cyl(0.42, 0.42, 0.3, mat('rubber'), { axis: 'z', x: 0.4, y: 0.42, z, seg: 14 }))
  for (const [x, z] of [[2.2, 1.4], [2.2, -1.4], [-2.2, 1.4], [-2.2, -1.4]]) root.add(box(0.15, 0.7, 0.15, mat('paint.dark'), { base: true, x, z }), box(0.5, 0.06, 0.5, mat('steel.dark'), { x, z, y: 0.03 }))
  root.add(box(1.8, 0.12, 0.12, mat('steel.dark'), { x: -3.6, y: 0.6 }))
  root.add(cyl(0.14, 0.14, 1.2, mat('steel.dark'), { axis: 'x', x: -3.1, y: 1.2, z: 0.3 }))
  const agitator = group(box(1.2, 0.08, 0.08, mat('steel'), {}))
  agitator.position.set(3.1, 1.75, 0)
  agitator.userData.dynamic = true
  root.add(agitator)
  bakeTree(root)
  return { object: root, rig: { agitator } }
}
