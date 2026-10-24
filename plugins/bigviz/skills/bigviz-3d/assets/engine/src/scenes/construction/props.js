// Construction pack - static props. Buckets have their own lifecycle (see index.js `buckets`):
// static (always), site (construction period), dig (excavation), final (completion), ceremony.

const PI = Math.PI

const COLORS = { cream: '#e9e1cf', grey: '#c9cdd1', brick: '#c9917a', blue: '#b9c7d6' }

// ---------------------------------------------------------------- city around the block
const city = [
  // north band (z -38 .. -48)
  ...[[-50, 16, 30, 'cream'], [-33, 14, 42, 'grey'], [-17, 12, 24, 'brick'], [14, 14, 36, 'blue'], [30, 12, 20, 'cream'], [48, 16, 46, 'grey']].map(([x, w, h, c], i) => ({ type: 'cityBlock', x, z: -43, params: { w, d: 8, h, seed: 30 + i, color: COLORS[c], sign: i === 3 ? 'ZC DESIGN' : null } })),
  // west band (x -50 .. -62)
  ...[[-28, 18, 'grey'], [-12, 26, 'cream'], [12, 14, 'brick'], [28, 22, 'blue']].map(([z, h, c], i) => ({ type: 'cityBlock', x: -56, z, ry: PI / 2, params: { w: 12, d: 10, h, seed: 50 + i, color: COLORS[c] } })),
  // east band
  ...[[-28, 30, 'blue'], [-12, 16, 'grey'], [12, 24, 'cream'], [28, 12, 'brick']].map(([z, h, c], i) => ({ type: 'cityBlock', x: 56, z, ry: -PI / 2, params: { w: 12, d: 10, h, seed: 70 + i, color: COLORS[c], sign: i === 2 ? '24H 便利店' : null } })),
  // south band, kept low so it never blocks the camera
  { type: 'cityBlock', x: -48, z: 44, ry: PI, params: { w: 14, d: 7, h: 6, seed: 90, color: '#e7d7bf', sign: '筑城咖啡 CAFE' } },
  { type: 'cityBlock', x: 8, z: 44, ry: PI, params: { w: 14, d: 7, h: 5, seed: 91, color: '#d9d2c3', sign: '建材五金' } },
  { type: 'cityBlock', x: 46, z: 44, ry: PI, params: { w: 18, d: 7, h: 7, seed: 92, color: '#cdd6dc', sign: '书店 BOOKS' } },
  { type: 'parkingLines', x: -22, z: 42.2, params: { n: 8, w: 2.7, d: 5 } },
  { type: 'parkingLines', x: 27, z: 42.2, params: { n: 5, w: 2.7, d: 5 } },
  // South side: the street shot walks the kerb side of the south sidewalk (z 36, layout
  // STREET_EYE_Z) looking north at the tower. Everything tall sits south of that line (behind
  // the lens): lamps z 37.9, benches / bins / kiosk / trees z 38.6+; only low kerb items
  // (hydrants, bollards) are north of it. The bus stop is on the site-side kerb.
  { type: 'busStop', x: -20, z: 26.2, ry: 0 },
  { type: 'kiosk', x: -6, z: 39.3, ry: PI },
  { type: 'bench', at: [[-28, 38.6, PI], [-12, 38.6, PI], [16, 38.6, PI], [36, 38.6, PI]] },
  { type: 'trashBin', at: [[-26, 38.4], [-10, 38.4], [20, 38.4], [40, 38.4], [-38, -38.4], [22, -38.4]] },
  { type: 'hydrant', at: [[-34, 34.6], [12, 34.6], [38, -34.6], [-46.6, -18], [46.6, 18]] },
  { type: 'bollard', line: { from: [-6, 34.2], to: [3, 34.2], n: 6 } },
  // (working signals at the ring junctions come from layout roads.signals / prefabs/traffic.js)
  { type: 'zebra', x: -1.5, z: 36.5, params: { w: 8, len: 3, stripes: 9 } },
  { type: 'zebra', x: 42.75, z: 36.5, params: { w: 8, len: 3 } },
  { type: 'zebra', x: -42.75, z: -36.5, params: { w: 8, len: 3 } },
  // street lights: outer ring (always), arms toward the road. South row on the shop side of the
  // walk (z 37.9, 2.6 m arm reaching over the kerb), off the bench / bin spots.
  { type: 'streetLight', params: { arm: 2.6 }, at: [[-36, 37.9, PI], [-15, 37.9, PI], [14, 37.9, PI], [33, 37.9, PI]] },
  { type: 'streetLight', at: [[-36, -35.6, 0], [-12, -35.6, 0], [12, -35.6, 0], [36, -35.6, 0], [-47.6, -20, PI / 2], [-47.6, 20, PI / 2], [47.6, -20, -PI / 2], [47.6, 20, -PI / 2]] }
]

// ---------------------------------------------------------------- construction site (until day ~15.6)
const site = [
  { type: 'siteOffice', x: -27, z: -17, params: { floors: 2, n: 2 } },
  { type: 'toilet', at: [[-33.5, -9], [-32, -9]] },
  { type: 'waterTank', x: -19.5, z: -19 },
  { type: 'bike', at: [[-31, -10.5, 0.2], [-30.2, -10.6, 0.1], [-29.4, -10.4, -0.1]] },
  { type: 'parkingLines', x: -26, z: -21.6, params: { n: 4, w: 2.6, d: 4.4 } },
  { type: 'generator', x: -33, z: 4 },
  { type: 'electricBox', at: [[-33.6, -2, PI / 2], [-4, -19.6, PI], [22, 2, -PI / 2]] },
  { type: 'dumpster', x: -33, z: 8, ry: PI / 2 },
  { type: 'skip', x: 30, z: 10.5 },
  { type: 'trashBin', at: [[-22.5, -9.5], [16, 9]] },
  { type: 'shed', x: 27, z: 18, params: { w: 6, d: 4 } },
  { type: 'bendingTable', x: 27, z: 18 },
  { type: 'sawBench', x: 17.5, z: -14, ry: PI },
  { type: 'weldBench', x: -8, z: -19.5, ry: PI },
  { type: 'mortarMixer', x: -21, z: 7, ry: PI / 2 },
  { type: 'sandPile', x: -25, z: 5.5, params: { r: 2, h: 1.3, kind: 'sand' } },
  { type: 'sandPile', x: -25.5, z: 9.3, params: { r: 1.8, h: 1.1, kind: 'gravel' } },
  { type: 'cementBags', at: [[-22.6, 9.6], [-22.6, 11.2]] },
  { type: 'formStack', at: [[20, -13], [22.2, -13], [20.6, -16.6]] },
  { type: 'planks', at: [[29, -18, 0]] },
  { type: 'tubes', x: 17.5, z: -20.6, params: { n: 12 } },
  { type: 'tubes', x: 31, z: -12, ry: PI / 2 },
  { type: 'pipes', x: 31, z: 3 },
  { type: 'wrapped', at: [[18, -16.2], [19.4, -16.2], [18, -17.6]] },
  { type: 'blocks', at: [[29.5, -4], [29.5, -2.6]] },
  { type: 'container', x: 31, z: -19.5, ry: PI / 2, params: { color: '#2f6a8a' } },
  { type: 'container', x: -19.5, z: -13, ry: 0, params: { color: '#c0503a' } },
  { type: 'barrier', line: { from: [-30, 15.4], to: [-30, 20.4], n: 3 }, ry: PI / 2 },
  { type: 'cone', line: { from: [1.5, 15.4], to: [11, 15.4], n: 6 } },
  { type: 'cone', at: [[-4, 15.5], [-7, 15.5], [11, 9.6], [16, 9.6]] },
  { type: 'jersey', at: [[-8.5, 15.2, 0], [-26, 15.2, 0]] },
  { type: 'workLight', at: [[24, 20, PI], [-28, 21.5, -PI / 2], [-2, -20, 0], [-14, 14.4, PI]] },
  { type: 'sign', x: 2.6, z: 25.4, ry: PI, params: { text: '施工重地 闲人免进', bg: '#c9252f' } },
  { type: 'sign', x: -6, z: 25.4, ry: PI, params: { text: '进入工地 必须戴安全帽', bg: '#1f5fbf' } },
  { type: 'sign', x: -38.6, z: 7.8, ry: -PI / 2, params: { text: '限速 5 km/h', bg: '#f2c230', fg: '#1b1b1b' } },
  { type: 'wheelWash', x: -32.5, z: 12.5, ry: PI / 2 },
  { type: 'gate', x: -1.5, z: 23, ry: 0, params: { w: 8 } },
  { type: 'gate', x: -35, z: 12.5, ry: PI / 2, params: { w: 8 } },
  { type: 'banner', at: [[-22, 23.15, 0], [16, 23.15, 0], [27, 23.15, 0]], params: { text: '安全第一 · 质量为本 · 文明施工' } },
  { type: 'banner', at: [[35.15, -6, PI / 2], [35.15, 14, PI / 2]], params: { text: 'ZC TOWER · 2026 精品工程', bg: '#1f3c6e', w: 8 } },
  { type: 'floodMast', x: -33, z: -21, ry: 0.7, params: { h: 10 }, spot: { target: [-12, 0, 0] } },
  { type: 'floodMast', x: 33, z: 20.5, ry: PI + 0.8, params: { h: 10 }, spot: { target: [8, 0, 2] } },
  { type: 'floodMast', x: 33, z: -21, ry: -0.7, params: { h: 10 } },
  { type: 'floodMast', x: -33, z: 20.5, ry: PI - 0.8, params: { h: 10 } }
]

// ---------------------------------------------------------------- excavation guard rails
const dig = [
  { type: 'guardrail', x: -19.4, z: 0, ry: PI / 2, params: { len: 20 } },
  { type: 'guardrail', x: -4, z: -10.4, params: { len: 30 } },
  { type: 'guardrail', x: 11.4, z: 0, ry: PI / 2, params: { len: 20 } },
  { type: 'cone', line: { from: [-18, 10.6], to: [10, 10.6], n: 8 } }
]

// ---------------------------------------------------------------- completion (rises in on day ~15.7)
const final = [
  { type: 'streetLight', params: { h: 5 }, at: [[-24, 20.5, PI], [-12, 20.5, PI], [6, 20.5, PI], [18, 20.5, PI], [-24, -12, 0], [16, -16, 0]] },
  { type: 'bench', at: [[-18, 14, 0], [10, 14, 0], [-30, 2, PI / 2], [26, -2, -PI / 2]] },
  { type: 'planter', at: [[-12, 18, 0], [4, 18, 0], [-30, 12, PI / 2], [22, 12, PI / 2]], params: { w: 5, d: 1.6 } },
  { type: 'bollard', line: { from: [-10, 22.6], to: [7, 22.6], n: 8 } },
  { type: 'trashBin', at: [[-16, 14.6], [12, 14.6]] },
  { type: 'bike', at: [[14, 16, 0.3], [15, 16, 0.3], [16, 16, 0.3]] }
]

const ceremony = [
  { type: 'ceremonyArch', x: -4, z: 15.5, params: { text: '竣工大吉 · ZC TOWER' } },
  { type: 'carpet', x: -4, z: 15, params: { len: 12 } },
  { type: 'flagPole', at: [[-14, 9, 0], [-12, 9, 0], [4, 9, 0], [6, 9, 0]], params: { color: '#e0402b' } }
]

export const props = [
  ...city.map((p) => ({ ...p, bucket: 'static' })),
  ...site.map((p) => ({ ...p, bucket: 'site' })),
  ...dig.map((p) => ({ ...p, bucket: 'dig' })),
  ...final.map((p) => ({ ...p, bucket: 'final' })),
  ...ceremony.map((p) => ({ ...p, bucket: 'ceremony' }))
]

export const buckets = {
  site: { life: { windows: [[-Infinity, 15.75]], exit: 'sink', dur: 0.25, h: 4 } },
  dig: { life: { windows: [[-Infinity, 4.3]], exit: 'sink', dur: 0.15, h: 2 } },
  final: { life: { windows: [[15.75, Infinity]], enter: 'rise', dur: 0.3, h: 6 } },
  ceremony: { life: { windows: [[16.15, Infinity]], enter: 'drop', dur: 0.12, h: 3 } }
}
