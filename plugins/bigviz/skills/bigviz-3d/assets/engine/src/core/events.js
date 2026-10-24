// Minimal event bus. Systems never call each other directly for gameplay facts; they emit
// events ("truck.arrived", "floor.done", "day.changed") and whoever cares listens.

export class EventBus {
  constructor() {
    this.map = new Map()
  }

  on(type, fn) {
    if (!this.map.has(type)) this.map.set(type, new Set())
    this.map.get(type).add(fn)
    return () => this.off(type, fn)
  }

  off(type, fn) {
    this.map.get(type)?.delete(fn)
  }

  emit(type, payload) {
    this.map.get(type)?.forEach((fn) => fn(payload))
    this.map.get('*')?.forEach((fn) => fn(type, payload))
  }
}
