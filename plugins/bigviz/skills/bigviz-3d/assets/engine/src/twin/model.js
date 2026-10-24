// Twin model: an entity tree built from the live scene so devices can attach to anything.
//   site -> building -> floor -> room / corridor / columns / slab / facade
//        -> entity (vehicle, machine, person, prop) -> component (rig part: tc.slew, hoist.cage)
//        -> zone (fixed point from scene config)
// Ids are stable and derived from scene data: 'tower', 'tower.F3', 'tower.F3.N1', 'tc.hook',
// 'zone.office'. Paths join short segments: 'site/tower/F3/N1'.

import * as THREE from 'three'
import { planFloor, buildFloorInterior } from './interior.js'

const PART_CN = { slew: '回转', trolley: '小车', hook: '吊钩', cargo: '吊物', top: '塔顶', cage: '轿厢', mast: '标准节', boom: '大臂', arm: '小臂', bucket: '铲斗', drum: '罐体', forks: '货叉', head: '头部' }
const SIDE_CN = ['南立面', '东立面', '北立面', '西立面']
const KIND = { walker: 'person', vehicle: 'vehicle', machine: 'machine', prop: 'prop' }

export class TwinModel {
  /** @param {object} engine  @param {{ zones?: object[], interior?: object }} cfg */
  constructor(engine, cfg = {}) {
    this.E = engine
    this.cfg = cfg
    this.nodes = new Map()
    this.byPath = new Map()
    this.interiors = []
    this.building = null
    this.root = this._node({ id: 'site', seg: 'site', kind: 'site', name: engine.scene?.meta?.title || 'site' }, null)
    for (const e of engine.world.all()) if (e.kind !== 'bucket' && e.kind !== 'ground') this._entity(e)
    for (const z of cfg.zones || []) this._node({ id: z.id, seg: z.id, kind: 'zone', name: z.name || z.id, pos: new THREE.Vector3(z.x ?? 0, z.y ?? 0, z.z ?? 0) }, this.root)
  }

  _node(n, parent) {
    if (this.nodes.has(n.id)) return this.nodes.get(n.id)
    n.parent = parent
    n.children = []
    n.path = parent ? `${parent.path}/${n.seg}` : n.seg
    if (parent) parent.children.push(n)
    this.nodes.set(n.id, n)
    this.byPath.set(n.path, n)
    if (n.obj && n.tag !== false && !n.obj.userData.twinId) n.obj.userData.twinId = n.id
    return n
  }

  get(id) {
    return this.nodes.get(id)
  }

  /** lookup by id or path ('site/tower/F3') */
  find(ref) {
    return this.nodes.get(ref) || this.byPath.get(ref) || null
  }

  _entity(e) {
    const kind = e.prefab === 'building' ? 'building' : KIND[e.kind] || 'entity'
    const n = this._node({ id: e.id, seg: e.id, kind, name: e.name || e.id, entity: e, obj: e.object3d, tag: false }, this.root)
    if (kind === 'building') return this._building(n, e)
    // rig parts that are scene objects become attachable components
    for (const [k, o] of Object.entries(e.rig || {})) {
      if (!o?.isObject3D || o === e.object3d || k === 'root') continue
      this._node({ id: `${e.id}.${k}`, seg: k, kind: 'component', name: `${e.name} · ${PART_CN[k] || k}`, entity: e, obj: o, tag: false }, n)
    }
  }
  _building(bn, e) {
    const r = e.rig
    this.building = bn
    bn.rig = r
    const id = e.id
    const part = (k, name, obj, extra = {}) => obj && this._node({ id: `${id}.${k}`, seg: k, kind: 'component', name, entity: e, obj, ...extra }, bn)
    part('found', '基础筏板', r.found)
    part('core', '核心筒', r.core)
    part('scaffold', '外脚手架', r.scaffold, { shown: () => r.scaffold.count > 0 })
    part('net', '安全网', r.net, { shown: () => r.net.count > 0 })
    part('roof', '屋面设备', r.roof)
    part('lobby', '入口门厅', r.lobby)
    // working deck: follows the floor under construction
    part('deck', '作业面', r.deck, { tag: false })
    const core = r.core ? { x: r.core.position.x, z: r.core.position.z, w: 4.2, d: 5 } : undefined
    const names = this.cfg.interior
    r.floors.forEach((F, f) => {
      const fid = `${id}.F${f + 1}`
      const fn = this._node({ id: fid, seg: `F${f + 1}`, kind: 'floor', name: `${f + 1} 层`, entity: e, obj: F.g, floor: f }, bn)
      const sub = (k, name, obj, extra = {}) => this._node({ id: `${fid}.${k}`, seg: k, kind: 'component', name: `${f + 1}F ${name}`, entity: e, obj, floor: f, ...extra }, fn)
      sub('columns', '柱', F.cols)
      sub('slab', '楼板', F.slab)
      F.facade.forEach((g, i) => {
        const n = sub(`facade${i}`, SIDE_CN[i] || `立面${i}`, g)
        if (F.glass[i]) F.glass[i].userData.twinId = n.id
      })
      // interior rooms (geometry hidden until the floor is entered)
      const plan = planFloor({ W: r.W, D: r.D, core, names: names || undefined, floor: f })
      const built = buildFloorInterior(plan, (k) => `${fid}.${k}`)
      F.g.add(built.group)
      this.interiors[f] = { plan, ...built }
      for (const room of [...plan.rooms, plan.corridor]) {
        const m = built.rooms.get(room.key)
        sub(room.key, room.name, m, { kind: room.kind === 'corridor' ? 'corridor' : 'room', room, tag: false })
      }
    })
  }

  /** world position of a node (+ local offset in the host frame) */
  worldPos(node, offset, out = new THREE.Vector3()) {
    if (!node) return out.set(0, 0, 0)
    if (offset) out.set(offset[0] || 0, offset[1] || 0, offset[2] || 0)
    else out.set(0, 0, 0)
    if (node.obj) {
      node.obj.updateWorldMatrix(true, false)
      return out.applyMatrix4(node.obj.matrixWorld)
    }
    if (node.pos) return out.add(node.pos)
    return out
  }

  /** effective visibility: object + ancestors visible, entity active, custom shown() */
  shown(node) {
    if (!node) return false
    if (node.shown && !node.shown()) return false
    const e = node.entity
    if (e && (e.active === false || e.hiddenByAgent)) return false
    for (let o = node.obj; o; o = o.parent) if (!o.visible) return false
    return true
  }

  /** nearest floor / building ancestors */
  floorOf(node) {
    let floor = null
    for (let n = node; n; n = n.parent) {
      if (!floor && n.kind === 'floor') floor = n
      if (n.kind === 'building') return { building: n, floor }
    }
    return { building: null, floor }
  }

  *descendants(node) {
    yield node
    for (const c of node.children) yield* this.descendants(c)
  }

  /** scene object -> most specific twin node (walks up userData.twinId / entityId) */
  resolveHit(obj) {
    for (let o = obj; o; o = o.parent) {
      if (o.userData.twinId && this.nodes.has(o.userData.twinId)) return this.nodes.get(o.userData.twinId)
      if (o.userData.entityId && this.nodes.has(o.userData.entityId)) return this.nodes.get(o.userData.entityId)
    }
    return null
  }

  /** ids of node + descendants (for "devices on this component") */
  subtreeIds(node) {
    return [...this.descendants(node)].map((n) => n.id)
  }
}