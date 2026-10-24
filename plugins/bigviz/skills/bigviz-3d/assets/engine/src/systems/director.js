// Director: plays storyboards (timed shot lists with day / speed / weather / caption cues)
// and an auto "导播" mode that cuts to whatever just happened (crane lift, pour, delivery).

export class Director {
  /**
   * @param {object} ctx engine context (clock, weather, cameraMgr, bus, shots, jumpTo)
   */
  constructor(ctx) {
    this.ctx = ctx
    this.board = null
    this.i = -1
    this.t = 0
    this.caption = null
    this.auto = false
    this.autoT = 0
    this.cool = 0
    this.reactions = {}
    this.listeners = new Set()
    ctx.bus.on('*', (type, payload) => this._react(type, payload))
  }

  onChange(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn) }
  _emit() { this.listeners.forEach((f) => f(this)) }

  get playing() { return !!this.board }

  get progress() {
    if (!this.board) return 0
    const total = this.board.segments.reduce((a, s) => a + s.t, 0)
    const done = this.board.segments.slice(0, this.i).reduce((a, s) => a + s.t, 0) + this.t
    return Math.min(1, done / total)
  }

  get duration() {
    return this.board ? this.board.segments.reduce((a, s) => a + s.t, 0) : 0
  }

  /** @param {{ id:string, name:string, segments:Array<object> }} board */
  play(board, { onDone } = {}) {
    this.stopAuto()
    this.board = board
    this.onDone = onDone
    this.i = -1
    this._nextSeg()
    this._emit()
  }

  stop() {
    if (!this.board) return
    this.board = null
    this.caption = null
    const cb = this.onDone
    this.onDone = null
    this._emit()
    cb?.()
  }

  _nextSeg() {
    this.i++
    const seg = this.board.segments[this.i]
    if (!seg) return this.stop()
    this.t = 0
    const c = this.ctx
    if (seg.day != null) c.jumpTo(seg.day)
    if (seg.hour != null) c.setHour(seg.hour)
    if (seg.speed != null) c.clock.speed = seg.speed
    if (seg.weather) c.weather.set(seg.weather)
    if (seg.lockHour !== undefined) c.clock.lockHour = seg.lockHour
    this.caption = seg.caption ? { title: seg.caption, sub: seg.sub || '', t: 0, life: seg.t } : null
    const shot = typeof seg.shot === 'string' ? c.shots.find((s) => s.id === seg.shot) : seg.shot
    if (shot) c.cameraMgr.play({ ...shot, t0: seg.t0 || 0 }, { blend: seg.cut ? 0 : seg.blend ?? 1.6 })
    this._emit()
  }

  // ---------------------------------------------------------------- auto director
  startAuto(reactions = {}) {
    this.stop()
    this.auto = true
    this.reactions = reactions
    this.autoT = 0
    this.cool = 0
    this._cycle()
    this._emit()
  }

  stopAuto() {
    if (!this.auto) return
    this.auto = false
    this._emit()
  }

  _cycle() {
    const pool = this.ctx.shots.filter((s) => s.auto !== false && this.ctx.shotAvailable(s))
    if (!pool.length) return
    const s = pool[Math.floor(Math.random() * pool.length)]
    this.ctx.cameraMgr.play(s, { blend: 2 })
    this.autoT = 0
  }

  _react(type, payload) {
    if (!this.auto || this.cool > 0) return
    const r = this.reactions[type]
    if (!r) return
    const id = typeof r === 'function' ? r(payload) : r
    const shot = this.ctx.shots.find((s) => s.id === id)
    if (!shot || !this.ctx.shotAvailable(shot)) return
    this.ctx.cameraMgr.play(shot, { blend: 1.6 })
    this.cool = 9
    this.autoT = 0
  }

  update(dt) {
    if (this.board) {
      this.t += dt
      if (this.caption) this.caption.t += dt
      if (this.t >= this.board.segments[this.i].t) this._nextSeg()
    }
    if (this.auto) {
      this.cool -= dt
      this.autoT += dt
      if (this.autoT > 13) this._cycle()
      if (this.ctx.cameraMgr.mode === 'free') this.stopAuto()
    }
  }
}
