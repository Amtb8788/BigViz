// Procedural human poses. Each pose writes target joint angles; the animator blends the
// rig toward them so switching walk -> hammer never pops. No skeletal clips needed.

import { setTool, setCarried } from '../prefabs/people.js'
import { damp } from '../core/math.js'

const S = Math.sin
const J = ['hipsY', 'spineX', 'spineZ', 'headX', 'headY', 'legL', 'legR', 'armLX', 'armLZ', 'armRX', 'armRZ']

/** Tools each animation implies (auto-equipped unless the step sets one) */
export const ANIM_TOOL = {
  hammer: 'hammer', shovel: 'shovel', flag: 'flag', paddle: 'paddle', phone: 'phone', clipboard: 'clipboard',
  weld: 'torch', vibrate: 'vibrator', rake: 'rake', sweep: 'broom', drill: 'drill', photo: 'camera', radio: 'radio'
}

const POSES = {
  idle: (t, p) => { p.spineX = S(t * 1.3) * 0.02; p.headY = S(t * 0.4) * 0.35; p.armLZ = 0.06; p.armRZ = -0.06 },
  walk: (t, p, a) => {
    const f = t * (a.speed || 1.5) * 3.9
    p.legL = S(f) * 0.62; p.legR = -S(f) * 0.62
    p.armLX = -S(f) * 0.5; p.armRX = S(f) * 0.5
    p.hipsY = Math.abs(S(f)) * 0.06; p.spineX = 0.05
  },
  run: (t, p, a) => { POSES.walk(t * 1.4, p, a); p.spineX = 0.18; p.armLX *= 1.4; p.armRX *= 1.4 },
  carry: (t, p, a) => {
    const f = t * (a.speed || 1.1) * 3.9
    p.legL = S(f) * 0.45; p.legR = -S(f) * 0.45
    p.armLX = -1.1; p.armRX = -1.1; p.armLZ = -0.15; p.armRZ = 0.15
    p.hipsY = Math.abs(S(f)) * 0.04; p.spineX = -0.04
  },
  hammer: (t, p) => { const k = Math.max(0, S(t * 7)); p.spineX = 0.35; p.armRX = -2.2 + k * 1.6; p.armLX = -0.8; p.headX = 0.3 },
  shovel: (t, p) => { const k = (S(t * 2.6) + 1) / 2; p.spineX = 0.25 + k * 0.4; p.armRX = -0.6 - k * 0.6; p.armLX = -1.1 - k * 0.3; p.legL = 0.3; p.legR = -0.15 },
  rebar: (t, p) => { p.hipsY = -0.55; p.spineX = 0.85; p.legL = -1.2; p.legR = -1.2; p.armRX = -1.2 + S(t * 9) * 0.25; p.armLX = -1.1; p.headX = 0.3 },
  weld: (t, p) => { p.hipsY = -0.5; p.spineX = 0.55; p.legL = -1.3; p.legR = -0.4; p.armRX = -1.25 + S(t * 3) * 0.05; p.armLX = -1; p.headX = 0.5 },
  inspect: (t, p) => { p.hipsY = -0.45; p.spineX = 0.6; p.legL = -1.1; p.legR = -1.1; p.armRX = -0.9; p.headX = 0.4; p.headY = S(t * 0.8) * 0.3 },
  flag: (t, p) => { p.armRX = -2.6 + S(t * 4) * 0.5; p.armRZ = -0.4 + S(t * 4) * 0.35; p.headY = 0.2 },
  paddle: (t, p) => { p.armRX = -1.6; p.armRZ = -0.2; p.armLX = -0.4 + S(t * 3) * 0.4 },
  point: (t, p) => { p.armRX = -1.6; p.armRZ = -0.25; p.headY = -0.2 + S(t * 0.6) * 0.1 },
  phone: (t, p) => { p.armRX = -2.6; p.armRZ = 0.55; p.headY = S(t * 0.7) * 0.3; p.headX = 0.1 },
  radio: (t, p) => { p.armRX = -2.2; p.armRZ = 0.5; p.armLX = -1.4 + S(t * 2) * 0.3; p.headY = 0.4 },
  clipboard: (t, p) => { p.armRX = -1.1; p.armLX = -0.9 + S(t * 2.2) * 0.12; p.headX = 0.35 },
  talk: (t, p) => { p.armRX = -0.5 + S(t * 3.2) * 0.35; p.armLX = -0.3 + S(t * 2.4 + 1) * 0.3; p.headY = S(t * 1.6) * 0.2 },
  sit: (t, p) => { p.hipsY = -0.5; p.legL = -1.5; p.legR = -1.5; p.armLX = -0.4; p.armRX = -0.4; p.headY = S(t * 0.5) * 0.25 },
  vibrate: (t, p) => { p.spineX = 0.45; p.armRX = -0.9 + S(t * 40) * 0.04; p.armLX = -1.0 + S(t * 40) * 0.04; p.legL = 0.25 },
  rake: (t, p) => { const k = S(t * 2.4); p.spineX = 0.4; p.armRX = -0.9 + k * 0.5; p.armLX = -1.1 + k * 0.5 },
  sweep: (t, p) => { const k = S(t * 3); p.spineX = 0.3; p.armRX = -0.7; p.armRZ = k * 0.4; p.armLX = -0.9; p.armLZ = k * 0.4 },
  drill: (t, p) => { p.armRX = -1.6 + S(t * 30) * 0.02; p.armLX = -1.4; p.spineX = 0.1 },
  wave: (t, p) => { p.armRX = -2.8; p.armRZ = -0.3 + S(t * 6) * 0.4 },
  photo: (t, p) => { p.armRX = -1.7; p.armLX = -1.7; p.armRZ = 0.3; p.armLZ = -0.3; p.headX = 0.05 },
  cheer: (t, p) => { const k = Math.abs(S(t * 5)); p.armRX = -2.9; p.armLX = -2.9; p.armRZ = -0.3; p.armLZ = 0.3; p.hipsY = k * 0.25 },
  hook: (t, p) => { p.armRX = -2.4 + S(t * 3) * 0.2; p.armLX = -2.2 + S(t * 3 + 1) * 0.2; p.headX = -0.4 },
  signal: (t, p) => { p.armRX = -2.9 + Math.max(0, S(t * 3)) * 0.4; p.armLX = 0; p.headX = -0.45 },
  climb: (t, p) => { p.armRX = -2.6 + S(t * 6) * 0.4; p.armLX = -2.6 - S(t * 6) * 0.4; p.legL = S(t * 6) * 0.5; p.legR = -S(t * 6) * 0.5 },
  drive: (t, p) => { p.hipsY = -0.4; p.legL = -1.4; p.legR = -1.4; p.armLX = -1.1; p.armRX = -1.1 }
}

export const POSE_NAMES = Object.keys(POSES)

// ---- jointed (realistic, skinned) rigs: knees + elbows. Diorama rigs have no knee bones,
// so none of this runs for them. elbow < 0 bends the forearm forward, knee > 0 back.
const J2 = ['elbowL', 'elbowR', 'kneeL', 'kneeR']
const LEG = { thigh: 0.42, shin: 0.415, ankle: 0.085, hip: 0.92, scale: 0.88 }
const swing = (f) => Math.max(0, -Math.cos(f)) * 1.05
const JOINTED = {
  idle: (t, p) => { p.elbowL = p.elbowR = -0.12 },
  walk: (t, p, a) => {
    const f = t * (a.speed || 1.5) * 3.9
    p.kneeL = 0.08 + swing(f); p.kneeR = 0.08 + swing(f + Math.PI)
    p.elbowL = -0.3 - Math.max(0, S(f)) * 0.35; p.elbowR = -0.3 - Math.max(0, -S(f)) * 0.35
  },
  run: (t, p, a) => { JOINTED.walk(t * 1.4, p, a); p.kneeL *= 1.4; p.kneeR *= 1.4; p.elbowL = p.elbowR = -1.4 },
  carry: (t, p, a) => {
    const f = t * (a.speed || 1.1) * 3.9
    p.kneeL = 0.06 + swing(f) * 0.7; p.kneeR = 0.06 + swing(f + Math.PI) * 0.7
    p.armLX = p.armRX = -0.55; p.elbowL = p.elbowR = -0.9
  },
  hammer: (t, p) => { p.elbowR = -0.5 - Math.max(0, S(t * 7)) * 0.5; p.elbowL = -0.9 },
  shovel: (t, p) => { p.elbowR = -0.4; p.elbowL = -0.6 },
  phone: (t, p) => { p.armRX = -0.55; p.armRZ = -0.18; p.elbowR = -2.35; p.elbowL = -0.1 },
  radio: (t, p) => { p.armRX = -0.5; p.armRZ = -0.2; p.elbowR = -2.2; p.elbowL = -0.9 },
  clipboard: (t, p) => { p.armRX = -0.45; p.elbowR = -1.15; p.armLX = -0.35; p.elbowL = -1.2 + S(t * 2.2) * 0.1 },
  talk: (t, p) => { p.elbowR = -0.9 + S(t * 3.2) * 0.3; p.elbowL = -0.6 + S(t * 2.4 + 1) * 0.25 },
  photo: (t, p) => { p.armRX = p.armLX = -1.0; p.armRZ = 0.32; p.armLZ = -0.32; p.elbowR = p.elbowL = -1.25 },
  drill: (t, p) => { p.elbowR = -0.5; p.elbowL = -0.6 },
  weld: (t, p) => { p.elbowR = -0.6; p.elbowL = -0.8 },
  rebar: (t, p) => { p.elbowR = -0.5; p.elbowL = -0.5 },
  inspect: (t, p) => { p.elbowR = -0.6; p.elbowL = -0.2 },
  paddle: (t, p) => { p.elbowR = -0.35; p.elbowL = -0.2 },
  vibrate: (t, p) => { p.elbowR = p.elbowL = -0.6 },
  rake: (t, p) => { p.elbowR = p.elbowL = -0.5 },
  sweep: (t, p) => { p.elbowR = p.elbowL = -0.5 },
  climb: (t, p) => { p.kneeL = Math.max(0, S(t * 6)) * 1.2; p.kneeR = Math.max(0, -S(t * 6)) * 1.2; p.elbowL = p.elbowR = -0.5 },
  sit: (t, p) => { p.kneeL = p.kneeR = 1.5; p.elbowL = p.elbowR = -0.9 },
  drive: (t, p) => { p.kneeL = p.kneeR = 1.45; p.elbowL = p.elbowR = -0.5 }
}

/** knee flexion that keeps the foot on the ground for a given thigh angle and hip drop */
function groundKnee(thigh, drop) {
  const H = LEG.hip + drop - LEG.ankle
  if (Math.cos(thigh) * LEG.thigh + LEG.shin <= H) return 0
  const c = (H - LEG.thigh * Math.cos(thigh)) / LEG.shin
  if (c >= 1) return 0
  return Math.max(0, Math.acos(Math.max(-1, c)) - thigh)
}

export function animateHuman(e, dt, time, env) {
  const a = e.agent
  const r = e.rig
  const p = (r._p ||= {})
  const cur = (r._cur ||= Object.fromEntries(J.map((k) => [k, 0])))
  for (const k of J) p[k] = 0
  a.animT = (a.animT || 0) + dt
  const anim = a.deckLift ? 'climb' : a.anim || 'idle'
  ;(POSES[anim] || POSES.idle)(time + (r.phase ??= Math.random() * 10), p, a)
  const jointed = !!r.kneeL
  if (jointed) {
    for (const j of J2) p[j] = 0
    JOINTED[anim]?.(time + r.phase, p, a)
  }
  const k = damp(anim === 'walk' || anim === 'carry' || anim === 'run' ? 18 : 9, dt)
  for (const j of J) cur[j] += (p[j] - cur[j]) * k
  if (jointed) {
    for (const j of J2) cur[j] = (cur[j] ?? 0) + (p[j] - (cur[j] ?? 0)) * k
    const drop = cur.hipsY * LEG.scale
    r.hips.position.y = drop
    r.kneeL.rotation.x = Math.max(cur.kneeL, groundKnee(cur.legL, drop))
    r.kneeR.rotation.x = Math.max(cur.kneeR, groundKnee(cur.legR, drop))
    r.elbowL.rotation.x = cur.elbowL
    r.elbowR.rotation.x = cur.elbowR
  } else r.hips.position.y = cur.hipsY
  r.spine.rotation.x = cur.spineX
  r.spine.rotation.z = cur.spineZ
  r.head.rotation.x = cur.headX
  r.head.rotation.y = cur.headY
  r.legL.rotation.x = cur.legL
  r.legR.rotation.x = cur.legR
  r.armL.rotation.x = cur.armLX
  r.armL.rotation.z = cur.armLZ
  r.armR.rotation.x = cur.armRX
  r.armR.rotation.z = cur.armRZ
  // equipment follows the agent state
  const tool = a.tool !== undefined && a.tool !== null ? a.tool : ANIM_TOOL[anim] || a.defaultTool || null
  if ((r.tool?.userData.name || null) !== tool) setTool(r, tool)
  const carried = a.carrying || null
  if ((r.carried?.userData.name || null) !== carried) setCarried(r, carried)
  if (r.umbrella) r.umbrella.visible = !!env.wet && !carried && !a.onDeck && a.anim !== 'photo'
}
