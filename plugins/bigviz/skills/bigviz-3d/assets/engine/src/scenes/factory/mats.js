// Factory pack - procedural surfaces (canvas, no image files): ribbed steel cladding,
// epoxy floor, safety mesh, andon / video-wall screens. Shared and cached per style.

import * as THREE from 'three'
import { makeCanvas, fbm, normalFromHeight, toTexture } from '../../render/textures.js'
import { tone, registerNightLit } from '../../render/materials.js'

const cache = new Map()
const once = (k, f) => (cache.has(k) ? cache.get(k) : cache.set(k, f()).get(k))
const hex = (c) => '#' + tone(c).getHexString()

/** Profiled steel sheet. 4 m tile, ribs across u; `tile` = metres per texture repeat */
function ribbed({ color, ribs = 16, seed = 3, streaks = 0.5 }) {
  const S = 512
  const h = new Float32Array(S * S)
  const n = fbm(S, { scale: 6, octaves: 4, seed })
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    // trapezoid rib: flat pan, sloped flanks, flat crown
    const f = ((x / S) * ribs) % 1
    const r = f < 0.62 ? 0 : f < 0.7 ? (f - 0.62) / 0.08 : f < 0.92 ? 1 : 1 - (f - 0.92) / 0.08
    h[y * S + x] = r
  }
  const nrm = normalFromHeight(h, S, 5)
  const c = makeCanvas(S)
  const g = c.getContext('2d')
  const img = g.createImageData(S, S)
  const base = new THREE.Color(hex(color))
  for (let i = 0; i < S * S; i++) {
    const y = (i / S) | 0
    // rain streaks from the top + general fbm grime, crown edges a touch lighter
    const streak = streaks * Math.max(0, n[(i * 7) % (S * S)] - 0.55) * (1 - y / S) * 1.4
    const k = 0.9 + (n[i] - 0.5) * 0.18 + h[i] * 0.05 - streak * 0.35
    img.data[i * 4] = Math.min(255, base.r * 255 * k)
    img.data[i * 4 + 1] = Math.min(255, base.g * 255 * k)
    img.data[i * 4 + 2] = Math.min(255, base.b * 255 * k)
    img.data[i * 4 + 3] = 255
  }
  g.putImageData(img, 0, 0)
  const map = toTexture(c, { srgb: true })
  const normalMap = toTexture(nrm)
  const m = new THREE.MeshStandardMaterial({ map, normalMap, roughness: 0.48, metalness: 0.55, side: THREE.DoubleSide })
  m.normalScale.set(1.2, 1.2)
  return m
}

export const cladMat = (color = '#c9cdd0', key = 'wall') => once(`clad:${key}:${color}`, () => ribbed({ color, seed: key.length + 3 }))
export const roofMat = () => once('roof', () => ribbed({ color: '#b9bec2', ribs: 12, seed: 9, streaks: 0.2 }))

/** Light grey-green epoxy floor: fbm tint + tyre scuffs + low roughness with worn patches */
export const epoxyMat = () => once('epoxy', () => {
  const S = 1024
  const n = fbm(S, { scale: 5, octaves: 5, seed: 17 })
  const n2 = fbm(S, { scale: 22, octaves: 3, seed: 23 })
  const c = makeCanvas(S)
  const g = c.getContext('2d')
  const img = g.createImageData(S, S)
  const base = new THREE.Color(hex('#a9b4ad'))
  const rough = makeCanvas(S)
  const rg = rough.getContext('2d')
  const rimg = rg.createImageData(S, S)
  for (let i = 0; i < S * S; i++) {
    const k = 0.93 + (n[i] - 0.5) * 0.16 + (n2[i] - 0.5) * 0.05
    img.data[i * 4] = base.r * 255 * k
    img.data[i * 4 + 1] = base.g * 255 * k
    img.data[i * 4 + 2] = base.b * 255 * k
    img.data[i * 4 + 3] = 255
    // glossy coat (g channel = roughness), worn where the noise is high
    const r = 0.22 + Math.max(0, n[i] - 0.52) * 1.1 + n2[i] * 0.08
    rimg.data[i * 4 + 1] = Math.min(255, r * 255)
    rimg.data[i * 4 + 3] = 255
  }
  g.putImageData(img, 0, 0)
  rg.putImageData(rimg, 0, 0)
  // tyre scuffs: faint dark arcs
  g.strokeStyle = 'rgba(40,40,40,0.06)'
  g.lineWidth = 6
  for (let i = 0; i < 26; i++) {
    g.beginPath()
    const x = (i * 397) % S
    const y = (i * 211) % S
    g.arc(x, y, 160 + ((i * 53) % 260), i, i + 0.9 + (i % 3) * 0.4)
    g.stroke()
  }
  const map = toTexture(c, { srgb: true })
  const roughnessMap = toTexture(rough)
  return new THREE.MeshStandardMaterial({ map, roughnessMap, roughness: 1, metalness: 0.04, envMapIntensity: 1.25 })
})

/** Machine-guard mesh panel (alpha-tested wire grid, 50 mm pitch) */
export const meshMat = (color = '#d6b02a') => once(`mesh:${color}`, () => {
  const S = 128
  const c = makeCanvas(S)
  const g = c.getContext('2d')
  g.clearRect(0, 0, S, S)
  g.fillStyle = hex(color)
  for (let i = 0; i < 4; i++) { g.fillRect(i * 32, 0, 3, S); g.fillRect(0, i * 32, S, 3) }
  const t = toTexture(c, { srgb: true })
  t.anisotropy = 8
  const m = new THREE.MeshStandardMaterial({ map: t, alphaTest: 0.35, side: THREE.DoubleSide, roughness: 0.5, metalness: 0.3 })
  m.alphaToCoverage = true
  return m
})

/** Plane with UVs in metres / tile (cladding, mesh panels) */
export function sheet(w, h, material, tile = 4, p = {}) {
  const g = new THREE.PlaneGeometry(w, h)
  const uv = g.attributes.uv
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * w) / tile, (uv.getY(i) * h) / tile)
  const m = new THREE.Mesh(g, material)
  m.position.set(p.x || 0, p.y || 0, p.z || 0)
  if (p.ry) m.rotation.y = p.ry
  if (p.rx) m.rotation.x = p.rx
  if (p.rz) m.rotation.z = p.rz
  m.castShadow = p.cast ?? true
  m.receiveShadow = true
  return m
}

/** Live canvas screen (andon board, control room wall). draw(ctx, w, h) repaints it */
export function screen(w, h, px = 512) {
  const c = makeCanvas(px, Math.round((px * h) / w))
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 4
  const m = new THREE.MeshStandardMaterial({ color: '#000000', emissive: '#ffffff', emissiveMap: t, emissiveIntensity: 1.35, roughness: 0.3 })
  m.userData.live = true
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m)
  mesh.castShadow = false
  return { mesh, canvas: c, ctx: c.getContext('2d'), tex: t, mat: m, draw(fn) { fn(this.ctx, c.width, c.height); t.needsUpdate = true } }
}

/** High-bay LED panel material (always on inside the hall, brighter at night) */
export const bayLampMat = () => once('baylamp', () => {
  const m = new THREE.MeshStandardMaterial({ color: '#222222', emissive: '#f4f7ff', emissiveIntensity: 2.2, roughness: 0.4 })
  m.userData.live = true
  return m
})

/** Window band glass that lights up at night (offices) */
export const officeGlass = () => once('officeGlass', () => registerNightLit(new THREE.MeshStandardMaterial({ color: '#33414c', emissive: '#ffe7c0', roughness: 0.06, metalness: 0.8, envMapIntensity: 1.5 }), 1.4, 'windows'))
