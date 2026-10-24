// Realistic-style procedural surfaces (512px, tileable): asphalt with aggregate, cracks,
// patches and oil stains; board-marked concrete; rutted soil with pebbles; clumpy grass;
// running-bond pavers. Plus wear maps (grime for painted machinery, worn road paint).
// Same output shape as textures.surface(): { map, normalMap, roughnessMap, aoMap }.

import * as THREE from 'three'
import { createRng } from '../core/rng.js'
import { fbm, makeCanvas, normalFromHeight, toTexture, surface } from './textures.js'

const cache = new Map()
const S = 512

/** working buffers: h height 0..1, col rgb 0..255, r roughness 0..1 */
function buffers(size = S) {
  return { h: new Float32Array(size * size), col: new Float32Array(size * size * 3), r: new Float32Array(size * size) }
}

const wrap = (v, n) => ((v % n) + n) % n

function toCanvas(size, fn) {
  const c = makeCanvas(size)
  const ctx = c.getContext('2d')
  const img = ctx.createImageData(size, size)
  for (let i = 0; i < size * size; i++) {
    const [r, g, b] = fn(i)
    img.data[i * 4] = r
    img.data[i * 4 + 1] = g
    img.data[i * 4 + 2] = b
    img.data[i * 4 + 3] = 255
  }
  ctx.putImageData(img, 0, 0)
  return c
}

/** stamp a soft disc: fn(i, k) with k = 1 at centre .. 0 at the rim (tile-wrapped) */
function blob(size, cx, cy, rad, fn) {
  const r = Math.ceil(rad)
  for (let y = -r; y <= r; y++) {
    for (let x = -r; x <= r; x++) {
      const d = Math.hypot(x, y) / rad
      if (d >= 1) continue
      fn(wrap(cy + y, size) * size + wrap(cx + x, size), 1 - d * d)
    }
  }
}

/** random-walk crack polyline; fn(i, k) per touched pixel */
function crack(size, rng, len, fn) {
  let x = rng.range(0, size)
  let y = rng.range(0, size)
  let a = rng.range(0, Math.PI * 2)
  for (let s = 0; s < len; s++) {
    a += rng.range(-0.35, 0.35)
    x += Math.cos(a)
    y += Math.sin(a)
    fn(wrap(Math.round(y), size) * size + wrap(Math.round(x), size), 1)
    if (rng.chance(0.3)) fn(wrap(Math.round(y + 1), size) * size + wrap(Math.round(x), size), 0.5)
    if (rng.chance(0.012)) crackBranch(size, rng, x, y, a + rng.range(-1.2, 1.2), len * 0.3, fn)
  }
}

function crackBranch(size, rng, x, y, a, len, fn) {
  for (let s = 0; s < len; s++) {
    a += rng.range(-0.4, 0.4)
    x += Math.cos(a)
    y += Math.sin(a)
    fn(wrap(Math.round(y), size) * size + wrap(Math.round(x), size), 0.7)
  }
}

function finish(b, size, normal, repeat, aoK = 0.3) {
  const { h, col, r } = b
  const set = {
    map: toTexture(toCanvas(size, (i) => [col[i * 3], col[i * 3 + 1], col[i * 3 + 2]].map((v) => Math.max(0, Math.min(255, v)))), { srgb: true, repeat }),
    normalMap: toTexture(normalFromHeight(h, size, normal), { repeat }),
    roughnessMap: toTexture(toCanvas(size, (i) => { const v = Math.max(0, Math.min(1, r[i])) * 255; return [v, v, v] }), { repeat }),
    aoMap: toTexture(toCanvas(size, (i) => { const v = (1 - aoK + Math.min(1, h[i]) * aoK) * 255; return [v, v, v] }), { repeat })
  }
  for (const t of Object.values(set)) t.anisotropy = 8
  return set
}

const BUILD = {}

/** PBR set for a named surface in the realistic style (falls back to the diorama set) */
export function realSurface(name, repeat = 1) {
  const key = `${name}:${repeat}`
  if (cache.has(key)) return cache.get(key)
  const set = BUILD[name] ? BUILD[name](repeat) : surface(name, repeat)
  cache.set(key, set)
  return set
}
// asphalt: fine aggregate, coarse tonal patches, sealed cracks, repair patches, oil stains
BUILD.asphalt = (repeat) => {
  const b = buffers()
  const rng = createRng(121)
  const n = fbm(S, { scale: 4, octaves: 4, seed: 122 })
  const f = fbm(S, { scale: 64, octaves: 2, seed: 123 })
  for (let i = 0; i < S * S; i++) {
    const agg = rng.next()
    const stone = agg > 0.93 ? 1 : agg < 0.05 ? -1 : 0
    const v = 58 + (n[i] - 0.5) * 22 + (f[i] - 0.5) * 18 + stone * 16
    // neutral-warm grey (blue tint read as water under the sky env)
    b.col[i * 3] = v + 2; b.col[i * 3 + 1] = v + 1; b.col[i * 3 + 2] = v - 1
    b.h[i] = 0.5 + (f[i] - 0.5) * 0.3 + stone * 0.12
    b.r[i] = 0.93 + (f[i] - 0.5) * 0.08 - stone * 0.05
  }
  // repair patches (darker, smoother rectangles)
  for (let p = 0; p < 3; p++) {
    const x0 = rng.int(0, S), y0 = rng.int(0, S), w = rng.int(40, 120), hh = rng.int(30, 90)
    for (let y = 0; y < hh; y++) for (let x = 0; x < w; x++) {
      const i = wrap(y0 + y, S) * S + wrap(x0 + x, S)
      for (let c = 0; c < 3; c++) b.col[i * 3 + c] -= 12
      b.r[i] -= 0.08
    }
  }
  // oil / tyre stains
  for (let p = 0; p < 7; p++) blob(S, rng.int(0, S), rng.int(0, S), rng.range(10, 34), (i, k) => {
    for (let c = 0; c < 3; c++) b.col[i * 3 + c] -= 20 * k
    b.r[i] -= 0.35 * k
  })
  // cracks (sealed with darker bitumen)
  for (let c = 0; c < 5; c++) crack(S, rng, rng.int(120, 320), (i, k) => {
    for (let q = 0; q < 3; q++) b.col[i * 3 + q] -= 22 * k
    b.h[i] -= 0.4 * k
    b.r[i] -= 0.1 * k
  })
  return finish(b, S, 1.2, repeat, 0.25)
}

// concrete: mottled cement, form-board panel joints, tie holes, faint stains
BUILD.concrete = (repeat) => {
  const b = buffers()
  const rng = createRng(131)
  const n = fbm(S, { scale: 5, octaves: 5, seed: 132 })
  const f = fbm(S, { scale: 48, octaves: 2, seed: 133 })
  const P = S / 4
  for (let i = 0; i < S * S; i++) {
    const x = i % S, y = (i / S) | 0
    let v = 150 + (n[i] - 0.5) * 34 + (f[i] - 0.5) * 12
    let h = 0.5 + (f[i] - 0.5) * 0.4
    if (x % P < 2 || y % (P * 2) < 2) { v -= 26; h -= 0.5 }
    if (rng.chance(0.004)) { v -= 30; h -= 0.3 }
    b.col[i * 3] = v; b.col[i * 3 + 1] = v - 1; b.col[i * 3 + 2] = v - 5
    b.h[i] = h
    b.r[i] = 0.88 + (n[i] - 0.5) * 0.14
  }
  for (let px = 0; px < 4; px++) for (let py = 0; py < 2; py++) for (const [ox, oy] of [[0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75]]) {
    blob(S, Math.round((px + ox) * P), Math.round((py + oy) * P * 2), 3, (i, k) => { for (let c = 0; c < 3; c++) b.col[i * 3 + c] -= 40 * k; b.h[i] -= 0.6 * k })
  }
  for (let p = 0; p < 5; p++) blob(S, rng.int(0, S), rng.int(0, S), rng.range(20, 60), (i, k) => { for (let c = 0; c < 3; c++) b.col[i * 3 + c] -= 10 * k })
  return finish(b, S, 3, repeat, 0.3)
}
// soil: compacted earth, damp patches, tyre ruts with tread, pebbles
BUILD.soil = (repeat) => {
  const b = buffers()
  const rng = createRng(141)
  const n = fbm(S, { scale: 4, octaves: 5, seed: 142 })
  const f = fbm(S, { scale: 40, octaves: 3, seed: 143 })
  for (let i = 0; i < S * S; i++) {
    const x = i % S, y = (i / S) | 0
    const damp = Math.max(0, n[i] - 0.55) * 2.2
    // two ruts along y (wrapped bands) with tread ripples
    const rut = Math.max(0, 1 - Math.abs(((x + n[i] * 30) % (S / 2)) - S / 4) / 18)
    const tread = rut > 0 ? Math.sin(y * 0.9) * 0.5 + 0.5 : 0
    const v = 1 - damp * 0.35 - rut * 0.12
    b.col[i * 3] = (112 + (f[i] - 0.5) * 40) * v
    b.col[i * 3 + 1] = (90 + (f[i] - 0.5) * 32) * v
    b.col[i * 3 + 2] = (68 + (f[i] - 0.5) * 24) * v
    b.h[i] = 0.5 + (f[i] - 0.5) * 0.8 - rut * 0.35 + tread * rut * 0.12
    b.r[i] = 0.95 - damp * 0.3
  }
  for (let p = 0; p < 900; p++) blob(S, rng.int(0, S), rng.int(0, S), rng.range(1.2, 3.5), (i, k) => {
    const g = rng.range(-20, 30)
    b.col[i * 3] = 120 + g; b.col[i * 3 + 1] = 114 + g; b.col[i * 3 + 2] = 104 + g
    b.h[i] += 0.5 * k
    b.r[i] = 0.75
  })
  return finish(b, S, 6, repeat, 0.35)
}

// grass: blade noise, clumps, dry straw patches, a little soil showing through
BUILD.grass = (repeat) => {
  const b = buffers()
  const rng = createRng(151)
  const n = fbm(S, { scale: 6, octaves: 4, seed: 152 })
  const f = fbm(S, { scale: 96, octaves: 2, seed: 153 })
  for (let i = 0; i < S * S; i++) {
    const blade = rng.next()
    const dry = Math.max(0, n[i] - 0.6) * 2.5
    const bare = Math.max(0, 0.28 - n[i]) * 3
    const g = 0.75 + f[i] * 0.35 + (blade - 0.5) * 0.3
    let r = 62 * g, gg = 92 * g, bb = 44 * g
    r += dry * 60; gg += dry * 30; bb += dry * 8
    r = r * (1 - bare) + 98 * bare; gg = gg * (1 - bare) + 82 * bare; bb = bb * (1 - bare) + 60 * bare
    b.col[i * 3] = r; b.col[i * 3 + 1] = gg; b.col[i * 3 + 2] = bb
    b.h[i] = f[i] * 0.7 + blade * 0.3
    b.r[i] = 0.92
  }
  return finish(b, S, 3, repeat, 0.35)
}

// paving: 0.4 x 0.2 m pavers in running bond (tile 8 m -> 20 x 40 pavers), worn joints
BUILD.paving = (repeat) => {
  const b = buffers()
  const rng = createRng(161)
  const n = fbm(S, { scale: 5, octaves: 4, seed: 162 })
  const f = fbm(S, { scale: 64, octaves: 2, seed: 163 })
  const PW = S / 20, PH = S / 40
  const tint = Array.from({ length: 800 }, () => rng.range(-10, 10))
  for (let i = 0; i < S * S; i++) {
    const x = i % S, y = (i / S) | 0
    const row = Math.floor(y / PH)
    const xs = (x + (row % 2) * PW * 0.5) % S
    const col = Math.floor(xs / PW)
    const joint = xs % PW < 1.5 || y % PH < 1.5
    const t = tint[(row * 20 + col) % 800]
    let v = 158 + t + (n[i] - 0.5) * 26 + (f[i] - 0.5) * 10
    if (joint) v = 96 + (f[i] - 0.5) * 20
    b.col[i * 3] = v; b.col[i * 3 + 1] = v - 3; b.col[i * 3 + 2] = v - 9
    b.h[i] = joint ? 0.1 : 0.6 + (f[i] - 0.5) * 0.3
    b.r[i] = joint ? 0.95 : 0.8 + (n[i] - 0.5) * 0.15
  }
  return finish(b, S, 4, 1 * repeat, 0.35)
}

/**
 * Wear maps: 'grime' (near-white albedo multiplier + roughness, dirt toward face edges, scratches)
 * for painted machinery / steel; 'paint' (worn road marking: asphalt showing through).
 */
export function wearTexture(kind = 'grime') {
  if (cache.has(`wear:${kind}`)) return cache.get(`wear:${kind}`)
  const N = 256
  const rng = createRng(kind === 'paint' ? 171 : 181)
  const n = fbm(N, { scale: 4, octaves: 4, seed: rng.int(1, 999) })
  const f = fbm(N, { scale: 32, octaves: 2, seed: rng.int(1, 999) })
  const alb = new Float32Array(N * N)
  const ro = new Float32Array(N * N)
  for (let i = 0; i < N * N; i++) {
    const x = (i % N) / N, y = ((i / N) | 0) / N
    if (kind === 'paint') {
      const worn = Math.max(0, f[i] * 0.7 + n[i] * 0.6 - 0.62) * 3
      alb[i] = 1 - Math.min(0.75, worn)
      ro[i] = 0.7 + worn * 0.2
    } else {
      // edges of each face (uv 0/1) collect dirt; streaks run along v
      const edge = Math.max(0, 1 - Math.min(x, 1 - x, y, 1 - y) * 7)
      const streak = Math.max(0, f[(i % N) * 7 % N] - 0.55)
      const dirt = Math.min(1, edge * 0.55 + Math.max(0, n[i] - 0.55) * 1.2 + streak * 0.8)
      alb[i] = 1 - dirt * 0.38
      ro[i] = 0.82 + dirt * 0.18
    }
  }
  if (kind !== 'paint') for (let s = 0; s < 40; s++) crack(N, rng, rng.int(6, 22), (i) => { alb[i] = Math.min(1, alb[i] + 0.12); ro[i] = 0.55 })
  const map = toTexture(toCanvas(N, (i) => { const v = alb[i] * 255; return [v, v * 0.985, v * 0.96] }), { srgb: true })
  // roughnessMap multiplies material.roughness (green channel)
  const rough = toTexture(toCanvas(N, (i) => { const v = Math.min(1, ro[i]) * 255; return [v, v, v] }))
  const set = { map, rough }
  cache.set(`wear:${kind}`, set)
  return set
}
