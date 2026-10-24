// Scene pack: 智慧工厂 (from scenes/_template): a small site with one road, one building, a few agents, 2 shots and
// 3 twin devices. `node ../../scripts/new-scene.mjs <id> "<name>"` copies this folder to
// scenes/<id>/ (sets meta.id and the display name) and registers it in scenes/index.js.
// Everything is data; see scenes/construction/ for the full reference pack.
// Coordinates in metres, +x east, +z south (toward the default camera).

const PI = Math.PI
const BLDG = { x: -6, z: -4, w: 16, d: 10 }

// ---------------------------------------------------------------- layout
const board = { w: 64, d: 48 }

const ground = [
  { id: 'site', mat: 'soil', x: -2, z: -4, w: 44, d: 26, y: 0.02 },
  { mat: 'concrete', x: 14, z: 5, w: 4, d: 10, y: 0.035 },
  // sidewalk south of the road
  { mat: 'paving', x: 0, z: 21.5, w: 64, d: 3, y: 0.15 }
]

// one east-west street + a site access stub to the yard (dead ends offE / offW are entries)
const roads = {
  lane: 2,
  nodes: { offW: [-32, 16], rW: [-16, 16], rM: [14, 16], offE: [32, 16], gate: [14, 10], yard: [14, 2] },
  edges: [
    ['offW', 'rW'], ['rW', 'rM'], ['rM', 'offE'],
    ['rM', 'gate', { lane: 0, site: true, width: 6, dashes: false }],
    ['gate', 'yard', { lane: 0, site: true, surface: false }]
  ]
}

const places = {
  door: { x: BLDG.x, z: BLDG.z + BLDG.d / 2 + 1.5, yaw: PI },
  office: { x: -20, z: 2 },
  stack: { x: 8, z: -2 },
  walkW: { x: -30, z: 21.5 },
  walkE: { x: 30, z: 21.5 }
}

const props = [
  { type: 'cone', line: { from: [10, 10], to: [10, 2], n: 4 } },
  { type: 'container', x: -20, z: -12, params: { color: '#2f66b3' } },
  { type: 'bricks', at: [[6, -2], [8, -2], [7, -4]] }
]
// ---------------------------------------------------------------- entities
const building = {
  id: 'office', prefab: 'building', name: 'Office block', x: BLDG.x, z: BLDG.z,
  params: { w: BLDG.w, d: BLDG.d, floors: 4, fh: 3.3, seed: 2, scaffoldSides: [0, 1] },
  info: { role: 'Main structure · 4 floors', ring: 11 }
}

const foreman = {
  id: 'foreman', prefab: 'worker', name: 'Foreman', x: -18, z: 2, params: { role: 'foreman', seed: 1 },
  info: { role: 'Site foreman' },
  agent: { walkSpeed: 1.4, plans: [{ id: 'patrol', steps: [
    { do: 'walk', to: 'door' }, { do: 'anim', anim: 'clipboard', t: [3, 5] },
    { do: 'walk', to: 'stack' }, { do: 'anim', anim: 'point', t: 2, say: 'Unload here', sayChance: 0.4 },
    { do: 'walk', to: 'office' }, { do: 'wait', t: [2, 4] }
  ] }] }
}

const mason = {
  id: 'mason', prefab: 'worker', name: 'Mason', x: 6, z: -4, params: { seed: 2, shirt: '#e8b23a' },
  info: { role: 'Bricklayer' },
  agent: { plans: [{ id: 'work', steps: [
    { do: 'walk', to: 'stack' }, { do: 'carry', item: 'box' },
    { do: 'walk', to: { x: 1, z: -2 } }, { do: 'carry', item: null },
    { repeat: [2, 3], steps: [{ do: 'anim', anim: 'hammer', t: [2, 3] }, { do: 'wait', t: 0.5 }] }
  ] }] }
}

// delivery van: enters on the east kerb lane, drives into the yard, unloads, leaves west
const van = {
  id: 'van', prefab: 'car', name: 'Delivery van', params: { type: 'van', color: '#eef0ee' },
  info: { role: 'Deliveries' },
  agent: { maxSpeed: 6, plans: [{ id: 'deliver', spawn: { place: 'offE', yaw: -PI / 2, hidden: true }, steps: [
    { do: 'hide' }, { do: 'wait', t: [2, 6] },
    { do: 'roadEnter', at: 'offE', clear: 8 },
    { do: 'drive', to: 'yard' },
    { do: 'wait', t: 6, label: 'Unloading' },
    { do: 'drive', to: 'offW' }, { do: 'hide' }
  ] }] }
}

const walker = {
  id: 'ped-1', prefab: 'civilian', name: 'Pedestrian', params: { seed: 9, shirt: '#2f66b3' }, info: { role: 'Passer-by' },
  agent: { plans: [{ id: 'stroll', spawn: 'walkW', steps: [
    { do: 'walk', to: 'walkE', speed: [1.1, 1.4] }, { do: 'anim', anim: 'phone', t: 3, chance: 0.5 }, { do: 'walk', to: 'walkW' }
  ] }] }
}

const trees = [[-26, -14], [24, -14], [-26, 8]].map(([x, z], i) => ({ id: `tree-${i}`, prefab: 'tree', x, z, params: { kind: 'round', h: 5, seed: 20 + i }, info: false }))
// ---------------------------------------------------------------- progress over days (continuous curves)
const progress = {
  target: 'office',
  curves: {
    found: [[1.0, 0], [1.6, 1]],
    floors: [[1.6, 0], [2.4, 1], [3.2, 2], [4.0, 3], [4.8, 4]],
    facade: [[3.0, 0], [5.2, 4]],
    windows: [[3.4, 0], [5.6, 4]],
    scaffold: [[1.8, 0], [2.0, 2], [4.8, 4], [5.6, 0]],
    lit: [[5, 0], [6, 1]],
    roof: [[4.75, 0], [4.8, 1]],
    lobby: [[5.6, 0], [5.65, 1]]
  },
  events: [
    { day: 1.6, text: 'Foundation done', icon: '◆', shot: 'overview' },
    { day: 4.8, text: 'Topped out', icon: '★', shot: 'orbit' }
  ]
}

// ---------------------------------------------------------------- camera
const shots = [
  { id: 'overview', name: 'Overview', sub: '45° view', type: 'static', pos: [52, 48, 64], look: [-2, 2, 2], fov: 32 },
  { id: 'orbit', name: 'Orbit', sub: 'slow orbit', type: 'orbit', center: [-4, 5, -2], radius: 52, height: 34, speed: 0.06, start: 0.7, fov: 34 }
]
const storyboards = [
  { id: 'tour', name: 'Tour 16s', letterbox: true, segments: [
    { shot: 'overview', t: 8, day: 3.4, speed: 1, lockHour: 10, caption: '智慧工厂', sub: 'Living Diorama' },
    { shot: 'orbit', t: 8, day: 5.7, lockHour: 17, caption: 'Day 6', sub: 'Topped out' }
  ] }
]

// ---------------------------------------------------------------- digital twin (devices attach to node ids)
const twin = {
  adapter: { type: 'mock', seed: 3, interval: 1, alarmRate: 0.2 },
  prefix: 'site',
  zones: [{ id: 'zone.gate', name: 'Gate', x: 14, z: 10 }],
  devices: [
    { id: 'env-gate', type: 'envSensor', name: 'Dust / noise · gate', attachTo: 'zone.gate', offset: [3, 3, 0], visual: { prop: 'pm25' } },
    { id: 'hm-foreman', type: 'helmet', name: 'Helmet · foreman', attachTo: 'foreman', offset: [0, 2.15, 0], visual: { prop: 'hr' } },
    { id: 'em-f1', type: 'electricMeter', name: '1F meter', attachTo: 'office.F1.S1', offset: [-1.5, 1.5, 0] }
  ]
}

export default {
  meta: { id: 'factory', title: '智慧工厂', subtitle: 'Living Diorama scene pack', eyebrow: 'LIVING DIORAMA', seed: 3, watermark: '智慧工厂 · Living Diorama' },
  board,
  // 'diorama' (desk + tilt-shift) | 'realistic'; ?style= overrides
  style: 'diorama',
  desk: { seed: 3, plaque: { title: '智慧工厂', subtitle: 'Scale 1:200' } },
  clock: { dayStart: 1, dayEnd: 6, secondsPerDay: 40, daylight: 0.72, startDay: 3.4 },
  camera: { home: 'overview', bounds: { x: 36, z: 28 }, minDist: 8, maxDist: 220 },
  ground, roads, places, props,
  entities: [building, foreman, mason, van, walker, ...trees],
  progress, shots, storyboards, autoDirector: { milestone: (m) => m.shot || 'overview' },
  twin,
  weather: 'clear'
}
