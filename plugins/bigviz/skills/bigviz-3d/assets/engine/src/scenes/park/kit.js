// Park pack - geometry helpers shared by the park prefabs: a quad batcher with metre UVs
// (facade walls that wrap seamlessly round corners), merged box lists (fins, louvres,
// furniture: one draw call each), instanced boxes, shared park materials and canvas signs.

import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { colorMat, glowMat } from '../../render/materials.js'
import { makeCanvas } from '../../render/textures.js'

const _a = new THREE.Vector3()
const _b = new THREE.Vector3()

/** Quad batcher: positions / normals / uvs, winding fixed to match the given normal */
export class Quads {
  constructor() { this.p = []; this.n = []; this.uv = []; this.i = [] }
  quad(v, nrm, uv) {
    _a.set(v[1][0] - v[0][0], v[1][1] - v[0][1], v[1][2] - v[0][2])
    _b.set(v[2][0] - v[0][0], v[2][1] - v[0][1], v[2][2] - v[0][2])
    const flip = _a.cross(_b).dot(_b.set(...nrm)) < 0
    const o = this.p.length / 3
    for (let k = 0; k < 4; k++) { this.p.push(...v[k]); this.n.push(...nrm); this.uv.push(...uv[k]) }
    if (flip) this.i.push(o, o + 2, o + 1, o, o + 3, o + 2)
    else this.i.push(o, o + 1, o + 2, o, o + 2, o + 3)
  }
  /** vertical wall A->B (xz), y0..y1; u = (u0 + metres along) / tw, v = (y - vy0) / th */
  wall(ax, az, bx, bz, y0, y1, nrm, tw = 1, th = 1, u0 = 0, vy0 = 0) {
    const L = Math.hypot(bx - ax, bz - az)
    const ua = u0 / tw
    const ub = (u0 + L) / tw
    const va = (y0 - vy0) / th
    const vb = (y1 - vy0) / th
    this.quad([[ax, y0, az], [bx, y0, bz], [bx, y1, bz], [ax, y1, az]], nrm, [[ua, va], [ub, va], [ub, vb], [ua, vb]])
    return u0 + L
  }
  /** the four outward walls of a w x d box centred on (cx, cz); u wraps continuously */
  ring(cx, cz, w, d, y0, y1, tw, th, u0 = 0, vy0 = 0) {
    const x0 = cx - w / 2, x1 = cx + w / 2, z0 = cz - d / 2, z1 = cz + d / 2
    let u = u0
    u = this.wall(x0, z1, x1, z1, y0, y1, [0, 0, 1], tw, th, u, vy0)
    u = this.wall(x1, z1, x1, z0, y0, y1, [1, 0, 0], tw, th, u, vy0)
    u = this.wall(x1, z0, x0, z0, y0, y1, [0, 0, -1], tw, th, u, vy0)
    this.wall(x0, z0, x0, z1, y0, y1, [-1, 0, 0], tw, th, u, vy0)
  }
  /** horizontal rect at y facing up (dir 1) or down (dir -1), planar uv / tile */
  rect(x0, z0, x1, z1, y, dir = 1, tile = 4) {
    const v = [[x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1]]
    this.quad(v, [0, dir, 0], v.map((q) => [q[0] / tile, q[2] / tile]))
  }
  geometry() {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3))
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3))
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2))
    g.setIndex(this.i)
    g.computeBoundingSphere()
    return g
  }
  mesh(material, cast = true) {
    const m = new THREE.Mesh(this.geometry(), material)
    m.castShadow = cast
    m.receiveShadow = true
    return m
  }
}

/** merged boxes [[cx, cy, cz, w, h, d, ry?], ...] -> one mesh (bottom-origin when base) */
export function boxes(list, material, { cast = true, base = false } = {}) {
  if (!list.length) return null
  const geos = list.map(([x, y, z, w, h, d, ry = 0]) => {
    const g = new THREE.BoxGeometry(w, h, d)
    if (ry) g.rotateY(ry)
    g.translate(x, base ? y + h / 2 : y, z)
    return g
  })
  const m = new THREE.Mesh(mergeGeometries(geos, false), material)
  geos.forEach((g) => g.dispose())
  m.castShadow = cast
  m.receiveShadow = true
  return m
}

/** merged cylinders [[cx, y0, cz, r, h, seg?]] standing on y0 */
export function cyls(list, material, { cast = true } = {}) {
  if (!list.length) return null
  const geos = list.map(([x, y, z, r, h, seg = 12, r2]) => new THREE.CylinderGeometry(r, r2 ?? r, h, seg).translate(x, y + h / 2, z))
  const m = new THREE.Mesh(mergeGeometries(geos, false), material)
  geos.forEach((g) => g.dispose())
  m.castShadow = cast
  m.receiveShadow = true
  return m
}

const mats = new Map()
const once = (k, f) => { if (!mats.has(k)) mats.set(k, f()); return mats.get(k) }
/** shared park materials */
export const M = {
  alu: () => colorMat('#b7bec4', 0.32, 0.85),
  aluDark: () => colorMat('#3c4247', 0.4, 0.8),
  stone: () => colorMat('#c9c2b4', 0.55, 0),
  stoneDark: () => colorMat('#4a4846', 0.3, 0.05),
  granite: () => colorMat('#8e8a84', 0.6, 0),
  concrete: () => colorMat('#a9a59d', 0.88, 0),
  render: () => colorMat('#d8d2c6', 0.9, 0),
  timber: () => colorMat('#a8774a', 0.65, 0),
  terracotta: () => colorMat('#b46a46', 0.75, 0),
  steel: () => colorMat('#9aa1a6', 0.35, 0.8),
  black: () => colorMat('#22252a', 0.45, 0.6),
  white: () => colorMat('#e6e7e3', 0.5, 0.05),
  pv: () => colorMat('#1d2a3d', 0.15, 0.7),
  ceiling: () => colorMat('#d9d8d3', 0.8, 0),
  lamp: (c = '#fff1d8', k = 1.6) => glowMat(c, k),
  clearGlass: () => once('clear', () => new THREE.MeshStandardMaterial({ color: '#b8ccd4', roughness: 0.04, metalness: 0.25, transparent: true, opacity: 0.22, envMapIntensity: 1.4, depthWrite: false, name: 'park.glass.clear' })),
  balGlass: () => once('bal', () => new THREE.MeshStandardMaterial({ color: '#9fb6bf', roughness: 0.12, metalness: 0.2, transparent: true, opacity: 0.42, depthWrite: false, side: THREE.DoubleSide, name: 'park.glass.bal' }))
}

/** canvas text sign (albedo + matching emissive for night) */
export function signMaterial(text, { w = 1024, h = 192, bg = null, fg = '#f4f1ea', font = 'bold 120px "Microsoft YaHei", sans-serif', glow = '#dff1ff', k = 1.4, sub } = {}) {
  return once(`sign:${text}:${bg}:${fg}:${sub}`, () => {
    const draw = (col, back) => {
      const c = makeCanvas(w, h)
      const x = c.getContext('2d')
      x.fillStyle = back || 'rgba(0,0,0,0)'
      x.fillRect(0, 0, w, h)
      x.fillStyle = col
      x.font = font
      x.textAlign = 'center'
      x.textBaseline = 'middle'
      x.fillText(text, w / 2, sub ? h * 0.4 : h / 2, w * 0.94)
      if (sub) { x.font = `600 ${Math.round(h * 0.2)}px sans-serif`; x.fillText(sub, w / 2, h * 0.8, w * 0.9) }
      const t = new THREE.CanvasTexture(c)
      t.colorSpace = THREE.SRGBColorSpace
      t.anisotropy = 8
      return t
    }
    const m = new THREE.MeshStandardMaterial({ map: draw(fg, bg), emissiveMap: draw(glow, bg ? '#000' : null), emissive: '#ffffff', emissiveIntensity: k * 0.25, transparent: !bg, alphaTest: bg ? 0 : 0.3, roughness: 0.5, metalness: 0.3, name: `sign.${text}` })
    m.userData.signK = k
    return m
  })
}

/** plane facing +z (local) of size w x h centred at (x, y, z) */
export function plane(w, h, material, { x = 0, y = 0, z = 0, ry = 0, rx = 0 } = {}) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), material)
  m.position.set(x, y, z)
  m.rotation.set(rx, ry, 0)
  m.castShadow = false
  m.receiveShadow = true
  return m
}
