// Digital twin layer: model (entity tree) + device registry + store (bindings / alarms)
// + adapter (mock / ws / mqtt) + markers + interior. Scenes opt in with `scene.twin`:
//   { adapter, prefix, zones, interior, bindings, devices }  (see scenes/construction/devices.js)
// Engine.load() creates it after the world is built; Engine.step() calls update() before render.

import * as THREE from 'three'
import { TwinModel } from './model.js'
import { DeviceRegistry, DEVICE_TYPES } from './devices.js'
import { TwinStore } from './bindings.js'
import { createAdapter } from './adapters/index.js'
import { DeviceMarkers } from './markers.js'
import { InteriorController } from './interior.js'
import { findSignal, readSignal, readQueue, signalPos } from './signals.js'
import { cyclePick, roomAt } from './declutter.js'

export { DEVICE_TYPES }

const _ray = new THREE.Ray()
const _m = new THREE.Matrix4()
const _hit = new THREE.Vector3()
const _floor = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.05)

export class Twin {
  /** @param {object} engine  @param {object} cfg scene.twin  @param {{ adapter?: object }} opts runtime overrides */
  constructor(engine, cfg = {}, opts = {}) {
    this.E = engine
    this.cfg = cfg
    this.model = new TwinModel(engine, cfg)
    this.registry = new DeviceRegistry()
    for (const spec of cfg.devices || []) {
      try { this.registry.add(spec) } catch (err) { console.warn('[twin]', err.message) }
    }
    for (const d of this.registry.all()) {
      if (d.attachTo && !this.model.get(d.attachTo) && d.meta.signal == null) console.warn(`[twin] device "${d.id}" attaches to unknown node "${d.attachTo}"`)
    }
    const prefix = cfg.prefix || 'site'
    this.store = new TwinStore(this.registry, { bindings: cfg.bindings, topic: `${prefix}/{device}/telemetry`, staleAfter: cfg.staleAfter ?? 0, now: () => this.E.time * 1000 })
    this.selected = null
    this.listeners = new Set()
    this.interior = new InteriorController(this)
    this.markers = new DeviceMarkers(this)
    this.store.on('alarm', (a) => {
      a.clock = engine.clock.label()
      if (a.level === 'critical') engine.log(`${a.deviceName} ${a.propName}报警`, '⚠')
    })
    const acfg = opts.adapter ?? cfg.adapter ?? { type: 'mock' }
    this.adapter = acfg === false ? null : createAdapter({ prefix, ...acfg }, { devices: this.registry.all(), live: (d, k) => this._live(d, k) })
    if (this.adapter) {
      this.offs = this.store.filters().map((f) => this.adapter.subscribe(f, (p, topic) => this.store.ingest(topic, p)))
      this.adapter.connect?.().catch((err) => console.warn('[twin] adapter connect failed', err?.message || err))
    }
    engine.bus.on('select', (e) => this._onPick(e))
  }

  onChange(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn) }
  _emit() { this.listeners.forEach((f) => f(this)) }

  /** per frame, after progress / lifecycle / agents, before render */
  update(dt) {
    if (!(dt > 0)) dt = 0
    this.adapter?.tick?.(dt)
    this.store.checkStale()
    this.interior.update()
    this.markers.update(dt)
  }
  hostOf(d) {
    const n = d.attachTo ? this.model.get(d.attachTo) : null
    return n || (d.meta.signal != null && this._signal(d) ? this.model.root : null)
  }

  _signal(d) {
    if (d.type !== 'trafficSignal') return null
    const z = d.attachTo ? this.model.get(d.attachTo)?.pos : null
    return findSignal(this.E.world, d.meta.signal, z)
  }

  /** world position of a device marker */
  devicePos(d, node = this.hostOf(d), out = new THREE.Vector3()) {
    const sp = signalPos(this._signal(d))
    if (sp) return out.set(sp.x, (sp.y ?? 0) + d.offset[1], sp.z)
    return this.model.worldPos(node, d.offset, out)
  }

  /** values taken from the simulation instead of the mock walk (undefined = use mock) */
  _live(d, k) {
    const e = this.hostOf(d)?.entity
    const a = e?.agent
    switch (d.type) {
      case 'hoistMonitor':
        if (!a) return undefined
        if (k === 'height') return Math.round((a.cageY || 0) * 10) / 10
        if (k === 'speed' && a.cageState !== 'moving') return 0
        return undefined
      case 'vehicleGps':
        if (k === 'speed' && a) return e.active && !a.hidden ? Math.round(a.speed * 22) / 10 : 0
        return undefined
      case 'trafficSignal': {
        const sig = this._signal(d)
        if (!sig) return undefined
        return k === 'state' ? readSignal(sig) : k === 'queue' ? readQueue(sig) : undefined
      }
    }
    return undefined
  }

  // ---- selection / navigation
  _onPick(e) {
    const hit = this.E.picker.lastHit
    let sel = null
    if (hit?.userData.twinDevice) sel = { device: this.registry.get(hit.userData.twinDevice) }
    else if (hit) { const n = this.model.resolveHit(hit); if (n) sel = { node: n } }
    else if (e) { const n = this.model.get(e.id); if (n) sel = { node: n } }
    this._setSel(sel)
  }

  /** select a device id or node id / path (null clears) */
  select(ref) {
    if (!ref) return this._setSel(null)
    const d = this.registry.get(ref)
    if (d) return this._setSel({ device: d })
    const n = this.model.find(ref)
    this._setSel(n ? { node: n } : null)
  }

  _setSel(sel) {
    this.selected = sel
    this.markers.selected = sel?.device?.id || null
    this._emit()
  }

  /** fly the camera to a device / node; indoor targets enter their floor */
  flyTo(ref) {
    const d = this.registry.get(ref)
    const node = d ? this.hostOf(d) : this.model.find(ref)
    if (!node) return false
    const pos = d ? this.devicePos(d, node) : this.model.worldPos(node)
    const { floor } = this.model.floorOf(node)
    if (floor && floor.floor < this.interior.builtFloors()) {
      return this.interior.enter(floor.floor, { focus: node.kind === 'floor' ? null : pos })
    }
    if (this.interior.active) this.interior.exit({ fly: false })
    const e = node.entity
    const C = this.E.camera
    if (e?.agent && node.kind !== 'zone') C.follow(e, e.kind === 'walker' ? 12 : 24)
    else C.focus(pos, node.kind === 'building' ? 70 : 24)
    return true
  }

  /** devices on a node and all its descendants */
  devicesOn(node) {
    return node ? this.registry.on(this.model.subtreeIds(node)) : []
  }

  /** usable by automation: hook a picker so markers are clicked before scene geometry */
  pickMarker(ray) {
    // overlapping markers: unoccluded before ghosted, then nearest; clicking the current
    // selection again cycles to the next marker under the cursor
    const M = this.markers
    const hits = ray.intersectObjects(M.pickables(), false)
    if (hits.length) {
      const occ = (h) => (M.items.get(h.object.userData.twinDevice)?.occluded ? 1 : 0)
      hits.sort((a, b) => occ(a) - occ(b) || a.distance - b.distance)
      const ids = [...new Set(hits.map((x) => x.object.userData.twinDevice))]
      const id = cyclePick(ids, M.selected)
      const d = this.registry.get(id)
      return { object: M.items.get(id).icon, entity: this.hostOf(d)?.entity || null }
    }
    // inside a floor, rooms are picked on the floor plane (walls, furniture and the core
    // stub can't swallow the click), so every room is clickable from the default view
    const it = this.interior.active ? this.model.interiors[this.interior.floor] : null
    if (!it?.group.visible) return null
    const g = it.group
    g.updateWorldMatrix(true, false)
    _ray.copy(ray.ray).applyMatrix4(_m.copy(g.matrixWorld).invert())
    if (!_ray.intersectPlane(_floor, _hit)) return null
    const room = roomAt(it.plan, _hit.x, _hit.z)
    const m = room && it.rooms.get(room.key)
    if (!m) return null
    return { object: m, entity: this.model.resolveHit(m)?.entity || this.E.building?.entity || null }
  }

  dispose() {
    this.offs?.forEach((f) => f())
    this.adapter?.close?.()
    this.markers.dispose()
  }
}