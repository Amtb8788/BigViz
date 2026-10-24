// Realistic-style background city blocks. Each building is drawn at true scale into a shared
// 2048 atlas page (albedo) + 1024 emissive / roughness-metalness maps, so every building on a
// page shares ONE body material and ONE detail material (balconies, AC units, roof plant,
// awnings; hidden on low quality). After baking, the whole background city is 2 draw calls
// per page. Typologies: glass curtain-wall tower, concrete residential slab with balconies,
// ribbon-window office, low-rise retail with shopfronts and signage.

import * as THREE from 'three'
import { makeCanvas } from '../render/textures.js'
import { registerNightLit, tone } from '../render/materials.js'
import { detailOnly } from '../render/detail.js'
import { createRng } from '../core/rng.js'

const PAGE = 2048
const K = 0.5 // emissive / roughness maps are half resolution
const STRIP = 256 // top strip: roof tile (256) + solid swatches (64 px grid)
const GUT = 4

// solid swatches: [albedo, roughness, metalness]
const SW = {
  concrete: ['#a7a49c', 0.9, 0], concreteDark: ['#77746e', 0.92, 0], coping: ['#b9bcbd', 0.35, 0.85],
  hvac: ['#a3a8aa', 0.5, 0.6], dark: ['#3a3d40', 0.5, 0.7], tank: ['#c9ccce', 0.3, 0.9],
  white: ['#d9d8d2', 0.6, 0], acUnit: ['#dcdcd6', 0.55, 0.1], glassDark: ['#26303a', 0.08, 0.85],
  awnRed: ['#8a2f2a', 0.85, 0], awnGreen: ['#2f5a44', 0.85, 0], awnBlue: ['#2e4a6e', 0.85, 0], awnBeige: ['#b8a888', 0.85, 0],
  lobby: ['#e8dcc0', 0.6, 0]
}
const SW_KEYS = Object.keys(SW)

class Page {
  constructor() {
    this.a = makeCanvas(PAGE, PAGE)
    this.e = makeCanvas(PAGE * K, PAGE * K)
    this.r = makeCanvas(PAGE * K, PAGE * K)
    this.ax = this.a.getContext('2d')
    this.ex = this.e.getContext('2d')
    this.rx = this.r.getContext('2d')
    this.ax.fillStyle = '#8a8780'
    this.ax.fillRect(0, 0, PAGE, PAGE)
    this.ex.fillStyle = '#000'
    this.ex.fillRect(0, 0, PAGE * K, PAGE * K)
    this.rx.fillStyle = 'rgb(0,230,0)'
    this.rx.fillRect(0, 0, PAGE * K, PAGE * K)
    this.x = 0
    this.y = STRIP
    this.rowH = 0
    this.sealed = false
    this.swatch = {}
    this._strip()
    const tex = (c, srgb) => {
      const t = new THREE.CanvasTexture(c)
      if (srgb) t.colorSpace = THREE.SRGBColorSpace
      t.anisotropy = 8
      return t
    }
    const map = tex(this.a, true)
    const emissiveMap = tex(this.e, true)
    const orm = tex(this.r, false)
    // first GPU upload freezes the page: later buildings go to a fresh one
    map.onUpdate = () => { this.sealed = true }
    this.body = registerNightLit(new THREE.MeshStandardMaterial({ map, emissiveMap, emissive: '#ffffff', roughnessMap: orm, metalnessMap: orm, roughness: 1, metalness: 1, name: 'city.body' }), 1.2, 'windows')
    this.detail = registerNightLit(detailOnly(this.body.clone(), 1, 2), 1.2, 'windows')
    this.detail.name = 'city.detail'
  }
}

/** paint into all three maps; px coords on the albedo page. rm: [rough, metal] or null (keep) */
Page.prototype.rect = function (x, y, w, h, col, rm, em) {
  if (col) { this.ax.fillStyle = col; this.ax.fillRect(x, y, w, h) }
  if (rm) { this.rx.fillStyle = `rgb(0,${Math.round(rm[0] * 255)},${Math.round(rm[1] * 255)})`; this.rx.fillRect(x * K, y * K, w * K, h * K) }
  if (em) { this.ex.fillStyle = em; this.ex.fillRect(x * K, y * K, w * K, h * K) }
}

/** px rect -> uv rect [u0, v0, u1, v1] (canvas y down, uv v up); inset keeps mips off neighbours */
Page.prototype.uv = function (x, y, w, h, inset = 0) {
  return [(x + inset) / PAGE, 1 - (y + h - inset) / PAGE, (x + w - inset) / PAGE, 1 - (y + inset) / PAGE]
}

Page.prototype._strip = function () {
  // roof tile: gravel / membrane with seams and stains
  const rng = createRng(5)
  this.rect(0, 0, STRIP, STRIP, '#6f6d68', [0.95, 0])
  for (let i = 0; i < 900; i++) { this.ax.fillStyle = `rgba(${rng.chance(0.5) ? '0,0,0' : '255,255,255'},${rng.range(0.03, 0.09)})`; this.ax.fillRect(rng.range(0, STRIP), rng.range(0, STRIP), rng.range(2, 14), rng.range(2, 14)) }
  this.ax.fillStyle = 'rgba(40,38,34,0.35)'
  for (let x = 0; x < STRIP; x += 32) this.ax.fillRect(x, 0, 2, STRIP)
  this.swatch.roof = this.uv(0, 0, STRIP, STRIP, 2)
  let x = STRIP + GUT
  let y = 0
  for (const k of SW_KEYS) {
    const [col, ro, me] = SW[k]
    this.rect(x, y, 64, 64, col, [ro, me])
    // faint grime so detail boxes are not flat
    const g = this.ax.createLinearGradient(0, y, 0, y + 64)
    g.addColorStop(0, 'rgba(0,0,0,0)')
    g.addColorStop(1, 'rgba(0,0,0,0.18)')
    this.ax.fillStyle = g
    this.ax.fillRect(x, y, 64, 64)
    this.swatch[k] = this.uv(x, y, 64, 64, 8)
    x += 64 + GUT
    if (x + 64 > PAGE) { x = STRIP + GUT; y += 64 + GUT }
  }
}

/** shelf packer; returns px origin or null when the page is full */
Page.prototype.alloc = function (w, h) {
  w = Math.ceil(w) + GUT
  h = Math.ceil(h) + GUT
  if (w > PAGE) return null
  if (this.x + w > PAGE) { this.x = 0; this.y += this.rowH; this.rowH = 0 }
  if (this.y + h > PAGE) return null
  const o = [this.x, this.y]
  this.x += w
  this.rowH = Math.max(this.rowH, h)
  return o
}

let page = null
function pageFor(w, h) {
  if (!page || page.sealed) page = new Page()
  let o = page.alloc(w, h)
  if (!o) { page = new Page(); o = page.alloc(w, h) }
  return { pg: page, o }
}

const WARM = [[255, 196, 120], [255, 214, 150], [255, 180, 100], [250, 222, 175]]
const COOL = [[205, 225, 255], [225, 236, 255], [190, 210, 240]]

/** lit window in the emissive map: brighter floor-ward, sometimes half curtained / dimmed */
function litWindow(pg, rng, x, y, w, h, cool) {
  const c = rng.pick(cool ? COOL : WARM)
  const k = rng.range(0.45, 1)
  const g = pg.ex.createLinearGradient(0, y * K, 0, (y + h) * K)
  const s = (f) => `rgb(${Math.round(c[0] * k * f)},${Math.round(c[1] * k * f)},${Math.round(c[2] * k * f)})`
  g.addColorStop(0, s(0.6))
  g.addColorStop(1, s(1))
  pg.ex.fillStyle = g
  pg.ex.fillRect(x * K, y * K, w * K, h * K)
  if (rng.chance(0.35)) { pg.ex.fillStyle = s(0.25); pg.ex.fillRect(x * K, y * K, w * K * rng.range(0.3, 0.6), h * K) }
  // daytime: a hint of interior colour on lit windows
  pg.ax.fillStyle = `rgba(${c[0]},${c[1]},${c[2]},0.06)`
  pg.ax.fillRect(x, y, w, h)
}

/** glass pane with sky reflection gradient (albedo) + glossy metal (orm) */
function pane(pg, rng, x, y, w, h, base = [62, 80, 98], refl = 0.9) {
  const l = rng.range(0.85, 1.15)
  const g = pg.ax.createLinearGradient(0, y, 0, y + h)
  g.addColorStop(0, `rgb(${base.map((v) => Math.min(255, Math.round(v * l * 1.35))).join(',')})`)
  g.addColorStop(1, `rgb(${base.map((v) => Math.round(v * l * 0.8)).join(',')})`)
  pg.ax.fillStyle = g
  pg.ax.fillRect(x, y, w, h)
  pg.rect(x, y, w, h, null, [rng.range(0.06, 0.14), refl])
}

// typologies: floor height, ground floor, bay width, parapet, lit share at night
export const TYPES = {
  tower: { fh: 3.6, gf: 5.4, bay: 1.5, par: 1.2, lit: 0.55, ground: 'lobby' },
  slab: { fh: 3.2, gf: 4.2, bay: 3.3, par: 1.0, lit: 0.4, ground: 'shop', balcony: true },
  ribbon: { fh: 3.6, gf: 4.5, bay: 1.6, par: 1.0, lit: 0.45, ground: 'lobby' },
  retail: { fh: 3.3, gf: 4.5, bay: 2.6, par: 0.9, lit: 0.45, ground: 'shop' }
}

const SHOPS = ['便利店', '药房', '面馆', '银行', '咖啡', '服装', '花店', '面包坊', '眼镜', '书店', '茶饮', '五金']

/** painter context: px helpers for one facade region (W x H metres at ppm, origin ox, oy) */
function region(pg, ox, oy, W, H, ppm) {
  return {
    pg, ox, oy, W, H, ppm,
    // metres (u from left, h from ground) -> px rect
    r: (u, h, w, hh) => [ox + u * ppm, oy + (H - h - hh) * ppm, w * ppm, hh * ppm]
  }
}

function fill(R, u, h, w, hh, col, rm, em) {
  const [x, y, ww, h2] = R.r(u, h, w, hh)
  R.pg.rect(x, y, ww, h2, col, rm, em)
}

function grime(R, rng) {
  const { pg, ox, oy, W, H, ppm } = R
  const ax = pg.ax
  const g = ax.createLinearGradient(0, oy, 0, oy + H * ppm)
  g.addColorStop(0, 'rgba(28,26,22,0.26)')
  g.addColorStop(0.1, 'rgba(28,26,22,0.05)')
  g.addColorStop(0.8, 'rgba(28,26,22,0)')
  g.addColorStop(1, 'rgba(42,34,24,0.22)')
  ax.fillStyle = g
  ax.fillRect(ox, oy, W * ppm, H * ppm)
  for (let i = 0; i < W * 0.8; i++) {
    const x = ox + rng.range(0, W * ppm)
    const y = oy + rng.range(0, H * ppm * 0.4)
    const len = rng.range(0.15, 0.6) * H * ppm
    const s = ax.createLinearGradient(0, y, 0, y + len)
    s.addColorStop(0, `rgba(25,22,18,${rng.range(0.05, 0.14)})`)
    s.addColorStop(1, 'rgba(25,22,18,0)')
    ax.fillStyle = s
    ax.fillRect(x, y, rng.range(0.1, 0.5) * ppm, len)
  }
  for (let i = 0; i < W * H * 0.04; i++) {
    ax.fillStyle = `rgba(${rng.chance(0.6) ? '20,18,15' : '255,250,240'},${rng.range(0.02, 0.06)})`
    ax.fillRect(ox + rng.range(0, W * ppm), oy + rng.range(0, H * ppm), rng.range(0.5, 3) * ppm, rng.range(0.5, 3) * ppm)
  }
}

/** ground floor: shopfronts with fascia signs, or a glazed lobby in a stone base */
function groundFloor(R, rng, T, { kind, sign, blank, wall }) {
  const { W, ppm } = R
  const gf = T.gf
  fill(R, 0, 0, W, gf, kind === 'lobby' ? '#8f8b84' : '#6f6c66', [0.7, 0])
  fill(R, 0, gf - 0.25, W, 0.25, '#5c5a56', [0.5, 0.3])
  if (blank) {
    fill(R, 0, 0, W, 0.5, '#5e5b55', [0.9, 0])
    return []
  }
  const units = []
  if (kind === 'lobby') {
    const n = Math.max(2, Math.round(W / 1.8))
    const bw = W / n
    for (let i = 0; i < n; i++) {
      const [x, y, w, h] = R.r(i * bw + 0.08, 0.15, bw - 0.16, gf - 0.8)
      pane(R.pg, rng, x, y, w, h, [70, 82, 92], 0.6)
      if (rng.chance(0.85)) litWindow(R.pg, rng, x, y, w, h, true)
    }
    return units
  }
  // shop units 4-7 m: pilasters, glazing, door, fascia sign band
  let u = 0
  while (u < W - 2) {
    const w = Math.min(W - u, rng.range(4, 7))
    const fasH = 0.9
    fill(R, u, 0, 0.35, gf, wall, [0.85, 0])
    const [gx, gy, gw, gh] = R.r(u + 0.45, 0.1, w - 0.7, gf - fasH - 0.45)
    pane(R.pg, rng, gx, gy, gw, gh, [54, 60, 64], 0.35)
    // display interior: shelves / colour blocks behind the glass
    for (let k = 0; k < 5; k++) { R.pg.ax.fillStyle = `hsla(${rng.range(0, 360)},35%,${rng.range(35, 70)}%,0.35)`; R.pg.ax.fillRect(gx + rng.range(0, gw * 0.8), gy + gh * rng.range(0.3, 0.8), gw * rng.range(0.08, 0.2), gh * rng.range(0.1, 0.4)) }
    litWindow(R.pg, rng, gx, gy, gw, gh, rng.chance(0.4))
    fill(R, u + w * 0.62, 0.1, 1.1, 2.3, '#2e3236', [0.4, 0.6])
    // fascia: coloured band + lettering (lit at night)
    const hue = rng.pick([0, 18, 40, 200, 140, 350, 210])
    const [fx, fy, fw, fh] = R.r(u + 0.4, gf - fasH - 0.3, w - 0.6, fasH)
    R.pg.rect(fx, fy, fw, fh, `hsl(${hue},45%,${rng.range(22, 40)}%)`, [0.4, 0.1], `hsl(${hue},55%,12%)`)
    const txt = sign && units.length === 0 ? sign : rng.pick(SHOPS)
    for (const [ctx, k, col] of [[R.pg.ax, 1, '#f3ead6'], [R.pg.ex, K, '#ffe9c0']]) {
      ctx.fillStyle = col
      ctx.font = `bold ${Math.round(fh * 0.62 * k)}px sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(txt, (fx + fw / 2) * k, (fy + fh / 2) * k, fw * 0.9 * k)
    }
    units.push({ u, w, h: gf - fasH - 0.3 })
    u += w
  }
  fill(R, u, 0, 0.35, gf, wall, [0.85, 0])
  return units
}

/**
 * Paint one facade region (W x H m). Returns geometry hints: balconies + AC units (front only)
 * and shop units for awnings. opt: { side, front, sign, wall, floors }
 */
function paintFacade(R, rng, type, opt) {
  const T = opt.T || TYPES[type]
  const { W, H } = R
  const wall = opt.wall
  R.pg.rect(...R.r(0, 0, W, H), wall, [0.88, 0])
  const out = { balconies: [], acs: [], shops: [] }
  const blankSide = opt.side && type !== 'tower' && rng.chance(0.4)
  const kind = opt.side ? (type === 'retail' ? 'shop' : 'lobby') : opt.sign ? 'shop' : T.ground
  out.shops = groundFloor(R, rng, T, { kind, sign: opt.sign, blank: blankSide, wall })
  const top = H - T.par
  const nb = Math.max(1, Math.round(W / T.bay))
  const bw = W / nb
  const cool = type === 'tower' || type === 'ribbon'
  for (let f = 0; f < opt.floors; f++) {
    const y0 = T.gf + f * T.fh
    if (y0 + T.fh > top + 0.01) break
    // office floors light in runs (tenants), homes window by window
    const floorLit = rng.chance(cool ? T.lit * 1.2 : 1)
    if (type === 'tower') {
      fill(R, 0, y0, W, 0.9, '#3d454d', [0.25, 0.7])
      for (let b = 0; b < nb; b++) {
        const [x, y, w, h] = R.r(b * bw + 0.05, y0 + 0.9, bw - 0.1, T.fh - 0.9)
        pane(R.pg, rng, x, y, w, h, [74, 96, 118], 0.92)
        if (floorLit && rng.chance(0.85)) litWindow(R.pg, rng, x, y, w, h, true)
      }
      for (let b = 0; b <= nb; b++) fill(R, b * bw - 0.05, y0, 0.1, T.fh, '#9aa2a8', [0.3, 0.9])
      continue
    }
    if (type === 'ribbon') {
      fill(R, 0, y0, W, 1.1, wall, [0.85, 0])
      for (let b = 0; b < nb; b++) {
        const [x, y, w, h] = R.r(b * bw + 0.04, y0 + 1.1, bw - 0.08, T.fh - 1.6)
        pane(R.pg, rng, x, y, w, h, [58, 70, 82], 0.75)
        if (floorLit && rng.chance(0.8)) litWindow(R.pg, rng, x, y, w, h, true)
      }
      continue
    }
    // punched windows (slab / retail upper floors)
    for (let b = 0; b < nb; b++) {
      if (opt.side && b % 2 === 1) continue
      const bal = T.balcony && opt.front && b % 2 === 0
      const ww = bal ? bw * 0.62 : bw * 0.52
      const wh = bal ? T.fh - 0.75 : 1.55
      const u = b * bw + (bw - ww) / 2
      const h0 = y0 + (bal ? 0.1 : 0.95)
      fill(R, u - 0.08, h0 - 0.08, ww + 0.16, wh + 0.16, '#4a4843', [0.9, 0])
      const [x, y, w, h] = R.r(u, h0, ww, wh)
      pane(R.pg, rng, x, y, w, h, [60, 72, 82], 0.6)
      // frame + mullion, sill
      fill(R, u + ww / 2 - 0.03, h0, 0.06, wh, '#d6d4cc', [0.5, 0.2])
      fill(R, u - 0.1, h0 - 0.1, ww + 0.2, 0.1, '#bdb9b0', [0.8, 0])
      if (rng.chance(0.3)) { R.pg.ax.fillStyle = `hsla(${rng.range(20, 60)},30%,${rng.range(55, 80)}%,0.75)`; R.pg.ax.fillRect(x, y, w * rng.range(0.2, 0.5), h) }
      if (floorLit && rng.chance(T.lit)) litWindow(R.pg, rng, x, y, w, h, rng.chance(0.25))
      if (bal) out.balconies.push({ u: b * bw + bw / 2, w: bw * 0.86, y: y0 })
      else if (opt.front && rng.chance(0.18)) out.acs.push({ u: u + ww * 0.75, y: h0 - 0.55 })
    }
  }
  // parapet band
  fill(R, 0, top, W, T.par, type === 'tower' ? '#5b6168' : wall, [0.8, type === 'tower' ? 0.5 : 0])
  grime(R, rng)
  return out
}

/** quad/box accumulator with explicit uv rects [u0, v0, u1, v1] */
class Geo {
  constructor() { this.p = []; this.n = []; this.uv = []; this.i = [] }
  /** a,b,c,d counter-clockwise seen from outside; uv rect maps a=(u0,v0) b=(u1,v0) c=(u1,v1) d=(u0,v1) */
  quad(a, b, c, d, nrm, [u0, v0, u1, v1]) {
    const o = this.p.length / 3
    this.p.push(...a, ...b, ...c, ...d)
    for (let k = 0; k < 4; k++) this.n.push(...nrm)
    this.uv.push(u0, v0, u1, v0, u1, v1, u0, v1)
    this.i.push(o, o + 1, o + 2, o, o + 2, o + 3)
  }
  /** axis box [x0..x1] [y0..y1] [z0..z1]; f: { px, nx, py, ny, pz, nz } uv rects (missing = skipped) */
  box(x0, x1, y0, y1, z0, z1, f) {
    if (f.pz) this.quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1], f.pz)
    if (f.nz) this.quad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [0, 0, -1], f.nz)
    if (f.px) this.quad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [1, 0, 0], f.px)
    if (f.nx) this.quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [-1, 0, 0], f.nx)
    if (f.py) this.quad([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], [0, 1, 0], f.py)
    if (f.ny) this.quad([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], [0, -1, 0], f.ny)
  }
  /** solid box, every face the same swatch */
  solid(cx, y0, cz, w, h, d, s, bottom = false) {
    this.box(cx - w / 2, cx + w / 2, y0, y0 + h, cz - d / 2, cz + d / 2, { px: s, nx: s, py: s, ny: bottom ? s : null, pz: s, nz: s })
  }
  mesh(material) {
    if (!this.i.length) return null
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3))
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3))
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2))
    g.setIndex(this.i)
    g.computeBoundingSphere()
    const m = new THREE.Mesh(g, material)
    m.castShadow = m.receiveShadow = true
    return m
  }
}

/** sub-rect of a facade uv rect in metres (u from left, h from ground) */
function sub(rect, W, H, u, h, w, hh) {
  const [u0, v0, u1, v1] = rect
  const du = (u1 - u0) / W
  const dv = (v1 - v0) / H
  return [u0 + u * du, v0 + h * dv, u0 + (u + w) * du, v0 + (h + hh) * dv]
}

function pickType(h, rng, sign) {
  if (h <= 8) return 'retail'
  if (h >= 34) return rng.chance(0.75) ? 'tower' : 'slab'
  if (h >= 24) return rng.pick(['tower', 'slab', 'ribbon'])
  return sign ? 'retail' : rng.pick(['slab', 'slab', 'ribbon', 'retail'])
}

/** parapet walls seen from the roof (inward faces) */
function inner(G, x0, x1, y0, y1, z0, z1, s) {
  G.quad([x1, y0, z1], [x0, y0, z1], [x0, y1, z1], [x1, y1, z1], [0, 0, -1], s)
  G.quad([x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], [0, 0, 1], s)
  G.quad([x1, y0, z0], [x1, y0, z1], [x1, y1, z1], [x1, y1, z0], [-1, 0, 0], s)
  G.quad([x0, y0, z1], [x0, y0, z0], [x0, y1, z0], [x0, y1, z1], [1, 0, 0], s)
}

Geo.prototype.cyl = function (cx, y0, cz, r, h, s, seg = 8) {
  const y1 = y0 + h
  for (let k = 0; k < seg; k++) {
    const a0 = (k / seg) * Math.PI * 2
    const a1 = ((k + 1) / seg) * Math.PI * 2
    const p0 = [cx + Math.cos(a0) * r, cz + Math.sin(a0) * r]
    const p1 = [cx + Math.cos(a1) * r, cz + Math.sin(a1) * r]
    const am = (a0 + a1) / 2
    this.quad([p1[0], y0, p1[1]], [p0[0], y0, p0[1]], [p0[0], y1, p0[1]], [p1[0], y1, p1[1]], [Math.cos(am), 0, Math.sin(am)], s)
    this.quad([cx, y1, cz], [p1[0], y1, p1[1]], [p0[0], y1, p0[1]], [p0[0], y1, p0[1]], [0, 1, 0], s)
  }
}

/** one volume: facade on 4 sides, recessed roof behind a parapet */
function volume(G, x0, x1, y0, y1, z0, z1, uvF, uvS, par, S, coping) {
  G.box(x0, x1, y0, y1, z0, z1, { pz: uvF, nz: uvF, px: uvS, nx: uvS })
  if (par <= 0) { G.box(x0, x1, y0, y1, z0, z1, { py: S.roof }); return y1 }
  const t = 0.25
  const yr = y1 - par
  G.box(x0 + t, x1 - t, y0, yr, z0 + t, z1 - t, { py: S.roof })
  inner(G, x0 + t, x1 - t, yr, y1, z0 + t, z1 - t, S.concrete)
  for (const [a0, a1, b0, b1] of [[x0, x1, z1 - t, z1], [x0, x1, z0, z0 + t], [x0, x0 + t, z0 + t, z1 - t], [x1 - t, x1, z0 + t, z1 - t]]) G.box(a0, a1, y0, y1, b0, b1, { py: coping })
  return yr
}

function wallColor(color, type) {
  if (type === 'tower') return '#59616a'
  return '#' + tone(color).multiplyScalar(type === 'retail' ? 0.86 : 0.8).getHexString()
}

/**
 * Realistic background building (local +z = street front). Same params as the stylised
 * cityBlock; real floor heights so the final height snaps to whole floors near `h`.
 */
export function cityBlockReal({ w = 12, d = 10, h = 18, seed = 5, color = '#d9d2c3', sign } = {}) {
  const rng = createRng(seed * 13 + 7)
  const type = pickType(h, rng, sign)
  const T = { ...TYPES[type] }
  const floors = Math.max(0, Math.round((h - T.gf - T.par) / T.fh))
  if (floors === 0) T.gf = Math.max(3.6, h - T.par)
  const H = T.gf + floors * T.fh + T.par
  const ppm = Math.min(H > 30 ? 12 : H > 12 ? 16 : 28, (PAGE - STRIP - 2 * GUT) / H)
  const { pg, o } = pageFor((w + d) * ppm + GUT * 2, H * ppm)
  const S = pg.swatch
  const wall = wallColor(color, type)
  const RF = region(pg, o[0], o[1], w, H, ppm)
  const RS = region(pg, o[0] + w * ppm + GUT * 2, o[1], d, H, ppm)
  const front = paintFacade(RF, rng, type, { front: true, sign, wall, floors, T })
  paintFacade(RS, rng, type, { side: true, wall, floors, T })
  const uvF = pg.uv(RF.ox, RF.oy, w * ppm, H * ppm, 1)
  const uvS = pg.uv(RS.ox, RS.oy, d * ppm, H * ppm, 1)

  const B = new Geo()
  const D = new Geo()
  const coping = type === 'tower' ? S.coping : S.concrete
  const x0 = -w / 2, x1 = w / 2, z0 = -d / 2, z1 = d / 2
  let rx0 = x0, rx1 = x1, rz0 = z0, rz1 = z1
  let roofY
  if (type === 'tower' && floors >= 5) {
    // podium on the full footprint, glass shaft set back above it
    const pH = T.gf + T.fh
    const py = volume(B, x0, x1, 0, pH, z0, z1, sub(uvF, w, H, 0, 0, w, pH), sub(uvS, d, H, 0, 0, d, pH), 0.6, S, S.coping)
    const ix = Math.min(1.5, w * 0.1)
    const iz = Math.min(1.5, d * 0.12)
    rx0 = x0 + ix; rx1 = x1 - ix; rz0 = z0 + iz; rz1 = z1 - iz
    roofY = volume(B, rx0, rx1, py, H, rz0, rz1, sub(uvF, w, H, ix, py, w - 2 * ix, H - py), sub(uvS, d, H, iz, py, d - 2 * iz, H - py), T.par, S, coping)
    D.solid(0, T.gf - 0.7, z1 + 1.4, w * 0.4, 0.3, 2.8, S.coping, true)
  } else roofY = volume(B, x0, x1, 0, H, z0, z1, uvF, uvS, T.par, S, coping)

  // roof plant: HVAC units, stair / lift overrun, water tank on a stand, antenna
  const inX = Math.max(0.1, (rx1 - rx0) / 2 - 1.3)
  const inZ = Math.max(0.1, (rz1 - rz0) / 2 - 1.3)
  const cx = (rx0 + rx1) / 2
  const cz = (rz0 + rz1) / 2
  const spot = () => [cx + rng.jitter(inX), cz + rng.jitter(inZ)]
  const n = Math.min(5, Math.round(((rx1 - rx0) * (rz1 - rz0)) / 40) + 1)
  for (let i = 0; i < n; i++) { const [x, z] = spot(); D.solid(x, roofY, z, rng.range(1.2, 2.4), rng.range(0.9, 1.5), rng.range(1, 1.8), S.hvac) }
  if (H > 14) { const [x, z] = spot(); D.solid(x, roofY, z, Math.min(4, inX * 1.5), 3, Math.min(3.5, inZ * 1.5), S.concreteDark) }
  if (type !== 'tower' && H > 10 && rng.chance(0.7)) {
    const [x, z] = spot()
    for (const [dx, dz] of [[-0.7, -0.7], [0.7, -0.7], [0.7, 0.7], [-0.7, 0.7]]) D.solid(x + dx, roofY, z + dz, 0.12, 1.4, 0.12, S.dark)
    D.cyl(x, roofY + 1.4, z, 1.1, 1.8, S.tank)
  }
  if (type === 'tower') D.solid(cx + inX * 0.5, roofY, cz, 0.15, 6, 0.15, S.dark)

  // facade depth: balconies (slab + solid front + sides), AC condensers, shop awnings
  for (const b of front.balconies) {
    const x = x0 + b.u
    D.solid(x, b.y, z1 + 0.6, b.w, 0.18, 1.2, S.concrete, true)
    D.solid(x, b.y + 0.18, z1 + 1.15, b.w, 0.95, 0.1, S.white)
    for (const s of [-1, 1]) D.solid(x + (s * b.w) / 2, b.y + 0.18, z1 + 0.6, 0.1, 0.95, 1.1, S.white)
  }
  for (const a of front.acs) D.solid(x0 + a.u, a.y, z1 + 0.3, 0.8, 0.55, 0.6, S.acUnit, true)
  for (const s of front.shops) {
    if (!rng.chance(0.6)) continue
    const sw = S[rng.pick(['awnRed', 'awnGreen', 'awnBlue', 'awnBeige'])]
    const xa = x0 + s.u + 0.4
    const xb = x0 + s.u + s.w - 0.3
    const yt = s.h
    const yb = s.h - 0.7
    const zo = z1 + 1.3
    D.quad([xa, yb, zo], [xb, yb, zo], [xb, yt, z1], [xa, yt, z1], [0, 0.88, 0.47], sw)
    D.quad([xa, yt, z1], [xb, yt, z1], [xb, yb, zo], [xa, yb, zo], [0, -1, 0], sw)
    D.quad([xa, yb - 0.25, zo], [xb, yb - 0.25, zo], [xb, yb, zo], [xa, yb, zo], [0, 0, 1], sw)
  }
  const g = new THREE.Group()
  g.name = `city.${type}`
  g.add(B.mesh(pg.body))
  const dm = D.mesh(pg.detail)
  if (dm) g.add(dm)
  return { object: g }
}
