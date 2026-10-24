/**
 * Procedural night city for ThreeStage: assembles layout, buildings, ground, traffic, beacons,
 * atmosphere, camera rig and post-processing, and drives the shared uniforms (entrance, scan
 * ring, time). Returns a StageScene plus the controls CityCanvas needs (alerts, focus, flights,
 * picking, label projection). Everything is deterministic for a given seed.
 */
import { NeutralToneMapping, Scene } from 'three'
import type { CityAlert, StageContext, StageScene } from '../../types'
import { createBuildings } from './buildings'
import { createGround } from './ground'
import { createTraffic } from './traffic'
import { createBeacons, type ProjectedLabel } from './beacons'
import { createMotes, createSky } from './atmosphere'
import { createPost } from './post'
import { CameraRig } from './rig'
import { cityColors, sharedUniforms } from './colors'
import { CITY, generateCity } from './layout'

export type { ProjectedLabel } from './beacons'

/** Seconds per scan-ring sweep (two sweeps fit a 10 s GIF loop) */
const SCAN_PERIOD = 5
const SCAN_REACH = CITY.radius * 1.35
/** Entrance: buildings rise over this many seconds */
const GROW_TIME = 2.6
/** Scene time shown under reduced motion (a frame with the scan ring mid-city) */
const STILL_TIME = 2.2

export interface CityOptions {
  seed: number
  /** UnrealBloom pass (default true) */
  bloom?: boolean
  autoTour?: boolean
}

export interface CityScene extends StageScene {
  setAlerts(alerts: CityAlert[]): void
  setFocus(id: string | null): void
  /** Fly to an alert and hold; false when the id is unknown */
  flyTo(id: string): boolean
  setAutoTour(on: boolean): void
  /** User camera control; deltas in design px. Eases back into the tour after a while idle */
  rotate(dx: number, dy: number): void
  pan(dx: number, dy: number): void
  /** Factor > 1 moves away */
  zoom(factor: number): void
  /** Alert under a point in design px, or null */
  pick(x: number, y: number): string | null
  /** Project label anchors to design px into `out` */
  projectLabels(out: Map<string, ProjectedLabel>): void
}

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

export function createCityScene(ctx: StageContext, opts: CityOptions): CityScene {
  const { renderer } = ctx
  renderer.toneMapping = NeutralToneMapping
  renderer.toneMappingExposure = 1.05

  const layout = generateCity(opts.seed)
  const colors = cityColors()
  const shared = sharedUniforms(colors)
  shared.uScanCenter.value.set(layout.core.x, layout.core.z)

  const scene = new Scene()
  scene.background = colors.fog.clone()

  const beacons = createBeacons(colors, shared)
  const motes = createMotes(opts.seed, colors, shared)
  scene.add(
    createSky(colors),
    createGround(layout, colors, shared),
    createBuildings(layout, colors, shared),
    createTraffic(layout, colors, shared),
    beacons.group,
    motes
  )

  let width = ctx.width
  let height = ctx.height
  const rig = new CameraRig(width / height)
  rig.autoTour = opts.autoTour ?? true
  rig.reduced = ctx.reducedMotion()
  rig.setReturnListener(ctx.invalidate)

  const post = createPost(renderer, scene, rig.camera, { bloom: opts.bloom ?? true })
  const setMoteScale = (ratio: number) => {
    const u = motes.material.uniforms.uScale
    if (u) u.value = ratio
  }
  setMoteScale(ctx.pixelRatio)

  return {
    root: scene,
    update(time, dt) {
      const reduced = ctx.reducedMotion()
      rig.reduced = reduced
      const t = reduced ? STILL_TIME : time
      shared.uTime.value = t
      shared.uGrow.value = reduced ? 1 : smooth(0, GROW_TIME, time)
      const phase = (t % SCAN_PERIOD) / SCAN_PERIOD
      shared.uScanRadius.value = phase * SCAN_REACH
      shared.uScanStrength.value = smooth(0, 0.08, phase) * (1 - smooth(0.7, 1, phase))
      beacons.update(t)
      rig.update(dt)
    },
    render: () => post.render(),
    resize(w, h, ratio) {
      width = w
      height = h
      rig.camera.aspect = w / h
      rig.camera.updateProjectionMatrix()
      post.resize(w, h, ratio)
      setMoteScale(ratio)
    },
    dispose() {
      rig.dispose()
      beacons.dispose()
      post.dispose()
    },
    setAlerts(alerts) {
      beacons.setAlerts(alerts)
      ctx.invalidate()
    },
    setFocus(id) {
      beacons.setFocus(id)
      ctx.invalidate()
    },
    flyTo(id) {
      const base = beacons.baseOf(id)
      if (!base) return false
      rig.flyTo(base)
      ctx.invalidate()
      return true
    },
    setAutoTour(on) {
      rig.autoTour = on
    },
    rotate(dx, dy) {
      rig.rotate(dx, dy)
      ctx.invalidate()
    },
    pan(dx, dy) {
      rig.pan(dx, dy, height)
      ctx.invalidate()
    },
    zoom(factor) {
      rig.zoom(factor)
      ctx.invalidate()
    },
    pick: (x, y) => beacons.pick(rig.camera, x, y, width, height),
    projectLabels: (out) => beacons.project(rig.camera, width, height, out)
  }
}
