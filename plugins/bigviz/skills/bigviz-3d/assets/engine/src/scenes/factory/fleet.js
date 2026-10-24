// Factory pack - machines with plans: two bridge cranes (coil feed / truck unloading, die
// change), 12 AGVs on the one-way loop (feed, out, press, FG, tote tasks + charging),
// 4 forklifts (FG put-away, dock loading, press racks, reach truck high levels), trucks.

import { RUNWAY, AGV_NODES, CHARGERS, RACK, SLOTS, COIL_POOL, UNCOILER, SOUTH_ROAD } from './layout.js'

const PI = Math.PI
const hasVis = (c, id) => c.world.get(id)?.object3d.visible
const show = (c, id, v) => { const e = c.world.get(id); if (e) e.object3d.visible = v }

// ---------------------------------------------------------------- bridge cranes
// crane-local: bx = world x, tz = world z - RUNWAY.z, hy = hook block height above the floor
const tz = (z) => z - RUNWAY.z
const HY = { travel: 9.6, coilStore: 2.8, mandrel: 3.4, truck: 3.85, dieStore: 4.25, dieBolster: 4.5 }
const move = (bx, z, extra = {}) => ({
  do: 'tween', set: { bx, tz: tz(z) }, label: '大车 / 小车运行', ...extra,
  t: (c, e) => Math.max(3, Math.abs((typeof bx === 'function' ? bx(c, e) : bx) - (e.agent.bx ?? 0)) / 1.1 + 1.5, Math.abs(tz(z) - (e.agent.tz ?? 0)) / 0.6 + 1)
})
const hook = (hy, label) => ({ do: 'tween', set: { hy }, t: (c, e) => Math.max(2, Math.abs(hy - (e.agent.hy ?? 9)) / 0.9), label })
const attach = (payload, fn) => ({ do: 'call', fn: (c, e) => { e.agent.payload = payload; fn?.(c, e); return true } })
const hold = (t, label) => ({ do: 'wait', t, label })

/** next visible / hidden pool coil (crane 1 picks / drops in the storage row) */
const poolPick = (c) => Math.max(0, COIL_POOL.findIndex((_, i) => hasVis(c, `coil-pool-${i}`)))
const poolDrop = (c) => Math.max(0, COIL_POOL.findIndex((_, i) => !hasVis(c, `coil-pool-${i}`)))
const TRUCK_X = [-84.3, -81.9, -79.5]

const crane1 = {
  id: 'crane-1', prefab: 'bridgeCrane', name: '1# 桥式起重机 20 t (钢卷)', x: 0, z: RUNWAY.z,
  info: { role: '起重 · 钢卷上料 / 卸车', desc: '从钢卷库吊运钢卷到开卷机；卸货车进场时优先卸车。', ring: 6 },
  agent: {
    init: { bx: -60, tz: 0, hy: HY.travel, payload: null }, bx: -60, tz: 0, hy: HY.travel,
    plans: [
      { id: 'unload', preempt: true, interruptible: false, when: { var: { 'coil.truck': [1, 9] } }, steps: [
        hook(HY.travel, '升钩'),
        { repeat: 3, steps: [
          { do: 'set', agent: { k: (c) => 3 - c.world.getVar('coil.truck') } },
          move((c, e) => TRUCK_X[e.agent.k] ?? -82, -24), hook(HY.truck, '落钩 · 卸车'), hold(2.5, '挂钩'),
          attach('coil', (c) => c.world.addVar('coil.truck', -1)), hook(HY.travel, '起吊'),
          { do: 'set', agent: { k: (c) => poolDrop(c) } },
          move((c, e) => COIL_POOL[e.agent.k], -20), hook(HY.coilStore, '落钩 · 入库'), hold(2, '摘钩'),
          attach(null, (c, e) => show(c, `coil-pool-${e.agent.k}`, true)), hook(HY.travel, '起钩')
        ] },
        { do: 'log', text: '钢卷卸车完成 3 卷入库', icon: '◎' }
      ] },
      { id: 'feed', steps: [
        { do: 'waitVar', var: 'coil.feed', max: 0.35, timeout: 160, label: '待命' },
        { do: 'set', agent: { k: (c) => poolPick(c) } },
        move((c, e) => COIL_POOL[e.agent.k], -20), hook(HY.coilStore, '落钩 · 取卷'), hold(2.5, '挂钩'),
        attach('coil', (c, e) => show(c, `coil-pool-${e.agent.k}`, false)), hook(HY.travel, '起吊'),
        move(UNCOILER.x, UNCOILER.z), hook(HY.mandrel, '上卷 · 对中'), hold(3, '穿芯轴'),
        attach(null, (c) => { c.world.setVar('coil.feed', 1); show(c, 'coil-feed', true) }), hook(HY.travel, '起钩'),
        { do: 'log', text: '开卷机上卷完成', icon: '◎' },
        move(-62, -26), hold([8, 20], '待命'),
        // keep the storage row populated (re-stock from row 1 when the pool runs low)
        { do: 'call', fn: (c) => { if (COIL_POOL.every((_, i) => !hasVis(c, `coil-pool-${i}`))) show(c, 'coil-pool-0', true); return true } }
      ] }
    ]
  }
}

// die change at 09:30: old die P3 bolster -> storage, new die storage -> bolster
const BOLSTER = { x: 10, z: -26 + 5.2 }
const crane2 = {
  id: 'crane-2', prefab: 'bridgeCrane', name: '2# 桥式起重机 20 t (模具)', x: 0, z: RUNWAY.z,
  info: { role: '起重 · 模具更换', desc: '09:30 冲压线 P3 换模：移动台车开出后吊走旧模、吊入新模。', ring: 6 },
  agent: {
    init: { bx: 60, tz: tz(-30), hy: HY.travel, payload: null }, bx: 60, tz: tz(-30), hy: HY.travel,
    plans: [
      { id: 'dieChange', preempt: true, interruptible: false, when: { hour: [9.5, 9.95], var: { 'die.done': [0, 0] } }, steps: [
        { do: 'log', text: 'P3 开始换模 (SMED)', icon: '⚙' },
        hook(HY.travel, '升钩'), move(BOLSTER.x, -18.6),
        { do: 'set', var: { 'die.roll': 1 } },
        { do: 'waitVar', var: 'die.rolled', min: 0.99, timeout: 120, label: '等待台车开出' },
        move(BOLSTER.x, BOLSTER.z), hook(HY.dieBolster, '落钩 · 挂旧模'), hold(4, '挂吊具'),
        attach('die', (c) => show(c, 'p3-lowdie', false)), hook(HY.travel, '起吊旧模'),
        move(BOLSTER.x, -18.6), move(64, -18.6), move(64, -30), hook(HY.dieStore, '落钩 · 旧模入库'), hold(3, '摘钩'),
        attach(null, (c) => show(c, 'die-old', true)), hook(HY.travel, '起钩'),
        move(70, -30), hook(HY.dieStore, '落钩 · 挂新模'), hold(4, '挂吊具'),
        attach('die', (c) => show(c, 'die-new', false)), hook(HY.travel, '起吊新模'),
        move(70, -18.6), move(BOLSTER.x, -18.6), move(BOLSTER.x, BOLSTER.z), hook(HY.dieBolster, '落钩 · 新模就位'), hold(4, '摘钩'),
        attach(null, (c) => show(c, 'p3-lowdie', true)), hook(HY.travel, '起钩'), move(BOLSTER.x, -18.6),
        { do: 'set', var: { 'die.roll': 0 } },
        { do: 'waitVar', var: 'die.rolled', max: 0.01, timeout: 120, label: '台车复位' },
        { do: 'set', var: { 'die.done': 1 } },
        { do: 'log', text: 'P3 换模完成，冲压线恢复生产', icon: '✔' },
        move(60, -30)
      ] },
      { id: 'idle', steps: [
        { choose: [
          [move(66, -22), hook(5.5, '巡检吊具'), hold([4, 8], '待命'), hook(HY.travel, '起钩')],
          [move(58, -30), hold([6, 12], '待命')],
          [move(44, -18.6), hold([5, 10], '待命')]
        ] }
      ] }
    ]
  }
}
// ---------------------------------------------------------------- AGVs
const N = AGV_NODES
const stop = (t, label, set = {}) => ({ do: 'wait', t, label, ...set })
const pick = [{ do: 'set', agent: { ledState: 'load' } }, { do: 'tween', set: { lift: 1 }, t: 1.4, label: '顶升料车' }, { do: 'set', agent: { loaded: true, ledState: null } }]
const drop = [{ do: 'set', agent: { ledState: 'load' } }, { do: 'tween', set: { lift: 0 }, t: 1.4, label: '放下料车' }, { do: 'set', agent: { loaded: false, ledState: null } }]
const go = (to, label) => ({ do: 'drive', to, speed: 1.4, label: label || `前往 ${to}` })
const ROUTES = {
  feed: [go('aTote', '空车 → 料箱超市'), ...pick, stop([2, 4], '装料'), go('aFeed', '送料 → 焊装上件'), ...drop, stop([2, 4], '卸料')],
  out: [go('aOut', '空车 → 焊装下件'), ...pick, stop([2, 4], '装件'), go('aFG', '送件 → 成品交接'), ...drop, stop([2, 4], '交接')],
  press: [go('aPress', '空车 → 冲压线尾'), ...pick, stop([2, 4], '装冲压件'), go('aFeed', '送件 → 焊装上件'), ...drop],
  tote: [go('aFG', '空车 → 成品区'), ...pick, go('aTote', '空箱 → 料箱超市'), ...drop, stop([2, 5], '回收空箱')]
}
const chargeSteps = (k) => [
  { do: 'drive', to: 'aTote', speed: 1.4, label: '低电量 → 充电区' },
  { do: 'lock', key: `chg.${k}`, label: '等待充电桩' },
  { do: 'path', points: [{ x: CHARGERS[k][0] + 2, z: 15.6 }, { x: CHARGERS[k][0] + 0.6, z: 16.6 }, { x: CHARGERS[k][0], z: CHARGERS[k][1] - 1.2 }, { x: CHARGERS[k][0], z: CHARGERS[k][1] }], speed: 0.8, label: '驶入充电桩' },
  { do: 'set', agent: { ledState: 'charge' } },
  { do: 'call', fn: (c, e, dt) => { e.agent.battery = Math.min(1, e.agent.battery + dt * 0.016); e.agent.label = `充电中 ${Math.round(e.agent.battery * 100)}%`; return e.agent.battery >= 0.96 } },
  { do: 'set', agent: { ledState: null } },
  { do: 'path', points: [{ x: CHARGERS[k][0], z: 15.6 }], speed: 0.7, reverse: true, label: '退出充电桩' },
  { do: 'unlock', key: `chg.${k}` },
  { do: 'face', yaw: -PI / 2, rate: 1.5, label: '原地转向' }
]
const MIX = ['feed', 'out', 'press', 'feed', 'out', 'tote', 'feed', 'press', 'out', 'tote', 'feed', 'out']
// start points spread around the loop (node, yaw along the loop)
const SPAWN = [['aW', 0], ['aMid', PI / 2], ['aOut', PI / 2], ['aN1', PI / 2], ['aPress', PI / 2], ['aNE', 0], ['aFG', 0], ['aSE', -PI / 2], ['aTote', -PI / 2], ['aS', -PI / 2], ['aSW', PI], ['aFeed', PI / 2]]
const yawOf = (n, y) => y

export const agvs = MIX.map((kind, i) => {
  const [node, yaw] = SPAWN[i]
  const [x, z] = N[node]
  const off = i === 0 ? -6 : i === 11 ? 0 : 0
  return {
    id: `agv-${i + 1}`, prefab: 'agv', name: `AGV-${String(i + 1).padStart(2, '0')}`, x: x + (node === 'aW' ? 0 : 0), z: z + off, ry: yawOf(node, yaw),
    params: { seed: i + 3 }, tags: ['agv'],
    info: { role: `潜伏顶升 AGV · ${{ feed: '焊装上件', out: '焊装下件', press: '冲压件转运', tote: '空箱回收' }[kind]}`, desc: '激光 SLAM 导航，地面黄线为 AGV 专用通道；电量低于 25% 自动回充。', ring: 2 },
    agent: {
      kind: 'vehicle', length: 1.8, maxSpeed: 1.4, battery: 0.3 + ((i * 37) % 70) / 100, lift: 0, loaded: false,
      init: { lift: 0, loaded: false, ledState: null },
      plans: [
        { id: 'charge', preempt: true, interruptible: false, when: { test: (c, e) => e.agent.battery < 0.25 && !e.agent.loaded }, steps: chargeSteps(i % CHARGERS.length) },
        { id: kind, steps: ROUTES[kind] }
      ]
    }
  }
})

// ---------------------------------------------------------------- forklifts
const P = (x, z) => ({ x, z })
const lift = (v, t = 2.5, label = '起升货叉') => ({ do: 'tween', set: { lift: v }, t, label })
const FL = { stage: P(55.4, -6), lane: RACK.laneX }
/** put-away into a rack slot entity from the AGV handover stack, then return */
function putAway(s, maxLift, ST = FL.stage, home = -4, stageId = 'fg-stage') {
  const r = RACK.rows[s.r]
  const a = RACK.aisles[s.aisle]
  const x = RACK.x - (RACK.bays * RACK.bay) / 2 + s.i * RACK.bay + 0.75 + s.k * 1.3
  // forks point along local +z: face the rack row, stand 2.1 m (fork load centre) short of it
  const dir = r < a ? -1 : 1
  const face = dir < 0 ? PI : 0
  const stand = r - dir * 2.1
  const h = (s.l * RACK.lh + 0.02) / maxLift
  const up = 0.12 / maxLift
  return [
    { do: 'path', points: [P(FL.lane, home), P(FL.lane, ST.z)], speed: 2, label: '前往交接位' },
    { do: 'face', yaw: -PI / 2, rate: 1.2 },
    lift(0.0, 0.5),
    { do: 'path', points: [P(ST.x + 2.1, ST.z)], speed: 0.6, label: '叉取托盘' },
    { do: 'call', fn: (c) => { show(c, stageId, false); return true } }, { do: 'set', agent: { loaded: true } }, lift(up, 1.2),
    { do: 'path', points: [P(FL.lane, ST.z)], speed: 0.7, reverse: true, label: '倒车' },
    { do: 'call', fn: (c) => { show(c, stageId, true); return true } },
    { do: 'path', points: [P(FL.lane, a), P(FL.lane + 2, a), P(x, a)], speed: 2.2, label: '入库 · 巷道行驶' },
    { do: 'face', yaw: face, rate: 1.1, label: '对准货位' },
    lift(h + up, 2 + h * 6, '起升至货位'),
    { do: 'path', points: [P(x, stand)], speed: 0.4, label: '前移入位' },
    lift(h, 0.8, '放货'),
    { do: 'set', agent: { loaded: false } }, { do: 'call', fn: (c) => { show(c, s.id, true); return true } },
    { do: 'path', points: [P(x, a)], speed: 0.4, reverse: true, label: '退出货位' },
    lift(0.0, 2 + h * 6, '货叉下降'),
    { do: 'face', yaw: -PI / 2, rate: 1.1 },
    { do: 'path', points: [P(FL.lane + 2, a), P(FL.lane, a + (a < ST.z ? 1 : -1) * 0.5)], speed: 2, label: '返回' },
    { do: 'wait', t: [4, 10], label: '待命' },
    // outbound: take it back out (slot cycles) and bring it to dock staging
    { do: 'path', points: [P(FL.lane + 2, a), P(x, a)], speed: 2.2, label: '出库 · 巷道行驶' },
    { do: 'face', yaw: face, rate: 1.1 }, lift(h, 2 + h * 6), { do: 'path', points: [P(x, stand)], speed: 0.4 },
    lift(h + up, 0.8, '取货'), { do: 'set', agent: { loaded: true } }, { do: 'call', fn: (c) => { show(c, s.id, false); return true } },
    { do: 'path', points: [P(x, a)], speed: 0.4, reverse: true }, lift(up, 2 + h * 6),
    { do: 'face', yaw: -PI / 2, rate: 1.1 },
    { do: 'path', points: [P(FL.lane + 2, a), P(FL.lane, a), P(FL.lane, 10.5), P(60, 13.5), P(66, 26)], speed: 2.2, label: '出库 → 发货暂存' },
    lift(0.0, 1), { do: 'set', agent: { loaded: false } },
    { do: 'path', points: [P(64, 22)], speed: 0.7, reverse: true },
    { do: 'path', points: [P(60, 13.5), P(FL.lane, 10.5), P(FL.lane, home)], speed: 2.2, label: '返回' }
  ]
}

const forklift = (id, name, x, z, ry, steps, reach = false, role = '') => ({
  id, prefab: reach ? 'reachTruck' : 'eForklift', name, x, z, ry, params: { seed: id.length * 7 },
  info: { role, desc: '电动叉车，蓝色警示灯投射在行驶方向地面。', ring: 2.5 },
  agent: { kind: 'vehicle', length: 3.2, lift: 0, init: { lift: 0, loaded: false }, plans: [{ id: 'work', steps }] }
})
export const forklifts = [
  forklift('fl-1', '叉车 FL-01', FL.lane, -4, PI, [...putAway(SLOTS_OF('fl-1')[0], 3.2), ...putAway(SLOTS_OF('fl-1')[1], 3.2)], false, '成品入库 · 低位'),
  forklift('fl-4', '前移式叉车 RT-01', FL.lane, 4, PI, [...putAway(SLOTS_OF('fl-4')[0], 8.2, P(55.4, 3), 4, 'fg-stage2'), { do: 'wait', t: [6, 12] }, ...putAway(SLOTS_OF('fl-4')[1], 8.2, P(55.4, 3), 4, 'fg-stage2')], true, '成品入库 · 高位'),
  forklift('fl-2', '叉车 FL-02', 70, 24, PI, [
    { do: 'path', points: [P(70, 27.5)], speed: 1.2, label: '前往暂存区' }, lift(0.06, 1.2), { do: 'set', agent: { loaded: true } },
    { do: 'path', points: [P(70, 24)], speed: 0.8, reverse: true }, { do: 'face', yaw: 0, rate: 1.2 },
    { do: 'path', points: [P(70, 33.5)], speed: 1.4, label: '装车 · 月台 2' }, lift(0.02, 1), { do: 'set', agent: { loaded: false } }, { do: 'wait', t: 2, label: '装车' },
    { do: 'path', points: [P(70, 27)], speed: 1, reverse: true, label: '倒车' }, { do: 'face', yaw: PI, rate: 1.2 },
    { do: 'path', points: [P(62, 24), P(62, 27.5)], speed: 1.4, label: '前往暂存区' }, lift(0.06, 1.2), { do: 'set', agent: { loaded: true } },
    { do: 'path', points: [P(62, 24)], speed: 0.8, reverse: true }, { do: 'face', yaw: 0, rate: 1.2 },
    { do: 'path', points: [P(62, 33.5)], speed: 1.4, label: '装车 · 月台 1' }, lift(0.02, 1), { do: 'set', agent: { loaded: false } }, { do: 'wait', t: 2, label: '装车' },
    { do: 'path', points: [P(62, 27)], speed: 1, reverse: true, label: '倒车' }, { do: 'face', yaw: PI, rate: 1.2 },
    { do: 'path', points: [P(70, 24)], speed: 1.4 }, { do: 'wait', t: [3, 8], label: '待命' }
  ], false, '月台装车'),
  forklift('fl-3', '叉车 FL-03', 56, -18, -PI / 2, [
    { do: 'path', points: [P(53.5, -18.2), P(52.2, -21.6)], speed: 1.2, label: '前往线尾料架' }, lift(0.04, 1), { do: 'set', agent: { loaded: 'rack' } },
    { do: 'path', points: [P(53.5, -18.2)], speed: 0.8, reverse: true, label: '倒车' },
    { do: 'path', points: [P(62, -18.2), P(70, -18.6), P(72, -21.5)], speed: 1.8, label: '料架 → 缓存区' }, lift(0, 1), { do: 'set', agent: { loaded: false } },
    { do: 'path', points: [P(72, -18.4)], speed: 0.8, reverse: true }, { do: 'face', yaw: -PI / 2, rate: 1.2 },
    { do: 'path', points: [P(62, -18.2), P(56, -18)], speed: 1.8, label: '返回' }, { do: 'wait', t: [10, 20], label: '待命' }
  ], false, '冲压件料架转运')
]
function SLOTS_OF(fl) { return SLOTS.filter((s) => s.fl === fl) }
// ---------------------------------------------------------------- trucks
const RS = SOUTH_ROAD
/** reverse from the westbound lane east of a dock onto it (rear first, facing south when parked) */
const dockIn = (x) => [
  { do: 'drive', to: 'rS1', then: [P(x + 14, RS - 2)], speed: 6, label: '驶向月台' },
  { do: 'reverse', path: [P(x + 6, RS - 3.5), P(x + 1.5, RS - 6.5), P(x, RS - 10), P(x, 42.2)], speed: 1.4, say: '倒车，请注意' }
]
export const trucks = [
  {
    id: 'coil-truck', prefab: 'coilTruck', name: '钢卷运输车 沪A·5K217', x: -112, z: 0, ry: PI / 2,
    info: { role: '原料进厂 · 热轧钢卷', desc: '经西大门进入钢卷库，1# 行车卸车入库。', ring: 6 },
    agent: {
      kind: 'vehicle', length: 11, maxSpeed: 7, cargo: 3, init: { cargo: 3 }, spawn: { x: -112, z: 0, yaw: PI / 2, hidden: true },
      plans: [{ id: 'deliver', stagger: 30, steps: [
        { do: 'hide' }, { do: 'set', agent: { cargo: 3 } }, { do: 'wait', t: [20, 60], label: '在途' },
        { do: 'roadEnter', at: 'offW' }, { do: 'show' },
        { do: 'drive', to: 'coilBay', speed: 5, label: '进厂 · 钢卷库' },
        { do: 'set', var: { 'coil.truck': 3 } }, { do: 'log', text: '钢卷车到达钢卷库，等待卸车', icon: '🚚' },
        { do: 'waitVar', var: 'coil.truck', max: 0, timeout: 400, label: '卸车中' },
        { do: 'set', var: { 'coil.truck': 0 } },
        { do: 'reverse', path: [P(-92, -24)], speed: 1.6 },
        { do: 'drive', to: 'offW', via: [P(-96, -16)], speed: 6, label: '离厂' },
        { do: 'hide' }, { do: 'wait', t: [240, 420], label: '下一车' }
      ] }]
    }
  },
  ...[[2, 70, 'boxTruck', '成品运输车 沪B·D3391', 10], [1, 62, 'boxTruck', '成品运输车 苏E·77K02', 140]].map(([n, x, prefab, name, delay]) => ({
    id: `box-${n}`, prefab, name, x: 0, z: 92, ry: PI, params: { band: n === 1 ? '#c23b2e' : '#2f5d8c' },
    info: { role: `成品发运 · 月台 ${n}`, desc: '倒车靠台，叉车装车后驶离。', ring: 6 },
    agent: {
      kind: 'vehicle', length: 9.6, maxSpeed: 7, spawn: { x: 0, z: 92, yaw: PI, hidden: true },
      plans: [{ id: 'ship', steps: [
        { do: 'hide' }, { do: 'wait', t: [delay, delay + 40], label: '在途' },
        { do: 'roadEnter', at: 'offS' }, { do: 'show' },
        ...dockIn(x), { do: 'log', text: `${name} 靠台月台 ${n}`, icon: '🚚' },
        { do: 'wait', t: [90, 150], label: '装车中' },
        { do: 'drive', to: 'offS', via: [P(x, RS - 2)], speed: 5, label: '离厂' },
        { do: 'hide' }, { do: 'wait', t: [200, 360], label: '下一车' }
      ] }]
    }
  })),
  {
    id: 'van-1', prefab: 'car', name: '访客面包车', x: 0, z: 92, ry: PI, params: { type: 'van', color: '#eef0ee' },
    info: { role: '访客 / 快递', ring: 3 },
    agent: {
      kind: 'vehicle', length: 5.2, maxSpeed: 8, spawn: { x: 0, z: 92, yaw: PI, hidden: true },
      plans: [{ id: 'visit', steps: [
        { do: 'hide' }, { do: 'wait', t: [60, 180] }, { do: 'roadEnter', at: 'offS' }, { do: 'show' },
        { do: 'drive', to: 'rS0', then: [P(-30, RS - 2), P(-60, RS - 2)], speed: 7, label: '前往办公区' },
        { do: 'wait', t: [40, 80], label: '停靠' },
        { do: 'drive', to: 'offS', speed: 7, label: '离厂' }, { do: 'hide' }
      ] }]
    }
  }
]
