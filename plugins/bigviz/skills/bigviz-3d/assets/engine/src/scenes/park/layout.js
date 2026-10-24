// Park pack - static layout of 云栖科技园 (smart tech park). The real 600 x 420 m campus is
// compressed to a 280 x 200 m board with the same programme and proportions: a U-shaped park
// road (east / north / west legs, 7.5 m, two lanes) with a red bike lane on its outer side,
// two plate-recognition gates on the south edge, three garage ramps, a central lake with a
// fountain, six curtain-wall towers, two R&D blocks, a canteen and three apartment slabs.
// Coordinates in metres, +x east, +z south (toward the default camera). Plaza paving top 0.15.

export const BOARD = { w: 280, d: 200 }
export const PAVE_Y = 0.15
/** road axis: east / west legs at x = ±X, north leg at z = Z; half width, lane offset */
export const ROAD = { X: 126, Z: -86, half: 3.75, lane: 1.9 }
export const BIKE_W = 1.6
const IN = ROAD.X - ROAD.half // inner kerb x (122.25)
const OUT = ROAD.X + ROAD.half // outer kerb x (129.75)
const NZ = ROAD.Z + ROAD.half // inner kerb of the north leg (-82.25)

/**
 * Buildings: centre, world footprint (w along x, d along z), yaw (front = local +z), floors.
 * T2 / T6 face the lake (front west / east), the canteen faces north, the rest face south.
 */
export const BLD = {
  A1: { x: -40, z: 54, w: 33, d: 24, ry: 0, floors: 24, name: 'A1 总部大楼', kind: 'tower' },
  T2: { x: 78, z: 6, w: 24, d: 30, ry: -Math.PI / 2, floors: 22, name: 'A2 研发总部', kind: 'tower' },
  T3: { x: -52, z: -44, w: 24, d: 26, ry: 0, floors: 18, name: 'B1 办公楼', kind: 'tower' },
  T4: { x: -12, z: -44, w: 24, d: 26, ry: 0, floors: 26, name: 'B2 云栖中心', kind: 'tower' },
  T5: { x: 28, z: -44, w: 24, d: 26, ry: 0, floors: 20, name: 'B3 办公楼', kind: 'tower' },
  T6: { x: -78, z: 6, w: 24, d: 30, ry: Math.PI / 2, floors: 16, name: 'A3 创新大厦', kind: 'tower' },
  RW: { x: -92, z: -44, w: 36, d: 16, ry: 0, floors: 5, name: 'C1 研发楼', kind: 'lab' },
  RE: { x: 92, z: -44, w: 36, d: 16, ry: 0, floors: 5, name: 'C2 实验楼', kind: 'lab' },
  CT: { x: 40, z: 54, w: 32, d: 22, ry: Math.PI, floors: 2, name: '员工餐厅', kind: 'canteen' },
  AP1: { x: -90, z: -75, w: 40, d: 13, ry: 0, floors: 18, name: '人才公寓 1#', kind: 'apartment' },
  AP2: { x: -40, z: -75, w: 40, d: 13, ry: 0, floors: 18, name: '人才公寓 2#', kind: 'apartment' },
  AP3: { x: 30, z: -75, w: 40, d: 13, ry: 0, floors: 18, name: '人才公寓 3#', kind: 'apartment' }
}
/** local (along-facade) width and depth of a building for its prefab */
export const localSize = (b) => (Math.abs(Math.sin(b.ry)) > 0.5 ? { w: b.d, d: b.w } : { w: b.w, d: b.d })

// lake: water / coping ellipse, lakeside path ellipse, lawn ring; pit = coping bounding rect
export const LAKE = { x: 0, z: 6, rx: 40, rz: 24, cope: 1, path: { rx: 44, rz: 28, w: 3.4 }, lawn: { rx: 54, rz: 33 } }
export const LAKE_PIT = { x: 0, z: 6, w: 83, d: 51 }

/**
 * Garage ramps: s = 0 at the inner road kerb, dir points down the ramp. Open (sloped) part
 * s 0..open, covered portal + garage s open..roof. depth(s) in gates.js.
 */
export const RAMP = { w: 7, L: 30, D: 3.8, blend: 3, open: 24, roof: 34 }
export const RAMPS = [
  { id: 'ramp-e', name: '东区地库 P1', x: IN, z: 46, dir: [-1, 0], node: 'rampE' },
  { id: 'ramp-w', name: '西区地库 P2', x: -IN, z: 46, dir: [1, 0], node: 'rampW' },
  { id: 'ramp-n', name: '北区地库 P3', x: 59.5, z: NZ, dir: [0, 1], node: 'rampN' }
]
/** world rect { x, z, w, d } of a ramp between s0 and s1 (across = ramp width + pad) */
export function rampRect(r, s0, s1, pad = 0.4) {
  const [ux, uz] = r.dir
  const cx = r.x + ux * (s0 + s1) / 2
  const cz = r.z + uz * (s0 + s1) / 2
  const along = s1 - s0
  const across = RAMP.w + pad
  return ux !== 0 ? { x: cx, z: cz, w: along, d: across } : { x: cx, z: cz, w: across, d: along }
}

// gates on the south edge: island centre; inbound arm 3.5 m north of it, outbound 3.5 m south
export const GATES = [
  { id: 'gate-se', name: '东南门', x: ROAD.X, z: 88, node: 'gSE' },
  { id: 'gate-sw', name: '西南门', x: -ROAD.X, z: 88, node: 'gSW' }
]
export const GATE = { island: 1.4, armIn: -3.5, armOut: 3.5, arm: 3.1, armY: 0.98 }

// ---------------------------------------------------------------- terrain pits + ground layers
const pitKeep = { 'object.position.y': [[0, -2.95], [99, -2.95]] }
export const terrain = {
  surface: 'grass',
  pits: [
    { id: 'pit.lake', ...LAKE_PIT, drive: pitKeep },
    ...RAMPS.map((r) => ({ id: `pit.${r.id}`, ...rampRect(r, 0, RAMP.roof, 0.4), drive: pitKeep }))
  ]
}

const R = (o) => ({ ...o })
export const ground = [
  // plaza paving inside the U road (kerb 0.15): lake and open ramp parts cut out
  { id: 'plaza', mat: 'paving', x: 0, z: (NZ + 100) / 2, w: IN * 2, d: 100 - NZ, y: PAVE_Y, t: 0.15, holes: [LAKE_PIT, ...RAMPS.map((r) => rampRect(r, 0.05, RAMP.open, 0.4))] },
  // grass verges between the bike lane and the board edge (east / west / north)
  { mat: 'grass', x: (OUT + BIKE_W + 140) / 2, z: 4.3, w: 140 - OUT - BIKE_W, d: 191.4, y: 0.12, t: 0.12 },
  { mat: 'grass', x: -(OUT + BIKE_W + 140) / 2, z: 4.3, w: 140 - OUT - BIKE_W, d: 191.4, y: 0.12, t: 0.12 },
  { mat: 'grass', x: 0, z: -95.7, w: 280, d: 8.6, y: 0.12, t: 0.12 },
  // lawns on the plaza (kept off the walks, ramps and gate canopies)
  R({ mat: 'grass', x: -108, z: -2, w: 26, d: 60, y: 0.18, t: 0.04 }),
  R({ mat: 'grass', x: 108, z: -2, w: 26, d: 60, y: 0.18, t: 0.04 }),
  R({ mat: 'grass', x: -80, z: 76, w: 26, d: 16, y: 0.18, t: 0.04 }),
  R({ mat: 'grass', x: -106, z: 74, w: 14, d: 12, y: 0.18, t: 0.04 }),
  R({ mat: 'grass', x: 77, z: 76, w: 22, d: 16, y: 0.18, t: 0.04 }),
  R({ mat: 'grass', x: 106, z: 74, w: 14, d: 12, y: 0.18, t: 0.04 }),
  R({ mat: 'grass', x: -112, z: -63, w: 16, d: 8, y: 0.18, t: 0.04 })
]

// ---------------------------------------------------------------- road graph
const RD = { lane: ROAD.lane, width: ROAD.half * 2 }
const STUB = { ...RD, surface: false, dashes: false }
const RAMP_E = { lane: 1.4, width: RAMP.w, surface: false, dashes: false }
const rampEnd = (r) => [r.x + r.dir[0] * (RAMP.roof - 2), r.z + r.dir[1] * (RAMP.roof - 2)]
export const roads = {
  lane: ROAD.lane,
  nodes: {
    offSE: [ROAD.X, 111], bSE: [ROAD.X, 99.5], gSE: [ROAD.X, 88], jE: [ROAD.X, 46], cNE: [ROAD.X, ROAD.Z],
    jN: [59.5, ROAD.Z], cNW: [-ROAD.X, ROAD.Z], jW: [-ROAD.X, 46], gSW: [-ROAD.X, 88], bSW: [-ROAD.X, 99.5], offSW: [-ROAD.X, 111],
    rampE: rampEnd(RAMPS[0]), rampW: rampEnd(RAMPS[1]), rampN: rampEnd(RAMPS[2])
  },
  edges: [
    ['offSE', 'bSE', STUB], ['bSE', 'gSE', RD], ['gSE', 'jE', RD], ['jE', 'cNE', RD], ['cNE', 'jN', RD], ['jN', 'cNW', RD],
    ['cNW', 'jW', RD], ['jW', 'gSW', RD], ['gSW', 'bSW', RD], ['bSW', 'offSW', STUB],
    ['jE', 'rampE', RAMP_E], ['jW', 'rampW', RAMP_E], ['jN', 'rampN', RAMP_E]
  ]
}

// ---------------------------------------------------------------- pedestrian network
// lakeside path ring L0..L15 (22.5° steps, 0 = east, 90 = south), lawn-gap nodes K0..K7
// outside the lawn ring every 45°, front walk W (z -29) before the office row, back path Q
// (z -62.75) before the apartments, promenade P / metro M, corridor X west of A1.
const N = {}
const E = []
const ell = (rx, rz, deg) => [+(rx * Math.cos((deg * Math.PI) / 180)).toFixed(2), +(LAKE.z + rz * Math.sin((deg * Math.PI) / 180)).toFixed(2)]
for (let i = 0; i < 16; i++) { N[`L${i}`] = ell(LAKE.path.rx, LAKE.path.rz, i * 22.5); E.push([`L${i}`, `L${(i + 1) % 16}`]) }
for (let k = 0; k < 8; k++) if (k !== 6) { N[`K${k}`] = ell(LAKE.lawn.rx * 1.07, LAKE.lawn.rz * 1.07, k * 45); E.push([`L${k * 2}`, `K${k}`]) }
const WX = [-92, -69, -52, -32, -12, 0, 8, 28, 50, 74, 92]
WX.forEach((x, i) => { N[`W${x}`] = [x, -29]; if (i) E.push([`W${WX[i - 1]}`, `W${x}`]) })
E.push(['L12', 'W0'])
const QX = [-90, -69, -40, -32, 8, 30]
QX.forEach((x, i) => { N[`Q${x}`] = [x, -62.75]; if (i) E.push([`Q${QX[i - 1]}`, `Q${x}`]) })
for (const x of [-69, -32, 8]) E.push([`Q${x}`, `W${x}`])
Object.assign(N, { P0: [0, 72], P1: [0, 52], M1: [-14, 84], M2: [14, 84], X1: [-61, 31], X2: [-61, 70], A1S: [-40, 69], CTN: [40, 40.5], T2D: [64, 6], T6D: [-64, 6] })
for (const x of [-90, -40, 30]) { N[`AP${x}`] = [x, -66]; E.push([`AP${x}`, `Q${x}`]) }
E.push(['K2', 'P1'], ['P1', 'P0'], ['P0', 'M1'], ['P0', 'M2'], ['P0', 'A1S'], ['K3', 'X1'], ['X1', 'X2'], ['X2', 'A1S'], ['K1', 'CTN'], ['K0', 'T2D'], ['K4', 'T6D'], ['K5', 'W-32'], ['K7', 'W28'])
export const WALK = { nodes: N, edges: E }

/** door node + entry points (walk in, then hide) per building */
export const DOORS = {
  A1: { node: 'A1S', enter: [[-40, 63.4], [-40, 58.6], [-40, 55.4], [-40, 52.6]] },
  T2: { node: 'T2D', enter: [[66.6, 6]] }, T6: { node: 'T6D', enter: [[-66.6, 6]] },
  T3: { node: 'W-52', enter: [[-52, -31.5]] }, T4: { node: 'W-12', enter: [[-12, -31.5]] }, T5: { node: 'W28', enter: [[28, -31.5]] },
  RW: { node: 'W-92', enter: [[-92, -36.5]] }, RE: { node: 'W92', enter: [[92, -36.5]] },
  CT: { node: 'CTN', enter: [[40, 43.5]] },
  AP1: { node: 'AP-90', enter: [[-90, -68.9]] }, AP2: { node: 'AP-40', enter: [[-40, -68.9]] }, AP3: { node: 'AP30', enter: [[30, -68.9]] }
}

const adj = new Map()
for (const id of Object.keys(N)) adj.set(id, [])
for (const [a, b] of E) {
  const d = Math.hypot(N[a][0] - N[b][0], N[a][1] - N[b][1])
  adj.get(a).push([b, d]); adj.get(b).push([a, d])
}
/** shortest node path (Dijkstra, small graph) -> [[x, z], ...] */
export function walkRoute(from, to) {
  const dist = new Map([[from, 0]])
  const prev = new Map()
  const open = new Set([from])
  while (open.size) {
    let cur = null
    for (const id of open) if (cur === null || dist.get(id) < dist.get(cur)) cur = id
    open.delete(cur)
    if (cur === to) break
    for (const [n, d] of adj.get(cur)) {
      const nd = dist.get(cur) + d
      if (nd < (dist.get(n) ?? Infinity)) { dist.set(n, nd); prev.set(n, cur); open.add(n) }
    }
  }
  const out = [to]
  while (prev.has(out[0])) out.unshift(prev.get(out[0]))
  return out[0] === from ? out.map((id) => N[id]) : [N[from], N[to]]
}

export const CAMERA_BOUNDS = { x: 150, z: 112 }
