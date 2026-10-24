// Construction pack - digital-twin layer as data: zones, interior room naming, devices
// and binding rules. Devices attach to twin node ids:
//   entity id ('foreman', 'mixer-1'), rig part ('tc.slew', 'hoist.cage'), building parts
//   ('tower.deck', 'tower.core'), floors ('tower.F3'), rooms ('tower.F3.N1', 'tower.F3.corridor'),
//   or zones declared below. offset = [x, y, z] metres in the host's local frame.

const HEAD = [0, 1.72, 0]

export const SCENE_DEVICES = {
  // telemetry source; ?twin=ws://host:port or ?twin=off overrides at runtime
  adapter: { type: 'mock', seed: 11, interval: 1, alarmRate: 0.35 },
  prefix: 'site',
  zones: [
    { id: 'zone.gate-s', name: '南大门', x: -1.5, z: 23 },
    { id: 'zone.gate-w', name: '西大门', x: -35, z: 12.5 },
    { id: 'zone.office', name: '项目部', x: -27, z: -14.5 },
    { id: 'zone.yard', name: '材料堆场', x: 24.5, z: -6 },
    // the three signalised junctions in layout.js roads.signals (rE, rN, rW)
    { id: 'zone.sig-e', name: '东口路口', x: 42.75, z: 0 },
    { id: 'zone.sig-n', name: '北口路口', x: 0, z: -30.75 },
    { id: 'zone.sig-w', name: '西口路口', x: -42.75, z: 0 }
  ],
  // interior room names per floor strip (north of the corridor / south of it)
  interior: { north: ['办公室', '会议室', '设备间'], core: '电梯厅', south: ['配电间', '开放办公', '茶水间', '库房'] },
  // extra topic rules (the default `site/{device}/telemetry` rule is always appended)
  bindings: [
    // SCADA style: one scalar per topic, e.g. scada/em-site/power -> 182.4
    { topic: 'scada/{device}/{prop}', map: (v, p) => ({ [p.device]: { [p.prop]: typeof v === 'object' ? v.value : v } }) },
    // vendor crane box publishes its own JSON shape
    { topic: 'vendor/crane/TC-1', device: 'tc-mon', map: (m) => ({ load: m.weight_t, wind: m.wind_ms, tilt: m.tilt_deg }) }
  ],
  devices: [
    // tower crane + hoist
    { id: 'tc-mon', type: 'craneMonitor', name: '塔吊监测 TC-1', attachTo: 'tc.slew', offset: [0, 2.8, 5], visual: { prop: 'load', label: '{value}' } },
    { id: 'tc-cam', type: 'camera', name: '吊钩可视化', attachTo: 'tc.trolley', offset: [0, -0.6, 0] },
    { id: 'hoist-mon', type: 'hoistMonitor', name: '施工电梯 SC-200', attachTo: 'hoist.cage', offset: [0, 2.8, 0] },
    // building: deck sensors ride the working floor
    { id: 'ct-deck', type: 'concreteTemp', name: '楼板测温 T-01', attachTo: 'tower.deck', offset: [5, 0.4, 3] },
    { id: 'hf-deck', type: 'formworkMonitor', name: '高支模 HF-01', attachTo: 'tower.deck', offset: [-6, -1.4, -2.5], visual: { prop: 'settle' } },
    // gates, environment, cameras
    { id: 'env-gate', type: 'envSensor', name: '扬尘噪声 · 南门', attachTo: 'zone.gate-s', offset: [5, 3.2, 1.5], visual: { prop: 'pm25' } },
    { id: 'env-yard', type: 'envSensor', name: '扬尘噪声 · 堆场', attachTo: 'zone.yard', offset: [3, 3.2, -6], visual: { prop: 'noise' } },
    { id: 'cam-gate', type: 'camera', name: '球机 · 南门', attachTo: 'zone.gate-s', offset: [-5, 4.2, 0.5] },
    { id: 'cam-yard', type: 'camera', name: '枪机 · 堆场', attachTo: 'zone.yard', offset: [-3, 4.2, 9] },
    { id: 'gate-s', type: 'accessGate', name: '闸机 · 南门', attachTo: 'zone.gate-s', offset: [3, 1.6, -0.5] },
    { id: 'gate-w', type: 'accessGate', name: '闸机 · 西门', attachTo: 'zone.gate-w', offset: [0.5, 1.6, -3] },
    // people + vehicles (markers follow the host)
    { id: 'hm-foreman', type: 'helmet', name: '安全帽 · 张工', attachTo: 'foreman', offset: HEAD, visual: { prop: 'hr' } },
    { id: 'hm-deck2', type: 'helmet', name: '安全帽 · 小李', attachTo: 'deck-2', offset: HEAD, visual: { prop: 'hr' } },
    { id: 'hm-rigger', type: 'helmet', name: '安全帽 · 小马', attachTo: 'rigger', offset: HEAD, visual: { prop: 'hr' } },
    { id: 'gps-mixer', type: 'vehicleGps', name: '定位 · 搅拌车 01', attachTo: 'mixer-1', offset: [0, 4, 0] },
    { id: 'gps-fork', type: 'vehicleGps', name: '定位 · 叉车 FL-3', attachTo: 'forklift', offset: [0, 3, 0] },
    { id: 'gps-mc', type: 'vehicleGps', name: '定位 · 汽车吊', attachTo: 'mc', offset: [0, 4, 0] },
    // site utilities
    { id: 'em-site', type: 'electricMeter', name: '总配电箱电表', attachTo: 'zone.office', offset: [4, 1.8, 3] },
    { id: 'wm-site', type: 'waterMeter', name: '施工用水总表', attachTo: 'zone.office', offset: [-4, 1.2, 3] },
    // traffic signals: bound to world.traffic.signals[meta.signal] when present
    { id: 'sig-e', type: 'trafficSignal', name: '信号灯 · 东口', attachTo: 'zone.sig-e', offset: [0, 6.5, 0], meta: { signal: 0 }, visual: { prop: 'state' } },
    { id: 'sig-n', type: 'trafficSignal', name: '信号灯 · 北口', attachTo: 'zone.sig-n', offset: [0, 6.5, 0], meta: { signal: 1 }, visual: { prop: 'state' } },
    { id: 'sig-w', type: 'trafficSignal', name: '信号灯 · 西口', attachTo: 'zone.sig-w', offset: [0, 6.5, 0], meta: { signal: 2 }, visual: { prop: 'state' } },
    // interior (visible when the floor is entered)
    { id: 'ie-f3', type: 'indoorEnv', name: '3F 办公室环境', attachTo: 'tower.F3.N1', offset: [0, 2.6, 0], visual: { prop: 'temp' } },
    { id: 'cam-f3', type: 'camera', name: '3F 走廊摄像头', attachTo: 'tower.F3.corridor', offset: [4, 2.7, 0] },
    { id: 'em-f3', type: 'electricMeter', name: '3F 配电间电表', attachTo: 'tower.F3.S1', offset: [-1.5, 1.5, 0] },
    { id: 'ie-f6', type: 'indoorEnv', name: '6F 设备间环境', attachTo: 'tower.F6.N4', offset: [0, 2.6, 0], visual: { prop: 'temp' } },
    { id: 'em-f6', type: 'electricMeter', name: '6F 配电间电表', attachTo: 'tower.F6.S1', offset: [-1.5, 1.5, 0] }
  ]
}
