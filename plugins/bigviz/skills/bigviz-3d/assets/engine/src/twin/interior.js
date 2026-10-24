// Building interior: per-floor room plan (pure), simple interior geometry (room floors,
// partitions with door gaps, desks) and the "enter building" controller: floor isolation,
// facade cutaway toward the camera, faded netting, camera fly-in, exit to the saved view.

import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

const DEFAULT_NAMES = { north: ['办公室', '会议室', '设备间'], core: '电梯厅', south: ['配电间', '开放办公', '茶水间', '库房'] }
const ROOM_TINTS = ['#d9d2c3', '#cfd8d2', '#d6cfd9', '#d8d4c8']

/**
 * Room layout in building-local metres (x across W, z across D, origin = building centre).
 * North strip (-z) is split into column bays, the bay holding the core becomes the lift
 * lobby; a corridor runs along x south of the core; the south strip has its own bays.
 * @returns {{ rooms: {key,name,kind,x,z,w,d}[], corridor: {x,z,w,d} }}
 */
export function planFloor({ W, D, core = { x: 0, z: 0, w: 4.2, d: 5 }, bayX = 6, names = DEFAULT_NAMES, floor = 0 }) {
  const m = 0.5
  const x0 = -W / 2 + m
  const x1 = W / 2 - m
  const z0 = -D / 2 + m
  const z1 = D / 2 - m
  const cz0 = Math.min(z1 - 3, core.z + core.d / 2 + 0.3)
  const cz1 = Math.min(z1 - 2, cz0 + 2.2)
  const corridor = { key: 'corridor', name: '走廊', kind: 'corridor', x: (x0 + x1) / 2, z: (cz0 + cz1) / 2, w: x1 - x0, d: cz1 - cz0 }
  const rooms = []
  const nb = Math.max(1, Math.round(W / bayX))
  const bw = (x1 - x0) / nb
  let ni = 0
  for (let i = 0; i < nb; i++) {
    const a = x0 + i * bw
    const isCore = core.x >= a && core.x < a + bw
    const name = isCore ? names.core : names.north[ni++ % names.north.length]
    rooms.push({ key: `N${i + 1}`, name, kind: isCore ? 'core' : 'room', x: a + bw / 2, z: (z0 + cz0) / 2, w: bw, d: cz0 - z0 })
  }
  const ns = Math.max(1, Math.round(W / (bayX * 1.25)))
  const sw = (x1 - x0) / ns
  for (let i = 0; i < ns; i++) rooms.push({ key: `S${i + 1}`, name: names.south[i % names.south.length], kind: 'room', x: x0 + i * sw + sw / 2, z: (cz1 + z1) / 2, w: sw, d: z1 - cz1 })
  for (const r of rooms) r.label = `${floor + 1}F ${r.name}`
  corridor.label = `${floor + 1}F 走廊`
  return { rooms, corridor }
}

/**
 * Camera that frames a box (floor plate) from azimuth `az` / elevation `el` (radians):
 * the distance is the smallest that keeps every corner inside `fracX` x `fracY` of the
 * frame (UI panels cover the sides) with `margin`. Pure numbers in, arrays out.
 * @returns {{ pos: number[], look: number[], dist: number }}
 */
export function framePlate({ cx, cy, cz, W, D, H = 2.4, az, el = 0.8, fov = 40, aspect = 16 / 9, fracX = 1, fracY = 1, margin = 1.08 }) {
  const o = [Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az)]
  const f = [-o[0], -o[1], -o[2]]
  const rl = Math.hypot(f[2], f[0]) || 1
  const r = [-f[2] / rl, 0, f[0] / rl] // cross(f, up)
  const u = [r[1] * f[2] - r[2] * f[1], r[2] * f[0] - r[0] * f[2], r[0] * f[1] - r[1] * f[0]]
  const tv = Math.tan((fov * Math.PI) / 360) * fracY / margin
  const th = Math.tan((fov * Math.PI) / 360) * aspect * fracX / margin
  const look = [cx, cy + H * 0.3, cz]
  let dist = 1
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) for (const y of [0, H]) {
    const p = [cx + (sx * W) / 2 - look[0], cy + y - look[1], cz + (sz * D) / 2 - look[2]]
    const dot = (a) => a[0] * p[0] + a[1] * p[1] + a[2] * p[2]
    const z = dot(f)
    dist = Math.max(dist, Math.abs(dot(r)) / th - z, Math.abs(dot(u)) / tv - z)
  }
  return { pos: look.map((v, i) => v + o[i] * dist), look, dist }
}

let _mats = null
function mats() {
  if (_mats) return _mats
  _mats = {
    rooms: ROOM_TINTS.map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.85, emissive: c, emissiveIntensity: 0.08 })),
    corridor: new THREE.MeshStandardMaterial({ color: '#b9b2a4', roughness: 0.8, emissive: '#b9b2a4', emissiveIntensity: 0.06 }),
    wall: new THREE.MeshStandardMaterial({ color: '#efe9de', roughness: 0.9 }),
    desk: new THREE.MeshStandardMaterial({ color: '#8a6a48', roughness: 0.7 }),
    kit: new THREE.MeshStandardMaterial({ color: '#4a5560', roughness: 0.6, metalness: 0.3 })
  }
  return _mats
}
const WALL_H = 2.4
const WALL_T = 0.1
const DOOR = 1.3

function boxGeo(w, h, d, x, y, z) {
  return new THREE.BoxGeometry(w, h, d).translate(x, y + h / 2, z)
}

/** wall along x from xa..xb at z, with door gaps centred at `doors` x positions */
function wallX(out, xa, xb, z, doors) {
  const cuts = doors.map((x) => [x - DOOR / 2, x + DOOR / 2]).sort((a, b) => a[0] - b[0])
  let s = xa
  for (const [a, b] of cuts) { if (a > s + 0.05) out.push(boxGeo(a - s, WALL_H, WALL_T, (s + a) / 2, 0, z)); s = Math.max(s, b) }
  if (xb > s + 0.05) out.push(boxGeo(xb - s, WALL_H, WALL_T, (s + xb) / 2, 0, z))
}

/**
 * Interior geometry for one floor, in floor-local coords (y = 0 is the floor surface).
 * @param {(key: string) => string} idOf twin node id for a room key (set on userData)
 */
export function buildFloorInterior(plan, idOf) {
  const M = mats()
  const g = new THREE.Group()
  g.name = 'interior'
  const rooms = new Map()
  const all = [...plan.rooms, plan.corridor]
  all.forEach((r, i) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(r.w - 0.08, 0.05, r.d - 0.08), r.kind === 'corridor' ? M.corridor : M.rooms[i % M.rooms.length])
    m.position.set(r.x, 0.03, r.z)
    m.receiveShadow = true
    m.userData.twinId = idOf(r.key)
    m.name = r.key
    g.add(m)
    rooms.set(r.key, m)
  })
  // partitions: corridor edges with doors, bay dividers
  const c = plan.corridor
  const north = plan.rooms.filter((r) => r.key[0] === 'N')
  const south = plan.rooms.filter((r) => r.key[0] === 'S')
  const walls = []
  wallX(walls, c.x - c.w / 2, c.x + c.w / 2, c.z - c.d / 2, north.map((r) => r.x))
  wallX(walls, c.x - c.w / 2, c.x + c.w / 2, c.z + c.d / 2, south.map((r) => r.x))
  for (const strip of [north, south]) {
    for (let i = 1; i < strip.length; i++) {
      const r = strip[i]
      walls.push(boxGeo(WALL_T, WALL_H, r.d, r.x - r.w / 2, 0, r.z))
    }
  }
  // furniture by room kind
  const desk = []
  const kit = []
  for (const r of plan.rooms) {
    if (/办公/.test(r.name)) {
      for (let k = 0; k < 4; k++) desk.push(boxGeo(1.4, 0.75, 0.7, r.x - r.w / 4 + (k % 2) * (r.w / 2), 0, r.z - r.d / 5 + Math.floor(k / 2) * (r.d / 2.5)))
    } else if (/会议/.test(r.name)) desk.push(boxGeo(r.w * 0.55, 0.75, 1.2, r.x, 0, r.z))
    else if (/设备|配电/.test(r.name)) for (let k = 0; k < 3; k++) kit.push(boxGeo(0.8, 1.9, 0.6, r.x - r.w / 2 + 0.8 + k * 1.1, 0, r.z - r.d / 2 + 0.5))
    else if (/茶水|库房/.test(r.name)) kit.push(boxGeo(r.w * 0.6, 0.9, 0.6, r.x, 0, r.z + r.d / 2 - 0.5))
  }
  const merged = (list, mat, name) => {
    if (!list.length) return
    const m = new THREE.Mesh(mergeGeometries(list, false), mat)
    m.castShadow = name !== 'walls'
    m.receiveShadow = true
    m.name = name
    g.add(m)
    list.forEach((x) => x.dispose())
  }
  merged(walls, M.wall, 'walls')
  merged(desk, M.desk, 'desks')
  merged(kit, M.kit, 'kit')
  g.visible = false
  return { group: g, rooms }
}
const _c = new THREE.Vector3()
/** section-cut height (m above the isolated floor) for columns and the core in interior view */
export const CUT_H = 1.1

/**
 * "Enter building": runs after ProgressSystem each frame (rig.setState restores the normal
 * look every frame, so isolation is a per-frame override with nothing to undo on exit).
 */
export class InteriorController {
  constructor(twin) {
    this.twin = twin
    this.E = twin.E
    this.active = false
    this.floor = 0
    this.netFade = 0.12
    this.listeners = new Set()
    // any non-twin shot (dock, director, overlay focus) leaves the interior
    this.E.camera.onChange((cam) => {
      if (this.active && cam.mode !== 'free' && !cam.shot?.twin) this.exit({ fly: false })
    })
  }

  get rig() {
    return this.E.building?.rig || null
  }

  /** floors whose structure is standing (0-based index of the highest enterable floor) */
  builtFloors() {
    const r = this.rig
    if (!r) return 0
    return Math.min(r.N, Math.floor(this.E.progress.state.floors || 0))
  }

  onChange(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn) }
  _emit() { this.listeners.forEach((f) => f(this)) }

  /** @param {number} [floor] 0-based; default = highest completed floor */
  enter(floor, { fly = true, focus = null, dist } = {}) {
    const r = this.rig
    const n = this.builtFloors()
    if (!r || n < 1) return false
    const f = Math.max(0, Math.min(n - 1, floor ?? n - 1))
    const C = this.E.camera
    if (!this.active) {
      this.saved = { pos: C.camera.position.clone(), look: C.controls.target.clone(), fov: C.camera.fov, colliders: C.colliders, minDist: C.controls.minDistance }
      C.colliders = []
      C.controls.minDistance = 4
    }
    this.active = true
    this.floor = f
    if (fly) this._fly(focus, dist)
    this._emit()
    return true
  }

  exit({ fly = true } = {}) {
    if (!this.active) return
    this.active = false
    const C = this.E.camera
    const s = this.saved
    if (s) {
      C.colliders = s.colliders
      C.controls.minDistance = s.minDist
      if (fly) {
        C.play({ id: 'twin.exit', name: '返回室外', twin: true, type: 'static', pos: s.pos.toArray(), look: s.look.toArray(), fov: s.fov }, { blend: 1.2 })
        C._afterBlend = true
      }
    }
    const r = this.rig
    if (r) r.net.material.opacity = this._netOpacity ?? r.net.material.opacity
    for (const it of this.twin.model.interiors) if (it) it.group.visible = false
    this._emit()
  }

  step(d) {
    if (!this.active) return this.enter(d > 0 ? this.builtFloors() - 1 : 0)
    return this.enter(this.floor + d)
  }

  /**
   * Dollhouse view: elevated 3/4 shot that fits the whole floor plate (from the diagonal
   * nearest the current view); with `focus`, a closer look at that point instead.
   */
  _fly(focus, dist) {
    const C = this.E.camera
    const b = this.E.building
    const r = this.rig
    const y0 = b.y + this.floor * r.FH
    const dir = C.camera.position.clone().sub(C.controls.target).setY(0)
    if (dir.lengthSq() < 1e-3) dir.set(0.6, 0, 1)
    dir.normalize()
    const fov = 40
    let pos
    let look
    if (focus) {
      look = focus.clone()
      const d = dist ?? 17
      pos = look.clone().addScaledVector(dir, d).add(new THREE.Vector3(0, d * 0.75, 0))
    } else {
      // snap to the nearest diagonal so two facades are cut and the plate reads as a plan
      const az = Math.round((Math.atan2(dir.x, dir.z) - Math.PI / 4) / (Math.PI / 2)) * (Math.PI / 2) + Math.PI / 4
      const { w, h } = this.E.stage.size
      const ui = !document.body.classList.contains('immersive')
      const fr = framePlate({ cx: b.x, cy: y0, cz: b.z, W: r.W, D: r.D, az, el: 0.82, fov, aspect: w / h || 16 / 9, fracX: ui ? 0.6 : 0.95, fracY: ui ? 0.8 : 0.95 })
      pos = new THREE.Vector3(...fr.pos)
      look = new THREE.Vector3(...fr.look)
    }
    C.play({ id: 'twin.interior', name: `楼内 ${this.floor + 1}F`, twin: true, type: 'static', pos: pos.toArray(), look: look.toArray(), fov }, { blend: 1.3 })
    C._afterBlend = true
  }
  /** per-frame isolation override (after rig.setState, before render) */
  update() {
    if (!this.active) return
    const r = this.rig
    const b = this.E.building
    if (!r) return
    const n = this.builtFloors()
    if (n < 1) return this.exit()
    if (this.floor > n - 1) { this.floor = n - 1; this._emit() }
    const f = this.floor
    // camera direction in building-local xz -> facade sides facing the camera are cut away
    r.root.updateWorldMatrix(true, false)
    _c.copy(this.E.camera.camera.position)
    r.root.worldToLocal(_c)
    r.floors.forEach((F, i) => {
      const it = this.twin.model.interiors[i]
      if (i > f) { F.g.visible = false; if (it) it.group.visible = false; return }
      if (it) it.group.visible = i === f
      if (i !== f) return
      F.slab.visible = false
      F.wet.visible = false
      F.forms.visible = false
      F.rebar.visible = false
      F.rail.visible = false
      F.interior.visible = false
      // section cut: columns become stubs (one merged mesh, so all of them, not per side)
      F.cols.scale.y = Math.min(F.cols.scale.y, CUT_H / (r.FH - 0.3))
      r.sides.forEach((s, si) => {
        const facing = Math.sin(s.ry) * (_c.x - s.x) + Math.cos(s.ry) * (_c.z - s.z) > 0
        if (facing) { F.facade[si].visible = false; F.glass[si].visible = false }
      })
    })
    // core cut at the same section height as the columns (lift lobby stays readable),
    // scaffold, netting, roof, deck clipped to the isolated floor
    const top = (f + 1) * r.FH
    r.core.scale.y = Math.min(r.core.scale.y, (f * r.FH + CUT_H) / (r.N * r.FH + 1.5))
    const sc = Math.min(r.scaffold.count / r.perFloor, f + 1)
    r.scaffold.count = sc * r.perFloor
    r.net.count = sc * r.frames.length
    if (this._netOpacity == null) this._netOpacity = r.net.material.opacity
    r.net.material.opacity = this.netFade
    r.roof.visible = false
    r.lobby.visible = r.lobby.visible && f === 0
    r.deck.visible = r.deck.visible && r.deckY <= top + 0.5
    // people / machines standing above the isolated floor (deck crew) are hidden
    const cut = b.y + top + 0.5
    for (const e of this.E.world.all()) {
      if (!e.life || !e.agent || !e.object3d.visible) continue
      if ((e.agent.onDeck || e.agent.attach) && e.object3d.position.y > cut) e.object3d.visible = false
    }
  }
}