// WebSocket JSON adapter. Server frames (text JSON), one message or an array of them:
//   { "topic": "site/tc-monitor/telemetry", "payload": { "load": 3.2, "wind": 6.1 } }
// Field names are configurable (topicKey / payloadKey). On open the adapter sends
//   { "type": "subscribe", "topics": ["site/+/telemetry", ...] }
// (set `subscribeMsg: false` for servers that push everything). Auto-reconnects with
// backoff. `WebSocket` can be injected for node / tests.

import { BaseAdapter, parsePayload } from './base.js'

export class WsAdapter extends BaseAdapter {
  /**
   * @param {{ url: string, WebSocket?: any, topicKey?: string, payloadKey?: string, subscribeMsg?: false | ((topics: string[]) => object),
   *           reconnect?: boolean, maxBackoff?: number, protocols?: string | string[] }} opts
   */
  constructor(opts = {}) {
    super(opts)
    this.kind = 'ws'
    this.url = opts.url
    this.WS =opts.WebSocket || globalThis.WebSocket
    this.topicKey = opts.topicKey || 'topic'
    this.payloadKey = opts.payloadKey || 'payload'
    this.reconnect = opts.reconnect !== false
    this.maxBackoff = opts.maxBackoff ?? 15000
    this.backoff = 500
    this.ws = null
    this.closing = false
  }

  connect() {
    if (this.ws && this.status === 'open') return Promise.resolve()
    if (!this.WS) { this._setStatus('error', 'WebSocket unavailable'); return Promise.reject(new Error('WebSocket unavailable')) }
    this.closing = false
    this._setStatus('connecting')
    return new Promise((resolve, reject) => {
      let ws
      try { ws = new this.WS(this.url, this.opts.protocols) } catch (err) { this._setStatus('error', err); reject(err); return }
      this.ws = ws
      ws.onopen = () => {
        this.backoff = 500
        this._setStatus('open')
        this._sendSubs(this.router.filters())
        resolve()
      }
      ws.onmessage = (ev) => this._onFrame(ev.data)
      ws.onerror = (err) => { this._setStatus('error', err); reject(err) }
      ws.onclose = () => {
        this.ws = null
        if (this.closing || !this.reconnect) { this._setStatus('closed'); return }
        this._setStatus('connecting')
        setTimeout(() => this.connect().catch(() => {}), this.backoff)
        this.backoff = Math.min(this.maxBackoff, this.backoff * 2)
      }
    })
  }

  _onFrame(data) {
    const msg = parsePayload(data)
    for (const m of [].concat(msg)) {
      if (!m || typeof m !== 'object') continue
      const topic = m[this.topicKey]
      if (typeof topic !== 'string') continue
      this._deliver(topic, m[this.payloadKey] !== undefined ? parsePayload(m[this.payloadKey]) : m)
    }
  }

  _sendSubs(topics) {
    if (!topics.length || this.opts.subscribeMsg === false || !this.ws || this.status !== 'open') return
    const msg = typeof this.opts.subscribeMsg === 'function' ? this.opts.subscribeMsg(topics) : { type: 'subscribe', topics }
    this.ws.send(JSON.stringify(msg))
  }

  subscribe(filter, cb) {
    const off = super.subscribe(filter, cb)
    this._sendSubs([filter])
    return off
  }

  /** send a command / telemetry upstream as { topic, payload } */
  publish(topic, payload) {
    if (this.ws && this.status === 'open') this.ws.send(JSON.stringify({ [this.topicKey]: topic, [this.payloadKey]: payload }))
  }

  close() {
    this.closing = true
    this.ws?.close()
    this._setStatus('closed')
  }
}
