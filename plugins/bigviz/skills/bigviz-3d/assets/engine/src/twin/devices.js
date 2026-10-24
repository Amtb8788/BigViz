// Device registry. A device is pure data attached to any twin node (entity, rig part,
// floor, room, zone): { id, type, name, attachTo, offset, props: { key: spec } }.
// Prop spec: { name, unit, min, max, warn, alarm, warnLow, alarmLow, hyst, states, mock }
//   warn/alarm: high thresholds (value >= warn -> warn, >= alarm -> critical)
//   warnLow/alarmLow: low thresholds; states: { value: level } for discrete values
//   mock: { base, noise, revert, spike, kind: 'walk' | 'counter' | 'bool' | 'cycle' }

export const DEVICE_TYPES = {
  craneMonitor: {
    name: '塔吊监测', icon: '吊', color: '#f2b51c',
    props: {
      load: { name: '吊重', unit: 't', min: 0, max: 8, warn: 5.6, alarm: 6.8, mock: { base: 2.4, noise: 0.5, spike: 0.012 } },
      wind: { name: '风速', unit: 'm/s', min: 0, max: 25, warn: 10.8, alarm: 13.8, mock: { base: 5, noise: 0.9, spike: 0.008 } },
      tilt: { name: '倾角', unit: '°', min: 0, max: 2, warn: 0.6, alarm: 1, mock: { base: 0.18, noise: 0.04, spike: 0.004 } }
    }
  },
  envSensor: {
    name: '扬尘噪声', icon: '尘', color: '#7cc6a4',
    props: {
      pm25: { name: 'PM2.5', unit: 'μg/m³', min: 0, max: 250, warn: 75, alarm: 115, mock: { base: 38, noise: 6, spike: 0.01 } },
      pm10: { name: 'PM10', unit: 'μg/m³', min: 0, max: 400, warn: 150, alarm: 250, mock: { base: 70, noise: 10, spike: 0.01 } },
      noise: { name: '噪声', unit: 'dB', min: 30, max: 100, warn: 70, alarm: 80, mock: { base: 62, noise: 3, spike: 0.012 } }
    }
  },
  camera: {
    name: '视频监控', icon: '摄', color: '#8fb6ff',
    props: {
      online: { name: '在线', unit: '', states: { true: 'ok', false: 'critical' }, mock: { kind: 'bool', base: true, flip: 0.002, back: 0.08 } },
      motion: { name: '移动侦测', unit: '', states: { true: 'info', false: 'ok' }, mock: { kind: 'bool', base: false, flip: 0.04, back: 0.3 } }
    }
  },
  helmet: {
    name: '智能安全帽', icon: '帽', color: '#ffd166',
    track: true,
    props: {
      hr: { name: '心率', unit: 'bpm', min: 40, max: 180, warn: 125, alarm: 150, warnLow: 50, alarmLow: 42, mock: { base: 92, noise: 4, spike: 0.006 } },
      battery: { name: '电量', unit: '%', min: 0, max: 100, warnLow: 20, alarmLow: 8, mock: { kind: 'counter', base: 96, rate: -0.02, wrap: [5, 100] } }
    }
  },
  vehicleGps: {
    name: '车辆定位', icon: '车', color: '#9ad0ff',
    track: true,
    props: {
      speed: { name: '车速', unit: 'km/h', min: 0, max: 40, warn: 15, alarm: 25, mock: { base: 6, noise: 2, spike: 0.006 } },
      fuel: { name: '油量', unit: '%', min: 0, max: 100, warnLow: 20, alarmLow: 10, mock: { kind: 'counter', base: 80, rate: -0.03, wrap: [6, 100] } }
    }
  },
  concreteTemp: {
    name: '混凝土测温', icon: '温', color: '#ff9f6b',
    props: {
      core: { name: '芯部温度', unit: '℃', min: 0, max: 90, warn: 65, alarm: 75, mock: { base: 48, noise: 1.5, spike: 0.008 } },
      delta: { name: '内外温差', unit: '℃', min: 0, max: 40, warn: 20, alarm: 25, mock: { base: 14, noise: 1, spike: 0.008 } }
    }
  },
  electricMeter: {
    name: '智能电表', icon: '电', color: '#c5a3ff',
    props: {
      power: { name: '功率', unit: 'kW', min: 0, max: 400, warn: 300, alarm: 360, mock: { base: 160, noise: 18, spike: 0.006 } },
      leak: { name: '漏电流', unit: 'mA', min: 0, max: 60, warn: 25, alarm: 30, mock: { base: 8, noise: 1.5, spike: 0.006 } },
      energy: { name: '累计电量', unit: 'kWh', min: 0, mock: { kind: 'counter', base: 12840, rate: 0.9 } }
    }
  },
  waterMeter: {
    name: '智能水表', icon: '水', color: '#5fb8ff',
    props: {
      flow: { name: '流量', unit: 'm³/h', min: 0, max: 30, warn: 22, alarm: 27, mock: { base: 9, noise: 1.6, spike: 0.006 } },
      pressure: { name: '水压', unit: 'MPa', min: 0, max: 1, warnLow: 0.18, alarmLow: 0.1, mock: { base: 0.32, noise: 0.02, spike: 0.006 } }
    }
  },
  accessGate: {
    name: '门禁闸机', icon: '闸', color: '#7ee0c3',
    props: {
      flow: { name: '通行', unit: '人/h', min: 0, max: 120, warn: 90, alarm: 110, mock: { base: 36, noise: 6, spike: 0.004 } },
      denied: { name: '拒绝通行', unit: '次', min: 0, max: 10, warn: 3, alarm: 6, mock: { base: 0.5, noise: 0.5, spike: 0.006 } }
    }
  },
  trafficSignal: {
    name: '交通信号', icon: '灯', color: '#ff7a7a',
    props: {
      state: { name: '灯态', unit: '', states: { red: 'ok', amber: 'ok', yellow: 'ok', green: 'ok', fault: 'critical', off: 'warn' }, mock: { kind: 'cycle', seq: ['green', 'amber', 'red'], dur: [12, 3, 14] } },
      queue: { name: '排队', unit: '辆', min: 0, max: 20, warn: 8, alarm: 14, mock: { base: 3, noise: 1, spike: 0.006 } }
    }
  },
  hoistMonitor: {
    name: '升降机监测', icon: '梯', color: '#ffb86b',
    props: {
      load: { name: '载重', unit: 'kg', min: 0, max: 2000, warn: 1600, alarm: 1900, mock: { base: 700, noise: 90, spike: 0.008 } },
      height: { name: '高度', unit: 'm', min: 0, max: 45, mock: { base: 10, noise: 1 } },
      speed: { name: '速度', unit: 'm/s', min: 0, max: 1.2, warn: 0.75, alarm: 0.9, mock: { base: 0.4, noise: 0.08, spike: 0.006 } }
    }
  },
  formworkMonitor: {
    name: '高支模监测', icon: '模', color: '#e4c27a',
    props: {
      settle: { name: '沉降', unit: 'mm', min: 0, max: 30, warn: 10, alarm: 15, mock: { base: 3, noise: 0.4, spike: 0.008 } },
      axial: { name: '轴力', unit: 'kN', min: 0, max: 60, warn: 36, alarm: 45, mock: { base: 18, noise: 2, spike: 0.008 } }
    }
  },
  indoorEnv: {
    name: '室内环境', icon: '环', color: '#a8e6a1',
    props: {
      temp: { name: '温度', unit: '℃', min: -5, max: 45, warn: 32, alarm: 38, warnLow: 2, alarmLow: -2, mock: { base: 22, noise: 0.6, spike: 0.006 } },
      co2: { name: 'CO₂', unit: 'ppm', min: 300, max: 3000, warn: 1200, alarm: 2000, mock: { base: 640, noise: 60, spike: 0.006 } },
      smoke: { name: '烟感', unit: '', states: { true: 'critical', false: 'ok' }, mock: { kind: 'bool', base: false, flip: 0.0015, back: 0.2 } }
    }
  }
}

export const TYPE_ORDER = Object.keys(DEVICE_TYPES)

/** Normalise a device spec against its type: merged props, defaults, visual binding */
export function makeDevice(spec, types = DEVICE_TYPES) {
  if (!spec?.id) throw new Error('device needs an id')
  const T = types[spec.type]
  if (!T) throw new Error(`unknown device type "${spec.type}" (${spec.id})`)
  const props = {}
  for (const [k, p] of Object.entries(T.props)) props[k] = { key: k, ...p, ...(spec.props?.[k] || {}) }
  for (const [k, p] of Object.entries(spec.props || {})) if (!props[k]) props[k] = { key: k, name: k, ...p }
  const first = Object.values(props).find((p) => !p.states) || Object.values(props)[0]
  return {
    id: spec.id,
    type: spec.type,
    name: spec.name || `${T.name} ${spec.id}`,
    icon: spec.icon || T.icon,
    color: spec.color || T.color,
    attachTo: spec.attachTo ?? null,
    offset: spec.offset || [0, 0, 0],
    track: spec.track ?? !!T.track,
    tags: spec.tags || [],
    meta: spec.meta || {},
    topic: spec.topic || null,
    visual: { prop: first?.key, ...(spec.visual || {}) },
    props
  }
}
export class DeviceRegistry {
  constructor(types = DEVICE_TYPES) {
    this.types = types
    this.map = new Map()
  }

  add(spec) {
    const d = makeDevice(spec, this.types)
    if (this.map.has(d.id)) throw new Error(`duplicate device id "${d.id}"`)
    this.map.set(d.id, d)
    return d
  }

  addAll(specs = []) {
    return specs.map((s) => this.add(s))
  }

  get(id) {
    return this.map.get(id)
  }

  remove(id) {
    return this.map.delete(id)
  }

  all() {
    return [...this.map.values()]
  }

  byType(type) {
    return this.all().filter((d) => d.type === type)
  }

  /** devices attached to a node id (optionally including descendants via `ids`) */
  on(ids) {
    const set = new Set([].concat(ids))
    return this.all().filter((d) => set.has(d.attachTo))
  }

  usedTypes() {
    return [...new Set(this.all().map((d) => d.type))]
  }
}
