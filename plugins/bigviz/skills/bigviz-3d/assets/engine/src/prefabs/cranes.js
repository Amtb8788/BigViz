// Tower crane (climbing mast, slewing jib, trolley, hook), construction hoist, crane cargo.

import * as THREE from 'three'
import { mat, colorMat, lightMat } from '../render/materials.js'
import { box, cyl, pivot, dynamic, rod, bakeTree, isReal } from './kit.js'
import { towerExtras } from './machines-real.js'
import { mastSectionGeo, jibGeo } from './truss.js'
import { pallet } from './vehicles.js'

export const MAST_H = 3.6

/** @param {{ sections?: number, maxSections?: number, jib?: number, counter?: number }} p */
export function towerCrane(p = {}) {
  const maxS = p.maxSections ?? 16
  const jibLen = p.jib ?? 40
  const counter = p.counter ?? 12
  const root = new THREE.Group()
  root.add(box(5.5, 1.2, 5.5, colorMat('#a8a49c', 0.9), { base: true }))
  const mastMesh = new THREE.InstancedMesh(mastSectionGeo(2, MAST_H, 0.18), mat('paint.yellow'), maxS)
  const m4 = new THREE.Matrix4()
  for (let i = 0; i < maxS; i++) mastMesh.setMatrixAt(i, m4.makeTranslation(0, 1.2 + i * MAST_H, 0))
  mastMesh.castShadow = true
  mastMesh.userData.keep = true
  root.add(mastMesh)

  const top = dynamic(pivot('top', 0, 0, 0))
  root.add(top)
  const slew = dynamic(pivot('slew', 0, 0, 0))
  top.add(slew)
  slew.add(cyl(1.5, 1.5, 0.6, mat('paint.dark'), { base: true }))
  slew.add(box(2.4, 0.5, 4, mat('paint.yellow'), { base: true, y: 0.6, z: -0.6 }))
  // cab with interior light
  slew.add(box(1.6, 1.9, 1.8, mat('paint.white'), { base: true, x: 1.9, y: 0.6, z: 1.2, round: 0.1 }))
  slew.add(box(1.62, 1, 1.82, mat('glass'), { x: 1.9, y: 1.85, z: 1.25 }))
  slew.add(box(0.6, 0.3, 0.6, lightMat('#ffe2a8', 1.4, 'site'), { x: 1.9, y: 2.3, z: 1.2, cast: false }))
  // apex
  const apexH = 7
  const apexGeo = mastSectionGeo(1.6, apexH, 0.16)
  const apex = new THREE.Mesh(apexGeo, mat('paint.yellow'))
  apex.position.y = 1.1
  apex.scale.set(1, 1, 1)
  apex.castShadow = true
  slew.add(apex)
  const apexTop = new THREE.Vector3(0, 1.1 + apexH, 0)
  // jib + counter jib
  const jib = new THREE.Mesh(jibGeo(jibLen, 1.6, 1.8), mat('paint.yellow'))
  jib.position.set(0, 1.1, 1)
  jib.castShadow = true
  slew.add(jib)
  const cj = new THREE.Mesh(jibGeo(counter, 2, 0.9, 3), mat('paint.yellow'))
  cj.position.set(0, 1.1, -1)
  cj.rotation.y = Math.PI
  cj.castShadow = true
  slew.add(cj)
  slew.add(box(2.2, 0.15, counter - 1, colorMat('#8a8f96', 0.6, 0.3), { y: 1.2, z: -counter / 2 - 0.5 }))
  for (let i = 0; i < 4; i++) slew.add(box(2.4, 1.6, 0.9, colorMat('#b9b6ad', 0.9), { base: true, y: 0.2 - 1.2, z: -counter + 0.6 + i * 0.95 }))
  for (const s of [0.5, -0.5]) {
    slew.add(rod(apexTop, new THREE.Vector3(s * 0.8, 2.9, jibLen * 0.68), 0.05, mat('steel.dark')))
    slew.add(rod(apexTop, new THREE.Vector3(s * 1, 2, -counter + 0.5), 0.05, mat('steel.dark')))
  }
  slew.add(box(1.4, 1, 2, mat('paint.dark'), { base: true, y: 1.3, z: -4 }))
  slew.add(box(1.2, 0.6, 1, colorMat('#ffffff', 0.4), { base: true, y: 1.4, z: 6, cast: false }))
  // aviation lights
  const aviation = new THREE.MeshStandardMaterial({ color: '#330000', emissive: '#ff2a1a', emissiveIntensity: 2 })
  aviation.userData.live = true
  slew.add(box(0.35, 0.35, 0.35, aviation, { y: apexTop.y + 0.2, cast: false }))
  slew.add(box(0.3, 0.3, 0.3, aviation, { y: 3, z: jibLen, cast: false }))
  // trolley + hook
  const trolley = dynamic(pivot('trolley', 0, 1.0, 12, box(1.4, 0.4, 1.4, mat('paint.dark'))))
  slew.add(trolley)
  const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1, 4).translate(0, -0.5, 0), mat('steel.dark'))
  cable.userData.keep = true
  const cable2 = cable.clone()
  cable.position.x = 0.25
  cable2.position.x = -0.25
  trolley.add(cable, cable2)
  const hook = dynamic(pivot('hook', 0, -10, 0))
  hook.add(box(0.9, 0.6, 0.5, mat('paint.yellow'), { y: 0.1 }), box(0.2, 0.5, 0.2, mat('steel.dark'), { y: -0.4 }))
  const cargo = dynamic(pivot('cargo', 0, -0.65, 0))
  hook.add(cargo)
  trolley.add(hook)

  const rig = { root, top, slew, trolley, cable: [cable, cable2], hook, cargo, mastMesh, jibLen, counter, aviation, sections: 0, payload: null, sway: { x: 0, z: 0, vx: 0, vz: 0 } }
  rig.setSections = (n) => {
    n = Math.max(1, Math.min(maxS, Math.round(n)))
    if (rig.sections === n) return
    rig.sections = n
    mastMesh.count = n
    mastMesh.instanceMatrix.needsUpdate = true
    top.position.y = 1.2 + n * MAST_H
  }
  rig.setSections(p.sections ?? 8)
  mastMesh.frustumCulled = false
  if (isReal()) towerExtras(root, rig)
  bakeTree(root)
  return { object: root, rig }
}

/** Construction hoist on the building face: mast that climbs with the building + cage */
export function hoist(p = {}) {
  const maxS = p.maxSections ?? 18
  const root = new THREE.Group()
  root.add(box(3, 0.4, 3, colorMat('#a8a49c', 0.9), { base: true }))
  root.add(box(3.2, 2.2, 0.08, mat('steel.dark'), { base: true, z: 1.6 }))
  const mast = new THREE.InstancedMesh(mastSectionGeo(0.9, 3, 0.1), mat('steel'), maxS)
  const m4 = new THREE.Matrix4()
  for (let i = 0; i < maxS; i++) mast.setMatrixAt(i, m4.makeTranslation(0, 0.4 + i * 3, -1))
  mast.castShadow = true
  mast.userData.keep = true
  root.add(mast)
  const cage = dynamic(pivot('cage', 0, 0.4, 0.3))
  cage.add(box(2.2, 0.15, 1.8, mat('paint.dark'), { base: true }))
  cage.add(box(2.2, 2.3, 0.06, mat('paint.yellow'), { base: true, z: -0.9 }))
  for (const x of [1.1, -1.1]) cage.add(box(0.06, 2.3, 1.8, colorMat('#6d7f8f', 0.5, 0.5), { base: true, x }))
  cage.add(box(2.2, 0.12, 1.8, mat('paint.yellow'), { base: true, y: 2.3 }))
  cage.add(box(0.4, 0.2, 0.4, lightMat('#fff1cf', 1.5, 'site'), { y: 2.2, cast: false }))
  root.add(cage)
  const rig = { cage, mast, sections: 0 }
  rig.setHeight = (h) => {
    const n = Math.max(1, Math.min(maxS, Math.ceil(h / 3)))
    if (n === rig.sections) return
    rig.sections = n
    mast.count = n
    mast.instanceMatrix.needsUpdate = true
  }
  rig.setHeight(p.height ?? 6)
  mast.frustumCulled = false
  bakeTree(root)
  return { object: root, rig }
}

/**
 * Crane cargo hanging from a hook point at origin, with slings.
 * kind: rebar | formwork | pallet | cage | skip | panel | section | tubes
 */
export function cargo(kind = 'rebar') {
  const g = new THREE.Group()
  g.name = `cargo.${kind}`
  const drop = 2.4
  let w = 1.2
  let d = 1.2
  if (kind === 'rebar') {
    for (let i = 0; i < 9; i++) g.add(cyl(0.05, 0.05, 6, mat('rebar'), { axis: 'z', x: -0.3 + (i % 3) * 0.3, y: -drop - Math.floor(i / 3) * 0.12 }))
    d = 4
  } else if (kind === 'formwork') {
    for (let i = 0; i < 5; i++) g.add(box(2.4, 0.08, 1.2, mat(i % 2 ? 'formwork' : 'plywood'), { y: -drop - i * 0.09 }))
    w = 2.2
  } else if (kind === 'pallet') {
    const pl = pallet('bags')
    pl.position.y = -drop - 0.9
    g.add(pl)
  } else if (kind === 'cage') {
    const c = new THREE.Group()
    for (const [x, z] of [[0.3, 0.3], [-0.3, 0.3], [0.3, -0.3], [-0.3, -0.3]]) c.add(cyl(0.04, 0.04, 3.4, mat('rebar'), { x, z, y: -1.7 }))
    for (let y = 0; y < 7; y++) c.add(box(0.66, 0.03, 0.66, mat('rebar'), { y: -0.3 - y * 0.5 }))
    c.position.y = -drop + 0.6
    g.add(c)
    w = d = 0.4
  } else if (kind === 'skip') {
    g.add(cone(0.9, 1.6, mat('paint.grey'), -drop - 0.6))
    w = d = 0.5
  } else if (kind === 'panel') {
    g.add(box(4, 3, 0.25, mat('facade'), { y: -drop - 1.5 }), box(3.2, 1.8, 0.27, mat('glass'), { y: -drop - 1.4 }))
    w = 2
    d = 0.2
  } else if (kind === 'section') {
    const s = new THREE.Mesh(mastSectionGeo(2, MAST_H, 0.18), mat('paint.yellow'))
    s.position.y = -drop - MAST_H
    s.castShadow = true
    g.add(s)
  } else if (kind === 'tubes') {
    for (let i = 0; i < 12; i++) g.add(cyl(0.05, 0.05, 6, mat('steel'), { axis: 'x', z: -0.3 + (i % 4) * 0.2, y: -drop - Math.floor(i / 4) * 0.12 }))
    w = 3
  }
  const top = new THREE.Vector3(0, 0, 0)
  for (const [sx, sz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) g.add(rod(top, new THREE.Vector3(sx * w * 0.5, -drop, sz * d * 0.5), 0.025, mat('steel.dark'), 4))
  g.traverse((o) => (o.castShadow = true))
  return g
}

function cone(r, h, material, y) {
  const m = new THREE.Mesh(new THREE.ConeGeometry(r, h, 12), material)
  m.rotation.x = Math.PI
  m.position.y = y
  return m
}
