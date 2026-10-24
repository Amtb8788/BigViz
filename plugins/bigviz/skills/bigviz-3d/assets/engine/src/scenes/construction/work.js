// Construction pack - reusable work cycles (step macros) and task tables.
// These are what make machines and people look like they do real jobs, not loops.

import { registerStep } from '../../systems/steps.js'
import { clamp, damp } from '../../core/math.js'

const PI = Math.PI
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a))
/** slew of an upper body (relative to the entity yaw) that points at a world xz */
export const slewTo = (x, z) => (c, e) => wrap(Math.atan2(x - e.agent.x, z - e.agent.z) - e.agent.yaw)

// ---------------------------------------------------------------- excavator
const POSE = {
  rest: { boom: 0.15, arm: 1.1, bucket: 0.9 },
  reach: { boom: 0.35, arm: 0.35, bucket: 0.3 },
  dig: { boom: 0.6, arm: 1.25, bucket: -0.4 },
  lift: { boom: -0.35, arm: 1.0, bucket: -0.6 },
  dump: { boom: -0.5, arm: 0.65, bucket: 1.2 }
}

/** One bucket: reach, dig (dust), curl, lift, slew to target, dump (dust), slew back */
export function digCycle(target, { varName, say } = {}) {
  const tx = target.x
  const tz = target.z
  return [
    { do: 'tween', set: { slew: () => (Math.random() - 0.5) * 0.5, ...POSE.reach }, t: 1.4, label: '伸臂' },
    { do: 'tween', set: POSE.dig, t: 1.6, fx: 'dust', fxAt: 'bucket', fxRate: 5, label: '挖土' },
    { do: 'set', agent: { full: true } },
    { do: 'tween', set: POSE.lift, t: 1.2, label: '提斗' },
    { do: 'tween', set: { slew: slewTo(tx, tz) }, t: 2.2, label: '回转' },
    { do: 'tween', set: POSE.dump, t: 1.1, label: '卸土' },
    { do: 'fx', fx: 'dust', at: 'bucket', n: 14 },
    { do: 'set', agent: { full: false } },
    ...(varName ? [{ do: 'add', var: { [varName]: 0.34 } }] : []),
    ...(say ? [{ do: 'say', text: say, t: 2 }] : []),
    { do: 'tween', set: POSE.rest, t: 1 }
  ]
}

// ---------------------------------------------------------------- mobile crane
/** Lift `cargo` from `from` to `to` (world xz + y), luffing / telescoping the boom */
export function mcLift(from, to, cargo, label) {
  const reach = (p) => (c, e) => clamp((Math.hypot(p.x - e.agent.x, p.z - e.agent.z) - 9) / 12, 0, 1)
  const luff = (p) => (c, e) => clamp(1.25 - Math.hypot(p.x - e.agent.x, p.z - e.agent.z) / 26, 0.35, 1.2)
  return [
    { do: 'tween', set: { slew: slewTo(from.x, from.z), luff: luff(from), ext: reach(from) }, t: 4, label: '回转对位' },
    { do: 'tween', set: { rope: 12 }, t: 2.5, label: '落钩' },
    { do: 'wait', t: 2.5, label: '挂钩' },
    { do: 'set', agent: { payload: cargo } },
    { do: 'tween', set: { rope: 4 }, t: 3, label: '起吊' },
    { do: 'tween', set: { slew: slewTo(to.x, to.z), luff: luff(to), ext: reach(to) }, t: 5, label: label || '吊运' },
    { do: 'tween', set: { rope: to.rope ?? 7 }, t: 2.5, label: '就位' },
    { do: 'wait', t: 3, label: '安装固定' },
    { do: 'set', agent: { payload: null } },
    { do: 'add', var: { 'counter.lifts': 1 } },
    { do: 'tween', set: { rope: 4 }, t: 2 }
  ]
}

export const outriggers = (on) => ({ do: 'tween', set: { outrig: on ? 1 : 0 }, t: 4, label: on ? '支腿展开' : '收腿' })

// ---------------------------------------------------------------- concrete pump
registerStep('pump', {
  start(c, e, s, st) {
    st.t = s.t ?? 30
    st.fx = 0
    e.agent.pumping = true
  },
  update(c, e, s, st, dt) {
    const a = e.agent
    st.t -= dt
    const p = c.resolve({ pour: true, v: 0.3, maxX: 1 }, e)
    if (!a.target) a.target = { x: p.x, y: p.y, z: p.z }
    a.target.x += (p.x - a.target.x) * damp(1.5, dt)
    a.target.y = p.y
    a.target.z += (p.z + Math.sin(st.t * 0.6) * 1.5 - a.target.z) * damp(1.5, dt)
    st.fx -= dt
    if (st.fx <= 0) {
      st.fx = 0.25
      c.fx.emit('splash', { x: a.target.x, y: a.target.y + 0.3, z: a.target.z }, 6)
    }
    const done = st.t <= 0 || c.world.take('mixer.done')
    if (done) { a.pumping = false; c.world.addVar('counter.concrete', 8) }
    return done
  },
  cancel(c, e) { e.agent.pumping = false }
}, '泵送混凝土')

// ---------------------------------------------------------------- deck tasks by build phase
const DECK = {
  foundation: [{ anim: 'shovel', t: [5, 8], fx: 'dust', fxAt: 'front' }, { anim: 'rake', t: [5, 8] }, { anim: 'inspect', t: 4 }],
  columns: [{ anim: 'weld', t: [6, 9], fx: 'sparks', fxAt: 'hand', fxEvery: 0.15, say: '焊接柱筋' }, { anim: 'hammer', t: [4, 6], fxEvery: 0.5 }, { anim: 'rebar', t: [5, 7] }],
  formwork: [{ anim: 'hammer', t: [5, 8], say: '支模中' }, { anim: 'drill', t: 4, fx: 'dust', fxAt: 'hand', fxEvery: 0.3 }, { anim: 'carry', t: 3, carry: 'plank' }],
  rebar: [{ anim: 'rebar', t: [6, 9], say: '绑扎钢筋' }, { anim: 'rebar', t: [6, 9] }, { anim: 'inspect', t: 4 }],
  pour: [{ anim: 'vibrate', t: [6, 9], fx: 'splash', fxAt: 'front', fxEvery: 0.4, say: '振捣' }, { anim: 'rake', t: [5, 8], fx: 'splash', fxAt: 'front', fxEvery: 0.6 }],
  cure: [{ anim: 'sweep', t: [5, 7] }, { anim: 'inspect', t: 4 }, { anim: 'talk', t: 4 }],
  done: [{ anim: 'drill', t: 5, fx: 'dust', fxAt: 'hand' }, { anim: 'inspect', t: 4 }, { anim: 'clipboard', t: 4 }]
}

export const deckTask = (c) => {
  const list = DECK[c.building?.phase] || DECK.cure
  return { ...list[Math.floor(Math.random() * list.length)] }
}

/** Where to stand on the deck: near the pour front while pouring, else anywhere */
export const deckSpot = (c) => (c.building?.phase === 'pour' ? { pour: true, v: Math.random() * 0.8 - 0.4 } : { deck: true, margin: 2 })

// ---------------------------------------------------------------- tower crane cargo by phase
export const craneCargo = (c) => {
  const d = c.clock.day
  if (d > 11.3) return Math.random() < 0.6 ? 'tubes' : 'pallet'
  const ph = c.building?.phase
  if (ph === 'columns') return 'cage'
  if (ph === 'formwork') return 'formwork'
  if (ph === 'rebar') return 'rebar'
  return Math.random() < 0.5 ? 'pallet' : 'rebar'
}

export const cargoPick = (c) => {
  const k = c.world.vars.nextCargo
  return k === 'formwork' ? 'pickForm' : k === 'pallet' || k === 'tubes' ? 'pickPallet' : 'pickRebar'
}

export const cargoTakeVar = { pallet: 'stock.pallet', rebar: 'stock.rebar', cage: 'stock.rebar' }

export { PI }
