import { test } from 'node:test'
import assert from 'node:assert/strict'
import { evaluate, worst, fraction, visualState, TwinStore } from '../src/twin/bindings.js'
import { DeviceRegistry, makeDevice } from '../src/twin/devices.js'
import { matchTopic, compileTopic, matchPattern } from '../src/twin/topics.js'
import { Ring } from '../src/twin/ring.js'

const load = { min: 0, max: 8, warn: 5.6, alarm: 6.8 }

test('evaluate: high thresholds', () => {
  assert.equal(evaluate(load, 2), 'ok')
  assert.equal(evaluate(load, 5.6), 'warn')
  assert.equal(evaluate(load, 7), 'critical')
})

test('evaluate: low thresholds and states', () => {
  const hr = { min: 40, max: 180, warn: 125, alarm: 150, warnLow: 50, alarmLow: 42 }
  assert.equal(evaluate(hr, 90), 'ok')
  assert.equal(evaluate(hr, 48), 'warn')
  assert.equal(evaluate(hr, 41), 'critical')
  const cam = { states: { true: 'ok', false: 'critical' } }
  assert.equal(evaluate(cam, true), 'ok')
  assert.equal(evaluate(cam, false), 'critical')
})

test('evaluate: hysteresis holds a level near the threshold', () => {
  const s = { ...load, hyst: 0.3 }
  assert.equal(evaluate(s, 6.7, 'critical'), 'critical')
  assert.equal(evaluate(s, 6.4, 'critical'), 'warn')
  assert.equal(evaluate(s, 6.7, 'warn'), 'warn')
  assert.equal(evaluate(s, 5.4, 'warn'), 'warn')
  assert.equal(evaluate(s, 5.2, 'warn'), 'ok')
})

test('worst / fraction', () => {
  assert.equal(worst(['ok', 'warn', 'info']), 'warn')
  assert.equal(worst([]), 'ok')
  assert.equal(fraction(load, 4), 0.5)
  assert.equal(fraction(load, 99), 1)
})

test('topics: wildcards and named params', () => {
  assert.deepEqual(matchTopic('site/+/telemetry', 'site/tc/telemetry'), ['tc'])
  assert.equal(matchTopic('site/+/telemetry', 'site/tc/x'), null)
  assert.deepEqual(matchTopic('site/#', 'site/a/b/c'), [])
  const c = compileTopic('plant/{device}/{prop}')
  assert.equal(c.filter, 'plant/+/+')
  assert.deepEqual(matchPattern(c, 'plant/m1/power'), { device: 'm1', prop: 'power' })
})

test('ring buffer wraps', () => {
  const r = new Ring(3)
  for (let i = 1; i <= 5; i++) r.push(i)
  assert.deepEqual(r.toArray(), [3, 4, 5])
  assert.equal(r.last(), 5)
  assert.equal(r.length, 3)
})

test('makeDevice merges type props and overrides', () => {
  const d = makeDevice({ id: 'c1', type: 'craneMonitor', attachTo: 'tc', props: { load: { alarm: 7 } } })
  assert.equal(d.props.load.alarm, 7)
  assert.equal(d.props.load.warn, 5.6)
  assert.equal(d.visual.prop, 'load')
  assert.throws(() => makeDevice({ id: 'x', type: 'nope' }))
})
function store(bindings) {
  const reg = new DeviceRegistry()
  reg.addAll([
    { id: 'tc-mon', type: 'craneMonitor', attachTo: 'tc' },
    { id: 'meter', type: 'electricMeter', attachTo: 'office' }
  ])
  return new TwinStore(reg, { bindings, history: 5, alarmHistory: 4 })
}

test('store: default topic ingests, raises, escalates and clears alarms', () => {
  const s = store()
  const events = []
  s.on('alarm', (a) => events.push(['alarm', a.level]))
  s.on('clear', (a) => events.push(['clear', a.prop]))
  assert.equal(s.ingest('site/tc-mon/telemetry', { load: 2, wind: 4 }, 1), 2)
  assert.equal(s.value('tc-mon', 'load'), 2)
  s.ingest('site/tc-mon/telemetry', { load: 6 }, 2)
  assert.equal(s.level('tc-mon'), 'warn')
  s.ingest('site/tc-mon/telemetry', { load: 7.5 }, 3)
  assert.equal(s.alarms().length, 1)
  assert.equal(s.alarms()[0].level, 'critical')
  s.ingest('site/tc-mon/telemetry', { load: 1 }, 4)
  assert.equal(s.alarms().length, 0)
  assert.deepEqual(events, [['alarm', 'warn'], ['alarm', 'critical'], ['clear', 'load']])
  assert.equal(s.log().length, 2)
  assert.equal(s.log()[0].level, 'critical')
})

test('store: de-escalation keeps one alarm, ack works, unknown device ignored', () => {
  const s = store()
  s.set('tc-mon', { wind: 15 }, 1)
  s.set('tc-mon', { wind: 12 }, 2)
  const a = s.alarms()
  assert.equal(a.length, 1)
  assert.equal(a[0].level, 'warn')
  assert.ok(s.ack(a[0].id))
  assert.ok(s.alarms()[0].acked)
  assert.equal(s.ingest('site/ghost/telemetry', { load: 9 }), 0)
})

test('store: history ring and alarm log are bounded', () => {
  const s = store()
  for (let i = 0; i < 9; i++) s.set('tc-mon', { load: i % 2 ? 7.5 : 1 }, i)
  assert.equal(s.history('tc-mon', 'load').length, 5)
  assert.equal(s.log().length, 4)
})

test('store: custom rules (scalar prop topic and map fn)', () => {
  const s = store([
    { topic: 'factory/meter/{prop}', device: 'meter', map: (v, p) => ({ [p.prop]: v }) },
    { topic: 'crane/wind', device: 'tc-mon', prop: 'wind' }
  ])
  assert.ok(s.filters().includes('site/+/telemetry'))
  assert.equal(s.ingest('factory/meter/power', 380), 1)
  assert.equal(s.level('meter'), 'critical')
  assert.equal(s.ingest('crane/wind', { value: 11 }), 1)
  assert.equal(s.value('tc-mon', 'wind'), 11)
})

test('visualState: colour, pulse, beacon, label', () => {
  const s = store()
  s.set('tc-mon', { load: 7.5 })
  const v = s.visual('tc-mon')
  assert.equal(v.level, 'critical')
  assert.ok(v.pulse)
  assert.ok(v.beacon > 0.6)
  assert.match(v.label, /7\.50 t/)
  const d = makeDevice({ id: 'x', type: 'craneMonitor', visual: { prop: 'wind', label: '{prop} {value}' } })
  assert.equal(visualState(d, { wind: 3 }, {}).label, '风速 3.00 m/s')
  assert.equal(visualState(d, { wind: 3 }, {}).beacon, 0)
})

test('store: stale devices go offline', () => {
  const reg = new DeviceRegistry()
  reg.add({ id: 'm', type: 'waterMeter' })
  const s = new TwinStore(reg, { staleAfter: 1000 })
  s.set('m', { flow: 5 }, 0)
  s.checkStale(500)
  assert.ok(s.get('m').online)
  s.checkStale(2000)
  assert.equal(s.get('m').online, false)
  assert.equal(s.visual('m').color, '#7c8088')
})