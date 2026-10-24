// Traffic-signal bridge. world.traffic.signals is built by another system (may be absent
// or shaped differently); read it defensively: array | Map | object of signals, each with
// one of state / phase / color / light (or a state() fn) and an optional position.

const NORM = { r: 'red', red: 'red', stop: 'red', y: 'amber', amber: 'amber', yellow: 'amber', g: 'green', green: 'green', go: 'green', off: 'off', fault: 'fault' }

export function signalList(world) {
  const s = world?.traffic?.signals ?? world?.signals?.traffic
  if (!s) return []
  if (Array.isArray(s)) return s
  if (s instanceof Map) return [...s.values()]
  if (typeof s === 'object') return Object.values(s)
  return []
}

/** pick a signal by index / id, or the nearest to {x,z} */
export function findSignal(world, ref, near) {
  const list = signalList(world)
  if (!list.length) return null
  if (typeof ref === 'number' && list[ref]) return list[ref]
  if (typeof ref === 'string') { const m = list.find((x) => x?.id === ref); if (m) return m }
  if (!near) return null
  let best = null
  let bd = Infinity
  for (const x of list) {
    const p = signalPos(x)
    if (!p) continue
    const d = (p.x - near.x) ** 2 + (p.z - near.z) ** 2
    if (d < bd) { bd = d; best = x }
  }
  return best
}

export function signalPos(sig) {
  const p = sig?.position || sig?.pos || sig?.object3d?.position || sig
  return p && typeof p.x === 'number' && typeof p.z === 'number' ? p : null
}

/** normalised state string or undefined */
export function readSignal(sig) {
  if (!sig) return undefined
  let v = typeof sig.state === 'function' ? sig.state() : sig.state ?? sig.phase ?? sig.color ?? sig.light
  if (v && typeof v === 'object') v = v.state ?? v.color ?? v.name
  if (v == null) return undefined
  return NORM[String(v).toLowerCase()] ?? String(v)
}

export function readQueue(sig) {
  const q = sig?.queue ?? sig?.waiting
  if (typeof q === 'number') return q
  if (Array.isArray(q)) return q.length
  return undefined
}
