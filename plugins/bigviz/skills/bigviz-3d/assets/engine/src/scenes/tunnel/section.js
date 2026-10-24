// Tunnel pack - section view: an engineering cut-away of the mountain above YCUT over both
// tubes. One clip box (intersection of 6 planes, always installed so toggling never
// recompiles shaders: "off" just moves the top plane out of reach), plus solid caps so the
// cut reads as rock: the horizontal cap with the tube openings (rebuilt per frame from the
// tunnel state) and the four box walls following the terrain.

import * as THREE from 'three'
import { PZ, XL, XR, YCUT, OFF, halfWidth, crownY, heightAt, profile } from './geom.js'
import { capMat } from './mats.js'

export const BOX = { x0: -42, x1: 42, z0: PZ - 165, z1: PZ - 2 }
const OFFY = 1e6

export class Section {
  constructor(root) {
    this.root = root
    this.on = false
    const B = BOX
    // three.js discards the negative side (n.p + c < 0); with clipIntersection only where a
    // fragment is on the negative side of all six, i.e. inside the box
    this.planes = [
      new THREE.Plane(new THREE.Vector3(-1, 0, 0), B.x0),
      new THREE.Plane(new THREE.Vector3(1, 0, 0), -B.x1),
      new THREE.Plane(new THREE.Vector3(0, 0, -1), B.z0),
      new THREE.Plane(new THREE.Vector3(0, 0, 1), -B.z1),
      new THREE.Plane(new THREE.Vector3(0, -1, 0), OFFY),
      new THREE.Plane(new THREE.Vector3(0, 1, 0), -5000)
    ]
    this.group = new THREE.Group()
    this.group.name = 'section'
    this.group.visible = false
    this.mat = capMat().clone()
    this.mat.userData.noClip = true
    this.mat.side = THREE.DoubleSide
    this.group.add(this._walls())
    this._cap()
    root.add(this.group)
  }

  /** install the clip planes on every material under the world root (idempotent) */
  apply(root = this.root) {
    root.traverse((o) => {
      if (!o.material) return
      for (const m of [].concat(o.material)) {
        if (!m || m.userData.noClip || m.clippingPlanes === this.planes) continue
        m.clippingPlanes = this.planes
        m.clipIntersection = true
        m.clipShadows = true
        m.needsUpdate = true
      }
    })
  }

  set(on) {
    this.on = on
    this.planes[4].constant = on ? YCUT : OFFY
    this.group.visible = on
  }

  // horizontal cap: z bands split at every zone change, each band minus the tube openings
  _cap() {
    const MAXQ = 256
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MAXQ * 18), 3))
    g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(MAXQ * 18).map((_, i) => (i % 3 === 1 ? 1 : 0)), 3))
    g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(MAXQ * 12), 2))
    g.setDrawRange(0, 0)
    this.cap = new THREE.Mesh(g, this.mat)
    this.cap.name = 'section.cap'
    this.cap.frustumCulled = false
    this.cap.receiveShadow = true
    this.group.add(this.cap)
    this.maxQ = MAXQ
  }

  /** state: tunnelState(day); rebuild the cap openings */
  update(state) {
    if (!this.on) return
    const y = YCUT
    const wl = halfWidth(OFF.lining, y) + 0.02
    const ws = halfWidth(OFF.shot, y) + 0.04
    const wr = halfWidth(OFF.rock, y) + 0.12
    const tubes = [
      { x: XL, z: [[0, state.L.lined, wl], [state.L.lined, state.L.shot, ws], [state.L.shot, state.L.face, wr]] },
      { x: XR, z: [[0, state.R.lined, wl], [state.R.lined, state.R.shot, ws], [state.R.shot, state.R.face, wr]] }
    ]
    const cuts = new Set([BOX.z0, BOX.z1])
    for (const t of tubes) for (const [a, b] of t.z) { cuts.add(PZ - a); cuts.add(PZ - b) }
    const zs = [...cuts].filter((z) => z >= BOX.z0 && z <= BOX.z1).sort((a, b) => a - b)
    const pos = this.cap.geometry.attributes.position.array
    const uv = this.cap.geometry.attributes.uv.array
    let q = 0
    const quad = (x0, x1, z0, z1) => {
      if (x1 - x0 < 0.01 || q >= this.maxQ) return
      const v = [[x0, z0], [x0, z1], [x1, z1], [x0, z0], [x1, z1], [x1, z0]]
      v.forEach(([x, z], k) => { const o = q * 18 + k * 3; pos[o] = x; pos[o + 1] = y; pos[o + 2] = z; uv[q * 12 + k * 2] = x / 5; uv[q * 12 + k * 2 + 1] = z / 5 })
      q++
    }
    for (let i = 0; i < zs.length - 1; i++) {
      const z0 = zs[i], z1 = zs[i + 1], zm = (z0 + z1) / 2, s = PZ - zm
      const holes = []
      for (const t of tubes) for (const [a, b, w] of t.z) if (s > a && s < b) holes.push([t.x - w, t.x + w])
      holes.sort((a, b) => a[0] - b[0])
      let x = BOX.x0
      for (const [a, b] of holes) { quad(x, a, z0, z1); x = b }
      quad(x, BOX.x1, z0, z1)
    }
    this.cap.geometry.setDrawRange(0, q * 6)
    this.cap.geometry.attributes.position.needsUpdate = true
    this.cap.geometry.attributes.uv.needsUpdate = true
  }

  // box walls from YCUT up to the terrain (front wall leaves the lining rings open)
  _walls() {
    const pos = []
    const uv = []
    const push = (a, b, c, d) => {
      for (const p of [a, b, c, a, c, d]) { pos.push(...p); uv.push((p[0] + p[2]) / 5, p[1] / 5) }
    }
    const top = (x, z) => Math.max(YCUT, heightAt(x, z))
    const step = 1
    for (const x of [BOX.x0, BOX.x1]) for (let z = BOX.z0; z < BOX.z1; z += step) {
      const z1 = Math.min(BOX.z1, z + step)
      push([x, YCUT, z], [x, YCUT, z1], [x, top(x, z1), z1], [x, top(x, z), z])
    }
    for (let x = BOX.x0; x < BOX.x1; x += step) {
      const x1 = x + step
      push([x, YCUT, BOX.z0], [x1, YCUT, BOX.z0], [x1, top(x1, BOX.z0), BOX.z0], [x, top(x, BOX.z0), BOX.z0])
    }
    // front wall: bottom follows the lining intrados inside each tube (the ring stays open)
    const zf = BOX.z1
    const bottom = (x) => {
      for (const xp of [XL, XR]) { const c = crownY(OFF.lining, x - xp); if (c > YCUT) return c }
      return YCUT
    }
    for (let x = BOX.x0; x < BOX.x1 - 1e-6; x += 0.25) {
      const x1 = x + 0.25
      push([x, bottom(x), zf], [x1, bottom(x1), zf], [x1, top(x1, zf), zf], [x, top(x, zf), zf])
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
    g.computeVertexNormals()
    const m = new THREE.Mesh(g, this.mat)
    m.name = 'section.walls'
    m.receiveShadow = true
    m.castShadow = false
    return m
  }
}

export { profile }
