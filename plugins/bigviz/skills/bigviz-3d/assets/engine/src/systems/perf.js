// PerfMonitor: measures FPS (EMA + 1 s windows), auto-steps quality high <-> medium <-> low
// to hold the target (default 60), and exposes stats for the HUD / verify script.

const ORDER = ['low', 'medium', 'high']

export class PerfMonitor {
  constructor(stage, { target = 60, auto = true } = {}) {
    this.stage = stage
    this.target = target
    this.auto = auto
    this.fps = 60
    this.ms = 16.7
    this.frames = 0
    this.acc = 0
    this.window = []
    this.below = 0
    this.above = 0
    this.changes = 0
    this.listeners = new Set()
  }

  onChange(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn) }

  /** call once per frame with the real (unclamped) frame delta in seconds */
  tick(dt) {
    if (dt <= 0 || dt > 1) return
    this.ms += (dt * 1000 - this.ms) * 0.05
    this.frames++
    this.acc += dt
    if (this.acc < 1) return
    const fps = this.frames / this.acc
    this.fps = fps
    this.window.push(fps)
    if (this.window.length > 30) this.window.shift()
    this.frames = 0
    this.acc = 0
    if (!this.auto || document.hidden) return
    const idx = ORDER.indexOf(this.stage.quality)
    if (fps < this.target * 0.85) { this.below++; this.above = 0 } else if (fps > this.target * 0.98) { this.above++; this.below = 0 } else { this.below = 0; this.above = 0 }
    if (this.below >= 3 && idx > 0) { this._set(ORDER[idx - 1]); this.below = 0 }
    // only try upgrading occasionally so we do not oscillate
    if (this.above >= 12 && idx < ORDER.length - 1 && this.changes < 6) { this._set(ORDER[idx + 1]); this.above = 0 }
  }

  _set(q) {
    this.stage.setQuality(q)
    this.changes++
    this.listeners.forEach((f) => f(q))
  }

  stats() {
    const w = this.window
    const avg = w.length ? w.reduce((a, b) => a + b, 0) / w.length : this.fps
    return { fps: Math.round(this.fps), avg: Math.round(avg), min: Math.round(w.length ? Math.min(...w) : this.fps), ms: +this.ms.toFixed(1), quality: this.stage.quality, target: this.target, ...this.stage.info }
  }
}
