// Tunnel pack - shared geometry and pure state functions (no THREE, no DOM; Node-safe):
// portal / tube axes, the horseshoe profile, the mountain height field and the
// drill-and-blast cycle. Everything time-dependent is a pure function of clock.day, so
// scrubbing the timeline always lands in a consistent state.
// World: metres, +x east, +z south (portal yard); tubes run north (-z) into the mountain.
// Chainage s (m from the portal) -> world z = PZ - s.

export const PZ = 40 //            portal headwall plane
export const XL = -17.5 //         left tube axis: main heading, full drill-and-blast cycle
export const XR = 17.5 //          right tube axis: lags the left face, arch erection
export const W2 = 12 //            half width of each portal notch / headwall
export const HW = 12 //            headwall height
export const TOE = PZ + 22 //      mountain toe in front of the portals
export const F0 = 120 //           left face chainage at day 1 06:00
export const LAG_R = 22 //         right face behind the left face
export const YCUT = 7 //           section-view cut height
export const DAYLIGHT = 0.6
export const KM = 123450 //        chainage of the portal: DK123+450
export const CROWN = 9 //          lining crown height (clear 12.5 x 9 m)

// lateral lanes in the left tube (x relative to the axis) - keep machines from overlapping
export const LANE = { truck: 0.4, shot: 0.3, shotPark: 3.4, jumbo: -3.7, loader: 3.4 }

// ---------------------------------------------------------------- horseshoe profile
const R = 6.25
const YC = 2.75
const R2 = 15
const XC2 = R - R2 // wall arc centre (right wall; mirrored on the left)

/** layer offsets (m outward from the lining intrados) */
export const OFF = { lining: 0, membrane: 0.5, shot: 0.55, rib: 0.62, rock: 0.85 }

/**
 * Outline at offset `off`: n points [x, y] from the left floor corner over the crown to the
 * right floor corner. Same count for every offset so rings of different layers line up.
 */
export function profile(off = 0, n = 48) {
  const nw = 6
  const nc = n - 1 - 2 * nw
  const rw = R2 + off
  const rc = R + off
  const phi0 = -Math.asin(YC / rw)
  const pts = []
  for (let i = 0; i < nw; i++) { const p = phi0 + (i / nw) * -phi0; pts.push([-(XC2 + rw * Math.cos(p)), YC + rw * Math.sin(p)]) }
  for (let i = 0; i <= nc; i++) { const a = Math.PI - (i / nc) * Math.PI; pts.push([rc * Math.cos(a), YC + rc * Math.sin(a)]) }
  for (let i = nw - 1; i >= 0; i--) { const p = phi0 + (i / nw) * -phi0; pts.push([XC2 + rw * Math.cos(p), YC + rw * Math.sin(p)]) }
  return pts
}

/** |x| of the outline at height y (0 above the crown) */
export function halfWidth(off, y) {
  if (y >= YC) { const r = R + off; const d = r * r - (y - YC) ** 2; return d > 0 ? Math.sqrt(d) : 0 }
  const r = R2 + off
  return XC2 + Math.sqrt(r * r - (y - YC) ** 2)
}

/** outline height above x (crown side), -1 outside */
export function crownY(off, x) {
  const r = R + off
  return Math.abs(x) >= r ? -1 : YC + Math.sqrt(r * r - x * x)
}

// ---------------------------------------------------------------- value noise (deterministic)
function hash(i, j) {
  let h = (i * 374761393 + j * 668265263) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}
export function vnoise(x, y) {
  const i = Math.floor(x), j = Math.floor(y)
  const fx = x - i, fy = y - j
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy)
  const a = hash(i, j), b = hash(i + 1, j), c = hash(i, j + 1), d = hash(i + 1, j + 1)
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy
}
export function fbm2(x, y, oct = 4) {
  let v = 0, amp = 0.5, f = 1, tot = 0
  for (let o = 0; o < oct; o++) { v += amp * (vnoise(x * f, y * f) - 0.5); tot += amp; amp *= 0.5; f *= 2.03 }
  return v / tot
}

// ---------------------------------------------------------------- mountain height field
/** natural ground: flat yard, mountain north of the toe line, a river valley and far ranges */
export function natural(x, z) {
  const ax = Math.abs(x)
  const toe = TOE - 10 * smooth(60, 140, ax) + fbm2(x / 90, 3.1) * 6 * smooth(50, 120, ax)
  const t = toe - z
  let h = 0
  if (t > 0) {
    const ts = t < 6 ? (t * t) / 12 : t - 3
    h = 125 * Math.tanh(ts / 120) + fbm2(x / 70, z / 70) * 26 * smooth(5, 70, t) + Math.sin(x / 47 + 1.3) * 7 * smooth(20, 90, t)
    h += smooth(260, 900, t) * (90 + fbm2(x / 260, z / 260, 3) * 180)
  }
  // east / west: spurs far out close the valley
  h += smooth(160, 420, ax) * (25 + fbm2(x / 120, z / 120) * 40)
  // south: a river, then low wooded hills and far ranges
  const v = z - 175
  if (v > 0) h = Math.max(h, (18 + fbm2(x / 90, z / 90) * 30) * smooth(15, 170, v) + smooth(300, 900, v) * (80 + fbm2(x / 300, z / 300, 3) * 200))
  h -= 2.4 * smooth(-45, -15, v) * smooth(25, 0, v)
  return h
}

/** portal cut for one tube axis xp: flat approach, wing slopes, 1:0.75 slope above the headwall */
function cut(x, z, xp) {
  const dx = Math.abs(x - xp)
  if (z <= PZ) {
    // behind the headwall: rise from HW at 1:0.75 (53 deg) inside the notch, wings outside
    const up = HW + (PZ - z) / 0.75
    return dx <= W2 ? up : up + (dx - W2) * 0.9
  }
  // in front: flat floor inside the notch; outside it the wing slopes fall from the wall-line
  // height (continuous with the slope above) to the yard (the wing walls retain the step)
  if (dx <= W2) return 0
  return (HW + (dx - W2) * 0.9) * smooth(PZ + 8 + (dx - W2) * 0.6, PZ, z)
}

/** final ground height */
export function heightAt(x, z) {
  let h = natural(x, z)
  if (z > PZ - 40 && z < TOE + 10 && x > -60 && x < 60) h = Math.min(h, cut(x, z, XL), cut(x, z, XR))
  return h
}

/** true where the terrain is the exposed portal cut (not natural ground) */
export function isCut(x, z) {
  return z > PZ - 40 && z < TOE + 10 && Math.abs(x) < 60 && Math.min(cut(x, z, XL), cut(x, z, XR)) < natural(x, z) - 0.05
}

// ---------------------------------------------------------------- drill-and-blast cycle
// One round = 12 h (2 rounds / day), starting 06:00 and 18:00:
//   drill 0-3 h, charge 3-4, blast 4.0-4.08 (crew retreats 3.9), ventilate -4.5,
//   muck 4.5-7.5, support (arches + mesh + shotcrete) 7.5-10.5, scale / survey 10.5-12.
export const PHASES = [
  { id: 'drill', a: 0, b: 3, name: '钻孔' },
  { id: 'charge', a: 3, b: 4, name: '装药' },
  { id: 'blast', a: 4, b: 4.5, name: '爆破 · 通风' },
  { id: 'muck', a: 4.5, b: 7.5, name: '出渣' },
  { id: 'support', a: 7.5, b: 10.5, name: '初期支护' },
  { id: 'scale', a: 10.5, b: 12, name: '找顶 · 测量' }
]
const BLAST_H = 4

/** day fraction -> hours since day 1 06:00 */
export function absHour(day) {
  const d = Math.floor(day)
  const f = day - d
  const h = f < DAYLIGHT ? (f / DAYLIGHT) * 14 : 14 + ((f - DAYLIGHT) / (1 - DAYLIGHT)) * 10
  return (d - 1) * 24 + h
}
/** inverse of absHour (storyboards: pick a moment of the cycle) */
export function dayAt(abs) {
  const d = Math.floor(abs / 24)
  const h = abs - d * 24
  return 1 + d + (h < 14 ? (h / 14) * DAYLIGHT : DAYLIGHT + ((h - 14) / 10) * (1 - DAYLIGHT))
}

const blasts = (abs) => (abs < BLAST_H ? 0 : Math.floor((abs - BLAST_H) / 12) + 1)

/** full construction state at `day` (both tubes) */
export function tunnelState(day) {
  const abs = Math.max(0, absHour(day))
  const r = abs % 12
  const ph = PHASES.find((p) => r >= p.a && r < p.b) || PHASES[0]
  const k = (r - ph.a) / (ph.b - ph.a)
  const n = blasts(abs)
  const F = F0 + 3 * n
  const Fc = F0 + abs * 0.25 //   continuous advance (6 m / day) for the trailing gantries
  // support front: catches up with the face during the support phase of each round
  const sup = r >= 7.5 ? clamp01((r - 7.5) / 3) : r < BLAST_H ? 1 : 0
  const shot = F - 3 * (1 - (r >= BLAST_H ? sup : 1)) - 0.6
  const ribs = F - 3 * (1 - (r >= BLAST_H ? clamp01(sup * 1.4) : 1)) - 0.3
  // second lining: 12 m jumbo, one cast every 2 days (move 6 h -> pour + cure 42 h)
  const u = abs + 12
  const cyc = Math.floor(u / 48)
  const cu = u % 48
  const move = clamp01(cu / 6)
  const jRear = 42 + 12 * (cyc - 1) + 12 * move
  const poured = cu >= 20
  // finished lining stays put while the jumbo moves on to the next bay
  const lined = 42 + 12 * cyc + (poured ? 12 : 0)
  const pour = cu >= 8 && cu < 20 ? (cu - 8) / 12 : cu >= 20 ? 1 : 0
  return {
    abs, r, phase: ph.id, phaseName: ph.name, k, round: Math.floor(abs / 12), blasts: n,
    sinceBlast: r >= BLAST_H ? r - BLAST_H : r + 12 - BLAST_H,
    L: {
      face: F, Fc, shot, ribs, lined, jRear, jMoving: move < 1, pour, poured,
      membrane: Fc - 54, trestle: Fc - 41, wpj: Fc - 58,
      muck: ph.id === 'blast' ? clamp01((r - BLAST_H) / 0.1) : ph.id === 'muck' ? 1 - k * 0.92 : 0,
      holes: ph.id === 'drill' ? k : ph.id === 'charge' ? 1 : 0,
      wires: ph.id === 'charge' ? k : 0,
      step: F - lined
    },
    R: { face: F - LAG_R, shot: F - LAG_R - 1.2, ribs: F - LAG_R - 0.5, lined: F - 92 }
  }
}

// ---------------------------------------------------------------- invert trestle (24 m: 4 m ramps + 16 m deck)
export const TRESTLE = { half: 12, deck: 8, h: 1.3, w: 2.6 }
/** deck surface height at chainage s for a trestle centred at tc (0 off the trestle) */
export function deckY(s, tc) {
  const d = Math.abs(s - tc)
  if (d <= TRESTLE.deck) return TRESTLE.h
  if (d < TRESTLE.half) return (TRESTLE.h * (TRESTLE.half - d)) / (TRESTLE.half - TRESTLE.deck)
  return 0
}

export const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t) }
export const clamp01 = (v) => Math.min(1, Math.max(0, v))
