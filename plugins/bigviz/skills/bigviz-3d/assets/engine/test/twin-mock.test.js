import { test } from 'node:test'
import assert from 'node:assert/strict'
import { MockAdapter } from '../src/twin/adapters/mock.js'
import { createAdapter } from '../src/twin/adapters/index.js'
import { parsePayload } from '../src/twin/adapters/base.js'
import { WsAdapter } from '../src/twin/adapters/ws.js'
import { MqttAdapter } from '../src/twin/adapters/mqtt.js'
import { DeviceRegistry, DEVICE_TYPES } from '../src/twin/devices.js'
import { TwinStore } from '../src/twin/bindings.js'
import { SCENE_DEVICES } from '../src/scenes/construction/devices.js'

function registry() {
  const reg = new DeviceRegistry()
  // one device of every type
  for (const type of Object.keys(DEVICE_TYPES)) reg.add({ id: `d-${type}`, type })
  return reg
}

function run(seed, seconds, opts = {}) {
  const reg = registry()
  const a = new MockAdapter({ devices: reg.all(), seed, ...opts })
  const out = []
  a.subscribe('site/+/telemetry', (p, topic) => out.push([topic, p]))
  a.connect()
  for (let i = 0; i < seconds * 10; i++) a.tick(0.1)
  return { a, out, reg }
}

test('mock: same seed -> identical stream', () => {
  const x = run(42, 60)
  const y = run(42, 60)
  assert.ok(x.out.length > 100)
  assert.deepEqual(x.out, y.out)
})

test('mock: different seed -> different stream', () => {
  const x = run(1, 20)
  const y = run(2, 20)
  assert.notDeepEqual(x.out.map((m) => m[1]), y.out.map((m) => m[1]))
})

test('mock: frame-rate independent (same samples for 0.1s or 0.05s ticks)', () => {
  const reg = registry()
  const take = (dt) => {
    const a = new MockAdapter({ devices: reg.all(), seed: 9 })
    const out = []
    a.subscribe('#', (p) => out.push(p))
    a.connect()
    for (let t = 0; t < 30 - 1e-9; t += dt) a.tick(dt)
    return out.slice(0, 200)
  }
  assert.deepEqual(take(0.25), take(0.5))
})

test('mock: values stay in range and occasionally raise alarms', () => {
  const { a, reg } = run(7, 0)
  const s = new TwinStore(reg)
  a.subscribe('site/+/telemetry', (p, topic) => s.ingest(topic, p, p.ts))
  const levels = new Set()
  s.on('alarm', (al) => levels.add(al.level))
  for (let i = 0; i < 1800; i++) a.tick(1)
  for (const d of reg.all()) {
    for (const [k, spec] of Object.entries(d.props)) {
      const v = s.value(d.id, k)
      if (typeof v !== 'number') continue
      if (spec.min != null) assert.ok(v >= spec.min, `${d.id}.${k} ${v} < min`)
      if (spec.max != null) assert.ok(v <= spec.max, `${d.id}.${k} ${v} > max`)
    }
  }
  assert.ok(levels.has('warn'), 'expected a warn')
  assert.ok(levels.has('critical'), 'expected a critical')
})

test('mock: trigger() forces an alarm; live() overrides a value', () => {
  const reg = registry()
  const a = new MockAdapter({ devices: reg.all(), seed: 3, alarmRate: 0, live: (d, k) => (d.type === 'hoistMonitor' && k === 'height' ? 12.5 : undefined) })
  const s = new TwinStore(reg)
  a.subscribe('#', (p, t) => s.ingest(t, p, p.ts))
  a.connect()
  assert.ok(a.trigger('d-craneMonitor', 'wind', 'critical'))
  for (let i = 0; i < 8; i++) a.tick(1)
  assert.equal(s.level('d-craneMonitor'), 'critical')
  assert.equal(s.value('d-hoistMonitor', 'height'), 12.5)
})
test('parsePayload: json, number, bytes, string', () => {
  assert.deepEqual(parsePayload('{"a":1}'), { a: 1 })
  assert.equal(parsePayload('3.5'), 3.5)
  assert.deepEqual(parsePayload(new TextEncoder().encode('{"b":2}')), { b: 2 })
  assert.equal(parsePayload('red'), 'red')
})

test('ws adapter: subscribe message + frame routing (fake WebSocket)', async () => {
  const sent = []
  class FakeWS {
    constructor(url) { this.url = url; FakeWS.last = this; setTimeout(() => this.onopen?.(), 0) }
    send(s) { sent.push(JSON.parse(s)) }
    close() { this.onclose?.() }
  }
  const a = new WsAdapter({ url: 'ws://x', WebSocket: FakeWS })
  const got = []
  a.subscribe('site/+/telemetry', (p, t) => got.push([t, p]))
  await a.connect()
  assert.deepEqual(sent[0], { type: 'subscribe', topics: ['site/+/telemetry'] })
  FakeWS.last.onmessage({ data: JSON.stringify([{ topic: 'site/a/telemetry', payload: { v: 1 } }, { topic: 'other/x', payload: 2 }]) })
  assert.deepEqual(got, [['site/a/telemetry', { v: 1 }]])
  a.close()
  assert.equal(a.status, 'closed')
})

test('mqtt adapter: works with an injected mqtt.js-shaped client', async () => {
  const handlers = {}
  const subs = []
  const client = { on: (ev, fn) => (handlers[ev] = fn), subscribe: (f) => subs.push(f), publish() {}, end() {} }
  const a = new MqttAdapter({ url: 'wss://b/mqtt', connect: () => { setTimeout(() => handlers.connect(), 0); return client } })
  const got = []
  a.subscribe('site/+/telemetry', (p) => got.push(p))
  await a.connect()
  assert.deepEqual(subs, ['site/+/telemetry'])
  handlers.message('site/a/telemetry', new TextEncoder().encode('{"load":3}'))
  assert.deepEqual(got, [{ load: 3 }])
  await assert.rejects(new MqttAdapter({ url: 'x' }).connect())
})

test('createAdapter: factory + pass-through', () => {
  assert.ok(createAdapter({ type: 'mock' }, { devices: [] }) instanceof MockAdapter)
  const custom = { connect() {}, subscribe() {}, close() {} }
  assert.equal(createAdapter(custom), custom)
  assert.throws(() => createAdapter({ type: 'zz' }))
})

test('scene config: construction devices are valid', () => {
  const reg = new DeviceRegistry()
  reg.addAll(SCENE_DEVICES.devices)
  assert.ok(reg.all().length >= 20)
  for (const d of reg.all()) assert.ok(d.attachTo || d.meta.signal, `${d.id} has no host`)
  const s = new TwinStore(reg, { bindings: SCENE_DEVICES.bindings })
  assert.ok(s.filters().length >= 1)
})