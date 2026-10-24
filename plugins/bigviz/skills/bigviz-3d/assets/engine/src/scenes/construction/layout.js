// Construction pack - static layout: board, terrain pit, ground layers, road graph, places.
// Coordinates in metres. +x east, +z south (toward the default camera). Board 124 x 96.

export const BOARD = { w: 124, d: 96 }
export const BLDG = { x: -4, z: 0, w: 24, d: 14 }
export const PIT = { x: -4, z: 0, w: 30, d: 20 }
export const TC = { x: 2, z: -15.5 }
export const HOIST = { x: -18.4, z: 0 }

export const terrain = {
  surface: 'grass',
  pits: [{ id: 'pit', ...PIT, drive: { 'object.position.y': [[1, -0.05], [1.6, -1.2], [2.4, -2.4], [3.6, -2.4], [4.2, 0.0]] } }]
}

export const ground = [
  // site interior: soil with the pit cut out
  { id: 'site', mat: 'soil', w: 70, d: 46, holes: [PIT], y: 0.02 },
  // hardened haul roads + office pad
  { mat: 'concrete', x: 0, z: 13, w: 68, d: 5, y: 0.035 },
  { mat: 'concrete', x: -1.5, z: 18.6, w: 7, d: 7.2, y: 0.035 },
  { mat: 'concrete', x: 13.5, z: 0.5, w: 5, d: 21, y: 0.035 },
  { mat: 'concrete', x: -27, z: -13, w: 16, d: 14, y: 0.035 },
  { mat: 'gravel', x: 24.5, z: -6, w: 10, d: 18, y: 0.03 },
  // sidewalks (raised curbs) - outer ring with access-road crossings, inner ring with gate gaps
  { type: 'frame', mat: 'paving', w: 100, d: 76, iw: 94, id: 70, y: 0.15, holes: [{ x: 48.5, z: 0, w: 2.9, d: 11.6 }, { x: -48.5, z: 0, w: 2.9, d: 11.6 }, { x: 0, z: -36.5, w: 11.6, d: 2.9 }] },
  { type: 'frame', mat: 'paving', w: 77, d: 53, iw: 70, id: 46, y: 0.15, holes: [{ x: -1.5, z: 24.75, w: 7.8, d: 3.1 }, { x: -36.75, z: 12.5, w: 3.1, d: 7.8 }] },
  // city bands
  { mat: 'paving', x: 0, z: -43, w: 124, d: 10, y: 0.03 },
  { mat: 'paving', x: -56, z: 0, w: 12, d: 76, y: 0.03 },
  { mat: 'paving', x: 56, z: 0, w: 12, d: 76, y: 0.03 },
  { mat: 'paving', x: 0, z: 43, w: 124, d: 10, y: 0.03 },
  // final plaza (rises in after the fence comes down)
  { id: 'plaza', mat: 'paving', w: 70, d: 46, y: 0.07, life: { windows: [[15.5, Infinity]], dur: 0.3 } },
  { id: 'lawnW', mat: 'grass', x: -26, z: -2, w: 16, d: 24, y: 0.09, life: { windows: [[15.7, Infinity]], dur: 0.25 } },
  { id: 'lawnE', mat: 'grass', x: 20, z: -6, w: 22, d: 18, y: 0.09, life: { windows: [[15.7, Infinity]], dur: 0.25 } }
]

// ring: one lane per direction (sidewalk / fence leave no room for two); markings drawn by
// the traffic dressing. Stubs off the board: two lanes per direction, 2.75 m lanes.
const R = { lane: 2.1, width: 8.5, dashes: false }
const S = { lanes: 2, laneW: 2.75, median: 0.1, width: 11.4, stub: true, surface: false }
export const roads = {
  lane: 2.1,
  // signalised T-junctions (ring x access stub); timings in sim seconds
  signals: [
    { node: 'rE', id: 'signal-east', name: '东口路口信号灯' },
    { node: 'rN', id: 'signal-north', name: '北口路口信号灯', offset: 16 },
    { node: 'rW', id: 'signal-west', name: '西口路口信号灯', offset: 31 }
  ],
  signalTiming: { green: 14, yellow: 3, allRed: 1.5, walk: 7, pedClear: 5 },
  nodes: {
    rNW: [-42.75, -30.75], rN: [0, -30.75], rNE: [42.75, -30.75], rE: [42.75, 0], rSE: [42.75, 30.75], rS: [-1.5, 30.75], bS: [-20, 30.75], rSW: [-42.75, 30.75], rW: [-42.75, 0], rWG: [-42.75, 12.5],
    offE: [57.75, 0], offW: [-57.75, 0], offN: [0, -43.75],
    gS: [-1.5, 22], gW: [-37, 12.5], hP: [-31, 12.5], hC: [-5, 12.5], hS: [-1.5, 12.5], hE: [13.5, 12.5], yN: [13.5, -4]
  },
  edges: [
    ['rNW', 'rN', R], ['rN', 'rNE', R], ['rNE', 'rE', R], ['rE', 'rSE', R],
    ['rSE', 'rS', R], ['rS', 'bS', R], ['bS', 'rSW', R], ['rSW', 'rWG', R], ['rWG', 'rW', R], ['rW', 'rNW', R],
    ['rE', 'offE', S], ['rW', 'offW', S], ['rN', 'offN', S],
    ['rS', 'gS', { lane: 0, site: true, width: 7, dashes: false }], ['gS', 'hS', { lane: 0, site: true, width: 7, dashes: false }],
    ['rWG', 'gW', { lane: 0, site: true, width: 7, dashes: false }], ['gW', 'hP', { lane: 0, site: true, surface: false }],
    ['hP', 'hC', { lane: 0, site: true, surface: false }], ['hC', 'hS', { lane: 0, site: true, surface: false }], ['hS', 'hE', { lane: 0, site: true, surface: false }],
    ['hE', 'yN', { lane: 0, site: true, surface: false }]
  ]
}

export const places = {
  gate: { x: -1.5, z: 23 },
  flagman: { x: 3.2, z: 24.2, yaw: Math.PI },
  spotter: { x: -28.5, z: 19.5, yaw: -2.4 },
  mixerBay: { x: -24.7, z: 17, yaw: -Math.PI / 2 },
  skipSpot: { x: -18.6, z: 17 },
  pumpBay: { x: -14, z: 17, yaw: Math.PI / 2 },
  digTruck: { x: -5, z: 12.5 },
  excavator: { x: -4, z: 5, y: -2.4, yaw: Math.PI },
  heap: { x: 4, z: 2.5 },
  hoistBase: { x: -21.2, z: 1.2 },
  hoistIn: { x: -20.6, z: 0 },
  office: { x: -27, z: -14.5, yaw: 0 },
  officeYard: { x: -26, z: -9, w: 10, d: 3.5 },
  pickPallet: { x: 25.25, z: -8.25 },
  pickRebar: { x: 23.8, z: 6.5 },
  pickForm: { x: 21, z: -13 },
  rigGround: { x: 20.5, z: -2, yaw: Math.PI / 2 },
  bendTable: { x: 27, z: 16.2, yaw: Math.PI },
  rebarStack: { x: 24, z: 7.5 },
  sawBench: { x: 17.5, z: -14, yaw: Math.PI },
  formStack: { x: 21, z: -13 },
  mortar: { x: -21, z: 8.2, yaw: Math.PI / 2 },
  weldBench: { x: -8, z: -18.4, yaw: Math.PI },
  stockSlot: { x: 24.5, z: -9 },
  flatbedStop: { x: 13.5, z: -2 },
  forkWait: { x: 18.5, z: 6.5 },
  // parked crane chassis (11 m, centred) spans z -18.5..-7.5: clear of the flatbed at flatbedStop
  // (9.4 m, z -6.7..2.7) so the two can be on the yard lane at the same time without touching
  mcPark: { x: 13.5, z: -13, yaw: Math.PI },
  sectionPile: { x: 17.5, z: -20.2 },
  panelStack: { x: 18.5, z: -16 },
  pitEdgeS: { x: -12, z: 11.2, yaw: Math.PI },
  pitEdgeN: { x: 4, z: -11.2, yaw: 0 },
  plaza: { x: -4, z: 13, w: 30, d: 8 },
  ceremony: { x: -4, z: 11 },
  arch: { x: -4, z: 15.5 },
  survey: { x: 6, z: 11.5 },
  walkS: { x: -1.5, z: 37.3 },
  // bus stop on the inner (site-side) kerb of the south road; the bus loops anticlockwise
  busStop: { x: -20, z: 25.9 }
}

/** Outer and inner sidewalk loops for pedestrians. The south leg of the outer loop keeps to the
 *  shop side (z 37.3): the street camera walks the kerb side (z 36) and looks north, so people
 *  pass behind the lens instead of filling the foreground. */
export const SIDEWALK_OUT = [[-48.5, 37.3], [48.5, 37.3], [48.5, -36.5], [-48.5, -36.5]]
/** street shot corridor (camera path line) - props and trees stay off the north side of it */
export const STREET_EYE_Z = 36
export const SIDEWALK_IN = [[-36.75, 24.75], [36.75, 24.75], [36.75, -24.75], [-36.75, -24.75]]
