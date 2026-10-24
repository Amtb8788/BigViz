// Common adapter interface. Every transport (mock, WebSocket, MQTT) implements:
//   connect(): Promise<void>          open the transport (idempotent)
//   subscribe(filter, cb): () => void cb(payload, topic); filter supports + and #
//   publish(topic, payload): void     optional (commands / loopback)
//   close(): void
//   status: 'idle' | 'connecting' | 'open' | 'closed' | 'error'
//   onStatus(fn): () => void
// `tick(dt)` is optional; the twin calls it every frame (the mock generator uses it).

import { TopicRouter } from '../topics.js'

export class BaseAdapter {
  constructor(opts = {}) {
    this.opts = opts
    this.router = new TopicRouter()
    this.status = 'idle'
    this.statusFns = new Set()
    this.received = 0
  }

  _setStatus(s, info) {
    if (this.status === s) return
    this.status = s
    this.statusFns.forEach((f) => f(s, info))
  }

  onStatus(fn) {
    this.statusFns.add(fn)
    return () => this.statusFns.delete(fn)
  }

  async connect() {
    this._setStatus('open')
  }

  subscribe(filter, cb) {
    return this.router.add(filter, cb)
  }

  /** deliver an inbound message to local subscribers */
  _deliver(topic, payload) {
    this.received++
    return this.router.dispatch(topic, payload)
  }

  publish(topic, payload) {
    this._deliver(topic, payload)
  }

  close() {
    this._setStatus('closed')
  }
}

/** parse a text / bytes payload: JSON if possible, else number, else string */
export function parsePayload(raw) {
  let s = raw
  // bytes (ArrayBuffer, Uint8Array, node Buffer) -> text; objects pass through
  if (raw instanceof ArrayBuffer || ArrayBuffer.isView(raw)) s = new TextDecoder().decode(raw)
  if (typeof s !== 'string') return s
  try { return JSON.parse(s) } catch {}
  const n = Number(s)
  return Number.isFinite(n) && s.trim() !== '' ? n : s
}
