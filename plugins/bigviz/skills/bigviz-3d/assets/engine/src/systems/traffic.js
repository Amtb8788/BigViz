// Traffic control: signal controllers, junction geometry, IDM car-following and the
// stop-line decision. Pure module (no three.js) so it runs in node tests.
//
// Phase cycle (seconds of sim time, scaled / paused with the engine clock):
//   NS_GREEN -> NS_YELLOW -> ALL_RED -> EW_GREEN -> EW_YELLOW -> ALL_RED -> WALK -> PED_CLEAR -> ALL_RED
// WALK is an exclusive pedestrian phase (all vehicle approaches red).

export const PHASES = [
  { id: 'NS_GREEN', key: 'green', ns: 'green', ew: 'red', ped: 'dont' },
  { id: 'NS_YELLOW', key: 'yellow', ns: 'yellow', ew: 'red', ped: 'dont' },
  { id: 'ALL_RED_1', key: 'allRed', ns: 'red', ew: 'red', ped: 'dont' },
  { id: 'EW_GREEN', key: 'green', ns: 'red', ew: 'green', ped: 'dont' },
  { id: 'EW_YELLOW', key: 'yellow', ns: 'red', ew: 'yellow', ped: 'dont' },
  { id: 'ALL_RED_2', key: 'allRed', ns: 'red', ew: 'red', ped: 'dont' },
  { id: 'WALK', key: 'walk', ns: 'red', ew: 'red', ped: 'walk' },
  { id: 'PED_CLEAR', key: 'pedClear', ns: 'red', ew: 'red', ped: 'flash' },
  { id: 'ALL_RED_3', key: 'allRed', ns: 'red', ew: 'red', ped: 'dont' }
]

export const DEFAULT_TIMING = { green: 14, yellow: 3, allRed: 1.5, walk: 7, pedClear: 5, nsGreen: null, ewGreen: null }

const SAFE = new Set(['yellow', 'allRed', 'pedClear'])

export class SignalController {
  /**
   * @param {{ id: string, node?: string, x?: number, z?: number, name?: string, timing?: object, offset?: number, ped?: boolean }} cfg
   */
  constructor(cfg) {
    this.id = cfg.id
    this.node = cfg.node ?? cfg.id
    this.name = cfg.name ?? cfg.id
    this.position = { x: cfg.x ?? 0, y: 0, z: cfg.z ?? 0 }
    this.timing = { ...DEFAULT_TIMING, ...(cfg.timing || {}) }
    if (cfg.ped === false) this.timing.walk = this.timing.pedClear = 0
    this.mode = 'auto' // auto | manual | flash | off
    this.i = 0
    this.t = 0
    this.target = null
    this.hold = false
    this.onChange = null
    this.elapsed = 0
    this._skipZero()
    if (cfg.offset) this.update(cfg.offset, true)
  }

  durOf(i) {
    const p = PHASES[i]
    const T = this.timing
    if (p.id === 'NS_GREEN' && T.nsGreen != null) return T.nsGreen
    if (p.id === 'EW_GREEN' && T.ewGreen != null) return T.ewGreen
    return T[p.key] ?? 0
  }

  get phase() { return PHASES[this.i].id }
  get remaining() { return Math.max(0, this.durOf(this.i) - this.t) }
  get cycle() { return PHASES.reduce((s, _, i) => s + this.durOf(i), 0) }

  _skipZero() {
    for (let g = 0; g < PHASES.length && this.durOf(this.i) <= 0; g++) this.i = (this.i + 1) % PHASES.length
  }

  _go(i, silent) {
    const from = this.phase
    this.i = i
    this.t = 0
    this._skipZero()
    if (!silent && this.onChange && from !== this.phase) this.onChange(this, from)
  }
  _match(i, id) {
    return PHASES[i].id === id || (id === 'ALL_RED' && PHASES[i].key === 'allRed')
  }

  _advance(silent) {
    const L = PHASES.length
    let n = (this.i + 1) % L
    for (let g = 0; g < L && this.durOf(n) <= 0; g++) n = (n + 1) % L
    // during a manual transition never start a green / walk that was not requested
    if (this.target != null && !SAFE.has(PHASES[n].key) && !this._match(n, this.target)) n = PHASES.findIndex((p, i) => this._match(i, this.target) && this.durOf(i) > 0)
    this._go(n, silent)
    if (this.target != null && this._match(this.i, this.target)) this._arrive(this.wantHold)
  }

  _arrive(hold) {
    this.target = null
    this.hold = hold
    this.mode = hold ? 'manual' : 'auto'
  }

  /** Advance by dt sim seconds (0 while paused) */
  update(dt, silent = false) {
    if (!(dt > 0)) return this
    this.elapsed += dt
    if (this.mode === 'flash' || this.mode === 'off') return this
    this.t += dt
    for (let g = 0; g < 64; g++) {
      const d = this.durOf(this.i)
      if (this.t < d) break
      if (this.hold) { this.t = d; break }
      const over = this.t - d
      this._advance(silent)
      this.t = over
    }
    return this
  }

  /**
   * Manual control. Safe by default: a running green ends through yellow + all-red first.
   * phase: 'NS_GREEN' | 'EW_GREEN' | 'WALK' | 'ALL_RED' | any PHASES id
   */
  setPhase(id, { hold = true, immediate = false } = {}) {
    const idx = PHASES.findIndex((p, i) => this._match(i, id) && this.durOf(i) > 0)
    if (idx < 0) throw new Error(`Unknown or disabled signal phase "${id}"`)
    if (this.mode === 'flash' || this.mode === 'off') this.mode = 'auto'
    this.hold = false
    if (immediate) { this._go(idx); this._arrive(hold); return this }
    if (this._match(this.i, id)) { this.t = 0; this._arrive(hold); return this }
    this.mode = 'manual'
    this.target = id
    this.wantHold = hold
    if (!SAFE.has(PHASES[this.i].key)) { this._advance(); this.t = 0 }
    return this
  }

  /** Back to the automatic cycle (continues from the current phase) */
  release() {
    this.target = null
    this.hold = false
    this.mode = 'auto'
    return this
  }

  /** 'auto' | 'flash' (yellow flashing, caution) | 'off' (dark) */
  setMode(mode) {
    if (mode === 'auto' || mode === 'manual') return this.release()
    if (mode !== 'flash' && mode !== 'off') throw new Error(`Unknown signal mode "${mode}"`)
    const from = this.phase
    this.mode = mode
    this.target = null
    this.hold = false
    this.onChange?.(this, from)
    return this
  }

  setTiming(patch = {}) {
    for (const [k, v] of Object.entries(patch)) {
      if (!(k in DEFAULT_TIMING)) throw new Error(`Unknown timing key "${k}"`)
      if (v != null && !(Number.isFinite(v) && v >= 0)) throw new Error(`Bad timing ${k}=${v}`)
      this.timing[k] = v
    }
    return this
  }

  /** Lamp states: vehicles red|yellow|green|flash|off, pedestrians walk|flash|dont|off */
  aspects() {
    if (this.mode === 'flash') return { ns: 'flash', ew: 'flash', ped: 'off' }
    if (this.mode === 'off') return { ns: 'off', ew: 'off', ped: 'off' }
    const p = PHASES[this.i]
    return { ns: p.ns, ew: p.ew, ped: p.ped }
  }

  aspect(group) {
    return this.aspects()[group]
  }

  /** Serializable snapshot for the twin / IoT layer */
  /** One-word summary for simple bindings: green / yellow (either group) else red; flash / off */
  get color() {
    const a = this.aspects()
    if (this.mode === 'flash' || this.mode === 'off') return this.mode
    return a.ns === 'green' || a.ew === 'green' ? 'green' : a.ns === 'yellow' || a.ew === 'yellow' ? 'yellow' : 'red'
  }

  state() {
    return {
      id: this.id, node: this.node, name: this.name, position: { ...this.position },
      color: this.color, queue: this.queue ?? 0,
      mode: this.mode, phase: this.phase, remaining: this.remaining, cycle: this.cycle,
      hold: this.hold, target: this.target, aspects: this.aspects(), timing: { ...this.timing }
    }
  }
}

// ---------------------------------------------------------------- car following (IDM)

/** Intelligent Driver Model parameters (metres, seconds) */
export const IDM = { a: 1.6, b: 2.6, T: 1.1, s0: 1.8, delta: 4, bMax: 7.5 }

/**
 * IDM acceleration. gap = bumper-to-bumper distance to the leader (Infinity = free road),
 * dv = own speed - leader speed.
 */
export function idmAccel(v, v0, gap = Infinity, dv = 0, p = IDM) {
  const free = 1 - Math.pow(Math.max(0, v) / Math.max(0.1, v0), p.delta)
  if (!(gap < Infinity)) return p.a * free
  const sStar = p.s0 + Math.max(0, v * p.T + (v * dv) / (2 * Math.sqrt(p.a * p.b)))
  const g = Math.max(0.05, gap)
  return p.a * (free - (sStar / g) ** 2)
}

/** Integrate one step; never reverses, braking clamped to bMax */
export function idmStep(v, acc, dt, p = IDM) {
  const a = Math.max(-p.bMax, Math.min(p.a, acc))
  return Math.max(0, v + a * dt)
}

/**
 * Stop-line decision for one vehicle and one approach.
 * dist: front bumper to stop line (m, <0 = already past). memo: per (vehicle, line) object
 * that keeps the yellow decision sticky. Returns 'stop' | 'go' | 'caution'.
 */
export function stopDecision(aspect, dist, v, memo = {}, p = IDM) {
  if (dist < -0.2) return 'go'
  if (aspect === 'green' || aspect === 'off' || aspect == null) { memo.yellow = null; return aspect === 'off' ? 'caution' : 'go' }
  if (aspect === 'flash') return 'caution'
  const need = (v * v) / (2 * p.b)
  if (aspect === 'yellow') {
    if (memo.yellow == null) memo.yellow = need <= dist + 0.5 ? 'stop' : 'go'
    return memo.yellow
  }
  // red: whoever committed on yellow (or cannot stop even with hard braking) clears the box
  if (memo.yellow === 'go') return 'go'
  if ((v * v) / (2 * p.bMax) > dist + 0.5) return 'go'
  return 'stop'
}

/**
 * One car-following update. leader: { gap, v } | null, stop: { dist } | null (line to hold at).
 * Returns the new speed.
 */
export function followStep(v, v0, dt, leader, stop, p = IDM) {
  let acc = idmAccel(v, v0, Infinity, 0, p)
  if (leader) acc = Math.min(acc, idmAccel(v, v0, leader.gap, v - leader.v, p))
  if (stop) acc = Math.min(acc, idmAccel(v, v0, stop.dist + p.s0 - 0.6, v, p))
  return idmStep(v, acc, dt, p)
}

// ---------------------------------------------------------------- geometry helpers

/** Position + unit tangent at arc length s of a { pts, cum } polyline (stateless) */
export function sampleAt(path, s) {
  const { pts, cum } = path
  const L = cum[cum.length - 1]
  s = Math.max(0, Math.min(L, s))
  let lo = 1
  let hi = cum.length - 1
  while (lo < hi) {
    const m = (lo + hi) >> 1
    if (cum[m] < s) lo = m + 1
    else hi = m
  }
  const a = pts[lo - 1]
  const b = pts[lo]
  const seg = cum[lo] - cum[lo - 1] || 1e-6
  const t = (s - cum[lo - 1]) / seg
  return { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t, dx: (b.x - a.x) / seg, dz: (b.z - a.z) / seg }
}

/**
 * Nearest obstacle ahead along a path. me: { s, length }, others: [{ id, x, z, yaw, speed, length, walker }].
 * Returns { gap, v, id } or null. Crossing / oncoming obstacles count as standing (v = 0).
 */
export function findLeader(path, me, others, opts = {}) {
  const look = opts.look ?? 40
  const step = opts.step ?? 1.2
  const front = me.s + (me.length || 4.6) / 2
  const L = path.cum[path.cum.length - 1]
  const end = Math.min(L + (me.length || 4.6) / 2 + 4, front + look)
  const samples = []
  for (let s = front + 0.3; s <= end; s += step) samples.push({ s, ...sampleAt(path, Math.min(s, L)), over: Math.max(0, s - L) })
  if (!samples.length) return null
  const last = samples[samples.length - 1]
  const mid = sampleAt(path, (front + Math.min(L, end)) / 2)
  const R = look / 2 + 8
  let best = null
  for (const o of others) {
    if (Math.hypot(o.x - mid.x, o.z - mid.z) > R) continue
    const hx = Math.sin(o.yaw || 0)
    const hz = Math.cos(o.yaw || 0)
    const hl = o.walker ? 0 : (o.length || 4.6) / 2 - 0.6
    const tol = o.walker ? 1.5 : 1.45
    const probes = hl > 0 ? [[o.x - hx * hl, o.z - hz * hl], [o.x, o.z], [o.x + hx * hl, o.z + hz * hl]] : [[o.x, o.z]]
    for (const q of samples) {
      if (best && q.s - front >= best.gap) break
      // past the path end the line continues straight along the last tangent
      const px = q.over ? last.x + last.dx * q.over : q.x
      const pz = q.over ? last.z + last.dz * q.over : q.z
      let hit = false
      for (const [x, z] of probes) if ((x - px) ** 2 + (z - pz) ** 2 < tol * tol) { hit = true; break }
      if (!hit) continue
      const along = o.walker ? 0 : hx * q.dx + hz * q.dz
      const v = along > 0.7 ? (o.speed || 0) * along : 0
      const gap = Math.max(0, q.s - front - (o.walker ? 0.6 : 0))
      if (!best || gap < best.gap) best = { gap, v, id: o.id }
      break
    }
  }
  return best
}

/** First crossing of segment a-b along a polyline, as arc length (or null) */
export function crossAt(path, a, b) {
  const { pts, cum } = path
  const ex = b.x - a.x
  const ez = b.z - a.z
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i - 1]
    const q = pts[i]
    const dx = q.x - p.x
    const dz = q.z - p.z
    const den = dx * ez - dz * ex
    if (Math.abs(den) < 1e-9) continue
    const t = ((a.x - p.x) * ez - (a.z - p.z) * ex) / den
    const u = ((a.x - p.x) * dz - (a.z - p.z) * dx) / den
    if (t >= 0 && t <= 1 && u >= 0 && u <= 1) return { s: cum[i - 1] + t * (cum[i] - cum[i - 1]), dx: dx / (Math.hypot(dx, dz) || 1), dz: dz / (Math.hypot(dx, dz) || 1) }
  }
  return null
}

/** Point inside an oriented crossing zone { x, z, ux, uz, hl, hw } (u = along the walk) */
export function inZone(zone, x, z, pad = 0) {
  const dx = x - zone.x
  const dz = z - zone.z
  const a = dx * zone.ux + dz * zone.uz
  const c = -dx * zone.uz + dz * zone.ux
  return Math.abs(a) <= zone.hl + pad && Math.abs(c) <= zone.hw + pad
}

// ---------------------------------------------------------------- junction geometry

/**
 * Legs, stop lines, crosswalk zones, signal pole and ped-head spots of one junction.
 * spec: { node, crossW = 3, crossGap = 0.6, lineGap = 1 }. Lanes: right-hand traffic.
 */
export function junctionGeometry(graph, spec) {
  const n = graph.node(spec.node)
  const cw = spec.crossW ?? 3
  const gap = spec.crossGap ?? 0.6
  const lineGap = spec.lineGap ?? 1
  const legs = n.adj.filter((a) => a.public).map((a) => {
    const m = graph.node(a.to)
    const len = Math.hypot(m.x - n.x, m.z - n.z) || 1
    const ux = (m.x - n.x) / len
    const uz = (m.z - n.z) / len
    // rn: right-hand normal of inbound travel (-u)
    return { to: a.to, ux, uz, rnx: uz, rnz: -ux, len, hw: a.width / 2, offs: a.offs, lanes: a.lanes, group: Math.abs(uz) > Math.abs(ux) ? 'ns' : 'ew' }
  })
  const at = (L, d, r) => ({ x: n.x + L.ux * d + L.rnx * r, z: n.z + L.uz * d + L.rnz * r })
  for (const L of legs) {
    let sb = 0
    for (const o of legs) if (o !== L && Math.abs(o.ux * L.ux + o.uz * L.uz) < 0.5) sb = Math.max(sb, o.hw)
    L.setback = sb
    L.cross = sb + gap + cw / 2
    L.stopD = sb + gap + cw + lineGap
  }
  const stops = []
  const zones = []
  const poles = []
  const peds = []
  for (const L of legs) {
    const opp = legs.find((o) => o.ux * L.ux + o.uz * L.uz < -0.9) || null
    stops.push({ leg: L.to, group: L.group, a: at(L, L.stopD, 0.1), b: at(L, L.stopD, L.hw - 0.2), tx: -L.ux, tz: -L.uz })
    const c = at(L, L.cross, 0)
    zones.push({ leg: L.to, x: c.x, z: c.z, ux: L.rnx, uz: L.rnz, hl: L.hw + 0.3, hw: cw / 2 + 0.4 })
    // far-side pole on the right kerb, beyond the far crosswalk (or the crossing road)
    const far = opp ? opp.cross + cw / 2 + 0.8 : L.setback + 0.9
    const lat = (opp ? opp.hw : L.hw) + 0.9
    const p = at(L, -far, lat)
    poles.push({ leg: L.to, group: L.group, x: p.x, z: p.z, yaw: Math.atan2(L.ux, L.uz), arm: L.offs.map((o) => o - lat), peds: [] })
    for (const s of [1, -1]) {
      const e = at(L, L.cross, s * (L.hw + 0.7))
      peds.push({ x: e.x, z: e.z, yaw: Math.atan2(-s * L.rnx, -s * L.rnz) })
    }
  }
  // ped heads close to a vehicle pole are mounted on it, the rest get their own post
  const posts = []
  for (const h of peds) {
    const p = poles.find((q) => Math.hypot(q.x - h.x, q.z - h.z) < 1.8)
    if (p) p.peds.push(h.yaw - p.yaw)
    else posts.push(h)
  }
  return { node: n.id, x: n.x, z: n.z, legs, stops, zones, poles, posts }
}

// ---------------------------------------------------------------- system

/**
 * TrafficSystem: one SignalController per signalised junction + geometry queries for the
 * drive / walk steps. Public API lives on world.traffic (see TrafficSystem#api).
 * cfg.signals: [{ node, id?, name?, timing?, offset?, ped? }], cfg.timing: defaults for all.
 */
export class TrafficSystem {
  constructor(graph, cfg = {}, opts = {}) {
    this.graph = graph
    this.cfg = cfg
    this.junctions = []
    this.controllers = []
    this.views = []
    this.onChange = opts.onChange || null
    for (const s of cfg.signals || []) {
      const geo = junctionGeometry(graph, { ...cfg.geometry, ...s })
      const ctl = new SignalController({ id: s.id || `signal-${s.node}`, node: s.node, name: s.name, x: geo.x, z: geo.z, timing: { ...cfg.timing, ...s.timing }, offset: s.offset, ped: s.ped })
      ctl.onChange = (c, from) => this.onChange?.(c, from)
      this.junctions.push({ ...geo, ctl })
      this.controllers.push(ctl)
    }
    this.stats = { redRuns: 0 }
  }

  /** dt = sim seconds (already scaled by clock speed, 0 when paused) */
  update(dt) {
    this.tick = (this.tick || 0) + 1
    for (const c of this.controllers) c.update(dt)
  }

  signal(id) {
    const c = this.controllers.find((x) => x.id === id || x.node === id)
    if (!c) throw new Error(`Unknown traffic signal "${id}"`)
    return c
  }

  /** Stop lines crossed by a path: [{ s, junction, stop }] sorted by distance */
  stopsOn(path, from = 0) {
    const out = []
    for (const j of this.junctions) {
      for (const st of j.stops) {
        const hit = crossAt(path, st.a, st.b)
        if (!hit || hit.s < from) continue
        if (hit.dx * st.tx + hit.dz * st.tz < 0.5) continue
        out.push({ s: hit.s, j, stop: st, memo: {} })
      }
    }
    return out.sort((a, b) => a.s - b.s)
  }

  /** Crossing zone that contains (x, z), or null */
  zoneAt(x, z, pad = 0) {
    for (const j of this.junctions) for (const zn of j.zones) if (inZone(zn, x, z, pad)) return { j, zone: zn }
    return null
  }

  /** May a pedestrian step onto the crossing at (x, z)? (true off-crossing) */
  canWalk(x, z) {
    const hit = this.zoneAt(x, z)
    if (!hit) return true
    return hit.j.ctl.aspect('ped') === 'walk' || hit.j.ctl.mode === 'off'
  }

  /** Public API for UI / twin / IoT bindings (exposed as world.traffic) */
  api() {
    const self = this
    return {
      get signals() { return self.controllers },
      get junctions() { return self.junctions },
      get(id) { return self.signal(id) },
      snapshot() { return self.controllers.map((c) => c.state()) },
      setPhase(id, phase, opts) { return self.signal(id).setPhase(phase, opts).state() },
      release(id) { return self.signal(id).release().state() },
      setMode(id, mode) { return self.signal(id).setMode(mode).state() },
      setTiming(id, patch) { return self.signal(id).setTiming(patch).state() },
      releaseAll() { for (const c of self.controllers) c.release() },
      get stats() { return self.stats },
      PHASES: PHASES.map((p) => p.id)
    }
  }
}
