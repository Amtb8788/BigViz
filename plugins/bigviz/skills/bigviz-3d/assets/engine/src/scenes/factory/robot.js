// Six-axis industrial robot (KR 210 class), one skinned mesh per finish. Joints: turret (A1,
// yaw) > shoulder (A2) > elbow (A3) > wrist (A5) > flange (A6 roll). Tools: MIG torch with
// hose package, or a tandem-line vacuum crossbar. solveIK() poses it from a tool-tip target.

import * as THREE from 'three'
import { Rigid } from './rigid.js'
import { clamp } from '../../core/math.js'

const ORANGE = '#e8731e'
const YELLOW = '#e8b81e'
const GREY = '#4d5258'
const DARK = '#2b2e32'

/** stamped steel panel (door / side outer): shallow dome with flanged rim, shared geometry */
let panelGeo
export function panelGeometry() {
  if (panelGeo) return panelGeo
  const g = new THREE.PlaneGeometry(1.7, 1.1, 18, 12)
  g.rotateX(-Math.PI / 2)
  const p = g.attributes.position
  for (let i = 0; i < p.count; i++) {
    const u = p.getX(i) / 0.85
    const v = p.getZ(i) / 0.55
    const e = Math.max(Math.abs(u), Math.abs(v))
    // flat flange ring, raised crown, a character line across
    let y = e > 0.86 ? 0 : 0.09 * (1 - Math.pow(e / 0.86, 4))
    if (Math.abs(v + 0.15) < 0.07 && e < 0.8) y += 0.015
    p.setY(i, y)
  }
  g.computeVertexNormals()
  panelGeo = g
  return g
}
let panelMat
export function panelMaterial() {
  panelMat ??= new THREE.MeshStandardMaterial({ color: '#b9bec3', roughness: 0.3, metalness: 0.85, side: THREE.DoubleSide, envMapIntensity: 1.3 })
  return panelMat
}

/**
 * @param {{ tool?: 'torch'|'gripper', color?: string, s?: number, riser?: number }} p
 * rig: { turret, shoulder, elbow, wrist, flange, tip (Object3D at the tool point), held (panel mesh), dims }
 */
export function robot({ tool = 'torch', color, s = 1, riser = 0.5 } = {}) {
  const R = new Rigid()
  const paint = color || (tool === 'torch' ? ORANGE : YELLOW)
  const D0 = 0.3
  const L1 = 1.15
  const L2 = 1.22
  // base: riser pedestal + bolted plate (root bone, static)
  R.box(R.root, 1.1, 0.06, 1.1, GREY, { base: true }, 'dark')
  R.box(R.root, 0.8, riser - 0.06, 0.8, GREY, { base: true, y: 0.06 }, 'dark')
  for (const [x, z] of [[0.48, 0.48], [-0.48, 0.48], [0.48, -0.48], [-0.48, -0.48]]) R.cyl(R.root, 0.035, 0.035, 0.05, '#8d9298', { x, y: 0.08, z, seg: 6 }, 'metal')
  // A1 rotating base
  const turret = R.bone('turret', R.root, 0, riser, 0)
  R.cyl(turret, 0.44, 0.48, 0.22, paint, { base: true, seg: 24 })
  R.box(turret, 0.62, 0.5, 0.78, paint, { y: 0.47, z: 0.02, round: 0.08 })
  R.box(turret, 0.5, 0.3, 0.3, paint, { y: 0.35, z: -0.42, round: 0.05 })
  R.cyl(turret, 0.11, 0.11, 0.34, GREY, { axis: 'x', x: 0.42, y: 0.62, z: -0.1 }, 'metal')
  R.cyl(turret, 0.13, 0.13, 0.08, DARK, { axis: 'x', x: 0.6, y: 0.62, z: -0.1 }, 'dark')
  R.box(turret, 0.16, 0.12, 0.2, DARK, { x: -0.2, y: 0.32, z: -0.58 }, 'dark')
  // A2 shoulder: lower arm along +y
  const shoulder = R.bone('shoulder', turret, 0, 0.75, D0)
  R.cyl(shoulder, 0.27, 0.27, 0.56, paint, { axis: 'x', seg: 22 })
  R.cyl(shoulder, 0.16, 0.16, 0.6, GREY, { axis: 'x', seg: 16 }, 'metal')
  R.box(shoulder, 0.34, L1 - 0.1, 0.36, paint, { y: L1 / 2, round: 0.07 })
  R.box(shoulder, 0.38, 0.42, 0.42, paint, { y: L1 - 0.05, round: 0.08 })
  // counterbalance strut along the back of the lower arm
  R.cyl(shoulder, 0.075, 0.075, 0.78, '#b7bcc1', { x: 0.24, y: 0.5, z: -0.22, rx: 0.16 }, 'metal')
  R.cyl(shoulder, 0.095, 0.095, 0.32, GREY, { x: 0.24, y: 0.25, z: -0.26, rx: 0.16 }, 'metal')
  // A3 elbow: forearm along +z
  const elbow = R.bone('elbow', shoulder, 0, L1, 0)
  R.cyl(elbow, 0.22, 0.22, 0.5, paint, { axis: 'x', seg: 20 })
  R.box(elbow, 0.46, 0.4, 0.62, paint, { z: -0.12, round: 0.07 })
  for (const [x, y] of [[0.13, 0.08], [-0.13, 0.08], [0, -0.1]]) R.cyl(elbow, 0.075, 0.075, 0.24, GREY, { axis: 'z', x, y, z: -0.52 }, 'metal')
  R.cyl(elbow, 0.15, 0.13, L2 - 0.3, paint, { axis: 'z', z: (L2 - 0.3) / 2 + 0.18, seg: 18 })
  R.box(elbow, 0.03, 0.18, 0.4, DARK, { x: 0.155, z: 0.55 }, 'dark')
  // A5 wrist + A6 flange (roll)
  const wrist = R.bone('wrist', elbow, 0, 0, L2)
  R.box(wrist, 0.2, 0.24, 0.22, paint, { z: -0.04, round: 0.05 })
  R.cyl(wrist, 0.11, 0.11, 0.3, paint, { axis: 'x' })
  const flange = R.bone('flange', wrist, 0, 0, 0.15)
  R.cyl(flange, 0.07, 0.07, 0.05, '#9aa0a6', { axis: 'z' }, 'metal')
  const tip = R.bone('tip', flange, 0, 0, 0)
  let Lt
  let held = null
  if (tool === 'torch') {
    // dress pack: hose along the forearm, wire feeder on the elbow, swan-neck torch
    R.cyl(elbow, 0.045, 0.045, L2 - 0.2, DARK, { axis: 'z', x: 0.16, y: 0.16, z: L2 / 2 + 0.05 }, 'dark')
    R.box(elbow, 0.26, 0.22, 0.36, '#3e5a7a', { y: 0.34, z: -0.18, round: 0.03 })
    R.cyl(elbow, 0.1, 0.1, 0.06, '#b9894a', { axis: 'x', x: 0.16, y: 0.36, z: -0.2 }, 'metal')
    R.box(flange, 0.1, 0.12, 0.1, DARK, { z: 0.07 }, 'dark')
    R.cyl(flange, 0.032, 0.032, 0.34, '#2f3236', { axis: 'z', z: 0.29, y: -0.02 }, 'dark')
    R.cyl(flange, 0.026, 0.03, 0.1, '#b87333', { axis: 'z', z: 0.5, y: -0.02 }, 'metal')
    Lt = 0.55
    tip.position.set(0, -0.02, Lt)
  } else {
    // tandem-line crossbar: boom along +z, cross tube + 2 rails with 12 vacuum cups below
    Lt = 0.75
    R.box(flange, 0.12, 0.12, Lt, '#9aa0a6', { z: Lt / 2 }, 'metal')
    R.box(flange, 1.0, 0.06, 0.06, '#c3c7cb', { z: Lt, y: -0.05 }, 'metal')
    for (const dz of [-0.22, 0.22]) R.box(flange, 0.06, 0.05, 1.0, '#c3c7cb', { z: Lt + dz * 0, x: dz * 2, y: -0.06 }, 'metal')
    for (const x of [-0.44, 0.44]) for (const dz of [-0.4, -0.13, 0.13, 0.4]) {
      R.cyl(flange, 0.008, 0.008, 0.06, '#c3c7cb', { x, y: -0.1, z: Lt + dz, seg: 5 }, 'metal')
      R.cyl(flange, 0.035, 0.025, 0.03, DARK, { x, y: -0.14, z: Lt + dz, seg: 8 }, 'dark')
    }
    tip.position.set(0, -0.16, Lt)
  }
  const object = R.build(`robot.${tool}`)
  if (tool !== 'torch') {
    held = new THREE.Mesh(panelGeometry(), panelMaterial())
    held.scale.setScalar(1 / s)
    held.position.set(0, -0.2, Lt)
    held.rotation.y = Math.PI / 2
    held.castShadow = true
    held.visible = false
    flange.add(held)
  }
  object.scale.setScalar(s)
  const dims = { D0: D0 * s, H0: (riser + 0.75) * s, L1: L1 * s, L2: L2 * s, Lt: (0.15 + Lt) * s, drop: tool === 'torch' ? 0.02 * s : 0.16 * s }
  return { object, rig: { turret, shoulder, elbow, wrist, flange, tip, held, dims } }
}

/**
 * Pose the arm so the tool point reaches T (robot-local metres, unscaled frame of the entity)
 * with the tool pitched `alpha` below horizontal (torch ~1.1, crossbar 0). Elbow-up solution.
 */
export function solveIK(rig, T, alpha = 1.1, roll = 0) {
  const { D0, H0, L1, L2, Lt, drop } = rig.dims
  const yaw = Math.atan2(T.x, T.z)
  const r = Math.hypot(T.x, T.z)
  // tool point = wrist + Lt along the tool axis (pitched alpha down) + drop along tool -y
  const ca = Math.cos(alpha)
  const sa = Math.sin(alpha)
  const wr = r - Lt * ca + drop * sa
  const wh = T.y + Lt * sa + drop * ca
  const dx = wr - D0
  const dy = wh - H0
  const D = clamp(Math.hypot(dx, dy), Math.abs(L1 - L2) + 0.05, L1 + L2 - 0.02)
  const q2 = Math.acos(clamp((D * D - L1 * L1 - L2 * L2) / (2 * L1 * L2), -1, 1))
  const e1 = Math.atan2(dy, dx) + Math.atan2(L2 * Math.sin(q2), L1 + L2 * Math.cos(q2))
  const e2 = e1 - q2
  const a = Math.PI / 2 - e1
  rig.turret.rotation.y = yaw
  rig.shoulder.rotation.x = a
  rig.elbow.rotation.x = -e2 - a
  rig.wrist.rotation.x = alpha + e2
  rig.flange.rotation.z = roll
}
