// Bridge pack - landscape: one non-uniform heightfield to the horizon (river channel, banks,
// bluff, yard plateau, hills) with a grass / soil splat, a reflective river (three Water with a
// procedural ripple normal map), bank foam, revetment strips and a distant city skyline.

import * as THREE from 'three'
import { Water } from 'three/examples/jsm/objects/Water.js'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { surfaceMat } from '../../render/materials.js'
import { makeCanvas, fbm, normalFromHeight } from '../../render/textures.js'
import { createRng } from '../../core/rng.js'
import { WATER, MP, COFFER, groundY, YARD } from './layout.js'

const sm = (a, b, v) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t) }

/** fine near the site, coarse toward the horizon */
function axis(fine, step, far) {
  const a = [0]
  let s = 0
  while (s < far) {
    const d = s < fine ? step : step * Math.pow(1 + (s - fine) / fine, 1.35)
    s = Math.min(far, s + d)
    a.push(s)
  }
  return [...a.slice(1).reverse().map((v) => -v), ...a]
}

/** grass / soil splat: soil weight in a vertex attribute, mixed in the fragment shader */
function splatMaterial() {
  const g = surfaceMat('grass', 1)
  const s = surfaceMat('soil', 1)
  const m = new THREE.MeshStandardMaterial({ map: g.map, normalMap: g.normalMap, roughness: 1, metalness: 0, vertexColors: true })
  m.name = 'bridge.terrain'
  const soil = s.map
  m.onBeforeCompile = (sh) => {
    sh.uniforms.soilMap = { value: soil }
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float soil;\nvarying float vSoil;\nvarying vec2 vWuv;')
      .replace('#include <uv_vertex>', '#include <uv_vertex>\nvSoil = soil;\nvWuv = (modelMatrix * vec4(position, 1.0)).xz;')
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform sampler2D soilMap;\nvarying float vSoil;\nvarying vec2 vWuv;')
      .replace('#include <map_fragment>', `
        vec4 gA = texture2D(map, vWuv / 9.0);
        vec4 gB = texture2D(map, vWuv / 61.0);
        vec4 sA = texture2D(soilMap, vWuv / 7.0);
        vec3 grassC = mix(gA.rgb, gB.rgb, 0.45);
        diffuseColor.rgb *= mix(grassC, sA.rgb, clamp(vSoil, 0.0, 1.0));`)
  }
  m.customProgramCacheKey = () => 'bridge.splat'
  return m
}

/** Heightfield mesh -> Mesh (merged quads, ~65k verts) */
function heightfield() {
  const xs = axis(220, 4, 3200)
  const zs = axis(160, 4, 3200)
  const nx = xs.length
  const nz = zs.length
  const pos = new Float32Array(nx * nz * 3)
  const col = new Float32Array(nx * nz * 3)
  const soil = new Float32Array(nx * nz)
  const uv = new Float32Array(nx * nz * 2)
  const c = new THREE.Color()
  for (let j = 0; j < nz; j++) {
    for (let i = 0; i < nx; i++) {
      const x = xs[i]
      const z = zs[j]
      const y = groundY(x, z)
      const k = j * nx + i
      pos.set([x, y, z], k * 3)
      uv.set([x / 8, z / 8], k * 2)
      const dx = groundY(x + 2, z) - groundY(x - 2, z)
      const slope = Math.min(1, Math.abs(dx) / 2.5)
      // soil: river bed + wet bank, steep bluff, worn site pads near the bridge
      const bed = 1 - sm(WATER - 0.2, WATER + 1.4, y)
      const site = (1 - sm(40, 90, Math.abs(z))) * (1 - sm(380, 520, Math.abs(x)))
      soil[k] = Math.min(1, bed + slope * 0.7 + site * 0.55 + (Math.sin(x * 0.07) * Math.sin(z * 0.05) > 0.55 ? 0.3 : 0))
      // tint: wet mud darker, distant hills bluer / darker, dry patches
      const far = sm(500, 2200, Math.hypot(x, z))
      c.setRGB(1, 1, 1).multiplyScalar(0.92 + Math.sin(x * 0.013 + z * 0.021) * 0.08)
      if (y < WATER + 0.6) c.multiplyScalar(0.62)
      c.lerp(new THREE.Color(0.62, 0.7, 0.66), far * 0.55)
      col.set([c.r, c.g, c.b], k * 3)
    }
  }
  const idx = []
  for (let j = 0; j < nz - 1; j++) for (let i = 0; i < nx - 1; i++) {
    const a = j * nx + i
    idx.push(a, a + nx, a + 1, a + 1, a + nx, a + nx + 1)
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  g.setAttribute('color', new THREE.BufferAttribute(col, 3))
  g.setAttribute('soil', new THREE.BufferAttribute(soil, 1))
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
  g.setIndex(idx)
  g.computeVertexNormals()
  const m = new THREE.Mesh(g, splatMaterial())
  m.receiveShadow = true
  m.name = 'bridge.ground'
  return m
}

/** tileable ripple normal map (two octaves of value noise -> normals) */
function rippleNormals() {
  const S = 256
  const a = fbm(S, { scale: 8, octaves: 4, seed: 901 })
  const b = fbm(S, { scale: 24, octaves: 2, seed: 902 })
  const h = new Float32Array(S * S)
  for (let i = 0; i < h.length; i++) h[i] = a[i] * 0.7 + b[i] * 0.3
  const t = new THREE.CanvasTexture(normalFromHeight(h, S, 9))
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  return t
}

/** rounded rect path (centre cx, cz; size w x d; corner r) in shape space (x, -z) */
function roundRect(path, cx, cz, w, d, r, hole = false) {
  const pts = []
  const q = [[w / 2 - r, d / 2 - r, 0], [-(w / 2 - r), d / 2 - r, PI2], [-(w / 2 - r), -(d / 2 - r), PI2 * 2], [w / 2 - r, -(d / 2 - r), PI2 * 3]]
  for (const [ox, oz, a0] of q) for (let k = 0; k <= 6; k++) { const a = a0 + (k / 6) * PI2; pts.push([cx + ox + Math.cos(a) * r, cz + oz + Math.sin(a) * r]) }
  if (hole) pts.reverse()
  pts.forEach(([x, z], i) => (i ? path.lineTo(x, -z) : path.moveTo(x, -z)))
  path.closePath()
  return path
}
const PI2 = Math.PI / 2
export { roundRect }

/** River surface with holes at the two cofferdams. Returns the Water mesh */
function river(quality) {
  const s = new THREE.Shape()
  s.moveTo(-132, 3400); s.lineTo(132, 3400); s.lineTo(132, -3400); s.lineTo(-132, -3400); s.closePath()
  for (const x of [-MP, MP]) s.holes.push(roundRect(new THREE.Path(), x, 0, COFFER.w - 0.6, COFFER.d - 0.6, 4, true))
  const geo = new THREE.ShapeGeometry(s, 4)
  const hi = quality !== 'low'
  const water = new Water(geo, {
    textureWidth: hi ? 1024 : 256, textureHeight: hi ? 1024 : 256, waterNormals: rippleNormals(),
    sunDirection: new THREE.Vector3(0.5, 0.7, 0.3), sunColor: '#fff3e0', waterColor: '#2c3a2c', distortionScale: 2.4, fog: true, clipBias: 0.002
  })
  water.material.uniforms.size.value = 3.2
  water.rotation.x = -Math.PI / 2
  water.position.y = WATER
  water.receiveShadow = true
  water.name = 'bridge.river'
  // the mirror pass is a full scene render: skip it for GTAO / thumbnail override passes
  const draw = water.onBeforeRender
  water.onBeforeRender = (r, sc, cam) => { if (!sc.overrideMaterial) draw(r, sc, cam) }
  return water
}

/** foam alpha texture: streaky blobs, scrolled along the flow */
function foamTexture() {
  const S = 256
  const n = fbm(S, { scale: 6, octaves: 4, seed: 911 })
  const f = fbm(S, { scale: 30, octaves: 2, seed: 912 })
  const c = makeCanvas(S)
  const g = c.getContext('2d')
  const img = g.createImageData(S, S)
  for (let i = 0; i < S * S; i++) {
    const v = Math.max(0, Math.min(1, (n[i] * 0.6 + f[i] * 0.4 - 0.48) * 4))
    img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v * 255
    img.data[i * 4 + 3] = 255
  }
  g.putImageData(img, 0, 0)
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  return t
}

/** strip along a polyline: pts [[x, z]], width w toward side (+1 shore), alpha fades across */
function stripGeo(pts, w, side, y, a0 = 0.9, a1 = 0) {
  const p = []; const uv = []; const col = []; const idx = []
  let acc = 0
  pts.forEach(([x, z], i) => {
    const [px, pz] = pts[Math.max(0, i - 1)]
    const [qx, qz] = pts[Math.min(pts.length - 1, i + 1)]
    let tx = qx - px; let tz = qz - pz
    const L = Math.hypot(tx, tz) || 1
    tx /= L; tz /= L
    if (i) acc += Math.hypot(x - pts[i - 1][0], z - pts[i - 1][1])
    const nx = -tz * side; const nz = tx * side
    p.push(x - nx * w * 0.35, y, z - nz * w * 0.35, x + nx * w * 0.65, y, z + nz * w * 0.65)
    uv.push(0, acc / 14, w / 14, acc / 14)
    col.push(1, 1, 1, a1, 1, 1, 1, a0)
    if (i) { const o = (i - 1) * 2; idx.push(o, o + 1, o + 2, o + 1, o + 3, o + 2) }
  })
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 4))
  g.setIndex(idx)
  g.setAttribute('normal', new THREE.Float32BufferAttribute(p.map((_, i) => (i % 3 === 1 ? 1 : 0)), 3))
  return g
}

/** waterline x on one bank at z (bisection on groundY = WATER) */
function shoreX(z, side) {
  let a = 60 * side
  let b = 145 * side
  for (let k = 0; k < 24; k++) {
    const m = (a + b) / 2
    if (groundY(m, z) > WATER) b = m
    else a = m
  }
  return (a + b) / 2
}

/** foam: bank lines, cofferdam rings + downstream wakes (one transparent draw) */
function foam() {
  const geos = []
  const y = WATER + 0.03
  for (const side of [1, -1]) {
    const pts = []
    for (let z = -1400; z <= 1400; z += 6) pts.push([shoreX(z, side), z])
    geos.push(stripGeo(pts, 7, -side, y, 0.75, 0))
  }
  for (const x of [-MP, MP]) {
    // ring hugging the sheet piles (polyline around the rounded rect), then a wake tail
    const ring = []
    const W = COFFER.w / 2 + 0.4
    const D = COFFER.d / 2 + 0.4
    for (let k = 0; k <= 64; k++) { const a = (k / 64) * Math.PI * 2; const c = Math.cos(a); const s = Math.sin(a); ring.push([x + Math.sign(c) * Math.pow(Math.abs(c), 0.35) * W, Math.sign(s) * Math.pow(Math.abs(s), 0.35) * D]) }
    geos.push(stripGeo(ring, 5, 1, y, 0.9, 0))
    for (const s of [-1, 1]) {
      const tail = []
      for (let z = D - 2; z <= D + 150; z += 5) tail.push([x + s * (W - 3 + (z - D) * 0.06), z])
      geos.push(stripGeo(tail, 6, s, y, 0.55, 0))
    }
  }
  const g = mergeGeometries(geos.map((q) => q.toNonIndexed()))
  const m = new THREE.MeshStandardMaterial({ color: '#d9ddd6', alphaMap: foamTexture(), vertexColors: true, transparent: true, depthWrite: false, roughness: 0.9, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2 })
  m.name = 'bridge.foam'
  const mesh = new THREE.Mesh(g, m)
  mesh.renderOrder = 2
  mesh.receiveShadow = true
  mesh.name = 'bridge.foam'
  return mesh
}

/** concrete revetment blocks on both banks near the bridge (follow the ground) */
function revetment() {
  const geos = []
  for (const side of [1, -1]) {
    for (let z = -260; z < 260; z += 4) {
      const g = new THREE.PlaneGeometry(1, 1, 1, 1)
      const p = g.attributes.position
      const xa = shoreX(z, side) - side * 3
      const xb = side * 142
      const quad = [[xa, z], [xb, z], [xa, z + 4], [xb, z + 4]]
      quad.forEach(([qx, qz], i) => p.setXYZ(i, qx, groundY(qx, qz) + 0.06, qz))
      const uv = g.attributes.uv
      quad.forEach(([qx, qz], i) => uv.setXY(i, qx / 6, qz / 6))
      geos.push(g)
    }
  }
  const g = mergeGeometries(geos)
  g.computeVertexNormals()
  const n = g.attributes.normal
  for (let i = 0; i < n.count; i++) if (n.getY(i) < 0) n.setXYZ(i, -n.getX(i), -n.getY(i), -n.getZ(i))
  const m = new THREE.Mesh(g, surfaceMat('paving', 1, '#a9a69e'))
  m.material.side = THREE.DoubleSide
  m.receiveShadow = true
  m.name = 'bridge.revetment'
  return m
}

/** distant skyline on the east bank (facade material borrowed from the stock surroundings) */
function skyline(facade) {
  const rng = createRng(4407)
  const geos = []
  for (let i = 0; i < 90; i++) {
    const x = rng.range(560, 1500) * (rng.chance(0.85) ? 1 : -1)
    const z = rng.range(-900, 700)
    if (x < 0 && Math.abs(z) < 400) continue
    const w = rng.range(18, 40)
    const d = rng.range(18, 34)
    const h = rng.chance(0.2) ? rng.range(70, 140) : rng.range(18, 54)
    const g = new THREE.BoxGeometry(w, h, d)
    g.translate(x, groundY(x, z) + h / 2 - 1, z)
    const uv = g.attributes.uv
    // faces: +x,-x (d wide), +y,-y, +z,-z (w wide); 24 m facade tile
    for (let f = 0; f < 6; f++) {
      const fw = f < 2 ? d : w
      const u0 = rng.int(0, 7) / 8
      for (let k = 0; k < 4; k++) uv.setXY(f * 4 + k, u0 + uv.getX(f * 4 + k) * fw / 24, f === 2 || f === 3 ? 0 : uv.getY(f * 4 + k) * h / 24)
    }
    const c = new THREE.Color().setHSL(0.08 + rng.range(-0.04, 0.05), 0.08, rng.range(0.62, 0.86))
    g.setAttribute('color', new THREE.Float32BufferAttribute(new Array(24).fill(0).flatMap(() => [c.r, c.g, c.b]), 3))
    geos.push(g)
  }
  const m = new THREE.Mesh(mergeGeometries(geos), facade)
  m.name = 'bridge.skyline'
  return m
}

/**
 * Build the landscape into `root`. Returns { water, update(dt, sunDir, sunColor, sunI) }.
 * facade: night-lit window material (or null)
 */
export function buildLandscape(root, { quality = 'high', facade = null } = {}) {
  root.add(heightfield())
  const water = river(quality)
  root.add(water)
  const f = foam()
  root.add(f, revetment())
  if (facade) root.add(skyline(facade))
  const am = f.material.alphaMap
  am.repeat.set(1, 1)
  return {
    water,
    update(dt, sun, sunColor, k) {
      const u = water.material.uniforms
      u.time.value += dt * 0.55
      if (sun) u.sunDirection.value.copy(sun).normalize()
      if (sunColor) u.sunColor.value.copy(sunColor).multiplyScalar(Math.max(0.05, k))
      u.waterColor.value.setRGB(0.11, 0.15, 0.12).multiplyScalar(0.15 + 0.85 * k)
      am.offset.y -= dt * 0.035
    }
  }
}
export { YARD }
