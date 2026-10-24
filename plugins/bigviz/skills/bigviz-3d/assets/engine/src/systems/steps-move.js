// Movement steps: walk (people), drive / reverse (road vehicles over the road graph),
// path (explicit polyline, forklifts / machines), face, teleport, wander.

import { PathFollower, smooth, dedupe } from './roads.js'
import { angleDelta, approach, approachAngle, clamp, damp, lerp } from '../core/math.js'

export const rnd = (v) => (Array.isArray(v) ? v[0] + Math.random() * (v[1] - v[0]) : v ?? 0)

function blockedBy(c, e) {
  const a = e.agent
  const hx = Math.sin(a.yaw) * (a.reversing ? -1 : 1)
  const hz = Math.cos(a.yaw) * (a.reversing ? -1 : 1)
  for (const v of c.vehicles) {
    if (v === e) continue
    const b = v.agent
    if (b.blockedBy === e.id) continue
    const dx = b.x - a.x
    const dz = b.z - a.z
    const d = Math.hypot(dx, dz)
    const gap = (a.length || 6) / 2 + (b.length || 6) / 2 + 2.2
    if (d > gap || d < 1e-3) continue
    if ((dx * hx + dz * hz) / d > 0.82) return v
  }
  return null
}

function followPath(c, e, s, st, dt, reverse) {
  const a = e.agent
  const L = st.path.length
  const remain = L - st.s
  let vmax = rnd(s.speed) || (reverse ? 1.6 : a.maxSpeed || 7)
  const turn = st.path.turnAhead(st.s, 7)
  vmax = Math.min(vmax, lerp(vmax, 2.4, clamp(turn / 1.1, 0, 1)))
  const vStop = s.stop === false ? vmax : Math.max(0.5, Math.sqrt(2 * 2.4 * Math.max(0, remain - 0.15)))
  let target = Math.min(vmax, vStop)
  const blocker = s.ignoreTraffic ? null : blockedBy(c, e)
  if (blocker) {
    a.blockedBy = blocker.id
    st.wait = (st.wait || 0) + dt
    target = st.wait > 12 ? Math.min(target, 1.2) : 0
  } else {
    a.blockedBy = null
    st.wait = 0
  }
  a.speed = approach(a.speed, target, (target < a.speed ? 6 : 2.4) * dt)
  a.braking = target < a.speed - 0.2 || (remain < 4 && s.stop !== false)
  a.reversing = reverse
  st.s += a.speed * dt
  const p = st.path.sample(st.s)
  const q = st.path.sample(Math.min(L, st.s + 1.8))
  a.x = p.x
  a.z = p.z
  const dx = q.x - p.x
  const dz = q.z - p.z
  if (dx * dx + dz * dz > 1e-4) {
    let yaw = Math.atan2(dx, dz)
    if (reverse) yaw += Math.PI
    const d = angleDelta(a.yaw, yaw)
    a.yaw += d * damp(6, dt)
    a.steer = clamp(d * 2.2, -0.55, 0.55) * (reverse ? -1 : 1)
  }
  a.anim = 'drive'
  if (st.s >= L - 0.05) {
    if (s.stop !== false) a.speed = 0
    a.braking = false
    a.reversing = false
    a.steer = 0
    a.blockedBy = null
    return true
  }
  return false
}

const P = (c, e, spec) => c.resolve(spec, e)

export const moveSteps = {
  walk: {
    start(c, e, s, st) {
      st.wp = [...(s.via || []), s.to].map((w) => ({ spec: w, p: P(c, e, w) })).filter((w) => w.p)
      st.i = 0
      if (!st.wp.length) return true
    },
    update(c, e, s, st, dt) {
      const a = e.agent
      const w = st.wp[st.i]
      if (w.spec && w.spec.entity) w.p = P(c, e, w.spec)
      const dx = w.p.x - a.x
      const dz = w.p.z - a.z
      const d = Math.hypot(dx, dz)
      if (d < 0.2) {
        st.i++
        if (st.i >= st.wp.length) {
          a.speed = 0
          a.anim = 'idle'
          if (w.p.yaw != null) a.yaw = w.p.yaw
          return true
        }
        return false
      }
      const sp = rnd(s.speed) || (a.carrying ? 1.15 : a.walkSpeed || 1.55)
      a.yaw = approachAngle(a.yaw, Math.atan2(dx, dz), 7 * dt)
      const k = Math.min(d, sp * dt)
      a.x += (dx / d) * k
      a.z += (dz / d) * k
      a.speed = sp
      a.anim = s.anim || (a.carrying ? 'carry' : s.run ? 'run' : 'walk')
      return false
    }
  },

  drive: {
    start(c, e, s, st) {
      const a = e.agent
      const R = c.roads
      const pts = [{ x: a.x, z: a.z }]
      for (const v of s.via || []) pts.push(P(c, e, v))
      const to = typeof s.to === 'function' ? s.to(c, e) : s.to
      st.toId = to
      if (to) {
        const last = pts[pts.length - 1]
        const from = R.nearest(last.x, last.z, null, !!s.public)
        const ids = R.route(from.id, to, { public: !!s.public }) || [to]
        const lane = R.lanePoints(ids)
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
      st.path = new PathFollower(smooth(dedupe(pts, 0.3), s.sharp ? 1 : 2))
      st.s = 0
    },
    update: (c, e, s, st, dt) => followPath(c, e, s, st, dt, false)
  },

  reverse: {
    start(c, e, s, st) {
      const a = e.agent
      const pts = [{ x: a.x, z: a.z }, ...(s.path || [s.to]).map((p) => P(c, e, p))]
      st.path = new PathFollower(smooth(dedupe(pts, 0.2), 2))
      st.s = 0
      st.beep = 0
      if (s.say !== false) c.say(e, s.say || '倒车，请注意', 3)
    },
    update(c, e, s, st, dt) {
      st.beep += dt
      return followPath(c, e, { speed: 1.6, ...s }, st, dt, true)
    }
  },

  /** explicit polyline (off-road: forklifts, excavator tracks, carts) */
  path: {
    start(c, e, s, st) {
      const a = e.agent
      const pts = [{ x: a.x, z: a.z }, ...s.points.map((p) => P(c, e, p))]
      st.path = new PathFollower(smooth(dedupe(pts, 0.2), s.sharp ? 0 : 2))
      st.s = 0
    },
    update: (c, e, s, st, dt) => followPath(c, e, { ignoreTraffic: true, maxSpeed: 3, ...s, speed: s.speed || 2.5 }, st, dt, !!s.reverse)
  },

  face: {
    start(c, e, s, st) {
      if (s.yaw != null) st.yaw = s.yaw
      else {
        const p = P(c, e, s.to)
        st.yaw = Math.atan2(p.x - e.agent.x, p.z - e.agent.z)
      }
    },
    update(c, e, s, st, dt) {
      const a = e.agent
      a.yaw = approachAngle(a.yaw, st.yaw, (s.rate || 4) * dt)
      a.speed = 0
      return Math.abs(angleDelta(a.yaw, st.yaw)) < 0.02
    }
  },

  teleport: {
    start(c, e, s) {
      const p = P(c, e, s.to)
      const a = e.agent
      a.x = p.x
      a.z = p.z
      a.y = p.y ?? 0
      a.onDeck = !!p.onDeck
      if (s.yaw != null) a.yaw = s.yaw
      else if (p.yaw != null) a.yaw = p.yaw
      return true
    }
  },

  /** stroll inside an area for t seconds with pauses (pedestrians, foreman) */
  wander: {
    start(c, e, s, st) {
      st.t = rnd(s.t ?? 20)
      st.target = null
      st.pause = 0
    },
    update(c, e, s, st, dt) {
      const a = e.agent
      st.t -= dt
      if (st.t <= 0) { a.anim = 'idle'; a.speed = 0; return true }
      if (st.pause > 0) { st.pause -= dt; a.anim = s.idle || 'idle'; a.speed = 0; return false }
      if (!st.target) {
        const ar = s.area
        st.target = ar.r != null
          ? { x: ar.x + (Math.random() * 2 - 1) * ar.r, z: ar.z + (Math.random() * 2 - 1) * ar.r }
          : { x: ar.x + (Math.random() - 0.5) * ar.w, z: ar.z + (Math.random() - 0.5) * ar.d }
      }
      const dx = st.target.x - a.x
      const dz = st.target.z - a.z
      const d = Math.hypot(dx, dz)
      if (d < 0.3) { st.target = null; st.pause = rnd(s.pause ?? [1, 4]); return false }
      const sp = s.speed || 1.1
      a.yaw = approachAngle(a.yaw, Math.atan2(dx, dz), 5 * dt)
      a.x += (dx / d) * Math.min(d, sp * dt)
      a.z += (dz / d) * Math.min(d, sp * dt)
      a.speed = sp
      a.anim = 'walk'
      return false
    }
  }
}
