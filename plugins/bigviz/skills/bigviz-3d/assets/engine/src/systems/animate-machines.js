// Machine + vehicle animators: wheels, steering, beacons, brake lights, exhaust, and the
// articulated rigs (mixer drum, dump bed, forklift forks, excavator, mobile crane, pump
// boom IK, tower crane with rope + pendulum sway, hoist cage).

import * as THREE from 'three'
import { clamp, damp, lerp } from '../core/math.js'
import { cargo as makeCargo } from '../prefabs/cranes.js'

const v3 = new THREE.Vector3()
const v4 = new THREE.Vector3()

export function animateVehicle(e, dt, time, env, fx) {
  const a = e.agent
  const r = e.rig
  if (r.wheels?.length) {
    const roll = ((a.reversing ? -1 : 1) * a.speed * dt) / (r.wheelR || 0.5)
    for (const w of r.wheels) w.rotation.x += roll
  }
  for (const s of r.steer || []) s.rotation.y = a.steer || 0
  const beaconOn = a.reversing || a.beacon || (a.kind === 'machine' && a.working)
  for (const b of r.beacons || []) b.emissiveIntensity = beaconOn ? (Math.sin(time * 9) > 0 ? 4 : 0.3) : 0.15
  if (r.tail) r.tail.emissiveIntensity = a.braking || a.reversing ? 3.5 : 0.25 + env.night * 1.2
  if (r.exhaust && fx && !a.hidden && e.object3d.visible) {
    a._ex = (a._ex || 0) - dt
    if (a._ex <= 0) {
      a._ex = a.speed > 0.5 ? 0.35 : 1.1
      fx.emit('exhaust', r.exhaust.getWorldPosition(v3), a.speed > 0.5 ? 2 : 1)
    }
  }
  if (r.drum) {
    r.drum.rotation.z += (a.discharging ? -2.4 : 0.7) * dt
    r.chute.rotation.x = lerp(r.chute.rotation.x, a.discharging ? 0.15 : -0.5, damp(2, dt))
  }
  if (r.bed) {
    r.bed.rotation.x = -(a.tip || 0) * 0.85
    r.load.scale.y = Math.max(0.001, (a.load || 0) * 0.9)
    r.load.visible = (a.load || 0) > 0.02
  }
  if (r.slots) r.slots.forEach((s, i) => (s.visible = i < (a.cargo ?? 0)))
  if (r.forks) {
    r.forks.position.y = 0.12 + (a.lift || 0) * 2.2
    r.mast.rotation.x = -(a.tilt || 0) * 0.08
    const want = a.loaded ? 'pallet' : null
    if ((r.load.userData.kind || null) !== want) {
      r.load.clear()
      if (want) r.load.add(palletMesh())
      r.load.userData.kind = want
    }
  }
  if (r.boom && r.bucket) {
    r.upper.rotation.y = a.slew || 0
    r.boom.rotation.x = a.boom ?? 0.2
    r.arm.rotation.x = a.arm ?? 0.9
    r.bucket.rotation.x = a.bucket ?? 0.6
    r.bucketLoad.visible = !!a.full
  }
  if (r.luff) animateMobileCrane(e, a, r)
  if (r.booms) animatePump(e, a, r)
}

let _pallet
function palletMesh() {
  _pallet ||= makeCargo('pallet').children.find((c) => c.type === 'Group') || new THREE.Group()
  const g = _pallet.clone()
  g.position.set(0, 0, 0)
  return g
}

function animateMobileCrane(e, a, r) {
  r.upper.rotation.y = a.slew || 0
  r.luff.rotation.x = -(a.luff ?? 0.05)
  const ext = a.ext || 0
  r.sections.forEach((s, i) => { if (i > 0) s.position.z = 0.6 + ext * 5.6 })
  const out = a.outrig || 0
  for (const o of r.outriggers) {
    o.userData.leg.position.x = o.userData.side * (1.1 + out * 1.6)
    o.userData.leg.position.y = -out * 0.6
  }
  if (!r.hook) {
    r.cable = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1, 4).translate(0, -0.5, 0), new THREE.MeshStandardMaterial({ color: '#333' }))
    r.hook = new THREE.Group()
    r.hook.add(new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.5, 0.4), new THREE.MeshStandardMaterial({ color: '#d8452e' })))
    r.hookCargo = new THREE.Group()
    r.hookCargo.position.y = -0.4
    r.hook.add(r.hookCargo)
    e.object3d.parent.add(r.cable, r.hook)
  }
  r.tip.getWorldPosition(v3)
  const rope = Math.max(1, a.rope ?? 4)
  r.cable.position.copy(v3)
  r.cable.scale.y = rope
  r.hook.position.set(v3.x, v3.y - rope, v3.z)
  r.cable.visible = r.hook.visible = e.object3d.visible && !a.hidden
  swapCargo(r, r.hookCargo, a.payload)
}

function swapCargo(r, holder, kind) {
  kind = kind || null
  if ((holder.userData.kind || null) === kind) return
  holder.clear()
  if (kind) holder.add(makeCargo(kind))
  holder.userData.kind = kind
}

/** Pump boom: blend folded pose -> 2-link IK so boom 3 hangs straight down over a.target */
function animatePump(e, a, r) {
  const out = a.outrig || 0
  for (const o of r.outriggers) {
    o.userData.leg.position.x = o.userData.side * (0.9 + out * 1.4)
    o.userData.leg.position.y = -out * 0.55
  }
  const [L1, L2, L3] = r.lens
  // folded Z pose (elevations): boom1 low forward, boom2 back over it, boom3 forward again
  let e1 = 0.06
  let e2 = Math.PI - 0.1
  let e3 = 0.14
  let yaw = 0
  const k = clamp(a.deploy || 0, 0, 1)
  if (k > 0 && a.target) {
    r.turret.getWorldPosition(v3)
    const dx = a.target.x - v3.x
    const dz = a.target.z - v3.z
    let rel = Math.atan2(dx, dz) - e.object3d.rotation.y
    rel = Math.atan2(Math.sin(rel), Math.cos(rel))
    yaw = rel
    const h = Math.max(3, Math.hypot(dx, dz))
    const vy = a.target.y + L3 + 2.9 - (v3.y + 0.9)
    const D = clamp(Math.hypot(h, vy), Math.abs(L1 - L2) + 0.5, L1 + L2 - 0.05)
    const q2 = Math.acos(clamp((D * D - L1 * L1 - L2 * L2) / (2 * L1 * L2), -1, 1))
    const A1 = Math.atan2(vy, h) + Math.atan2(L2 * Math.sin(q2), L1 + L2 * Math.cos(q2))
    const A2 = A1 - q2
    e1 = lerp(e1, A1, k)
    e2 = lerp(e2, A2, k)
    e3 = lerp(e3, -Math.PI / 2, k)
  }
  r.turret.rotation.y = yaw * k
  // rotation.x = -(elevation) cumulatively; local = parent cumulative - own cumulative
  r.booms[0].rotation.x = -e1
  r.booms[1].rotation.x = e1 - e2
  r.booms[2].rotation.x = e2 - e3
  r.hose.rotation.x = e3
}

/** Tower crane: slew, trolley, rope length, payload swap, pendulum sway, aviation blink */
export function animateTowerCrane(e, dt, time, env) {
  const a = e.agent
  const r = e.rig
  if (a.sections != null) r.setSections(a.sections)
  r.slew.rotation.y = a.slew || 0
  r.trolley.position.z = a.trolley ?? 12
  const rope = Math.max(1.5, a.rope ?? 10)
  for (const c of r.cable) c.scale.y = rope
  r.hook.position.y = -rope
  swapCargo(r, r.cargo, a.payload)
  const s = r.sway
  const wind = env.wind || 0
  const g = 9.8 / Math.max(3, rope)
  s.vx += (-g * s.x - (a.slewVel || 0) * 0.06 * Math.min(4, (a.trolley || 10) / 10) - s.vx * 0.6) * dt
  s.vz += (-g * s.z - s.vz * 0.6 + Math.sin(time * 0.7) * wind * 0.04) * dt
  s.x += s.vx * dt
  s.z += s.vz * dt
  r.trolley.rotation.z = clamp(s.x, -0.25, 0.25)
  r.trolley.rotation.x = clamp(s.z, -0.25, 0.25)
  r.aviation.emissiveIntensity = Math.sin(time * 3) > 0.6 ? 4 : 0.2 + env.night * 0.6
}

export function animateHoist(e) {
  const a = e.agent
  const r = e.rig
  r.cage.position.y = 0.4 + (a.cageY || 0)
  r.setHeight((a.mastH ?? (a.cageY || 0)) + 5)
}
