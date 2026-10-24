// Factory pack - the production hall: portal-frame steel structure (H columns, haunched
// rafters, crane runway on brackets, purlins, girts, X-bracing), profiled cladding with a
// window band and blue fascia, roof sheets with skylight strips, doors (coil door, dock
// doors with shelters, personnel doors), epoxy floor + lane markings, high-bay lamps,
// two-storey office with the control room. Walls (rig.walls.n/s/e/w) and the roof
// (rig.roof) are separate nodes so the scene can cut them away; the frame always stays.

import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { mat, colorMat, glowMat } from '../../render/materials.js'
import { box, cyl, rod, group, dynamic, bakeTree } from '../../prefabs/kit.js'
import { decal } from '../../prefabs/parts-real.js'
import { labelTexture } from '../../render/sheets.js'
import { cladMat, roofMat, epoxyMat, sheet, bayLampMat, officeGlass, screen } from './mats.js'
import { HALL, RUNWAY } from './layout.js'

const STEEL = () => colorMat('#a7aeb3', 0.5, 0.45)
const V = (x, y, z) => new THREE.Vector3(x, y, z)

/** roof surface height at z (three pitched spans) */
export function roofY(z) {
  const { spans, eave, ridge } = HALL
  for (let i = 0; i < spans.length - 1; i++) {
    const a = spans[i]
    const b = spans[i + 1]
    if (z >= a - 1e-6 && z <= b + 1e-6) return eave + (ridge - eave) * (1 - Math.abs(z - (a + b) / 2) / ((b - a) / 2))
  }
  return eave
}

/** interval [a,b] minus holes [[h0,h1],...] -> [[s,e],...] */
function cut(a, b, holes) {
  const out = []
  let s = a
  for (const [h0, h1] of [...holes].sort((p, q) => p[0] - q[0])) {
    if (h1 <= s || h0 >= b) continue
    if (h0 > s) out.push([s, h0])
    s = Math.max(s, h1)
  }
  if (s < b) out.push([s, b])
  return out
}

/** quad batch -> one BufferGeometry (roof sheets / skylights / gables) */
class Quads {
  constructor() { this.p = []; this.uv = []; this.i = [] }
  /** corners a,b,c,d (Vector3, in order), uv tile metres along (a->b) and (a->d) */
  add(a, b, c, d, tile = 4) {
    const o = this.p.length / 3
    const lu = a.distanceTo(b) / tile
    const lv = a.distanceTo(d) / tile
    this.p.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z, d.x, d.y, d.z)
    this.uv.push(0, 0, lu, 0, lu, lv, 0, lv)
    this.i.push(o, o + 1, o + 2, o, o + 2, o + 3)
  }
  tri(a, b, c, tile = 4) {
    const o = this.p.length / 3
    this.p.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z)
    this.uv.push(0, 0, a.distanceTo(b) / tile, 0, a.distanceTo(b) / tile / 2, a.distanceTo(c) / tile)
    this.i.push(o, o + 1, o + 2)
  }
  mesh(material, cast = true) {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3))
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2))
    g.setIndex(this.i)
    g.computeVertexNormals()
    const m = new THREE.Mesh(g, material)
    m.castShadow = cast
    m.receiveShadow = true
    return m
  }
}

/** vertical H column at (x, z), depth d along `axis` ('z' | 'x') */
function column(g, x, z, h, d = 0.6, b = 0.3, axis = 'z', m = STEEL()) {
  const tf = 0.025
  if (axis === 'z') {
    for (const s of [1, -1]) g.add(box(b, h, tf, m, { base: true, x, z: z + s * (d / 2 - tf / 2) }))
    g.add(box(0.014, h, d - 2 * tf, m, { base: true, x, z }))
  } else {
    for (const s of [1, -1]) g.add(box(tf, h, b, m, { base: true, x: x + s * (d / 2 - tf / 2), z }))
    g.add(box(d - 2 * tf, h, 0.014, m, { base: true, x, z }))
  }
  g.add(box(b + 0.2, 0.04, d + 0.2, mat('steel.dark'), { base: true, x, z }))
}

/** inclined H member in the y-z plane at x, from (z0, y0) to (z1, y1); top flange on the line */
function rafter(g, x, z0, y0, z1, y1, d = 0.7, b = 0.25, m = STEEL()) {
  const L = Math.hypot(z1 - z0, y1 - y0)
  const th = Math.atan2(y1 - y0, z1 - z0)
  const r = new THREE.Group()
  r.position.set(x, (y0 + y1) / 2, (z0 + z1) / 2)
  r.rotation.x = -th
  r.add(box(0.012, d, L, m, { y: -d / 2 }))
  r.add(box(b, 0.022, L, m, { y: -0.011 }))
  r.add(box(b, 0.022, L, m, { y: -d + 0.011 }))
  g.add(r)
}
/** structure that always stays: columns, rafters, runway, purlins, girts, bracing */
function frame(g) {
  const { x0, x1, z0, z1, eave, spans, bay } = HALL
  const m = STEEL()
  for (let x = x0; x <= x1 + 0.01; x += bay) {
    const edge = x === x0 || x === x1
    for (const z of spans) {
      const outer = z === z0 || z === z1
      column(g, x, z + (z === z0 ? 0.3 : z === z1 ? -0.3 : 0), eave - 0.75, outer ? 0.6 : 0.7, outer ? 0.3 : 0.35, 'z', m)
    }
    if (edge) continue
    for (let i = 0; i < spans.length - 1; i++) {
      const a = spans[i]
      const b = spans[i + 1]
      const c = (a + b) / 2
      rafter(g, x, a, eave - 0.06, c, HALL.ridge - 0.06, 0.8, 0.25, m)
      rafter(g, x, c, HALL.ridge - 0.06, b, eave - 0.06, 0.8, 0.25, m)
      // haunch plates at the knees
      for (const z of [a + 0.9, b - 0.9]) g.add(box(0.02, 0.6, 1.4, m, { x, y: eave - 1.1, z }))
    }
  }
  // gable wind columns + end rafters (on the wall line)
  for (const x of [x0, x1]) {
    for (let z = z0 + 6; z < z1; z += 6) if (!spans.includes(z)) column(g, x + (x < 0 ? 0.3 : -0.3), z, roofY(z) - 0.8, 0.4, 0.2, 'x', m)
    for (let i = 0; i < spans.length - 1; i++) {
      const c = (spans[i] + spans[i + 1]) / 2
      rafter(g, x + (x < 0 ? 0.3 : -0.3), spans[i], eave - 0.06, c, HALL.ridge - 0.06, 0.5, 0.2, m)
      rafter(g, x + (x < 0 ? 0.3 : -0.3), c, HALL.ridge - 0.06, spans[i + 1], eave - 0.06, 0.5, 0.2, m)
    }
  }
  // purlins (Z sections ~1.5 m) along x on every slope
  const L = x1 - x0
  for (let i = 0; i < spans.length - 1; i++) {
    const a = spans[i]
    const b = spans[i + 1]
    const c = (a + b) / 2
    const th = Math.atan2(HALL.ridge - eave, c - a)
    for (let k = 0; k <= 8; k++) {
      for (const [zEave, dir] of [[a, 1], [b, -1]]) {
        const z = zEave + dir * (0.3 + k * ((c - a - 0.5) / 8))
        g.add(box(L, 0.22, 0.06, colorMat('#b6bcc0', 0.45, 0.5), { x: 0, y: roofY(z) - 0.17, z, rx: -dir * th, cast: k % 2 === 0 }))
      }
    }
  }
  // girts on the long walls (outside face of the columns), skipping the window band
  for (const z of [z0 + 0.0, z1 - 0.0]) for (const y of [2.2, 4.2, 5.85, 7.4, 9.6, 11.8, 13.4]) g.add(box(L, 0.2, 0.06, colorMat('#b6bcc0', 0.45, 0.5), { y, z: z + (z < 0 ? 0.04 : -0.04), cast: false }))
  for (const x of [x0, x1]) for (const y of [2.2, 4.2, 6.6, 9.6, 12.6]) g.add(box(0.06, 0.2, z1 - z0, colorMat('#b6bcc0', 0.45, 0.5), { x: x + (x < 0 ? 0.04 : -0.04), y, cast: false }))
  // crane runway (north span): box girders on column brackets, rails on top
  const rz = [RUNWAY.z - RUNWAY.span / 2, RUNWAY.z + RUNWAY.span / 2]
  for (const z of rz) {
    g.add(box(L, 0.9, 0.4, colorMat('#c9a227', 0.45, 0.25), { y: RUNWAY.railY - 0.53, z }))
    g.add(box(L, 0.08, 0.08, mat('steel'), { y: RUNWAY.railY - 0.04, z }))
    for (let x = x0; x <= x1 + 0.01; x += bay) g.add(box(0.35, 0.6, 0.9, m, { x, y: RUNWAY.railY - 1.28, z: z + (z < RUNWAY.z ? -0.25 : 0.25) }))
    for (const x of [x0 + 0.6, x1 - 0.6]) g.add(box(0.4, 0.5, 0.5, mat('paint.red'), { base: true, x, y: RUNWAY.railY, z }))
  }
  // X bracing: roof (end bays) + long walls (2nd and second-last bays)
  const bm = colorMat('#8d9499', 0.5, 0.6)
  for (const xa of [x0, x1 - bay]) {
    for (let i = 0; i < spans.length - 1; i++) {
      const a = spans[i]
      const c = (spans[i] + spans[i + 1]) / 2
      for (const [p, q] of [[a, c], [c, spans[i + 1]]]) {
        g.add(rod(V(xa, roofY(p) - 0.3, p), V(xa + bay, roofY(q) - 0.3, q), 0.02, bm))
        g.add(rod(V(xa + bay, roofY(p) - 0.3, p), V(xa, roofY(q) - 0.3, q), 0.02, bm))
      }
    }
  }
  for (const z of [z0 + 0.2, z1 - 0.2]) for (const xa of [x0 + bay, x1 - 2 * bay]) {
    g.add(rod(V(xa, 0.4, z), V(xa + bay, eave - 1, z), 0.025, bm))
    g.add(rod(V(xa + bay, 0.4, z), V(xa, eave - 1, z), 0.025, bm))
  }
}
/**
 * One wall in local space: u along the wall (-L/2..L/2), outward = +z, built at z = 0.
 * openings: [{ u, w, h, kind: 'shutter'|'dock'|'door'|'open', open? }]
 */
function wall(L, openings, { gable = null, windows = true, glowList } = {}) {
  const g = new THREE.Group()
  const clad = cladMat('#c6cacd', 'wall')
  const band = cladMat('#2f5d8c', 'band')
  const plinth = colorMat('#8f8c86', 0.85, 0)
  const holes = (y0, y1) => openings.filter((o) => o.h > y0).map((o) => [o.u - o.w / 2, o.u + o.w / 2])
  const strip = (y0, y1, material, dz = 0, tile = 4) => {
    for (const [a, b] of cut(-L / 2, L / 2, holes(y0, y1))) if (b - a > 0.05) g.add(sheet(b - a, y1 - y0, material, tile, { x: (a + b) / 2, y: (y0 + y1) / 2, z: dz }))
    // close the band above openings that end inside it
    for (const o of openings) if (o.h > y0 && o.h < y1) g.add(sheet(o.w, y1 - o.h, material, tile, { x: o.u, y: (o.h + y1) / 2, z: dz }))
  }
  // concrete plinth, cladding below / above the window band, blue fascia
  for (const [a, b] of cut(-L / 2, L / 2, holes(0, 1.2))) if (b - a > 0.05) g.add(box(b - a, 1.2, 0.24, plinth, { base: true, x: (a + b) / 2, z: 0.02 }))
  const wy0 = 6.0
  const wy1 = 7.2
  if (windows) {
    strip(1.2, wy0, clad)
    strip(wy1, 12.6, clad)
    // window band: dark glass + mullions, inner glow layer (daylight / lamps from inside)
    const glass = colorMat('#26323b', 0.06, 0.85)
    for (const [a, b] of cut(-L / 2, L / 2, holes(wy0, wy1))) {
      if (b - a < 0.3) continue
      g.add(box(b - a, wy1 - wy0, 0.04, glass, { x: (a + b) / 2, y: (wy0 + wy1) / 2, z: -0.02, cast: false }))
      for (let u = a; u <= b + 0.01; u += 1.5) g.add(box(0.07, wy1 - wy0, 0.1, colorMat('#d9dcdd', 0.4, 0.6), { x: Math.min(u, b), y: (wy0 + wy1) / 2, z: 0.03 }))
      g.add(box(b - a, 0.08, 0.16, colorMat('#d9dcdd', 0.4, 0.6), { x: (a + b) / 2, y: wy0, z: 0.05 }))
      g.add(box(b - a, 0.08, 0.16, colorMat('#d9dcdd', 0.4, 0.6), { x: (a + b) / 2, y: wy1, z: 0.05 }))
      if (glowList) {
        const inner = box(b - a, wy1 - wy0 - 0.1, 0.02, glowList.mat, { x: (a + b) / 2, y: (wy0 + wy1) / 2, z: -0.08, cast: false })
        g.add(inner)
      }
    }
  } else strip(1.2, 12.6, clad)
  strip(12.6, 14.0, band, 0.02)
  g.add(box(L + 0.3, 0.18, 0.3, colorMat('#d9dcdd', 0.4, 0.6), { y: 14.05, z: 0.08 }))
  if (gable) {
    // triangles above the eave (one per span): [[u0, u1], ...]
    const q = new Quads()
    for (const [a, b] of gable) q.tri(V(a, 14, 0), V(b, 14, 0), V((a + b) / 2, HALL.ridge, 0), 4)
    g.add(q.mesh(clad))
  }
  // openings: frames, shutters, dock shelters, personnel doors
  const jamb = colorMat('#e3c32a', 0.5, 0.2)
  for (const o of openings) {
    const { u, w, h } = o
    for (const s of [1, -1]) g.add(box(0.2, h + 0.2, 0.3, o.kind === 'door' ? colorMat('#d9dcdd', 0.4, 0.6) : jamb, { base: true, x: u + s * (w / 2 + 0.1), z: 0.05 }))
    g.add(box(w + 0.4, 0.25, 0.3, o.kind === 'door' ? colorMat('#d9dcdd', 0.4, 0.6) : jamb, { x: u, y: h + 0.12, z: 0.05 }))
    if (o.kind === 'shutter' || o.kind === 'dock') {
      const open = o.open ?? 0
      const sh = h * (1 - open)
      g.add(box(w + 0.3, 0.7, 0.7, colorMat('#9aa1a6', 0.5, 0.5), { x: u, y: h + 0.6, z: -0.3 }))
      if (sh > 0.05) g.add(sheet(w, sh, cladMat('#b9c0c5', 'shutter'), 2, { x: u, y: h - sh / 2, z: -0.1 }))
      g.add(decal('hazard', w, 0.18, { x: u, y: 0.3, z: 0.21 }))
    }
    if (o.kind === 'dock') {
      // shelter curtains + bumpers + leveller lip
      const curtain = colorMat('#26282b', 0.9, 0)
      for (const s of [1, -1]) g.add(box(0.7, h + 0.5, 0.9, curtain, { base: true, x: u + s * (w / 2 + 0.55), y: 0.6, z: 0.6 }))
      g.add(box(w + 1.8, 0.8, 0.9, curtain, { x: u, y: h + 0.9, z: 0.6 }))
      for (const s of [1, -1]) g.add(box(0.25, 0.35, 0.3, mat('rubber'), { x: u + s * (w / 2 - 0.4), y: 1.15, z: 0.35 }))
      g.add(box(w, 0.1, 0.5, mat('steel.dark'), { x: u, y: 1.2, z: 0.3 }))
      g.add(box(w + 2, 1.2, 1.2, colorMat('#8f8c86', 0.85, 0), { base: true, x: u, z: 0.75 }))
    }
    if (o.kind === 'door') {
      g.add(box(w, h, 0.06, colorMat('#5c6670', 0.5, 0.4), { base: true, x: u, z: -0.02 }))
      g.add(box(w * 0.6, 0.3, 0.02, colorMat('#2e7d4f', 0.5), { x: u, y: h + 0.5, z: 0.12 }))
    }
  }
  return g
}

const SIDE = {
  n: { pos: (H) => [0, H.z0], ry: Math.PI, L: (H) => H.x1 - H.x0 },
  s: { pos: (H) => [0, H.z1], ry: 0, L: (H) => H.x1 - H.x0 },
  e: { pos: (H) => [H.x1, 0], ry: Math.PI / 2, L: (H) => H.z1 - H.z0 },
  w: { pos: (H) => [H.x0, 0], ry: -Math.PI / 2, L: (H) => H.z1 - H.z0 }
}
/** roof: sheets + skylight strips (alternate bays, near the ridge), caps, gutters */
function roof() {
  const { x0, x1, spans, bay } = HALL
  const sheets = new Quads()
  const lights = new Quads()
  const caps = new THREE.Group()
  const y = (z) => roofY(z) + 0.03
  const quad = (q, xa, xb, za, zb) => q.add(V(xa, y(za), za), V(xb, y(za), za), V(xb, y(zb), zb), V(xa, y(zb), zb), 4)
  for (let i = 0; i < spans.length - 1; i++) {
    const a = spans[i]
    const b = spans[i + 1]
    const c = (a + b) / 2
    for (let x = x0; x < x1 - 0.01; x += bay) {
      const sky = Math.round((x - x0) / bay) % 2 === 1
      for (const [ze, dir] of [[a, 1], [b, -1]]) {
        // eave -> ridge along z; skylight band 2.5 .. 7.5 m up the slope
        const pts = sky ? [ze, ze + dir * 3, ze + dir * 8, c] : [ze, c]
        for (let k = 0; k < pts.length - 1; k++) {
          const za = Math.min(pts[k], pts[k + 1])
          const zb = Math.max(pts[k], pts[k + 1])
          quad(sky && k === 1 ? lights : sheets, x, x + bay, za, zb)
        }
      }
    }
    caps.add(box(x1 - x0 + 0.4, 0.12, 0.7, colorMat('#c6cacd', 0.4, 0.6), { y: HALL.ridge + 0.08, z: c }))
  }
  for (const z of spans) caps.add(box(x1 - x0 + 0.4, 0.35, z === spans[0] || z === spans[3] ? 0.4 : 0.9, colorMat('#d9dcdd', 0.4, 0.6), { y: HALL.eave + 0.05, z: z + (z === spans[0] ? -0.25 : z === spans[3] ? 0.25 : 0) }))
  const g = new THREE.Group()
  g.add(sheets.mesh(roofMat()))
  const skyMat = new THREE.MeshStandardMaterial({ color: '#e8eef2', emissive: '#dfe8f0', emissiveIntensity: 0.25, roughness: 0.35, metalness: 0, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false })
  skyMat.userData.live = true
  const sk = lights.mesh(skyMat, false)
  sk.renderOrder = 2
  g.add(sk, caps)
  return { g, skyMat }
}

/** floor: epoxy slab + painted markings. marks: { lines: [[[x,z],...], off, w, col]], boxes: [[x,z,w,d,col]] } */
function floor(marks) {
  const { x0, x1, z0, z1 } = HALL
  const W = x1 - x0
  const D = z1 - z0
  const pg = new THREE.PlaneGeometry(W, D)
  pg.rotateX(-Math.PI / 2)
  const uv = pg.attributes.uv
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * W) / 12, (uv.getY(i) * D) / 12)
  const f = new THREE.Mesh(pg, epoxyMat())
  f.position.y = 0.06
  f.receiveShadow = true
  f.userData.keep = true
  const g = new THREE.Group()
  g.add(f)
  const COL = { y: colorMat('#d9b228', 0.55), g: colorMat('#3f8a5a', 0.6), w: colorMat('#e6e6e0', 0.55), r: colorMat('#b8352a', 0.55) }
  const y = 0.075
  for (const [pts, off, w, col] of marks.lines || []) {
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, az] = pts[i]
      const [bx, bz] = pts[i + 1]
      const L = Math.hypot(bx - ax, bz - az)
      const nx = -(bz - az) / L
      const nz = (bx - ax) / L
      const m = box(L + w, 0.012, w, COL[col], { x: (ax + bx) / 2 + nx * off, y, z: (az + bz) / 2 + nz * off, ry: -Math.atan2(bz - az, bx - ax), cast: false })
      g.add(m)
    }
  }
  for (const [x, z, w, d, col, t = 0.1] of marks.boxes || []) {
    for (const s of [1, -1]) {
      g.add(box(w + t, 0.012, t, COL[col], { x, y, z: z + (s * d) / 2, cast: false }))
      g.add(box(t, 0.012, d, COL[col], { x: x + (s * w) / 2, y, z, cast: false }))
    }
  }
  for (const [x, z, w, d] of marks.hatch || []) {
    for (let u = -w / 2 + 0.4; u < w / 2; u += 0.9) g.add(box(0.14, 0.012, d * 1.1, COL.y, { x: x + u, y, z, ry: 0.6, cast: false }))
  }
  return g
}

/** hanging high-bay LED lamps: housings (static) + one merged emissive disc mesh */
function lamps(g) {
  const pts = []
  const { x0, x1, spans, bay } = HALL
  const discs = []
  for (let i = 0; i < spans.length - 1; i++) {
    const c = (spans[i] + spans[i + 1]) / 2
    const crane = i === 0
    for (const dz of [-6, 6]) for (let x = x0 + bay / 2; x < x1; x += bay) {
      const z = c + dz
      const yTop = roofY(z) - 0.9
      const y = crane ? yTop - 0.3 : 12.2
      g.add(cyl(0.012, 0.012, yTop - y, mat('steel.dark'), { base: true, x, y, z, seg: 4, cast: false }))
      g.add(cyl(0.22, 0.32, 0.26, colorMat('#5b6066', 0.45, 0.6), { base: true, x, y: y - 0.26, z, seg: 12 }))
      const d = new THREE.CircleGeometry(0.3, 14).rotateX(Math.PI / 2).translate(x, y - 0.27, z)
      discs.push(d)
      pts.push(V(x, y - 0.4, z))
    }
  }
  const m = new THREE.Mesh(mergeGeometries(discs), bayLampMat())
  m.castShadow = false
  m.userData.keep = true
  g.add(m)
  return pts
}
/**
 * The hall. marks = floor markings (see floor()).
 * rig: { walls: { n, s, e, w }, roof, skyMat, glowMat, lampPts }
 */
export function hall({ marks = {} } = {}) {
  const H = HALL
  const root = new THREE.Group()
  const g = new THREE.Group()
  root.add(g)
  frame(g)
  const lampPts = lamps(g)
  root.add(floor(marks))
  // window inner glow: daylight by day, lamp light at night (driven by the scene hooks)
  const winGlow = new THREE.MeshStandardMaterial({ color: '#1a1f24', emissive: '#e9eef2', emissiveIntensity: 0.6, roughness: 0.4 })
  winGlow.userData.live = true
  const span = (u) => H.spans.slice(0, -1).map((a, i) => [u(a), u(H.spans[i + 1])].sort((p, q) => p - q))
  const OPEN = {
    n: [{ u: 0, w: 1.0, h: 2.2, kind: 'door' }, { u: -60, w: 1.0, h: 2.2, kind: 'door' }],
    s: [{ u: -84, w: 1.0, h: 2.2, kind: 'door' }, { u: -62, w: 1.6, h: 2.4, kind: 'door' }, { u: 0, w: 4.5, h: 4.5, kind: 'shutter', open: 0.85 },
      { u: 62, w: 3.2, h: 3.6, kind: 'dock', open: 0.9 }, { u: 70, w: 3.2, h: 3.6, kind: 'dock', open: 0.9 }, { u: 78, w: 3.2, h: 3.6, kind: 'dock', open: 0.05 }],
    w: [{ u: -24, w: 6, h: 5.8, kind: 'shutter', open: 0.95 }, { u: 30, w: 1.0, h: 2.2, kind: 'door' }],
    e: [{ u: 0, w: 5, h: 5, kind: 'shutter', open: 0.0 }]
  }
  const walls = {}
  for (const [k, S] of Object.entries(SIDE)) {
    const L = S.L(H)
    const gable = k === 'e' ? span((z) => -z) : k === 'w' ? span((z) => z) : null
    const w = wall(L, OPEN[k], { gable, windows: true, glowList: { mat: winGlow } })
    const [x, z] = S.pos(H)
    w.position.set(x, 0, z)
    w.rotation.y = S.ry
    w.name = `wall.${k}`
    dynamic(w)
    walls[k] = w
    root.add(w)
    // downpipes on the long walls
    if (k === 'n' || k === 's') for (let u = -L / 2 + 4; u < L / 2; u += 16) if (!OPEN[k].some((o) => Math.abs(o.u - u) < o.w / 2 + 1)) w.add(cyl(0.08, 0.08, 14, colorMat('#d9dcdd', 0.4, 0.6), { base: true, x: u, z: 0.25, seg: 8 }))
  }
  // big facade sign on the south wall
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(26, 2.4), new THREE.MeshStandardMaterial({ map: labelTexture('华东汽车部件 · 冲焊联合厂房', { bg: '#2f5d8c', fg: '#ffffff', w: 2048, h: 190, font: 'bold 120px sans-serif' }), roughness: 0.5 }))
  sign.position.set(-30, 10.2, 0.16)
  walls.s.add(sign)
  const r = roof()
  dynamic(r.g)
  root.add(r.g)
  bakeTree(root, { colors: true })
  return { object: root, rig: { walls, roof: r.g, skyMat: r.skyMat, winGlow, lampPts } }
}
/**
 * Two-storey office block (ground: offices, upper: control room with glass to the north
 * and east, video wall on the south wall). Local origin = block centre, 20 x 12 m.
 * rig: { wall (screen), glass }
 */
export function officeBlock() {
  const W = 20
  const D = 12
  const g = new THREE.Group()
  const panel = colorMat('#e4e6e3', 0.6, 0.1)
  const trim = colorMat('#2f5d8c', 0.5, 0.3)
  const win = officeGlass()
  // ground floor: insulated panels with window strips on north + east, door east
  g.add(box(W, 3.6, D, panel, { base: true }))
  for (const [x, z, w, ry] of [[0, -D / 2 - 0.01, W - 2, 0], [W / 2 + 0.01, 0, D - 3, Math.PI / 2]]) g.add(box(w, 1.3, 0.04, win, { x, y: 1.8, z, ry, cast: false }))
  g.add(box(1.6, 2.4, 0.06, colorMat('#5c6670', 0.5, 0.4), { base: true, x: W / 2 + 0.02, z: 4, ry: Math.PI / 2 }))
  g.add(box(W + 0.2, 0.35, D + 0.2, trim, { y: 3.75 }))
  // control room: floor y 3.9, solid south / west walls, glass north + east
  const y0 = 3.95
  const h = 3.2
  g.add(box(W, h, 0.2, panel, { base: true, y: y0, z: D / 2 - 0.1 }))
  g.add(box(0.2, h, D, panel, { base: true, x: -W / 2 + 0.1, y: y0 }))
  const glass = new THREE.MeshStandardMaterial({ color: '#7e98a8', roughness: 0.05, metalness: 0.5, transparent: true, opacity: 0.28, depthWrite: false, envMapIntensity: 1.4 })
  const gN = new THREE.Mesh(new THREE.PlaneGeometry(W - 0.4, h - 0.3), glass)
  gN.position.set(0, y0 + h / 2 + 0.1, -D / 2 + 0.05)
  const gE = new THREE.Mesh(new THREE.PlaneGeometry(D - 0.4, h - 0.3), glass)
  gE.position.set(W / 2 - 0.05, y0 + h / 2 + 0.1, 0)
  gE.rotation.y = Math.PI / 2
  for (const m of [gN, gE]) { m.renderOrder = 3; m.userData.keep = true; g.add(m) }
  const mull = colorMat('#3b4147', 0.4, 0.6)
  for (let x = -W / 2; x <= W / 2 + 0.01; x += 2.5) g.add(box(0.1, h, 0.12, mull, { base: true, x, y: y0, z: -D / 2 + 0.05 }))
  for (let z = -D / 2; z <= D / 2 + 0.01; z += 2.4) g.add(box(0.12, h, 0.1, mull, { base: true, x: W / 2 - 0.05, y: y0, z }))
  for (const yy of [y0 + 0.9, y0 + h - 0.05]) {
    g.add(box(W, 0.1, 0.14, mull, { y: yy, z: -D / 2 + 0.05 }))
    g.add(box(0.14, 0.1, D, mull, { x: W / 2 - 0.05, y: yy }))
  }
  // roof slab + parapet + sign
  g.add(box(W + 0.4, 0.4, D + 0.4, panel, { base: true, y: y0 + h }))
  g.add(box(W + 0.4, 0.5, 0.15, trim, { base: true, y: y0 + h + 0.4, z: -D / 2 - 0.12 }))
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(9, 0.9), new THREE.MeshStandardMaterial({ map: labelTexture('生产指挥中心 CONTROL ROOM', { bg: '#2f5d8c', fg: '#fff', w: 1024, h: 100, font: 'bold 56px sans-serif' }), roughness: 0.5 }))
  sign.position.set(-3, y0 + h + 0.15, -D / 2 - 0.22)
  sign.rotation.y = Math.PI
  g.add(sign)
  // interior: raised floor, desks with 3 monitors, chairs, ceiling lights
  g.add(box(W - 0.4, 0.05, D - 0.4, colorMat('#5e6870', 0.7, 0.1), { base: true, y: y0 }))
  for (const [x, z] of [[-6, -1.2], [-2.6, -1.2], [0.8, -1.2], [4.2, -1.2], [-4.4, 2], [-0.8, 2], [2.6, 2]]) {
    g.add(box(3.0, 0.06, 0.9, colorMat('#d8d4cc', 0.5), { base: true, x, y: y0 + 0.72, z }))
    g.add(box(2.9, 0.7, 0.05, colorMat('#4a5056', 0.5, 0.3), { base: true, x, y: y0, z: z - 0.42 }))
    for (const dx of [-0.75, 0, 0.75]) {
      g.add(box(0.66, 0.42, 0.03, colorMat('#15181b', 0.3), { x: x + dx, y: y0 + 1.08, z: z - 0.25, ry: Math.PI }))
      g.add(box(0.6, 0.36, 0.01, glowMat(dx ? '#3a7bd5' : '#2fbf8f', 0.7), { x: x + dx, y: y0 + 1.08, z: z - 0.23, ry: Math.PI, cast: false }))
    }
    g.add(box(0.5, 0.5, 0.5, colorMat('#2b2e33', 0.7), { base: true, x, y: y0 + 0.05, z: z + 0.75 }))
    g.add(box(0.5, 0.6, 0.08, colorMat('#2b2e33', 0.7), { base: true, x, y: y0 + 0.5, z: z + 1.0 }))
  }
  for (let x = -7.5; x <= 7.5; x += 3) g.add(box(1.2, 0.04, 0.6, glowMat('#f4f7ff', 1.4), { x, y: y0 + h - 0.06, z: 0, cast: false }))
  // video wall on the inside of the south wall (faces north)
  const vw = screen(9.6, 2.4, 1536)
  vw.mesh.position.set(-1, y0 + 1.75, D / 2 - 0.22)
  vw.mesh.rotation.y = Math.PI
  g.add(box(9.9, 2.7, 0.12, colorMat('#15181b', 0.4), { x: -1, y: y0 + 1.75, z: D / 2 - 0.16 }))
  g.add(vw.mesh)
  // external stair on the east face up to the control-room door (north end)
  const st = colorMat('#c9a227', 0.5, 0.3)
  for (let i = 0; i < 20; i++) g.add(box(1.1, 0.05, 0.28, mat('steel'), { x: W / 2 + 0.7, y: 0.2 + i * 0.19, z: 5.4 - i * 0.28 }))
  for (const s of [0.15, 1.25]) g.add(rod(V(W / 2 + s, 1.1, 5.6), V(W / 2 + s, y0 + 1.1, -0.2), 0.03, st))
  g.add(box(1.4, 0.08, 1.6, mat('steel'), { x: W / 2 + 0.7, y: y0 - 0.04, z: -1.2 }))
  bakeTree(g, { colors: true })
  return { object: g, rig: { screen: vw } }
}

/** hanging two-sided andon board (canvas screen); rig.screen.draw(fn) */
export function andon({ w = 4.8, h = 1.5, y = 5 } = {}) {
  const g = new THREE.Group()
  g.add(box(w + 0.2, h + 0.2, 0.22, colorMat('#15181b', 0.4), { y }))
  for (const s of [1, -1]) g.add(cyl(0.02, 0.02, 14 - y - h / 2, mat('steel.dark'), { base: true, x: s * (w / 2 - 0.3), y: y + h / 2 + 0.1, seg: 4, cast: false }))
  const sc = screen(w, h, 768)
  sc.mesh.position.set(0, y, 0.12)
  const back = new THREE.Mesh(sc.mesh.geometry, sc.mat)
  back.position.set(0, y, -0.12)
  back.rotation.y = Math.PI
  back.userData.keep = true
  sc.mesh.userData.keep = true
  g.add(sc.mesh, back)
  bakeTree(g, { colors: true })
  return { object: g, rig: { screen: sc } }
}
