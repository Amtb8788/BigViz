// People: construction workers (helmet, hi-viz vest, role colours) and civilians.
// Slightly oversized (about 2.1 m) so they read at diorama camera distances.
// Rig pivots: root > hips > legL/legR, spine > head, armL/armR > hand slot, carry slot.

import * as THREE from 'three'
import { mat, colorMat, glowMat } from '../render/materials.js'
import { box, cyl, sphere, pivot, group, bakeTree, isReal } from './kit.js'
import { realHuman } from './people-real.js'

const HELMET = { worker: 'helmet.yellow', foreman: 'helmet.white', rigger: 'helmet.red', welder: 'helmet.yellow', flagman: 'helmet.red' }

/**
 * @param {{ role?: string, shirt?: string, pants?: string, civilian?: boolean, hair?: string, child?: boolean, seed?: number }} p
 */
export function human(p = {}) {
  if (isReal()) return skinnedHuman(p)
  const civilian = !!p.civilian
  const shirt = p.shirt ? colorMat(p.shirt, 0.85) : mat(p.role === 'foreman' ? 'cloth.blue' : 'cloth.orange')
  const pants = p.pants ? colorMat(p.pants, 0.85) : mat('cloth.dark')
  const skin = colorMat(p.skin || '#e2b48e', 0.7)
  const boot = civilian ? colorMat('#3b3b3b', 0.6) : colorMat('#5a3d22', 0.8)

  const legL = pivot('legL', 0.15, 1.02, 0, box(0.22, 0.96, 0.24, pants, { y: -0.48 }), box(0.26, 0.16, 0.36, boot, { y: -0.96, z: 0.05 }))
  const legR = pivot('legR', -0.15, 1.02, 0, box(0.22, 0.96, 0.24, pants, { y: -0.48 }), box(0.26, 0.16, 0.36, boot, { y: -0.96, z: 0.05 }))

  const hand = pivot('hand', 0, -0.76, 0.02)
  const handL = pivot('handL', 0, -0.76, 0.02)
  const armR = pivot('armR', -0.36, 0.66, 0, box(0.16, 0.7, 0.18, shirt, { y: -0.36 }), sphere(0.1, skin, { y: -0.74 }), hand)
  const armL = pivot('armL', 0.36, 0.66, 0, box(0.16, 0.7, 0.18, shirt, { y: -0.36 }), sphere(0.1, skin, { y: -0.74 }), handL)

  const torso = box(0.56, 0.72, 0.32, shirt, { base: true, round: 0.06 })
  const parts = [torso]
  if (!civilian) {
    const vest = box(0.6, 0.5, 0.36, mat('vest.hiviz'), { base: true, y: 0.14, round: 0.05 })
    const stripe = box(0.62, 0.06, 0.38, colorMat('#d9dde0', 0.3), { y: 0.42, cast: false })
    parts.push(vest, stripe)
  }

  const head = pivot('head', 0, 0.74, 0, sphere(0.19, skin, { y: 0.2, seg: 14 }))
  if (!civilian) {
    head.add(sphere(0.23, mat(HELMET[p.role] || 'helmet.yellow'), { y: 0.27, hemi: true, seg: 14 }))
    head.add(cyl(0.27, 0.27, 0.03, mat(HELMET[p.role] || 'helmet.yellow'), { y: 0.27, z: 0.04, seg: 14 }))
  } else {
    head.add(sphere(0.2, colorMat(p.hair || '#2b211b', 0.9), { y: 0.25, hemi: true, seg: 12 }))
  }
  const carry = pivot('carry', 0, 0.45, 0.42)
  const spine = pivot('spine', 0, 1.02, 0, ...parts, head, armL, armR, carry)
  const hips = pivot('hips', 0, 0, 0, legL, legR, spine)
  const root = group(hips)
  root.name = civilian ? 'civilian' : `worker.${p.role || 'worker'}`
  if (p.child) root.scale.setScalar(0.68)

  const umbrella = civilian ? makeUmbrella(p.umbrella || '#2c5d8f') : null
  if (umbrella) { umbrella.visible = false; umbrella.userData.dynamic = true; handL.add(umbrella) }
  for (const p of [hips, spine, head, legL, legR, armL, armR, hand, handL, carry]) p.userData.dynamic = true
  bakeTree(root, { colors: true })

  return {
    object: root,
    rig: { root, hips, spine, head, legL, legR, armL, armR, hand, handL, carry, umbrella, tool: null, carried: null }
  }
}

/** realistic style: one SkinnedMesh, bones named like the diorama pivots (+ knees / elbows) */
function skinnedHuman(p) {
  const { root, bones: b, mesh } = realHuman(p)
  const umbrella = p.civilian ? makeUmbrella(p.umbrella || '#2c5d8f') : null
  if (umbrella) { umbrella.visible = false; umbrella.scale.setScalar(0.85); b.handL.add(umbrella) }
  return {
    object: root,
    rig: { root, ...b, body: mesh, umbrella, tool: null, carried: null }
  }
}

function makeUmbrella(color) {
  const u = group(
    cyl(0.02, 0.02, 1.3, mat('steel.dark'), { base: true }),
    new THREE.Mesh(new THREE.ConeGeometry(0.85, 0.35, 10, 1, true), new THREE.MeshStandardMaterial({ color, roughness: 0.6, side: THREE.DoubleSide }))
  )
  u.children[1].position.y = 1.35
  u.children[1].castShadow = true
  u.rotation.x = Math.PI
  u.position.y = 0.05
  return u
}

// ---------------------------------------------------------------- hand tools / carried items
const TOOLS = {
  hammer: () => group(box(0.05, 0.42, 0.05, mat('timber'), { y: -0.15 }), box(0.18, 0.08, 0.08, mat('steel.dark'), { y: -0.36 })),
  shovel: () => group(cyl(0.03, 0.03, 1.3, mat('timber'), { y: -0.3 }), box(0.26, 0.32, 0.04, mat('steel'), { y: -1.05 })),
  clipboard: () => group(box(0.3, 0.4, 0.03, colorMat('#c49a5c', 0.7), { y: -0.05, z: 0.1, rx: -1.1 }), box(0.26, 0.32, 0.01, mat('paper'), { y: -0.05, z: 0.12, rx: -1.1 })),
  flag: () => group(cyl(0.02, 0.02, 0.9, mat('timber'), { y: 0.25 }), box(0.02, 0.32, 0.46, colorMat('#e0402b', 0.7), { y: 0.55, z: 0.23 })),
  paddle: () => group(cyl(0.02, 0.02, 0.6, mat('steel.dark'), { y: 0.1 }), cyl(0.2, 0.2, 0.03, colorMat('#e0402b', 0.5), { y: 0.5, axis: 'z' })),
  radio: () => group(box(0.1, 0.22, 0.06, mat('paint.dark'), { y: -0.02 }), cyl(0.01, 0.01, 0.2, mat('rubber'), { y: 0.18 })),
  phone: () => box(0.08, 0.15, 0.02, mat('paint.dark'), { y: 0.02 }),
  torch: () => group(cyl(0.035, 0.035, 0.3, mat('steel.dark'), { y: -0.1, rx: 1.3 }), sphere(0.03, glowMat('#9fd6ff', 3), { y: -0.12, z: 0.18 })),
  vibrator: () => group(cyl(0.04, 0.04, 1.2, mat('steel'), { y: -0.5 }), cyl(0.06, 0.06, 0.25, mat('paint.yellow'), { y: 0.05 })),
  rake: () => group(cyl(0.025, 0.025, 1.4, mat('timber'), { y: -0.35 }), box(0.5, 0.05, 0.08, mat('steel'), { y: -1.05 })),
  broom: () => group(cyl(0.025, 0.025, 1.3, mat('timber'), { y: -0.3 }), box(0.4, 0.14, 0.12, colorMat('#c2a35e', 0.9), { y: -0.98 })),
  drill: () => group(box(0.1, 0.18, 0.28, mat('paint.yellow'), { y: -0.02, z: 0.06 }), cyl(0.012, 0.012, 0.14, mat('steel'), { y: 0, z: 0.26, axis: 'z' })),
  camera: () => box(0.18, 0.12, 0.1, mat('paint.dark'), { y: 0.02 }),
  bag: () => box(0.3, 0.36, 0.14, colorMat('#6b4a3a', 0.8), { y: -0.2 })
}

const CARRIED = {
  plank: () => box(0.28, 0.06, 2.4, mat('plywood'), { y: 0.1 }),
  rebar: () => group(...[0, 1, 2, 3].map((i) => cyl(0.025, 0.025, 2.6, mat('rebar'), { axis: 'z', x: -0.09 + i * 0.06, y: 0.12 }))),
  bag: () => box(0.5, 0.22, 0.38, colorMat('#d9cfb5', 0.9), { y: 0.12, round: 0.06 }),
  bucket: () => cyl(0.18, 0.15, 0.32, colorMat('#2d2d2d', 0.6), { y: 0.05 }),
  box: () => box(0.5, 0.4, 0.4, colorMat('#b98b56', 0.8), { y: 0.15 }),
  tube: () => cyl(0.04, 0.04, 2.6, mat('steel'), { axis: 'z', y: 0.2, x: 0.25 }),
  window: () => group(box(1.2, 1, 0.06, mat('paint.white'), { y: 0.4 }), box(1.05, 0.85, 0.07, mat('glass'), { y: 0.4 }))
}

/** Put a tool in the right hand (null to clear) */
export function setTool(rig, name) {
  if (rig.tool) { rig.hand.remove(rig.tool); rig.tool = null }
  if (name && TOOLS[name]) {
    rig.tool = TOOLS[name]()
    rig.tool.traverse((o) => (o.castShadow = true))
    rig.tool.userData.name = name
    // tools are sized for the 2.1 m diorama figure; scale them to the 1.75 m jointed rig
    if (rig.kneeL) rig.tool.scale.setScalar(0.82)
    rig.hand.add(rig.tool)
  }
}

/** Carry an item in front of the chest (null to clear) */
export function setCarried(rig, name) {
  if (rig.carried) { rig.carry.remove(rig.carried); rig.carried = null }
  if (name && CARRIED[name]) {
    rig.carried = CARRIED[name]()
    rig.carried.traverse((o) => (o.castShadow = true))
    rig.carried.userData.name = name
    rig.carry.add(rig.carried)
  }
}

export const TOOL_NAMES = Object.keys(TOOLS)
export const CARRIED_NAMES = Object.keys(CARRIED)
