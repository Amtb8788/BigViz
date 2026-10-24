// Realistic-style greenery: layered leaf-card canopies (alpha-tested sprig atlas), tapered
// trunk + branch tubes, species (plane / ginkgo / pine), shrubs and tree pits with grates.
// Per tree: 1 bark mesh + 1 leaf mesh (high/medium) or a sparse leaf mesh (low), so draw
// calls match the old sphere trees. Leaves flutter in the vertex shader; the canopy group
// still sways via weather.js (rig.canopy).

import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { makeCanvas } from '../render/textures.js'
import { createRng } from '../core/rng.js'
import { detailOnly, windTime, tickWind } from '../render/detail.js'
import { dynamic, group } from './kit.js'

// leaf atlas regions [u0, v0, size] (uv space): big tiles per species, small shrub / blossom tiles
const UV = {
  plane: [[0, 0.5, 0.5]], ginkgo: [[0.5, 0.5, 0.5]], pine: [[0, 0, 0.5]],
  shrub: [[0.5, 0.25, 0.25], [0.5, 0, 0.25]], blossom: [[0.75, 0.25, 0.25], [0.75, 0, 0.25]]
}
let leafTex = null

function sprig(ctx, rng, kind, ox, oy, S) {
  const cx = ox + S / 2
  const cy = oy + S / 2
  const n = kind === 'pine' ? 9 : kind === 'shrub' ? 26 : 13
  ctx.strokeStyle = '#3a2f1c'
  ctx.lineWidth = 2
  for (let i = 0; i < n; i++) {
    const a = rng.range(0, Math.PI * 2)
    const r = rng.range(0.12, 0.36) * S
    const x = cx + Math.cos(a) * r
    const y = cy + Math.sin(a) * r
    const l = 0.4 + rng.next() * 0.35
    ctx.fillStyle = `hsl(${rng.range(78, 112)},${rng.range(30, 52)}%,${rng.range(28, 52) * l + 18}%)`
    ctx.strokeStyle = ctx.fillStyle
    ctx.save()
    ctx.translate(x, y)
    ctx.rotate(a + rng.jitter(0.6))
    if (kind === 'pine') {
      ctx.lineWidth = 2.2
      for (let k = 0; k < 16; k++) { const b = (k / 15 - 0.5) * 2.4; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(b) * S * 0.16, Math.sin(b) * S * 0.16); ctx.stroke() }
    } else if (kind === 'ginkgo') {
      const s = S * rng.range(0.07, 0.1)
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, s, -0.85, 0.85); ctx.closePath(); ctx.fill()
    } else if (kind === 'plane') {
      const s = S * rng.range(0.08, 0.11)
      ctx.beginPath()
      for (let k = 0; k <= 10; k++) { const b = (k / 10) * Math.PI * 2; const rr = s * (k % 2 ? 0.55 : 1); ctx.lineTo(Math.cos(b) * rr + s * 0.6, Math.sin(b) * rr) }
      ctx.fill()
    } else {
      const s = S * rng.range(0.035, 0.05)
      ctx.beginPath(); ctx.ellipse(s, 0, s, s * 0.5, 0, 0, Math.PI * 2); ctx.fill()
    }
    ctx.restore()
  }
}

function blossom(ctx, rng, ox, oy, S) {
  sprig(ctx, rng, 'shrub', ox, oy, S)
  for (let i = 0; i < 22; i++) {
    const x = ox + S * rng.range(0.15, 0.85)
    const y = oy + S * rng.range(0.15, 0.85)
    const r = S * rng.range(0.025, 0.045)
    ctx.fillStyle = `hsl(0,0%,${rng.range(88, 100)}%)`
    for (let k = 0; k < 5; k++) { const a = (k / 5) * Math.PI * 2; ctx.beginPath(); ctx.arc(x + Math.cos(a) * r, y + Math.sin(a) * r, r * 0.7, 0, Math.PI * 2); ctx.fill() }
    ctx.fillStyle = '#e8c34a'
    ctx.beginPath(); ctx.arc(x, y, r * 0.4, 0, Math.PI * 2); ctx.fill()
  }
}

/** uv region -> canvas px rect (canvas y runs down, uv v runs up) */
const px = ([u, v, s], N) => [u * N, (1 - v - s) * N, s * N]

function leafAtlas() {
  if (leafTex) return leafTex
  const N = 512
  const c = makeCanvas(N, N)
  const ctx = c.getContext('2d')
  const rng = createRng(77)
  for (const k of ['plane', 'ginkgo', 'pine']) {
    const [x, y, s] = px(UV[k][0], N)
    // twigs first, then leaves on top
    ctx.strokeStyle = '#4a3b26'
    ctx.lineWidth = 3
    for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.moveTo(x + s / 2, y + s / 2); const a = rng.range(0, 6.3); ctx.lineTo(x + s / 2 + Math.cos(a) * s * 0.33, y + s / 2 + Math.sin(a) * s * 0.33); ctx.stroke() }
    sprig(ctx, rng, k, x, y, s)
  }
  for (const r of UV.shrub) { const [x, y, s] = px(r, N); sprig(ctx, rng, 'shrub', x, y, s) }
  for (const r of UV.blossom) { const [x, y, s] = px(r, N); blossom(ctx, rng, x, y, s) }
  leafTex = new THREE.CanvasTexture(c)
  leafTex.colorSpace = THREE.SRGBColorSpace
  leafTex.anisotropy = 4
  return leafTex
}

// flutter in the vertex shader (amplitude grows away from the canopy origin); back faces
// keep the card's "radial" normal so the canopy shades as one soft volume
function leafShader(shader) {
  shader.uniforms.uWind = windTime
  shader.vertexShader = 'uniform float uWind;\n' + shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
    float fl = min(length(position) * 0.012, 0.035);
    float ph = dot(position, vec3(1.7, 2.3, 1.1));
    transformed += vec3(sin(uWind * 2.1 + ph), sin(uWind * 2.9 + ph * 1.3) * 0.6, cos(uWind * 1.7 + ph)) * fl;`)
  shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_begin>', `#include <normal_fragment_begin>
    #ifdef DOUBLE_SIDED
      normal *= faceDirection;
    #endif`)
}

const leafMats = {}
/** tier: 'hi' (medium/high) | 'lo' (low) | 'all' (shrubs, planters) */
export function leafMaterial(tier = 'all') {
  if (leafMats[tier]) return leafMats[tier]
  const m = new THREE.MeshStandardMaterial({ map: leafAtlas(), alphaTest: 0.45, side: THREE.DoubleSide, vertexColors: true, roughness: 0.82, metalness: 0, envMapIntensity: 0.55 })
  m.name = `leaves.${tier}`
  m.onBeforeCompile = leafShader
  m.customProgramCacheKey = () => 'leaves.v1'
  m.onBeforeRender = tickWind
  if (tier === 'hi') detailOnly(m, 1, 2)
  if (tier === 'lo') detailOnly(m, 0, 0)
  leafMats[tier] = m
  return m
}

// bark atlas: left half bark (tiles along v), right top grate (alpha slots), right bottom curb
let barkM = null
export function barkMaterial() {
  if (barkM) return barkM
  const N = 256
  const c = makeCanvas(N, N)
  const ctx = c.getContext('2d')
  const rng = createRng(31)
  ctx.fillStyle = '#5a4a3a'
  ctx.fillRect(0, 0, N / 2, N)
  for (let i = 0; i < 260; i++) {
    ctx.fillStyle = `rgba(${rng.chance(0.5) ? '30,22,16' : '140,128,110'},${rng.range(0.15, 0.45)})`
    ctx.fillRect(rng.range(0, N / 2), rng.range(0, N), rng.range(1, 3), rng.range(8, 40))
  }
  // grate: cast iron disc with radial slots (transparent -> pit soil below shows)
  const gx = N * 0.75
  const gy = N * 0.25
  ctx.fillStyle = '#2b2a28'
  ctx.fillRect(N / 2, 0, N / 2, N / 2)
  ctx.globalCompositeOperation = 'destination-out'
  for (let r = 14; r < 60; r += 9) for (let k = 0; k < 24; k++) {
    const a = (k / 24) * Math.PI * 2 + r
    ctx.save(); ctx.translate(gx + Math.cos(a) * r, gy + Math.sin(a) * r); ctx.rotate(a); ctx.fillRect(-3, -1.5, 6, 3); ctx.restore()
  }
  ctx.globalCompositeOperation = 'source-over'
  // curb: light concrete with speckle
  ctx.fillStyle = '#9d9a93'
  ctx.fillRect(N / 2, N / 2, N / 2, N / 2)
  for (let i = 0; i < 300; i++) { ctx.fillStyle = `rgba(0,0,0,${rng.range(0.05, 0.2)})`; ctx.fillRect(N / 2 + rng.range(0, N / 2), N / 2 + rng.range(0, N / 2), 2, 2) }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.wrapT = THREE.RepeatWrapping
  barkM = new THREE.MeshStandardMaterial({ map: t, alphaTest: 0.5, roughness: 0.92, metalness: 0, name: 'bark.real' })
  return barkM
}

const _t = new THREE.Vector3()
const _n = new THREE.Vector3()
const _b = new THREE.Vector3()
const _up = new THREE.Vector3(0, 1, 0)
const _x = new THREE.Vector3(1, 0, 0)

/** Tapered tube through pts (Vector3[]) with radii r[]; bark uv (u 0..0.5, v in metres / 2) */
function tube(pts, r, seg = 6) {
  const P = []
  const N = []
  const U = []
  const I = []
  let len = 0
  for (let i = 0; i < pts.length; i++) {
    if (i) len += pts[i].distanceTo(pts[i - 1])
    _t.subVectors(pts[Math.min(i + 1, pts.length - 1)], pts[Math.max(i - 1, 0)]).normalize()
    _n.crossVectors(_t, Math.abs(_t.y) > 0.9 ? _x : _up).normalize()
    _b.crossVectors(_t, _n)
    for (let k = 0; k <= seg; k++) {
      const a = (k / seg) * Math.PI * 2
      const nx = _n.x * Math.cos(a) + _b.x * Math.sin(a)
      const ny = _n.y * Math.cos(a) + _b.y * Math.sin(a)
      const nz = _n.z * Math.cos(a) + _b.z * Math.sin(a)
      P.push(pts[i].x + nx * r[i], pts[i].y + ny * r[i], pts[i].z + nz * r[i])
      N.push(nx, ny, nz)
      U.push((k / seg) * 0.5, len / 2)
    }
  }
  for (let i = 0; i < pts.length - 1; i++) for (let k = 0; k < seg; k++) {
    const a = i * (seg + 1) + k
    const b = a + seg + 1
    I.push(a, b, a + 1, a + 1, b, b + 1)
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3))
  g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2))
  g.setIndex(I)
  return g
}

/** Square tree pit: low concrete curb ring + grate plate (uv into the bark atlas) */
function pitGeometry(s = 1.3) {
  const parts = []
  const curb = 0.14
  const h = 0.2
  for (const [x, z, w, d] of [[0, s / 2, s, curb], [0, -s / 2, s, curb], [s / 2, 0, curb, s], [-s / 2, 0, curb, s]]) {
    const b = new THREE.BoxGeometry(w, h, d).translate(x, h / 2, z)
    const uv = b.attributes.uv
    for (let i = 0; i < uv.count; i++) uv.setXY(i, 0.5 + uv.getX(i) * 0.5, uv.getY(i) * 0.5)
    parts.push(b)
  }
  const plate = new THREE.PlaneGeometry(s - curb, s - curb).rotateX(-Math.PI / 2).translate(0, h - 0.03, 0)
  const pu = plate.attributes.uv
  for (let i = 0; i < pu.count; i++) pu.setXY(i, 0.5 + pu.getX(i) * 0.5, 0.5 + pu.getY(i) * 0.5)
  parts.push(plate)
  // soil under the slots
  const soil = new THREE.PlaneGeometry(s - curb, s - curb).rotateX(-Math.PI / 2).translate(0, 0.06, 0)
  const su = soil.attributes.uv
  for (let i = 0; i < su.count; i++) su.setXY(i, 0.05, 0.3)
  parts.push(soil)
  return mergeGeometries(parts.map((p) => (p.index ? p.toNonIndexed() : p)))
}

const V3 = (x, y, z) => new THREE.Vector3(x, y, z)

/** Branch from a (Vector3) along dir with length L, bending up by `lift`; returns points */
function limb(a, dir, L, lift, n = 4) {
  const pts = [a.clone()]
  for (let i = 1; i <= n; i++) {
    const t = i / n
    pts.push(V3(a.x + dir.x * L * t, a.y + dir.y * L * t + lift * L * t * t, a.z + dir.z * L * t))
  }
  return pts
}

const taper = (n, r0, r1) => Array.from({ length: n }, (_, i) => r0 + (r1 - r0) * (i / (n - 1)))

/**
 * Species skeleton. Returns { wood: BufferGeometry[], clusters: [{ c: Vector3, r, ry }] }
 * in tree space (y up from the ground).
 */
function skeleton(species, h, rng) {
  const wood = []
  const clusters = []
  const lean = V3(rng.jitter(0.15), 0, rng.jitter(0.15))
  if (species === 'pine') {
    const top = V3(lean.x, h, lean.z)
    wood.push(tube([V3(0, 0, 0), V3(lean.x * 0.5, h * 0.5, lean.z * 0.5), top], [h * 0.035, h * 0.022, h * 0.006], 6))
    const whorls = Math.round(h / 0.9)
    for (let w = 0; w < whorls; w++) {
      const y = h * (0.28 + 0.68 * (w / whorls))
      const reach = (1 - (y / h)) * h * 0.38 + 0.25
      const k = 4 + (w % 2)
      for (let i = 0; i < k; i++) {
        const a = (i / k) * Math.PI * 2 + w * 0.7 + rng.jitter(0.3)
        const dir = V3(Math.cos(a), -0.12, Math.sin(a))
        const base = V3(lean.x * (y / h), y, lean.z * (y / h))
        if (w % 2 === 0) wood.push(tube(limb(base, dir, reach, 0.1, 2), [0.04, 0.012, 0.006], 4))
        clusters.push({ c: V3(base.x + dir.x * reach * 0.62, y - 0.05, base.z + dir.z * reach * 0.62), r: reach * 0.5 + 0.2, flat: 0.5 })
      }
    }
    clusters.push({ c: V3(top.x, h - 0.3, top.z), r: 0.45, flat: 1 })
    return { wood, clusters }
  }
  const forkY = h * (species === 'ginkgo' ? 0.3 : 0.4)
  const fork = V3(lean.x, forkY, lean.z)
  const r0 = h * (species === 'ginkgo' ? 0.028 : 0.034)
  if (species === 'ginkgo') {
    // columnar: leader to the top, short ascending tiers
    const top = V3(lean.x * 1.6, h * 0.94, lean.z * 1.6)
    wood.push(tube([V3(0, 0, 0), fork, V3(lean.x * 1.3, h * 0.65, lean.z * 1.3), top], [r0 * 1.15, r0 * 0.8, r0 * 0.45, 0.02], 7))
    for (let i = 0; i < 9; i++) {
      const t = 0.15 + (i / 9) * 0.8
      const y = forkY + (h * 0.92 - forkY) * t
      const a = i * 2.4 + rng.jitter(0.4)
      const L = h * 0.2 * (1 - t * 0.55)
      const dir = V3(Math.cos(a), 0.55, Math.sin(a)).normalize()
      const base = V3(lean.x * (1 + t * 0.6), y, lean.z * (1 + t * 0.6))
      wood.push(tube(limb(base, dir, L, 0.15, 3), taper(4, r0 * 0.38, 0.012), 5))
      clusters.push({ c: base.clone().addScaledVector(dir, L * 0.8), r: L * 0.62 + 0.35, flat: 0.9 })
    }
    clusters.push({ c: top.clone(), r: h * 0.12, flat: 1 })
    return { wood, clusters }
  }
  // plane tree: short trunk, 3-4 scaffold limbs, sub-branches, broad dome
  wood.push(tube([V3(0, 0, 0), V3(lean.x * 0.5, forkY * 0.5, lean.z * 0.5), fork], [r0 * 1.2, r0, r0 * 0.9], 8))
  const k = rng.int(3, 4)
  for (let i = 0; i < k; i++) {
    const a = (i / k) * Math.PI * 2 + rng.jitter(0.5)
    const dir = V3(Math.cos(a) * 0.62, 0.78, Math.sin(a) * 0.62).normalize()
    const L = h * rng.range(0.32, 0.4)
    const pts = limb(fork, dir, L, -0.08, 4)
    wood.push(tube(pts, taper(5, r0 * 0.62, 0.025), 6))
    const end = pts[4]
    clusters.push({ c: end.clone().add(V3(0, 0.25, 0)), r: h * 0.2, flat: 0.75 })
    // two sub-branches off the limb's middle
    for (const s of [1, -1]) {
      const b = pts[2]
      const d2 = V3(Math.cos(a + s * 0.9), 0.35, Math.sin(a + s * 0.9)).normalize()
      const L2 = L * 0.55
      wood.push(tube(limb(b, d2, L2, 0.25, 2), [r0 * 0.3, r0 * 0.15, 0.012], 4))
      clusters.push({ c: b.clone().addScaledVector(d2, L2 * 0.9).add(V3(0, 0.2, 0)), r: h * 0.15, flat: 0.75 })
    }
  }
  clusters.push({ c: V3(fork.x, h * 0.86, fork.z), r: h * 0.2, flat: 0.7 })
  return { wood, clusters }
}

const _o = new THREE.Vector3()
const _r = new THREE.Vector3()
const _a = new THREE.Vector3()
const _c = new THREE.Vector3()

/**
 * Leaf cards scattered in cluster volumes. Normals point away from `center` (soft canopy
 * shading); colour darkens toward the inside / bottom (cheap AO). Positions relative to `origin`.
 * opt: { n, size, tint:[r,g,b], uv: regions[], tints?: [[r,g,b]...] per-card palette }
 */
export function leafCards(clusters, rng, { n, size, tint = [1, 1, 1], uv, tints, origin = V3(0, 0, 0), center } = {}) {
  const P = new Float32Array(n * 12)
  const N = new Float32Array(n * 12)
  const C = new Float32Array(n * 12)
  const U = new Float32Array(n * 8)
  const I = []
  const w = clusters.map((c) => c.r * c.r)
  const tot = w.reduce((a, b) => a + b, 0)
  const cen = center || clusters.reduce((a, c) => a.add(c.c), V3(0, 0, 0)).multiplyScalar(1 / clusters.length)
  let span = 0
  for (const c of clusters) span = Math.max(span, c.c.distanceTo(cen) + c.r)
  for (let i = 0; i < n; i++) {
    let pick = rng.next() * tot
    let cl = clusters[0]
    for (let k = 0; k < clusters.length; k++) { pick -= w[k]; if (pick <= 0) { cl = clusters[k]; break } }
    // point in an ellipsoid, biased toward the shell
    _r.set(rng.jitter(1), rng.jitter(1), rng.jitter(1)).normalize()
    const rr = cl.r * (0.45 + 0.55 * Math.sqrt(rng.next()))
    _o.set(cl.c.x + _r.x * rr, cl.c.y + _r.y * rr * (cl.flat ?? 1), cl.c.z + _r.z * rr)
    _c.subVectors(_o, cen)
    const out = _c.length() / span
    _c.normalize().add(V3(0, 0.35, 0)).normalize()
    // card plane: random, tilted toward the outward direction
    _a.set(rng.jitter(1), rng.jitter(1), rng.jitter(1)).normalize().addScaledVector(_c, 0.8).normalize()
    const t1 = new THREE.Vector3().crossVectors(_a, Math.abs(_a.y) > 0.9 ? _x : _up).normalize()
    const t2 = new THREE.Vector3().crossVectors(_a, t1)
    const s = size * rng.range(0.75, 1.25) * 0.5
    const reg = uv[rng.int(0, uv.length - 1)]
    const flip = rng.chance(0.5)
    const ao = Math.min(1.08, 0.5 + out * 0.45 + Math.max(0, (_o.y - cen.y) / span) * 0.25) * rng.range(0.88, 1.08)
    const tc = tints ? tints[rng.int(0, tints.length - 1)] : tint
    const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]]
    for (let k = 0; k < 4; k++) {
      const [cx, cy] = corners[k]
      const j = i * 12 + k * 3
      P[j] = _o.x - origin.x + (t1.x * cx + t2.x * cy) * s
      P[j + 1] = _o.y - origin.y + (t1.y * cx + t2.y * cy) * s
      P[j + 2] = _o.z - origin.z + (t1.z * cx + t2.z * cy) * s
      N[j] = _c.x; N[j + 1] = _c.y; N[j + 2] = _c.z
      C[j] = tc[0] * ao; C[j + 1] = tc[1] * ao; C[j + 2] = tc[2] * ao
      const u = (flip ? -cx : cx) * 0.5 + 0.5
      U[i * 8 + k * 2] = reg[0] + u * reg[2]
      U[i * 8 + k * 2 + 1] = reg[1] + (cy * 0.5 + 0.5) * reg[2]
    }
    const b = i * 4
    I.push(b, b + 1, b + 2, b, b + 2, b + 3)
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(P, 3))
  g.setAttribute('normal', new THREE.BufferAttribute(N, 3))
  g.setAttribute('color', new THREE.BufferAttribute(C, 3))
  g.setAttribute('uv', new THREE.BufferAttribute(U, 2))
  g.setIndex(I)
  g.computeBoundingSphere()
  return g
}

// species presets: leaf cards (hi / lo), card size (m), foliage tint (multiplies the atlas)
const SPECIES = {
  plane: { hi: 300, lo: 90, size: 1.05, tint: [0.92, 1, 0.82] },
  ginkgo: { hi: 260, lo: 80, size: 0.95, tint: [1.05, 1.08, 0.7] },
  pine: { hi: 320, lo: 100, size: 1.0, tint: [0.62, 0.8, 0.66] }
}
const KIND = { round: 'plane', tall: 'ginkgo', cone: 'pine' }

function mesh(geo, material, cast = true) {
  const m = new THREE.Mesh(geo, material)
  m.castShadow = cast
  m.receiveShadow = true
  m.userData.keep = true
  return m
}

/**
 * Realistic tree. kind: round (plane tree) | tall (ginkgo) | cone (pine), or species directly.
 * pit: square curb + grate at the base (street trees). Same rig as the stylised tree.
 */
export function realTree({ kind = 'round', species, h = 5, seed = 1, pit = true } = {}) {
  const rng = createRng(seed * 7 + 3)
  const sp = species || KIND[kind] || 'plane'
  const S = SPECIES[sp]
  const H = h * (sp === 'pine' ? 1.25 : 1.3)
  const { wood, clusters } = skeleton(sp, H, rng)
  if (pit) wood.push(pitGeometry())
  const woodGeo = mergeGeometries(wood.map((g) => (g.index ? g.toNonIndexed() : g)))
  wood.forEach((g) => g.dispose())
  const g = group(mesh(woodGeo, barkMaterial()))
  // canopy pivot near the fork so weather sway bends the crown, not the whole tree
  const canopy = dynamic(new THREE.Group())
  const pivot = V3(0, H * (sp === 'pine' ? 0.3 : 0.4), 0)
  canopy.position.copy(pivot)
  const center = clusters.reduce((a, c) => a.add(c.c), V3(0, 0, 0)).multiplyScalar(1 / clusters.length)
  const tint = S.tint.map((v) => v * rng.range(0.92, 1.06))
  const opt = { size: S.size * (H / 6.5) ** 0.5, tint, uv: UV[sp], origin: pivot, center }
  canopy.add(mesh(leafCards(clusters, rng, { ...opt, n: S.hi }), leafMaterial('hi')))
  canopy.add(mesh(leafCards(clusters, createRng(seed + 99), { ...opt, n: S.lo, size: opt.size * 1.7 }), leafMaterial('lo')))
  g.add(canopy)
  return { object: g, rig: { canopy, phase: rng.range(0, 6) } }
}

/** Leaf-card bush (one mesh); flowers: share of blossom cards */
export function realShrub({ seed = 2, r = 0.7, flowers = 0 } = {}) {
  const rng = createRng(seed * 5 + 1)
  const clusters = []
  for (let i = 0; i < 4; i++) clusters.push({ c: V3(rng.jitter(r * 0.5), r * 0.55, rng.jitter(r * 0.5)), r: r * rng.range(0.55, 0.8), flat: 0.8 })
  const n = Math.round(70 * r * r + 30)
  const geo = leafCards(clusters, rng, { n, size: 0.5 * Math.max(0.6, r), tint: [0.85, 1, 0.8], uv: flowers ? [...UV.shrub, ...UV.blossom] : UV.shrub, tints: flowers ? FLOWER_TINTS : null })
  return { object: group(mesh(geo, leafMaterial('all'))) }
}

const FLOWER_TINTS = [[0.85, 1, 0.8], [0.85, 1, 0.8], [1, 0.62, 0.75], [1, 0.9, 0.45], [0.82, 0.62, 1], [1, 1, 1]]

/** Concrete planter with a leaf-card hedge + flowers (the box is plain colour -> baked) */
export function realPlanter({ w = 4, d = 1.6, seed = 3, curb }) {
  const rng = createRng(seed * 3 + 11)
  const clusters = []
  const k = Math.max(2, Math.round(w / 0.9))
  for (let i = 0; i < k; i++) clusters.push({ c: V3(-w / 2 + 0.45 + (i + 0.5) * ((w - 0.9) / k), 0.85, rng.jitter(d * 0.12)), r: Math.min(0.55, d * 0.36), flat: 0.7 })
  const geo = leafCards(clusters, rng, { n: Math.round(w * d * 28), size: 0.42, uv: [...UV.shrub, ...UV.blossom], tints: FLOWER_TINTS })
  return { object: group(curb, mesh(geo, leafMaterial('all'))) }
}
