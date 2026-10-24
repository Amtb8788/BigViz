// Street pack - static layout: 中山路 (E-W, 8 lanes + bike lanes) x 解放路 (N-S, 6 lanes +
// bike lanes), one signalised junction at the origin. Metres, +x east, +z south.
// Cross-section per direction, from the axis outward:
//   中山路  island 1.6 | left | through | through | bus (+ right) 3.25 m each | line 0.3 | bike 2.5 | kerb
//   解放路  island 1.2 | left | through | through + right 3.25 m each       | line 0.3 | bike 2.25 | kerb

export const BOARD = { w: 300, d: 240 }
export const HX = BOARD.w / 2
export const HZ = BOARD.d / 2
export const SW_Y = 0.18 // sidewalk top
export const ROAD_Y = 0.06 // asphalt top (builder road strips)
export const LANE_W = 3.25

const laneOffs = (median, n) => Array.from({ length: n }, (_, i) => median + LANE_W * (i + 0.5))
// offs: lane centres from the axis (right of travel), inner (left turn) -> kerb
export const EW = { median: 1.6, lanes: 4, hw: 17.4, edge: 14.6, bike: 16.1, island: 1.35, offs: laneOffs(1.6, 4) }
export const NS = { median: 1.2, lanes: 3, hw: 13.5, edge: 10.95, bike: 12.3, island: 0.7, offs: laneOffs(1.2, 3) }

// junction geometry (same numbers as roads.junction -> systems/traffic.js junctionGeometry)
export const CROSS = { w: 4, gap: 0.6, line: 1 }
export const EW_CROSS = NS.hw + CROSS.gap + CROSS.w / 2 // 16.1  crosswalk centre on the E / W legs (|x|)
export const NS_CROSS = EW.hw + CROSS.gap + CROSS.w / 2 // 20.0  on the N / S legs (|z|)
export const EW_STOP = NS.hw + CROSS.gap + CROSS.w + CROSS.line // 19.1
export const NS_STOP = EW.hw + CROSS.gap + CROSS.w + CROSS.line // 23.0
// sidewalk walking lines (|z| along 中山路, |x| along 解放路) and shop fronts
export const WALK_EW = 21.2
export const WALK_NS = 17.0
export const FRONT_EW = 24.4
export const FRONT_NS = 19.5
// far-side bus stops (stop point of the bus centre, kerb lane)
export const BUS_STOP = { E: { x: 52, z: EW.offs[3] }, W: { x: -52, z: -EW.offs[3] } }

const EWE = { lanes: 4, laneW: LANE_W, median: EW.median, width: EW.hw * 2, dashes: false }
const NSE = { lanes: 3, laneW: LANE_W, median: NS.median, width: NS.hw * 2, dashes: false }
// invisible site-only links: board-edge nodes that widen the sidewalk-ring openings of the
// surrounding city (render/surroundings.js opens 9 m per node near the board edge)
const LINK = { site: true, surface: false, lane: 0, width: 1 }

export const roads = {
  lane: 2,
  signals: [{ node: 'C', id: 'sig-c', name: '中山路 × 解放路 信号机' }],
  // the pack replaces the controller with a 6-phase one (signals.js); these are fallbacks
  signalTiming: { green: 30, yellow: 3, allRed: 3, walk: 20, pedClear: 9 },
  junction: { crossW: CROSS.w, crossGap: CROSS.gap, lineGap: CROSS.line },
  nodes: {
    C: [0, 0],
    // each leg is split 50 m out: solid lane lines toward the stop line, dashed beyond
    E1: [55, 0], E2: [HX, 0], W1: [-55, 0], W2: [-HX, 0],
    N1: [0, -50], N2: [0, -HZ], S1: [0, 50], S2: [0, HZ],
    eA: [HX, -13], eB: [HX, -8.5], eC: [HX, 8.5], eD: [HX, 13],
    wA: [-HX, -13], wB: [-HX, -8.5], wC: [-HX, 8.5], wD: [-HX, 13],
    nA: [-9, -HZ], nB: [9, -HZ], sA: [-9, HZ], sB: [9, HZ]
  },
  edges: [
    ['C', 'E1', EWE], ['E1', 'E2', EWE], ['C', 'W1', EWE], ['W1', 'W2', EWE],
    ['C', 'N1', NSE], ['N1', 'N2', NSE], ['C', 'S1', NSE], ['S1', 'S2', NSE],
    ['eA', 'eB', LINK], ['eB', 'E2', LINK], ['E2', 'eC', LINK], ['eC', 'eD', LINK],
    ['wA', 'wB', LINK], ['wB', 'W2', LINK], ['W2', 'wC', LINK], ['wC', 'wD', LINK],
    ['nA', 'N2', LINK], ['N2', 'nB', LINK], ['sA', 'S2', LINK], ['S2', 'sB', LINK]
  ]
}

export const terrain = { surface: 'concrete' }

const corners = [[1, 1], [1, -1], [-1, 1], [-1, -1]]
export const ground = [
  // four corner blocks: sidewalk + building plots, raised 18 cm above the asphalt
  ...corners.map(([sx, sz]) => ({ mat: 'paving', x: sx * (NS.hw + HX) / 2, z: sz * (EW.hw + HZ) / 2, w: HX - NS.hw, d: HZ - EW.hw, y: SW_Y, t: 0.24 })),
  // 中山路 central islands (kerb + planted bed) from the stop line out; the crosswalk crosses at grade
  ...[1, -1].flatMap((s) => [
    { mat: 'concrete', x: s * (18.6 + HX) / 2, w: HX - 18.6, d: EW.island * 2, y: 0.2, t: 0.22 },
    { mat: 'grass', x: s * (19.4 + HX) / 2, w: HX - 19.8, d: EW.island * 2 - 0.5, y: 0.22, t: 0.04 }
  ]),
  // 解放路 narrow island carrying the median fence
  ...[1, -1].map((s) => ({ mat: 'concrete', z: s * (22.5 + HZ) / 2, w: NS.island * 2, d: HZ - 22.5, y: 0.2, t: 0.22 }))
]

export const places = {
  centre: { x: 0, z: 0 },
  busE: { x: BUS_STOP.E.x, z: BUS_STOP.E.z, yaw: Math.PI / 2 },
  busW: { x: BUS_STOP.W.x, z: BUS_STOP.W.z, yaw: -Math.PI / 2 },
  shelterE: { x: 52, z: 19.6 },
  shelterW: { x: -52, z: -19.6 }
}
