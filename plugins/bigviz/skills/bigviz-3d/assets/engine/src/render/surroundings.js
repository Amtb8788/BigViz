// Realistic style surroundings: replaces the desk. Real-scale ground to the horizon around the
// board: sidewalk ring (with openings where site roads leave the board), a 4-lane ring road
// with worn markings, a city grid of blocks with curbs and facade-textured buildings, then
// fields out to the fog. Everything is a handful of merged meshes (few draw calls).

import * as THREE from 'three'
import { surfaceMat, mat, registerNightLit } from './materials.js'
import { makeCanvas } from './textures.js'
import { createRng } from '../core/rng.js'

const _a = new THREE.Vector3()
const _b = new THREE.Vector3()

/** Minimal quad batcher: flat arrays -> one BufferGeometry */
class Batch {
  constructor() { this.p = []; this.n = []; this.uv = []; this.c = []; this.idx = [] }
  /** v: 4 [x,y,z] corners in order around the quad, nrm wanted normal, uv 4 [u,v], col rgb */
  quad(v, nrm, uv, col = [1, 1, 1]) {
    _a.set(v[1][0] - v[0][0], v[1][1] - v[0][1], v[1][2] - v[0][2])
    _b.set(v[2][0] - v[0][0], v[2][1] - v[0][1], v[2][2] - v[0][2])
    const flip = _a.cross(_b).dot(_b.set(...nrm)) < 0
    const o = this.p.length / 3
    for (let k = 0; k < 4; k++) {
      this.p.push(...v[k]); this.n.push(...nrm); this.uv.push(...uv[k]); this.c.push(...col)
    }
    if (flip) this.idx.push(o, o + 2, o + 1, o, o + 3, o + 2)
    else this.idx.push(o, o + 1, o + 2, o, o + 2, o + 3)
  }
  /** horizontal rect at height y, planar uv metres / tile */
  rect(x0, z0, x1, z1, y, tile = 8, col) {
    if (x1 - x0 <= 0 || z1 - z0 <= 0) return
    const v = [[x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1]]
    this.quad(v, [0, 1, 0], v.map((p) => [p[0] / tile, p[2] / tile]), col)
  }
  /** raised slab: top + 4 curb faces from y0 to y1 */
  slab(x0, z0, x1, z1, y0, y1, tile = 8, col) {
    this.rect(x0, z0, x1, z1, y1, tile, col)
    this.box(x0, z0, x1, z1, y0, y1, (len, h) => [[0, 0], [len / tile, 0], [len / tile, h / tile], [0, h / tile]], col, false)
  }
  /** 4 vertical walls; uvf(len, h) -> 4 uv corners */
  box(x0, z0, x1, z1, y0, y1, uvf, col) {
    const h = y1 - y0
    const walls = [
      [[x0, z1], [x1, z1], [0, 0, 1]], [[x1, z1], [x1, z0], [1, 0, 0]],
      [[x1, z0], [x0, z0], [0, 0, -1]], [[x0, z0], [x0, z1], [-1, 0, 0]]
    ]
    for (const [[ax, az], [bx, bz], nrm] of walls) {
      const len = Math.hypot(bx - ax, bz - az)
      this.quad([[ax, y0, az], [bx, y0, bz], [bx, y1, bz], [ax, y1, az]], nrm, uvf(len, h), col)
    }
  }
  mesh(material, { colors = false } = {}) {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3))
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3))
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2))
    if (colors) g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3))
    g.setIndex(this.idx)
    g.computeBoundingSphere()
    const m = new THREE.Mesh(g, material)
    m.receiveShadow = true
    return m
  }
}

/** split [a,b] by openings [{c,w}] -> kept intervals */
function cut(a, b, holes) {
  const out = []
  let s = a
  for (const h of [...holes].sort((p, q) => p.c - q.c)) {
    const h0 = h.c - h.w / 2
    const h1 = h.c + h.w / 2
    if (h1 <= s || h0 >= b) continue
    if (h0 > s) out.push([s, h0])
    s = Math.max(s, h1)
  }
  if (s < b) out.push([s, b])
  return out
}
/** Curtain-wall / punched-window facade: 24 m tile = 8 bays x 8 floors (3 m) */
function facadeMaterial() {
  const S = 512
  const C = S / 8
  const rng = createRng(77)
  const alb = makeCanvas(S)
  const emi = makeCanvas(S)
  const rm = makeCanvas(S)
  const a = alb.getContext('2d')
  const e = emi.getContext('2d')
  const r = rm.getContext('2d')
  e.fillStyle = '#000'; e.fillRect(0, 0, S, S)
  // wall: rough dielectric (G = roughness, B = metalness)
  a.fillStyle = '#a9a49b'; a.fillRect(0, 0, S, S)
  r.fillStyle = 'rgb(0,220,0)'; r.fillRect(0, 0, S, S)
  for (let fy = 0; fy < 8; fy++) {
    for (let fx = 0; fx < 8; fx++) {
      const x = fx * C + 4
      const y = fy * C + 6
      const w = C - 8
      const h = C - 22
      const gl = a.createLinearGradient(0, y, 0, y + h)
      gl.addColorStop(0, '#5d6b78'); gl.addColorStop(1, '#2c343c')
      a.fillStyle = gl
      a.fillRect(x, y, w, h)
      a.fillStyle = 'rgba(0,0,0,0.25)'
      a.fillRect(x + w / 2 - 1, y, 2, h)
      r.fillStyle = 'rgb(0,18,230)'
      r.fillRect(x, y, w, h)
      if (rng.chance(0.42)) {
        const warm = rng.chance(0.7)
        e.fillStyle = warm ? `hsl(${rng.range(30, 44)},70%,${rng.range(45, 65)}%)` : `hsl(${rng.range(195, 215)},40%,${rng.range(55, 72)}%)`
        e.fillRect(x + 1, y + 1, w - 2, h - 2)
      }
    }
  }
  const tex = (c, srgb) => {
    const t = new THREE.CanvasTexture(c)
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.anisotropy = 8
    if (srgb) t.colorSpace = THREE.SRGBColorSpace
    return t
  }
  const rmt = tex(rm)
  const m = new THREE.MeshStandardMaterial({
    map: tex(alb, true), emissiveMap: tex(emi, true), emissive: '#ffffff',
    roughnessMap: rmt, metalnessMap: rmt, roughness: 1, metalness: 1, vertexColors: true, envMapIntensity: 1.3
  })
  m.name = 'city.facade'
  return registerNightLit(m, 1.3, 'street')
}

const TINTS = ['#e4e0d8', '#c8ccd0', '#b3ada4', '#d2c8b6', '#a6aeb6', '#ebe6dc', '#b9a58f'].map((c) => new THREE.Color(c).toArray())

/** gaps between sorted intervals */
const gaps = (iv) => iv.slice(1).map((b, i) => [iv[i][1], b[0]])

/**
 * @param {{ board:{w:number,d:number}, roads?:object, seed?:number, extent?:number }} cfg
 * @returns {THREE.Group}
 */
export function buildSurroundings({ board, roads, seed = 7, extent = 700 }) {
  const g = new THREE.Group()
  g.name = 'surroundings'
  const rng = createRng(seed * 31 + 5)
  const hx = board.w / 2
  const hz = board.d / 2
  const SW = 3.5
  const RW = 15
  const B = 56
  const ST = 14
  const L = extent
  // openings in the sidewalk ring where board roads leave the board
  const open = { n: [], s: [], e: [], w: [] }
  for (const [x, z] of Object.values(roads?.nodes || {})) {
    if (Math.abs(x) > hx - 8 && Math.abs(z) < hz - 8) open[x > 0 ? 'e' : 'w'].push({ c: z, w: 9 })
    else if (Math.abs(z) > hz - 8 && Math.abs(x) < hx - 8) open[z > 0 ? 's' : 'n'].push({ c: x, w: 9 })
  }
  const asphalt = new Batch()
  const walk = new Batch()
  const grass = new Batch()
  const marks = new Batch()
  const yellow = new Batch()
  const blds = new Batch()
  const roofs = new Batch()
  // asphalt everywhere around the board (slightly below the board top)
  const ay = -0.01
  asphalt.rect(-L, -L, L, -hz, ay); asphalt.rect(-L, hz, L, L, ay)
  asphalt.rect(-L, -hz, -hx, hz, ay); asphalt.rect(hx, -hz, L, hz, ay)
  // sidewalk ring A hugging the board
  const sy = 0.15
  for (const [a, b] of cut(-hx - SW, hx + SW, open.n)) walk.slab(a, -hz - SW, b, -hz, ay, sy)
  for (const [a, b] of cut(-hx - SW, hx + SW, open.s)) walk.slab(a, hz, b, hz + SW, ay, sy)
  for (const [a, b] of cut(-hz, hz, open.w)) walk.slab(-hx - SW, a, -hx, b, ay, sy)
  for (const [a, b] of cut(-hz, hz, open.e)) walk.slab(hx, a, hx + SW, b, ay, sy)
  // city grid: central intervals split by a street on the axis, then blocks outward
  const axis = (h) => {
    const inner = h + SW
    const iv = [[-inner, -ST / 2], [ST / 2, inner]]
    for (let s = inner + RW; s + 20 < L; s += B + ST) { iv.push([s, Math.min(L, s + B)]); iv.unshift([-Math.min(L, s + B), -s]) }
    return iv
  }
  const xs = axis(hx)
  const zs = axis(hz)
  const X0 = hx + SW + RW
  const Z0 = hz + SW + RW
  for (const [x0, x1] of xs) {
    for (const [z0, z1] of zs) {
      if (x1 <= X0 && x0 >= -X0 && z1 <= Z0 && z0 >= -Z0) continue
      block(x0, z0, x1, z1)
    }
  }
  // markings: ring road (double yellow centre, dashed lanes, solid edges) + grid street centres
  const my = ay + 0.012
  const along = (batch, ax, c, a, b, w, dash = 0, gap = 0) => {
    const step = dash ? dash + gap : b - a
    for (let s = a; s < b; s += step) {
      const e = Math.min(b, s + (dash || b - a))
      if (ax === 'z') batch.rect(c - w / 2, s, c + w / 2, e, my, 1)
      else batch.rect(s, c - w / 2, e, c + w / 2, my, 1)
    }
  }
  const ringSide = (ax, sign, span, holes) => {
    const c = sign * (ax === 'z' ? hx : hz) + sign * (SW + RW / 2)
    for (const [a, b] of cut(-span, span, holes)) {
      for (const o of [-0.13, 0.13]) along(yellow, ax, c + o, a, b, 0.12)
      for (const o of [-RW / 4, RW / 4]) along(marks, ax, c + o, a, b, 0.14, 3, 6)
      for (const o of [-(RW / 2 - 0.5), RW / 2 - 0.5]) along(marks, ax, c + o, a, b, 0.14)
    }
  }
  const ringHoles = (list) => [{ c: 0, w: ST + 6 }, ...list.map((h) => ({ c: h.c, w: h.w + 4 }))]
  ringSide('z', 1, hz - 2, ringHoles(open.e))
  ringSide('z', -1, hz - 2, ringHoles(open.w))
  ringSide('x', 1, hx - 2, ringHoles(open.s))
  ringSide('x', -1, hx - 2, ringHoles(open.n))
  const NEAR = 360
  for (const [a, b] of gaps(xs)) {
    const c = (a + b) / 2
    if (Math.abs(c) > NEAR) continue
    for (const [z0, z1] of zs) if (!(Math.abs(c) < X0 && Math.abs((z0 + z1) / 2) < Z0) && Math.abs(z0) < NEAR) along(marks, 'z', c, z0 + 2, z1 - 2, 0.14, 3, 6)
  }
  for (const [a, b] of gaps(zs)) {
    const c = (a + b) / 2
    if (Math.abs(c) > NEAR) continue
    for (const [x0, x1] of xs) if (!(Math.abs(c) < Z0 && Math.abs((x0 + x1) / 2) < X0) && Math.abs(x0) < NEAR) along(marks, 'x', c, x0 + 2, x1 - 2, 0.14, 3, 6)
  }
  // fields beyond the city, out into the fog
  const F = 6000
  grass.rect(-F, -F, F, -L, ay); grass.rect(-F, L, F, F, ay)
  grass.rect(-F, -L, -L, L, ay); grass.rect(L, -L, F, L, ay)

  const add = (m, cast = false) => { m.castShadow = cast; g.add(m); return m }
  add(asphalt.mesh(surfaceMat('asphalt', 1))).name = 'city.asphalt'
  add(walk.mesh(surfaceMat('paving', 1)), true).name = 'city.sidewalk'
  add(grass.mesh(surfaceMat('grass', 1))).name = 'city.grass'
  const decal = (role) => {
    const m = mat(role).clone()
    m.polygonOffset = true
    m.polygonOffsetFactor = -2
    m.polygonOffsetUnits = -2
    return m
  }
  add(marks.mesh(decal('marking'))).name = 'city.marks'
  add(yellow.mesh(decal('marking.yellow'))).name = 'city.marks.yellow'
  add(blds.mesh(facadeMaterial(), { colors: true }), true).name = 'city.buildings'
  add(roofs.mesh(surfaceMat('concrete', 1))).name = 'city.roofs'
  return g

  function block(x0, z0, x1, z1) {
    const d = Math.max(Math.abs((x0 + x1) / 2), Math.abs((z0 + z1) / 2))
    walk.slab(x0, z0, x1, z1, ay, sy)
    if (rng.chance(0.1)) { grass.rect(x0 + 3, z0 + 3, x1 - 3, z1 - 3, sy + 0.02); return }
    const nx = x1 - x0 > 40 ? 2 : 1
    const nz = z1 - z0 > 40 ? 2 : 1
    const m = 3
    const gp = 3
    const lw = (x1 - x0 - 2 * m - gp * (nx - 1)) / nx
    const ld = (z1 - z0 - 2 * m - gp * (nz - 1)) / nz
    for (let i = 0; i < nx; i++) {
      for (let j = 0; j < nz; j++) {
        if (lw < 6 || ld < 6) continue
        const bx0 = x0 + m + i * (lw + gp) + rng.range(0, 2)
        const bz0 = z0 + m + j * (ld + gp) + rng.range(0, 2)
        const bx1 = bx0 + lw - rng.range(0, 4)
        const bz1 = bz0 + ld - rng.range(0, 4)
        const floors = d < 140 ? rng.int(3, 8) : d < 300 ? rng.int(4, 16) : rng.chance(0.15) ? rng.int(20, 40) : rng.int(5, 18)
        const h = floors * 3
        const u0 = rng.int(0, 7) / 8
        const col = TINTS[rng.int(0, TINTS.length - 1)]
        blds.box(bx0, bz0, bx1, bz1, sy, sy + h, (len, hh) => [[u0, 0], [u0 + len / 24, 0], [u0 + len / 24, hh / 24], [u0, hh / 24]], col)
        roofs.rect(bx0, bz0, bx1, bz1, sy + h, 8)
      }
    }
  }
}
