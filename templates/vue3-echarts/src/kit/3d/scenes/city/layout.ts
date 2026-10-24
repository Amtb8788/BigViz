/**
 * Procedural city layout as plain data (no three.js): a square road grid clipped to a ragged
 * circle, a winding river, a dense downtown plus a few secondary hubs, and each block subdivided
 * into lots with towers, podiums and spires. Deterministic for a given seed.
 */
import { between, mulberry32, type Random } from '@/kit/core/random'

/** World units. The city spans roughly -RADIUS … RADIUS on x and z. */
export const CITY = {
  /** Radius of the built-up area; normalised alert coords ±1 map to ±RADIUS */
  radius: 1000,
  /** Road centre-line spacing */
  pitch: 92,
  /** Road width (block = pitch - road) */
  road: 18,
  /** Every n-th road is a major avenue (brighter traffic) */
  majorEvery: 4,
  /** Hard cap on building instances */
  maxBuildings: 2400
} as const

export interface Building {
  /** Footprint centre */
  x: number
  z: number
  /** Footprint size */
  w: number
  d: number
  /** Height of the box and the y of its base */
  h: number
  y: number
  /** Per-building random in [0, 1) for window patterns */
  seed: number
}

export interface Road {
  /** 'x' runs along x at z = offset; 'z' runs along z at x = offset */
  axis: 'x' | 'z'
  offset: number
  /** Clipped extent along the road axis */
  from: number
  to: number
  major: boolean
}

export interface River {
  /** Centre line: x = offset + amp · sin(z · freq + phase) */
  offset: number
  amp: number
  freq: number
  phase: number
  /** Half width of water + banks */
  half: number
}

export interface CityLayout {
  seed: number
  buildings: Building[]
  roads: Road[]
  river: River
  /** Downtown centre (where the scan ring starts) */
  core: { x: number; z: number }
  /** Tallest building height, for the shader gradient */
  maxHeight: number
}

/** Ragged edge: radius multiplier for a direction, from three low-frequency sines */
const edgeFactor = (angle: number, k: readonly number[]) =>
  1 + 0.07 * Math.sin(angle * 3 + (k[0] ?? 0)) + 0.05 * Math.sin(angle * 5 + (k[1] ?? 0)) + 0.03 * Math.sin(angle * 9 + (k[2] ?? 0))

export const riverX = (r: River, z: number) => r.offset + r.amp * Math.sin(z * r.freq + r.phase)

/** Build the layout for a seed */
export function generateCity(seed: number): CityLayout {
  const rnd = mulberry32(seed)
  const { radius: R, pitch, road } = CITY

  const river: River = {
    offset: between(rnd, 0.35, 0.55) * R * (rnd() < 0.5 ? -1 : 1),
    amp: between(rnd, 90, 160),
    freq: between(rnd, 0.0018, 0.0028),
    phase: between(rnd, 0, Math.PI * 2),
    half: between(rnd, 38, 52)
  }

  // Downtown slightly off-centre, away from the river; 2–3 secondary hubs
  const core = { x: -Math.sign(river.offset) * between(rnd, 40, 120), z: between(rnd, -120, 60) }
  const hubs = Array.from({ length: 2 + Math.floor(rnd() * 2) }, () => {
    const a = between(rnd, 0, Math.PI * 2)
    const d = between(rnd, 0.4, 0.7) * R
    return { x: Math.cos(a) * d, z: Math.sin(a) * d, k: between(rnd, 0.35, 0.6) }
  })
  const edge = [between(rnd, 0, 6), between(rnd, 0, 6), between(rnd, 0, 6)] as const

  /** 0 (outskirts) … ~1 (downtown) */
  const density = (x: number, z: number) => {
    let v = Math.exp(-((x - core.x) ** 2 + (z - core.z) ** 2) / (2 * 260 ** 2))
    for (const h of hubs) v = Math.max(v, h.k * Math.exp(-((x - h.x) ** 2 + (z - h.z) ** 2) / (2 * 140 ** 2)))
    return v
  }

  const buildings: Building[] = []
  const block = pitch - road
  const n = Math.ceil(R / pitch) + 1

  for (let i = -n; i < n; i++) {
    for (let j = -n; j < n; j++) {
      // Block centre sits between road centre lines
      const cx = (i + 0.5) * pitch
      const cz = (j + 0.5) * pitch
      const dist = Math.hypot(cx, cz)
      const limit = R * edgeFactor(Math.atan2(cz, cx), edge)
      if (dist > limit) continue
      if (Math.abs(cx - riverX(river, cz)) < river.half + block * 0.5) continue
      // A few parks / plazas
      if (rnd() < 0.05) continue
      const dens = density(cx, cz)
      // Outskirts thin out towards the edge
      const edgeFade = 1 - Math.max(0, (dist - limit * 0.7) / (limit * 0.3))
      if (rnd() > 0.35 + 0.65 * edgeFade) continue
      subdivide(rnd, buildings, cx, cz, block, dens, edgeFade)
    }
  }

  // Landmark: a cluster of the tallest towers right at the core
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2 + between(rnd, -0.3, 0.3)
    const d = k === 0 ? 0 : between(rnd, 50, 110)
    const x = core.x + Math.cos(a) * d
    const z = core.z + Math.sin(a) * d
    const h = k === 0 ? between(rnd, 380, 430) : between(rnd, 250, 320)
    const w = between(rnd, 26, 34)
    buildings.push({ x, z, w, d: w, h, y: 0, seed: rnd() })
    buildings.push({ x, z, w: w * 0.18, d: w * 0.18, h: h * 0.22, y: h, seed: rnd() })
  }

  if (buildings.length > CITY.maxBuildings) buildings.length = CITY.maxBuildings
  const maxHeight = buildings.reduce((m, b) => Math.max(m, b.y + b.h), 1)

  return { seed, buildings, roads: buildRoads(R, pitch, n), river, core, maxHeight }
}

/** Split one block into lots; dense blocks get fewer, taller lots with podiums */
function subdivide(rnd: Random, out: Building[], cx: number, cz: number, size: number, dens: number, fade: number) {
  const cols = dens > 0.55 ? 2 : rnd() < 0.5 ? 2 : 3
  const rows = dens > 0.55 ? (rnd() < 0.5 ? 1 : 2) : rnd() < 0.5 ? 2 : 3
  const gap = 5
  const lw = (size - gap * (cols - 1)) / cols
  const ld = (size - gap * (rows - 1)) / rows
  for (let a = 0; a < cols; a++) {
    for (let b = 0; b < rows; b++) {
      if (rnd() < 0.08) continue
      const x = cx - size / 2 + lw / 2 + a * (lw + gap)
      const z = cz - size / 2 + ld / 2 + b * (ld + gap)
      const w = lw * between(rnd, 0.72, 0.96)
      const d = ld * between(rnd, 0.72, 0.96)
      // Heavy tail: most buildings are low, a few downtown ones soar
      const base = 10 + 22 * fade
      const tall = dens ** 1.4 * between(rnd, 60, 260) * (rnd() < 0.35 ? 1.5 : 1)
      const h = base + tall + between(rnd, 0, 18)
      if (dens > 0.35 && h > 90 && rnd() < 0.6) {
        // Podium + slimmer tower on top
        const ph = between(rnd, 14, 26)
        out.push({ x, z, w, d, h: ph, y: 0, seed: rnd() })
        out.push({ x, z, w: w * between(rnd, 0.55, 0.75), d: d * between(rnd, 0.55, 0.75), h: h - ph, y: ph, seed: rnd() })
      } else {
        out.push({ x, z, w, d, h, y: 0, seed: rnd() })
      }
    }
  }
}

/** Every grid line, clipped to the circle; every `majorEvery`-th line is an avenue */
function buildRoads(R: number, pitch: number, n: number): Road[] {
  const roads: Road[] = []
  const reach = R * 1.08
  for (let i = -n + 1; i < n; i++) {
    const offset = i * pitch
    if (Math.abs(offset) >= reach) continue
    const half = Math.sqrt(reach * reach - offset * offset)
    const major = i % CITY.majorEvery === 0
    roads.push({ axis: 'x', offset, from: -half, to: half, major })
    roads.push({ axis: 'z', offset, from: -half, to: half, major })
  }
  return roads
}
