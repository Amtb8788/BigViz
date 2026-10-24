// Construction pack - machines and site vehicles with their work plans.
// Every plan is a real job: arrive through the gate, do the work in coordination with
// other agents (signals), leave. `when.day` windows follow the project schedule.

import { digCycle, mcLift, outriggers, craneCargo, cargoPick, cargoTakeVar, slewTo } from './work.js'

const PI = Math.PI
const W = -PI / 2 // facing west (-x)
const E = PI / 2 // facing east (+x)
const offE = { place: 'offE', yaw: W, hidden: true }
const offW = { place: 'offW', yaw: E, hidden: true }
// enter on the east stub's kerb lane once it is clear (traffic signals / queues apply)
const enterE = (to, via) => [{ do: 'hide' }, { do: 'roadEnter', at: 'offE', clear: 11 }, { do: 'drive', to, ...(via ? { then: via } : {}) }]

// ---------------------------------------------------------------- excavation (day 1 - 2.45)
const excavator = {
  id: 'excavator', prefab: 'excavator', name: '挖掘机 EX-01', x: -4, z: 5, ry: PI,
  info: { role: '土方 · 挖掘机', desc: '基坑开挖，装车外运；无车时就近堆土。', ring: 5 },
  life: { windows: [[1, 2.45]], enter: 'none', exit: 'none' },
  drive: { 'agent.y': (d, c, e) => (e.agent.leaving ? e.agent.y : d < 1.08 ? 0 : -Math.min(2.4, Math.max(0, (d - 1.08) * 1.6))) },
  agent: {
    boom: 0.15, arm: 1.1, bucket: 0.9, slew: 0, init: { leaving: false, full: false },
    plans: [
      { id: 'enter', when: { day: [1, 1.08] }, spawn: { x: -1.5, z: 24, yaw: PI }, interruptible: false, loop: false, steps: [
        { do: 'log', text: '挖掘机进场，开始土方开挖', icon: '⛏' },
        { do: 'path', points: [[-1.5, 16], [-4, 12], [-4, 5]], speed: 2.2, label: '进场' },
        { do: 'face', yaw: PI }
      ] },
      { id: 'leave', when: { day: [2.28, 2.45] }, interruptible: false, loop: false, steps: [
        { do: 'set', agent: { leaving: true } },
        { do: 'tween', set: { boom: 0.15, arm: 1.1, bucket: 0.9, slew: 0 }, t: 2 },
        { do: 'path', points: [[-4, 9]], speed: 1.6, label: '爬坡出坑' },
        { do: 'tween', set: { y: 0 }, t: 3 },
        { do: 'path', points: [[-6, 12.5], [-30, 12.5], [-37, 12.5], [-44, 12.5], [-44, 2]], speed: 3, label: '退场' },
        { do: 'hide' }
      ] },
      { id: 'load', when: { day: [1.08, 2.28], signal: 'truck.atDig' }, spawn: 'excavator', steps: [...digCycle({ x: -3.7, z: 12.5 }, { varName: 'dig.load' })] },
      { id: 'pile', when: { day: [1.08, 2.28] }, spawn: 'excavator', steps: [...digCycle({ x: 6, z: 6 }, { varName: 'dig.pile' }), { do: 'wait', t: [0.5, 2] }] }
    ]
  }
}

const dumpHaul = (delay) => ({
  id: 'haul', when: { day: [1.1, 2.3], notWeather: ['storm'] }, spawn: offE, interruptible: false, stagger: delay, steps: [
    { do: 'hide' }, { do: 'wait', t: [2, 8] }, { do: 'lock', key: 'digBay' },
    ...enterE('hC'),
    { do: 'signal', name: 'truck.atDig' },
    { do: 'say', text: '到位，装车', t: 2.5 },
    { do: 'set', var: { 'dig.load': 0 } },
    { do: 'call', label: '装土中', fn: (c, e, dt, st) => { st.t = (st.t || 0) + dt; e.agent.load = Math.min(1, c.world.getVar('dig.load')); return e.agent.load >= 1 || st.t > 70 } },
    { do: 'clear', name: 'truck.atDig' },
    { do: 'add', var: { 'counter.loads': 1 } },
    { do: 'log', text: '渣土车满载外运', icon: '🚚' },
    { do: 'drive', to: 'gW', stop: false },
    { do: 'unlock', key: 'digBay' },
    { do: 'drive', to: 'offW' },
    { do: 'set', agent: { load: 0 } }, { do: 'hide' }
  ]
})

const debris = {
  id: 'debris', when: { day: [13.2, 15.5] }, spawn: offE, interruptible: false, steps: [
    { do: 'hide' }, { do: 'wait', t: [10, 25] }, ...enterE('hC'),
    { do: 'wait', t: 12, label: '装运建筑垃圾' }, { do: 'set', agent: { load: 0.8 } },
    { do: 'drive', to: 'offW' }, { do: 'set', agent: { load: 0 } }, { do: 'hide' }
  ]
}

const dump1 = { id: 'dump-1', prefab: 'dumpTruck', name: '渣土车 01', params: { cab: 'paint.orange' }, info: { role: '运输 · 渣土车', ring: 5 }, life: { windows: [[1.1, 2.4], [13.2, 15.6]], enter: 'none', exit: 'none' }, agent: { plans: [dumpHaul(0), debris] } }
const dump2 = { id: 'dump-2', prefab: 'dumpTruck', name: '渣土车 02', params: { cab: 'paint.red' }, info: { role: '运输 · 渣土车', ring: 5 }, life: { windows: [[1.1, 2.4]], enter: 'none', exit: 'none' }, agent: { plans: [dumpHaul(18)] } }

// ---------------------------------------------------------------- concrete: mixers -> pump (raft..F3) / crane skip (F4..F12)
const mixerPlans = (delay) => [
  { id: 'rain', when: { day: [2.35, 12.05], weather: ['rain', 'storm'] }, spawn: offE, steps: [{ do: 'hide' }, { do: 'wait', t: 5, label: '雨天暂停浇筑' }] },
  { id: 'pour', when: { day: [2.35, 12.05] }, spawn: offE, interruptible: false, stagger: delay, steps: [
    { do: 'hide' }, { do: 'wait', t: [3, 10] },
    // the pump's run-in drives through the mixer bay: no mixer on site until it is set up
    { do: 'call', label: '等待泵车就位', fn: (c) => c.clock.day >= 5.2 || !!c.world.get('pump')?.agent.parked },
    { do: 'lock', key: 'pourBay' },
    ...enterE('hP'),
    { do: 'signal', name: 'mixer.reversing' },
    { do: 'reverse', path: [[-28.5, 12.8], [-27.2, 14.6], [-26.2, 16.4], [-25.2, 17], [-24.7, 17]], label: '倒车入位' },
    { do: 'set', agent: { discharging: true } },
    { do: 'signal', name: 'mixer.ready' },
    { do: 'say', text: '开始放料', t: 2.5 },
    { do: 'waitFor', signal: 'pour.done', timeout: 70, label: '卸料中' },
    { do: 'set', agent: { discharging: false } },
    { do: 'add', var: { 'counter.pours': 1 } },
    { do: 'drive', via: [[-27, 14.2]], to: 'gW', stop: false },
    { do: 'unlock', key: 'pourBay' },
    { do: 'drive', to: 'offW' }, { do: 'hide' }
  ] }
]
const mixer1 = { id: 'mixer-1', prefab: 'mixer', name: '混凝土搅拌车 01', info: { role: '运输 · 搅拌车', desc: '罐体常转防凝，到位倒车放料。', ring: 5 }, life: { windows: [[2.35, 12.1]], enter: 'none', exit: 'none' }, agent: { maxSpeed: 6.5, plans: mixerPlans(0) } }
const mixer2 = { id: 'mixer-2', prefab: 'mixer', name: '混凝土搅拌车 02', info: { role: '运输 · 搅拌车', ring: 5 }, life: { windows: [[2.35, 12.1]], enter: 'none', exit: 'none' }, agent: { maxSpeed: 6.5, plans: mixerPlans(25) } }

const pump = {
  id: 'pump', prefab: 'pumpTruck', name: '泵车 PB-37', info: { role: '浇筑 · 混凝土泵车', desc: '负责基础筏板至 3 层的楼板浇筑。', ring: 6 },
  life: { windows: [[2.3, 5.4]], enter: 'none', exit: 'none' },
  agent: {
    outrig: 0, deploy: 0, init: { parked: false, arriving: false },
    plans: [
      // (not loop:false: a finished one-shot plan would never hand over to 'work' in continuous play)
      { id: 'arrive', when: { test: (c, e) => e.agent.arriving || (!e.agent.parked && c.clock.day >= 2.3 && c.clock.day < 2.42) }, spawn: offW, interruptible: false, steps: [
        { do: 'set', agent: { arriving: true } },
        // (the run-in crosses the mixer bay: mixers wait for `parked` before taking the pour bay)
        { do: 'hide' }, { do: 'roadEnter', at: 'offW', clear: 11 },
        { do: 'log', text: '泵车进场，准备浇筑基础筏板', icon: '🏗' },
        { do: 'drive', to: 'gW', stop: false }, { do: 'path', points: [[-31, 12.5], [-24, 14.8], [-18, 17], [-14, 17]], speed: 3.5, label: '就位' },
        outriggers(true), { do: 'set', agent: { arriving: false, parked: true } }
      ] },
      { id: 'work', when: { day: [2.3, 5.2] }, spawn: { place: 'pumpBay', yaw: E }, steps: [
        { do: 'set', agent: { outrig: 1, parked: true } },
        { do: 'waitFor', signal: 'mixer.ready', label: '等待搅拌车' },
        { do: 'call', fn: (c, e) => { const p = c.resolve({ pour: true, v: 0.3, maxX: 1 }, e); e.agent.target = { x: p.x, y: p.y, z: p.z }; return true } },
        { do: 'tween', set: { deploy: 1 }, t: 7, label: '展臂' },
        { do: 'pump', t: 26 },
        { do: 'signal', name: 'pour.done' },
        { do: 'log', text: '泵送一车混凝土完成', icon: '◆', chance: 0.4 },
        { do: 'tween', set: { deploy: 0 }, t: 6, label: '收臂' }
      ] },
      { id: 'leave', when: { day: [5.2, 5.4] }, spawn: { place: 'pumpBay', yaw: E }, interruptible: false, loop: false, steps: [
        { do: 'tween', set: { deploy: 0 }, t: 3 }, outriggers(false),
        { do: 'log', text: '泵车退场，改由塔吊料斗浇筑', icon: '🏗' },
        { do: 'path', points: [[-6, 17], [-1.5, 20], [-1.5, 26], [-1.5, 30.75], [20, 32.85], [42, 32.85]], speed: 4, label: '退场' },
        { do: 'hide' }
      ] }
    ]
  }
}

// ---------------------------------------------------------------- tower crane (day 3 - 14.4)
const towerCrane = {
  id: 'tc', prefab: 'towerCrane', name: '塔吊 TC-1', x: 2, z: -15.5, params: { jib: 42, counter: 12, sections: 1 },
  info: { role: '垂直运输 · 塔吊', desc: '吊运钢筋笼、模板、材料托盘与混凝土料斗；随主体升高而加节。', ring: 5 },
  life: { windows: [[2.95, 14.4]], enter: 'rise', exit: 'none', dur: 0.1, h: 3 },
  drive: { 'agent.sections': [[2.95, 1], [3.3, 8], [5.5, 8], [6.5, 10], [8.5, 12], [10.5, 14], [12.2, 14], [13.4, 6], [14.3, 1]] },
  agent: {
    slew: 0.8, trolley: 14, rope: 12,
    plans: [
      { id: 'build', when: { day: [2.95, 3.35] }, steps: [{ do: 'wait', t: 3, label: '塔吊安装中' }] },
      { id: 'storm', when: { day: [3.35, 12.05], weather: ['storm'] }, steps: [{ do: 'tween', set: { rope: 3 }, t: 4 }, { do: 'wait', t: 5, label: '大风停吊 · 自由回转' }] },
      { id: 'skipPour', when: { day: [5.2, 12.05], signal: 'mixer.ready' }, interruptible: false, steps: [
        { do: 'waitFor', signal: 'mixer.ready' },
        { do: 'wait', t: 5, label: '料斗装料' },
        { repeat: 2, steps: [
          { do: 'crane', from: 'skipSpot', to: { pour: true, v: 0.1 }, cargo: 'skip', hookTime: 3, hold: 9, holdFx: 'splash', atPick: 'crane.atSkip', atDrop: 'crane.atPour', keep: true },
          { do: 'crane', carrying: true, to: 'skipSpot', cargo: 'skip', hold: 4, atDrop: 'crane.atSkip' }
        ] },
        { do: 'signal', name: 'pour.done' },
        { do: 'add', var: { 'counter.concrete': 6 } }
      ] },
      { id: 'lift', when: { day: [3.35, 12.05] }, interruptible: false, steps: [
        { do: 'set', var: { nextCargo: (c) => craneCargo(c) } },
        { do: 'crane', from: (c) => cargoPick(c), to: { deck: true, margin: 2.5 }, cargo: (c) => c.world.vars.nextCargo, takeVar: (c) => cargoTakeVar[c.world.vars.nextCargo], hookSignal: 'rig.hooked', unhookSignal: 'rig.unhooked', hookTime: 12, unhookTime: 10 },
        { do: 'wait', t: [1, 4], label: '待命' }
      ] },
      { id: 'dismantle', when: { day: [12.05, 14.4] }, steps: [{ do: 'tween', set: { slew: 0.4, trolley: 6, rope: 4 }, t: 6 }, { do: 'wait', t: 10, label: '塔吊降节拆除中' }] }
    ]
  }
}

// ---------------------------------------------------------------- construction hoist
const hoist = {
  id: 'hoist', prefab: 'hoist', name: '施工电梯 SC-200', x: -18.4, z: 0, ry: E,
  info: { role: '垂直运输 · 施工电梯', desc: '工人上下作业面，随楼层升高加节。', ring: 3 },
  life: { windows: [[4.3, 13.6]], enter: 'rise', exit: 'sink', dur: 0.1, h: 3 },
  drive: { 'agent.mastH': (d, c) => (c.building ? c.building.rig.deckY + 4 : 6) },
  agent: {
    cageY: 0, cageState: 'ground',
    plans: [{ id: 'run', steps: [
      { do: 'set', agent: { cageState: 'moving' } },
      { do: 'tween', set: { cageY: 0 }, t: (c, e) => 2 + e.agent.cageY * 0.25, label: '下行' },
      { do: 'set', agent: { cageState: 'ground' } },
      { do: 'wait', t: [5, 9], label: '地面候梯' },
      { do: 'set', agent: { cageState: 'moving' } },
      { do: 'tween', set: { cageY: (c) => c.building.rig.deckY }, live: true, t: (c) => 2 + c.building.rig.deckY * 0.25, label: '上行' },
      { do: 'set', agent: { cageState: 'top' } },
      { do: 'wait', t: [4, 7], label: '作业层停靠' }
    ] }]
  }
}

// ---------------------------------------------------------------- mobile crane: TC assembly, facade panels, TC dismantle
// The crane and the flatbed share the x=13.5 yard lane and the east haul road (hS - hE); the
// crane park (z -18.5..-7.5) and the flatbed stop (z -6.7..2.7) are disjoint, but the crane's
// run-in / run-out passes the flatbed stop. One `yardLane` lock: held by the flatbed from its
// entry until it has left the east haul road (hP) - i.e. while it is on the lane or parked at
// the stop - and by the crane for each transit (entry -> park, park -> hP). So the crane never
// drives through a parked or moving flatbed. The flatbed only takes the lock if its whole visit
// fits before the next crane transit (crane jobs have priority; see flatbedMayGo).
// Two visits: J1 tower-crane assembly, J2 facade panels + tower-crane dismantle (one stay).
// arrive: [start, work start]  leave: [work end, latest expected exit] (sim days; a site transit
// takes ~1.1-1.6 days incl. the east-stub signal, so arrivals start early and wait parked)
const MC_JOBS = [{ arrive: [1.3, 2.95], leave: [3.42, 5.6] }, { arrive: [6.4, 8.1], leave: [13.5, 15.5] }]
const inWin = (d, [a, b]) => d >= a && d < b
const laneLock = { do: 'lock', key: 'yardLane', label: '等待场内通道' }
const laneUnlock = { do: 'unlock', key: 'yardLane' }
const mcArrive = { id: 'arrive', when: { test: (c, e) => e.agent.arriving || (!e.agent.parked && MC_JOBS.some((j) => inWin(c.clock.day, j.arrive))) }, spawn: offE, interruptible: false, steps: [
  { do: 'hide' }, { do: 'set', agent: { arriving: true } },
  laneLock,
  ...enterE('hE'), { do: 'path', points: [[13.5, 4], [13.5, -6], [13.5, -13]], speed: 3, label: '进场就位' },
  laneUnlock,
  outriggers(true), { do: 'set', agent: { parked: true, arriving: false } }
] }
const mcLeave = { id: 'leave', when: { test: (c, e) => e.agent.leaving || (e.agent.parked && MC_JOBS.some((j) => inWin(c.clock.day, j.leave))) }, interruptible: false, steps: [
  { do: 'set', agent: { leaving: true } },
  { do: 'tween', set: { slew: 0, luff: 0.05, ext: 0, rope: 4 }, t: 4 },
  laneLock,
  outriggers(false),
  // the lane is ours by the lock (the forklift bay beside it would read as a blocker)
  { do: 'reverse', path: [[13.5, -2], [13.5, 8], [14, 12.2], [17, 13.5]], say: false, ignoreTraffic: true, label: '倒车退场' },
  { do: 'drive', via: [[13, 12.5]], to: 'hP', stop: false, public: false },
  laneUnlock,
  { do: 'drive', to: 'offW', public: false }, { do: 'hide' },
  { do: 'set', agent: { parked: false, leaving: false } }
] }
// work plans re-seat at the park spot after a timeline jump (parked is reset by init)
const mcWork = (id, day, steps) => ({ id, when: { day }, spawn: { place: 'mcPark', yaw: PI }, steps: [{ do: 'set', agent: { outrig: 1, parked: true } }, ...steps] })
/** flatbed holds the lane ~4 days (measured: east-stub entry queue ~0.7, run-in ~0.5, 4 forklift
 *  cycles ~1.8, run-out to hP ~0.8). It may start only if that cannot overlap a crane transit
 *  window; an arrival window no longer counts once the crane is parked. Checked and locked in
 *  one step (no gap between the check and the lock). */
const FLATBED_VISIT = 4.2
const flatbedMayGo = (c) => {
  const day = c.clock.day
  const parked = c.world.get('mc')?.agent.parked
  return !MC_JOBS.some(({ arrive, leave }) => [parked ? null : arrive, leave].some((w) => w && day + FLATBED_VISIT > w[0] && day < w[1]))
}
const flatbedLaneLock = { do: 'call', label: '等待吊车进出场', fn: (c, e) => flatbedMayGo(c) && c.world.lock('yardLane', e.id) && !!(e.agent.lockKey = 'yardLane') }
const mobileCrane = {
  id: 'mc', prefab: 'mobileCrane', name: '汽车吊 QY-50', info: { role: '起重 · 汽车吊', desc: '协助塔吊安装与拆除，吊装外墙幕墙板。', ring: 6 },
  // one window: between visits the 'off' plan keeps it hidden, so a slow exit never freezes mid-road
  life: { windows: [[1.3, 15.55]], enter: 'none', exit: 'none' },
  agent: {
    slew: 0, luff: 0.05, ext: 0, rope: 4, outrig: 0, init: { parked: false, arriving: false, leaving: false },
    plans: [
      mcArrive,
      mcWork('tcUp', [2.95, 3.42], mcLift({ x: 17.5, z: -20.6 }, { x: 2, z: -15.5, rope: 4 }, 'section', '吊装标准节')),
      mcWork('facade', [8.1, 12.2], [...mcLift({ x: 18.7, z: -16.9 }, { x: 9.4, z: -3, rope: 5 }, 'panel', '吊装幕墙板'), { do: 'add', var: { 'counter.panels': 1 } }]),
      mcWork('tcDown', [12.2, 13.5], mcLift({ x: 2, z: -15.5 }, { x: 17.5, z: -20.6, rope: 8 }, 'section', '拆卸标准节')),
      mcLeave,
      // parked early (arrived before the job starts) or waiting for the yard lane to leave
      { id: 'standby', when: { test: (c, e) => e.agent.parked }, steps: [{ do: 'set', agent: { outrig: 1 } }, { do: 'wait', t: 3, label: '待命' }] },
      { id: 'off', steps: [{ do: 'hide' }, { do: 'wait', t: 5 }] }
    ]
  }
}

// ---------------------------------------------------------------- deliveries: flatbed + forklift
const flatbed = {
  id: 'flatbed', prefab: 'flatbed', name: '平板货车 01', info: { role: '运输 · 平板车', desc: '运送水泥、砌块等材料，叉车卸货入库。', ring: 5 },
  life: { windows: [[3.2, 15.2]], enter: 'none', exit: 'none' },
  agent: {
    cargo: 0,
    plans: [{ id: 'deliver', when: { day: [3.2, 15.0], notWeather: ['storm'] }, spawn: offE, interruptible: false, steps: [
      { do: 'hide' }, { do: 'wait', t: [20, 50] },
      // the crane has priority on the yard lane: go only if the visit fits before its next transit
      flatbedLaneLock,
      { do: 'set', agent: { cargo: 4 } },
      // yard lane run-in as an explicit path (the lane is ours by the lock; the following check
      // would otherwise hold the truck behind a crane parked further up the lane)
      ...enterE('hE'), { do: 'path', points: [[13.5, 4], [13.5, -2]], speed: 3, label: '进场' },
      { do: 'log', text: '材料车到场，叉车卸货', icon: '📦', chance: 0.6 },
      { do: 'signal', name: 'flatbed.ready' },
      { do: 'waitFor', signal: 'flatbed.empty', timeout: 120, label: '卸货中' },
      { do: 'add', var: { 'counter.deliveries': 1, 'stock.rebar': 2 } },
      { do: 'reverse', path: [[13.5, 8], [14, 12.2], [17, 13.5], [19, 13.5]], label: '倒车出场' },
      { do: 'drive', via: [[16, 12.5]], to: 'hP', stop: false },
      laneUnlock,
      { do: 'drive', to: 'offW' }, { do: 'hide' }
    ] }]
  }
}

const slotPos = (c) => {
  const n = Math.min(15, c.world.getVar('stock.pallet'))
  const layer = Math.floor(n / 8)
  const r = Math.floor((n % 8) / 2)
  const col = n % 2
  return { x: 24.5 + col * 1.5, z: -9 + r * 1.5, lift: Math.max(0, (layer - 0.48) / 2.2) }
}
const forkCycle = (i) => [
  { do: 'path', points: [[19, -2 + 2.3 - i * 1.55], [16.4, 0.3 - i * 1.55]], speed: 2.4, label: '叉取托盘' },
  { do: 'tween', set: { lift: 0.25 }, t: 1.2 },
  { do: 'set', agent: { loaded: true } },
  { do: 'call', fn: (c) => { const fb = c.world.get('flatbed'); fb.agent.cargo = Math.max(0, fb.agent.cargo - 1); return true } },
  { do: 'path', points: [[19, 0.3 - i * 1.55]], reverse: true, speed: 1.6 },
  { do: 'path', points: [(c, e) => { const s = slotPos(c); return [s.x - 2.6, s.z] }, (c, e) => { const s = slotPos(c); return [s.x - 2.1, s.z] }], speed: 2.4, label: '入库' },
  { do: 'tween', set: { lift: (c) => slotPos(c).lift }, t: 1.2 },
  { do: 'set', agent: { loaded: false } },
  { do: 'add', var: { 'stock.pallet': 1 } },
  { do: 'tween', set: { lift: 0 }, t: 1 },
  { do: 'path', points: [(c) => { const s = slotPos(c); return [s.x - 5, s.z] }], reverse: true, speed: 1.6 }
]
const forklift = {
  id: 'forklift', prefab: 'forklift', name: '叉车 FL-3', x: 18.5, z: 6.5, ry: W,
  info: { role: '场内运输 · 叉车', ring: 3 },
  life: { windows: [[3.2, 15.5]], enter: 'drop', exit: 'none', dur: 0.05 },
  agent: {
    lift: 0, kind: 'vehicle', maxSpeed: 3,
    plans: [
      { id: 'unload', when: { day: [3.2, 15.5], signal: 'flatbed.ready' }, interruptible: false, steps: [{ do: 'waitFor', signal: 'flatbed.ready' }, ...[0, 1, 2, 3].flatMap(forkCycle), { do: 'path', points: [[18.5, 6.5]], speed: 2.4 }, { do: 'face', yaw: W }, { do: 'signal', name: 'flatbed.empty' }] },
      { id: 'idle', when: { day: [3.2, 15.5] }, spawn: { place: 'forkWait', yaw: W }, steps: [{ do: 'wait', t: 4, label: '待命' }] }
    ]
  }
}

// ---------------------------------------------------------------- stock piles + spoil heap (data driven)
const stock = [
  { id: 'stock-pallet', prefab: 'stockPile', name: '材料堆场', x: 24.5, z: -9, params: { kind: 'bags', cols: 2, rows: 4, layers: 2 }, info: { role: '堆场 · 托盘材料' }, life: { windows: [[2.5, 15.7]], enter: 'none', exit: 'none' }, drive: { 'rig.setCount': (d, c) => Math.min(16, c.world.getVar('stock.pallet')) } },
  { id: 'stock-rebar', prefab: 'stockPile', name: '钢筋堆场', x: 23, z: 6, params: { kind: 'rebar', cols: 3, rows: 1, layers: 3 }, info: { role: '堆场 · 钢筋' }, life: { windows: [[2.5, 12.5]], enter: 'none', exit: 'none' }, drive: { 'rig.setCount': (d, c) => Math.min(9, c.world.getVar('stock.rebar')) } },
  { id: 'heap', prefab: 'heap', name: '临时堆土', x: 6, z: 6, params: { r: 3.6, h: 2.4 }, info: false, life: { windows: [[1.1, 4.2]], enter: 'none', exit: 'none' }, drive: { 'rig.setSize': [[1.1, 0], [1.7, 0.8], [2.3, 1], [3.6, 1], [4.1, 0]], 'object.position.y': [[1, 0], [1.6, -1.2], [2.4, -2.4], [3.6, -2.4], [4.2, 0]] } },
  { id: 'skip', prefab: 'cargoSkip', name: '混凝土料斗', x: -18.6, z: 17, info: false, life: { windows: [[5.2, 12.1]], enter: 'none', exit: 'none' }, drive: { hiddenByAgent: (d, c) => c.world.get('tc')?.agent.payload === 'skip' } }
]

export const fleet = [excavator, dump1, dump2, mixer1, mixer2, pump, towerCrane, hoist, mobileCrane, flatbed, forklift, ...stock]
export { slewTo }
