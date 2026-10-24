// Road vehicles: truck chassis kit, mixer, dump truck, flatbed, car, van, bus.
// Forward is +z. Slightly toy-like proportions (rounded cabs, chunky wheels).
// Rig: wheels[], steer[], beacons[], tail (own material), exhaust (Object3D) + per type parts.

import * as THREE from 'three'
import { mat, colorMat, lightMat, own } from '../render/materials.js'
import { makeCanvas } from '../render/textures.js'
import { labelTexture } from '../render/sheets.js'
import { box, cyl, pivot, dynamic, bakeTree, isReal } from './kit.js'
import { realTruck, mixerBody, dumpBody, flatbedBody, realCar } from './vehicles-real.js'

/** Shared headlight beam material; EnvironmentSystem drives its opacity at night */
export const beamMat = new THREE.MeshBasicMaterial({ color: '#ffe2a8', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })
const beamGeo = new THREE.ConeGeometry(2.2, 12, 14, 1, true).rotateX(-Math.PI / 2).translate(0, 0, 6).rotateX(0.12)

let logoTex
function logoMat() {
  logoTex ??= labelTexture('ZC 筑城建工', { bg: '#ffffff', fg: '#1f3c6e', w: 512, h: 128, font: 'bold 54px sans-serif' })
  return new THREE.MeshStandardMaterial({ map: logoTex, roughness: 0.5 })
}

const HUB = colorMat('#b8bcc0', 0.45, 0.2)

export function wheel(r, w = 0.42) {
  const g = new THREE.Group()
  g.add(cyl(r, r, w, mat('rubber'), { axis: 'x', seg: 16, cast: false }))
  g.add(cyl(r * 0.55, r * 0.55, w + 0.03, HUB, { axis: 'x', seg: 10, cast: false }))
  return dynamic(g)
}

/**
 * Generic truck: frame, rounded cab, glass, bumper, mirrors, exhaust, lights, beacon, wheels.
 * @returns {{ root: THREE.Group, rig: object, deckY: number, L: number, W: number }}
 */
export function truck(opts = {}) {
  if (isReal()) return realTruck({ ...opts, beamMat })
  return toyTruck(opts)
}

function toyTruck({ L = 8, W = 2.5, wheelR = 0.55, axles = [-2.6, -1.3, 2.4], cab = 'paint.yellow', cabL = 2.3, cabH = 2.2, beacon = true, logo = true } = {}) {
  const root = new THREE.Group()
  const rig = { wheels: [], steer: [], beacons: [], wheelR }
  const deckY = wheelR + 0.38
  const cz = L / 2 - cabL / 2
  root.add(box(W * 0.62, 0.36, L - 0.4, mat('steel.dark'), { base: true, y: wheelR - 0.05 }))
  root.add(box(W, cabH, cabL, mat(cab), { base: true, y: deckY, z: cz, round: 0.16 }))
  root.add(box(W * 0.84, cabH * 0.4, 0.06, mat('glass.dark'), { y: deckY + cabH * 0.66, z: cz + cabL / 2 }))
  root.add(box(W + 0.02, cabH * 0.34, cabL * 0.5, mat('glass.dark'), { y: deckY + cabH * 0.66, z: cz + 0.2 }))
  root.add(box(W + 0.12, 0.34, 0.26, mat('paint.dark'), { y: wheelR + 0.08, z: L / 2 + 0.02 }))
  root.add(box(W * 0.6, 0.3, 0.05, mat('chrome'), { y: deckY + 0.42, z: cz + cabL / 2 + 0.02 }))
  for (const s of [1, -1]) {
    root.add(box(0.07, 0.48, 0.12, mat('paint.dark'), { x: s * (W / 2 + 0.16), y: deckY + cabH * 0.62, z: cz + cabL / 2 - 0.15 }))
    root.add(box(0.5, 0.08, 0.5, mat('steel'), { x: s * (W / 2 - 0.1), y: wheelR + 0.15, z: cz - 0.2 }))
    root.add(box(0.06, 0.32, 0.18, lightMat('#fff1cf', 3.2, 'vehicle'), { x: s * (W / 2 - 0.35), y: wheelR + 0.48, z: L / 2 + 0.04, cast: false }))
    const beam = new THREE.Mesh(beamGeo, beamMat)
    beam.position.set(s * (W / 2 - 0.35), wheelR + 0.48, L / 2 + 0.1)
    beam.castShadow = false
    beam.renderOrder = 3
    beam.userData.keep = true
    root.add(beam)
  }
  if (logo) {
    const m = logoMat()
    for (const s of [1, -1]) {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.35), m)
      p.position.set(s * (W / 2 + 0.01), deckY + cabH * 0.32, cz)
      p.rotation.y = s * Math.PI / 2
      root.add(p)
    }
  }
  rig.tail = own(lightMat('#ff2a1a', 1.2, 'vehicle'))
  for (const s of [1, -1]) root.add(box(0.36, 0.18, 0.06, rig.tail, { x: s * (W / 2 - 0.3), y: wheelR + 0.2, z: -L / 2 + 0.2, cast: false }))
  const stack = cyl(0.09, 0.09, 1.5, mat('chrome'), { base: true, x: W / 2 - 0.18, y: deckY + 0.2, z: cz - cabL / 2 - 0.14 })
  root.add(stack)
  rig.exhaust = pivot('exhaust', W / 2 - 0.18, deckY + 1.75, cz - cabL / 2 - 0.14)
  root.add(rig.exhaust)
  if (beacon) {
    const bm = own(new THREE.MeshStandardMaterial({ color: '#7a4a00', emissive: '#ffa21a', emissiveIntensity: 0.2, roughness: 0.3 }))
    const b = cyl(0.13, 0.15, 0.2, bm, { base: true, y: deckY + cabH, z: cz, cast: false })
    root.add(b)
    rig.beacons.push(bm)
  }
  for (const z of axles) {
    const front = z > 0
    for (const s of [1, -1]) {
      const wh = wheel(wheelR)
      wh.position.set(s * (W / 2 - 0.2), wheelR, z)
      if (front) {
        const st = dynamic(pivot('steer', s * (W / 2 - 0.2), wheelR, z))
        wh.position.set(0, 0, 0)
        st.add(wh)
        root.add(st)
        rig.steer.push(st)
      } else root.add(wh)
      rig.wheels.push(wh)
    }
    root.add(box(W - 0.3, 0.42, 1.2, mat('paint.dark'), { y: wheelR + 0.32, z }))
  }
  return { root, rig, deckY, L, W, cz, cabL }
}

/** bake a realistic build and return the prefab contract */
function finish(t) {
  bakeTree(t.root, { colors: true })
  return { object: t.root, rig: t.rig }
}

let drumTex
function drumMat() {
  if (!drumTex) {
    const c = makeCanvas(256)
    const ctx = c.getContext('2d')
    ctx.fillStyle = '#f1f1ec'
    ctx.fillRect(0, 0, 256, 256)
    ctx.fillStyle = '#ef7d22'
    for (let i = -256; i < 512; i += 64) {
      ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + 30, 0); ctx.lineTo(i + 158, 256); ctx.lineTo(i + 128, 256); ctx.fill()
    }
    drumTex = new THREE.CanvasTexture(c)
    drumTex.colorSpace = THREE.SRGBColorSpace
  }
  return new THREE.MeshStandardMaterial({ map: drumTex, roughness: 0.4, metalness: 0.3 })
}

export function mixer() {
  const t = truck({ L: 8.6, cab: 'paint.white', axles: [-3, -1.7, 2.8] })
  if (isReal()) return finish(t, mixerBody(t))
  const prof = [[0.35, -2.5], [0.9, -2.1], [1.32, -1.1], [1.38, 0.2], [1.2, 1.5], [0.7, 2.4], [0.45, 2.6]].map(([r, y]) => new THREE.Vector2(r, y))
  const drumMesh = new THREE.Mesh(new THREE.LatheGeometry(prof, 22), drumMat())
  drumMesh.rotation.x = Math.PI / 2
  drumMesh.castShadow = true
  const drum = dynamic(pivot('drum', 0, 0, 0, drumMesh))
  const tilt = pivot('drumTilt', 0, t.deckY + 1.45, -0.9, drum)
  tilt.rotation.x = 0.2
  t.root.add(tilt)
  t.root.add(box(0.5, 1.3, 0.5, mat('steel.dark'), { base: true, x: 0.6, y: t.deckY, z: 1.3 }), box(0.5, 1.7, 0.5, mat('steel.dark'), { base: true, x: -0.6, y: t.deckY, z: -3.3 }))
  t.root.add(cyl(0.38, 0.38, 1.1, mat('paint.blue'), { axis: 'z', x: -0.9, y: t.deckY + 0.4, z: 1.2 }))
  const chuteMesh = box(0.5, 0.18, 1.8, mat('steel'), { z: -0.9 })
  const chute = dynamic(pivot('chute', 0, t.deckY + 1.1, -4.2, chuteMesh))
  chute.rotation.x = -0.5
  t.root.add(chute)
  t.root.add(cone(0.7, 0.8, mat('steel'), { y: t.deckY + 2.2, z: -3.9, rx: Math.PI * 0.95 }))
  Object.assign(t.rig, { drum, chute })
  bakeTree(t.root, { colors: true })
  return { object: t.root, rig: t.rig }
}

function cone(r, h, material, p) {
  const m = new THREE.Mesh(new THREE.ConeGeometry(r, h, 12, 1, true), material)
  m.position.set(p.x || 0, p.y || 0, p.z || 0)
  m.rotation.x = p.rx || 0
  m.castShadow = true
  return m
}

export function dumpTruck({ cab = 'paint.orange' } = {}) {
  const t = truck({ L: 8.2, cab, axles: [-2.9, -1.6, 2.6] })
  if (isReal()) return finish(t, dumpBody(t))
  const bedL = 5
  const bedMesh = box(t.W, 1.3, bedL, mat('paint.grey'), { base: true, z: bedL / 2 })
  const load = dynamic(new THREE.Mesh(new THREE.SphereGeometry(1, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat('sand')))
  load.scale.set(t.W * 0.48, 0.001, bedL * 0.46)
  load.position.set(0, 1.25, bedL / 2)
  load.castShadow = true
  const bed = dynamic(pivot('bed', 0, t.deckY + 0.1, -t.L / 2 + 0.3, bedMesh, load))
  bed.add(box(t.W + 0.1, 0.12, 0.6, mat('paint.grey'), { y: 1.36, z: bedL + 0.2 }))
  t.root.add(bed)
  Object.assign(t.rig, { bed, load })
  bakeTree(t.root, { colors: true })
  return { object: t.root, rig: t.rig }
}

export function flatbed({ cab = 'paint.blue' } = {}) {
  const t = truck({ L: 9.4, cab, axles: [-3.4, -2.1, 3.2] })
  if (isReal()) return finish(t, flatbedBody(t, pallet))
  t.root.add(box(t.W, 0.22, 6.4, mat('timber'), { base: true, y: t.deckY, z: -1.15 }))
  t.root.add(box(t.W, 1.1, 0.12, mat('steel.dark'), { base: true, y: t.deckY, z: 2.05 }))
  const cargo = dynamic(pivot('cargo', 0, t.deckY + 0.22, -1.2))
  t.root.add(cargo)
  // up to 4 pallet slots; the animator shows `count` of them
  const slots = []
  for (let i = 0; i < 4; i++) {
    const s = pallet(i % 2 ? 'bricks' : 'bags')
    s.position.set(-0.55, 0, -2.3 + i * 1.55)
    s.userData.dynamic = true
    cargo.add(s)
    slots.push(s)
  }
  Object.assign(t.rig, { cargo, slots })
  bakeTree(t.root, { colors: true })
  return { object: t.root, rig: t.rig }
}

/** Wooden pallet with goods: bags | bricks | blocks | tiles | wrap */
export function pallet(kind = 'bags') {
  const g = new THREE.Group()
  g.add(box(1.3, 0.16, 1.3, mat('timber'), { base: true }))
  const goods = {
    bags: () => [0, 1, 2].forEach((l) => [-0.32, 0.32].forEach((x) => g.add(box(0.6, 0.22, 1.18, colorMat('#ddd3bb', 0.9), { base: true, x, y: 0.16 + l * 0.22, round: 0.05 })))),
    bricks: () => g.add(box(1.2, 0.8, 1.2, mat('brick'), { base: true, y: 0.16 })),
    blocks: () => g.add(box(1.2, 0.75, 1.2, colorMat('#b9b6ad', 0.9), { base: true, y: 0.16 })),
    tiles: () => g.add(box(1.2, 0.5, 1.2, colorMat('#8a8f97', 0.6), { base: true, y: 0.16 })),
    wrap: () => g.add(box(1.24, 0.95, 1.24, new THREE.MeshStandardMaterial({ color: '#cfe3f0', roughness: 0.2, metalness: 0.1, transparent: true, opacity: 0.85 }), { base: true, y: 0.16 }))
  }
  ;(goods[kind] || goods.bags)()
  return g
}

const CAR_COLORS = ['#c9392b', '#2f66b3', '#eef0ee', '#2b2f35', '#e8b23a', '#4f8c6a', '#8b9197', '#6c3d8f']

/** Small civilian car / van / bus */
export function car({ type = 'sedan', color, seed = 0 } = {}) {
  const c = color || CAR_COLORS[seed % CAR_COLORS.length]
  const body = colorMat(c, 0.32, 0.35)
  if (isReal()) return finish(realCar({ type, body: type === 'taxi' ? colorMat('#f2c230', 0.3, 0.3) : body, beamMat }))
  const root = new THREE.Group()
  const rig = { wheels: [], steer: [], beacons: [] }
  const dims = { sedan: [4.6, 2.0, 0.42], van: [5.2, 2.1, 0.45], bus: [10, 2.6, 0.55], taxi: [4.6, 2.0, 0.42] }[type] || [4.6, 2, 0.42]
  const [L, W, r] = dims
  const tall = type === 'bus' ? 2.6 : type === 'van' ? 1.6 : 0.85
  root.add(box(W, 0.75, L, type === 'taxi' ? colorMat('#f2c230', 0.3, 0.3) : body, { base: true, y: r * 0.7, round: 0.22 }))
  const cabinL = type === 'sedan' || type === 'taxi' ? L * 0.52 : L * 0.9
  const cabinZ = type === 'sedan' || type === 'taxi' ? -0.15 : -0.1
  root.add(box(W * 0.9, tall, cabinL, type === 'taxi' ? colorMat('#f2c230', 0.3, 0.3) : body, { base: true, y: r * 0.7 + 0.7, z: cabinZ, round: 0.2 }))
  root.add(box(W * 0.92, tall * 0.6, cabinL * 0.96, mat('glass.dark'), { y: r * 0.7 + 0.7 + tall * 0.52, z: cabinZ }))
  for (const s of [1, -1]) {
    root.add(box(0.4, 0.16, 0.06, lightMat('#fff3d6', 3, 'vehicle'), { x: s * (W / 2 - 0.35), y: r + 0.42, z: L / 2 + 0.01, cast: false }))
    const beam = new THREE.Mesh(beamGeo, beamMat)
    beam.scale.setScalar(0.7)
    beam.position.set(s * (W / 2 - 0.35), r + 0.42, L / 2 + 0.05)
    beam.userData.keep = true
    root.add(beam)
  }
  rig.tail = own(lightMat('#ff2a1a', 1.2, 'vehicle'))
  for (const s of [1, -1]) root.add(box(0.4, 0.16, 0.06, rig.tail, { x: s * (W / 2 - 0.35), y: r + 0.45, z: -L / 2 - 0.01, cast: false }))
  if (type === 'taxi') root.add(box(0.6, 0.2, 0.3, lightMat('#ffe9a0', 2, 'vehicle'), { base: true, y: r * 0.7 + 1.55, z: cabinZ }))
  const ax = L / 2 - (type === 'bus' ? 1.8 : 0.95)
  for (const z of [ax, -ax]) {
    for (const s of [1, -1]) {
      const wh = wheel(r, 0.32)
      if (z > 0) {
        const st = dynamic(pivot('steer', s * (W / 2 - 0.1), r, z, wh))
        root.add(st)
        rig.steer.push(st)
      } else {
        wh.position.set(s * (W / 2 - 0.1), r, z)
        root.add(wh)
      }
      rig.wheels.push(wh)
    }
  }
  rig.wheelR = r
  rig.exhaust = pivot('exhaust', W / 2 - 0.4, r, -L / 2)
  root.add(rig.exhaust)
  bakeTree(root, { colors: true })
  return { object: root, rig }
}
