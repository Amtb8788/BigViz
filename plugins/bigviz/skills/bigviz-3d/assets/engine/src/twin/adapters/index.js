// Adapter factory: config -> adapter instance.
//   { type: 'mock', seed, interval, alarmRate }   (default)
//   { type: 'ws', url, topicKey, payloadKey }
//   { type: 'mqtt', url, connect, options }
//   or pass an object that already implements connect / subscribe / close

import { MockAdapter } from './mock.js'
import { WsAdapter } from './ws.js'
import { MqttAdapter } from './mqtt.js'

export { MockAdapter, WsAdapter, MqttAdapter }

export function createAdapter(cfg = {}, ctx = {}) {
  if (cfg && typeof cfg.subscribe === 'function') return cfg
  switch (cfg.type || 'mock') {
    case 'ws': return new WsAdapter(cfg)
    case 'mqtt': return new MqttAdapter(cfg)
    case 'mock': return new MockAdapter({ ...cfg, devices: ctx.devices || [], live: cfg.live ?? ctx.live })
    default: throw new Error(`unknown twin adapter "${cfg.type}"`)
  }
}
