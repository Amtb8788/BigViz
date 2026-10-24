// Traffic-aware movement steps (installed over the generic ones when a scene has signals):
//   drive     - lane routing (multi-lane, `through` waypoints), IDM car-following, stop lines
//   walk      - pedestrians wait at the kerb unless the crossing shows WALK
//   roadEnter - spawn on the kerb lane of a dead-end node once the spot is clear
// Scenes without ctx.traffic fall back to the original step behaviour.

import { STEPS, STEP_LABELS, registerStep } from './steps.js'
import { PathFollower, smooth, dedupe } from './roads.js'
import { findLeader, followStep, stopDecision, IDM } from './traffic.js'
import { angleDelta, clamp, damp, lerp } from '../core/math.js'

const rnd = (v) => (Array.isArray(v) ? v[0] + Math.random() * (v[1] - v[0]) : v ?? 0)
const P = (c, e, spec) => c.resolve(spec, e)

/** Lane polyline for a drive step: current position -> via -> graph route (through waypoints) -> then */
function buildPath(c, e, s) {
  const a = e.agent
  const R = c.roads
  const pts = [{ x: a.x, z: a.z }]
  for (const v of s.via || []) pts.push(P(c, e, v))
  const to = typeof s.to === 'function' ? s.to(c, e) : s.to
  if (to) {
    const last = pts[pts.length - 1]
    const from = R.nearest(last.x, last.z, null, !!s.public)
    const through = (typeof s.through === 'function' ? s.through(c, e) : s.through) || []
    const ids = R.routeVia([from.id, ...through, to], { public: !!s.public })
    const lane = R.lanePoints(ids.length > 1 ? ids : [to])
    const hx = Math.sin(a.yaw)
    const hz = Math.cos(a.yaw)
    while (lane.length > 1) {
      const dx = lane[0].x - last.x
      const dz = lane[0].z - last.z
      const d = Math.hypot(dx, dz)
      if (d < 3 || (dx * hx + dz * hz) / (d || 1) < -0.2) lane.shift()
      else break
    }
    pts.push(...lane)
  }
  for (const t of s.then || []) pts.push(P(c, e, t))
  return new PathFollower(smooth(dedupe(pts, 0.3), s.sharp ? 1 : 2))
}

/** Other road users as plain obstacles (vehicles + pedestrians on a crossing) */
function obstacles(c, e) {
  const T = c.traffic
  const out = []
  for (const v of c.vehicles) {
    if (v === e) continue
    const b = v.agent
    if (b.blockedBy === e.id) continue
    out.push({ id: v.id, x: b.x, z: b.z, yaw: b.yaw + (b.reversing ? Math.PI : 0), speed: b.speed, length: b.length || 6, drive: b.step?.do === 'drive' || b.step?.do === 'reverse', held: !!b.held })
  }
  if (T._wTick !== T.tick) {
    T._wTick = T.tick
    T._walkers = []
    for (const w of c.engine?.agents?.agents || []) {
      const b = w.agent
      if (b.kind !== 'walker' || !w.active || b.hidden || b.onDeck) continue
      if (T.zoneAt(b.x, b.z)) T._walkers.push({ id: w.id, x: b.x, z: b.z, walker: true, speed: 0, held: true })
    }
  }
  return out.concat(T._walkers)
}
/** One drive tick: speed from IDM (leader, stop line, path end), then move along the path */
function follow(c, e, s, st, dt) {
  const a = e.agent
  const T = c.traffic
  const path = st.path
  const L = path.length
  const half = (a.length || 4.6) / 2
  let v0 = st.vmax
  const turn = path.turnAhead(st.s, 7 + a.speed * 0.6)
  v0 = Math.min(v0, lerp(v0, 2.6, clamp(turn / 1.1, 0, 1)))
  // signal: nearest stop line we must respect
  let stop = null
  let held = false
  for (const k of st.stops) {
    const dist = k.s - (st.s + half)
    if (dist < -0.2) continue
    if (dist > 70) break
    const asp = k.j.ctl.aspect(k.stop.group)
    const d = stopDecision(asp, dist, a.speed, k.memo)
    if (d === 'caution' && dist < 14) v0 = Math.min(v0, 4)
    if (d === 'stop') { stop = { dist }; held = true; break }
  }
  // path end as a standing obstacle at the end point (centre stops there)
  const remain = L - st.s
  // (followStep holds ~0.6 m before `dist`, so +0.4 lands the centre on the end point)
  if (s.stop !== false && (!stop || remain + 0.4 < stop.dist)) stop = { dist: remain + 0.4 }
  // car ahead
  const lead = findLeader(path, { s: st.s, length: a.length || 4.6 }, obstacles(c, e), { look: 14 + a.speed * 3.2 })
  let leader = lead ? { gap: lead.gap, v: lead.v } : null
  if (lead) {
    const o = c.engine?.world?.get(lead.id)?.agent
    const oHeld = !o || o.held || lead.v === 0 && !(o.step?.do === 'drive' || o.step?.do === 'reverse')
    if (lead.gap < 8 && a.speed < 0.5) held = held || oHeld
    // deadlock breaker: two movers stuck nose to nose -> creep after a while
    st.wait = !oHeld && a.speed < 0.3 ? (st.wait || 0) + dt : 0
    a.blockedBy = lead.gap < 10 ? lead.id : null
    if (st.wait > 20) { leader = null; v0 = Math.min(v0, 1.2) }
  } else {
    st.wait = 0
    a.blockedBy = null
  }
  a.held = held
  const before = a.speed
  a.speed = followStep(a.speed, v0, dt, leader, stop, IDM)
  if (stop && stop.dist > 0.4 && a.speed < 0.25 && !held && !leader) a.speed = Math.max(a.speed, 0.6) // creep the last bit
  a.braking = a.speed < before - 0.4 * dt || (a.speed < 0.2 && (held || !!stop))
  a.reversing = false
  st.s = Math.min(L, st.s + a.speed * dt)
  const p = path.sample(st.s)
  const q = path.sample(Math.min(L, st.s + 1.8))
  a.x = p.x
  a.z = p.z
  const dx = q.x - p.x
  const dz = q.z - p.z
  if (dx * dx + dz * dz > 1e-4) {
    const yaw = Math.atan2(dx, dz)
    const d = angleDelta(a.yaw, yaw)
    a.yaw += d * damp(6, dt)
    a.steer = clamp(d * 2.2, -0.55, 0.55)
  }
  a.anim = 'drive'
  a.label = held && a.speed < 0.5 && stop ? '等红灯' : st.label
  const done = st.s >= L - 0.05 || (s.stop !== false && remain < 0.35 && a.speed < 0.8)
  if (done) {
    if (s.stop !== false) a.speed = 0
    st.s = L
    a.braking = false
    a.steer = 0
    a.blockedBy = null
    a.held = false
    a.label = st.label
    return true
  }
  return false
}
let installed = false

/** Wrap drive / walk and add roadEnter. Idempotent; safe for scenes without traffic. */
export function installTrafficSteps() {
  if (installed) return
  installed = true
  const baseDrive = STEPS.drive
  const baseWalk = STEPS.walk

  registerStep('drive', {
    start(c, e, s, st) {
      if (!c.traffic) { st.base = true; return baseDrive.start(c, e, s, st) }
      const a = e.agent
      st.path = buildPath(c, e, s)
      st.s = 0
      st.vmax = rnd(s.speed) || a.maxSpeed || 7
      st.label = a.label
      st.stops = c.traffic.stopsOn(st.path, -(a.length || 4.6) / 2)
    },
    update(c, e, s, st, dt) {
      if (st.base) return baseDrive.update(c, e, s, st, dt)
      return follow(c, e, s, st, dt)
    },
    cancel(c, e) {
      e.agent.held = false
      e.agent.blockedBy = null
    }
  })

  registerStep('walk', {
    start: baseWalk.start,
    update(c, e, s, st, dt) {
      const T = c.traffic
      const a = e.agent
      const w = st.wp[st.i]
      if (T && w && !a.onDeck && !T.zoneAt(a.x, a.z)) {
        const dx = w.p.x - a.x
        const dz = w.p.z - a.z
        const d = Math.hypot(dx, dz)
        if (d > 0.3) {
          const k = Math.min(d, 0.9) / d
          if (!T.canWalk(a.x + dx * k, a.z + dz * k)) {
            a.speed = 0
            a.anim = 'idle'
            a.yaw += angleDelta(a.yaw, Math.atan2(dx, dz)) * damp(5, dt)
            st.label ??= a.label
            a.label = '等待绿灯'
            return false
          }
        }
      }
      if (st.label != null) { a.label = st.label; st.label = null }
      return baseWalk.update(c, e, s, st, dt)
    }
  })

  // spawn on the kerb lane at a dead-end node; waits while the spot is occupied
  registerStep('roadEnter', {
    start(c, e, s, st) {
      const at = typeof s.at === 'function' ? s.at(c, e) : s.at
      st.at = Array.isArray(at) ? at[Math.floor(Math.random() * at.length)] : at
    },
    update(c, e, s, st) {
      const R = c.roads
      const p = R.entry ? R.entry(st.at) : { ...R.node(st.at), yaw: s.yaw ?? 0 }
      const clear = s.clear ?? 9
      for (const v of c.vehicles) if (v !== e && Math.hypot(v.agent.x - p.x, v.agent.z - p.z) < clear) return false
      const a = e.agent
      Object.assign(a, { x: p.x, z: p.z, y: 0, yaw: p.yaw, hidden: false, onDeck: false, speed: s.speed ?? 3, enteredAt: st.at })
      if (!c.vehicles.includes(e)) c.vehicles.push(e)
      return true
    }
  }, '驶入')
}

installTrafficSteps()
