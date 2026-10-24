// Work + coordination steps: wait, anim, tween (machine joints), crane (tower crane lift
// cycle), ride (construction hoist), carry/tool, say/log, signal/waitFor/waitVar, set/add,
// lock/unlock, hide/show, fx, emit, call.

import * as THREE from 'three'
import { approach, approachAngle, angleDelta, clamp, easeInOut, lerp } from '../core/math.js'
import { rnd } from './steps-move.js'

const P = (c, e, spec) => c.resolve(spec, e)
const tmp = new THREE.Vector3()
const CARGO_CN = { rebar: '钢筋', formwork: '模板', pallet: '材料托盘', cage: '钢筋笼', skip: '混凝土料斗', panel: '幕墙板', section: '标准节', tubes: '脚手架管' }
const val = (c, e, v) => (typeof v === 'function' ? v(c, e) : v)

function fxAt(c, e, where) {
  const a = e.agent
  if (typeof where === 'string' && e.rig?.[where]?.isObject3D) return e.rig[where].getWorldPosition(tmp).clone()
  if (where === 'front' || !where) return new THREE.Vector3(a.x + Math.sin(a.yaw) * 0.8, a.y + 0.3, a.z + Math.cos(a.yaw) * 0.8)
  const p = P(c, e, where)
  return new THREE.Vector3(p.x, p.y ?? 0, p.z)
}

export const workSteps = {
  wait: {
    start(c, e, s, st) { st.t = rnd(s.t ?? 2); e.agent.speed = 0; if (e.agent.kind === 'walker') e.agent.anim = s.anim || 'idle' },
    update(c, e, s, st, dt) { st.t -= dt; return st.t <= 0 }
  },

  anim: {
    start(c, e, s, st) {
      const a = e.agent
      st.t = rnd(val(c, e, s.t) ?? 3)
      st.fx = 0
      st.fxName = val(c, e, s.fx)
      a.anim = val(c, e, s.anim)
      a.animT = 0
      a.speed = 0
      if (s.tool !== undefined) a.tool = val(c, e, s.tool)
      if (s.say && Math.random() < (s.sayChance ?? 0.35)) c.say(e, val(c, e, s.say), 2.5)
      if (s.face) st.yaw = Math.atan2(P(c, e, s.face).x - a.x, P(c, e, s.face).z - a.z)
    },
    update(c, e, s, st, dt) {
      const a = e.agent
      st.t -= dt
      if (st.yaw != null) a.yaw = approachAngle(a.yaw, st.yaw, 5 * dt)
      if (st.fxName) {
        st.fx -= dt
        if (st.fx <= 0) {
          st.fx = rnd(s.fxEvery ?? 0.6)
          c.fx.emit(st.fxName, fxAt(c, e, s.fxAt), s.fxN ?? 5)
        }
      }
      if (st.t <= 0) {
        if (s.tool !== undefined && s.keepTool !== true) a.tool = null
        a.anim = 'idle'
        return true
      }
      return false
    }
  },

  /** Phase-aware work: { do:'work', pick:(ctx, e) => animStepSpec } (one random task per run) */
  work: {
    start(c, e, s, st) {
      st.spec = s.pick(c, e) || { anim: 'idle', t: 2 }
      if (st.spec.carry !== undefined) e.agent.carrying = st.spec.carry
      return workSteps.anim.start(c, e, st.spec, st)
    },
    update(c, e, s, st, dt) {
      const done = workSteps.anim.update(c, e, st.spec, st, dt)
      if (done && st.spec.carry !== undefined) e.agent.carrying = null
      return done
    }
  },

  /** Ease agent fields (machine joints) to targets: { do:'tween', set:{ boom:-0.4, arm:0.6 }, t:2 } */
  tween: {
    start(c, e, s, st) {
      st.t = 0
      st.dur = Math.max(0.01, rnd(val(c, e, s.t) ?? 1.5))
      st.from = {}
      st.to = {}
      for (const [k, v] of Object.entries(s.set)) { st.from[k] = e.agent[k] ?? 0; st.to[k] = val(c, e, v) }
    },
    update(c, e, s, st, dt) {
      st.t += dt
      const k = s.linear ? Math.min(1, st.t / st.dur) : easeInOut(Math.min(1, st.t / st.dur))
      for (const key of Object.keys(s.set)) e.agent[key] = lerp(st.from[key], s.live ? val(c, e, s.set[key]) : st.to[key], k)
      if (s.fx && Math.random() < dt * (s.fxRate ?? 3)) c.fx.emit(s.fx, fxAt(c, e, s.fxAt), s.fxN ?? 4)
      return st.t >= st.dur
    }
  },

  /**
   * Tower crane lift: { do:'crane', from, to, cargo, hookSignal, unhookSignal, takeVar, dropVar,
   *   carrying:true (already loaded, skip pick), keep:true (do not release at drop), hold, holdFx }
   * x/z of from/to are fixed at start (random deck points stay put); y follows the rising deck.
   */
  crane: {
    start(c, e, s, st) {
      st.ph = s.carrying ? 3 : 0
      st.t = 0
      st.cargo = val(c, e, s.cargo) || e.agent.payload || 'rebar'
      st.takeVar = val(c, e, s.takeVar)
      st.fromSpec = s.from ? val(c, e, s.from) : null
      st.toSpec = val(c, e, s.to)
      st.from = st.fromSpec ? P(c, e, st.fromSpec) : null
      st.to = P(c, e, st.toSpec)
      if (s.hookSignal) c.world.signals[s.hookSignal] = 0
      if (s.unhookSignal) c.world.signals[s.unhookSignal] = 0
      if (st.from) c.world.vars.pickPos = st.from
      c.world.vars.dropPos = st.to
    },
    update(c, e, s, st, dt) {
      const a = e.agent
      const rig = e.rig
      const jibY = a.y + rig.top.position.y + 1
      const deck = c.building ? c.building.y + c.building.rig.deckY : 0
      const safeRope = Math.max(2, jibY - Math.max(deck + 9, 12))
      const HANG = 3.6
      const usePick = st.ph < 3
      const tgt = usePick ? st.from : st.to
      const spec = usePick ? st.fromSpec : st.toSpec
      if (spec && (spec.deck || spec.pour)) tgt.y = P(c, e, spec).y
      const dx = tgt.x - a.x
      const dz = tgt.z - a.z
      const yaw = Math.atan2(dx, dz)
      const rad = clamp(Math.hypot(dx, dz), 3, rig.jibLen - 2)
      const prev = a.slew
      const move = () => {
        a.slew = approachAngle(a.slew, yaw, (s.slewRate || 0.32) * dt)
        a.trolley = approach(a.trolley, rad, 3 * dt)
        a.slewVel = angleDelta(prev, a.slew) / Math.max(dt, 1e-4)
        return Math.abs(angleDelta(a.slew, yaw)) < 0.01 && Math.abs(a.trolley - rad) < 0.05
      }
      const rope = (len) => {
        a.rope = approach(a.rope, len, 4.2 * dt)
        return Math.abs(a.rope - len) < 0.05
      }
      const low = jibY - (tgt.y ?? 0) - HANG
      st.t += dt
      a.slewVel = 0
      switch (st.ph) {
        case 0: a.label = '回转至取料点'; if (rope(safeRope) & move()) st.ph = 1; break
        case 1: a.label = '落钩'; if (rope(low)) { st.ph = 2; st.t = 0; c.world.signal(s.atPick || 'crane.atPick') } break
        case 2:
          a.label = '挂钩中'
          if ((s.hookSignal && c.world.take(s.hookSignal)) || st.t > (s.hookTime ?? 9)) {
            a.payload = st.cargo
            if (st.takeVar) c.world.setVar(st.takeVar, Math.max(0, c.world.getVar(st.takeVar) - 1))
            st.ph = 3
            c.bus.emit('crane.lift', { id: e.id, cargo: st.cargo })
          }
          break
        case 3: a.label = '起吊'; if (rope(safeRope)) st.ph = 4; break
        case 4: a.label = `吊运 · ${CARGO_CN[st.cargo] || st.cargo}`; if (move() & rope(safeRope)) st.ph = 5; break
        case 5: a.label = '就位落钩'; if (rope(low)) { st.ph = 6; st.t = 0; c.world.signal(s.atDrop || 'crane.atDrop') } break
        case 6:
          a.label = s.hold ? '浇筑中' : '摘钩中'
          if (s.holdFx && Math.random() < dt * 4) c.fx.emit(s.holdFx, { x: tgt.x, y: tgt.y + 0.2, z: tgt.z }, 6)
          if ((s.unhookSignal && c.world.take(s.unhookSignal)) || st.t > (s.hold ?? s.unhookTime ?? 8)) {
            if (!s.keep) a.payload = null
            if (s.dropVar) c.world.addVar(s.dropVar, 1)
            c.world.addVar('counter.lifts', 1)
            c.bus.emit('crane.drop', { id: e.id, cargo: st.cargo })
            st.ph = 7
          }
          break
        case 7: a.label = '收钩'; if (rope(safeRope)) return true; break
      }
      return false
    },
    cancel(c, e) { e.agent.payload = null }
  },

  /** Ride the construction hoist: { do:'ride', hoist:'hoist-1', dir:'up'|'down' } */
  ride: {
    start(c, e, s, st) { st.h = c.world.get(s.hoist); st.ph = 0; if (!st.h) return true },
    update(c, e, s, st) {
      const a = e.agent
      const H = st.h.agent
      const up = s.dir !== 'down'
      a.speed = 0
      a.anim = 'idle'
      if (st.ph === 0 && H.cageState === (up ? 'ground' : 'top')) {
        const ox = (Math.random() - 0.5) * 1.2
        a.attach = { get: () => st.h.rig.cage.getWorldPosition(tmp), dx: ox, dz: 0 }
        a.onDeck = false
        st.ph = 1
      } else if (st.ph === 1 && H.cageState === (up ? 'top' : 'ground')) {
        a.attach = null
        a.onDeck = up
        if (!up) a.y = 0
        return true
      }
      return false
    },
    cancel(c, e) { e.agent.attach = null }
  },

  carry: { start(c, e, s) { e.agent.carrying = s.item || null; return true } },
  tool: { start(c, e, s) { e.agent.tool = s.tool || null; return true } },
  say: { start(c, e, s) { c.say(e, s.text, s.t ?? 3); return true } },
  log: { start(c, e, s) { c.log(typeof s.text === 'function' ? s.text(c, e) : s.text, s.icon); return true } },
  emit: { start(c, e, s) { c.bus.emit(s.event, { id: e.id, ...(s.data || {}) }); return true } },
  signal: { start(c, e, s) { c.world.signal(s.name, s.n ?? 1); return true } },
  clear: { start(c, e, s) { c.world.signals[s.name] = 0; return true } },
  hide: { start(c, e) { e.agent.hidden = true; e.agent.speed = 0; return true } },
  show: { start(c, e) { e.agent.hidden = false; return true } },
  fx: { start(c, e, s) { c.fx.emit(s.fx, fxAt(c, e, s.at), s.n ?? 8); return true } },

  waitFor: {
    start(c, e, s, st) { st.t = 0; e.agent.speed = 0 },
    update(c, e, s, st, dt) {
      st.t += dt
      const ok = s.take === false ? c.world.peek(s.signal) : c.world.take(s.signal)
      return ok || (s.timeout != null && st.t >= s.timeout)
    }
  },

  waitVar: {
    start(c, e, s, st) { st.t = 0 },
    update(c, e, s, st, dt) {
      st.t += dt
      const v = c.world.getVar(s.var)
      const ok = (s.min == null || v >= s.min) && (s.max == null || v <= s.max)
      return ok || (s.timeout != null && st.t >= s.timeout)
    }
  },

  set: {
    start(c, e, s) {
      for (const [k, v] of Object.entries(s.var || {})) c.world.setVar(k, val(c, e, v))
      for (const [k, v] of Object.entries(s.agent || {})) e.agent[k] = val(c, e, v)
      return true
    }
  },

  add: {
    start(c, e, s) {
      for (const [k, v] of Object.entries(s.var || {})) {
        const n = c.world.getVar(k) + val(c, e, v)
        c.world.setVar(k, s.min != null ? Math.max(s.min, n) : n)
      }
      return true
    }
  },

  lock: {
    update(c, e, s) {
      if (!c.world.lock(s.key, e.id)) return false
      e.agent.lockKey = s.key
      return true
    }
  },
  unlock: { start(c, e, s) { c.world.unlock(s.key, e.id); e.agent.lockKey = null; return true } },

  /** Escape hatch: { do:'call', fn:(ctx, entity, dt, state) => true when done } */
  call: { update: (c, e, s, st, dt) => !!s.fn(c, e, dt, st) }
}
