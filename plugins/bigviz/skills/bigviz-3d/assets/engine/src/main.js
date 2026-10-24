// Entry: pick a scene pack from ?scene=, boot the engine + HUD, expose window.__diorama
// for automation (verify / record scripts, other AIs driving the scene).
//
// URL params: scene, day, speed, weather, hour, shot, quality (low|medium|high), fps,
//             style (realistic|diorama),
//             ui=0 (immersive), auto=1 (auto director), play=<storyboard id>, record=1

import { Engine } from './engine.js'
import { HUD } from './ui/hud.js'
import { SCENES } from './scenes/index.js'
import { loadAssets } from './render/assets.js'

const q = new URLSearchParams(location.search)
const num = (k) => (q.has(k) ? Number(q.get(k)) : undefined)

function webglOK() {
  try {
    const c = document.createElement('canvas')
    return !!(c.getContext('webgl2') || c.getContext('webgl'))
  } catch {
    return false
  }
}

async function boot() {
  const loading = document.getElementById('loading')
  const setText = (t) => (loading.querySelector('.loading__text').textContent = t)
  if (!webglOK()) {
    setText('此浏览器未启用 WebGL（硬件加速）。请在设置中开启图形加速后刷新。')
    window.__diorama = { ready: false, error: 'webgl' }
    return
  }
  const id = q.get('scene') || 'construction'
  const loader = SCENES[id] || SCENES.construction
  setText('正在搭建场景…')
  const scene = (await loader()).default
  const canvas = document.getElementById('stage')
  const engine = new Engine(canvas, { day: num('day'), quality: q.get('quality') || 'medium', fps: num('fps'), autoQuality: q.get('quality') ? false : true, style: q.get('style') || undefined, twin: twinOpts(q.get('twin')) })
  // optional glTF overrides (public/models/index.json); procedural prefabs otherwise
  await loadAssets({ renderer: engine.stage.renderer })
  engine.load(scene)
  const resize = () => engine.resize(canvas.clientWidth, canvas.clientHeight)
  window.addEventListener('resize', resize)
  resize()
  if (q.has('speed')) engine.clock.speed = num('speed')
  if (q.has('weather')) engine.weather.set(q.get('weather'))
  if (q.has('hour')) engine.clock.lockHour = num('hour')
  const hud = new HUD(engine, document.getElementById('ui'))
  if (q.get('ui') === '0') document.body.classList.add('immersive')
  if (q.has('shot')) {
    const s = engine.shots.find((x) => x.id === q.get('shot'))
    if (s) engine.camera.play(s, { blend: 0 })
  }
  engine.start()
  requestAnimationFrame(() => loading.classList.add('is-done'))
  if (q.get('auto') === '1') hud.toggleAuto()
  if (q.has('play')) {
    const i = (scene.storyboards || []).findIndex((b) => b.id === q.get('play'))
    if (i >= 0) { hud.boardSel.value = i; setTimeout(() => hud.toggleBoard(q.get('record') === '1'), 600) }
  }
  window.__diorama = api(engine, hud)
}

/** ?twin=off | mock | ws://host:port/path | mqtt:wss://broker/mqtt (needs global mqtt.js) */
function twinOpts(v) {
  if (v == null) return undefined
  if (v === 'off' || v === '0') return false
  if (/^wss?:\/\//.test(v)) return { adapter: { type: 'ws', url: v } }
  if (v.startsWith('mqtt:')) return { adapter: { type: 'mqtt', url: v.slice(5) } }
  return { adapter: { type: 'mock', seed: Number(v) || undefined } }
}

/** twin automation: devices / alarms / values, inject telemetry, select, enter floors */
function twinApi(E) {
  const T = E.twin
  if (!T) return null
  return {
    devices: () => T.registry.all().map((d) => ({ id: d.id, type: d.type, name: d.name, attachTo: d.attachTo, level: T.store.level(d.id), values: { ...(T.store.get(d.id)?.values || {}) } })),
    nodes: (kind) => [...T.model.nodes.values()].filter((n) => !kind || n.kind === kind).map((n) => ({ id: n.id, path: n.path, kind: n.kind, name: n.name })),
    alarms: () => T.store.alarms(),
    history: (id, prop) => T.store.history(id, prop),
    ingest: (topic, payload) => T.store.ingest(topic, payload),
    set: (id, values) => T.store.set(id, values),
    trigger: (id, prop, level) => T.adapter?.trigger?.(id, prop, level) ?? false,
    select: (ref) => { T.select(ref); return !!T.selected },
    flyTo: (ref) => T.flyTo(ref),
    enter: (floor) => T.interior.enter(floor == null ? undefined : floor - 1),
    exit: () => T.interior.exit(),
    floor: () => (T.interior.active ? T.interior.floor + 1 : 0),
    markers: (on) => { if (on != null) T.markers.enabled = !!on; return T.markers.enabled },
    /** true = show every marker (no declutter / occlusion fade); no arg = query */
    markersAll: (on) => { if (on != null) T.markers.showAll = !!on; return T.markers.showAll },
    markerState: () => [...T.markers.items.values()].map((it) => ({ id: it.d.id, shown: it.shown, occluded: it.occluded, opacity: +it.opacity.toFixed(2), scale: +it.scale.toFixed(2), off: [Math.round(it.off.x), Math.round(it.off.y)] })),
    markerMode: () => T.markers.mode
  }
}

/** Automation API (stable: documented in references/automation.md) */
function api(E, hud) {
  return {
    ready: true,
    engine: E,
    scenes: Object.keys(SCENES),
    shots: () => E.shots.map((s) => ({ id: s.id, name: s.name, type: s.type, available: E.shotAvailable(s) })),
    storyboards: () => (E.scene.storyboards || []).map((b) => ({ id: b.id, name: b.name, seconds: b.segments.reduce((a, s) => a + s.t, 0) })),
    shot: (id, blend = 1.2) => { const s = E.shots.find((x) => x.id === id); if (s) E.camera.play(s, { blend }); return !!s },
    free: () => E.camera.free(),
    day: (d) => { if (d != null) E.jumpTo(d); return E.clock.day },
    hour: (h) => { E.clock.lockHour = h; return E.clock.hour },
    speed: (s) => { if (s != null) E.clock.speed = s; return E.clock.speed },
    weather: (w) => { if (w) E.weather.set(w); return E.weather.current },
    quality: (qq) => { if (qq) { E.perf.auto = qq === 'auto'; if (qq !== 'auto') E.stage.setQuality(qq) } return E.stage.quality },
    ui: (on) => document.body.classList.toggle('immersive', on === false),
    play: (id, record = false) => {
      const i = (E.scene.storyboards || []).findIndex((b) => b.id === id)
      if (i < 0) return false
      hud.boardSel.value = i
      hud.toggleBoard(record)
      return true
    },
    playing: () => E.director.playing,
    lastRecording: () => window.__lastRecording || null,
    stats: () => ({ ...E.perf.stats(), ...E.stats(), day: +E.clock.day.toFixed(2), hour: +E.clock.hour.toFixed(2), phase: E.building?.phase, floors: E.progress.state.floors, weather: E.weather.current, shot: E.camera.shot?.id || E.camera.mode, entities: E.world.entities.size }),
    entities: (tag) => [...E.world.all()].filter((e) => !tag || e.tags.includes(tag) || e.prefab === tag).map((e) => ({ id: e.id, name: e.name, prefab: e.prefab, active: e.active, status: e.status, plan: e.agent?.planId })),
    /** deterministic stepping for frame-by-frame capture: stop rAF loop, then step(dt) */
    pauseLoop: () => { E.running = false },
    resumeLoop: () => { if (!E.running) E.start() },
    step: (dt = 1 / 60, n = 1) => { for (let i = 0; i < n; i++) E.step(dt) },
    twin: twinApi(E)
  }
}

boot().catch((err) => {
  console.error(err)
  const t = document.querySelector('.loading__text')
  if (t) t.textContent = `加载失败：${err.message}`
  window.__diorama = { ready: false, error: String(err && err.stack ? err.stack : err) }
})
