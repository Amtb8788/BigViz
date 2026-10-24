// Procedural textures (canvas). No image files are required to run a scene: every PBR set
// (albedo / normal / roughness / AO) and every desk sheet is drawn here from a seed.
// Swap any entry for a real texture file later without touching prefabs.

import * as THREE from 'three'
import { createRng } from '../core/rng.js'

const cache = new Map()

export function makeCanvas(w, h = w) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return c
}

/** Tileable fractal value noise in 0..1 */
export function fbm(size, { scale = 8, octaves = 4, seed = 1 } = {}) {
  const rng = createRng(seed)
  const out = new Float32Array(size * size)
  let amp = 1
  let total = 0
  for (let o = 0; o < octaves; o++) {
    const g = scale * (1 << o)
    const grid = new Float32Array(g * g)
    for (let i = 0; i < grid.length; i++) grid[i] = rng.next()
    for (let y = 0; y < size; y++) {
      const fy = (y / size) * g
      const y0 = Math.floor(fy)
      const ty = fy - y0
      const sy = ty * ty * (3 - 2 * ty)
      const y1 = (y0 + 1) % g
      for (let x = 0; x < size; x++) {
        const fx = (x / size) * g
        const x0 = Math.floor(fx)
        const tx = fx - x0
        const sx = tx * tx * (3 - 2 * tx)
        const x1 = (x0 + 1) % g
        const a = grid[y0 * g + x0]
        const b = grid[y0 * g + x1]
        const c = grid[y1 * g + x0]
        const d = grid[y1 * g + x1]
        const top = a + (b - a) * sx
        out[y * size + x] += amp * (top + (c + (d - c) * sx - top) * sy)
      }
    }
    total += amp
    amp *= 0.5
  }
  for (let i = 0; i < out.length; i++) out[i] /= total
  return out
}

export function toTexture(c, { srgb = false, repeat = 1 } = {}) {
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(repeat, repeat)
  t.anisotropy = 4
  if (srgb) t.colorSpace = THREE.SRGBColorSpace
  return t
}

export function fieldToCanvas(size, fn) {
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

export function normalFromHeight(h, size, strength) {
  return fieldToCanvas(size, (i) => {
    const x = i % size
    const y = (i / size) | 0
    const l = h[y * size + ((x - 1 + size) % size)]
    const r = h[y * size + ((x + 1) % size)]
    const u = h[((y - 1 + size) % size) * size + x]
    const d = h[((y + 1) % size) * size + x]
    const nx = (l - r) * strength
    const ny = (u - d) * strength
    const len = Math.hypot(nx, ny, 1)
    return [((nx / len) * 0.5 + 0.5) * 255, ((ny / len) * 0.5 + 0.5) * 255, ((1 / len) * 0.5 + 0.5) * 255]
  })
}

const SURFACES = {
  concrete: { base: [190, 186, 176], vary: 34, scale: 6, seed: 11, normal: 3, rough: [0.82, 0.14], speck: 0.04 },
  asphalt: { base: [70, 72, 78], vary: 26, scale: 16, seed: 21, normal: 4, rough: [0.78, 0.12], speck: 0.12 },
  soil: { base: [128, 100, 72], vary: 46, scale: 5, seed: 31, normal: 6, rough: [0.95, 0.05], speck: 0.08 },
  grass: { base: [104, 146, 74], vary: 40, scale: 12, seed: 41, normal: 2.5, rough: [0.9, 0.06], speck: 0.2 },
  paving: { base: [196, 188, 172], vary: 20, scale: 4, seed: 51, normal: 2, rough: [0.7, 0.12], tiles: 8 },
  // grain = stripe cycles per tile (wood tiles use a 1024px canvas)
  wood: { base: [128, 86, 54], vary: 30, scale: 4, seed: 61, normal: 0.5, rough: [0.55, 0.15], grain: 220 },
  plinth: { base: [58, 44, 34], vary: 22, scale: 4, seed: 71, normal: 0.5, rough: [0.45, 0.1], grain: 160 }
}

/**
 * PBR texture set for a named surface: { map, normalMap, roughnessMap, aoMap }
 * @param {keyof SURFACES} name
 */
export function surface(name, repeat = 1) {
  const key = `${name}:${repeat}`
  if (cache.has(key)) return cache.get(key)
  const s = SURFACES[name]
  const size = s.grain ? 1024 : 256
  const n = fbm(size, { scale: s.scale, seed: s.seed })
  const fine = fbm(size, { scale: s.scale * 8, octaves: 2, seed: s.seed + 1 })
  const rng = createRng(s.seed + 7)
  const h = new Float32Array(size * size)
  for (let i = 0; i < h.length; i++) {
    const x = i % size
    const y = (i / size) | 0
    let v = n[i] * 0.7 + fine[i] * 0.3
    if (s.grain) {
      // fine straight grain along x: integer cycles per tile so it wraps seamlessly,
      // gently warped by the coarse noise, plus soft plank-scale colour bands
      const t = (y / size) * Math.PI * 2
      const g = Math.sin(t * s.grain + n[i] * 5)
      const band = Math.sin(t * 6 + n[i] * 2)
      v = 0.5 + 0.12 * g * g * Math.sign(g) + 0.08 * band + (fine[i] - 0.5) * 0.12
    }
    if (s.tiles) {
      const t = size / s.tiles
      const gx = x % t
      const gyy = y % t
      if (gx < 2 || gyy < 2) v *= 0.55
    }
    if (s.speck && rng.next() < s.speck * 0.1) v *= 0.6
    h[i] = v
  }
  const albedo = fieldToCanvas(size, (i) => {
    const d = (h[i] - 0.5) * s.vary * 2
    return [s.base[0] + d, s.base[1] + d * 0.95, s.base[2] + d * 0.9]
  })
  const rough = fieldToCanvas(size, (i) => {
    const r = (s.rough[0] + (h[i] - 0.5) * s.rough[1] * 2) * 255
    return [r, r, r]
  })
  const ao = fieldToCanvas(size, (i) => {
    const a = (0.75 + h[i] * 0.25) * 255
    return [a, a, a]
  })
  const set = {
    map: toTexture(albedo, { srgb: true, repeat }),
    normalMap: toTexture(normalFromHeight(h, size, s.normal), { repeat }),
    roughnessMap: toTexture(rough, { repeat }),
    aoMap: toTexture(ao, { repeat })
  }
  cache.set(key, set)
  return set
}

/** Soft radial sprite (glows, particles, light pools) */
export function radialTexture(inner = 'rgba(255,255,255,1)', outer = 'rgba(255,255,255,0)', size = 128) {
  const key = `radial:${inner}:${outer}`
  if (cache.has(key)) return cache.get(key)
  const c = makeCanvas(size)
  const ctx = c.getContext('2d')
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  g.addColorStop(0, inner)
  g.addColorStop(0.35, inner.replace(/[\d.]+\)$/, '0.45)'))
  g.addColorStop(1, outer)
  ctx.fillStyle = g
  ctx.fillRect(0, 0, size, size)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  cache.set(key, t)
  return t
}
