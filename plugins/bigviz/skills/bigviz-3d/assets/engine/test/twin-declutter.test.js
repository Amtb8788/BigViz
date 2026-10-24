import { test } from 'node:test'
import assert from 'node:assert/strict'
import { viewMode, markerTier, segBoxHit, fanOut, cyclePick, roomAt, OCCLUDED_OPACITY } from '../src/twin/declutter.js'
import { planFloor, framePlate } from '../src/twin/interior.js'

test('viewMode: street / walk are eye level, overview is aerial', () => {
  assert.equal(viewMode({ y: 2, fov: 56 }), 'eye')
  assert.equal(viewMode({ y: 7, fov: 58 }), 'eye')
  assert.equal(viewMode({ y: 7, fov: 32 }), 'aerial')
  assert.equal(viewMode({ y: 80, fov: 32 }), 'aerial')
  assert.equal(viewMode({ y: 30, mode: 'walk' }), 'eye')
})

test('markerTier: occlusion fades, distance shrinks then culls', () => {
  assert.deepEqual(markerTier({ dist: 50 }), { show: true, scale: 1, opacity: 1 })
  assert.equal(markerTier({ dist: 50, occluded: true }).opacity, OCCLUDED_OPACITY)
  assert.ok(markerTier({ dist: 200 }).scale < 1)
  assert.equal(markerTier({ dist: 300 }).show, false)
  // eye level: far or occluded ones are dropped
  assert.equal(markerTier({ dist: 60, mode: 'eye' }).show, false)
  assert.equal(markerTier({ dist: 10, mode: 'eye', occluded: true }).show, false)
  assert.equal(markerTier({ dist: 10, mode: 'eye' }).show, true)
})

test('markerTier: alarms, selection and showAll always visible', () => {
  const a = markerTier({ dist: 400, mode: 'eye', occluded: true, alarm: true })
  assert.equal(a.show, true)
  assert.ok(a.opacity >= 0.7 && a.scale >= 0.85)
  assert.equal(markerTier({ dist: 400, mode: 'eye', occluded: true, selected: true }).show, true)
  assert.deepEqual(markerTier({ dist: 400, mode: 'eye', occluded: true, all: true }), { show: true, scale: 1, opacity: 1 })
})

test('segBoxHit: box between camera and marker hides it, marker in front does not', () => {
  const box = { min: [-5, 0, -5], max: [5, 10, 5] }
  assert.equal(segBoxHit([0, 5, -20], [0, 5, 20], box), true)
  assert.equal(segBoxHit([0, 5, -20], [0, 5, -6], box), false)
  assert.equal(segBoxHit([0, 5, -20], [20, 5, -20], box), false)
  // marker on the near face (within pad) is not occluded by its own wall
  assert.equal(segBoxHit([0, 5, -20], [0, 5, -4.8], box), false)
  // marker inside the box, camera outside: occluded
  assert.equal(segBoxHit([0, 5, -20], [0, 5, 0], box), true)
  // camera inside: never
  assert.equal(segBoxHit([0, 5, 0], [0, 5, 20], box), false)
  // above the roof
  assert.equal(segBoxHit([0, 40, -30], [0, 11, 0], box), false)
})

test('fanOut: overlapping markers spread on a ring, singletons stay put', () => {
  const pts = [{ id: 'a', x: 100, y: 100 }, { id: 'b', x: 104, y: 102 }, { id: 'c', x: 98, y: 97 }, { id: 'z', x: 400, y: 100 }]
  const f = fanOut(pts, { radius: 26, gap: 30 })
  assert.deepEqual([f.get('z').dx, f.get('z').dy], [0, 0])
  assert.equal(f.get('a').size, 3)
  const pos = ['a', 'b', 'c'].map((id) => { const p = pts.find((q) => q.id === id); const o = f.get(id); return [p.x + o.dx, p.y + o.dy] })
  for (let i = 0; i < 3; i++) for (let j = i + 1; j < 3; j++) assert.ok(Math.hypot(pos[i][0] - pos[j][0], pos[i][1] - pos[j][1]) >= 29.9)
})

test('fanOut: priority seeds clusters and is stable', () => {
  const pts = [{ id: 'a', x: 0, y: 0 }, { id: 'b', x: 20, y: 0, prio: 2 }, { id: 'c', x: 40, y: 0 }]
  const f = fanOut(pts, { radius: 26 })
  // b seeds: a and c both join it
  assert.equal(f.get('b').size, 3)
  assert.deepEqual(fanOut(pts, { radius: 26 }), f)
})

test('cyclePick: nearest first, re-click on selection cycles', () => {
  assert.equal(cyclePick([], 'a'), null)
  assert.equal(cyclePick(['a', 'b', 'c'], null), 'a')
  assert.equal(cyclePick(['a', 'b', 'c'], 'x'), 'a')
  assert.equal(cyclePick(['a', 'b', 'c'], 'a'), 'b')
  assert.equal(cyclePick(['a', 'b', 'c'], 'c'), 'a')
  assert.equal(cyclePick(['a'], 'a'), 'a')
})

test('roomAt: every room centre resolves to itself (incl. south rooms behind the core)', () => {
  const plan = planFloor({ W: 24, D: 14, core: { x: -24 * 0.18, z: -14 * 0.12, w: 4.2, d: 5 }, floor: 2 })
  for (const r of [...plan.rooms, plan.corridor]) assert.equal(roomAt(plan, r.x, r.z).key, r.key)
  assert.equal(roomAt(plan, 30, 0), null)
})

test('framePlate: every plate corner inside the usable frame', () => {
  const W = 24
  const D = 14
  const opt = { cx: 10, cy: 6.6, cz: -3, W, D, az: Math.PI / 4, el: 0.82, fov: 40, aspect: 16 / 9, fracX: 0.6, fracY: 0.8 }
  const { pos, look } = framePlate(opt)
  assert.ok(pos[1] > look[1] + 10, 'elevated')
  const f = look.map((v, i) => v - pos[i])
  const fl = Math.hypot(...f)
  const fn = f.map((v) => v / fl)
  const r = [-fn[2], 0, fn[0]].map((v) => v / Math.hypot(fn[2], fn[0]))
  const u = [r[1] * fn[2] - r[2] * fn[1], r[2] * fn[0] - r[0] * fn[2], r[0] * fn[1] - r[1] * fn[0]]
  const t = Math.tan((40 * Math.PI) / 360)
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) for (const y of [0, 2.4]) {
    const p = [opt.cx + (sx * W) / 2 - pos[0], opt.cy + y - pos[1], opt.cz + (sz * D) / 2 - pos[2]]
    const dot = (a) => a[0] * p[0] + a[1] * p[1] + a[2] * p[2]
    const z = dot(fn)
    assert.ok(Math.abs(dot(r)) / z <= t * (16 / 9) * 0.6 + 1e-6)
    assert.ok(Math.abs(dot(u)) / z <= t * 0.8 + 1e-6)
  }
})
