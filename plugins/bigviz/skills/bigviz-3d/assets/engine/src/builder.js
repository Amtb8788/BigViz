// SceneBuilder: turns a scene pack (pure data + small functions) into the live world:
// desk, terrain block (with pits and a soil cross-section), ground layers, roads with
// markings, baked prop buckets, entities (prefab + life + drive + agent), named places.

import * as THREE from 'three'
import { buildDesk } from './render/desk.js'
import { buildSurroundings } from './render/surroundings.js'
import { surfaceMat, mat } from './render/materials.js'
import { makeCanvas } from './render/textures.js'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { bake } from './prefabs/kit.js'
import { makePrefab, PREFABS } from './prefabs/index.js'
import { RoadGraph } from './systems/roads.js'
import { TrafficSystem } from './systems/traffic.js'
import { dressTraffic, applyLamps } from './prefabs/traffic.js'
import './systems/traffic-steps.js'
import { snowable } from './systems/weather.js'
import { createRng } from './core/rng.js'

function strataMaterial() {
  const c = makeCanvas(64, 256)
  const g = c.getContext('2d')
  const bands = [['#5c7a3a', 10], ['#5a4330', 40], ['#7a5a3c', 60], ['#8b6b45', 50], ['#6d5137', 50], ['#9a8a70', 46]]
  let y = 0
  for (const [col, h] of bands) { g.fillStyle = col; g.fillRect(0, y, 64, h); y += h }
  for (let i = 0; i < 400; i++) { g.fillStyle = `rgba(0,0,0,${Math.random() * 0.2})`; g.fillRect(Math.random() * 64, Math.random() * 256, 2, 2) }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.wrapS = THREE.RepeatWrapping
  return new THREE.MeshStandardMaterial({ map: t, roughness: 0.95 })
}

/** world-xz planar UVs (metres / tile) so overlapping strips line up */
function planarUV(geo, tile = 8) {
  const p = geo.attributes.position
  const uv = new Float32Array(p.count * 2)
  for (let i = 0; i < p.count; i++) { uv[i * 2] = p.getX(i) / tile; uv[i * 2 + 1] = p.getZ(i) / tile }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
  return geo
}

function rectShape(x, z, w, d) {
  const s = new THREE.Shape()
  s.moveTo(x - w / 2, -(z - d / 2))
  s.lineTo(x + w / 2, -(z - d / 2))
  s.lineTo(x + w / 2, -(z + d / 2))
  s.lineTo(x - w / 2, -(z + d / 2))
  s.closePath()
  return s
}

function rectPath(x, z, w, d) {
  const p = new THREE.Path()
  p.moveTo(x - w / 2, -(z - d / 2))
  p.lineTo(x - w / 2, -(z + d / 2))
  p.lineTo(x + w / 2, -(z + d / 2))
  p.lineTo(x + w / 2, -(z - d / 2))
  p.closePath()
  return p
}

/** Flat slab (top at y) from a rect, optional rect holes; returns a Mesh */
function slab({ x = 0, z = 0, w, d, holes = [], y = 0.02, t = 0.04 }, material) {
  const s = rectShape(x, z, w, d)
  for (const h of holes) s.holes.push(rectPath(h.x, h.z, h.w, h.d))
  const g = new THREE.ExtrudeGeometry(s, { depth: t, bevelEnabled: false })
  g.rotateX(-Math.PI / 2)
  g.translate(0, y - t, 0)
  planarUV(g, 8)
  const m = new THREE.Mesh(g, material)
  m.receiveShadow = true
  return m
}

const MATS = {
  asphalt: () => surfaceMat('asphalt', 1),
  concrete: () => surfaceMat('concrete', 1),
  soil: () => surfaceMat('soil', 1),
  grass: () => surfaceMat('grass', 1),
  paving: () => surfaceMat('paving', 1),
  gravel: () => mat('gravel'),
  sand: () => mat('sand')
}
const groundMat = (name) => (MATS[name] ? MATS[name]() : mat(name))

const PHASE_LABEL = { NS_GREEN: '南北绿灯', NS_YELLOW: '南北黄灯', EW_GREEN: '东西绿灯', EW_YELLOW: '东西黄灯', WALK: '行人通行', PED_CLEAR: '行人清空', ALL_RED_1: '全红', ALL_RED_2: '全红', ALL_RED_3: '全红' }
const signalStatus = (c) => (c.mode === 'flash' ? '黄闪' : c.mode === 'off' ? '关闭' : `${PHASE_LABEL[c.phase] || c.phase} ${Math.ceil(c.remaining)}s${c.mode === 'manual' ? ' · 手动' : ''}`)

export class SceneBuilder {
  constructor(engine) {
    this.E = engine
    this.root = engine.stage.root
    this.buckets = new Map()
    this.places = new Map()
  }

  build(scene) {
    const E = this.E
    const rng = createRng(scene.meta.seed || 1)
    // diorama: desk + plinth; realistic: real-scale city ground out to the horizon
    if (E.stage.style.desk) E.stage.scene.add(buildDesk({ ...scene.desk, board: scene.board }).group)
    else E.stage.scene.add(buildSurroundings({ board: scene.board, roads: scene.roads, seed: scene.meta?.seed }))
    this._terrain(scene)
    for (const l of scene.ground || []) this._layer(l)
    if (scene.roads) {
      E.roads = new RoadGraph(scene.roads)
      this._roads(scene.roads)
      if (scene.roads.signals?.length) this._traffic(scene)
    }
    for (const [id, p] of Object.entries(scene.places || {})) this.places.set(id, p)
    for (const p of scene.props || []) this._prop(p, rng)
    for (const [id, b] of this.buckets) this._finishBucket(id, b, scene.buckets?.[id])
    for (const e of scene.entities || []) this.addEntity(e)
    // snow cover on everything opaque and plain-coloured
    E.stage.scene.traverse((o) => {
      if (!o.isMesh || o.isPoints) return
      for (const m of [].concat(o.material)) if (m?.isMeshStandardMaterial && !m.transparent && m.emissiveIntensity < 0.5) snowable(m)
    })
    for (const n of ['asphalt', 'concrete', 'paving']) E.weather.addWet(surfaceMat(n, 1))
    E.weather.addWet(surfaceMat('paving', 2))
    E.glows.flush()
  }

  _terrain(scene) {
    const { w, d } = scene.board
    const t = scene.terrain || {}
    const s = rectShape(0, 0, w, d)
    for (const p of t.pits || []) s.holes.push(rectPath(p.x, p.z, p.w, p.d))
    const g = new THREE.ExtrudeGeometry(s, { depth: 3, bevelEnabled: false })
    g.rotateX(-Math.PI / 2)
    g.translate(0, -3, 0)
    // cap: planar uv; sides: (length along edge, depth) for the strata texture
    const p = g.attributes.position
    const uv = g.attributes.uv
    for (const grp of g.groups) {
      for (let i = grp.start; i < grp.start + grp.count; i++) {
        if (grp.materialIndex === 0) uv.setXY(i, p.getX(i) / 8, p.getZ(i) / 8)
        else uv.setXY(i, uv.getX(i) / 8, (p.getY(i) + 3) / 3)
      }
    }
    const top = surfaceMat(t.surface || 'grass', 1)
    const mesh = new THREE.Mesh(g, [top, strataMaterial()])
    mesh.receiveShadow = true
    mesh.name = 'terrain'
    this.root.add(mesh)
    for (const p2 of t.pits || []) {
      const floor = new THREE.Mesh(planarUV(new THREE.PlaneGeometry(p2.w, p2.d).rotateX(-Math.PI / 2), 8), surfaceMat('soil', 1))
      floor.position.set(p2.x, -0.05, p2.z)
      floor.receiveShadow = true
      this.root.add(floor)
      if (p2.id) this.E.world.add({ id: p2.id, kind: 'terrain', name: '基坑', object3d: floor, drive: p2.drive, life: null })
      if (p2.drive) this.E.drive.track(this.E.world.get(p2.id))
    }
  }

  _layer(l) {
    const material = groundMat(l.mat)
    let mesh
    if (l.type === 'frame') {
      // rectangular ring between outer (w,d) and inner (iw,id), raised (curbs / sidewalks)
      mesh = slab({ x: l.x || 0, z: l.z || 0, w: l.w, d: l.d, holes: [{ x: l.x || 0, z: l.z || 0, w: l.iw, d: l.id }, ...(l.holes || [])], y: l.y ?? 0.15, t: l.t ?? 0.15 }, material)
    } else {
      mesh = slab({ x: l.x || 0, z: l.z || 0, w: l.w, d: l.d, holes: l.holes || [], y: l.y ?? 0.02, t: l.t ?? 0.04 }, material)
    }
    mesh.name = l.id || 'ground'
    this.root.add(mesh)
    if (l.life) {
      const e = this.E.world.add({ id: l.id, kind: 'ground', name: l.name || l.id, object3d: mesh, life: { enter: 'rise', h: 0.3, ...l.life } })
      this.E.lifecycle.track(e)
    }
    return mesh
  }

  /** Asphalt strips per edge (world UVs) + dashed centre lines + scene markings */
  _roads(cfg) {
    const R = this.E.roads
    const strips = []
    const marks = []
    for (const e of R.edges) {
      if (e.surface === false) continue
      const A = R.node(e.a)
      const B = R.node(e.b)
      const len = Math.hypot(B.x - A.x, B.z - A.z)
      const w = e.width ?? (e.oneway ? e.lane * 2 + 1 : e.lane * 2 + 1.6)
      const g = new THREE.BoxGeometry(len + w, 0.06, w)
      g.rotateY(-Math.atan2(B.z - A.z, B.x - A.x))
      g.translate((A.x + B.x) / 2, (e.y ?? 0.03), (A.z + B.z) / 2)
      strips.push(planarUV(g.toNonIndexed(), 8))
      if (!e.oneway && e.dashes !== false) {
        const n = Math.floor((len - 10) / 4.5)
        for (let i = 0; i < n; i++) {
          const t = (5 + 2 + i * 4.5) / len
          const m = new THREE.BoxGeometry(2.2, 0.02, 0.16)
          m.rotateY(-Math.atan2(B.z - A.z, B.x - A.x))
          m.translate(A.x + (B.x - A.x) * t, 0.075, A.z + (B.z - A.z) * t)
          marks.push(m.toNonIndexed())
        }
      }
    }
    if (strips.length) {
      const m = new THREE.Mesh(mergeGeometries(strips), surfaceMat('asphalt', 1))
      m.receiveShadow = true
      m.name = 'roads'
      this.root.add(m)
    }
    if (marks.length) {
      const m = new THREE.Mesh(mergeGeometries(marks), mat('marking'))
      m.receiveShadow = true
      this.root.add(m)
    }
  }

  /** Signal controllers + furniture; exposes world.traffic for UI / twin bindings */
  _traffic(scene) {
    const E = this.E
    const cfg = scene.roads
    const T = new TrafficSystem(E.roads, { signals: cfg.signals, timing: cfg.signalTiming, geometry: cfg.junction }, {
      onChange: (c, from) => E.bus.emit('traffic.phase', { id: c.id, from, phase: c.phase, mode: c.mode, aspects: c.aspects() })
    })
    const { markings, junctions } = dressTraffic(E.roads, T, scene.board)
    this.root.add(markings)
    for (const { j, object, lamps } of junctions) {
      this.root.add(object)
      const ent = E.world.add({ id: j.ctl.id, kind: 'signal', name: j.ctl.name, object3d: object, tags: ['traffic', 'signal'], info: { role: '交通信号灯 · 路口控制器', desc: '机动车分相 + 行人专用相位；可由孪生层手动接管。', ring: 9 } })
      T.views.push({ ctl: j.ctl, lamps, ent })
    }
    T.sync = (t) => {
      // queue = vehicles held within 30 m of the junction
      for (const v of T.views) v.ctl.queue = 0
      for (const e of E.ctx.vehicles) {
        if (!e.agent.held) continue
        const v = T.views.find((x) => Math.hypot(x.ctl.position.x - e.agent.x, x.ctl.position.z - e.agent.z) < 30)
        if (v) v.ctl.queue++
      }
      for (const v of T.views) {
        applyLamps(v.lamps, v.ctl.aspects(), t)
        v.ent.status = signalStatus(v.ctl)
      }
    }
    T.sync(0)
    E.traffic = T
    E.world.traffic = T.api()
  }

  _bucket(id) {
    if (!this.buckets.has(id)) {
      const g = new THREE.Group()
      g.name = `props.${id}`
      this.root.add(g)
      this.buckets.set(id, g)
    }
    return this.buckets.get(id)
  }

  /** prop spec: { type, x, z, ry, y, params, bucket, at:[[x,z,ry]], line:{from,to,n}, jitter } */
  _prop(p, rng) {
    const spots = []
    if (p.at) for (const a of p.at) spots.push({ x: a[0], z: a[1], ry: a[2] ?? p.ry ?? 0 })
    else if (p.line) {
      const { from, to, n } = p.line
      for (let i = 0; i < n; i++) {
        const t = n === 1 ? 0.5 : i / (n - 1)
        spots.push({ x: from[0] + (to[0] - from[0]) * t, z: from[1] + (to[1] - from[1]) * t, ry: p.ry ?? 0 })
      }
    } else spots.push({ x: p.x || 0, z: p.z || 0, ry: p.ry || 0 })
    const bucketId = p.bucket || 'static'
    const bucket = this._bucket(bucketId)
    spots.forEach((s, i) => {
      const params = { seed: (p.seed || 1) + i, ...(p.params || {}) }
      const made = makePrefab(p.type, params)
      const o = made.object
      const j = p.jitter || 0
      o.position.set(s.x + (j ? rng.jitter(j) : 0), p.y || 0, s.z + (j ? rng.jitter(j) : 0))
      o.rotation.y = s.ry + (p.ryJitter ? rng.jitter(p.ryJitter) : 0)
      if (p.s) o.scale.setScalar(p.s)
      bucket.add(o)
      o.updateMatrixWorld(true)
      for (const gl of made.glows || []) {
        const pos = gl.pos.clone().applyMatrix4(o.matrixWorld)
        this.E.glows.add(`${gl.group}@${bucketId}`, pos, { ...gl, poolY: 0.06 })
      }
      if (made.spot && p.spot) {
        const pos = made.spot.pos.clone().applyMatrix4(o.matrixWorld)
        const tgt = new THREE.Vector3(...(p.spot.target || [pos.x, 0, pos.z]))
        this.E.env.addSpot(pos, tgt, made.spot.color)
      }
    })
  }

  _finishBucket(id, g, cfg) {
    bake(g, { colors: true })
    if (cfg?.life) {
      const e = this.E.world.add({ id: `bucket.${id}`, kind: 'bucket', name: id, object3d: g, life: { h: 3, enter: 'rise', exit: 'sink', ...cfg.life } })
      e.glowBucket = id
      this.E.lifecycle.track(e)
      this.E.glowBuckets.push(e)
    }
  }

  /**
   * entity spec: { id, prefab, params, x, z, y, ry, name, info, tags, life, drive, agent }
   */
  addEntity(spec) {
    const E = this.E
    const made = makePrefab(spec.prefab, spec.params || {})
    const o = made.object
    o.position.set(spec.x || 0, spec.y || 0, spec.z || 0)
    o.rotation.y = spec.ry || 0
    E.stage.root.add(o)
    const def = made.def || PREFABS[spec.prefab] || {}
    const e = E.world.add({
      id: spec.id,
      kind: spec.kind || def.kind,
      prefab: spec.prefab,
      name: spec.name || spec.id,
      object3d: o,
      rig: made.rig || {},
      tags: spec.tags || [],
      info: spec.info === false ? null : spec.info || { role: spec.name || spec.prefab },
      life: spec.life ? { ...spec.life } : null,
      drive: spec.drive || null,
      animator: def.animator
    })
    if (spec.agent) {
      const agent = { kind: def.kind === 'vehicle' ? 'vehicle' : def.kind === 'walker' ? 'walker' : 'machine', length: def.length, spawn: { x: spec.x || 0, z: spec.z || 0, yaw: spec.ry || 0 }, yaw: spec.ry || 0, ...spec.agent }
      e.agent = agent
      E.agents.add(e)
    }
    if (spec.drive && Object.keys(spec.drive).some((k) => k.startsWith('object.position'))) e.ownPos = true
    E.lifecycle.track(e)
    E.drive.track(e)
    E.animator.track(e)
    if (spec.prefab === 'tree' && made.rig?.canopy) E.weather.trees.push(made.rig)
    if (spec.prefab === 'building') E.building = { id: e.id, entity: e, rig: e.rig, get x() { return o.position.x }, get y() { return o.position.y }, get z() { return o.position.z }, phase: 'foundation' }
    return e
  }

  /** Resolve a place spec to { x, y, z, yaw?, onDeck? } */
  resolve(spec, e) {
    if (spec == null) return null
    if (typeof spec === 'function') return this.resolve(spec(this.E.ctx, e), e)
    if (Array.isArray(spec)) return { x: spec[0], z: spec[1], y: spec[2] ?? 0 }
    if (typeof spec === 'string') {
      if (this.places.has(spec)) return this.resolve(this.places.get(spec), e)
      if (this.E.roads?.nodes.has(spec)) { const n = this.E.roads.node(spec); return { x: n.x, z: n.z, y: 0 } }
      const ent = this.E.world.get(spec)
      if (ent) return { x: ent.object3d.position.x, z: ent.object3d.position.z, y: ent.agent?.y ?? 0 }
      console.warn(`Unknown place "${spec}"`)
      return { x: 0, z: 0, y: 0 }
    }
    const b = this.E.building
    if (spec.deck && b) {
      const r = b.rig
      const m = spec.margin ?? 1.6
      const u = spec.u ?? Math.random()
      const v = spec.v ?? Math.random()
      return { x: b.x - r.W / 2 + m + u * (r.W - 2 * m), z: b.z - r.D / 2 + m + v * (r.D - 2 * m), y: b.y + r.deckY, onDeck: true, yaw: spec.yaw }
    }
    if (spec.pour && b) {
      const r = b.rig
      return { x: b.x + Math.min(r.pourX ?? 0, spec.maxX ?? 99), z: b.z + (spec.v ?? 0.25) * r.D, y: b.y + r.deckY, onDeck: true }
    }
    if (spec.entity) {
      const t = this.E.world.get(spec.entity)
      if (!t) return null
      const o = t.object3d
      const yaw = o.rotation.y
      const ox = spec.dx || 0
      const oz = spec.dz || 0
      return { x: o.position.x + Math.cos(yaw) * ox + Math.sin(yaw) * oz, z: o.position.z - Math.sin(yaw) * ox + Math.cos(yaw) * oz, y: (t.agent?.y ?? o.position.y) + (spec.dy || 0), yaw: spec.yaw }
    }
    if (spec.area) {
      const a = typeof spec.area === 'string' ? this.places.get(spec.area) : spec.area
      return { x: a.x + (Math.random() - 0.5) * (a.w ?? a.r * 2), z: a.z + (Math.random() - 0.5) * (a.d ?? a.r * 2), y: 0, yaw: spec.yaw }
    }
    if (spec.place) {
      const p = this.resolve(spec.place, e)
      return { ...p, x: p.x + (spec.dx || 0) + (spec.jitter ? (Math.random() - 0.5) * spec.jitter : 0), z: p.z + (spec.dz || 0) + (spec.jitter ? (Math.random() - 0.5) * spec.jitter : 0), yaw: spec.yaw ?? p.yaw }
    }
    return { x: spec.x ?? 0, z: spec.z ?? 0, y: spec.y ?? 0, yaw: spec.yaw, onDeck: spec.onDeck }
  }
}
