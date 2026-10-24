// Engine: owns the stage, world, clock and every system; runs the frame loop in a fixed
// order. Scene packs never touch this file: they are pure data passed to load().
//
// frame order: clock -> progress -> drive -> agents (sub-stepped) -> lifecycle -> animators
//              -> environment/weather -> fx -> camera -> director -> render -> recorder

import * as THREE from 'three'
import { EventBus } from './core/events.js'
import { World } from './core/world.js'
import { SimClock, hourToDayFrac } from './core/clock.js'
import { Stage } from './render/stage.js'
import { resolveStyle } from './render/style.js'
import { setMaterialStyle } from './render/materials.js'
import { GlowField } from './render/glows.js'
import { ParticleFX } from './render/particles.js'
import { AgentSystem } from './systems/agents.js'
import { LifecycleSystem, DriveSystem, ProgressSystem } from './systems/timeline.js'
import { AnimatorSystem } from './systems/animator.js'
import { EnvironmentSystem } from './systems/environment.js'
import { WeatherSystem } from './systems/weather.js'
import { CameraManager } from './systems/camera.js'
import { Director } from './systems/director.js'
import { Recorder } from './systems/recorder.js'
import { PerfMonitor } from './systems/perf.js'
import { Picker } from './systems/picking.js'
import { SceneBuilder } from './builder.js'
import { Twin } from './twin/index.js'

export class Engine {
  constructor(canvas, opts = {}) {
    this.canvas = canvas
    this.opts = opts
    this.bus = new EventBus()
    this.world = new World(this.bus)
    this.stage = new Stage(canvas, { boardHalf: 70 })
    this.glows = new GlowField(this.stage.scene)
    this.fx = new ParticleFX(this.stage.scene)
    this.weather = new WeatherSystem(this.stage.scene, this.fx)
    this.env = new EnvironmentSystem(this.stage, this.glows)
    this.lifecycle = new LifecycleSystem(this.world)
    this.drive = new DriveSystem()
    this.animator = new AnimatorSystem(this.fx)
    this.glowBuckets = []
    this.bubbles = []
    this.logs = []
    this.time = 0
    this.frame = 0
    this.running = false
    this.building = null
    this.roads = null
    this.traffic = null
    this.twin = null
  }

  /** @param {object} scene scene pack (see scenes/construction/index.js) */
  load(scene) {
    this.scene = scene
    // visual style: opts.style (url ?style=) > scene.style > 'diorama'; must precede the build
    this.style = resolveStyle({ opt: this.opts.style, scene: scene.style })
    setMaterialStyle(this.style)
    this.stage.setStyle(this.style)
    const clk = scene.clock || {}
    this.clock = new SimClock({ ...clk, startDay: this.opts.day ?? clk.startDay })
    const self = this
    this.ctx = {
      world: this.world,
      bus: this.bus,
      fx: this.fx,
      get clock() { return self.clock },
      get roads() { return self.roads },
      get building() { return self.building },
      get weather() { return self.weather },
      get traffic() { return self.traffic },
      vehicles: [],
      resolve: (spec, e) => this.builder.resolve(spec, e),
      say: (e, text, t) => this.say(e, text, t),
      log: (text, icon) => this.log(text, icon),
      engine: this
    }
    this.agents = new AgentSystem(this.ctx)
    this.progress = new ProgressSystem(this.ctx, scene.progress)
    this.builder = new SceneBuilder(this)
    for (const [k, v] of Object.entries(scene.vars || {})) this.world.setVar(k, v)
    this.builder.build(scene)
    this.shots = scene.shots || []
    this.camera = new CameraManager(this.stage.camera, this.canvas, this.ctx, { ...scene.camera, home: this.shots.find((s) => s.id === scene.camera?.home) || this.shots[0] })
    this.ctx.cameraMgr = this.camera
    this.ctx.shots = this.shots
    this.ctx.jumpTo = (d) => this.jumpTo(d)
    this.ctx.setHour = (h) => this.setHour(h)
    this.ctx.shotAvailable = (s) => this.shotAvailable(s)
    this.director = new Director(this.ctx)
    this.recorder = new Recorder(this.canvas)
    this.perf = new PerfMonitor(this.stage, { target: this.opts.fps ?? 60, auto: this.opts.autoQuality !== false })
    this.picker = new Picker(this.stage, this.world, (e) => this.bus.emit('select', e))
    // digital twin layer (devices, telemetry, alarms, interior) when the scene declares one
    if (scene.twin && this.opts.twin !== false) {
      this.twin = new Twin(this, scene.twin, this.opts.twin || {})
      this.picker.prePick = (ray) => this.twin.pickMarker(ray)
    }
    if (this.opts.quality) this.stage.setQuality(this.opts.quality)
    if (scene.weather) this.weather.set(scene.weather)
    scene.hooks?.setup?.(this.ctx, this)
    this.bus.on('milestone', (m) => this.log(m.text, m.icon || '★'))
    this.jumpTo(this.clock.day, true)
    return this
  }

  /** Jump the timeline: recompute all time-driven state and re-seat agents */
  jumpTo(day, initial = false) {
    this.clock.setDay(day)
    this.progress.lastDay = null
    this.progress.update(this.clock.day)
    this.drive.update(this.clock.day, this.ctx)
    this.lifecycle.update(this.clock.day)
    this.scene.hooks?.jump?.(this.ctx, this.clock.day)
    this.agents.reset()
    this.fx.clear()
    this.bubbles.length = 0
    if (!initial) this.bus.emit('timeline.jump', { day: this.clock.day })
  }

  /** Set hour of the current day (keeps the day number) */
  setHour(h) {
    const d = Math.floor(this.clock.day) + hourToDayFrac(h, this.clock.daylight)
    this.clock.setDay(d)
  }

  shotAvailable(s) {
    if (!s.entity) return true
    const e = this.world.get(s.entity)
    return !!e && e.active !== false && !e.agent?.hidden
  }

  say(e, text, t = 3) {
    if (!text) return
    this.bubbles = this.bubbles.filter((b) => b.e !== e)
    this.bubbles.push({ e, text, t, life: t })
    if (this.bubbles.length > 8) this.bubbles.shift()
  }

  log(text, icon = '•') {
    const { day, time } = this.clock.label()
    this.logs.push({ text, icon, day, time })
    if (this.logs.length > 60) this.logs.shift()
    this.bus.emit('log', this.logs[this.logs.length - 1])
  }

  start() {
    this.running = true
    let last = performance.now()
    const loop = (now) => {
      if (!this.running) return
      requestAnimationFrame(loop)
      const raw = (now - last) / 1000
      last = now
      this.perf.tick(raw)
      this.step(Math.min(raw, 0.1))
    }
    requestAnimationFrame(loop)
  }

  /** Advance one frame by dt real seconds (also used by deterministic capture) */
  step(dt) {
    this.time += dt
    this.frame++
    const simDt = this.clock.tick(dt, this.bus)
    const day = this.clock.day
    this.progress.update(day)
    this.drive.update(day, this.ctx)
    // agents: sub-step so 8x / 16x speed keeps paths and coordination stable
    const n = Math.min(8, Math.ceil(simDt / (1 / 30)))
    for (let i = 0; i < n; i++) {
      this.traffic?.update(simDt / n)
      this.agents.update(simDt / n)
    }
    this.traffic?.sync(this.clock.elapsed)
    this.lifecycle.update(day)
    for (const b of this.glowBuckets) this.glows.setVis(b.glowBucket, b.lifeK ?? 1)
    const envState = { night: this.env.night, wet: this.weather.mix.wet > 0.5, wind: this.weather.mix.wind }
    this.animator.update(simDt, envState)
    this.scene.hooks?.update?.(this.ctx, simDt, this)
    this.weather.update(dt, this.time, this.camera.controls.target, this.stage.q.particles)
    this.env.update(this.clock.hour, this.weather, dt)
    this.fx.budget = this.stage.q.particles
    this.fx.update(simDt, this.stage.size.h)
    this.glows.flush()
    this.camera.update(dt)
    this.director.update(dt)
    this.picker.update(this.time)
    this.twin?.update(dt)
    for (const b of this.bubbles) b.t -= dt
    this.bubbles = this.bubbles.filter((b) => b.t > 0)
    this.stage.render()
    this.recorder.frame()
    this.bus.emit('frame', dt)
  }

  resize(w, h) {
    this.stage.resize(w, h)
  }

  /** Counters for the HUD and verify script */
  stats() {
    let workers = 0
    let vehicles = 0
    for (const e of this.world.all()) {
      if (!e.agent || !e.active || e.agent.hidden) continue
      if (e.prefab === 'worker') workers++
      else if (e.agent.kind === 'vehicle' || e.kind === 'machine') vehicles++
    }
    return { workers, vehicles, lifts: this.world.getVar('counter.lifts'), pours: this.world.getVar('counter.pours'), deliveries: this.world.getVar('counter.deliveries'), concrete: this.world.getVar('counter.concrete') }
  }

  /** Project a world point to canvas CSS pixels (labels, bubbles) */
  project(v, out = { x: 0, y: 0, visible: false }) {
    const p = _v.copy(v).project(this.stage.camera)
    const r = this.canvas.getBoundingClientRect()
    out.x = (p.x * 0.5 + 0.5) * r.width
    out.y = (-p.y * 0.5 + 0.5) * r.height
    out.visible = p.z < 1 && p.z > -1 && Math.abs(p.x) < 1.05 && Math.abs(p.y) < 1.05
    return out
  }
}

const _v = new THREE.Vector3()
