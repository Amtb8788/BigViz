/**
 * Shared types for the optional BigViz 3D kit (`src/screen3d/`). Only `import type` from three.js
 * here, so 2D screens can use these types without pulling the 3D chunk into their bundle.
 */
import type { Object3D, WebGLRenderer } from 'three'

/** Severity of a city alert; drives the beacon colour (ok / warn / danger) */
export type AlertLevel = 'info' | 'warn' | 'critical'

/** One alert beacon on the city */
export interface CityAlert {
  /** Stable unique key */
  id: string
  /** Text of the floating label */
  label: string
  level: AlertLevel
  /** Normalised city coordinates, -1 (west) … 1 (east) */
  x: number
  /** Normalised city coordinates, -1 (north, far side of the default view) … 1 (south) */
  z: number
  /** Optional reading shown next to the label */
  value?: number
  unit?: string
}

/** What ThreeStage hands to a scene factory once the renderer exists */
/**
 * Insets (design px) from the canvas edges that bound the area where beacon labels may appear,
 * e.g. to keep them clear of side panels. Labels outside fade out (the pillar stays); the focused
 * label is always shown, clamped inside.
 */
export interface LabelInsets {
  top: number
  right: number
  bottom: number
  left: number
}

export interface StageContext {
  renderer: WebGLRenderer
  canvas: HTMLCanvasElement
  /** Canvas size in design px (the 1920×1080 stage space, before CSS zoom) */
  width: number
  height: number
  /** Renderer pixel ratio (already capped) */
  pixelRatio: number
  /** Live reduced-motion flag: true → no loops, no tweens, a single still frame */
  reducedMotion: () => boolean
  /** Request one render while the loop is stopped (reduced motion, data or focus changed) */
  invalidate: () => void
}

/** A scene driven by ThreeStage. All sizes are design px. */
export interface StageScene {
  /** Root traversed after `dispose()` to free any geometry, material or texture left behind */
  root?: Object3D
  /** Advance the scene. `time` is scene seconds (paused while hidden), `dt` the frame delta. */
  update(time: number, dt: number): void
  /** Draw one frame (renderer or composer) */
  render(): void
  resize(width: number, height: number, pixelRatio: number): void
  /** Free render targets, passes and listeners owned by the scene */
  dispose(): void
}

/** Scene factory; called again after a WebGL context restore or `rebuild()` */
export type StageSetup = (ctx: StageContext) => StageScene

/** Lifecycle of a ThreeStage */
export type StageState = 'loading' | 'ready' | 'fallback'
