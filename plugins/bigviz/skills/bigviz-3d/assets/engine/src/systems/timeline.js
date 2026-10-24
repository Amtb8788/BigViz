// Time-driven world state. Three small systems that make "the project advances" visible:
//  - LifecycleSystem: entity.life = { windows:[[from,to]], enter, exit, dur } -> appear / leave
//  - DriveSystem:     entity.drive = { 'agent.sections': [[day,v],..], 'rig.setRemoved': [[..]] }
//  - ProgressSystem:  scene.progress = { target, curves:{ floors:[[day,v]], ... }, events:[...] }
// All are pure functions of clock.day, so scrubbing the timeline is always consistent.

import { clamp, easeOut, keyframes } from '../core/math.js'

const ENTER = {
  grow: (o, k, base) => o.scale.copy(base.scale).multiplyScalar(Math.max(0.001, easeOut(k))),
  rise: (o, k, base, h) => (o.position.y += -(1 - easeOut(k)) * h),
  drop: (o, k, base, h) => (o.position.y += (1 - easeOut(k)) * h * 3),
  sink: (o, k, base, h) => (o.position.y += -(1 - k) * h),
  none: () => {}
}

export class LifecycleSystem {
  constructor(world) {
    this.world = world
    this.items = []
  }

  track(e) {
    if (!e.life) { e.active = true; return }
    const o = e.object3d
    e._base = { position: o.position.clone(), scale: o.scale.clone() }
    if (!e.life.windows) e.life.windows = [[e.life.from ?? -Infinity, e.life.to ?? Infinity]]
    e.life.h ??= 6
    this.items.push(e)
  }

  update(day) {
    for (const e of this.items) {
      const L = e.life
      const dur = L.dur ?? 0.12
      let k = 0
      let entering = true
      for (const [a, b] of L.windows) {
        if (day < a || day >= b) continue
        const kin = L.enter === 'none' ? 1 : clamp((day - a) / dur, 0, 1)
        const kout = L.exit === 'none' || b === Infinity ? 1 : clamp((b - day) / dur, 0, 1)
        k = Math.min(kin, kout)
        entering = kin <= kout
      }
      e.active = k > 0
      e.lifeK = k
      const o = e.object3d
      if (!e.agent && !e.ownPos) o.position.copy(e._base.position)
      o.scale.copy(e._base.scale)
      if (k > 0 && k < 1) {
        const mode = entering ? L.enter || 'grow' : L.exit || L.enter || 'grow'
        ;(ENTER[mode] || ENTER.grow)(o, k, e._base, L.h)
      }
      o.visible = k > 0 && !e.hiddenByAgent
    }
  }
}

function setPath(e, path, v) {
  const parts = path.split('.')
  let obj = parts[0] === 'agent' ? e.agent : parts[0] === 'rig' ? e.rig : parts[0] === 'object' ? e.object3d : e
  for (let i = 1; i < parts.length - 1; i++) obj = obj[parts[i]]
  const last = parts[parts.length - 1]
  if (typeof obj[last] === 'function') obj[last](v)
  else obj[last] = v
}

export class DriveSystem {
  constructor() {
    this.items = []
  }

  track(e) {
    if (e.drive) this.items.push(e)
  }

  update(day, ctx) {
    for (const e of this.items) {
      if (e.life && !e.active && e.lifeK === 0) continue
      for (const [path, keys] of Object.entries(e.drive)) setPath(e, path, typeof keys === 'function' ? keys(day, ctx, e) : keyframes(keys, day))
    }
  }
}

/**
 * Evaluates progress curves, pushes them into the target rig and fires milestone events
 * (each event fires once when the clock crosses its day going forward).
 */
export class ProgressSystem {
  constructor(ctx, cfg) {
    this.ctx = ctx
    this.cfg = cfg || null
    this.state = {}
    this.lastDay = null
    this.fired = new Set()
    this.lastPhase = null
    this.lastFloor = null
  }

  update(day) {
    const cfg = this.cfg
    if (!cfg) return
    const s = this.state
    for (const [k, keys] of Object.entries(cfg.curves)) s[k] = keyframes(keys, day)
    for (const [k, d] of Object.entries(cfg.flags || {})) s[k] = day >= d
    const target = this.ctx.world.get(cfg.target)
    const out = target?.rig.setState?.(s)
    if (out) {
      const b = this.ctx.building
      if (b) b.phase = out.phase
      if (this.lastPhase && out.phase !== this.lastPhase && this.lastDay != null && day > this.lastDay) this.ctx.bus.emit('build.phase', { phase: out.phase, floor: out.topFloor + 1 })
      if (this.lastFloor != null && out.topFloor > this.lastFloor && day > this.lastDay) this.ctx.bus.emit('build.floor', { floor: out.topFloor })
      this.lastPhase = out.phase
      this.lastFloor = out.topFloor
    }
    if (this.lastDay != null && day > this.lastDay && day - this.lastDay < 0.5) {
      for (const ev of cfg.events || []) {
        if (ev.day > this.lastDay && ev.day <= day) this.ctx.bus.emit('milestone', ev)
      }
    }
    this.lastDay = day
  }

  /** milestones already passed at `day` (for the timeline UI) */
  passed(day) {
    return (this.cfg?.events || []).filter((e) => e.day <= day)
  }
}
