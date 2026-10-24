// World: entity registry + blackboard. Entities are plain objects; behaviour lives in
// systems. The blackboard holds shared facts (stock counts, signals, counters) so agents
// can coordinate ("mixer is ready" -> crane bucket can load) without knowing each other.

let nextId = 1

export class World {
  constructor(bus) {
    this.bus = bus
    this.entities = new Map()
    this.byTag = new Map()
    /** numeric facts: stock.rebar, counter.pours ... */
    this.vars = Object.create(null)
    /** one-shot signals: signal name -> pending count */
    this.signals = Object.create(null)
    /** mutex-style reservations: key -> entity id */
    this.locks = Object.create(null)
  }

  /**
   * @param {object} e entity: { id?, kind, name, object3d, rig?, tags?, life?, agent?, data? }
   */
  add(e) {
    e.id = e.id || `${e.kind}-${nextId++}`
    e.tags = e.tags || []
    e.status = e.status || ''
    e.visible = true
    this.entities.set(e.id, e)
    for (const t of e.tags) {
      if (!this.byTag.has(t)) this.byTag.set(t, new Set())
      this.byTag.get(t).add(e)
    }
    if (e.object3d) e.object3d.userData.entityId = e.id
    return e
  }

  get(id) {
    return this.entities.get(id)
  }

  tagged(tag) {
    return [...(this.byTag.get(tag) || [])]
  }

  all() {
    return this.entities.values()
  }

  // ---- blackboard ----
  getVar(k, d = 0) {
    return this.vars[k] ?? d
  }

  setVar(k, v) {
    const old = this.vars[k]
    this.vars[k] = v
    if (old !== v) this.bus?.emit('var.changed', { key: k, value: v, old })
  }

  addVar(k, dv) {
    this.setVar(k, this.getVar(k) + dv)
  }

  signal(name, n = 1) {
    this.signals[name] = (this.signals[name] || 0) + n
  }

  /** consume one pending signal; true if there was one */
  take(name) {
    if (this.signals[name] > 0) {
      this.signals[name]--
      return true
    }
    return false
  }

  peek(name) {
    return this.signals[name] > 0
  }

  lock(key, id) {
    if (this.locks[key] && this.locks[key] !== id) return false
    this.locks[key] = id
    return true
  }

  unlock(key, id) {
    if (this.locks[key] === id) delete this.locks[key]
  }

  /** Reset blackboard state when the timeline jumps (agents restart their plans) */
  resetBlackboard() {
    this.signals = Object.create(null)
    this.locks = Object.create(null)
  }
}
