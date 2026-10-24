// Building extras (core, scaffold, safety net, roof plant, lobby, deck clutter) and the
// state mapper that turns continuous progress values into visibility / scale.

import * as THREE from 'three'
import { mat, colorMat, lightMat } from '../render/materials.js'
import { labelTexture } from '../render/sheets.js'
import { clamp } from '../core/math.js'
import { box, cyl, pivot, dynamic } from './kit.js'
import { scaffoldBayGeo } from './truss.js'

export const PHASES = ['columns', 'formwork', 'rebar', 'pour', 'cure']

/** Phase within one floor's build fraction f (0..1) */
export function floorPhase(f) {
  if (f < 0.22) return 'columns'
  if (f < 0.42) return 'formwork'
  if (f < 0.62) return 'rebar'
  if (f < 0.85) return 'pour'
  return 'cure'
}

const OUT = 0.9
const BAY = 2.4
const DEPTH = 1.1

export function buildExtras(root, { W, D, N, FH, sides, scaffoldSides = [0, 1, 2, 3] }) {
  // concrete core (lift + stairs) leads the frame by one floor
  const core = dynamic(pivot('core', -W * 0.18, 0, -D * 0.12, box(4.2, N * FH + 1.5, 5, mat('concrete.fresh'), { base: true })))
  root.add(core)

  // scaffold + net: floor-major instance order so `count = floors * perFloor`
  const geo = scaffoldBayGeo(BAY, FH / 2, 2, DEPTH)
  const frames = []
  sides.forEach((s, i) => { if (scaffoldSides.includes(i)) frames.push({ s, bays: Math.floor(s.len / BAY) }) })
  const perFloor = frames.reduce((a, f) => a + f.bays, 0)
  const scaffold = new THREE.InstancedMesh(geo, mat('steel'), perFloor * N)
  const netGeo = new THREE.PlaneGeometry(1, 1).translate(0.5, 0.5, 0)
  const netMat = mat('net')
  const net = new THREE.InstancedMesh(netGeo, netMat, frames.length * N)
  const m = new THREE.Matrix4()
  const q = new THREE.Quaternion()
  const yAxis = new THREE.Vector3(0, 1, 0)
  let si = 0
  let ni = 0
  for (let f = 0; f < N; f++) {
    for (const { s, bays } of frames) {
      q.setFromAxisAngle(yAxis, s.ry)
      const nx = Math.sin(s.ry)
      const nz = Math.cos(s.ry)
      const tx = Math.cos(s.ry)
      const tz = -Math.sin(s.ry)
      const start = -(bays * BAY) / 2
      for (let b = 0; b < bays; b++) {
        const lx = start + b * BAY
        m.compose(new THREE.Vector3(s.x + nx * OUT + tx * lx, f * FH, s.z + nz * OUT + tz * lx), q, new THREE.Vector3(1, 1, 1))
        scaffold.setMatrixAt(si++, m)
      }
      m.compose(new THREE.Vector3(s.x + nx * (OUT + DEPTH + 0.06) + tx * start, f * FH, s.z + nz * (OUT + DEPTH + 0.06) + tz * start), q, new THREE.Vector3(bays * BAY, FH, 1))
      net.setMatrixAt(ni++, m)
    }
  }
  scaffold.castShadow = true
  scaffold.count = 0
  net.count = 0
  scaffold.userData.keep = net.userData.keep = true
  scaffold.frustumCulled = net.frustumCulled = false
  root.add(scaffold, net)

  // roof plant
  const roof = dynamic(pivot('roof', 0, N * FH, 0))
  for (const s of sides) {
    const p = box(s.len + 0.3, 1.1, 0.3, mat('facade'), { base: true })
    p.position.set(s.x, 0, s.z)
    p.rotation.y = s.ry
    roof.add(p)
  }
  roof.add(box(3, 1.6, 2, mat('paint.grey'), { base: true, x: W * 0.25, z: D * 0.15 }))
  roof.add(box(2.2, 1.2, 2.2, mat('paint.grey'), { base: true, x: W * 0.05, z: D * 0.2 }))
  roof.add(cyl(1, 1, 2.2, mat('paint.white'), { base: true, x: -W * 0.32, z: D * 0.22 }))
  roof.add(box(4.4, 2, 5.2, mat('concrete.fresh'), { base: true, x: -W * 0.18, z: -D * 0.12 }))
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(9, 1.8), new THREE.MeshStandardMaterial({ map: labelTexture('ZC TOWER', { bg: '#1f3c6e', fg: '#ffffff', font: 'bold 70px sans-serif' }), emissive: '#ffffff', emissiveIntensity: 0.25 }))
  sign.position.set(0, 2.4, D / 2 + 0.2)
  roof.add(sign, box(9.2, 0.15, 0.3, mat('steel.dark'), { y: 1.45, z: D / 2 + 0.1 }))
  roof.add(cyl(0.05, 0.05, 4, mat('steel'), { base: true, x: W / 2 - 1, z: -D / 2 + 1 }))
  roof.visible = false
  root.add(roof)

  // lobby canopy + doors (finished building only)
  const lobby = dynamic(pivot('lobby', 0, 0, D / 2))
  lobby.add(box(10, 0.4, 3.6, mat('facade.accent'), { y: 3.4, z: 1.8 }))
  for (const x of [-4.6, 4.6]) lobby.add(cyl(0.15, 0.15, 3.4, mat('chrome'), { base: true, x, z: 3.3 }))
  lobby.add(box(4, 2.8, 0.12, mat('glass.dark'), { base: true, z: 0.25 }))
  lobby.add(box(3, 0.1, 3, lightMat('#fff1cf', 1.6, 'street'), { y: 3.18, z: 1.8, cast: false }))
  lobby.visible = false
  root.add(lobby)

  // clutter on the working deck (moves with deckY)
  const deck = dynamic(pivot('deck'))
  for (let i = 0; i < 3; i++) for (let k = 0; k < 6; k++) deck.add(cyl(0.05, 0.05, 6, mat('rebar'), { axis: 'x', x: W * 0.12, y: 0.06 + i * 0.1, z: D * 0.3 + k * 0.12 }))
  for (let i = 0; i < 6; i++) deck.add(box(2.4, 0.06, 1.2, mat(i % 2 ? 'plywood' : 'formwork'), { base: true, x: W * 0.32, y: i * 0.07, z: -D * 0.3 }))
  deck.add(box(1.2, 0.8, 0.8, mat('paint.red'), { base: true, x: -W * 0.4, z: D * 0.32 }))
  for (const [x, z] of [[0.1, 0.1], [0.35, -0.1], [-0.3, 0.3]]) deck.add(cyl(0.18, 0.15, 0.32, colorMat('#2d2d2d', 0.6), { base: true, x: x * W, z: z * D }))
  deck.add(box(0.6, 0.6, 0.4, lightMat('#fff3d6', 3, 'site'), { base: true, x: -W * 0.45, y: 1.6, z: -D * 0.45, cast: false }))
  deck.add(box(0.6, 0.6, 0.4, lightMat('#fff3d6', 3, 'site'), { base: true, x: W * 0.45, y: 1.6, z: -D * 0.45, cast: false }))
  for (const x of [-W * 0.45, W * 0.45]) deck.add(cyl(0.05, 0.05, 1.6, mat('steel.dark'), { base: true, x, z: -D * 0.45 }))
  root.add(deck)

  return { core, scaffold, net, perFloor, frames, roof, lobby, deck }
}

/**
 * @param {object} rig building rig
 * @param {{ found:number, floors:number, facade:number, windows:number, scaffold:number, lit:number, roof:boolean, lobby:boolean }} s
 */
export function applyState(rig, s) {
  const { floors, N, FH, W } = rig
  const total = clamp(s.floors, 0, N)
  const n = Math.floor(total)
  const frac = total - n
  const fac = clamp(Math.min(s.facade, total), 0, N)
  const win = clamp(Math.min(s.windows, fac), 0, N)
  const fv = clamp(s.found, 0, 1)
  rig.found.visible = fv > 0
  rig.found.children[0].visible = fv > 0
  rig.found.children[1].visible = fv > 0.55
  rig.found.children[1].scale.y = clamp((fv - 0.55) / 0.45, 0.02, 1)
  let phase = fv < 1 ? 'foundation' : n >= N ? 'done' : floorPhase(frac)
  for (let f = 0; f < N; f++) {
    const F = floors[f]
    const done = f < n
    const active = f === n && frac > 0 && fv >= 1
    F.g.visible = done || active
    if (!F.g.visible) continue
    F.cols.scale.y = done ? 1 : clamp(frac / 0.22, 0.03, 1)
    F.forms.visible = active && frac >= 0.22
    F.rebar.visible = active && frac >= 0.42 && frac < 0.85
    const pour = active ? clamp((frac - 0.62) / 0.23, 0, 1) : 0
    F.wet.visible = active && pour > 0
    F.wet.scale.x = Math.max(0.02, pour)
    F.wet.position.x = -(W / 2) * (1 - pour)
    F.slab.visible = done || (active && frac >= 0.85)
    F.rail.visible = active
    const fs = f < Math.floor(fac) ? 4 : f === Math.floor(fac) ? Math.ceil((fac - f) * 4) : 0
    F.facade.forEach((g, i) => (g.visible = i < fs))
    const gs = f < Math.floor(win) ? 4 : f === Math.floor(win) ? Math.ceil((win - f) * 4) : 0
    F.glass.forEach((g, i) => (g.visible = i < gs))
    F.interior.visible = f < s.lit * N && gs === 4
  }
  const deckY = fv < 1 ? -1.2 : phase === 'columns' || phase === 'done' ? n * FH : (n + 1) * FH - 0.18
  rig.deckY = deckY
  rig.phase = phase
  rig.topFloor = n
  rig.pourX = -W / 2 + W * clamp((frac - 0.62) / 0.23, 0, 1)
  rig.core.visible = fv >= 1
  rig.core.scale.y = clamp(((Math.min(N, total + 1.2)) * FH + 0.5) / (N * FH + 1.5), 0.02, 1)
  const sc = Math.floor(clamp(Math.min(s.scaffold, total + 1), 0, N))
  if (rig.scaffold.count !== sc * rig.perFloor) {
    rig.scaffold.count = sc * rig.perFloor
    rig.net.count = sc * rig.frames.length
  }
  rig.roof.visible = !!s.roof
  rig.lobby.visible = !!s.lobby
  rig.deck.visible = fv >= 1 && phase !== 'done'
  rig.deck.position.y = deckY
  return { phase, deckY, topFloor: n }
}
