// The architect's desk: wooden table, plinth (model base), blueprint sheets, scale ruler,
// pencils, coffee mug, triangle, sticky notes and a brass plaque. Everything is driven by
// the scene's `desk` config so every scene pack gets its own "背景桌面".

import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { surfaceMat, mat, colorMat } from './materials.js'
import { blueprintTexture, noteTexture, plaqueTexture } from './sheets.js'
import { createRng } from '../core/rng.js'

const PLINTH_H = 3

/**
 * @param {object} cfg scene.desk
 * @param {{w:number,d:number}} cfg.board  plinth size in metres
 * @param {{title:string,subtitle:string}} cfg.plaque
 * @param {Array<{kind:string,title:string,code:string,x:number,z:number,rot:number,w?:number}>} cfg.sheets
 * @param {Array<{lines:string[],color?:string,x:number,z:number,rot:number}>} cfg.notes
 */
export function buildDesk(cfg) {
  const g = new THREE.Group()
  g.name = 'desk'
  const { w, d } = cfg.board
  const rng = createRng(cfg.seed || 7)
  const deskY = -PLINTH_H

  // table top
  const top = new THREE.Mesh(new THREE.BoxGeometry(w * 4.2, 6, d * 4.2), surfaceMat('wood', 6))
  top.position.y = deskY - 3
  top.receiveShadow = true
  g.add(top)

  // plinth: dark walnut base with a thin bevel, the model sits on top
  const plinth = new THREE.Mesh(new RoundedBoxGeometry(w + 4, PLINTH_H, d + 4, 3, 0.6), surfaceMat('plinth', 2))
  plinth.position.y = -PLINTH_H / 2
  plinth.receiveShadow = true
  plinth.castShadow = true
  g.add(plinth)
  // plaque on the front edge
  if (cfg.plaque) {
    const p = new THREE.Mesh(
      new THREE.PlaneGeometry(26, 4),
      new THREE.MeshStandardMaterial({ map: plaqueTexture(cfg.plaque.title, cfg.plaque.subtitle), metalness: 0.75, roughness: 0.32 })
    )
    p.position.set(0, -PLINTH_H / 2, d / 2 + 2.02)
    g.add(p)
  }

  // blueprint sheets around the plinth, slightly overlapping, never perfectly aligned
  for (const s of cfg.sheets || []) {
    const sw = s.w || 70
    const sheet = new THREE.Mesh(
      new THREE.PlaneGeometry(sw, sw * 0.707),
      new THREE.MeshStandardMaterial({ map: blueprintTexture(s), roughness: 0.85 })
    )
    sheet.rotation.x = -Math.PI / 2
    sheet.rotation.z = s.rot || 0
    sheet.position.set(s.x, deskY + 0.02 + rng.range(0, 0.04), s.z)
    sheet.receiveShadow = true
    g.add(sheet)
  }
  for (const n of cfg.notes || []) {
    const note = new THREE.Mesh(new THREE.PlaneGeometry(12, 12), new THREE.MeshStandardMaterial({ map: noteTexture(n.lines, n.color), roughness: 0.9 }))
    note.rotation.x = -Math.PI / 2
    note.rotation.z = n.rot || 0
    note.position.set(n.x, deskY + 0.12, n.z)
    note.receiveShadow = true
    g.add(note)
  }

  addRuler(g, -w * 0.15, deskY, d / 2 + 16, 0.06)
  addPencil(g, w / 2 + 14, deskY, d * 0.1, 0.9, '#f2b51c')
  addPencil(g, w / 2 + 19, deskY, d * 0.18, 0.75, '#2f66b3')
  addMug(g, -w / 2 - 26, deskY, -d * 0.25)
  addTriangle(g, w / 2 + 30, deskY, -d * 0.35)
  addRoll(g, -w / 2 - 22, deskY, d * 0.45)
  addEraser(g, w / 2 + 10, deskY, d / 2 + 10)
  return { group: g, deskY, plinthH: PLINTH_H }
}

function addRuler(g, x, y, z, rot) {
  const r = new THREE.Mesh(new THREE.BoxGeometry(90, 0.5, 7), colorMat('#e8e1cf', 0.5))
  r.position.set(x, y + 0.25, z)
  r.rotation.y = rot
  r.castShadow = true
  g.add(r)
  // tick marks as one merged geometry
  const ticks = []
  for (let i = 0; i <= 88; i += 2) {
    const t = new THREE.BoxGeometry(0.18, 0.05, i % 10 === 0 ? 2.6 : 1.3)
    t.translate(i - 44, 0.27, -3.5 + (i % 10 === 0 ? 1.3 : 0.65))
    ticks.push(t)
  }
  const m = new THREE.Mesh(mergeSimple(ticks), colorMat('#2b2b2b', 0.6))
  m.position.copy(r.position)
  m.rotation.y = rot
  g.add(m)
}

function addPencil(g, x, y, z, rot, color) {
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 38, 6), colorMat(color, 0.45))
  body.rotation.z = Math.PI / 2
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.9, 4, 6), colorMat('#e5c69a', 0.7))
  tip.rotation.z = -Math.PI / 2
  tip.position.x = 21
  const p = new THREE.Group()
  p.add(body, tip)
  p.position.set(x, y + 0.9, z)
  p.rotation.y = rot
  p.traverse((o) => (o.castShadow = true))
  g.add(p)
}

function addMug(g, x, y, z) {
  const mug = new THREE.Group()
  const body = new THREE.Mesh(new THREE.CylinderGeometry(6, 5.6, 13, 32, 1, true), mat('ceramic'))
  body.position.y = 6.5
  const bottom = new THREE.Mesh(new THREE.CircleGeometry(5.6, 32), mat('ceramic'))
  bottom.rotation.x = -Math.PI / 2
  bottom.position.y = 0.2
  const coffee = new THREE.Mesh(new THREE.CircleGeometry(5.7, 32), colorMat('#3b2416', 0.15, 0))
  coffee.rotation.x = -Math.PI / 2
  coffee.position.y = 11
  const handle = new THREE.Mesh(new THREE.TorusGeometry(3.2, 0.9, 10, 20, Math.PI), mat('ceramic'))
  handle.position.set(6.2, 6.5, 0)
  handle.rotation.z = -Math.PI / 2
  mug.add(body, bottom, coffee, handle)
  mug.position.set(x, y, z)
  mug.traverse((o) => (o.castShadow = true))
  g.add(mug)
}

function addTriangle(g, x, y, z) {
  const s = new THREE.Shape()
  s.moveTo(0, 0); s.lineTo(30, 0); s.lineTo(0, 22); s.closePath()
  const hole = new THREE.Path()
  hole.moveTo(5, 4); hole.lineTo(18, 4); hole.lineTo(5, 13.5); hole.closePath()
  s.holes.push(hole)
  const m = new THREE.Mesh(
    new THREE.ExtrudeGeometry(s, { depth: 0.4, bevelEnabled: false }),
    new THREE.MeshStandardMaterial({ color: '#ff8a3d', transparent: true, opacity: 0.55, roughness: 0.15 })
  )
  m.rotation.x = -Math.PI / 2
  m.rotation.z = 0.4
  m.position.set(x, y + 0.05, z)
  g.add(m)
}

function addRoll(g, x, y, z) {
  const roll = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 60, 24), new THREE.MeshStandardMaterial({ map: blueprintTexture({ kind: 'site', seed: 9 }), roughness: 0.85 }))
  roll.rotation.z = Math.PI / 2
  roll.rotation.y = 0.5
  roll.position.set(x, y + 3, z)
  roll.castShadow = true
  g.add(roll)
}

function addEraser(g, x, y, z) {
  const e = new THREE.Mesh(new RoundedBoxGeometry(8, 2.4, 4, 2, 0.5), colorMat('#f1e7e0', 0.8))
  e.position.set(x, y + 1.2, z)
  e.rotation.y = 0.7
  e.castShadow = true
  g.add(e)
}

/** Merge non-indexed-safe box geometries without pulling BufferGeometryUtils into the desk */
function mergeSimple(geos) {
  const pos = []
  const nor = []
  const idx = []
  let off = 0
  for (const geo of geos) {
    const p = geo.attributes.position.array
    const n = geo.attributes.normal.array
    for (let i = 0; i < p.length; i++) { pos.push(p[i]); nor.push(n[i]) }
    for (const i of geo.index.array) idx.push(i + off)
    off += p.length / 3
    geo.dispose()
  }
  const out = new THREE.BufferGeometry()
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3))
  out.setIndex(idx)
  return out
}
