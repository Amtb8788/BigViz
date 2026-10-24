// Construction pack - city life around the site: pedestrians (stroll, stop to watch and
// photograph the build, use the plaza after completion), cars, a bus line.

import { SIDEWALK_OUT, SIDEWALK_IN } from './layout.js'

const PI = Math.PI
const SHIRTS = ['#c9392b', '#2f66b3', '#e8b23a', '#4f8c6a', '#8a5a9a', '#e86a8f', '#eef0ee', '#33363b']
const HAIR = ['#2b211b', '#5a3d22', '#1b1b1b', '#8a6a3a']
const corner = ([x, z]) => ({ x, z, y: 0.15 })

/** walk a sidewalk ring starting at corner k, direction dir */
const ring = (pts, k, dir) => {
  const order = [0, 1, 2, 3].map((i) => pts[(k + dir * i + 8) % 4])
  return order.map((p) => ({ do: 'walk', to: corner(p), speed: [1.0, 1.5] }))
}

function ped(i) {
  const inner = i % 3 === 0
  const pts = inner ? SIDEWALK_IN : SIDEWALK_OUT
  const k = i % 4
  const dir = i % 2 ? 1 : -1
  const watch = inner
    ? [{ do: 'walk', to: { x: -12 + (i % 5) * 7, z: 24.2, y: 0.15 } }, { do: 'face', yaw: PI }, { choose: [[{ do: 'anim', anim: 'photo', t: [4, 6], say: '这楼长得真快', sayChance: 0.4 }], [{ do: 'anim', anim: 'point', t: 3 }], [{ do: 'anim', anim: 'phone', t: 5 }]] }]
    : [{ do: 'anim', anim: 'phone', t: [3, 5], chance: 0.3 }]
  return {
    id: `ped-${i}`, prefab: 'civilian', name: `市民 ${i + 1}`, params: { shirt: SHIRTS[i % SHIRTS.length], hair: HAIR[i % 4], pants: i % 2 ? '#2b3a55' : '#3b3b3b', child: i === 5, seed: 100 + i },
    info: { role: '市民' },
    agent: {
      walkSpeed: 1.25,
      plans: [
        { id: 'plaza', when: { day: [15.9, 99] }, chance: 1, spawn: corner(pts[k]), steps: [
          { do: 'walk', to: { area: { x: -4, z: 14, w: 36, d: 12 } } },
          { choose: [[{ do: 'anim', anim: 'sit', t: [6, 10] }], [{ do: 'anim', anim: 'photo', t: 4, say: '新地标打卡', sayChance: 0.3 }], [{ do: 'wander', area: { x: -4, z: 12, w: 30, d: 10 }, t: 12 }]] },
          ...ring(pts, k, dir).slice(0, 2)
        ] },
        { id: 'stroll', spawn: corner(pts[k]), stagger: 6, steps: [...ring(pts, k, dir).slice(0, 2), ...watch, ...ring(pts, k, dir).slice(2)] }
      ]
    }
  }
}

const CAR_TYPES = ['sedan', 'sedan', 'taxi', 'van', 'sedan', 'sedan', 'taxi', 'sedan', 'van', 'sedan']
const ENTRIES = ['offE', 'offW', 'offN']
// through traffic: entry -> exit with ring corners to pass (both ways round the block)
const ROUTES = {
  offE: [{ to: 'offW', via: ['rNE'] }, { to: 'offW', via: ['rSE'] }, { to: 'offN', via: [] }, { to: 'offN', via: ['rSE', 'rSW', 'rNW'] }],
  offW: [{ to: 'offE', via: ['rNW'] }, { to: 'offE', via: ['rSW'] }, { to: 'offN', via: [] }, { to: 'offN', via: ['rSW', 'rSE', 'rNE'] }],
  offN: [{ to: 'offE', via: [] }, { to: 'offW', via: [] }, { to: 'offE', via: ['rNW', 'rSW', 'rSE'] }, { to: 'offW', via: ['rNE', 'rSE', 'rSW'] }]
}
const pick = (a) => a[Math.floor(Math.random() * a.length)]

function car(i) {
  return {
    id: `car-${i}`, prefab: 'car', name: `社会车辆 ${i + 1}`, params: { type: CAR_TYPES[i % CAR_TYPES.length], seed: i * 3 + 1 },
    info: { role: '社会车辆', ring: 3.5 },
    agent: {
      maxSpeed: [7.5, 9.5][i % 2],
      plans: [{ id: 'roam', spawn: { place: ENTRIES[i % 3], hidden: true }, stagger: 30, steps: [
        { do: 'hide' },
        { do: 'wait', t: [2, 14] },
        // spawn on the kerb lane once the entry is clear, then cross the block
        { do: 'roadEnter', at: ENTRIES },
        { do: 'call', fn: (c, e) => { e.agent.route = pick(ROUTES[e.agent.enteredAt]); return true } },
        { do: 'drive', to: (c, e) => e.agent.route.to, through: (c, e) => e.agent.route.via, public: true, stop: false },
        { do: 'hide' }
      ] }]
    }
  }
}

const bus = {
  id: 'bus', prefab: 'car', name: '公交 12 路', params: { type: 'bus', color: '#2f8a6a' }, info: { role: '公交车', ring: 6 },
  // stops on the site-side (westbound) lane: the street shot walks the far kerb of the south
  // road, so the bus never passes or idles right beside the lens
  x: -20, z: 28.65, ry: -PI / 2,
  agent: {
    maxSpeed: 7, length: 10,
    plans: [{ id: 'line', spawn: { x: -20, z: 28.65, yaw: -PI / 2 }, steps: [
      { do: 'wait', t: [6, 9], label: '到站上下客' },
      { do: 'say', text: '12 路，开往城北', t: 2.5, chance: 0.5 },
      // one loop round the block (anticlockwise), through all three signalised junctions
      { do: 'drive', to: 'bS', through: ['rSW', 'rNW', 'rNE', 'rSE'], public: true }
    ] }]
  }
}

export const city = [...Array.from({ length: 9 }, (_, i) => ped(i)), ...Array.from({ length: 10 }, (_, i) => car(i)), bus]
