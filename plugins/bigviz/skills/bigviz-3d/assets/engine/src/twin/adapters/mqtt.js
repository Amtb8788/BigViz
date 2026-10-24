// MQTT over WebSocket - thin wrapper, no bundled dependency. Plug any client that has the
// mqtt.js shape: connect(url, opts) -> client with on('connect'|'message'|'close'|'error'),
// subscribe(filter), unsubscribe(filter), publish(topic, string), end().
//
// How to plug mqtt.js (https://github.com/mqttjs/MQTT.js):
//   a) npm i mqtt@5   then   import mqtt from 'mqtt'
//      new MqttAdapter({ url: 'wss://broker:8884/mqtt', connect: mqtt.connect, options: { username, password } })
//   b) or a <script src=".../mqtt.min.js"> tag: the global `mqtt` is picked up automatically
// Payloads are parsed as JSON, then number, then string. Broker-side wildcards are used
// as-is, so subscribe('site/+/telemetry') is forwarded to the broker.

import { BaseAdapter, parsePayload } from './base.js'

export class MqttAdapter extends BaseAdapter {
  /**
   * @param {{ url: string, connect?: (url: string, options: object) => any, options?: object, qos?: 0 | 1 | 2 }} opts
   */
  constructor(opts = {}) {
    super(opts)
    this.kind = 'mqtt'
    this.url = opts.url
    this.connectFn = opts.connect || globalThis.mqtt?.connect
    this.client = null
    this.qos = opts.qos ?? 0
  }

  connect() {
    if (this.client) return Promise.resolve()
    if (!this.connectFn) {
      this._setStatus('error', 'no MQTT client: pass { connect: mqtt.connect } or load mqtt.min.js')
      return Promise.reject(new Error('MQTT client library not provided'))
    }
    this._setStatus('connecting')
    return new Promise((resolve, reject) => {
      const c = this.connectFn(this.url, { reconnectPeriod: 2000, ...(this.opts.options || {}) })
      this.client = c
      c.on('connect', () => {
        this._setStatus('open')
        for (const f of this.router.filters()) c.subscribe(f, { qos: this.qos })
        resolve()
      })
      c.on('message', (topic, msg) => this._deliver(topic, parsePayload(msg)))
      c.on('reconnect', () => this._setStatus('connecting'))
      c.on('close', () => this.status !== 'closed' && this._setStatus('connecting'))
      c.on('error', (err) => { this._setStatus('error', err); reject(err) })
    })
  }

  subscribe(filter, cb) {
    const off = super.subscribe(filter, cb)
    if (this.client && this.status === 'open') this.client.subscribe(filter, { qos: this.qos })
    return () => {
      off()
      if (this.client && !this.router.filters().includes(filter)) this.client.unsubscribe?.(filter)
    }
  }

  publish(topic, payload) {
    this.client?.publish(topic, typeof payload === 'string' ? payload : JSON.stringify(payload), { qos: this.qos })
  }

  close() {
    this._setStatus('closed')
    this.client?.end?.(true)
    this.client = null
  }
}
