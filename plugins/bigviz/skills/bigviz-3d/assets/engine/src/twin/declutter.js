// Pure marker declutter / picking helpers (no three.js, unit-tested in node):
//   viewMode    camera pose -> 'eye' (street / walk level) | 'aerial'
//   markerTier  distance + occlusion + alarm -> { show, scale, opacity }
//   segBoxHit   does the camera->marker segment pass through an axis-aligned box
//   fanOut      screen-space clusters of overlapping markers -> pixel offsets on a ring
//   cyclePick   overlapping hits + current selection -> next id to select

/** human-eye shots: camera low, or a wide lens close to the ground */
export function viewMode({ y, fov = 32, mode = 'free' }) {
  if (mode === 'walk' || y < 4 || (fov >= 50 && y < 9)) return 'eye'
  return 'aerial'
}

const TIERS = {
  // full size until `near`, shrink to `minScale` at `far`, non-alarming hidden past `cull`
  aerial: { near: 120, far: 230, cull: 270, minScale: 0.7 },
  eye: { near: 18, far: 45, cull: 45, minScale: 0.6 }
}
export const OCCLUDED_OPACITY = 0.25

/**
 * @param {{ dist: number, mode?: 'eye'|'aerial', occluded?: boolean, alarm?: boolean, selected?: boolean, all?: boolean }} o
 * @returns {{ show: boolean, scale: number, opacity: number }}
 */
export function markerTier({ dist, mode = 'aerial', occluded = false, alarm = false, selected = false, all = false }) {
  if (all) return { show: true, scale: 1, opacity: 1 }
  if (selected) return { show: true, scale: 1, opacity: occluded ? 0.7 : 1 }
  const t = TIERS[mode] || TIERS.aerial
  const k = Math.min(1, Math.max(0, (dist - t.near) / (t.far - t.near)))
  const scale = 1 - k * (1 - t.minScale)
  // alarms are never hidden or shrunk below 0.85, and stay readable through walls
  if (alarm) return { show: true, scale: Math.max(0.85, scale), opacity: occluded ? 0.7 : 1 }
  if (dist > t.cull) return { show: false, scale, opacity: 0 }
  // at eye level, markers hidden behind buildings are dropped instead of ghosted
  if (occluded && mode === 'eye') return { show: false, scale, opacity: 0 }
  return { show: true, scale, opacity: occluded ? OCCLUDED_OPACITY : 1 }
}

/**
 * Segment a->b against box {min:[x,y,z], max:[x,y,z]} (slab test).
 * Returns true when the box is entered strictly before `b` (minus `pad`), i.e. it hides b.
 */
export function segBoxHit(a, b, box, pad = 0.4) {
  let t0 = 0
  let t1 = 1
  for (let i = 0; i < 3; i++) {
    const d = b[i] - a[i]
    const lo = box.min[i]
    const hi = box.max[i]
    if (Math.abs(d) < 1e-9) { if (a[i] < lo || a[i] > hi) return false; continue }
    let u = (lo - a[i]) / d
    let v = (hi - a[i]) / d
    if (u > v) [u, v] = [v, u]
    t0 = Math.max(t0, u)
    t1 = Math.min(t1, v)
    if (t0 > t1) return false
  }
  const len = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) || 1
  return t0 < 1 - pad / len && t0 > 0
}
/**
 * Greedy screen-space clustering: points closer than `radius` px to a cluster's seed join it
 * (higher `prio` seeds first). Members of a cluster are fanned out on a ring around the
 * cluster centroid so icons don't stack; singletons get a zero offset.
 * @param {{ id: string, x: number, y: number, prio?: number }[]} pts
 * @returns {Map<string, { dx: number, dy: number, cluster: number, size: number }>}
 */
export function fanOut(pts, { radius = 26, gap = 30 } = {}) {
  const order = [...pts].sort((a, b) => (b.prio || 0) - (a.prio || 0) || a.id.localeCompare(b.id))
  const clusters = []
  for (const p of order) {
    let best = null
    let bd = radius
    for (const c of clusters) {
      const d = Math.hypot(p.x - c.seed.x, p.y - c.seed.y)
      if (d < bd) { bd = d; best = c }
    }
    if (best) best.list.push(p)
    else clusters.push({ seed: p, list: [p] })
  }
  const out = new Map()
  clusters.forEach((c, ci) => {
    const n = c.list.length
    if (n === 1) return out.set(c.seed.id, { dx: 0, dy: 0, cluster: ci, size: 1 })
    let cx = 0
    let cy = 0
    for (const p of c.list) { cx += p.x; cy += p.y }
    cx /= n
    cy /= n
    // ring radius so neighbours sit `gap` px apart (chord = 2 r sin(pi / n))
    const r = n === 2 ? gap / 2 : gap / (2 * Math.sin(Math.PI / n))
    c.list.forEach((p, i) => {
      const a = -Math.PI / 2 + (i * 2 * Math.PI) / n
      out.set(p.id, { dx: cx + Math.cos(a) * r - p.x, dy: cy + Math.sin(a) * r - p.y, cluster: ci, size: n })
    })
  })
  return out
}

/**
 * Click on overlapping markers: `hits` are ids under the cursor, best first (nearest,
 * unoccluded). A click on the current selection cycles to the next overlapping one.
 */
export function cyclePick(hits, selected) {
  if (!hits.length) return null
  const i = selected == null ? -1 : hits.indexOf(selected)
  if (i < 0) return hits[0]
  return hits[(i + 1) % hits.length]
}

/** room / corridor rectangle containing floor-local (x, z); rooms win over the corridor */
export function roomAt(plan, x, z) {
  const inside = (r) => Math.abs(x - r.x) <= r.w / 2 && Math.abs(z - r.z) <= r.d / 2
  return plan.rooms.find(inside) || (inside(plan.corridor) ? plan.corridor : null)
}
