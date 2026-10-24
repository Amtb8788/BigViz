// Street pack - pedestrians. One step, `stroll`, runs a per-person action queue planned
// trip by trip: walk a sidewalk arm, queue at a corner, cross on the scramble phase only
// (two-stage via the island when the remaining walk time is short), continue, window-shop,
// enter a shop. Bus riders wait in the shelters, board when a bus dwells, alight and walk off.
// Height follows the kerb (sidewalk 18 cm, crossings at grade).

import { registerStep } from '../../systems/steps.js'
import { approachAngle } from '../../core/math.js'
import { EW, NS, SW_Y, ROAD_Y, HX, HZ, EW_CROSS, NS_CROSS, WALK_EW, WALK_NS, FRONT_EW, FRONT_NS, BUS_STOP } from './layout.js'

const rand = (a, b) => a + Math.random() * (b - a)
const pick = (a) => a[Math.floor(Math.random() * a.length)]

/** walking surface height at (x, z): corner blocks are raised, the carriageway is not */
export function groundY(x, z) {
  const k = Math.min(1, Math.max(0, (Math.abs(x) - NS.hw + 0.12) / 0.24)) * Math.min(1, Math.max(0, (Math.abs(z) - EW.hw + 0.12) / 0.24))
  return ROAD_Y + (SW_Y - ROAD_Y) * k
}

// ---------------------------------------------------------------- network
// corners: sx, sz = signs; arms: along 中山路 ('ew', x outward) and along 解放路 ('ns', z outward)
const CORNERS = { NE: [1, -1], NW: [-1, -1], SE: [1, 1], SW: [-1, 1] }
const hub = (sx, sz) => ({ x: sx * WALK_NS, z: sz * WALK_EW })
const armPt = (sx, sz, arm, d, lat = 0) => (arm === 'ew' ? { x: sx * d, z: sz * (WALK_EW + lat) } : { x: sx * (WALK_NS + lat), z: sz * d })
const ARM_END = { ew: HX - 3, ns: HZ - 3 }
const ARM_MIN = { ew: 24, ns: 27 }
const door = (sx, sz, arm, d) => (arm === 'ew' ? { x: sx * d, z: sz * (FRONT_EW - 0.4) } : { x: sx * (FRONT_NS - 0.4), z: sz * d })

/**
 * Crossing between two corners. 中山路 is crossed on the E / W legs (walk along z), 解放路 on
 * the N / S legs (walk along x). Walkers keep to the right half of the 4 m crosswalk band.
 */
function crossing(from, to) {
  const [ax, az] = CORNERS[from]
  const [bx, bz] = CORNERS[to]
  if (ax === bx) {
    // across 中山路 at x = ax * EW_CROSS, walking dir = sign(bz)
    const dir = bz
    const x = ax * EW_CROSS - dir * rand(0.55, 1.6)
    const P = (z) => ({ x, z })
    return {
      leg: ax > 0 ? 'E' : 'W', D: EW.hw * 2, island: EW.island,
      wait: P(-dir * rand(18.4, 19.4)), kerb: P(-dir * (EW.hw + 0.1)), mid: P(-dir * (EW.island + 0.35)), far: P(dir * (EW.hw + 0.1)), out: P(dir * rand(18.4, 19.2))
    }
  }
  // (the ped-signal post stands on the crosswalk centre line 0.7 m behind each kerb)
  const dir = bx
  const z = az * NS_CROSS + dir * rand(0.55, 1.6)
  const P = (x) => ({ x, z })
  return {
    leg: az < 0 ? 'N' : 'S', D: NS.hw * 2, island: NS.island,
    wait: P(-dir * rand(14.6, 15.7)), kerb: P(-dir * (NS.hw + 0.1)), mid: P(-dir * (NS.island + 0.35)), far: P(dir * (NS.hw + 0.1)), out: P(dir * rand(14.6, 15.4))
  }
}

// ---------------------------------------------------------------- gates
/** may start crossing now? 'full' | 'half' | false; sets the walking speed */
function crossGate(c, e, X, half) {
  const ctl = c.traffic?.junctions?.[0]?.ctl
  if (!ctl?.pedWindow) return 'full'
  if (ctl.mode === 'off') return 'full'
  const w = ctl.pedWindow()
  if (w.state !== 'walk') return false
  const d = half ? X.D / 2 + 0.6 : X.D + 0.8
  const base = e.agent.walkSpeed || 1.3
  if (w.left - 2 > d / 1.75) { e.agent.crossSpeed = Math.min(1.75, Math.max(base, d / (w.left - 2))); return 'full' }
  // wide road: go for the island when at least that half fits
  if (!half && w.left - 1.5 > (X.D / 2 + 0.6) / 1.75) { e.agent.crossSpeed = 1.6; return 'half' }
  return false
}

/** no bike (or anything) on the bike lane near the crossing point (bus stops) */
export function bikeLaneClear(c, p, lineZ, ahead = 16) {
  for (const v of c.vehicles) {
    const a = v.agent
    if (Math.abs(a.z - lineZ) > 1.6 || a.hidden) continue
    const along = (p.x - a.x) * Math.sin(a.yaw)
    if (along > -2.5 && along < ahead) return false
  }
  return true
}

// ---------------------------------------------------------------- stroll step
function goTo(e, p, sp, dt) {
  const a = e.agent
  const dx = p.x - a.x
  const dz = p.z - a.z
  const d = Math.hypot(dx, dz)
  if (d < 0.15) { a.speed = 0; return true }
  a.yaw = approachAngle(a.yaw, Math.atan2(dx, dz), 6 * dt)
  const k = Math.min(d, sp * dt)
  a.x += (dx / d) * k
  a.z += (dz / d) * k
  a.y = groundY(a.x, a.z)
  a.speed = sp
  a.anim = 'walk'
  return false
}

function runAction(c, e, q, dt) {
  const a = e.agent
  const x = q[0]
  switch (x.k) {
    case 'go': {
      const sp = x.cross ? a.crossSpeed || 1.4 : x.sp || a.walkSpeed || 1.3
      if (x.label) a.label = x.label
      return goTo(e, x.p, sp, dt)
    }
    case 'idle':
      x.t ??= Array.isArray(x.dur) ? rand(...x.dur) : x.dur
      a.speed = 0
      a.anim = x.anim || 'idle'
      if (x.yaw != null) a.yaw = approachAngle(a.yaw, x.yaw, 4 * dt)
      if (x.label) a.label = x.label
      return (x.t -= dt) <= 0
    case 'until': {
      a.speed = 0
      a.anim = x.anim || 'idle'
      if (x.yaw != null) a.yaw = approachAngle(a.yaw, x.yaw, 4 * dt)
      if (x.label) a.label = x.label
      x.waited = (x.waited || 0) + dt
      if (x.timeout && x.waited > x.timeout) { if (x.onTimeout) x.onTimeout(c, e, q); return true }
      return !!x.test(c, e, dt)
    }
    case 'do':
      x.fn(c, e, q)
      return true
    case 'hide':
      a.hidden = true
      a.speed = 0
      x.t ??= Array.isArray(x.dur) ? rand(...x.dur) : x.dur ?? 0
      return (x.t -= dt) <= 0
    case 'show':
      Object.assign(a, { x: x.p.x, z: x.p.z, y: groundY(x.p.x, x.p.z), hidden: false })
      if (x.yaw != null) a.yaw = x.yaw
      return true
  }
  return true
}

registerStep('stroll', {
  start(c, e, s, st) {
    st.q = s.plan(c, e)
  },
  update(c, e, s, st, dt) {
    for (let guard = 0; guard < 6; guard++) {
      if (!st.q.length) return true
      if (!runAction(c, e, st.q, dt)) return false
      st.q.shift()
      dt = 0
    }
    return false
  }
}, '步行中')

// ---------------------------------------------------------------- plans
/** queue at the kerb, cross (two-stage when needed), step out on the far side */
function crossActions(X, hubTo) {
  const label = '等待行人绿灯'
  const yaw = Math.atan2(X.far.x - X.kerb.x, X.far.z - X.kerb.z)
  const gate = { mode: 'full' }
  return [
    { k: 'go', p: X.wait },
    { k: 'until', yaw, label, anim: Math.random() < 0.3 ? 'phone' : 'idle', test: (c, e) => (gate.mode = crossGate(c, e, X, false)) },
    { k: 'go', p: X.kerb, cross: true, label: '过街' },
    { k: 'go', p: X.mid, cross: true },
    // two-stage: on the island until the next walk phase leaves time for the second half
    { k: 'until', yaw, label: '安全岛等候', test: (c, e) => gate.mode === 'full' || crossGate(c, e, X, true) === 'full' },
    { k: 'go', p: X.far, cross: true },
    { k: 'go', p: X.out },
    { k: 'go', p: hubTo }
  ]
}

const LOOK = ['phone', 'idle', 'talk']

/** one sidewalk trip for a pedestrian; first = spawn mid-arm (scene starts populated) */
export function pedPlan(c, e) {
  const a = e.agent
  // lateral offset from the walking line (+ = toward the shops; keeps clear of the shelters)
  const lat = a.lat ?? (a.lat = rand(-0.3, 0.9))
  const first = !a.tripCount
  a.tripCount = (a.tripCount || 0) + 1
  a.label = '步行中'
  const names = Object.keys(CORNERS)
  let cur = pick(names)
  let [sx, sz] = CORNERS[cur]
  const arm0 = pick(['ew', 'ew', 'ns'])
  const q = []
  const d0 = rand(ARM_MIN[arm0] + 4, ARM_END[arm0])
  if (first) {
    q.push({ k: 'show', p: armPt(sx, sz, arm0, d0, lat) })
  } else {
    q.push({ k: 'hide', dur: [2, 22] })
    const fromShop = Math.random() < 0.4
    const p = fromShop ? door(sx, sz, arm0, d0) : armPt(sx, sz, arm0, ARM_END[arm0], lat)
    q.push({ k: 'show', p })
    if (fromShop) q.push({ k: 'go', p: armPt(sx, sz, arm0, d0, lat) })
  }
  // walk in to the corner
  q.push({ k: 'go', p: armPt(sx, sz, arm0, ARM_MIN[arm0], lat) }, { k: 'go', p: hub(sx, sz) })
  // 0..2 crossings to adjacent corners
  const n = Math.random() < 0.18 ? 0 : Math.random() < 0.7 ? 1 : 2
  let last = null
  for (let i = 0; i < n; i++) {
    const nbrs = names.filter((k) => k !== cur && k !== last && (CORNERS[k][0] === sx || CORNERS[k][1] === sz))
    const to = pick(nbrs)
    const X = crossing(cur, to)
    last = cur
    cur = to
    ;[sx, sz] = CORNERS[cur]
    q.push(...crossActions(X, hub(sx, sz)))
  }
  // out along the other arm (or the same one after crossing)
  const arm1 = n === 0 ? (arm0 === 'ew' ? 'ns' : 'ew') : pick(['ew', 'ew', 'ns'])
  const d1 = rand(ARM_MIN[arm1] + 6, ARM_END[arm1])
  q.push({ k: 'go', p: armPt(sx, sz, arm1, ARM_MIN[arm1], lat) })
  if (Math.random() < 0.35) {
    // window shopping on the way
    const dw = rand(ARM_MIN[arm1] + 4, d1)
    const yaw = arm1 === 'ew' ? (sz > 0 ? 0 : Math.PI) : (sx > 0 ? Math.PI / 2 : -Math.PI / 2)
    q.push({ k: 'go', p: armPt(sx, sz, arm1, dw, 1.7) }, { k: 'idle', dur: [3, 8], anim: pick(LOOK), yaw, label: '逛街' })
  }
  if (Math.random() < 0.45) q.push({ k: 'go', p: armPt(sx, sz, arm1, d1, lat) }, { k: 'go', p: door(sx, sz, arm1, d1) })
  else q.push({ k: 'go', p: armPt(sx, sz, arm1, ARM_END[arm1], lat) })
  q.push({ k: 'hide', dur: 0 })
  return q
}

