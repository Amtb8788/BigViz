// Park pack - facade tiles. Each tile is a true-scale patch of facade (bays x floors) drawn
// into three canvases: albedo (sky-graded glass, frit spandrels, blinds, curtains), emissive
// (office runs by tenant, home windows one by one, furniture silhouettes) and an ORM map
// (G roughness, B metalness: glass is a smooth mirror, panels / render are rough). Building
// faces map UVs in metres / tile size with repeat wrapping, so one tile covers a whole tower.

import * as THREE from 'three'
import { makeCanvas } from '../../render/textures.js'
import { createRng } from '../../core/rng.js'

const PPM = 16 // pixels per metre
const WARM = [[255, 200, 130], [255, 214, 160], [250, 190, 120], [255, 226, 180]]
const COOL = [[214, 228, 255], [232, 240, 255], [200, 216, 240], [240, 236, 222]]
const rgb = (c, f = 1) => `rgb(${c.map((v) => Math.max(0, Math.min(255, Math.round(v * f)))).join(',')})`

function sheet(Wm, Hm) {
  const w = Math.round(Wm * PPM)
  const h = Math.round(Hm * PPM)
  const a = makeCanvas(w, h)
  const e = makeCanvas(w, h)
  const r = makeCanvas(w, h)
  const T = { a, e, r, A: a.getContext('2d'), Em: e.getContext('2d'), Rm: r.getContext('2d'), w, h, Wm, Hm }
  T.Em.fillStyle = '#000'
  T.Em.fillRect(0, 0, w, h)
  // metres (u from the left, y from the bottom) -> canvas px rect
  T.px = (u, y, ww, hh) => [u * PPM, h - (y + hh) * PPM, ww * PPM, hh * PPM]
  T.paint = (u, y, ww, hh, col, rough, metal) => {
    const [x, yy, w2, h2] = T.px(u, y, ww, hh)
    if (col) { T.A.fillStyle = col; T.A.fillRect(x, yy, w2, h2) }
    if (rough != null) { T.Rm.fillStyle = `rgb(0,${Math.round(rough * 255)},${Math.round(metal * 255)})`; T.Rm.fillRect(x, yy, w2, h2) }
  }
  return T
}

/** glazing: sky gradient (reflection is brighter toward the top), pillowing, blinds / curtains */
function glass(T, rng, u, y, ww, hh, base, refl = 0.95, curtains = false) {
  const [x, yy, w2, h2] = T.px(u, y, ww, hh)
  const l = rng.range(0.86, 1.12)
  const g = T.A.createLinearGradient(0, yy, 0, yy + h2)
  g.addColorStop(0, rgb(base, l * 1.32))
  g.addColorStop(0.55, rgb(base, l))
  g.addColorStop(1, rgb(base, l * 0.78))
  T.A.fillStyle = g
  T.A.fillRect(x, yy, w2, h2)
  T.Rm.fillStyle = `rgb(0,${Math.round(rng.range(0.03, 0.09) * 255)},${Math.round(refl * 255)})`
  T.Rm.fillRect(x, yy, w2, h2)
  if (curtains) {
    if (rng.chance(0.55)) {
      const c = rng.pick(['216,204,180', '190,170,150', '170,186,196', '226,220,206', '160,120,110'])
      const k = rng.range(0.15, 0.4)
      T.A.fillStyle = `rgba(${c},0.85)`
      T.A.fillRect(x, yy, w2 * k, h2)
      if (rng.chance(0.6)) T.A.fillRect(x + w2 * (1 - k), yy, w2 * k, h2)
    }
  } else if (rng.chance(0.22)) {
    const k = rng.range(0.15, 0.6)
    T.A.fillStyle = `rgba(196,196,188,${rng.range(0.55, 0.85)})`
    T.A.fillRect(x, yy, w2, h2 * k)
    T.Rm.fillStyle = 'rgb(0,150,40)'
    T.Rm.fillRect(x, yy, w2, h2 * k)
  }
}

/** lit interior in the emissive map: ceiling-bright gradient, furniture silhouettes */
function lit(T, rng, u, y, ww, hh, cool, k = 1) {
  const [x, yy, w2, h2] = T.px(u, y, ww, hh)
  const c = rng.pick(cool ? COOL : WARM)
  const g = T.Em.createLinearGradient(0, yy, 0, yy + h2)
  g.addColorStop(0, rgb(c, k))
  g.addColorStop(0.2, rgb(c, k * 0.78))
  g.addColorStop(1, rgb(c, k * 0.42))
  T.Em.fillStyle = g
  T.Em.fillRect(x, yy, w2, h2)
  T.Em.fillStyle = 'rgba(0,0,0,0.5)'
  for (let i = 0; i < 2; i++) if (rng.chance(0.5)) T.Em.fillRect(x + rng.range(0, w2 * 0.7), yy + h2 * 0.7, w2 * rng.range(0.2, 0.5), h2 * 0.3)
  T.A.fillStyle = `rgba(${c[0]},${c[1]},${c[2]},0.05)`
  T.A.fillRect(x, yy, w2, h2)
}

function finish(T, name, envI = 1.35) {
  const tex = (c, srgb) => {
    const t = new THREE.CanvasTexture(c)
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.anisotropy = 8
    if (srgb) t.colorSpace = THREE.SRGBColorSpace
    return t
  }
  const orm = tex(T.r, false)
  const material = new THREE.MeshStandardMaterial({
    map: tex(T.a, true), emissiveMap: tex(T.e, true), emissive: '#ffffff', emissiveIntensity: 0.02,
    roughnessMap: orm, metalnessMap: orm, roughness: 1, metalness: 1, envMapIntensity: envI, name
  })
  return { material, tw: T.Wm, th: T.Hm }
}
export const TINTS = {
  blue: { glass: [56, 82, 108], spandrel: '#2d3640' },
  green: { glass: [58, 88, 86], spandrel: '#2c3634' },
  silver: { glass: [86, 96, 106], spandrel: '#4a5058' }
}
const cache = new Map()

/**
 * Unitised curtain wall: 16 bays (1.5 m) x 16 floors (4 m). Spandrel band at each slab,
 * vision glass above; offices light in tenant runs. -> { material, tw, th }
 */
export function curtainTile(tint = 'blue', seed = 1) {
  const key = `cw:${tint}:${seed}`
  if (cache.has(key)) return cache.get(key)
  const C = TINTS[tint]
  const rng = createRng(seed * 31 + 7)
  const BAY = 1.5
  const FH = 4
  const NB = 16
  const NF = 16
  const T = sheet(NB * BAY, NF * FH)
  T.paint(0, 0, T.Wm, T.Hm, '#9aa3ab', 0.32, 0.9)
  for (let f = 0; f < NF; f++) {
    const y = f * FH
    const occupied = rng.chance(0.78)
    let run = 0
    let on = false
    for (let b = 0; b < NB; b++) {
      const u = b * BAY
      // spandrel (frit glass over insulation) 0..1.05, vision glass 1.1..3.92
      T.paint(u + 0.04, y + 0.04, BAY - 0.08, 1.0, C.spandrel, 0.3, 0.55)
      glass(T, rng, u + 0.05, y + 1.1, BAY - 0.1, FH - 1.18, C.glass, 0.95)
      if (run-- <= 0) { on = occupied && rng.chance(0.62); run = rng.int(2, 7) }
      if (on) lit(T, rng, u + 0.05, y + 1.1, BAY - 0.1, FH - 1.18, rng.chance(0.85), rng.range(0.55, 1))
    }
  }
  const out = finish(T, `park.cw.${tint}`, 1.45)
  out.bay = BAY
  out.fh = FH
  cache.set(key, out)
  return out
}

/** Ribbon windows (R&D): aluminium spandrel band + continuous glazing, 3 m mullion grid */
export function ribbonTile(seed = 2) {
  const key = `rb:${seed}`
  if (cache.has(key)) return cache.get(key)
  const rng = createRng(seed * 17 + 3)
  const BAY = 3
  const FH = 4.2
  const T = sheet(8 * BAY, 8 * FH)
  for (let f = 0; f < 8; f++) {
    const y = f * FH
    T.paint(0, y, T.Wm, 1.5, '#c9ccc8', 0.45, 0.6)
    T.paint(0, y + 1.42, T.Wm, 0.08, '#8f9496', 0.4, 0.7)
    const occupied = rng.chance(0.8)
    for (let b = 0; b < 8; b++) {
      glass(T, rng, b * BAY + 0.06, y + 1.55, BAY - 0.12, FH - 1.75, [62, 76, 86], 0.85)
      if (occupied && rng.chance(0.7)) lit(T, rng, b * BAY + 0.06, y + 1.55, BAY - 0.12, FH - 1.75, true, rng.range(0.6, 1))
      T.paint(b * BAY - 0.04, y + 1.5, 0.08, FH - 1.5, '#5f6568', 0.35, 0.8)
    }
  }
  const out = finish(T, 'park.ribbon', 1.2)
  out.bay = BAY
  out.fh = FH
  cache.set(key, out)
  return out
}

/**
 * Apartments: render wall with punched windows. front: balcony doors on even bays (the
 * balcony slabs / rails are geometry). Lit windows are warm; the scene dims them late at night.
 */
export function punchedTile(front = true, seed = 3, wall = '#cdbfa8') {
  const key = `pw:${front}:${seed}:${wall}`
  if (cache.has(key)) return cache.get(key)
  const rng = createRng(seed * 13 + (front ? 1 : 5))
  const BAY = 3.3
  const FH = 3
  const T = sheet(8 * BAY, 12 * FH)
  T.paint(0, 0, T.Wm, T.Hm, wall, 0.9, 0)
  for (let f = 0; f < 12; f++) {
    const y = f * FH
    T.paint(0, y, T.Wm, 0.12, '#b3a690', 0.85, 0)
    for (let b = 0; b < 8; b++) {
      const door = front && b % 2 === 0
      const ww = door ? 2.2 : 1.6
      const wh = door ? 2.35 : 1.5
      const u = b * BAY + (BAY - ww) / 2
      const y0 = y + (door ? 0.12 : 0.95)
      T.paint(u - 0.1, y0 - 0.1, ww + 0.2, wh + 0.2, '#5a554c', 0.9, 0)
      glass(T, rng, u, y0, ww, wh, [58, 68, 76], 0.6, true)
      T.paint(u + ww / 2 - 0.03, y0, 0.06, wh, '#e4e2dc', 0.5, 0.1)
      if (!door) T.paint(u - 0.14, y0 - 0.12, ww + 0.28, 0.1, '#e0d8c8', 0.8, 0)
      if (rng.chance(0.62)) lit(T, rng, u, y0, ww, wh, rng.chance(0.15), rng.range(0.45, 0.95))
      // rain streak under the sill
      const [sx, sy, sw] = T.px(u + ww * rng.range(0.2, 0.7), y0 - 0.9, 0.12, 0.8)
      const g = T.A.createLinearGradient(0, sy, 0, sy + 0.8 * PPM)
      g.addColorStop(0, 'rgba(40,34,28,0.18)')
      g.addColorStop(1, 'rgba(40,34,28,0)')
      T.A.fillStyle = g
      T.A.fillRect(sx, sy, sw * 1.5, 0.8 * PPM)
    }
  }
  const out = finish(T, `park.punched.${front ? 'f' : 's'}`, 0.9)
  out.bay = BAY
  out.fh = FH
  cache.set(key, out)
  return out
}
