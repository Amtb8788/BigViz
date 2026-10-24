// Bridge pack - geometry constants and the analytic site: ground height, deck profile,
// girder depth, walkable surfaces. Everything else (terrain mesh, piers, works) reads these.
// Coordinates in metres. +x east (bridge axis), +z south (river flows +z, downstream; the
// default camera stands downstream). Water level y = WATER. Two carriageways: downstream
// (z > 0, the one being built) and upstream (z < 0).

export const PI = Math.PI
export const WATER = -4
export const BOARD = { w: 900, d: 520 }

// carriageways: centre z, deck width
export const DN = 9.25
export const UP = -9.25
export const DECK_W = 16.5
// main bridge (80 + 140 + 80): main piers, transition piers
export const MP = 70
export const TP = 150
// main piers: twin thin walls per carriageway (x offsets from the pier centre), wall size
export const WALL_X = [-3.1, 3.1]
export const WALL = { t: 2.2, w: 8 }
// pile cap + cofferdam (shared by both carriageways)
export const CAP = { w: 24, d: 40, top: -1.5, h: 5 }
export const COFFER = { w: 30, d: 46, top: 0.8, bottom: -9.5 }
// girder: 0# block half length, segment lengths (17 per cantilever), closures
export const HALF0 = 6
export const SEGS = [3, 3, 3, 3, 3, 3.5, 3.5, 3.5, 3.5, 4, 4, 4, 4, 4.5, 4.5, 4.5, 4.5]
export const TIPS = SEGS.reduce((a, s) => (a.push(a[a.length - 1] + s), a), [HALF0])
export const TIP = TIPS[TIPS.length - 1] // 69: main span closure 2 m at x = 0
export const SIDE_CIP = { from: MP + TIP + 2, to: TP - 0.5 } // cast on falsework (141..149.5)
export const H_PIER = 8.5
export const H_MID = 3.2

/** Deck top elevation (crest curve over the main bridge, 2.5 % approach grades) */
export function deckY(x) {
  const a = Math.abs(x)
  if (a <= TP) return 49 - 2.7e-4 * a * a
  return 49 - 2.7e-4 * TP * TP - 0.025 * (a - TP)
}
/** Deck slope dy/dx */
export function deckSlope(x) {
  const a = Math.abs(x)
  const s = a <= TP ? -2 * 2.7e-4 * a : -0.025
  return x < 0 ? -s : s
}
/** Box girder depth at distance u from the nearest main pier centre */
export function girderDepth(x) {
  const u = Math.min(Math.abs(x - MP), Math.abs(x + MP))
  if (u <= HALF0) return H_PIER
  const k = Math.min(1, (u - HALF0) / (TIP + 1 - HALF0))
  return H_MID + (H_PIER - H_MID) * Math.pow(1 - k, 1.7)
}

// approach viaducts: T-beam spans (30 m), pier lines; west = being erected by the launcher
export const SPAN = 30
export const ABUT_W = -360
export const WEST_PIERS = [-180, -210, -240, -270, -300, -330]
export const EAST_PIERS = Array.from({ length: 16 }, (_, i) => 180 + i * 30)
export const BEAM = { depth: 2.0, len: 29.9, n: 7, pitch: 2.357 }
export const capTop = (x) => deckY(x) - 2.1
export const YARD = { x0: -470, x1: -368, z0: -50, z1: 58, y: deckY(ABUT_W) }

const sm = (a, b, v) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t) }
const n2 = (x, z) => Math.sin(x * 0.021 + z * 0.013) * Math.sin(z * 0.017 - x * 0.006) + 0.5 * Math.sin(x * 0.053 + 1.3) * Math.sin(z * 0.047 + 0.4)

/** Natural ground height (river channel, banks, west bluff + precast yard plateau, hills) */
export function groundY(x, z) {
  const wob = Math.sin(z * 0.011) * 6 + Math.sin(z * 0.037 + 1) * 2
  const a = Math.abs(x - wob * 0.3)
  // channel bed -10 mid river, waterline (y -4) near |x| 118, dry bank y 0 from |x| 142
  let y
  if (a < 110) y = -10 + (a / 110) * (a / 110) * 5
  else y = -5 + sm(110, 142, a) * 5
  // west bluff up to the precast yard plateau (graded flat)
  if (x < -150) y += sm(-150, -372, x) * (YARD.y - 6) + sm(-356, -370, x) * 6
  // far landscape: hills beyond the yard and up-river, gentle elsewhere
  const far = sm(60, 220, Math.abs(z)) * (x < 0 ? 1 : 0.35) + (x < -480 ? sm(-480, -700, x) : 0)
  y += n2(x, z) * (0.12 + sm(70, 160, Math.abs(z)) * 0.5 + far * 7) +(x < -480 ? sm(-480, -900, x) * 60 : 0) + (z < -260 ? sm(-260, -900, z) * 45 * (x < 0 ? 1 : 0.4) : 0)
  // keep work pads flat: yard, east bank site, haul roads
  if (x < -366 && x > -480 && z > YARD.z0 - 10 && z < YARD.z1 + 10) y = YARD.y
  return y
}

// trestles from each bank to the main pier platforms (downstream side)
export const TRESTLE = { z: 34, w: 6, y: 0.3, xNear: 80, xFar: 142 }
export const PLATFORM = { x0: 52, x1: 92, z0: 23.5, z1: 31.5, y: 0.3 }
export const PAD = { x0: 141, x1: 166, z0: 22, z1: 48, y: 0.34 }
export const HAUL = { x: 154, w: 7 }

/** Walkable surface under (x, z): trestle / platform / cofferdam top / cap / ground */
export function surfaceAt(x, z, tag) {
  const ax = Math.abs(x)
  if (tag === 'deck') return deckY(x) + 0.05
  if (tag === 'cap') return CAP.top
  if (ax >= TRESTLE.xNear - 1 && ax <= TRESTLE.xFar + 1 && Math.abs(z - TRESTLE.z) <= TRESTLE.w / 2 + 0.5) return TRESTLE.y
  if (ax >= PLATFORM.x0 && ax <= PLATFORM.x1 && z >= PLATFORM.z0 && z <= PLATFORM.z1) return PLATFORM.y
  if (ax >= PAD.x0 && ax <= PAD.x1 && z >= PAD.z0 && z <= PAD.z1) return PAD.y
  if (ax > TRESTLE.xFar && ax < 200 && z > -60 && z < 140) return 0.04
  return Math.max(groundY(x, z), ax > TRESTLE.xFar ? 0 : -99)
}
