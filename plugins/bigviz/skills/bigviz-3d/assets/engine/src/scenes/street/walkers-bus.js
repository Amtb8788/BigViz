// Street pack - bus riders. Far-side stops: eastbound (E) on the south kerb of 中山路 at
// x = +52, westbound (W) mirrored on the north kerb at x = -52. Coordinates below are for E;
// W uses the point mirror (x, z) -> (-x, -z). The shelter (street.js busStop, rotated to face
// the road) is open toward the kerb only: walkers go round its glass ends via the front.

import { EW, BUS_STOP, WALK_EW, HX, FRONT_EW } from './layout.js'
import { bikeLaneClear } from './walkers.js'

const rand = (a, b) => a + Math.random() * (b - a)
const pick = (a) => a[Math.floor(Math.random() * a.length)]
const M = { E: 1, W: -1 }
const P = (k, x, z) => ({ x: M[k] * x, z: M[k] * z })
const X0 = BUS_STOP.E.x

// local E-stop geometry
const DOOR_X = X0 + 3.8
const KERB_Z = EW.hw + 0.25
const BIKE_Z = EW.bike
const DOOR_Z = EW.offs[3] + 1.45 // just outside the bus body, beside the front door
const SEAT = [[X0 + 0.4, 19.68], [X0 - 0.5, 19.68]]
const STAND = [[X0 - 1.6, 19.15], [X0 + 1.3, 19.1], [X0 - 0.4, 18.85]]
const FRONT_L = [X0 + 3.0, 18.05] // in front of the ad box end
const FRONT_R = [X0 - 3.1, 18.05] // past the open (west) end, clear of the sign post
const walkIn = (x) => ({ x, z: WALK_EW + rand(0, 0.6) })

/** waiting -> board the next dwelling bus -> walk back in later as a new passenger */
export function riderPlan(k, i) {
  return (c, e) => {
    const a = e.agent
    const first = !a.tripCount
    a.tripCount = (a.tripCount || 0) + 1
    const spot = i < 2 ? SEAT[i] : STAND[(i + a.tripCount) % STAND.length]
    const p = P(k, spot[0] + rand(-0.15, 0.15), spot[1])
    const road = k === 'E' ? Math.PI : 0
    const q = []
    if (first || a.missed) q.push({ k: 'show', p: a.missed ? { x: a.x, z: a.z } : p })
    else {
      q.push({ k: 'hide', dur: [25, 80] })
      const fromE = Math.random() < 0.5
      const start = walkIn(fromE ? HX - 3 : X0 - rand(14, 30))
      q.push({ k: 'show', p: P(k, start.x, start.z) })
      if (fromE) q.push({ k: 'go', p: P(k, X0 + 5.5, WALK_EW) }, { k: 'go', p: P(k, ...FRONT_L) })
      else q.push({ k: 'go', p: P(k, X0 - 4.2, WALK_EW - 0.3) }, { k: 'go', p: P(k, ...FRONT_R) })
    }
    if (a.missed) a.missed = false
    q.push({ k: 'go', p, label: '候车' })
    q.push({ k: 'until', yaw: road, anim: i < 2 ? 'sit' : pick(['idle', 'phone', 'idle']), label: '候车', test: (c2) => c2.world.getVar(`bus.${k}`) > 0 && Math.random() < 0.025 })
    // board: out the front, across the bike lane when it is clear, to the front door
    const kerb = P(k, DOOR_X - rand(0.3, 1.3), KERB_Z)
    const doorP = { x: kerb.x + rand(-0.15, 0.25) * M[k], z: M[k] * DOOR_Z }
    q.push({ k: 'go', p: P(k, spot[0], 18.3), label: '上车' }, { k: 'go', p: kerb })
    q.push({ k: 'until', yaw: road, test: (c2) => bikeLaneClear(c2, kerb, M[k] * BIKE_Z), timeout: 6 })
    // bus gone meanwhile: back into the shelter, wait for the next one
    q.push({ k: 'do', fn: (c2, e2, qq) => { if (!(c2.world.getVar(`bus.${k}`) > 0)) { qq.splice(1, qq.length - 1, { k: 'go', p }); e2.agent.missed = true } } })
    q.push({ k: 'go', p: doorP, sp: 1.5 }, { k: 'hide', dur: 0 })
    return q
  }
}

/** appears at the door of a dwelling bus, crosses the bike lane, walks off */
export function alightPlan(k) {
  return () => {
    const p = P(k, DOOR_X + rand(-0.3, 0.3), DOOR_Z)
    const kerb = P(k, DOOR_X + rand(0.2, 1.2), KERB_Z)
    const east = Math.random() < 0.55
    const route = east
      ? [P(k, X0 + 5.6, 18.3), P(k, X0 + rand(7, 12), WALK_EW + rand(0, 0.6)), pick([P(k, HX - 3, WALK_EW + 0.4), P(k, X0 + rand(16, 80), FRONT_EW - 0.4)])]
      : [P(k, ...FRONT_L), P(k, ...FRONT_R), P(k, X0 - 4.5, WALK_EW), pick([P(k, 26, WALK_EW + 0.3), P(k, X0 - rand(10, 24), FRONT_EW - 0.4)])]
    return [
      { k: 'hide', dur: 0.5 },
      { k: 'until', test: (c2) => c2.world.getVar(`bus.${k}`) > 0 && Math.random() < 0.03 },
      { k: 'until', test: (c2) => bikeLaneClear(c2, p, M[k] * BIKE_Z), timeout: 8 },
      { k: 'do', fn: (c2, e2, qq) => { if (!(c2.world.getVar(`bus.${k}`) > 0)) qq.splice(1, qq.length - 1) } },
      { k: 'show', p, yaw: k === 'E' ? 0 : Math.PI },
      { k: 'go', p: kerb, label: '下车' },
      ...route.map((r) => ({ k: 'go', p: r })),
      { k: 'hide', dur: [5, 30] }
    ]
  }
}
