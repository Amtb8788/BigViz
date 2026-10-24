// Street pack - lane-level routing. The engine's road graph puts every vehicle on the kerb
// lane (or the inner one before a left turn); a real 8-lane approach needs lane choice, a
// lane change into the left-turn bay, right turners in the bus lane, buses, bikes on their
// own lane and turn arcs that never cross an opposing turn. Trips are precomputed polylines
// (inbound lane -> filleted turn -> outbound lane); the engine's traffic-aware `drive` step
// still does IDM car following, stop lines and pedestrians on the crossings. The wrapper
// below only kicks in for drive steps that carry `lane` (this pack); everything else passes
// straight through.

import { STEPS, registerStep } from '../../systems/steps.js'
import '../../systems/traffic-steps.js'
import { EW, NS, EW_STOP, NS_STOP, HX, HZ, LANE_W, BUS_STOP } from './layout.js'

const PI = Math.PI
/** leg = road arm, d = unit vector from the centre outward */
export const LEGS = {
  E: { id: 'E', dx: 1, dz: 0, road: EW, group: 'ew', stop: EW_STOP, far: HX - 2, name: '东进口' },
  W: { id: 'W', dx: -1, dz: 0, road: EW, group: 'ew', stop: EW_STOP, far: HX - 2, name: '西进口' },
  N: { id: 'N', dx: 0, dz: -1, road: NS, group: 'ns', stop: NS_STOP, far: HZ - 2, name: '北进口' },
  S: { id: 'S', dx: 0, dz: 1, road: NS, group: 'ns', stop: NS_STOP, far: HZ - 2, name: '南进口' }
}
const OPP = { E: 'W', W: 'E', N: 'S', S: 'N' }
const key = (x, z) => (x > 0.5 ? 'E' : x < -0.5 ? 'W' : z < 0 ? 'N' : 'S')

/** exit leg for a movement S(traight) / L(eft) / R(ight) from approach `app` (right-hand traffic) */
export function exitLeg(app, move) {
  const L = LEGS[app]
  const tx = -L.dx
  const tz = -L.dz
  if (move === 'S') return OPP[app]
  return move === 'L' ? key(tz, -tx) : key(-tz, tx)
}

// point on the inbound / outbound side of a leg: d from the centre, o right of travel
export const inPt = (L, d, o) => ({ x: L.dx * d + L.dz * o, z: L.dz * d - L.dx * o })
export const outPt = (L, d, o) => ({ x: L.dx * d - L.dz * o, z: L.dz * d + L.dx * o })
/** distance from the centre along the leg / lateral offset (right of inbound travel) */
export const legD = (L, x, z) => x * L.dx + z * L.dz
export const legO = (L, x, z) => L.dz * x - L.dx * z

const smooth01 = (t) => t * t * (3 - 2 * t)

/** inbound polyline from d0 down to d1; o(d) handles a lane change */
function inbound(L, d0, d1, o, shift) {
  const pts = []
  let d = d0
  while (d > d1 + 0.01) {
    pts.push(inPt(L, d, o(d)))
    const inS = shift && d <= shift[0] + 3 && d >= shift[1] - 3
    d -= inS ? 2 : 6
  }
  pts.push(inPt(L, d1, o(d1)))
  return pts
}

function outbound(L, d0, d1, o) {
  const pts = []
  for (let d = d0; d < d1; d += 6) pts.push(outPt(L, d, o))
  pts.push(outPt(L, d1, o))
  return pts
}

/**
 * Lane polyline for one movement. lane / exitLane: lane index (0 = inner), or 'bike'.
 * shift: [dFrom, dTo, laneFrom] lane change before the junction. R: turn radius (m).
 */
export function tripPath(app, move, lane, exitLane, { shift = null, R } = {}) {
  const A = LEGS[app]
  const X = LEGS[exitLeg(app, move)]
  const off = (road, l) => (l === 'bike' ? road.bike : road.offs[l])
  const o1 = off(A.road, lane)
  const o0 = shift ? off(A.road, shift[2]) : o1
  const o = (d) => (!shift || d >= shift[0] ? o0 : d <= shift[1] ? o1 : o0 + (o1 - o0) * smooth01((shift[0] - d) / (shift[0] - shift[1])))
  const o2 = off(X.road, exitLane)
  const far = A.far
  const end = X.far + 4
  if (move === 'S') return [...inbound(A, far, 0, o, shift), ...outbound(X, 6, end, o2)]
  // turn: corner K of the two lane rails, fillet radius R tangent to both
  const tx = -A.dx
  const tz = -A.dz
  const P0 = inPt(A, 0, o1)
  const Q0 = outPt(X, 0, o2)
  const a = (Q0.x - P0.x) * tx + (Q0.z - P0.z) * tz
  const K = { x: P0.x + tx * a, z: P0.z + tz * a }
  const b = (P0.x - Q0.x) * X.dx + (P0.z - Q0.z) * X.dz
  // never start the arc behind the stop line
  const r = Math.min(R ?? (move === 'L' ? 14 : 7), a + A.stop + 1)
  const dS = -(a - r) // distance of the arc start from the centre along the approach
  const S = inPt(A, dS, o1)
  const E = { x: K.x + X.dx * r, z: K.z + X.dz * r }
  const side = move === 'L' ? 1 : -1 // left: centre on the driver's left
  const cx = S.x + side * tz * r
  const cz = S.z - side * tx * r
  const a0 = Math.atan2(S.z - cz, S.x - cx)
  let a1 = Math.atan2(E.z - cz, E.x - cx)
  let da = a1 - a0
  while (da > PI) da -= 2 * PI
  while (da < -PI) da += 2 * PI
  const n = Math.max(6, Math.ceil((Math.abs(da) * r) / 1.1))
  const arc = []
  for (let i = 1; i < n; i++) { const t = a0 + (da * i) / n; arc.push({ x: cx + Math.cos(t) * r, z: cz + Math.sin(t) * r }) }
  const dE = b + r
  return [...inbound(A, far, dS, o, shift), ...arc, ...outbound(X, dE, end, o2)]
}

const pick = (a) => a[Math.floor(Math.random() * a.length)]
const wpick = (pairs) => { let r = Math.random(); for (const [v, w] of pairs) { if ((r -= w) <= 0) return v } return pairs[pairs.length - 1][0] }
const rand = (a, b) => a + Math.random() * (b - a)

/** trip object stored on the agent; legs = polylines for consecutive drive steps */
function trip(app, move, pts, { suffix = '', vmax, stopAt = null } = {}) {
  const A = LEGS[app]
  let legs = [pts]
  if (stopAt) {
    // split at the far-side bus stop point
    const X = LEGS[exitLeg(app, move)]
    const i = pts.findIndex((p) => legD(X, p.x, p.z) >= stopAt.d)
    const stop = outPt(X, stopAt.d, stopAt.o)
    legs = [[...pts.slice(0, i), stop], [stop, ...pts.slice(i)]]
  }
  return { app, move, exit: exitLeg(app, move), suffix, legs, pts, vmax, yaw: Math.atan2(-A.dx, -A.dz), spawn: pts[0] }
}

/** cars / taxis / vans: realistic approach + movement split, lane choice per movement */
export function carTrip({ truck = false } = {}) {
  const app = wpick([['E', 0.31], ['W', 0.31], ['N', 0.19], ['S', 0.19]])
  const ew = app === 'E' || app === 'W'
  const move = truck ? wpick([['S', 0.82], ['R', 0.18]]) : ew ? wpick([['S', 0.68], ['L', 0.17], ['R', 0.15]]) : wpick([['S', 0.62], ['L', 0.2], ['R', 0.18]])
  const vmax = truck ? rand(9.5, 11) : rand(11, 13.9)
  let pts
  if (move === 'S') {
    const l = pick([1, 2])
    pts = tripPath(app, 'S', l, l)
  } else if (move === 'L') {
    pts = tripPath(app, 'L', 0, 0, { shift: ew ? [110, 88, 1] : [95, 75, 1] })
  } else if (ew) {
    // right turners may use the bus lane for the last 50 m
    pts = tripPath(app, 'R', 3, 2, { shift: [72, 52, 2] })
  } else {
    pts = tripPath(app, 'R', 2, 2)
  }
  return trip(app, move, pts, { suffix: move === 'L' ? 'L' : '', vmax })
}

/** bus lines run on 中山路 in the bus lane and stop at the far-side stop */
export function busTrip(app) {
  const pts = tripPath(app, 'S', 3, 3)
  const stop = app === 'W' ? BUS_STOP.E : BUS_STOP.W
  return trip(app, 'S', pts, { vmax: 10, stopAt: { d: Math.abs(stop.x), o: EW.offs[3] } })
}

/** e-bikes: straight through on the bike lane, own signal heads (leading green) */
export function bikeTrip(app = pick(['E', 'W', 'E', 'W', 'N', 'S'])) {
  return trip(app, 'S', tripPath(app, 'S', 'bike', 'bike'), { suffix: 'B', vmax: rand(5, 6.6) })
}

/** no vehicle on the spawn lane within the clearance window */
export function spawnClear(c, e, p, yaw, len) {
  const hx = Math.sin(yaw)
  const hz = Math.cos(yaw)
  for (const v of c.vehicles) {
    if (v === e) continue
    const a = v.agent
    const dx = a.x - p.x
    const dz = a.z - p.z
    const along = dx * hx + dz * hz
    const lat = Math.abs(-dx * hz + dz * hx)
    if (lat < 1.9 && Math.abs(along) < (len + (a.length || 4.6)) / 2 + 4) return false
  }
  return true
}

/** steps: choose a trip (fn), wait off-board, enter when the lane is clear, drive, leave */
export function tripSteps(choose, { wait = [1, 14], label } = {}) {
  return [
    { do: 'hide' },
    { do: 'call', fn: (c, e) => { e.agent.trip = choose(c, e); e.agent.maxSpeed = e.agent.trip.vmax; return true } },
    { do: 'wait', t: wait },
    { do: 'call', label: '驶入', fn: (c, e) => {
      const a = e.agent
      const t = a.trip
      if (!spawnClear(c, e, t.spawn, t.yaw, a.length || 4.6)) return false
      Object.assign(a, { x: t.spawn.x, z: t.spawn.z, y: 0, yaw: t.yaw, hidden: false, onDeck: false, speed: t.vmax * 0.8, held: false })
      if (!c.vehicles.includes(e)) c.vehicles.push(e)
      return true
    } },
    { do: 'drive', lane: 0, stop: false, label }
  ]
}

// ---------------------------------------------------------------- drive wrapper
const baseDrive = STEPS.drive
registerStep('drive', {
  start(c, e, s, st) {
    if (s.lane == null || !e.agent.trip) return baseDrive.start(c, e, s, st)
    const t = e.agent.trip
    st.ds = { ...s, to: null, through: null, then: null, via: t.legs[s.lane] || t.legs[0] }
    const r = baseDrive.start(c, e, st.ds, st)
    // left turners follow the arrow heads, bikes their own heads (copies: stop lines are shared)
    if (st.stops && t.suffix) st.stops = st.stops.map((k) => ({ ...k, stop: { ...k.stop, group: k.stop.group + t.suffix } }))
    return r
  },
  update(c, e, s, st, dt) { return baseDrive.update(c, e, st.ds || s, st, dt) },
  cancel(c, e, s, st) { return baseDrive.cancel?.(c, e, s, st) }
})

/** inbound distance to the stop line for a vehicle on a trip (null once past it / off its approach) */
export function toStop(a) {
  const t = a.trip
  if (!t || a.hidden) return null
  const L = LEGS[t.app]
  const d = legD(L, a.x, a.z)
  const o = legO(L, a.x, a.z)
  if (d < L.stop - 1 || o < 0 || o > L.road.hw) return null
  return d - L.stop
}

/** lane index (0 inner .. n-1 kerb, n = bike) of an inbound vehicle */
export function laneOf(a) {
  const L = LEGS[a.trip.app]
  const o = legO(L, a.x, a.z)
  if (o > L.road.edge) return L.road.lanes
  return Math.max(0, Math.min(L.road.lanes - 1, Math.floor((o - L.road.median) / LANE_W)))
}
