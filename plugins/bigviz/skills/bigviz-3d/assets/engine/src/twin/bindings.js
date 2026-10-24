// Bindings: topic/metric -> device prop -> level -> visual state. TwinStore keeps live
// values, per-prop history rings and the alarm list (active + history ring).
// Pure logic (no three.js) so it runs under `node --test`.
//
// binding rule: { topic: 'site/{device}/telemetry', device?, prop?, map?(payload, params) }
//   - default rule maps `{ prop: value, ... }` payloads of `site/<deviceId>/telemetry`
//   - `prop` given: payload is a scalar (or `{ value }`) for that one prop
//   - `map` returns { deviceId?: { prop: value } } or { prop: value } for full control

import { Ring } from './ring.js'
import { compileTopic, matchPattern } from './topics.js'

export const LEVELS = ['ok', 'info', 'warn', 'critical']
export const RANK = { ok: 0, info: 1, warn: 2, critical: 3 }
export const LEVEL_COLORS = { ok: '#5bd18a', info: '#5fb8ff', warn: '#f2b51c', critical: '#e5484d', offline: '#7c8088' }
export const LEVEL_CN = { ok: '正常', info: '提示', warn: '预警', critical: '报警', offline: '离线' }
export const DEFAULT_TOPIC = 'site/{device}/telemetry'

/**
 * Level of one value against its prop spec. `prev` enables hysteresis: a level is held
 * until the value falls back past (threshold - hyst), so noise does not flap alarms.
 */
export function evaluate(spec, value, prev = 'ok') {
  if (value == null || Number.isNaN(value)) return prev
  if (spec.states) return spec.states[String(value)] || 'ok'
  if (typeof value !== 'number') return 'ok'
  const span = (spec.max ?? 100) - (spec.min ?? 0)
  const hy = spec.hyst ?? span * 0.02
  const held = (th, dir, lvl) => RANK[prev] >= RANK[lvl] ? (dir > 0 ? value >= th - hy : value <= th + hy) : (dir > 0 ? value >= th : value <= th)
  if (spec.alarm != null && held(spec.alarm, 1, 'critical')) return 'critical'
  if (spec.alarmLow != null && held(spec.alarmLow, -1, 'critical')) return 'critical'
  if (spec.warn != null && held(spec.warn, 1, 'warn')) return 'warn'
  if (spec.warnLow != null && held(spec.warnLow, -1, 'warn')) return 'warn'
  return 'ok'
}

export function worst(levels) {
  let w = 'ok'
  for (const l of levels) if (RANK[l] > RANK[w]) w = l
  return w
}

/** 0..1 position of value within [min, max] */
export function fraction(spec, v) {
  if (typeof v !== 'number') return v === true ? 1 : 0
  const a = spec.min ?? 0
  const b = spec.max ?? Math.max(1, a + 1)
  return Math.max(0, Math.min(1, (v - a) / (b - a || 1)))
}

export function fmtValue(spec, v) {
  if (v == null) return '—'
  if (typeof v === 'boolean') return v ? '是' : '否'
  if (typeof v !== 'number') return String(v)
  const a = Math.abs(v)
  const s = a >= 1000 ? v.toFixed(0) : a >= 100 ? v.toFixed(0) : a >= 10 ? v.toFixed(1) : v.toFixed(2)
  return spec?.unit ? `${s} ${spec.unit}` : s
}

/**
 * Visual state of a device: colour (worst level), pulse (critical), beacon 0..1 height,
 * label text. `visual` = { prop, label?: '{name} {value}', beacon?: 'level' | 'value' }
 */
export function visualState(device, values, levels, online = true) {
  const level = online ? worst(Object.values(levels)) : 'warn'
  const key = device.visual.prop
  const spec = device.props[key] || {}
  const v = values[key]
  const beaconK = device.visual.beacon === 'value' ? fraction(spec, v) : RANK[level] >= 2 ? 0.4 + 0.3 * (RANK[level] - 2) + 0.3 * fraction(spec, v) : 0
  const tpl = device.visual.label || '{value}'
  const label = tpl.replace('{name}', device.name).replace('{prop}', spec.name || key).replace('{value}', fmtValue(spec, v))
  return { level, color: online ? LEVEL_COLORS[level] : LEVEL_COLORS.offline, pulse: level === 'critical', beacon: beaconK, label }
}
export class TwinStore {
  /**
   * @param {import('./devices.js').DeviceRegistry} registry
   * @param {{ bindings?: object[], history?: number, alarmHistory?: number, staleAfter?: number, now?: () => number }} opts
   */
  constructor(registry, opts = {}) {
    this.reg = registry
    this.histN = opts.history ?? 120
    this.alarmLog = new Ring(opts.alarmHistory ?? 200)
    this.staleAfter = opts.staleAfter ?? 0
    this.now = opts.now || (() => Date.now())
    this.state = new Map()
    this.active = new Map()
    this.listeners = new Map()
    this.seq = 0
    this.rules = [...(opts.bindings || []), { topic: opts.topic || DEFAULT_TOPIC }].map((r) => ({ ...r, c: compileTopic(r.topic) }))
    for (const d of registry.all()) this._st(d.id)
  }

  _st(id) {
    let s = this.state.get(id)
    if (!s) {
      s = { values: {}, levels: {}, hist: {}, t: null, online: true }
      this.state.set(id, s)
    }
    return s
  }

  /** topics to subscribe on the adapter (filters with `+`) */
  filters() {
    return [...new Set(this.rules.map((r) => r.c.filter))]
  }

  /** route one message through the first matching rule; returns number of props applied */
  /** `t` = receive time (ms); payload.ts is kept as data, not used for staleness */
  ingest(topic, payload, t = this.now()) {
    for (const r of this.rules) {
      const params = matchPattern(r.c, topic)
      if (!params) continue
      const id = r.device || params.device
      let out
      if (r.map) out = r.map(payload, params, topic)
      else if (r.prop) out = { [id]: { [r.prop]: payload && typeof payload === 'object' && 'value' in payload ? payload.value : payload } }
      else out = { [id]: payload && typeof payload === 'object' ? (payload.values || payload) : {} }
      if (!out) continue
      // `map` may return a flat { prop: value } for the matched device
      if (id && !Object.keys(out).some((k) => this.reg.get(k))) out = { [id]: out }
      let n = 0
      for (const [dev, vals] of Object.entries(out)) n += this.set(dev, vals, t)
      if (n) return n
    }
    return 0
  }

  /** apply { prop: value } to a device; evaluates levels and emits alarm events */
  set(id, vals, t = this.now()) {
    const d = this.reg.get(id)
    if (!d || !vals || typeof vals !== 'object') return 0
    const s = this._st(id)
    let n = 0
    for (const [k, v] of Object.entries(vals)) {
      const spec = d.props[k]
      if (!spec || k === 'ts') continue
      s.values[k] = v
      if (typeof v === 'number' || typeof v === 'boolean') (s.hist[k] ||= new Ring(this.histN)).push(typeof v === 'boolean' ? +v : v)
      const prev = s.levels[k] || 'ok'
      const lvl = evaluate(spec, v, prev)
      s.levels[k] = lvl
      if (lvl !== prev) this._transition(d, k, prev, lvl, v, t)
      n++
    }
    s.t = t
    if (!s.online) { s.online = true; this._emit('online', { device: d, online: true }) }
    if (n) this._emit('update', { device: d, values: s.values, t })
    return n
  }
  _transition(d, prop, from, to, value, t) {
    const key = `${d.id}:${prop}`
    const spec = d.props[prop]
    const cur = this.active.get(key)
    if (RANK[to] > RANK[from] && to !== 'ok') {
      // raise (or escalate): one active alarm per device prop
      const a = { id: `al-${++this.seq}`, key, device: d.id, deviceName: d.name, prop, propName: spec.name || prop, level: to, from, value, unit: spec.unit || '', t, acked: false, cleared: null }
      if (cur) cur.cleared = t
      this.active.set(key, a)
      this.alarmLog.push(a)
      this._emit('alarm', a)
    } else if (cur) {
      if (to === 'ok') {
        cur.cleared = t
        this.active.delete(key)
        this._emit('clear', cur)
      } else {
        // de-escalate (critical -> warn): keep the alarm, lower its level
        cur.level = to
        cur.value = value
        this._emit('alarm.level', cur)
      }
    }
  }

  /** mark devices without data for `staleAfter` ms as offline */
  checkStale(t = this.now()) {
    if (!this.staleAfter) return
    for (const [id, s] of this.state) {
      if (s.online && s.t != null && t - s.t > this.staleAfter) {
        s.online = false
        this._emit('online', { device: this.reg.get(id), online: false })
      }
    }
  }

  get(id) {
    return this.state.get(id)
  }

  value(id, prop) {
    return this.state.get(id)?.values[prop]
  }

  level(id) {
    const s = this.state.get(id)
    return s ? worst(Object.values(s.levels)) : 'ok'
  }

  history(id, prop) {
    return this.state.get(id)?.hist[prop]?.toArray() || []
  }

  visual(id) {
    const d = this.reg.get(id)
    const s = this._st(id)
    return visualState(d, s.values, s.levels, s.online)
  }

  /** active alarms, worst first then newest */
  alarms() {
    return [...this.active.values()].sort((a, b) => RANK[b.level] - RANK[a.level] || b.t - a.t)
  }

  /** alarm history (newest first) */
  log() {
    return this.alarmLog.toArray().reverse()
  }

  ack(alarmId) {
    for (const a of this.active.values()) if (a.id === alarmId) { a.acked = true; this._emit('ack', a); return true }
    return false
  }

  on(type, fn) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set())
    this.listeners.get(type).add(fn)
    return () => this.listeners.get(type)?.delete(fn)
  }

  _emit(type, p) {
    this.listeners.get(type)?.forEach((f) => f(p))
  }
}