// Mock telemetry: seeded, deterministic random walks per device prop, advanced only by
// tick(dt) (no timers, no Date.now) so the same seed + same ticks = same messages.
// Occasional "excursions" ramp a value past warn / alarm thresholds and back.
// Publishes `${prefix}/<deviceId>/telemetry` with { prop: value, ..., ts }.

import { BaseAdapter } from './base.js'
import { createRng, hashSeed } from '../../core/rng.js'

const r2 = (v) => Math.round(v * 100) / 100

export class MockAdapter extends BaseAdapter {
  /**
   * @param {{ devices: object[], seed?: number, interval?: number, prefix?: string, alarmRate?: number,
   *           live?: (device, prop, t) => any }} opts  devices: normalised (registry.all())
   */
  constructor(opts = {}) {
    super(opts)
    this.kind = 'mock'
    this.seed = opts.seed ?? 1
    this.interval = opts.interval ?? 1
    this.prefix = opts.prefix ?? 'site'
    this.alarmRate = opts.alarmRate ?? 0.35
    this.live = opts.live || null
    this.t = 0
    this.acc = 0
    this.samples = 0
    this.gens = []
    for (const d of opts.devices || []) this.addDevice(d)
  }

  addDevice(d) {
    const props = Object.entries(d.props).filter(([, p]) => p.mock || this.live).map(([k, p]) => ({ key: k, spec: p, m: p.mock || {}, rng: createRng(hashSeed(`${this.seed}:${d.id}:${k}`)), v: undefined, ex: null }))
    this.gens.push({ d, props, topic: `${this.prefix}/${d.id}/telemetry` })
  }

  async connect() {
    this._setStatus('open')
  }

  /** advance simulated time; emits one sample per `interval` seconds (max 5 per call) */
  tick(dt) {
    if (this.status !== 'open' || !(dt > 0)) return
    this.t += dt
    this.acc += dt
    let n = 0
    while (this.acc >= this.interval && n < 5) {
      this.acc -= this.interval
      this.sample()
      n++
    }
    if (this.acc > this.interval) this.acc = 0
  }

  /** emit one sample for every device */
  sample() {
    this.samples++
    for (const g of this.gens) {
      const out = {}
      for (const p of g.props) {
        const lv = this.live?.(g.d, p.key, this.t)
        const gv = p.spec.mock ? this._gen(p) : undefined
        const v = lv !== undefined ? lv : gv
        if (v !== undefined) out[p.key] = v
      }
      out.ts = Math.round(this.t * 1000)
      this._deliver(g.topic, out)
    }
  }
  _gen(p) {
    const { m, spec, rng } = p
    const kind = m.kind || 'walk'
    if (kind === 'bool') {
      if (p.v === undefined) p.v = !!m.base
      const flip = p.v === !!m.base ? (m.flip ?? 0.01) * this.alarmRate * 3 : m.back ?? 0.2
      if (rng.chance(flip)) p.v = !p.v
      return p.v
    }
    if (kind === 'cycle') {
      const seq = m.seq
      const durs = m.dur || seq.map(() => 5)
      const total = durs.reduce((a, b) => a + b, 0)
      if (p.v === undefined) p.v = rng.range(0, total)
      p.v = (p.v + this.interval) % total
      let k = p.v
      for (let i = 0; i < seq.length; i++) { if (k < durs[i]) return seq[i]; k -= durs[i] }
      return seq[0]
    }
    if (kind === 'counter') {
      if (p.v === undefined) p.v = m.base ?? 0
      p.v += (m.rate ?? 1) * this.interval * (1 + rng.jitter(0.3))
      if (m.wrap && (p.v < m.wrap[0] || p.v > m.wrap[1])) p.v = m.rate < 0 ? m.wrap[1] : m.wrap[0]
      return r2(p.v)
    }
    // mean-reverting random walk + excursion ramps
    const base = m.base ?? ((spec.min ?? 0) + (spec.max ?? 1)) / 2
    if (p.v === undefined) p.v = base + rng.jitter(m.noise ?? 1)
    const noise = m.noise ?? ((spec.max ?? 1) - (spec.min ?? 0)) * 0.02
    let target = base
    if (!p.ex && (spec.warn != null || spec.warnLow != null) && rng.chance((m.spike ?? 0) * this.alarmRate)) this._excursion(p, rng.chance(0.45))
    if (p.ex) {
      const e = p.ex
      e.i++
      const top = e.up + e.hold
      const k = e.i <= e.up ? e.i / e.up : e.i <= top ? 1 : Math.max(0, 1 - (e.i - top) / e.down)
      target = base + (e.peak - base) * k
      if (e.i >= top + e.down) p.ex = null
    }
    p.v += (target - p.v) * (p.ex?.fast ? 0.8 : m.revert ?? 0.35) + rng.jitter(noise)
    if (spec.min != null) p.v = Math.max(spec.min, p.v)
    if (spec.max != null) p.v = Math.min(spec.max, p.v)
    return r2(p.v)
  }

  /** start a ramp toward warn (or past alarm when `critical`) */
  _excursion(p, critical, hold) {
    const { spec, rng } = p
    const low = spec.warn == null || (spec.warnLow != null && rng.chance(0.5))
    const warn = low ? spec.warnLow : spec.warn
    const alarm = low ? spec.alarmLow ?? warn : spec.alarm ?? warn
    const peak = critical ? alarm + (alarm - warn) * 0.4 + (low ? -1 : 1) * Math.abs(alarm) * 0.02 : warn + (alarm - warn) * 0.45
    p.ex = { peak, i: 0, up: hold?.up ?? rng.int(3, 6), hold: hold?.hold ?? rng.int(4, 8), down: hold?.down ?? rng.int(6, 14) }
  }

  /** force an excursion (demos / tests): level 'warn' | 'critical' */
  trigger(deviceId, prop, level = 'critical') {
    const g = this.gens.find((x) => x.d.id === deviceId)
    const p = g?.props.find((x) => x.key === prop)
    if (!p || (p.spec.warn == null && p.spec.warnLow == null)) return false
    if (p.v === undefined) this._gen(p)
    this._excursion(p, level === 'critical', { up: 1, hold: 6, down: 10 })
    p.ex.fast = true
    return true
  }

  close() {
    this._setStatus('closed')
  }
}