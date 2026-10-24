// Bridge pack - geometry builders: variable-depth single-cell box girder strips (outer skin +
// hollow cell, flat-shaded, world-planar UVs, per-vertex tint), section caps, chamfered prisms
// (pier wall lifts) and a corrugated sheet-pile wall. All return non-indexed BufferGeometry.

import * as THREE from 'three'
import { deckY, girderDepth } from './layout.js'

const T_TOP = 0.32 // top slab
const T_WEB = 0.6
const T_BOT = (h) => 0.32 + (h - 3.2) * 0.12 // bottom slab thickens toward the pier

/** cross-section loops at x: outer + inner (cell), [y, z] around the section, z about 0 */
export function loops(x) {
  const top = deckY(x)
  const h = girderDepth(x)
  const bot = top - h
  const outer = [
    [top, -8.25], [top, 8.25], [top - 0.2, 8.25], [top - 0.62, 4.6], [top - 1.0, 4.0], [bot + 0.25, 3.9], [bot, 3.6],
    [bot, -3.6], [bot + 0.25, -3.9], [top - 1.0, -4.0], [top - 0.62, -4.6], [top - 0.2, -8.25]
  ]
  const it = top - T_TOP
  const ib = bot + T_BOT(h)
  const iz = 4.0 - T_WEB
  const ch = Math.min(0.6, (it - ib) * 0.2)
  const inner = [[it, -iz + ch], [it, iz - ch], [it - ch, iz], [ib + ch, iz], [ib, iz - ch], [ib, -iz + ch], [ib + ch, -iz], [it - ch, -iz]]
  return { outer, inner, top, bot, h }
}

const _a = new THREE.Vector3()
const _b = new THREE.Vector3()
const _n = new THREE.Vector3()

/** accumulator for flat-shaded quads with a per-vertex colour */
export class Quads {
  constructor() { this.p = []; this.n = []; this.uv = []; this.c = [] }
  /** v: 4 Vector3 in ring order, want: desired normal direction (Vector3), uv: 4 [u,v] */
  quad(v, want, uv, col) {
    _a.subVectors(v[1], v[0])
    _b.subVectors(v[2], v[0])
    _n.crossVectors(_a, _b).normalize()
    const flip = _n.dot(want) < 0
    if (flip) _n.negate()
    const order = flip ? [0, 2, 1, 0, 3, 2] : [0, 1, 2, 0, 2, 3]
    for (const k of order) {
      this.p.push(v[k].x, v[k].y, v[k].z)
      this.n.push(_n.x, _n.y, _n.z)
      this.uv.push(...uv[k])
      this.c.push(col.r, col.g, col.b)
    }
  }
  get count() { return this.p.length / 3 }
  geometry() {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3))
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3))
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2))
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3))
    g.computeBoundingSphere()
    return g
  }
}

const cen = (L) => L.reduce((a, p) => [a[0] + p[0] / L.length, a[1] + p[1] / L.length], [0, 0])

/**
 * Box girder strip between world x0 and x1 (sampled about every `step` m), shifted by
 * (-ox, 0, oz). Appends to q with tint `col`. inner=false skips the cell (solid diaphragm).
 */
export function boxStrip(q, x0, x1, { ox = 0, oz = 0, col, step = 1.5, inner = true } = {}) {
  const n = Math.max(1, Math.ceil(Math.abs(x1 - x0) / step))
  const xs = Array.from({ length: n + 1 }, (_, i) => x0 + ((x1 - x0) * i) / n)
  const L = xs.map((x) => loops(x))
  const ring = (key, flipOut) => {
    const m = L[0][key].length
    const c0 = cen(L[0][key])
    let v0 = 0
    for (let e = 0; e < m; e++) {
      const p0 = L[0][key][e]
      const p1 = L[0][key][(e + 1) % m]
      const len = Math.hypot(p1[0] - p0[0], p1[1] - p0[1])
      const mid = [(p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2]
      for (let i = 0; i < n; i++) {
        const A = L[i][key][e]; const B = L[i][key][(e + 1) % m]
        const C = L[i + 1][key][(e + 1) % m]; const D = L[i + 1][key][e]
        const v = [
          new THREE.Vector3(xs[i] - ox, A[0], A[1] + oz), new THREE.Vector3(xs[i] - ox, B[0], B[1] + oz),
          new THREE.Vector3(xs[i + 1] - ox, C[0], C[1] + oz), new THREE.Vector3(xs[i + 1] - ox, D[0], D[1] + oz)
        ]
        const out = new THREE.Vector3(0, mid[0] - c0[0], mid[1] - c0[1]).multiplyScalar(flipOut ? -1 : 1)
        const u0 = xs[i] / 6; const u1 = xs[i + 1] / 6
        q.quad(v, out, [[u0, v0 / 6], [u0, (v0 + len) / 6], [u1, (v0 + len) / 6], [u1, v0 / 6]], col)
      }
      v0 += len
    }
  }
  ring('outer', false)
  if (inner) ring('inner', true)
}

/** Section face at world x (outer minus cell when hollow), normal +-x, shifted like boxStrip */
export function capGeo(x, dir, { ox = 0, oz = 0, hollow = true } = {}) {
  const { outer, inner } = loops(x)
  const V = (p) => new THREE.Vector2(p[1], p[0])
  const contour = outer.map(V)
  const holes = hollow ? [inner.map(V)] : []
  if (THREE.ShapeUtils.isClockWise(contour)) contour.reverse()
  for (const h of holes) if (!THREE.ShapeUtils.isClockWise(h)) h.reverse()
  const tris = THREE.ShapeUtils.triangulateShape(contour, holes)
  const all = [...contour, ...holes.flat()]
  const p = []; const nrm = []; const uv = []
  for (const t of tris) for (const k of dir < 0 ? t : [t[0], t[2], t[1]]) {
    p.push(x - ox, all[k].y, all[k].x + oz); nrm.push(dir, 0, 0); uv.push(all[k].x / 6, all[k].y / 6)
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3))
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  return g
}

/**
 * Chamfered rectangular prism (pier wall lift / column block): centre (x, z), size w (x) by
 * d (z), chamfer c, from y0 to y1. Appends sides + top to q.
 */
export function prism(q, x, z, w, d, c, y0, y1, col, top = true) {
  const hw = w / 2; const hd = d / 2
  const P = [[hw - c, -hd], [hw, -hd + c], [hw, hd - c], [hw - c, hd], [-hw + c, hd], [-hw, hd - c], [-hw, -hd + c], [-hw + c, -hd]]
  let acc = 0
  for (let i = 0; i < P.length; i++) {
    const [ax, az] = P[i]; const [bx, bz] = P[(i + 1) % P.length]
    const len = Math.hypot(bx - ax, bz - az)
    const out = new THREE.Vector3((ax + bx) / 2, 0, (az + bz) / 2)
    const v = [new THREE.Vector3(x + ax, y0, z + az), new THREE.Vector3(x + bx, y0, z + bz), new THREE.Vector3(x + bx, y1, z + bz), new THREE.Vector3(x + ax, y1, z + az)]
    q.quad(v, out, [[acc / 6, y0 / 6], [(acc + len) / 6, y0 / 6], [(acc + len) / 6, y1 / 6], [acc / 6, y1 / 6]], col)
    acc += len
  }
  if (top) {
    const up = new THREE.Vector3(0, 1, 0)
    const cpt = new THREE.Vector3(x, y1, z)
    for (let i = 0; i < P.length; i++) {
      const [ax, az] = P[i]; const [bx, bz] = P[(i + 1) % P.length]
      const v = [cpt, new THREE.Vector3(x + ax, y1, z + az), new THREE.Vector3(x + bx, y1, z + bz), cpt]
      q.quad(v, up, [[x / 6, z / 6], [(x + ax) / 6, (z + az) / 6], [(x + bx) / 6, (z + bz) / 6], [x / 6, z / 6]], col)
    }
  }
}

/** Plain box into q (all 6 faces), axis aligned */
export function boxQ(q, x0, y0, z0, x1, y1, z1, col) {
  const V = (x, y, z) => new THREE.Vector3(x, y, z)
  const F = [
    [[V(x1, y0, z0), V(x1, y1, z0), V(x1, y1, z1), V(x1, y0, z1)], V(1, 0, 0), 'zy'],
    [[V(x0, y0, z0), V(x0, y1, z0), V(x0, y1, z1), V(x0, y0, z1)], V(-1, 0, 0), 'zy'],
    [[V(x0, y1, z0), V(x1, y1, z0), V(x1, y1, z1), V(x0, y1, z1)], V(0, 1, 0), 'xz'],
    [[V(x0, y0, z0), V(x1, y0, z0), V(x1, y0, z1), V(x0, y0, z1)], V(0, -1, 0), 'xz'],
    [[V(x0, y0, z1), V(x1, y0, z1), V(x1, y1, z1), V(x0, y1, z1)], V(0, 0, 1), 'xy'],
    [[V(x0, y0, z0), V(x1, y0, z0), V(x1, y1, z0), V(x0, y1, z0)], V(0, 0, -1), 'xy']
  ]
  for (const [v, n, ax] of F) q.quad(v, n, v.map((p) => [p[ax[0]] / 6, p[ax[1]] / 6]), col)
}

/**
 * Corrugated sheet-pile wall along a closed rounded rectangle (w x d, corner r) centred at
 * (cx, 0): Larsen profile as a sine offset, from y0 to y1. Returns geometry (both faces).
 */
export function sheetPileGeo(cx, w, d, r, y0, y1) {
  const path = []
  const q4 = [[w / 2 - r, d / 2 - r, 0], [-(w / 2 - r), d / 2 - r, Math.PI / 2], [-(w / 2 - r), -(d / 2 - r), Math.PI], [w / 2 - r, -(d / 2 - r), Math.PI * 1.5]]
  for (const [ox, oz, a0] of q4) for (let k = 0; k <= 8; k++) { const a = a0 + (k / 8) * Math.PI / 2; path.push([ox + Math.cos(a) * r, oz + Math.sin(a) * r]) }
  // resample at 0.2 m, corrugation pitch 0.8 m, depth 0.17 m
  const pts = []
  for (let i = 0; i < path.length; i++) {
    const [ax, az] = path[i]; const [bx, bz] = path[(i + 1) % path.length]
    const len = Math.hypot(bx - ax, bz - az)
    const n = Math.max(1, Math.round(len / 0.2))
    for (let k = 0; k < n; k++) pts.push([ax + ((bx - ax) * k) / n, az + ((bz - az) * k) / n, -(bz - az) / len, (bx - ax) / len])
  }
  const q = new Quads()
  const col = new THREE.Color(1, 1, 1)
  let s = 0
  const off = (i) => Math.sin((s * Math.PI * 2) / 0.8) * 0.17
  const P = pts.map(([x, z, nx, nz], i) => { if (i) s += Math.hypot(x - pts[i - 1][0], z - pts[i - 1][1]); const o = off(i); return [cx + x + nx * o, z + nz * o, s] })
  for (let i = 0; i < P.length; i++) {
    const A = P[i]; const B = P[(i + 1) % P.length]
    const out = new THREE.Vector3((A[0] + B[0]) / 2 - cx, 0, (A[1] + B[1]) / 2)
    const v = [new THREE.Vector3(A[0], y0, A[1]), new THREE.Vector3(B[0], y0, B[1]), new THREE.Vector3(B[0], y1, B[1]), new THREE.Vector3(A[0], y1, A[1])]
    q.quad(v, out, [[A[2] / 3, y0 / 3], [(A[2] + 0.2) / 3, y0 / 3], [(A[2] + 0.2) / 3, y1 / 3], [A[2] / 3, y1 / 3]], col)
  }
  return q.geometry()
}
