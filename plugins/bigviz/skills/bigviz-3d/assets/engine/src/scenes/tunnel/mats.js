// Tunnel pack - procedural PBR surfaces (512 px, tileable, built lazily on first use):
// blasted rock, sprayed shotcrete, cast lining with formwork joints, waterproofing membrane,
// ventilation duct fabric, terrain detail. UVs are metres; textures repeat every 4 m.

import * as THREE from 'three'
import { fbm, makeCanvas, normalFromHeight, toTexture } from '../../render/textures.js'
import { createRng } from '../../core/rng.js'

const S = 512
const cache = new Map()
const once = (k, f) => (cache.has(k) ? cache.get(k) : (cache.set(k, f()), cache.get(k)))

function img(fn) {
  const c = makeCanvas(S)
  const ctx = c.getContext('2d')
  const d = ctx.createImageData(S, S)
  for (let i = 0; i < S * S; i++) {
    const [r, g, b] = fn(i)
    d.data[i * 4] = Math.max(0, Math.min(255, r)); d.data[i * 4 + 1] = Math.max(0, Math.min(255, g)); d.data[i * 4 + 2] = Math.max(0, Math.min(255, b)); d.data[i * 4 + 3] = 255
  }
  ctx.putImageData(d, 0, 0)
  return c
}

/** random-walk lines (cracks, seams) into a float field */
function walk(field, rng, n, len, k, w = 1) {
  for (let c = 0; c < n; c++) {
    let x = rng.range(0, S), y = rng.range(0, S), a = rng.range(0, Math.PI * 2)
    for (let s = 0; s < len; s++) {
      a += rng.range(-0.3, 0.3); x += Math.cos(a); y += Math.sin(a)
      for (let o = 0; o < w; o++) { const i = ((Math.round(y + o) % S + S) % S) * S + ((Math.round(x) % S + S) % S); field[i] += k }
    }
  }
}

/** { map, normalMap, roughnessMap } from per-pixel height / colour / roughness */
function pbr(h, col, rough, normal, repeat) {
  const map = toTexture(img((i) => [col[i * 3], col[i * 3 + 1], col[i * 3 + 2]]), { srgb: true, repeat })
  const normalMap = toTexture(normalFromHeight(h, S, normal), { repeat })
  const roughnessMap = toTexture(img((i) => { const v = rough[i] * 255; return [v, v, v] }), { repeat })
  for (const t of [map, normalMap, roughnessMap]) t.anisotropy = 8
  return { map, normalMap, roughnessMap }
}

function field(build) {
  const h = new Float32Array(S * S), col = new Float32Array(S * S * 3), r = new Float32Array(S * S)
  build(h, col, r)
  return { h, col, r }
}

// blasted rock: angular facets (quantised fbm), joints, ochre staining, wet seepage
const rockSet = () => once('rock', () => {
  const rng = createRng(901)
  const a = fbm(S, { scale: 6, octaves: 5, seed: 902 })
  const b = fbm(S, { scale: 24, octaves: 3, seed: 903 })
  const st = fbm(S, { scale: 3, octaves: 3, seed: 904 })
  const j = new Float32Array(S * S)
  walk(j, rng, 14, 420, 1, 2)
  return field((h, col, r) => {
    for (let i = 0; i < S * S; i++) {
      const facet = Math.round(a[i] * 9) / 9
      const joint = Math.min(1, j[i])
      h[i] = facet * 0.7 + b[i] * 0.3 - joint * 0.5
      const ochre = Math.max(0, st[i] - 0.55) * 2.2
      const g = 92 + (a[i] - 0.5) * 70 + (b[i] - 0.5) * 30 - joint * 38
      col[i * 3] = g + ochre * 34; col[i * 3 + 1] = g - 2 + ochre * 14; col[i * 3 + 2] = g - 6 - ochre * 10
      r[i] = 0.86 - joint * 0.3 - Math.max(0, 0.4 - st[i]) * 0.5
    }
  })
})

// shotcrete: lumpy sprayed surface, rebound blobs, darker damp streaks running down
const shotSet = () => once('shot', () => {
  const a = fbm(S, { scale: 10, octaves: 4, seed: 911 })
  const b = fbm(S, { scale: 48, octaves: 2, seed: 912 })
  const w = fbm(S, { scale: 4, octaves: 3, seed: 913 })
  return field((h, col, r) => {
    for (let i = 0; i < S * S; i++) {
      const x = i % S
      const lump = a[i] * 0.6 + b[i] * 0.4
      const damp = Math.max(0, Math.sin(x / S * Math.PI * 14 + w[i] * 9) - 0.55) * w[i] * 1.6
      h[i] = lump
      const g = 132 + (lump - 0.5) * 46 - damp * 46
      col[i * 3] = g + 2; col[i * 3 + 1] = g + 1; col[i * 3 + 2] = g - 3
      r[i] = 0.93 - damp * 0.45
    }
  })
})

// second lining: smooth cast concrete, horizontal board marks, pour joint, light efflorescence
const liningSet = () => once('lining', () => {
  const a = fbm(S, { scale: 5, octaves: 4, seed: 921 })
  const b = fbm(S, { scale: 64, octaves: 2, seed: 922 })
  return field((h, col, r) => {
    for (let i = 0; i < S * S; i++) {
      const x = i % S, y = (i / S) | 0
      const board = Math.abs(((y / S) * 8) % 1 - 0.5) > 0.485 ? 1 : 0
      const joint = x < 3 ? 1 : 0
      h[i] = 0.5 + (b[i] - 0.5) * 0.15 - board * 0.2 - joint * 0.6
      const g = 168 + (a[i] - 0.5) * 22 + (b[i] - 0.5) * 8 - board * 10 - joint * 40
      col[i * 3] = g; col[i * 3 + 1] = g; col[i * 3 + 2] = g - 4
      r[i] = 0.72 + (a[i] - 0.5) * 0.12
    }
  })
})

// waterproofing membrane (EVA, 2 m sheets with welded seams) on geotextile
const membraneSet = () => once('membrane', () => {
  const a = fbm(S, { scale: 12, octaves: 3, seed: 931 })
  return field((h, col, r) => {
    for (let i = 0; i < S * S; i++) {
      const y = (i / S) | 0
      const seam = Math.abs(((y / S) * 2) % 1 - 0.5) > 0.47 ? 1 : 0
      h[i] = a[i] * 0.5 + seam * 0.3
      col[i * 3] = 214 + (a[i] - 0.5) * 18 - seam * 30; col[i * 3 + 1] = 202 + (a[i] - 0.5) * 16 - seam * 30; col[i * 3 + 2] = 150 - seam * 20
      r[i] = 0.45 + a[i] * 0.2
    }
  })
})

// terrain detail: neutral (multiplied with vertex colours), grassy clumps + soil grain
const groundSet = () => once('ground', () => {
  const a = fbm(S, { scale: 16, octaves: 4, seed: 941 })
  const b = fbm(S, { scale: 64, octaves: 2, seed: 942 })
  return field((h, col, r) => {
    for (let i = 0; i < S * S; i++) {
      const v = a[i] * 0.6 + b[i] * 0.4
      h[i] = v
      const g = 170 + (v - 0.5) * 120
      col[i * 3] = g; col[i * 3 + 1] = g; col[i * 3 + 2] = g
      r[i] = 0.95
    }
  })
})

const MAT = new Map()
function make(key, setFn, repeat, extra) {
  if (MAT.has(key)) return MAT.get(key)
  const s = setFn()
  const f = pbr(s.h, s.col, s.r, extra.normal ?? 2, 1 / repeat)
  const m = new THREE.MeshStandardMaterial({ ...f, color: extra.color || '#ffffff', roughness: 1, metalness: 0, side: extra.side ?? THREE.FrontSide, ...(extra.mat || {}) })
  m.normalScale.set(extra.ns ?? 1, extra.ns ?? 1)
  m.name = `tunnel.${key}`
  MAT.set(key, m)
  return m
}

export const rockMat = () => make('rock', rockSet, 4, { normal: 5, ns: 1.4, side: THREE.DoubleSide })
export const outcropMat = () => make('outcrop', rockSet, 6, { normal: 4, color: '#c9c2b4' })
export const shotMat = () => make('shot', shotSet, 3, { normal: 4, ns: 1.2, side: THREE.DoubleSide })
export const liningMat = () => make('lining', liningSet, 12, { normal: 2, ns: 0.6 })
export const membraneMat = () => make('membrane', membraneSet, 4, { normal: 2, ns: 0.5, side: THREE.DoubleSide })
export const capMat = () => make('cap', rockSet, 5, { normal: 5, color: '#8f877b' })
export const terrainMat = () => make('terrain', groundSet, 6, { normal: 2.5, mat: { vertexColors: true } })

/** plain coloured, cached */
export function plain(color, roughness = 0.7, metalness = 0, opts = {}) {
  const key = `p:${color}:${roughness}:${metalness}:${opts.side || 0}:${opts.emissive || ''}`
  if (MAT.has(key)) return MAT.get(key)
  const m = new THREE.MeshStandardMaterial({ color, roughness, metalness, ...opts })
  MAT.set(key, m)
  return m
}

/** every material made here (the section clip is applied to them too) */
export const tunnelMaterials = () => [...MAT.values()]
