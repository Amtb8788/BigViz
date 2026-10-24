// Progressive building: foundation raft, then floor by floor through real construction
// phases (columns -> formwork -> rebar -> pour -> cure), facade + glazing lagging behind,
// scaffold + safety net wrapping the rising frame, core leading, roof plant when topped out.
// The prefab only builds geometry; `setState(s)` maps continuous progress to visuals.

import * as THREE from 'three'
import { mat, registerNightLit } from '../render/materials.js'
import { makeCanvas } from '../render/textures.js'
import { createRng } from '../core/rng.js'
import { box, pivot, dynamic, bake } from './kit.js'
import { buildExtras, applyState, floorPhase, PHASES } from './building-extras.js'

export { floorPhase, PHASES }

function windowTexture(seed) {
  const c = makeCanvas(256, 32)
  const ctx = c.getContext('2d')
  const rng = createRng(seed)
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, 256, 32)
  for (let i = 0; i < 32; i++) {
    if (!rng.chance(0.55)) continue
    const warm = rng.chance(0.75)
    ctx.fillStyle = warm ? `hsl(${rng.range(32, 44)},90%,${rng.range(55, 72)}%)` : `hsl(${rng.range(195, 215)},60%,${rng.range(70, 82)}%)`
    ctx.fillRect(i * 8 + 1, 4, 6, 24)
  }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.wrapS = THREE.RepeatWrapping
  return t
}

/**
 * @param {{ w?: number, d?: number, floors?: number, fh?: number, bayX?: number, bayZ?: number, seed?: number, name?: string }} p
 */
export function progressiveBuilding(p = {}) {
  const W = p.w ?? 24
  const D = p.d ?? 14
  const N = p.floors ?? 12
  const FH = p.fh ?? 3.3
  const bx = p.bayX ?? 6
  const bz = p.bayZ ?? 7
  const root = new THREE.Group()
  root.name = p.name || 'building'
  const rng = createRng(p.seed ?? 4)

  // ---- foundation (sits in the pit, top at y = 0)
  const found = dynamic(pivot('foundation'))
  found.add(box(W + 2, 1.2, D + 2, mat('concrete.fresh'), { base: true, y: -2.4 }))
  found.add(box(W, 1.2, D, mat('concrete.fresh'), { base: true, y: -1.2 }))
  root.add(found)

  const colsX = Math.round(W / bx)
  const colsZ = Math.round(D / bz)
  const colPos = []
  for (let i = 0; i <= colsX; i++) for (let j = 0; j <= colsZ; j++) colPos.push([-W / 2 + 0.3 + i * ((W - 0.6) / colsX), -D / 2 + 0.3 + j * ((D - 0.6) / colsZ)])

  const sides = [
    { len: W, x: 0, z: D / 2, ry: 0 },
    { len: D, x: W / 2, z: 0, ry: Math.PI / 2 },
    { len: W, x: 0, z: -D / 2, ry: Math.PI },
    { len: D, x: -W / 2, z: 0, ry: -Math.PI / 2 }
  ]

  const floors = []
  for (let f = 0; f < N; f++) {
    const y0 = f * FH
    const g = dynamic(pivot(`floor${f}`, 0, y0, 0))
    // columns (scaled in y while rising)
    const cols = dynamic(new THREE.Group())
    for (const [x, z] of colPos) cols.add(box(0.6, FH - 0.3, 0.6, mat('concrete.fresh'), { base: true, x, z }))
    bake(cols)
    g.add(cols)
    // shoring props + formwork deck + rebar mat + wet concrete + cured slab
    const forms = dynamic(new THREE.Group())
    for (let i = 0; i < 18; i++) forms.add(box(0.1, FH - 0.5, 0.1, mat('steel'), { base: true, x: rng.range(-W / 2 + 1, W / 2 - 1), z: rng.range(-D / 2 + 1, D / 2 - 1) }))
    forms.add(box(W + 0.4, 0.12, D + 0.4, mat('formwork'), { base: true, y: FH - 0.42 }))
    bake(forms)
    g.add(forms)
    const rebar = dynamic(new THREE.Group())
    for (let i = 0; i <= 24; i++) rebar.add(box(W, 0.05, 0.05, mat('rebar'), { y: FH - 0.24, z: -D / 2 + (i * D) / 24, cast: false }))
    for (let i = 0; i <= 40; i++) rebar.add(box(0.05, 0.05, D, mat('rebar'), { y: FH - 0.2, x: -W / 2 + (i * W) / 40, cast: false }))
    bake(rebar)
    g.add(rebar)
    const wet = dynamic(box(W, 0.26, D, mat('concrete.wet'), { base: true, y: FH - 0.3 }))
    g.add(wet)
    const slab = dynamic(box(W + 0.3, 0.3, D + 0.3, mat('concrete.fresh'), { base: true, y: FH - 0.3 }))
    g.add(slab)
    // facade: spandrel band + glass + mullions per side
    const facade = []
    const glass = []
    const winMat = registerNightLit(new THREE.MeshStandardMaterial({ color: '#1a1a1a', emissive: '#ffffff', emissiveMap: windowTexture(f * 13 + 3), roughness: 0.9 }), 2.2, 'windows')
    winMat.emissiveMap.repeat.set(1, 1)
    const interior = dynamic(box(W - 1.2, FH - 0.7, D - 1.2, winMat, { base: true, y: 0.05, cast: false }))
    interior.visible = false
    g.add(interior)
    sides.forEach((s, si) => {
      const sideG = dynamic(pivot(`side${si}`, s.x, 0, s.z))
      sideG.rotation.y = s.ry
      sideG.add(box(s.len + 0.3, 0.75, 0.3, f % 3 === 2 ? mat('facade.accent') : mat('facade'), { base: true, y: FH - 0.75, z: 0.15 }))
      const n = Math.round(s.len / 1.5)
      for (let k = 0; k <= n; k++) sideG.add(box(0.12, FH - 0.75, 0.2, mat('facade.accent'), { base: true, x: -s.len / 2 + (k * s.len) / n, z: 0.2 }))
      bake(sideG)
      g.add(sideG)
      facade.push(sideG)
      const gl = dynamic(box(s.len, FH - 0.8, 0.06, mat('glass'), { base: true, y: 0.02, z: 0.12, cast: false }))
      gl.position.set(s.x + Math.sin(s.ry) * 0.12, 0.02, s.z + Math.cos(s.ry) * 0.12)
      gl.rotation.y = s.ry
      g.add(gl)
      glass.push(gl)
    })
    // perimeter safety rail (visible on the working deck)
    const rail = dynamic(new THREE.Group())
    sides.forEach((s) => {
      const r = pivot('rail', s.x, FH, s.z)
      r.rotation.y = s.ry
      r.add(box(s.len, 0.06, 0.06, mat('paint.red'), { y: 1.1, z: 0.3 }), box(s.len, 0.25, 0.04, mat('paint.yellow'), { y: 0.12, z: 0.3 }))
      for (let k = 0; k <= Math.round(s.len / 2.4); k++) r.add(box(0.06, 1.1, 0.06, mat('steel'), { base: true, x: -s.len / 2 + k * 2.4, z: 0.3 }))
      rail.add(r)
    })
    bake(rail)
    g.add(rail)
    root.add(g)
    floors.push({ g, cols, forms, rebar, wet, slab, facade, glass, interior, rail, winMat, y0 })
  }

  const parts = buildExtras(root, { W, D, N, FH, sides, rng, scaffoldSides: p.scaffoldSides })
  const rig = { root, floors, found, W, D, N, FH, sides, ...parts, deckY: 0, phase: 'foundation', topFloor: 0 }
  rig.setState = (s) => applyState(rig, s)
  return { object: root, rig }
}
