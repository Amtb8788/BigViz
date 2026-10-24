// Park pack - building prefabs (local front = +z, origin at the footprint centre, y 0 = grade).
//   parkTower     unitised curtain-wall tower: double-height glazed lobby behind a stone
//                 colonnade, fins + transoms as real geometry, crown (flat / setback / fin screen),
//                 roof plant, LED outline lit at night, rooftop company sign
//   parkLab       R&D block: ribbon windows, terracotta fins, PV roof
//   parkCanteen   two-storey glass pavilion, timber louvres, deep roof, tables inside
//   parkApartment talent apartments: punched windows, south balconies with glass rails
// Window materials are shared tiles (facades.js); emissive night levels are scene-driven.

import * as THREE from 'three'
import { registerNightLit, lightMat } from '../../render/materials.js'
import { createRng } from '../../core/rng.js'
import { bake } from '../../prefabs/kit.js'
import { Quads, boxes, cyls, M, signMaterial, plane } from './kit.js'
import { curtainTile, ribbonTile, punchedTile } from './facades.js'

const V = (x, y, z) => new THREE.Vector3(x, y, z)
const nightOnce = (m, base, grp) => { if (!m.userData.night) { registerNightLit(m, base, grp); m.userData.night = true } return m }
/** apartment window materials: the scene dims them by hour (homes go dark after midnight) */
export const homeMats = new Set()
const snap = (v, bay) => Math.max(bay * 2, Math.round(v / bay) * bay)
const LED = () => lightMat('#d6ecff', 2.4, 'street')

/** rooftop plant on a deck (x0..x1, z0..z1) at y */
function roofPlant(list, rng, y, hw, hd, big = true) {
  const pick = () => [rng.range(-hw + 2.5, hw - 2.5), rng.range(-hd + 2.5, hd - 2.5)]
  const out = { plant: [], towers: [] }
  list.push([0, y, -hd * 0.25, Math.min(7, hw), 3.6, Math.min(5, hd * 0.6)]) // lift overrun
  for (let i = 0; i < (big ? 4 : 2); i++) { const [x, z] = pick(); list.push([x, y, z, rng.range(2.4, 3.4), rng.range(1.4, 1.9), rng.range(1.6, 2.2)]) }
  for (let i = 0; i < (big ? 2 : 1); i++) { const [x, z] = pick(); out.towers.push([x, y, z, 1.5, 2.4, 14]) }
  return out
}

/**
 * @param {{ w?:number, d?:number, floors?:number, tint?:string, seed?:number, lobby?:'full'|'simple',
 *   crown?:'flat'|'setback'|'fins', sign?:string, mast?:boolean, outline?:boolean }} p
 */
export function parkTower({ w = 24, d = 26, floors = 20, tint = 'blue', seed = 1, lobby = 'simple', crown = 'flat', sign, mast = false, outline = false } = {}) {
  const rng = createRng(seed * 7 + 1)
  const F = curtainTile(tint, seed % 3)
  nightOnce(F.material, 1.3, 'windows')
  const bay = F.bay
  const fh = F.fh
  const W = snap(w, bay)
  const D = snap(d, bay)
  const GF = 7.8
  const H = GF + (floors - 1) * fh
  const g = new THREE.Group()
  const glows = []
  const solid = []   // stone / concrete boxes
  const alu = []     // aluminium fins + frames
  const dark = []    // dark metal
  // ---- curtain wall shaft (u / v offsets snap the shared tile to whole bays / floors)
  const uo = rng.int(0, 15) * bay
  const vy0 = GF - rng.int(0, 15) * fh
  const Q = new Quads()
  const topF = crown === 'setback' ? 3 : 0
  const Hs = H - topF * fh
  const par = crown === 'fins' ? 1.2 : 1.6
  Q.ring(0, 0, W, D, GF, topF ? Hs + 1.1 : H + par, F.tw, F.th, uo, vy0)
  const Wt = W - 4 * bay
  const Dt = D - 4 * bay
  if (topF) Q.ring(0, 0, Wt, Dt, Hs, H + par, F.tw, F.th, uo, vy0)
  g.add(Q.mesh(F.material))
  // roof decks + parapet inner faces
  const R = new Quads()
  R.rect(-W / 2 + 0.2, -D / 2 + 0.2, W / 2 - 0.2, D / 2 - 0.2, topF ? Hs : H, 1)
  if (topF) R.rect(-Wt / 2 + 0.2, -Dt / 2 + 0.2, Wt / 2 - 0.2, Dt / 2 - 0.2, H, 1)
  g.add(R.mesh(M.concrete()))
  const ring = (ww, dd, y0, h, t, list) => {
    list.push([0, y0 + h / 2, dd / 2 - t / 2, ww, h, t], [0, y0 + h / 2, -dd / 2 + t / 2, ww, h, t])
    list.push([ww / 2 - t / 2, y0 + h / 2, 0, t, h, dd - 2 * t], [-ww / 2 + t / 2, y0 + h / 2, 0, t, h, dd - 2 * t])
  }
  ring(W - 0.1, D - 0.1, topF ? Hs : H, topF ? 1.1 : par, 0.3, solid)
  if (topF) ring(Wt - 0.1, Dt - 0.1, H, par, 0.3, solid)
  // ---- mullion caps + transoms (real depth: they cast the fine vertical shadow lines)
  const fins = (ww, dd, y0, y1) => {
    const hh = y1 - y0
    for (let i = 0; i <= Math.round(ww / bay); i++) { const x = -ww / 2 + i * bay; alu.push([x, (y0 + y1) / 2, dd / 2 + 0.11, 0.09, hh, 0.22], [x, (y0 + y1) / 2, -dd / 2 - 0.11, 0.09, hh, 0.22]) }
    for (let i = 1; i < Math.round(dd / bay); i++) { const z = -dd / 2 + i * bay; alu.push([ww / 2 + 0.11, (y0 + y1) / 2, z, 0.22, hh, 0.09], [-ww / 2 - 0.11, (y0 + y1) / 2, z, 0.22, hh, 0.09]) }
    for (let y = y0 + fh; y < y1 - 0.5; y += fh) ring(ww + 0.3, dd + 0.3, y - 0.06, 0.12, 0.16, alu)
  }
  fins(W, D, GF, topF ? Hs : H)
  if (topF) fins(Wt, Dt, Hs, H)
  // ---- double-height lobby: glass line 1.5 m behind a stone colonnade, door gap at front centre
  const LH = GF - 0.9
  const inset = 1.5
  const gw = W / 2 - inset
  const gd = D / 2 - inset
  const door = lobby === 'full' ? 2.2 : 1.6
  const G = new Quads()
  G.wall(-gw, gd, -door, gd, 0.15, LH, [0, 0, 1])
  G.wall(door, gd, gw, gd, 0.15, LH, [0, 0, 1])
  G.wall(-door, gd, door, gd, 3.4, LH, [0, 0, 1])
  G.wall(gw, gd, gw, -gd, 0.15, LH, [1, 0, 0])
  G.wall(gw, -gd, -gw, -gd, 0.15, LH, [0, 0, -1])
  G.wall(-gw, -gd, -gw, gd, 0.15, LH, [-1, 0, 0])
  g.add(G.mesh(M.clearGlass(), false))
  // glazing frames: mullions every bay + door frame + transom
  for (let x = -gw; x <= gw + 0.01; x += bay) if (Math.abs(x) > door + 0.05 || Math.abs(Math.abs(x) - door) < 0.01) alu.push([x, LH / 2, gd, 0.08, LH, 0.14])
  for (const x of [-door, door]) alu.push([x, LH / 2, gd, 0.14, LH, 0.18])
  alu.push([0, 3.4, gd, door * 2, 0.14, 0.18], [0, LH, 0, gw * 2, 0.14, gd * 2 + 0.1])
  for (let z = -gd; z <= gd + 0.01; z += bay) alu.push([gw, LH / 2, z, 0.14, LH, 0.08], [-gw, LH / 2, z, 0.14, LH, 0.08])
  // colonnade (front columns skip the walk-in axis) + stone transfer band + soffit
  const span = (L) => { const n = Math.max(2, Math.round((L - 0.9) / (bay * 2))); return Array.from({ length: n + 1 }, (_, i) => -L / 2 + 0.45 + (i * (L - 0.9)) / n) }
  for (const x of span(W)) {
    if (Math.abs(x) > 2.6) solid.push([x, GF / 2, D / 2 - 0.45, 0.9, GF, 0.9])
    solid.push([x, GF / 2, -D / 2 + 0.45, 0.9, GF, 0.9])
  }
  for (const z of span(D).slice(1, -1)) solid.push([W / 2 - 0.45, GF / 2, z, 0.9, GF, 0.9], [-W / 2 + 0.45, GF / 2, z, 0.9, GF, 0.9])
  ring(W + 0.2, D + 0.2, GF - 0.9, 0.95, 0.5, solid)
  const S = new Quads()
  S.rect(-W / 2, -D / 2, W / 2, D / 2, GF - 0.9, -1, 2)
  g.add(S.mesh(M.ceiling(), false))
  // interior: polished stone floor, ceiling light strips (always on, brighter at night)
  const fl = new Quads()
  fl.rect(-gw, -gd, gw, gd, 0.16, 1, 1.2)
  g.add(fl.mesh(M.stoneDark(), false))
  const strips = []
  for (let z = -gd + 1.5; z < gd - 0.5; z += 2.4) strips.push([0, LH - 0.05, z, gw * 1.7, 0.04, 0.22])
  g.add(boxes(strips, M.lamp('#fff3dc', 1.4), { cast: false }))
  if (lobby === 'full') {
    // reception (left of the walk-in axis), speed gates, lift core with steel doors, logo wall
    const core = { z: -2.5, w: Math.min(12, W * 0.42), d: 8 }
    solid.push([0, LH / 2, core.z, core.w, LH, core.d])
    const lift = []
    for (let i = -2; i <= 2; i++) if (i) lift.push([i * 1.9, 1.35, core.z + core.d / 2 + 0.03, 1.2, 2.5, 0.06])
    g.add(boxes(lift, M.steel(), { cast: false }))
    g.add(plane(core.w * 0.7, 1.6, signMaterial(sign || '云栖科技', { k: 1.2 }), { y: 4.6, z: core.z + core.d / 2 + 0.05 }))
    dark.push([-6.5, 0.55, 5.5, 5, 1.1, 1.2], [-6.5, 1.12, 5.5, 5.3, 0.06, 1.5])
    for (const x of [-3.1, -1.7, -0.6, 0.6, 1.7, 3.1]) dark.push([x, 0.55, 2.2, 0.22, 1.0, 1.6])
    alu.push([-1.15, 0.85, 2.2, 0.9, 0.5, 0.02], [1.15, 0.85, 2.2, 0.9, 0.5, 0.02])
  } else {
    solid.push([0, LH / 2, -gd + 3, gw * 1.6, LH, 0.4])
    g.add(plane(gw * 1.2, 2.2, M.lamp('#f2e6cc', 0.55), { y: LH * 0.55, z: -gd + 3.22 }))
  }
  // entrance canopy over the door (lit soffit)
  alu.push([0, 4.15, D / 2 + 1.2, door * 2 + 2.4, 0.3, 4.4])
  g.add(boxes([[0, 3.98, D / 2 + 1.2, door * 2 + 1.6, 0.04, 3.6]], M.lamp('#fff0d6', 1.1), { cast: false }))
  glows.push({ pos: V(0, 3.7, D / 2 + 1.2), group: 'street', color: '#ffd9a8', size: 2.2, pool: 5 })
  return finishTower(g, { solid, alu, dark, glows, W, D, H, GF, rng, crown, topF, Hs, Wt, Dt, sign, mast, outline, lobby })
}
function finishTower(g, o) {
  const { solid, alu, dark, glows, W, D, H, rng, crown, topF, Hs, Wt, Dt, sign, mast, outline } = o
  const roofY = H
  const cw = topF ? Wt : W
  const cd = topF ? Dt : D
  // crown: vertical aluminium fin screen above the roof + LED halo behind it
  if (crown === 'fins') {
    const fh = 6
    const n = Math.round(cw / 1.5)
    for (let i = 0; i <= n; i++) { const x = -cw / 2 + (i * cw) / n; alu.push([x, roofY + fh / 2, cd / 2 + 0.2, 0.18, fh, 0.9], [x, roofY + fh / 2, -cd / 2 - 0.2, 0.18, fh, 0.9]) }
    const m = Math.round(cd / 1.5)
    for (let i = 1; i < m; i++) { const z = -cd / 2 + (i * cd) / m; alu.push([cw / 2 + 0.2, roofY + fh / 2, z, 0.9, fh, 0.18], [-cw / 2 - 0.2, roofY + fh / 2, z, 0.9, fh, 0.18]) }
    alu.push([0, roofY + fh, 0, cw + 0.6, 0.3, 0.6], [0, roofY + fh, cd / 2 + 0.2, cw + 1, 0.3, 1], [0, roofY + fh, -cd / 2 - 0.2, cw + 1, 0.3, 1])
    g.add(boxes([[0, roofY + 0.6, cd / 2 - 0.5, cw - 1, 0.12, 0.12], [0, roofY + 0.6, -cd / 2 + 0.5, cw - 1, 0.12, 0.12], [cw / 2 - 0.5, roofY + 0.6, 0, 0.12, 0.12, cd - 1], [-cw / 2 + 0.5, roofY + 0.6, 0, 0.12, 0.12, cd - 1]], LED(), { cast: false }))
  }
  // LED outline on the parapet coping (+ setback step), corner strips on hero towers
  const halo = []
  const edge = (ww, dd, y) => halo.push([0, y, dd / 2 + 0.06, ww, 0.1, 0.06], [0, y, -dd / 2 - 0.06, ww, 0.1, 0.06], [ww / 2 + 0.06, y, 0, 0.06, 0.1, dd], [-ww / 2 - 0.06, y, 0, 0.06, 0.1, dd])
  edge(cw, cd, roofY + 1.55)
  if (topF) edge(W, D, Hs + 1.05)
  if (outline) for (const [x, z] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) halo.push([x * (W / 2 + 0.08), (o.GF + (topF ? Hs : H)) / 2, z * (D / 2 + 0.08), 0.1, (topF ? Hs : H) - o.GF, 0.1])
  g.add(boxes(halo, LED(), { cast: false }))
  // roof plant (behind the parapet), mast + aircraft warning beacon
  const plant = roofPlant(solid, rng, roofY, cw / 2, cd / 2, cw > 20)
  if (plant.towers.length) g.add(cyls(plant.towers.map(([x, y, z, r, h, s]) => [x, y, z, r, h, s, r * 1.15]), M.white()))
  if (mast) {
    dark.push([cw * 0.25, roofY + 6, -cd * 0.2, 0.3, 12, 0.3])
    g.add(boxes([[cw * 0.25, roofY + 12.2, -cd * 0.2, 0.4, 0.4, 0.4]], lightMat('#ff3a2a', 3, 'street'), { cast: false }))
    glows.push({ pos: V(cw * 0.25, roofY + 12.2, -cd * 0.2), group: 'street', color: '#ff4a3a', size: 2.5, pool: 0 })
  }
  // company sign: on the fin screen or above the parapet (front face)
  if (sign) {
    const sm = nightOnce(signMaterial(sign, { k: 1.4 }), 1.6, 'street')
    const sy = crown === 'fins' ? roofY + 3.4 : roofY + 3.6
    const sw = Math.min(cw * 0.62, 20)
    if (crown !== 'fins') dark.push([0, roofY + 1.6, cd / 2 - 0.6, sw * 0.9, 0.3, 0.4], [-sw * 0.4, roofY + 2.6, cd / 2 - 0.6, 0.15, 2.2, 0.15], [sw * 0.4, roofY + 2.6, cd / 2 - 0.6, 0.15, 2.2, 0.15])
    g.add(plane(sw, sw * 0.19, sm, { y: sy, z: cd / 2 + (crown === 'fins' ? 0.7 : -0.45) }))
  }
  g.add(boxes(solid, M.stone()), boxes(alu, M.alu()), boxes(dark, M.aluDark()))
  bake(g, { colors: false })
  g.userData.glows = glows
  const top = new THREE.Object3D()
  top.position.set(0, roofY, 0)
  const lobbyNode = new THREE.Object3D()
  lobbyNode.position.set(0, 0, D / 2 - 4)
  g.add(top, lobbyNode)
  return { object: g, rig: { W, D, H, roof: top, lobby: lobbyNode } }
}

/** R&D block: ribbon windows, vertical terracotta fins, PV array on the roof */
export function parkLab({ w = 36, d = 16, floors = 5, seed = 2 } = {}) {
  const F = ribbonTile(seed)
  nightOnce(F.material, 1.2, 'windows')
  const W = snap(w, F.bay)
  const D = snap(d, F.bay)
  const H = floors * F.fh
  const g = new THREE.Group()
  const Q = new Quads()
  Q.ring(0, 0, W, D, 0, H, F.tw, F.th, 0, 0)
  g.add(Q.mesh(F.material))
  const R = new Quads()
  R.rect(-W / 2, -D / 2, W / 2, D / 2, H, 1)
  g.add(R.mesh(M.concrete()))
  const solid = [[0, H + 0.6, D / 2 - 0.15, W, 1.2, 0.3], [0, H + 0.6, -D / 2 + 0.15, W, 1.2, 0.3], [W / 2 - 0.15, H + 0.6, 0, 0.3, 1.2, D], [-W / 2 + 0.15, H + 0.6, 0, 0.3, 1.2, D]]
  const fins = []
  for (let x = -W / 2 + 0.75; x < W / 2; x += 1.5) if (Math.abs(x) > 2.4) fins.push([x, (H + 1.2) / 2, D / 2 + 0.35, 0.16, H + 1.2, 0.7], [x, (H + 1.2) / 2, -D / 2 - 0.35, 0.16, H + 1.2, 0.7])
  const pv = []
  for (let z = -D / 2 + 2; z < D / 2 - 1.5; z += 2.6) pv.push([0, H + 0.95, z, W - 4, 0.08, 1.9])
  const alu = [[0, 3.9, D / 2 + 1.8, 6, 0.3, 3.6], [-2.8, 1.95, D / 2 + 3.3, 0.18, 3.9, 0.18], [2.8, 1.95, D / 2 + 3.3, 0.18, 3.9, 0.18]]
  for (let x = -W / 2 + 3; x < W / 2 - 2; x += 4) alu.push([x, H + 0.45, 0, 0.12, 0.9, D - 3])
  g.add(boxes(solid, M.render()), boxes(fins, M.terracotta()), boxes(alu, M.alu()))
  g.add(boxes(pv, M.pv()), plane(2.8, 3.1, M.clearGlass(), { y: 1.7, z: D / 2 + 0.02 }), boxes([[0, 3.72, D / 2 + 1.8, 5.2, 0.04, 2.8]], M.lamp('#fff0d6', 1), { cast: false }))
  bake(g)
  g.userData.glows = [{ pos: V(0, 3.4, D / 2 + 1.8), group: 'street', color: '#ffd9a8', size: 2, pool: 4.5 }]
  return { object: g, rig: { W, D, H } }
}
/** Canteen: two-storey glass pavilion, timber louvres on the upper floor, deep roof, tables */
export function parkCanteen({ w = 32, d = 22, seed = 4 } = {}) {
  const rng = createRng(seed)
  const W = w, D = d, FH = 5, H = FH * 2
  const g = new THREE.Group()
  const hw = W / 2, hd = D / 2
  const G = new Quads()
  G.wall(-hw, hd, -1.6, hd, 0.15, FH, [0, 0, 1]); G.wall(1.6, hd, hw, hd, 0.15, FH, [0, 0, 1]); G.wall(-1.6, hd, 1.6, hd, 3.2, FH, [0, 0, 1])
  G.wall(hw, hd, hw, -hd, 0.15, FH, [1, 0, 0]); G.wall(-hw, -hd, -hw, hd, 0.15, FH, [-1, 0, 0])
  G.ring(0, 0, W - 1.2, D - 1.2, FH + 0.3, H, 1, 1)
  g.add(G.mesh(M.clearGlass(), false))
  const solid = [[0, FH / 2, -hd + 0.2, W, FH, 0.4], [0, FH + 0.15, 0, W, 0.3, D]]
  const alu = []
  for (let x = -hw; x <= hw + 0.01; x += 2) if (Math.abs(x) > 1.7) alu.push([x, FH / 2, hd, 0.08, FH, 0.12])
  for (let z = -hd; z <= hd + 0.01; z += 2) alu.push([hw, FH / 2, z, 0.12, FH, 0.08], [-hw, FH / 2, z, 0.12, FH, 0.08])
  alu.push([-1.6, 1.6, hd, 0.12, 3.2, 0.14], [1.6, 1.6, hd, 0.12, 3.2, 0.14], [0, 3.2, hd, 3.2, 0.12, 0.14])
  // upper floor timber louvres (outer screen) + deep roof with white fascia, timber soffit
  const wood = []
  for (let x = -hw + 0.3; x < hw; x += 0.6) wood.push([x, FH + 2.6, hd - 0.2, 0.08, 4.6, 0.3], [x, FH + 2.6, -hd + 0.2, 0.08, 4.6, 0.3])
  for (let z = -hd + 0.6; z < hd - 0.3; z += 0.6) wood.push([hw - 0.2, FH + 2.6, z, 0.3, 4.6, 0.08], [-hw + 0.2, FH + 2.6, z, 0.3, 4.6, 0.08])
  const white = [[0, H + 0.45, 0, W + 6, 0.9, D + 6]]
  wood.push([0, H - 0.02, 0, W + 5.8, 0.04, D + 5.8])
  // tables + benches on both floors, serving counter at the back
  const tables = []
  for (const y of [0.15, FH + 0.3]) for (let x = -hw + 3; x < hw - 2; x += 4) for (let z = -hd + 6; z < hd - 2.5; z += 3.4) {
    if (Math.abs(x) < 2.2 && z > hd - 6) continue
    tables.push([x, y + 0.74, z, 1.8, 0.06, 0.9], [x, y + 0.37, z, 0.1, 0.7, 0.1], [x, y + 0.23, z - 0.75, 1.7, 0.05, 0.35], [x, y + 0.23, z + 0.75, 1.7, 0.05, 0.35])
  }
  solid.push([0, 0.6, -hd + 2.2, W - 6, 1.05, 1])
  const pend = []
  for (let x = -hw + 3; x < hw - 2; x += 4) for (let z = -hd + 6; z < hd - 2.5; z += 3.4) pend.push([x, FH - 0.6, z, 0.5, 0.12, 0.5], [x, H - 0.7, z, 0.5, 0.12, 0.5])
  const fl = new Quads()
  fl.rect(-hw, -hd, hw, hd, 0.16, 1, 1.5)
  g.add(fl.mesh(M.stone(), false))
  g.add(boxes(solid, M.render()), boxes(alu, M.alu()), boxes(wood, M.timber()), boxes(white, M.white()), boxes(tables, M.timber(), { cast: false }), boxes(pend, M.lamp('#ffd9a0', 1.6), { cast: false }))
  // roof garden + front fascia sign + kitchen service door at the back
  const rg = new Quads()
  rg.rect(-hw + 1.5, -hd + 1.5, hw - 1.5, hd - 1.5, H + 0.91, 1)
  g.add(rg.mesh(M.timber(), false))
  g.add(plane(14, 1.6, nightOnce(signMaterial('员工餐厅 · CANTEEN', { k: 1.2 }), 1.3, 'street'), { y: H + 0.45, z: hd + 3.02 }))
  g.add(plane(2.2, 2.6, M.aluDark(), { y: 1.45, z: -hd - 0.01, ry: Math.PI }))
  bake(g)
  const glows = []
  for (let x = -hw + 5; x < hw - 3; x += 8) glows.push({ pos: V(x, FH - 1, 0), group: 'street', color: '#ffcf8f', size: 2.6, pool: 0 })
  g.userData.glows = glows
  return { object: g, rig: { W, D, H } }
}

/** Talent apartments: punched windows, south balconies with glass rails, AC units on the sides */
export function parkApartment({ w = 40, d = 13, floors = 18, seed = 5, wall = '#cdbfa8' } = {}) {
  const rng = createRng(seed * 3 + 2)
  const Ff = punchedTile(true, seed, wall)
  const Fs = punchedTile(false, seed, wall)
  homeMats.add(Ff.material).add(Fs.material)
  const bay = Ff.bay
  const W = snap(w, bay * 2)
  const D = d
  const GF = 4.2
  const H = GF + floors * Ff.fh
  const g = new THREE.Group()
  const hw = W / 2, hd = D / 2
  const F = new Quads()
  F.wall(-hw, hd, hw, hd, 0, H, [0, 0, 1], Ff.tw, Ff.th, 0, GF)
  F.wall(hw, -hd, -hw, -hd, 0, H, [0, 0, -1], Ff.tw, Ff.th, 0, GF)
  g.add(F.mesh(Ff.material))
  const S = new Quads()
  S.wall(hw, hd, hw, -hd, 0, H, [1, 0, 0], Fs.tw, Fs.th, 0, GF)
  S.wall(-hw, -hd, -hw, hd, 0, H, [-1, 0, 0], Fs.tw, Fs.th, 0, GF)
  g.add(S.mesh(Fs.material))
  const R = new Quads()
  R.rect(-hw, -hd, hw, hd, H, 1)
  g.add(R.mesh(M.concrete()))
  const render = [[0, H + 0.55, hd - 0.12, W, 1.1, 0.24], [0, H + 0.55, -hd + 0.12, W, 1.1, 0.24], [hw - 0.12, H + 0.55, 0, 0.24, 1.1, D], [-hw + 0.12, H + 0.55, 0, 0.24, 1.1, D]]
  render.push([0, H + 2, 0, 6, 4, 5], [-hw * 0.55, H + 1.6, -1, 3, 3.2, 3])
  const base = [[0, 0.6, hd + 0.04, W + 0.1, 1.2, 0.1], [0, 0.6, -hd - 0.04, W + 0.1, 1.2, 0.1], [hw + 0.04, 0.6, 0, 0.1, 1.2, D], [-hw - 0.04, 0.6, 0, 0.1, 1.2, D]]
  // balconies on even bays (front tile has doors there), every floor
  const slab = []
  const rail = []
  const glassB = []
  for (let f = 0; f < floors; f++) {
    const y = GF + f * Ff.fh
    for (let b = 0; b < W / bay; b += 2) {
      const x = -hw + b * bay + bay / 2
      slab.push([x, y + 0.06, hd + 0.65, bay * 0.86, 0.16, 1.3])
      rail.push([x, y + 1.12, hd + 1.28, bay * 0.86, 0.05, 0.06])
      glassB.push([x, y + 0.6, hd + 1.28, bay * 0.84, 1.0, 0.02], [x - bay * 0.42, y + 0.6, hd + 0.65, 0.02, 1.0, 1.25], [x + bay * 0.42, y + 0.6, hd + 0.65, 0.02, 1.0, 1.25])
    }
    if (rng.chance(0.8)) for (const s of [1, -1]) render.push([s * (hw + 0.35), y + 0.7, rng.range(-hd + 2, hd - 2), 0.7, 0.6, 0.9])
  }
  g.add(boxes(render, M.render()), boxes(base, M.granite()), boxes(slab, M.white()), boxes(rail, M.steel(), { cast: false }), boxes(glassB, M.balGlass(), { cast: false }))
  g.add(boxes([[0, 3.6, hd + 1.6, 5, 0.25, 3.2]], M.aluDark()), plane(2.6, 2.8, M.lamp('#f6e2bf', 0.7), { y: 1.55, z: hd + 0.05 }))
  bake(g)
  g.userData.glows = [{ pos: V(0, 3.2, hd + 1.6), group: 'street', color: '#ffd9a8', size: 1.8, pool: 3.5 }]
  return { object: g, rig: { W, D, H } }
}
