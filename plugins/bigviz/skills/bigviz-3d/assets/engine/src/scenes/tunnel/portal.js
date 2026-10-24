// Tunnel pack - portal architecture: end-wall headwalls with a projecting arch band, name
// plaques, wing walls that retain the approach cut, a frame-beam lattice on the 1:0.75 cut
// slope, the crown intercept ditch, parapet railings and portal lamps.

import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { PZ, XL, XR, W2, HW, profile, heightAt, natural, KM } from './geom.js'
import { surfaceMat, mat, lightMat } from '../../render/materials.js'
import { makeCanvas } from '../../render/textures.js'

const T = 0.8 // headwall thickness (into the yard)

function planarUV(g, tile = 4) {
  const p = g.attributes.position
  const n = g.attributes.normal
  const uv = new Float32Array(p.count * 2)
  for (let i = 0; i < p.count; i++) {
    const ax = Math.abs(n.getX(i)), az = Math.abs(n.getZ(i))
    uv[i * 2] = (ax > az ? p.getZ(i) : p.getX(i)) / tile
    uv[i * 2 + 1] = p.getY(i) / tile
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
  return g
}

/** headwall slab for one tube: rectangle W2*2 x HW with the lining outline cut out */
function headwall(xp) {
  const prof = profile(0, 40)
  const s = new THREE.Shape()
  s.moveTo(-W2, 0)
  s.lineTo(prof[0][0], 0)
  for (const [x, y] of prof) s.lineTo(x, y)
  s.lineTo(W2, 0)
  s.lineTo(W2, HW)
  s.lineTo(-W2, HW)
  s.closePath()
  const g = new THREE.ExtrudeGeometry(s, { depth: T, bevelEnabled: false, curveSegments: 4 })
  g.translate(xp, 0, PZ)
  return planarUV(g.toNonIndexed())
}

/** projecting arch band around the opening (portal ring) */
function archBand(xp) {
  const a = profile(0, 40), b = profile(0.9, 40)
  const s = new THREE.Shape()
  s.moveTo(a[0][0], 0)
  for (const [x, y] of a) s.lineTo(x, y)
  s.lineTo(b[b.length - 1][0], 0)
  for (let i = b.length - 1; i >= 0; i--) s.lineTo(b[i][0], b[i][1])
  s.closePath()
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.35, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.06, bevelSegments: 1, curveSegments: 4 })
  g.translate(xp, 0, PZ + T)
  return planarUV(g.toNonIndexed())
}

/** coping + parapet posts along the headwall top */
function coping(xp) {
  const parts = [new THREE.BoxGeometry(W2 * 2 + 0.4, 0.35, T + 0.3).translate(xp, HW + 0.17, PZ + T / 2)]
  return parts.map((g) => planarUV(g.toNonIndexed()))
}

/** wing wall face along a notch edge (x = xe, facing `dir` into the notch), z from PZ+T to the end of the cliff */
function wingWall(xe, dir) {
  const pos = []
  const zs = []
  for (let z = PZ + T; z <= PZ + 9; z += 0.5) zs.push(z)
  for (let i = 0; i < zs.length - 1; i++) {
    const z0 = zs[i], z1 = zs[i + 1]
    const h0 = Math.max(0, heightAt(xe - dir * 0.05, z0)) + 0.25, h1 = Math.max(0, heightAt(xe - dir * 0.05, z1)) + 0.25
    if (h0 < 0.3 && h1 < 0.3) continue
    const x = xe + dir * 0.06
    pos.push(x, -0.2, z0, x, -0.2, z1, x, h1, z1, x, -0.2, z0, x, h1, z1, x, h0, z0)
    // coping on top (thin cap)
    const xo = xe - dir * 0.45
    pos.push(x, h0, z0, x, h1, z1, xo, h1, z1, x, h0, z0, xo, h1, z1, xo, h0, z0)
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.computeVertexNormals()
  return planarUV(g)
}

/** frame-beam lattice on the 1:0.75 cut slope above a headwall (only where the cut is exposed) */
function lattice(xp) {
  const geos = []
  const ang = Math.atan2(1, 0.75) // slope angle from horizontal
  const exposed = (x, z) => heightAt(x, z) < natural(x, z) - 0.4
  const yAt = (z) => HW + (PZ - z) / 0.75
  // horizontal beams every 3 m of slope (2.4 m in plan)
  for (let k = 1; k < 14; k++) {
    const z = PZ - k * 1.8
    let a = null
    for (let x = xp - W2 + 0.3; x <= xp + W2 - 0.3; x += 0.5) {
      const e = exposed(x, z)
      if (e && a == null) a = x
      if ((!e || x > xp + W2 - 0.8) && a != null) {
        const len = x - a
        if (len > 1.2) geos.push(new THREE.BoxGeometry(len, 0.3, 0.3).translate(a + len / 2, yAt(z) + 0.12, z))
        a = null
      }
    }
  }
  // fall-line beams every 3 m across
  for (let x = xp - W2 + 1.5; x < xp + W2 - 1; x += 3) {
    let z = PZ - 0.2
    while (z > PZ - 30 && exposed(x, z - 0.3)) z -= 0.3
    const run = PZ - 0.2 - z
    if (run < 1) continue
    const len = run / Math.cos(ang)
    const g = new THREE.BoxGeometry(0.3, 0.3, len)
    g.rotateX(-ang)
    g.translate(x, yAt(PZ - 0.2 - run / 2) + 0.12, PZ - 0.2 - run / 2)
    geos.push(g)
  }
  // crown intercept ditch at the top of the cut
  return geos.map((g) => planarUV(g.toNonIndexed(), 2))
}

let plaqueTex = new Map()
function plaque(name, km) {
  const key = name
  if (!plaqueTex.has(key)) {
    const c = makeCanvas(1024, 256)
    const x = c.getContext('2d')
    x.fillStyle = '#2b2d30'; x.fillRect(0, 0, 1024, 256)
    x.strokeStyle = '#8c7a4c'; x.lineWidth = 8; x.strokeRect(10, 10, 1004, 236)
    x.fillStyle = '#d9c38a'; x.font = 'bold 120px "SimHei", "Microsoft YaHei", sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'
    x.fillText(name, 512, 110)
    x.font = 'bold 38px sans-serif'; x.fillStyle = '#c9c4b6'
    x.fillText(km, 512, 205)
    const t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    t.anisotropy = 8
    plaqueTex.set(key, t)
  }
  const m = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 1.6), new THREE.MeshStandardMaterial({ map: plaqueTex.get(key), roughness: 0.55, metalness: 0.1 }))
  return m
}

const kmLabel = (s) => `DK${Math.floor((KM + s) / 1000)}+${String(Math.round((KM + s) % 1000)).padStart(3, '0')}`

/** the portal group (both headwalls, wings, lattices, plaques, lamps) */
export function buildPortals() {
  const g = new THREE.Group()
  g.name = 'portals'
  const conc = surfaceMat('concrete', 1)
  const wall = [], band = [], beams = []
  for (const [xp, name] of [[XL, '青石岭隧道 · 左线'], [XR, '青石岭隧道 · 右线']]) {
    wall.push(headwall(xp), ...coping(xp))
    band.push(archBand(xp))
    beams.push(...lattice(xp))
    const p = plaque(name, `${kmLabel(0)} 进口`)
    p.position.set(xp, 10.7, PZ + T + 0.36)
    g.add(p)
    // portal lamps either side of the arch, railing on the coping
    for (const s of [-1, 1]) {
      const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.3, 0.3), lightMat('#fff1d0', 3.2, 'street'))
      lamp.position.set(xp + s * 8.2, 7.6, PZ + T + 0.2)
      g.add(lamp)
    }
    for (let x = xp - W2; x <= xp + W2 + 0.01; x += 2) beams.push(planarUV(new THREE.BoxGeometry(0.08, 1.1, 0.08).translate(x, HW + 0.9, PZ + 0.15).toNonIndexed()))
    beams.push(planarUV(new THREE.BoxGeometry(W2 * 2, 0.07, 0.07).translate(xp, HW + 1.4, PZ + 0.15).toNonIndexed()))
    for (const s of [-1, 1]) wall.push(wingWall(xp + s * W2, -s))
  }
  const mk = (geos, m, name) => { const mesh = new THREE.Mesh(mergeGeometries(geos), m); mesh.name = name; mesh.castShadow = true; mesh.receiveShadow = true; g.add(mesh) }
  mk(wall, conc, 'portal.walls')
  mk(band, surfaceMat('concrete', 1), 'portal.band')
  mk(beams, mat('concrete.fresh'), 'portal.lattice')
  return g
}

export { kmLabel }
