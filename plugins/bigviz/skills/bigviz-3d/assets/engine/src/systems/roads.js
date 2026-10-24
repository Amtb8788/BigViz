// Road graph + path building. Vehicles never drive on hand-written coordinates only: they
// route over the graph (A*), keep to the right-hand lane (lane offset with mitred corners)
// and get a Chaikin-smoothed centre line. PathFollower samples position / tangent by distance.
// Edges may carry `lanes` (per direction) + `laneW`: lane centres are then offset from the
// road axis and lanePoints picks the inner lane before a left turn, the kerb lane otherwise.

export class RoadGraph {
  /**
   * @param {{ nodes: Record<string,[number,number]>, edges: Array<[string,string,object?]>, lane?: number }} cfg
   */
  constructor(cfg) {
    this.lane = cfg.lane ?? 2
    this.nodes = new Map()
    for (const [id, [x, z]] of Object.entries(cfg.nodes)) this.nodes.set(id, { id, x, z, adj: [] })
    this.edges = []
    for (const [a, b, o = {}] of cfg.edges) {
      const A = this.nodes.get(a)
      const B = this.nodes.get(b)
      if (!A || !B) throw new Error(`Road edge references unknown node: ${a}-${b}`)
      const lane = o.lane ?? this.lane
      const lanes = o.lanes ?? 1
      // lane centre offsets from the axis (right-hand side), kerb lane last
      const offs = lanes > 1 ? Array.from({ length: lanes }, (_, i) => (o.median ?? 0.1) + (o.laneW ?? 3) * (i + 0.5)) : [lane]
      const width = o.width ?? (o.oneway ? lane * 2 + 1 : lane * 2 + 1.6)
      const info = { lane, lanes, offs, width, site: !!o.site, public: !o.site }
      A.adj.push({ to: b, ...info })
      if (!o.oneway) B.adj.push({ to: a, ...info })
      this.edges.push({ a, b, ...o, lane, lanes, offs, width })
    }
  }

  node(id) {
    const n = this.nodes.get(id)
    if (!n) throw new Error(`Unknown road node: ${id}`)
    return n
  }

  nearest(x, z, exclude, publicOnly = false) {
    let best = null
    let bd = Infinity
    for (const n of this.nodes.values()) {
      if (exclude?.has(n.id)) continue
      if (publicOnly && n.adj.every((a) => a.site)) continue
      const d = (n.x - x) ** 2 + (n.z - z) ** 2
      if (d < bd) { bd = d; best = n }
    }
    return best
  }

  /** A* shortest route, returns node ids (inclusive) or null. opts.public skips site-only edges */
  route(from, to, opts = {}) {
    if (from === to) return [from]
    const goal = this.node(to)
    const h = (n) => Math.hypot(n.x - goal.x, n.z - goal.z)
    const open = new Map([[from, h(this.node(from))]])
    const g = new Map([[from, 0]])
    const came = new Map()
    while (open.size) {
      let cur = null
      let cf = Infinity
      for (const [id, f] of open) if (f < cf) { cf = f; cur = id }
      if (cur === to) {
        const path = [cur]
        while (came.has(path[0])) path.unshift(came.get(path[0]))
        return path
      }
      open.delete(cur)
      const C = this.node(cur)
      for (const e of C.adj) {
        if (opts.public && e.site) continue
        const N = this.node(e.to)
        const ng = g.get(cur) + Math.hypot(N.x - C.x, N.z - C.z)
        if (ng < (g.get(e.to) ?? Infinity)) {
          g.set(e.to, ng)
          came.set(e.to, cur)
          open.set(e.to, ng + h(N))
        }
      }
    }
    return null
  }

  adjOf(a, b) {
    return this.node(a).adj.find((x) => x.to === b) || null
  }

  laneOf(a, b) {
    const e = this.adjOf(a, b)
    return e ? e.lane : this.lane
  }

  /** Route through waypoints (A* per leg), U-turn spurs collapsed */
  routeVia(ids, opts = {}) {
    let out = [ids[0]]
    for (let i = 1; i < ids.length; i++) {
      const leg = this.route(out[out.length - 1], ids[i], opts)
      if (leg) out.push(...leg.slice(1))
    }
    const st = []
    for (const id of out) {
      if (st.length >= 2 && st[st.length - 2] === id) st.pop()
      else if (st[st.length - 1] !== id) st.push(id)
    }
    return st
  }

  /** Lane offset for edge i of a route: inner lane before a left turn, kerb lane otherwise */
  _laneR(ids, i, P) {
    const e = this.adjOf(ids[i], ids[i + 1])
    if (!e) return this.lane
    if (e.offs.length === 1) return e.offs[0]
    // turn sign at the end of this edge (or at its start for the final edge)
    const j = i + 2 < P.length ? i + 1 : i - 1
    if (j < 1 || j + 1 >= P.length) return e.offs[e.offs.length - 1]
    const ax = P[j].x - P[j - 1].x
    const az = P[j].z - P[j - 1].z
    const bx = P[j + 1].x - P[j].x
    const bz = P[j + 1].z - P[j].z
    const cr = (ax * bz - az * bx) / ((Math.hypot(ax, az) * Math.hypot(bx, bz)) || 1)
    // +z is south, so cross < 0 is a left turn for a driver (right-hand traffic)
    return cr < -0.3 ? e.offs[0] : e.offs[e.offs.length - 1]
  }

  /** Node ids -> right-hand lane polyline with mitred corners (per-edge lane offsets) */
  lanePoints(ids) {
    const P = ids.map((id) => this.node(id))
    if (P.length === 1) return [{ x: P[0].x, z: P[0].z }]
    const seg = []
    for (let i = 0; i < P.length - 1; i++) {
      const dx = P[i + 1].x - P[i].x
      const dz = P[i + 1].z - P[i].z
      const l = Math.hypot(dx, dz) || 1
      seg.push({ dx: dx / l, dz: dz / l, nx: -dz / l, nz: dx / l, r: this._laneR(ids, i, P) })
    }
    const out = []
    const s0 = seg[0]
    out.push({ x: P[0].x + s0.nx * s0.r, z: P[0].z + s0.nz * s0.r })
    for (let i = 1; i < P.length - 1; i++) {
      const a = seg[i - 1]
      const b = seg[i]
      const p = P[i]
      const dot = a.nx * b.nx + a.nz * b.nz
      const cr = a.dx * b.dz - a.dz * b.dx
      if (dot < -0.8) {
        out.push({ x: p.x + a.nx * a.r, z: p.z + a.nz * a.r }, { x: p.x + b.nx * b.r, z: p.z + b.nz * b.r })
      } else if (Math.abs(cr) < 0.05) {
        out.push({ x: p.x + (a.nx * a.r + b.nx * b.r) / 2, z: p.z + (a.nz * a.r + b.nz * b.r) / 2 })
      } else {
        // intersection of the two offset lines
        const t = ((b.nx * b.r - a.nx * a.r) * b.dz - (b.nz * b.r - a.nz * a.r) * b.dx) / cr
        out.push({ x: p.x + a.nx * a.r + a.dx * t, z: p.z + a.nz * a.r + a.dz * t })
      }
    }
    const sl = seg[seg.length - 1]
    const pl = P[P.length - 1]
    out.push({ x: pl.x + sl.nx * sl.r, z: pl.z + sl.nz * sl.r })
    return out
  }

  /** Kerb-lane spawn point + yaw at a dead-end node (vehicles entering the board) */
  entry(id) {
    const n = this.node(id)
    const e = n.adj.find((a) => a.public) || n.adj[0]
    if (!e) return { x: n.x, z: n.z, yaw: 0 }
    const m = this.node(e.to)
    const l = Math.hypot(m.x - n.x, m.z - n.z) || 1
    const dx = (m.x - n.x) / l
    const dz = (m.z - n.z) / l
    const r = e.offs[e.offs.length - 1]
    return { x: n.x - dz * r, z: n.z + dx * r, yaw: Math.atan2(dx, dz) }
  }
}

/** Chaikin corner cutting; keeps both endpoints */
export function smooth(pts, iterations = 2) {
  let p = pts
  for (let it = 0; it < iterations; it++) {
    if (p.length < 3) return p
    const q = [p[0]]
    for (let i = 0; i < p.length - 1; i++) {
      const a = p[i]
      const b = p[i + 1]
      q.push({ x: a.x * 0.75 + b.x * 0.25, z: a.z * 0.75 + b.z * 0.25 }, { x: a.x * 0.25 + b.x * 0.75, z: a.z * 0.25 + b.z * 0.75 })
    }
    q.push(p[p.length - 1])
    p = q
  }
  return p
}

/** Remove points closer than eps to their predecessor */
export function dedupe(pts, eps = 0.05) {
  const out = []
  for (const p of pts) if (!out.length || Math.hypot(p.x - out[out.length - 1].x, p.z - out[out.length - 1].z) > eps) out.push(p)
  return out
}

export class PathFollower {
  constructor(points) {
    this.pts = points.length > 1 ? points : [points[0], { x: points[0].x + 1e-3, z: points[0].z }]
    this.cum = [0]
    for (let i = 1; i < this.pts.length; i++) this.cum.push(this.cum[i - 1] + Math.hypot(this.pts[i].x - this.pts[i - 1].x, this.pts[i].z - this.pts[i - 1].z))
    this.length = this.cum[this.cum.length - 1]
    this._i = 1
  }

  /** @returns {{x:number,z:number,dx:number,dz:number}} */
  sample(s) {
    s = Math.max(0, Math.min(this.length, s))
    let i = this._i
    if (i >= this.cum.length || this.cum[i - 1] > s) i = 1
    while (i < this.cum.length - 1 && this.cum[i] < s) i++
    this._i = i
    const a = this.pts[i - 1]
    const b = this.pts[i]
    const seg = this.cum[i] - this.cum[i - 1] || 1e-6
    const t = (s - this.cum[i - 1]) / seg
    return { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t, dx: (b.x - a.x) / seg, dz: (b.z - a.z) / seg }
  }

  /** Total turning (radians) between s and s + ahead, used to slow down before corners */
  turnAhead(s, ahead = 8) {
    const a = this.sample(s)
    const b = this.sample(s + ahead)
    const d = a.dx * b.dx + a.dz * b.dz
    return Math.acos(Math.max(-1, Math.min(1, d)))
  }
}
