// Scene pack: 筑城之间 · Living Construction
// A 16-day build of a 12-storey tower on an architect's desk. Everything here is data:
// layout, props, entities with plans, progress curves, milestones, shots, storyboards.

import * as THREE from 'three'
import { registerPrefab } from '../../prefabs/index.js'
import { mat } from '../../render/materials.js'
import { box, cone, group } from '../../prefabs/kit.js'
import { BOARD, BLDG, terrain, ground, roads, places, SIDEWALK_OUT } from './layout.js'
import { props, buckets } from './props.js'
import { fleet } from './fleet.js'
import { crew } from './crew.js'
import { city } from './city.js'
import { shots, storyboards, autoDirector } from './shots.js'
import { SCENE_DEVICES } from './devices.js'

const PI = Math.PI

// a concrete skip standing on the ground (shown while the crane is not carrying it)
registerPrefab('cargoSkip', {
  kind: 'prop',
  make: () => {
    const c = cone(0.9, 1.6, mat('paint.grey'), { y: 1.25, rx: PI })
    return { object: group(c, box(1.6, 0.12, 1.6, mat('steel.dark'), { y: 0.06 })), rig: {} }
  }
})

// ---------------------------------------------------------------- entities
const building = {
  id: 'tower', prefab: 'building', name: 'ZC TOWER 主楼', x: BLDG.x, z: BLDG.z,
  params: { w: BLDG.w, d: BLDG.d, floors: 12, fh: 3.3, seed: 4, scaffoldSides: [0, 1, 2] },
  info: { role: '主体结构 · 12 层', desc: '立柱 → 支模 → 绑筋 → 浇筑 → 养护，逐层上升；外墙与窗户滞后两层跟进。', ring: 16 }
}

const fencePts = [{ x: -35, z: -23 }, { x: 35, z: -23 }, { x: 35, z: 23 }, { x: -35, z: 23 }, { x: -35, z: -23 }]
const fence = {
  id: 'fence', prefab: 'fence', name: '施工围挡', params: { points: fencePts, gaps: [{ x: -1.5, z: 23, r: 4.4 }, { x: -35, z: 12.5, r: 4.4 }] },
  info: { role: '围挡 · 2.3 m' },
  drive: { 'rig.setRemoved': [[15.55, 0], [15.95, 1]] }
}

const streetTrees = []
// (north row keeps clear of the signalised crossings at rN; the south row stands on the shop
// side of the walk, z 38.8, behind the street-shot lens line z 36 - see props.js)
for (let x = -42; x <= 42; x += 12) for (const z of [-34.6, 38.8]) if (Math.abs(x + 1.5) > 6 && Math.abs(x + 20) > 4 && (z > 0 || Math.abs(x) > 11)) streetTrees.push([x, z])
for (let z = -24; z <= 24; z += 12) for (const x of [-46.6, 46.6]) if (Math.abs(z) > 5) streetTrees.push([x, z])
const trees = [
  // (south row capped at 6 m so the canopy stays clear of the shop fronts at z 40.5)
  ...streetTrees.map(([x, z], i) => ({ id: `tree-${i}`, prefab: 'tree', x, z, params: { kind: i % 5 === 0 ? 'cone' : 'round', h: Math.min(z > 0 ? 6 : 9, 5 + (i % 3)), seed: i + 3 }, info: false })),
  ...[[-28, -4], [-24, 4], [-30, 6], [20, -10], [26, -4], [18, -2], [-14, 18], [8, 18], [24, 14], [-28, 16]].map(([x, z], i) => ({
    id: `ptree-${i}`, prefab: 'tree', x, z, params: { kind: i % 3 === 0 ? 'tall' : 'round', h: 4 + (i % 3), seed: 40 + i }, info: false,
    life: { windows: [[15.75 + i * 0.02, Infinity]], enter: 'grow', dur: 0.12 }
  })),
  ...[[-40, 40], [-30, 40], [20, 40], [34, 40]].map(([x, z], i) => ({ id: `stree-${i}`, prefab: 'shrub', x, z, params: { seed: 70 + i, r: 0.9 }, info: false }))
]

const parked = [[-27.4, 42, 0, '#c9392b'], [-24.7, 42, 0, '#eef0ee'], [-19.3, 42, 0, '#2f66b3'], [-13.9, 42, 0, '#2b2f35'], [24.3, 42, 0, '#4f8c6a'], [29.7, 42, 0, '#e8b23a'], [-27.3, -21.6, PI, '#8b9197'], [-24.7, -21.6, PI, '#2f66b3']]
  .map(([x, z, ry, color], i) => ({ id: `parked-${i}`, prefab: 'car', x, z, ry, params: { color, type: i === 3 ? 'van' : 'sedan' }, info: { role: '停放车辆' } }))

// ---------------------------------------------------------------- progress (continuous curves over days)
const progress = {
  target: 'tower',
  curves: {
    found: [[2.35, 0], [3.0, 1]],
    floors: [[3.0, 0], [3.35, 1], [4.2, 2], [5.0, 2.55], [5.8, 4], [6.6, 5], [7.4, 6], [8.2, 6.9], [9.0, 8], [9.8, 9], [10.6, 10], [11.3, 11], [12.0, 12]],
    facade: [[7.6, 0], [8.4, 1.5], [10, 5], [12, 9], [13.5, 12]],
    windows: [[8.0, 0], [9, 1.5], [10.5, 4.5], [12.5, 9], [14.2, 12]],
    scaffold: [[4.8, 0], [5.2, 3], [12, 12], [13.0, 12], [15.2, 0]],
    lit: [[12, 0], [14, 0.6], [16, 1]],
    roof: [[11.95, 0], [12.0, 1]],
    lobby: [[15.4, 0], [15.45, 1]]
  },
  events: [
    { day: 1.02, text: '挖掘机进场，开始地基开挖', icon: '⛏', shot: 'site' },
    { day: 2.4, text: '泵车进场，浇筑基础筏板', icon: '◆', shot: 'pour' },
    { day: 2.95, text: '塔吊安装', icon: '⊤', shot: 'crane' },
    { day: 3.35, text: '第一层完成', icon: '▤', shot: 'orbit' },
    { day: 4.35, text: '施工电梯安装完成', icon: '⇅', shot: 'hoist' },
    { day: 5.0, text: '第三层施工，工人增加到 12 人', icon: '👷', shot: 'deck' },
    { day: 5.2, text: '脚手架出现 · 改为塔吊料斗浇筑', icon: '▦', shot: 'pour' },
    { day: 8.0, text: '第六层 · 开始安装窗户与外墙', icon: '▢', shot: 'yard' },
    { day: 12.0, text: '主体封顶', icon: '★', shot: 'orbit' },
    { day: 12.2, text: '塔吊开始拆除', icon: '⊤', shot: 'overview' },
    { day: 13.2, text: '外墙基本完成，脚手架拆除', icon: '▦', shot: 'orbit' },
    { day: 15.55, text: '围挡拆除', icon: '▭', shot: 'street' },
    { day: 15.75, text: '绿化出现 · 路灯安装', icon: '🌳', shot: 'street' },
    { day: 16.2, text: '建筑正式完工', icon: '🎉', shot: 'overview' }
  ]
}

const timeline = {
  keyDays: [
    { day: 1.1, items: ['挖掘机进入', '地基施工', '施工人员 5 人'] },
    { day: 3.1, items: ['塔吊安装', '第一层完成', '混凝土车进入'] },
    { day: 5.1, items: ['第三层施工', '工人增加到 12 人', '脚手架出现'] },
    { day: 8.1, items: ['第六层', '开始安装窗户', '外墙施工'] },
    { day: 12.1, items: ['主体封顶', '塔吊拆除', '外墙基本完成'] },
    { day: 16.25, items: ['围挡拆除', '绿化出现', '路灯安装', '建筑正式完工'] }
  ]
}

// ---------------------------------------------------------------- scene hooks (small glue only)
const hooks = {
  setup(ctx, E) {
    ctx.bus.on('build.floor', ({ floor }) => floor > 0 && E.log(`第 ${floor} 层结构完成`, '▤'))
    ctx.bus.on('build.phase', ({ phase, floor }) => phase === 'pour' && E.log(`第 ${floor} 层楼板开始浇筑`, '◆'))
  },
  jump(ctx, day) {
    ctx.world.setVar('stock.pallet', 8)
    ctx.world.setVar('stock.rebar', 6)
    ctx.world.setVar('dig.load', 0)
  },
  update(ctx, dt, E) {
    const day = ctx.clock.day
    E.env.siteActive = day < 15.75
    E.env.windowsLit = Math.min(1, 0.25 + E.progress.state.lit)
    if (day > 16.2 && dt > 0 && Math.random() < dt * 3) E.fx.emit('confetti', { x: -4 + (Math.random() - 0.5) * 8, y: 5, z: 15.5 }, 4)
  }
}

export default {
  meta: { id: 'construction', title: '筑城之间', subtitle: 'Living Construction · 16 天 · 12 层', eyebrow: 'LIVING DIORAMA · v3', seed: 7, watermark: '筑城之间 · Living Diorama' },
  board: BOARD,
  // 'realistic' (real-scale city, sky, GTAO) | 'diorama' (desk + tilt-shift); ?style= overrides
  style: 'realistic',
  desk: {
    seed: 7,
    plaque: { title: '筑城之间 · ZC TOWER', subtitle: 'Living Construction · Scale 1:200' },
    sheets: [
      { kind: 'plan', title: 'ZC TOWER', code: 'A-101', x: -112, z: -40, rot: 0.08, w: 90, seed: 3 },
      { kind: 'elevation', title: 'ZC TOWER', code: 'A-301', x: 108, z: -46, rot: -0.12, w: 84, seed: 5 },
      { kind: 'site', title: 'SITE PLAN', code: 'G-001', x: -20, z: -112, rot: 0.04, w: 100, seed: 8 },
      { kind: 'plan', title: 'LEVEL 06', code: 'A-106', x: 104, z: 52, rot: 0.16, w: 76, seed: 11, paper: '#21598f' }
    ],
    notes: [
      { lines: ['Day 12 封顶', '塔吊拆除'], x: -78, z: 64, rot: -0.2 },
      { lines: ['周五 浇筑 6F', '料斗 ×2'], x: 76, z: 66, rot: 0.25, color: '#f6a5a5' }
    ]
  },
  clock: { dayStart: 1, dayEnd: 16, secondsPerDay: 40, daylight: 0.72, startDay: 8.45 },
  camera: { home: 'overview', bounds: { x: 60, z: 46 }, minDist: 10, maxDist: 320, colliders: [new THREE.Box3(new THREE.Vector3(BLDG.x - 12.4, -1, -7.4), new THREE.Vector3(BLDG.x + 12.4, 41, 7.4))] },
  terrain, ground, roads, places, props, buckets,
  entities: [building, fence, ...trees, ...parked, ...fleet, ...crew, ...city],
  vars: { 'stock.pallet': 8, 'stock.rebar': 6 },
  progress, timeline, shots, storyboards, autoDirector, hooks,
  twin: SCENE_DEVICES,
  weather: 'clear'
}

export { SIDEWALK_OUT }
