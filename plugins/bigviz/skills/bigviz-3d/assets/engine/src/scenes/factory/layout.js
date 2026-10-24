// Factory pack - site plan. Metres, +x east, +z south, origin = hall centre.
// Stamping + body-in-white hall 176 x 72 m (22 bays x 8 m, 3 spans x 24 m, eave 14 m):
//   north span  (z -36..-12): coil bay, blanking line, tandem press line P1-P5, die change
//   middle span (z -12..12):  weld lines A / B (8 robots each), AGV aisle, high-bay racks
//   south span  (z 12..36):   office + control room, tote supermarket, QC, chargers, docks
// Outside: ring road, west + south gates, raw-material warehouse, utility station.

export const HALL = { x0: -88, x1: 88, z0: -36, z1: 36, eave: 14, ridge: 15.2, bay: 8, spans: [-36, -12, 12, 36] }
export const BOARD = { w: 216, d: 172 }

// press line (north span axis), robots between the presses face them along x
export const LINE_Z = -26
// presses every 10 m; handling robots midway (pr-1..pr-4), loader pr-0 at -15, unloader pr-5 at 35
export const PRESS = [
  { id: 'p1', x: -10, big: true, label: 'P1 · 2500 t' },
  { id: 'p2', x: 0, label: 'P2 · 800 t' },
  { id: 'p3', x: 10, label: 'P3 · 800 t' },
  { id: 'p4', x: 20, label: 'P4 · 800 t' },
  { id: 'p5', x: 30, label: 'P5 · 800 t' }
]
export const ROBOT_X = [-15, -5, 5, 15, 25, 35]
export const DESTACK_X = -19.8
export const EXIT_X = 43 // exit conveyor centre (L 10): unloader drops at x 39
// crane runway (north span): rails at z -35 / -12.4 -> centre -23.7
export const RUNWAY = { z: -24, railY: 10, span: 22.2 }
// coil saddles: row 1 full (static), row 2 slots 0-4 static, 5-8 = crane pool entities
export const COIL_ROWS = [{ z: -32.5, x0: -70, n: 9 }, { z: -20, x0: -70, n: 9 }]
export const COIL_PITCH = 2.2
export const COIL_POOL = [5, 6, 7, 8].map((i) => -70 + i * 2.2)
// blanking line centred at x -33 (uncoiler mandrel at -41, stacker -27)
export const BLANK_X = -33
export const UNCOILER = { x: -41, z: -26 }

// weld lines: conveyor axes, stations along x
export const WELD = { A: -6.5, B: 6.5, load: -66, unload: -26, stations: [-58, -50, -42, -34], robotDz: 2.3 }

// high-bay racking: 4 back-to-back pairs, bays along x
// 9 bays x 2.8 m (x 61.4..86.6), rows 1.1 m deep; back-to-back pairs with 3.8 m aisles
export const RACK = { x: 74, bays: 9, bay: 2.8, lh: 1.5, rows: [-10.69, -9.49, -4.59, -3.39, 1.51, 2.71, 7.61, 8.81], aisles: [-7.04, -0.94, 5.16], laneX: 57.4 }
/** pallet slot centre: row r (0..7), bay i, side k (0 | 1), level l */
export const slot = (r, i, k, l) => ({ x: RACK.x - (RACK.bays * RACK.bay) / 2 + i * RACK.bay + 0.75 + k * 1.3, z: RACK.rows[r], y: l * RACK.lh })
// put-away targets (kept empty in the static fill, filled by forklift slot entities)
export const SLOTS = [
  { id: 'slot-1', r: 1, i: 3, k: 0, l: 1, aisle: 0, fl: 'fl-1' },
  { id: 'slot-2', r: 2, i: 6, k: 1, l: 2, aisle: 0, fl: 'fl-1' },
  { id: 'slot-3', r: 3, i: 2, k: 1, l: 4, aisle: 1, fl: 'fl-4' },
  { id: 'slot-4', r: 4, i: 7, k: 0, l: 5, aisle: 1, fl: 'fl-4' }
]

/** AGV loop (one-way, counter-clockwise seen from above) + charger spur */
export const AGV_NODES = {
  aSW: [-84, 15.5], aW: [-84, 0], aFeed: [-75, 0], aMid: [-40, 0], aOut: [-18, 0], aE1: [-12, 0],
  aN1: [-12, -15.5], aPress: [30, -15.5], aNE: [52, -15.5], aFG: [52, -6], aSE: [52, 15.5], aTote: [-6, 15.5], aChg: [-24, 15.5], aS: [-50, 15.5]
}
export const AGV_LOOP = ['aSW', 'aW', 'aFeed', 'aMid', 'aOut', 'aE1', 'aN1', 'aPress', 'aNE', 'aFG', 'aSE', 'aTote', 'aChg', 'aS', 'aSW']
export const CHARGERS = [[-30, 19.2], [-26, 19.2], [-22, 19.2], [-18, 19.2]]

// outdoor roads: ring + west gate + south gate. Docks on the south wall.
// south road at z 52 leaves the dock apron (z 36..48) for trucks reversing onto the docks
const RS = 52
const OUT_NODES = {
  offW: [-112, 0], gW: [-100, 0], rNW: [-96, -46], rSW: [-96, RS], rNE: [96, -46], rSE: [96, RS], rWm: [-96, 0], rWn: [-96, -24],
  coilBay: [-80, -24], coilIn: [-90, -24], rS0: [0, RS], rS1: [40, RS], rSd: [86, RS], gS: [0, 66], offS: [0, 92], rN0: [0, -46]
}
export const DOCKS = [{ id: 'dock1', x: 62 }, { id: 'dock2', x: 70 }, { id: 'dock3', x: 78 }]
export const SOUTH_ROAD = RS

const agvEdges = []
for (let i = 0; i < AGV_LOOP.length - 1; i++) agvEdges.push([AGV_LOOP[i], AGV_LOOP[i + 1], { lane: 0, oneway: true, site: true, surface: false, width: 1.6, dashes: false }])

export const roads = {
  lane: 2,
  nodes: { ...OUT_NODES, ...AGV_NODES },
  edges: [
    ['offW', 'gW', { width: 8 }], ['gW', 'rWm', { width: 8 }],
    ['rWm', 'rWn'], ['rWn', 'rNW'], ['rWm', 'rSW'], ['rNW', 'rN0'], ['rN0', 'rNE'], ['rNE', 'rSE'], ['rSE', 'rSd'], ['rSd', 'rS1'], ['rS1', 'rS0'], ['rS0', 'rSW'],
    ['rS0', 'gS', { width: 8 }], ['gS', 'offS', { width: 8 }],
    // coil delivery: into the hall through the west door (site lane, not public)
    ['rWn', 'coilIn', { lane: 0, site: true, width: 6, dashes: false }],
    ['coilIn', 'coilBay', { lane: 0, site: true, surface: false }],
    ...agvEdges
  ]
}

export const ground = [
  // concrete aprons around the hall + dock yard (dock apron reaches the south road)
  { mat: 'concrete', x: 0, z: -2, w: 186, d: 84, y: 0.025 },
  { mat: 'concrete', x: 70, z: 43, w: 44, d: 12, y: 0.03 },
  // employee parking (south-east), utility yard (south-west), warehouse yard (north)
  { mat: 'asphalt', x: 46, z: 67, w: 52, d: 20, y: 0.03 },
  { mat: 'concrete', x: -56, z: 68, w: 64, d: 22, y: 0.03 },
  { mat: 'concrete', x: -40, z: -64, w: 64, d: 26, y: 0.03 },
  { mat: 'paving', x: 6, z: 70, w: 4, d: 30, y: 0.12 }
]

export const places = {
  // press line people
  pressOp1: { x: -16.5, z: -21.8 }, pressOp2: { x: 40, z: -23.6 }, pressDesk: { x: 3, z: -20.8 },
  stackRack: { x: 46, z: -28 }, dieStore: { x: 60, z: -30 },
  // weld line people (operators stand outside the fence ends)
  loadA: { x: -71.5, z: -6.5, yaw: Math.PI / 2 }, loadB: { x: -71.5, z: 6.5, yaw: Math.PI / 2 },
  unloadA: { x: -20.5, z: -6.5, yaw: -Math.PI / 2 }, unloadB: { x: -20.5, z: 6.5, yaw: -Math.PI / 2 },
  qc1: { x: -4, z: 22.2 }, qc2: { x: 2, z: 22.2 }, qc3: { x: 8, z: 22.2 },
  andonA: { x: -46, z: -1.6 }, andonB: { x: -46, z: 1.6 },
  supermarket: { x: -2, z: 19 }, toteArea: { area: { x: -2, z: 26, w: 18, d: 6 } },
  rackAisle: { x: 72, z: 11 }, dockStage: { x: 70, z: 30 },
  office: { x: -78, z: 24 }, officeDoor: { x: -70, z: 21.5 },
  ctrl1: { x: -76, z: 27.6, yaw: Math.PI }, ctrl2: { x: -73.2, z: 27.6, yaw: Math.PI },
  coilYard: { x: -62, z: -26.5 }, gateS: { x: 6.5, z: 68 }, gateW: { x: -101, z: 5 },
  walkIn: { x: 6, z: 80 }, hallDoor: { x: -62, z: 37.5 }
}
