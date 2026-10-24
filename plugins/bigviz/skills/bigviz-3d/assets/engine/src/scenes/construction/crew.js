// Construction pack - workers. Roles map to real jobs: gate flagman, reversing spotter,
// foreman, surveyor, excavation crew, crane riggers (ground + deck), deck crew (phase
// dependent tasks, ride the hoist), ground crew (rebar / formwork / mortar), welder,
// landscapers, electrician. Head-count over the project follows the brief (5 -> 12 -> ...).

import { deckTask, deckSpot } from './work.js'

const PI = Math.PI
const SHIFT = [6, 22]
const NIGHT = [22, 6]
let seed = 1

/** Every worker joins the completion ceremony (day 16.2+) at slot i */
const ceremony = (i) => ({
  id: 'ceremony', when: { day: [16.2, 99] }, spawn: { x: -14 + i * 1.6, z: 10.5, yaw: 0 }, steps: [
    { do: 'walk', to: { x: -14 + i * 1.6, z: 10.5 } },
    { do: 'face', yaw: 0 },
    { choose: [[{ do: 'anim', anim: 'cheer', t: [3, 5] }], [{ do: 'anim', anim: 'wave', t: [3, 5] }], [{ do: 'anim', anim: 'photo', t: 4 }], [{ do: 'anim', anim: 'talk', t: 4 }]] }
  ]
})
const offShift = { id: 'off', when: { hour: NIGHT }, spawn: { place: 'office', hidden: true }, steps: [{ do: 'walk', to: 'officeYard' }, { do: 'hide' }, { do: 'wait', t: 6, label: '下班休息' }, { do: 'show' }] }

function worker(id, name, role, life, plans, params = {}) {
  return {
    id, prefab: 'worker', name, params: { role: params.role || 'worker', shirt: params.shirt, seed: seed++ },
    info: { role, desc: params.desc },
    life: { windows: life, enter: 'none', exit: 'none' },
    agent: { walkSpeed: params.walkSpeed || 1.55, plans }
  }
}

// ---------------------------------------------------------------- deck crew (ride the hoist)
const deckPlans = (shift = SHIFT, extra = []) => [
  { id: 'onSlab', when: { day: [3.0, 4.35], hour: shift, test: (c, e) => !e.agent.onDeck }, steps: [{ do: 'walk', to: { deck: true, margin: 2 } }] },
  { id: 'up', when: { day: [4.35, 12.4], hour: shift, test: (c, e) => !e.agent.onDeck }, spawn: 'officeYard', interruptible: false, steps: [{ do: 'walk', to: 'hoistIn' }, { do: 'ride', hoist: 'hoist', dir: 'up' }, { do: 'say', text: '上作业面', t: 2, chance: 0.3 }] },
  ...extra,
  { id: 'deck', when: { day: [3.0, 12.4], hour: shift, test: (c, e) => e.agent.onDeck }, spawn: { deck: true, margin: 2 }, steps: [{ do: 'walk', to: (c) => deckSpot(c) }, { do: 'work', pick: deckTask }, { do: 'wait', t: [0.5, 2] }] },
  { id: 'down', when: { test: (c, e) => e.agent.onDeck && (c.clock.day >= 12.4 || !inHour(c.clock.hour, shift)) }, interruptible: false, steps: [{ do: 'walk', to: { deck: true, u: 0.02, v: 0.5 } }, { do: 'ride', hoist: 'hoist', dir: 'down' }, { do: 'walk', to: 'officeYard' }] },
  { ...offShift, when: { hour: shift[0] === 6 ? NIGHT : [6, 22] } }
]
const inHour = (h, [a, b]) => (a <= b ? h >= a && h < b : h >= a || h < b)

const deckRigger = [
  { id: 'unhook', preempt: true, when: { day: [3.35, 12.05], hour: SHIFT, signal: 'crane.atDrop', test: (c, e) => e.agent.onDeck }, interruptible: false, steps: [
    { do: 'waitFor', signal: 'crane.atDrop' },
    { do: 'walk', to: (c) => ({ x: c.world.vars.dropPos.x + 1.2, z: c.world.vars.dropPos.z, deck: false, onDeck: true, y: c.world.vars.dropPos.y }), run: true },
    { do: 'anim', anim: 'hook', t: 2.5, label: '摘钩' },
    { do: 'signal', name: 'rig.unhooked' },
    { do: 'anim', anim: 'signal', t: 1.5, say: '摘钩完毕，起钩！', sayChance: 0.6 }
  ] }
]

const crewDeck = [
  worker('deck-1', '钢筋工 老王', '主体 · 钢筋工', [[3.0, 12.4], [16.2, 17]], [ceremony(0), ...deckPlans(SHIFT, deckRigger)], { desc: '负责作业面钢筋绑扎与吊装摘钩。' }),
  worker('deck-2', '木工 小李', '主体 · 木工', [[3.0, 12.4], [16.2, 17]], [ceremony(1), ...deckPlans()]),
  worker('deck-3', '混凝土工 阿强', '主体 · 混凝土工', [[3.3, 12.4], [16.2, 17]], [ceremony(2), ...deckPlans([6, 24])], { desc: '夜间加班振捣养护。' }),
  worker('deck-4', '钢筋工 小周', '主体 · 钢筋工', [[4.6, 11.9], [16.2, 17]], [ceremony(3), ...deckPlans()]),
  worker('deck-5', '木工 老陈', '主体 · 木工', [[4.9, 11.6], [16.2, 17]], [ceremony(4), ...deckPlans([6, 24])])
]

// ---------------------------------------------------------------- ground roles
const flagman = worker('flagman', '门卫 · 指挥 老赵', '大门 · 交通指挥', [[1, 17]], [
  ceremony(5),
  { id: 'night', when: { hour: NIGHT }, spawn: 'flagman', steps: [{ do: 'walk', to: 'flagman' }, { do: 'anim', anim: 'paddle', tool: 'torch', t: [6, 10] }, { do: 'wander', area: { x: 1, z: 24.2, w: 4, d: 0.6 }, t: 6 }] },
  { id: 'gate', when: { day: [1, 16.2] }, spawn: 'flagman', steps: [{ do: 'walk', to: 'flagman' }, { choose: [[{ do: 'anim', anim: 'flag', t: [4, 7], say: '车辆进出，注意避让', sayChance: 0.25 }], [{ do: 'anim', anim: 'paddle', t: [4, 6] }], [{ do: 'anim', anim: 'radio', t: 3 }], [{ do: 'wander', area: { x: 1, z: 24.2, w: 5, d: 0.6 }, t: 6 }]] }] }
], { role: 'flagman', desc: '24 小时值守大门，指挥车辆进出。' })

const spotter = worker('spotter', '指挥员 小孙', '浇筑 · 倒车指挥', [[2.3, 12.1], [16.2, 17]], [
  ceremony(6),
  { id: 'reverse', preempt: true, when: { day: [2.3, 12.1], signal: 'mixer.reversing' }, interruptible: false, steps: [{ do: 'waitFor', signal: 'mixer.reversing' }, { do: 'walk', to: 'spotter', run: true }, { do: 'anim', anim: 'signal', t: 8, say: '倒，倒，倒——停！', sayChance: 1 }] },
  { id: 'skip', preempt: true, when: { day: [5.2, 12.1], signal: 'crane.atSkip' }, interruptible: false, steps: [{ do: 'waitFor', signal: 'crane.atSkip' }, { do: 'walk', to: { x: -17, z: 18.4 } }, { do: 'anim', anim: 'hook', t: 2.5, label: '挂料斗' }, { do: 'anim', anim: 'signal', t: 2, say: '起钩！', sayChance: 0.7 }] },
  { id: 'idle', when: { day: [2.3, 12.1] }, spawn: 'spotter', steps: [{ do: 'walk', to: { x: -27, z: 20.5 } }, { do: 'anim', anim: 'radio', t: [3, 6] }, { do: 'wait', t: [2, 5] }] }
], { role: 'rigger' })

const groundRigger = worker('rigger', '信号工 小马', '吊装 · 地面信号工', [[3.3, 12.1], [16.2, 17]], [
  ceremony(7),
  { id: 'hook', preempt: true, when: { day: [3.35, 12.05], signal: 'crane.atPick' }, interruptible: false, steps: [
    { do: 'waitFor', signal: 'crane.atPick' },
    { do: 'walk', to: (c) => ({ x: c.world.vars.pickPos.x - 1.2, z: c.world.vars.pickPos.z }), run: true },
    { do: 'anim', anim: 'hook', t: 3, label: '挂钩' },
    { do: 'signal', name: 'rig.hooked' },
    { do: 'walk', to: (c) => ({ x: c.world.vars.pickPos.x - 4, z: c.world.vars.pickPos.z + 1 }) },
    { do: 'anim', anim: 'signal', t: 2.5, say: '起吊，慢点！', sayChance: 0.5 }
  ] },
  { id: 'idle', when: { day: [3.3, 12.1] }, spawn: 'rigGround', steps: [{ do: 'walk', to: 'rigGround' }, { do: 'anim', anim: 'radio', t: [3, 6] }] }
], { role: 'rigger', desc: '负责材料挂钩与起吊信号。' })

const foreman = worker('foreman', '项目经理 张工', '管理 · 项目经理', [[1, 17]], [
  { id: 'speech', when: { day: [16.2, 99] }, spawn: 'arch', steps: [{ do: 'walk', to: { x: -4, z: 13.6 } }, { do: 'face', yaw: PI }, { do: 'anim', anim: 'talk', t: 5, say: '感谢大家！工程顺利竣工！', sayChance: 1 }, { do: 'anim', anim: 'cheer', t: 3 }] },
  { id: 'night', when: { hour: NIGHT }, spawn: { place: 'office', hidden: true }, steps: [{ do: 'walk', to: 'office' }, { do: 'hide' }, { do: 'wait', t: 8 }, { do: 'show' }] },
  { id: 'patrol', when: { day: [1, 16.2] }, spawn: 'officeYard', steps: [
    { choose: [
      [{ do: 'walk', to: 'pitEdgeS' }, { do: 'anim', anim: 'clipboard', t: 4, say: '进度不错', sayChance: 0.3 }],
      [{ do: 'walk', to: 'gate' }, { do: 'anim', anim: 'phone', t: [4, 7], say: '下一车料几点到？', sayChance: 0.4 }],
      [{ do: 'walk', to: 'stockSlot', via: [{ x: 13.5, z: 14 }] }, { do: 'anim', anim: 'inspect', t: 4 }],
      [{ do: 'walk', to: 'officeYard' }, { do: 'anim', anim: 'talk', t: 5 }],
      [{ do: 'walk', to: 'pitEdgeN' }, { do: 'anim', anim: 'point', t: 3 }]
    ] },
    { do: 'wait', t: [1, 3] }
  ] }
], { role: 'foreman', shirt: '#33508a', walkSpeed: 1.3, desc: '每天巡场，检查进度、安全与材料。' })

const surveyor = worker('surveyor', '测量员 小吴', '测量 · 放线', [[1, 3.6]], [{ id: 'survey', steps: [{ do: 'walk', to: { area: { x: -4, z: 11.2, w: 24, d: 1 } } }, { do: 'anim', anim: 'inspect', t: [4, 6], say: '标高复核', sayChance: 0.2 }, { do: 'anim', anim: 'point', t: 2 }] }], { role: 'foreman', shirt: '#eef0ee' })

const digCrew = (i) => worker(`dig-${i}`, `土方工 ${['老刘', '小何'][i]}`, '土方 · 普工', [[1, 2.5]], [{ id: 'dig', steps: [{ do: 'walk', to: { area: { x: -4 + i * 6, z: i ? -9 : 9.4, w: 14, d: 0.6 } } }, { choose: [[{ do: 'anim', anim: 'shovel', t: [5, 8], fx: 'dust', fxAt: 'front', fxEvery: 0.8 }], [{ do: 'anim', anim: 'point', t: 3, say: '这边再挖深点', sayChance: 0.3 }], [{ do: 'anim', anim: 'flag', t: 4 }]] }] }])

// ---------------------------------------------------------------- ground crew
const groundTasks = [
  [{ do: 'walk', to: 'rebarStack' }, { do: 'anim', anim: 'rebar', t: 2 }, { do: 'carry', item: 'rebar' }, { do: 'walk', to: 'bendTable' }, { do: 'carry', item: null }, { do: 'anim', anim: 'drill', tool: 'drill', t: [5, 8], fx: 'sparks', fxAt: 'hand', fxEvery: 0.2, label: '钢筋加工' }],
  [{ do: 'walk', to: 'formStack' }, { do: 'carry', item: 'plank' }, { do: 'walk', to: 'sawBench' }, { do: 'carry', item: null }, { do: 'anim', anim: 'hammer', t: [4, 6], fx: 'dust', fxAt: 'hand', fxEvery: 0.7, label: '模板加工' }],
  [{ do: 'walk', to: { place: 'mortar', dx: 1.6 } }, { do: 'face', to: 'mortar' }, { do: 'anim', anim: 'shovel', t: [6, 9], fx: 'dust', fxAt: 'front', fxEvery: 1, label: '拌制砂浆' }],
  [{ do: 'walk', to: { area: { x: 0, z: 13, w: 40, d: 2 } } }, { do: 'anim', anim: 'sweep', t: [5, 8], fx: 'dust', fxAt: 'front', fxEvery: 1.2, label: '清扫道路' }],
  [{ do: 'walk', to: { place: 'pickPallet', dx: -2 } }, { do: 'carry', item: 'bag' }, { do: 'walk', to: { place: 'mortar', dx: 1.8, dz: 1.5 } }, { do: 'carry', item: null }],
  [{ do: 'walk', to: 'officeYard' }, { do: 'anim', anim: 'talk', t: [4, 6], label: '休息' }]
]
const groundPlans = (i) => [ceremony(8 + i), offShift, { id: 'work', when: { day: [2.4, 15.6] }, spawn: 'officeYard', steps: [{ choose: groundTasks }, { do: 'wait', t: [1, 3] }] }]
const crewGround = [
  worker('ground-1', '普工 老黄', '辅助 · 钢筋加工', [[2.4, 15.6], [16.2, 17]], groundPlans(0)),
  worker('ground-2', '普工 小林', '辅助 · 模板加工', [[4.0, 15.6], [16.2, 17]], groundPlans(1)),
  worker('ground-3', '普工 阿杰', '辅助 · 砂浆', [[6.0, 14.8], [16.2, 17]], groundPlans(2)),
  worker('welder', '电焊工 老郑', '钢结构 · 电焊', [[3.4, 13.5], [16.2, 17]], [ceremony(11), { id: 'weld', steps: [{ do: 'walk', to: { place: 'weldBench', dz: 1.4 } }, { do: 'face', yaw: PI }, { do: 'anim', anim: 'weld', t: [8, 12], fx: 'sparks', fxAt: 'hand', fxEvery: 0.12, label: '焊接预埋件' }, { do: 'anim', anim: 'idle', t: 2 }] }], { role: 'welder', desc: '夜里火花最亮的那位。' })
]

// ---------------------------------------------------------------- finishing crews
const landscapers = [0, 1].map((i) => worker(`garden-${i}`, `绿化工 ${['小冯', '老许'][i]}`, '园林 · 绿化', [[14.6, 17]], [
  ceremony(12 + i),
  { id: 'plant', when: { day: [14.6, 16.2] }, spawn: { x: -20 + i * 30, z: 22, yaw: 0 }, steps: [{ do: 'walk', to: { area: { x: -4 + i * 8, z: 0, w: 40, d: 30 } } }, { do: 'anim', anim: 'shovel', t: [5, 8], fx: 'dust', fxAt: 'front', fxEvery: 0.9, label: '种植苗木' }, { do: 'anim', anim: 'rake', t: 4 }] }
], { shirt: '#3e8a5a' }))
const electrician = worker('electric', '电工 小郭', '安装 · 路灯', [[14.8, 17]], [ceremony(14), { id: 'lamps', when: { day: [14.8, 16.2] }, spawn: { x: -24, z: 21, yaw: PI }, steps: [{ choose: [[{ do: 'walk', to: { x: -24, z: 21 } }], [{ do: 'walk', to: { x: -12, z: 21 } }], [{ do: 'walk', to: { x: 6, z: 21 } }], [{ do: 'walk', to: { x: 18, z: 21 } }]] }, { do: 'anim', anim: 'drill', t: [5, 7], fx: 'sparks', fxAt: 'hand', fxEvery: 0.25, label: '安装路灯' }] }])

export const crew = [flagman, foreman, surveyor, digCrew(0), digCrew(1), spotter, groundRigger, ...crewDeck, ...crewGround, ...landscapers, electrician]
