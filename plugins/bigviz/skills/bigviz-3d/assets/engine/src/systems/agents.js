// AgentSystem: runs data-driven plans (behaviour scripts) for every agent entity.
//
// agent spec (scene data):
//   { kind: 'vehicle'|'walker'|'machine', speed, plans: [ { id, when, spawn, steps, loop, interruptible } ] }
// when: { day:[a,b], hour:[a,b], weather:['clear',..], notWeather:[..], phase:[..], var:{k:[min,max]}, signal:'x', test:(ctx)=>bool }
// steps: [{ do:'walk', to:'gate' }, { do:'anim', anim:'hammer', t:4 }, { repeat:3, steps:[..] }, { choose:[[..],[..]] }]
// Every step type lives in steps.js; scenes may register their own with registerStep().

import { STEPS, STEP_LABELS } from './steps.js'
import { damp } from '../core/math.js'

export class AgentSystem {
  constructor(ctx) {
    this.ctx = ctx
    this.agents = []
  }

  add(e) {
    e.agent = { x: 0, y: 0, z: 0, yaw: 0, speed: 0, anim: 'idle', animT: 0, onDeck: false, hidden: false, reversing: false, braking: false, attach: null, deckLift: 0, ...e.agent, plan: null, frames: [], step: null, st: null, delay: 0 }
    const a = e.agent
    if (a.spawn) this._place(e, a.spawn)
    this.agents.push(e)
    return e
  }

  /** Timeline jumped: re-seat every agent at the spawn point of the plan that is valid now */
  reset() {
    this.ctx.world.resetBlackboard()
    for (const e of this.agents) {
      const a = e.agent
      this._cleanup(e)
      a.plan = null
      a.step = null
      a.speed = 0
      a.attach = null
      if (a.init) Object.assign(a, a.init)
      const plan = this._pick(e)
      if (plan) this._start(e, plan, true)
      else if (a.spawn) this._place(e, a.spawn)
    }
  }

  _place(e, spec) {
    const p = this.ctx.resolve(spec, e)
    if (!p) return
    const a = e.agent
    a.x = p.x
    a.z = p.z
    a.onDeck = !!p.onDeck
    a.y = p.y ?? 0
    if (p.yaw != null) a.yaw = p.yaw
    if (spec && spec.yaw != null) a.yaw = spec.yaw
    a.hidden = !!(spec && spec.hidden)
  }

  _ok(e, plan) {
    const w = plan.when
    if (!w) return true
    const c = this.ctx
    const day = c.clock.day
    if (w.day && (day < w.day[0] || day >= w.day[1])) return false
    if (w.hour) {
      const h = c.clock.hour
      const [a, b] = w.hour
      if (a <= b ? h < a || h >= b : h < a && h >= b) return false
    }
    if (w.weather && !w.weather.includes(c.weather.current)) return false
    if (w.notWeather && w.notWeather.includes(c.weather.current)) return false
    if (w.phase && !w.phase.includes(c.building?.phase)) return false
    if (w.var) for (const [k, [lo, hi]] of Object.entries(w.var)) { const v = c.world.getVar(k); if (v < lo || v > hi) return false }
    if (w.signal && !c.world.peek(w.signal)) return false
    if (w.test && !w.test(c, e)) return false
    return true
  }

  /** an earlier plan marked preempt:true that is valid now (urgent jobs: unhook, guide a reversing truck) */
  _preempt(e, cur) {
    for (const p of e.agent.plans) {
      if (p === cur) return null
      if (p.preempt && this._ok(e, p)) return p
    }
    return null
  }

  _pick(e) {
    for (const p of e.agent.plans || []) if (this._ok(e, p)) return p
    return null
  }

  _start(e, plan, seat) {
    const a = e.agent
    a.plan = plan
    a.frames = [{ steps: plan.steps, i: 0, left: 1 }]
    a.step = null
    a.st = null
    if (seat && plan.spawn) this._place(e, plan.spawn)
    if (seat && plan.stagger) a.delay = Math.random() * plan.stagger
    e.agent.planId = plan.id
  }

  _cleanup(e) {
    const a = e.agent
    if (a.step) STEPS[a.step.do]?.cancel?.(this.ctx, e, a.step, a.st)
    if (a.lockKey) { this.ctx.world.unlock(a.lockKey, e.id); a.lockKey = null }
  }

  /** Resolve the next leaf step from the frame stack (handles repeat / choose) */
  _next(a) {
    for (let guard = 0; guard < 64; guard++) {
      const top = a.frames[a.frames.length - 1]
      if (!top) return null
      if (top.i >= top.steps.length) {
        if (--top.left > 0) { top.i = 0; continue }
        a.frames.pop()
        if (a.frames.length) a.frames[a.frames.length - 1].i++
        continue
      }
      const s = top.steps[top.i]
      if (s.repeat || s.choose) {
        const steps = s.choose ? s.choose[Math.floor(Math.random() * s.choose.length)] : s.steps
        const n = s.repeat ? (Array.isArray(s.repeat) ? s.repeat[0] + Math.floor(Math.random() * (s.repeat[1] - s.repeat[0] + 1)) : s.repeat) : 1
        a.frames.push({ steps, i: 0, left: n })
        continue
      }
      if (s.chance != null && Math.random() > s.chance) { top.i++; continue }
      return s
    }
    return null
  }

  update(dt) {
    const c = this.ctx
    c.vehicles = this.agents.filter((e) => e.agent.kind === 'vehicle' && e.active && !e.agent.hidden)
    for (const e of this.agents) {
      const a = e.agent
      if (!e.active) continue
      if (a.delay > 0) { a.delay -= dt; this._sync(e, dt); continue }
      const pre = a.plan && a.plan.interruptible !== false ? this._preempt(e, a.plan) : null
      if (pre || !a.plan || (a.plan.interruptible !== false && !this._ok(e, a.plan) && !a.step?.atomic)) {
        const p = this._pick(e)
        if (p !== a.plan) {
          this._cleanup(e)
          if (p) this._start(e, p, !a.plan)
          else { a.plan = null; a.step = null; a.anim = 'idle'; a.speed = 0 }
        }
      }
      if (a.plan) {
        let budget = 8
        while (budget-- > 0) {
          if (!a.step) {
            a.step = this._next(a)
            if (!a.step) {
              if (a.plan.loop === false) { a.frames = []; break }
              const p = this._pick(e)
              this._start(e, p || a.plan, false)
              a.step = this._next(a)
              if (!a.step) break
            }
            a.st = {}
            const h = STEPS[a.step.do]
            if (!h) { console.warn(`Unknown step "${a.step.do}" in ${e.id}`); a.step = null; this._advance(a); continue }
            a.label = a.step.label || STEP_LABELS[a.step.do] || ''
            if (h.start?.(c, e, a.step, a.st) === true) { a.step = null; this._advance(a); continue }
          }
          const done = STEPS[a.step.do].update?.(c, e, a.step, a.st, dt) ?? true
          if (!done) break
          a.step = null
          this._advance(a)
        }
      }
      this._sync(e, dt)
    }
  }

  _advance(a) {
    const top = a.frames[a.frames.length - 1]
    if (top) top.i++
  }

  _sync(e, dt) {
    const a = e.agent
    const b = this.ctx.building
    if (a.attach) {
      const p = a.attach.get()
      a.x = p.x + (a.attach.dx || 0)
      a.y = p.y
      a.z = p.z + (a.attach.dz || 0)
    } else if (a.onDeck && b) {
      const target = b.y + b.rig.deckY
      const gap = target - a.y
      a.deckLift = Math.abs(gap) > 0.3 ? 1 : 0
      a.y += gap * damp(2.5, dt)
    }
    const o = e.object3d
    o.position.set(a.x, a.y, a.z)
    o.rotation.y = a.yaw
    e.basePos = o.position
    e.hiddenByAgent = a.hidden
    e.status = a.label
  }
}
