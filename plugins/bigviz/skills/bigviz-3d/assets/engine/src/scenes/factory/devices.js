// Factory pack - digital twin (prompts.md A.2 IoT list). Factory device types are added to
// the shared DEVICE_TYPES registry at import (the registry is a live object, like
// registerPrefab). Alarm rules: vibration RMS >= 7.1 mm/s, AGV battery <= 20 %, compressed
// air <= 0.55 MPa (warn 0.6).

import { DEVICE_TYPES } from '../../twin/devices.js'
import { PRESS } from './layout.js'

Object.assign(DEVICE_TYPES, {
  pressMonitor: {
    name: '压机监测', icon: '压', color: '#7fb2ff',
    props: {
      tonnage: { name: '吨位', unit: 't', min: 0, max: 2500, warn: 2200, alarm: 2400, mock: { base: 1650, noise: 60, spike: 0.006 } },
      spm: { name: '冲次', unit: 'SPM', min: 0, max: 15, warnLow: 6, mock: { base: 8.6, noise: 0.15 } },
      dieTemp: { name: '模具温度', unit: '℃', min: 10, max: 120, warn: 70, alarm: 85, mock: { base: 46, noise: 1.2, spike: 0.006 } },
      vib: { name: '振动 RMS', unit: 'mm/s', min: 0, max: 15, warn: 4.5, alarm: 7.1, mock: { base: 2.6, noise: 0.35, spike: 0.012 } }
    }
  },
  robotMonitor: {
    name: '机器人', icon: '机', color: '#ff9f4a',
    props: {
      state: { name: '状态', unit: '', states: { run: 'ok', idle: 'info', fault: 'critical' }, mock: { kind: 'cycle', seq: ['run', 'idle', 'run', 'fault'], dur: [70, 10, 50, 6] } },
      cycle: { name: '节拍', unit: 's', min: 0, max: 120, warn: 66, alarm: 75, mock: { base: 58, noise: 1.5, spike: 0.006 } },
      current: { name: '焊接电流', unit: 'A', min: 0, max: 400, warn: 300, alarm: 340, mock: { base: 235, noise: 9, spike: 0.008 } },
      code: { name: '故障码', unit: '', states: { 0: 'ok', 'E-104': 'critical', 'W-021': 'warn' }, mock: { kind: 'cycle', seq: [0, 0, 'W-021', 0, 'E-104'], dur: [60, 40, 8, 50, 5] } }
    }
  },
  agvMonitor: {
    name: 'AGV', icon: 'A', color: '#6fe0c0', track: true,
    props: {
      battery: { name: '电量', unit: '%', min: 0, max: 100, warnLow: 30, alarmLow: 20, mock: { kind: 'counter', base: 78, rate: -0.12, wrap: [14, 100] } },
      task: { name: '任务号', unit: '', mock: { kind: 'counter', base: 20410, rate: 0.05 } },
      speed: { name: '速度', unit: 'm/s', min: 0, max: 2, warn: 1.6, alarm: 1.8, mock: { base: 1.1, noise: 0.15 } }
    }
  },
  compressorMonitor: {
    name: '空压机', icon: '气', color: '#9ad0ff',
    props: {
      pressure: { name: '排气压力', unit: 'MPa', min: 0, max: 1, warnLow: 0.6, alarmLow: 0.55, mock: { base: 0.68, noise: 0.012, spike: 0.012 } },
      flow: { name: '流量', unit: 'm³/min', min: 0, max: 40, mock: { base: 26, noise: 1.2 } },
      current: { name: '电流', unit: 'A', min: 0, max: 400, warn: 330, alarm: 360, mock: { base: 260, noise: 8, spike: 0.006 } }
    }
  },
  coolingTower: {
    name: '冷却塔', icon: '冷', color: '#5fb8ff',
    props: {
      tIn: { name: '进水温度', unit: '℃', min: 10, max: 50, warn: 38, alarm: 42, mock: { base: 34, noise: 0.4, spike: 0.006 } },
      tOut: { name: '出水温度', unit: '℃', min: 10, max: 45, warn: 32, alarm: 35, mock: { base: 29, noise: 0.35, spike: 0.006 } }
    }
  },
  workshopEnv: {
    name: '车间温湿度', icon: '温', color: '#a8e6a1',
    props: {
      temp: { name: '温度', unit: '℃', min: -5, max: 45, warn: 32, alarm: 36, warnLow: 5, mock: { base: 24, noise: 0.4, spike: 0.006 } },
      rh: { name: '湿度', unit: '%', min: 0, max: 100, warn: 75, alarm: 85, mock: { base: 52, noise: 1.5, spike: 0.006 } }
    }
  },
  bridgeCraneMonitor: {
    name: '行车监测', icon: '行', color: '#f2b51c',
    props: {
      load: { name: '吊重', unit: 't', min: 0, max: 20, warn: 18, alarm: 20, mock: { base: 9, noise: 1.5, spike: 0.006 } },
      motorT: { name: '电机温度', unit: '℃', min: 0, max: 120, warn: 85, alarm: 100, mock: { base: 58, noise: 1.2, spike: 0.006 } }
    }
  }
})

const press = PRESS.map((p, i) => ({
  id: `pm-${p.id}`, type: 'pressMonitor', name: `压机 ${p.label}`, attachTo: p.id, offset: [p.big ? -3.2 : -2.8, 4.5, 0], visual: { prop: 'vib' },
  props: i ? { tonnage: { max: 800, warn: 700, alarm: 770, mock: { base: 520, noise: 25, spike: 0.006 } } } : {}
}))
const robots = []
for (const L of ['a', 'b']) for (let i = 0; i < 8; i++) robots.push({ id: `rm-${L}${i + 1}`, type: 'robotMonitor', name: `焊装${L.toUpperCase()}线 R${i + 1}`, attachTo: `wr-${L}${i + 1}`, offset: [0, 2.6, 0], visual: { prop: 'current' } })
for (let i = 0; i < 6; i++) robots.push({ id: `rm-p${i}`, type: 'robotMonitor', name: `冲压线搬运 R${i}`, attachTo: `pr-${i}`, offset: [0, 4.2, 0], visual: { prop: 'state' }, props: { current: { name: '伺服电流', warn: 120, alarm: 150, max: 200, mock: { base: 64, noise: 6 } } } })
const agvs = Array.from({ length: 12 }, (_, i) => ({ id: `ag-${i + 1}`, type: 'agvMonitor', name: `AGV-${String(i + 1).padStart(2, '0')}`, attachTo: `agv-${i + 1}`, offset: [0, 1.8, 0], visual: { prop: 'battery' } }))

export const SCENE_DEVICES = {
  adapter: { type: 'mock', seed: 23, interval: 1, alarmRate: 0.3 },
  prefix: 'plant',
  zones: [
    { id: 'zone.press', name: '冲压线', x: 10, z: -20 },
    { id: 'zone.weldA', name: '焊装 A 线', x: -46, z: -6.5 },
    { id: 'zone.weldB', name: '焊装 B 线', x: -46, z: 6.5 },
    { id: 'zone.racks', name: '成品立体库', x: 74, z: 0 },
    { id: 'zone.docks', name: '发货月台', x: 70, z: 34 },
    { id: 'zone.coil', name: '钢卷库', x: -62, z: -26 },
    { id: 'zone.utility', name: '动力站', x: -62, z: 64 },
    { id: 'zone.ctrl', name: '生产指挥中心', x: -76, z: 28 },
    { id: 'zone.gateS', name: '南大门', x: 0, z: 62 },
    { id: 'zone.gateW', name: '西大门', x: -99, z: 0 }
  ],
  devices: [
    ...press, ...robots, ...agvs,
    { id: 'gps-fl1', type: 'vehicleGps', name: '叉车 FL-01', attachTo: 'fl-1', offset: [0, 2.8, 0] },
    { id: 'gps-fl2', type: 'vehicleGps', name: '叉车 FL-02', attachTo: 'fl-2', offset: [0, 2.8, 0] },
    { id: 'gps-fl3', type: 'vehicleGps', name: '叉车 FL-03', attachTo: 'fl-3', offset: [0, 2.8, 0] },
    { id: 'gps-rt1', type: 'vehicleGps', name: '前移式叉车 RT-01', attachTo: 'fl-4', offset: [0, 4.2, 0] },
    { id: 'bc-1', type: 'bridgeCraneMonitor', name: '行车 1# (钢卷)', attachTo: 'crane-1.trolley', offset: [0, 1.6, 0] },
    { id: 'bc-2', type: 'bridgeCraneMonitor', name: '行车 2# (模具)', attachTo: 'crane-2.trolley', offset: [0, 1.6, 0] },
    { id: 'cmp-1', type: 'compressorMonitor', name: '空压机 1#', attachTo: 'zone.utility', offset: [-6, 2.4, 6], visual: { prop: 'pressure' } },
    { id: 'cmp-2', type: 'compressorMonitor', name: '空压机 2#', attachTo: 'zone.utility', offset: [0, 2.4, 6], visual: { prop: 'pressure' } },
    { id: 'cmp-3', type: 'compressorMonitor', name: '空压机 3#', attachTo: 'zone.utility', offset: [6, 2.4, 6], visual: { prop: 'pressure' } },
    { id: 'ct-1', type: 'coolingTower', name: '冷却塔 1#', attachTo: 'ct-1', offset: [0, 9, 0], visual: { prop: 'tOut' } },
    { id: 'ct-2', type: 'coolingTower', name: '冷却塔 2#', attachTo: 'ct-2', offset: [0, 9, 0], visual: { prop: 'tOut' } },
    { id: 'em-press', type: 'electricMeter', name: '电表 · 冲压线', attachTo: 'zone.press', offset: [-34, 2, 5], props: { power: { max: 2000, warn: 1600, alarm: 1850, mock: { base: 1180, noise: 60, spike: 0.006 } } } },
    { id: 'em-weldA', type: 'electricMeter', name: '电表 · 焊装 A 线', attachTo: 'zone.weldA', offset: [-26, 2, 3] },
    { id: 'em-weldB', type: 'electricMeter', name: '电表 · 焊装 B 线', attachTo: 'zone.weldB', offset: [-26, 2, -3] },
    { id: 'em-util', type: 'electricMeter', name: '电表 · 动力站', attachTo: 'zone.utility', offset: [12, 2, 6] },
    ...[[-60, -24], [-30, 0], [10, -24], [10, 24], [50, 0], [74, 24]].map(([x, z], i) => ({ id: `env-${i + 1}`, type: 'workshopEnv', name: `车间温湿度 T${i + 1}`, attachTo: 'zone.press', offset: [x - 10, 6, z + 20] })),
    { id: 'cam-press', type: 'camera', name: '球机 · 冲压线', attachTo: 'zone.press', offset: [0, 9, 4] },
    { id: 'cam-weld', type: 'camera', name: '球机 · 焊装', attachTo: 'zone.weldA', offset: [0, 7, 6.5] },
    { id: 'cam-racks', type: 'camera', name: '枪机 · 立体库', attachTo: 'zone.racks', offset: [-14, 8, 12] },
    { id: 'cam-docks', type: 'camera', name: '枪机 · 月台', attachTo: 'zone.docks', offset: [-10, 5, 1] },
    { id: 'cam-gate', type: 'camera', name: '球机 · 南大门', attachTo: 'zone.gateS', offset: [4, 4, 0] },
    { id: 'gate-s', type: 'accessGate', name: '门禁 · 南大门', attachTo: 'zone.gateS', offset: [3, 1.6, 2] },
    { id: 'gate-w', type: 'accessGate', name: '门禁 · 西大门', attachTo: 'zone.gateW', offset: [0, 1.6, 4] },
    { id: 'ie-ctrl', type: 'indoorEnv', name: '指挥中心环境', attachTo: 'zone.ctrl', offset: [0, 6.6, 0], visual: { prop: 'temp' } }
  ]
}
