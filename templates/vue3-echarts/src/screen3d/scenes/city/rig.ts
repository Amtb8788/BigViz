/**
 * Camera rig: a slow orbit around the city ("tour") and eased flights to a point that hold for a
 * while and then ease back into the tour. Expressed as orbit parameters (target, azimuth, distance,
 * elevation) so every blend is a smooth arc, never a straight cut through buildings.
 * User control (rotate / zoom / pan) takes over from the current view and eases back into the
 * tour after `idle` seconds without input.
 * Reduced motion: no orbit and every move is a jump.
 */
import { PerspectiveCamera, Vector3 } from 'three'

export interface RigParams {
  target: Vector3
  /** Radians around +y, 0 = camera on +z (south) looking north */
  azimuth: number
  distance: number
  /** Radians above the horizon */
  elevation: number
}

export interface RigOptions {
  /** Seconds per orbit lap */
  period?: number
  /** Seconds a flight takes */
  flight?: number
  /** Seconds the camera holds on a focus point before returning to the tour */
  hold?: number
  /** Seconds without user input before a manual view eases back into the tour */
  idle?: number
}

/** Limits for user control (world units / radians) */
const LIMITS = { minDistance: 380, maxDistance: 4200, minElevation: 0.12, maxElevation: 1.35, panRadius: 1600 }
/** Per-second approach rate of the camera towards a manual goal (exponential damping) */
const DAMPING = 10

const TOUR: Omit<RigParams, 'target'> & { target: [number, number, number] } = {
  target: [0, 0, 60],
  azimuth: 0.35,
  distance: 2150,
  elevation: 0.5
}

const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2)
const wrapAngle = (a: number) => Math.atan2(Math.sin(a), Math.cos(a))
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

export class CameraRig {
  readonly camera: PerspectiveCamera
  autoTour = true
  reduced = false

  private readonly opts: Required<RigOptions>
  private tourAzimuth = TOUR.azimuth
  private current: RigParams
  private from: RigParams | null = null
  private flightStart = 0
  private focus: RigParams | null = null
  private returning = false
  private onReturn: (() => void) | null = null
  private returnTimer: ReturnType<typeof setTimeout> | undefined
  /** User-driven goal (drag / wheel); null when the tour or a flight drives the camera */
  private manual: RigParams | null = null

  constructor(aspect: number, opts: RigOptions = {}) {
    this.opts = { period: 150, flight: 2.4, hold: 8, idle: 12, ...opts }
    this.camera = new PerspectiveCamera(36, aspect, 10, 12000)
    this.current = this.tourParams()
    this.apply(this.current)
  }

  /** Called when a hold ends (reduced motion uses it to request a still frame) */
  setReturnListener(fn: (() => void) | null) {
    this.onReturn = fn
  }

  private tourParams(): RigParams {
    return {
      target: new Vector3(...TOUR.target),
      azimuth: this.tourAzimuth,
      distance: TOUR.distance,
      elevation: TOUR.elevation
    }
  }

  /** Fly to a world point, hold, then return to the tour */
  flyTo(point: Vector3) {
    const focus: RigParams = {
      target: new Vector3(point.x, 70, point.z),
      // Keep the current heading so the flight is a dolly + tilt, not a swing around the city
      azimuth: this.current.azimuth + 0.25,
      distance: 820,
      elevation: 0.42
    }
    this.manual = null
    this.startFlight()
    this.focus = focus
    this.returning = false
    this.scheduleReturn(this.opts.hold)
  }

  /** Return to the tour now */
  release() {
    clearTimeout(this.returnTimer)
    if (!this.focus && !this.manual) return
    // Resume the tour from the current heading instead of swinging back to where it left off
    if (this.manual) this.tourAzimuth = this.current.azimuth
    this.focus = null
    this.manual = null
    this.returning = true
    this.startFlight()
    this.onReturn?.()
  }

  // ─── User control ───────────────────────────────────────────────────────────

  /** Start / continue manual control from the current view; restarts the idle timer */
  private takeOver(): RigParams {
    if (!this.manual) {
      this.manual = this.clone(this.current)
      this.focus = null
      this.from = null
      this.returning = false
    }
    this.scheduleReturn(this.opts.idle)
    return this.manual
  }

  /** Orbit by a drag delta in design px */
  rotate(dx: number, dy: number) {
    const m = this.takeOver()
    m.azimuth -= dx * 0.005
    m.elevation = clamp(m.elevation + dy * 0.004, LIMITS.minElevation, LIMITS.maxElevation)
  }

  /** Dolly by a factor (> 1 moves away) */
  zoom(factor: number) {
    const m = this.takeOver()
    m.distance = clamp(m.distance * factor, LIMITS.minDistance, LIMITS.maxDistance)
  }

  /** Pan the target on the ground plane by a drag delta in design px; the city follows the pointer */
  pan(dx: number, dy: number, viewHeight: number) {
    const m = this.takeOver()
    // World units per px at the target's depth
    const k = (2 * m.distance * Math.tan((this.camera.fov * Math.PI) / 360)) / Math.max(1, viewHeight)
    const s = Math.sin(m.azimuth)
    const c = Math.cos(m.azimuth)
    // Screen right = (cos, 0, -sin); ground forward (away from the camera) = (-sin, 0, -cos)
    const fwd = k / Math.max(0.35, Math.sin(m.elevation))
    m.target.x += -dx * k * c - dy * fwd * s
    m.target.z += dx * k * s - dy * fwd * c
    const r = Math.hypot(m.target.x, m.target.z)
    if (r > LIMITS.panRadius) {
      m.target.x *= LIMITS.panRadius / r
      m.target.z *= LIMITS.panRadius / r
    }
  }

  private scheduleReturn(seconds: number) {
    clearTimeout(this.returnTimer)
    // A wall-clock timer (not scene time) so the hold also ends while the loop is stopped
    this.returnTimer = setTimeout(() => this.release(), seconds * 1000)
  }

  private startFlight() {
    this.from = this.clone(this.current)
    this.flightStart = performance.now()
  }

  private clone(p: RigParams): RigParams {
    return { ...p, target: p.target.clone() }
  }

  private blend(a: RigParams, b: RigParams, t: number): RigParams {
    return {
      target: a.target.clone().lerp(b.target, t),
      azimuth: a.azimuth + wrapAngle(b.azimuth - a.azimuth) * t,
      distance: a.distance + (b.distance - a.distance) * t,
      elevation: a.elevation + (b.elevation - a.elevation) * t
    }
  }

  /** Advance by dt seconds and place the camera */
  update(dt: number) {
    if (this.autoTour && !this.reduced && !this.focus) {
      this.tourAzimuth += (dt / this.opts.period) * Math.PI * 2
    }
    // While focused, drift very slowly around the point so the hold is not a frozen frame
    if (this.focus && !this.reduced) this.focus.azimuth += dt * 0.03

    if (this.manual) {
      // Damped follow so wheel steps and drags glide; reduced motion jumps
      // dt 0 = a single still frame (loop stopped): there is no next frame to glide in, so jump
      const k = this.reduced || dt <= 0 ? 1 : 1 - Math.exp(-DAMPING * dt)
      this.current = this.blend(this.current, this.manual, k)
      this.apply(this.current)
      return
    }

    const goal = this.focus ?? this.tourParams()
    if (this.from && !this.reduced) {
      const t = Math.min(1, (performance.now() - this.flightStart) / (this.opts.flight * 1000))
      this.current = this.blend(this.from, goal, easeInOut(t))
      if (t >= 1) {
        this.from = null
        this.returning = false
      }
    } else {
      this.from = null
      this.current = this.clone(goal)
    }
    this.apply(this.current)
  }

  private apply(p: RigParams) {
    const c = Math.cos(p.elevation)
    this.camera.position.set(
      p.target.x + Math.sin(p.azimuth) * c * p.distance,
      p.target.y + Math.sin(p.elevation) * p.distance,
      p.target.z + Math.cos(p.azimuth) * c * p.distance
    )
    this.camera.lookAt(p.target)
  }

  get busy() {
    return this.from !== null || this.returning
  }

  dispose() {
    clearTimeout(this.returnTimer)
    this.onReturn = null
  }
}
