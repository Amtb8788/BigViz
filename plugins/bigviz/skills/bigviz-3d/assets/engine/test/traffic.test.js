// Traffic control: signal phase cycle, manual override, IDM car-following + stop line.
// Pure functions only (no WebGL).

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { SignalController, TrafficSystem, followStep, stopDecision, idmAccel, IDM } from '../src/systems/traffic.js'
import { RoadGraph, PathFollower, smooth, dedupe } from '../src/systems/roads.js'
import { roads } from '../src/scenes/construction/layout.js'

const T = { green: 10, yellow: 3, allRed: 1, walk: 6, pedClear: 4 }

/** run a controller in small steps and record phase changes */
function trace(ctl, seconds, dt = 0.05) {
  const seen = [[ctl.phase, 0]]
  let t = 0
  ctl.onChange = (c) => seen.push([c.phase, Math.round(t * 100) / 100])
  for (let i = 0; i < Math.round(seconds / dt); i++) { t += dt; ctl.update(dt) }
  return seen
}

test('signal cycles NS green -> yellow -> all red -> EW green -> yellow -> all red -> walk -> clear', () => {
  const c = new SignalController({ id: 's', timing: T })
  assert.equal(c.cycle, 10 + 3 + 1 + 10 + 3 + 1 + 6 + 4 + 1)
  const seen = trace(c, c.cycle + 0.1)
  assert.deepEqual(seen.map((s) => s[0]), ['NS_GREEN', 'NS_YELLOW', 'ALL_RED_1', 'EW_GREEN', 'EW_YELLOW', 'ALL_RED_2', 'WALK', 'PED_CLEAR', 'ALL_RED_3', 'NS_GREEN'])
  assert.deepEqual(seen.map((s) => Math.round(s[1])), [0, 10, 13, 14, 24, 27, 28, 34, 38, 39])
  // never green on both groups, ped walk only while all vehicles are red
  const probe = new SignalController({ id: 'p', timing: T })
  for (let i = 0; i < 800; i++) {
    probe.update(0.05)
    const a = probe.aspects()
    assert.ok(!(a.ns !== 'red' && a.ew !== 'red'))
    if (a.ped === 'walk') assert.ok(a.ns === 'red' && a.ew === 'red')
  }
})

test('signal respects pause and time scale', () => {
  const a = new SignalController({ id: 'a', timing: T })
  a.update(0)
  a.update(-1)
  assert.equal(a.phase, 'NS_GREEN')
  assert.equal(a.t, 0)
  const b = new SignalController({ id: 'b', timing: T })
  b.update(25.5) // one big (16x) step
  const c = new SignalController({ id: 'c', timing: T })
  for (let i = 0; i < 255; i++) c.update(0.1)
  assert.equal(b.phase, c.phase)
  assert.ok(Math.abs(b.remaining - c.remaining) < 1e-6)
  assert.equal(b.phase, 'EW_YELLOW')
})

test('ped phase can be disabled; offset starts mid-cycle', () => {
  const c = new SignalController({ id: 's', timing: T, ped: false })
  assert.equal(c.cycle, 29)
  const seen = trace(c, 29.01).map((s) => s[0])
  assert.ok(!seen.includes('WALK'))
  const o = new SignalController({ id: 'o', timing: T, offset: 14 })
  assert.equal(o.phase, 'EW_GREEN')
})

test('manual override goes through yellow + all red, holds, then releases', () => {
  const c = new SignalController({ id: 's', timing: T })
  c.update(2)
  c.setPhase('EW_GREEN')
  assert.equal(c.phase, 'NS_YELLOW')
  assert.equal(c.mode, 'manual')
  c.update(3.01)
  assert.equal(c.phase, 'ALL_RED_1')
  c.update(1)
  assert.equal(c.phase, 'EW_GREEN')
  c.update(500) // held
  assert.equal(c.phase, 'EW_GREEN')
  assert.equal(c.state().hold, true)
  c.release()
  c.update(0.01)
  assert.equal(c.phase, 'EW_YELLOW')
  // from walk to NS green: ped clearance + all red first, no EW green in between
  const w = new SignalController({ id: 'w', timing: T })
  w.setPhase('WALK', { immediate: true })
  assert.equal(w.phase, 'WALK')
  const seen = []
  w.onChange = (x) => seen.push(x.phase)
  w.setPhase('NS_GREEN')
  w.update(20)
  assert.deepEqual(seen, ['PED_CLEAR', 'ALL_RED_3', 'NS_GREEN'])
  assert.throws(() => w.setPhase('BOGUS'))
})

test('flash / off modes and state snapshot', () => {
  const c = new SignalController({ id: 's', node: 'rE', x: 4, z: 5, timing: T })
  c.setMode('flash')
  c.update(100)
  assert.deepEqual(c.aspects(), { ns: 'flash', ew: 'flash', ped: 'off' })
  const s = c.state()
  assert.equal(s.mode, 'flash')
  assert.deepEqual(s.position, { x: 4, y: 0, z: 5 })
  c.setMode('auto')
  assert.equal(c.mode, 'auto')
  c.setTiming({ green: 20 })
  assert.equal(c.durOf(0), 20)
  assert.throws(() => c.setTiming({ green: -1 }))
})

/**
 * 1-D platoon on a straight road toward a stop line at x = line. Each car: { x (centre), v, len }.
 * aspect(t) gives the signal colour. Returns per-step snapshots.
 */
function platoon(cars, line, aspect, seconds, dt = 1 / 30, v0 = 9) {
  const memo = cars.map(() => ({}))
  let minGap = Infinity
  let t = 0
  for (let i = 0; i < Math.round(seconds / dt); i++) {
    t += dt
    const asp = aspect(t)
    const next = cars.map((c, k) => {
      const front = c.x + c.len / 2
      const ahead = cars[k - 1]
      const leader = ahead ? { gap: ahead.x - ahead.len / 2 - front, v: ahead.v } : null
      const d = stopDecision(asp, line - front, c.v, memo[k])
      return followStep(c.v, v0, dt, leader, d === 'stop' ? { dist: line - front } : null)
    })
    cars.forEach((c, k) => { c.v = next[k]; c.x += c.v * dt })
    for (let k = 1; k < cars.length; k++) minGap = Math.min(minGap, cars[k - 1].x - cars[k - 1].len / 2 - (cars[k].x + cars[k].len / 2))
  }
  return { minGap }
}

test('IDM: car stops before a red stop line and goes on green', () => {
  const car = { x: 0, v: 9, len: 4.6 }
  platoon([car], 60, () => 'red', 30)
  const front = car.x + car.len / 2
  assert.ok(front < 60, `front ${front} crossed the line`)
  assert.ok(front > 58, `stopped too early (${front})`)
  assert.ok(car.v < 0.05)
  platoon([car], 60, () => 'green', 10)
  assert.ok(car.x > 80 && car.v > 5)
})

test('IDM: queue keeps distance, nobody crosses on red, all leave on green', () => {
  const cars = [0, -12, -24, -36].map((x) => ({ x, v: 8.5, len: 4.6 }))
  const { minGap } = platoon(cars, 50, (t) => (t < 40 ? 'red' : 'green'), 40)
  assert.ok(minGap > 0.8, `min gap ${minGap}`)
  for (const c of cars) assert.ok(c.x + c.len / 2 < 50 && c.v < 0.1)
  // standing gaps ~ s0
  for (let k = 1; k < cars.length; k++) {
    const g = cars[k - 1].x - cars[k - 1].len / 2 - (cars[k].x + cars[k].len / 2)
    assert.ok(g > IDM.s0 * 0.7 && g < IDM.s0 * 1.6, `standing gap ${g}`)
  }
  const r = platoon(cars, 50, () => 'green', 25)
  assert.ok(r.minGap > 0.8)
  for (const c of cars) assert.ok(c.x > 60)
})

test('yellow dilemma: close fast car goes, far car stops; decision is sticky', () => {
  assert.equal(stopDecision('yellow', 6, 9, {}), 'go')
  assert.equal(stopDecision('yellow', 40, 9, {}), 'stop')
  const m = {}
  assert.equal(stopDecision('yellow', 6, 9, m), 'go')
  assert.equal(stopDecision('red', 3, 9, m), 'go') // committed, clears the box
  assert.equal(stopDecision('green', 50, 9, m), 'go')
  assert.equal(m.yellow, null)
  assert.equal(stopDecision('red', 30, 9, {}), 'stop')
  assert.equal(stopDecision('red', -1, 5, {}), 'go') // already past the line
  assert.equal(stopDecision('flash', 10, 5, {}), 'caution')
  // free road accelerates, tight gap brakes
  assert.ok(idmAccel(5, 9) > 0)
  assert.ok(idmAccel(8, 9, 3, 8) < -IDM.b)
})

test('road network: 2-lane stubs, left turns use the inner lane, stop lines on the route', () => {
  const R = new RoadGraph(roads)
  const sys = new TrafficSystem(R, { signals: roads.signals, timing: roads.signalTiming })
  assert.equal(sys.controllers.length, 3)
  const e = R.adjOf('rE', 'offE')
  assert.equal(e.lanes, 2)
  assert.deepEqual(e.offs.map((o) => Math.round(o * 100) / 100), [1.48, 4.22])
  // offE -> rE -> rSE is a left turn (inner lane, |z| small), offE -> rE -> rNE a right turn (kerb lane)
  const left = R.lanePoints(['offE', 'rE', 'rSE'])
  const right = R.lanePoints(['offE', 'rE', 'rNE'])
  assert.ok(Math.abs(left[0].z) < Math.abs(right[0].z))
  assert.ok(left[0].z < 0 && right[0].z < 0) // right-hand traffic: westbound on the north half
  // a car crossing the block meets each junction's stop line once, in order
  const ids = R.routeVia(['offE', 'rNE', 'offW'], { public: true })
  assert.deepEqual(ids, ['offE', 'rE', 'rNE', 'rN', 'rNW', 'rW', 'offW'])
  const path = new PathFollower(smooth(dedupe(R.lanePoints(ids), 0.3), 2))
  const stops = sys.stopsOn(path)
  assert.deepEqual(stops.map((s) => s.j.node), ['rE', 'rN', 'rW'])
  assert.equal(stops[0].stop.group, 'ew')
  assert.equal(stops[1].stop.group, 'ew')
  assert.equal(stops[2].stop.group, 'ns')
  // pedestrians: blocked on the crossing unless WALK
  const zone = sys.junctions[0].zones.find((z) => z.leg === 'offE')
  assert.equal(sys.canWalk(zone.x, zone.z), false)
  sys.signal('signal-east').setPhase('WALK', { immediate: true })
  assert.equal(sys.canWalk(zone.x, zone.z), true)
  assert.equal(sys.api().snapshot()[0].phase, 'WALK')
})
