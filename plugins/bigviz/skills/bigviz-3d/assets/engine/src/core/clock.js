// SimClock: the single source of time. Everything that changes over the project (floors,
// crews, props, lights) reads `day` (continuous, e.g. 5.37) or `hour` (0-24) from here.
// Agents move in real seconds scaled by `speed`, so scrubbing the timeline never breaks
// walking speeds.

import { clamp } from './math.js'

export const SPEEDS = [0, 0.25, 0.5, 1, 2, 4, 8, 16]

export class SimClock {
  /**
   * @param {object} cfg
   * @param {number} cfg.dayStart first day (inclusive), e.g. 1
   * @param {number} cfg.dayEnd last day, e.g. 16
   * @param {number} cfg.secondsPerDay real seconds per sim day at 1x
   * @param {number} cfg.daylight fraction of a sim day that is daytime (06:00-20:00 spread)
   * @param {number} cfg.startDay
   * @param {number|null} cfg.lockHour fixed hour of day, or null to follow the clock
   */
  constructor(cfg = {}) {
    this.dayStart = cfg.dayStart ?? 1
    this.dayEnd = cfg.dayEnd ?? 16
    this.secondsPerDay = cfg.secondsPerDay ?? 40
    this.daylight = cfg.daylight ?? 0.7
    this.day = cfg.startDay ?? this.dayStart
    this.lockHour = cfg.lockHour ?? null
    this.speed = 1
    this.loop = cfg.loop ?? false
    this.elapsed = 0
    this._lastWholeDay = Math.floor(this.day)
  }

  get paused() {
    return this.speed === 0
  }

  /** Hour of day 0-24 derived from day fraction (day starts 06:00) unless locked */
  get hour() {
    if (this.lockHour != null) return this.lockHour
    return dayFracToHour(this.day - Math.floor(this.day), this.daylight)
  }

  get wholeDay() {
    return Math.floor(this.day)
  }

  /** 0..1 over the whole project */
  get progress() {
    return clamp((this.day - this.dayStart) / (this.dayEnd + 1 - this.dayStart), 0, 1)
  }

  setDay(d) {
    this.day = clamp(d, this.dayStart, this.dayEnd + 0.999)
  }

  /** Advance; returns sim dt in real seconds (dt * speed) for agents */
  tick(dt, bus) {
    const simDt = dt * this.speed
    this.elapsed += simDt
    if (simDt > 0) {
      this.day += simDt / this.secondsPerDay
      if (this.day >= this.dayEnd + 0.999) {
        this.day = this.loop ? this.dayStart : this.dayEnd + 0.999
        if (!this.loop) this.speed = 0
      }
    }
    const whole = this.wholeDay
    if (whole !== this._lastWholeDay) {
      this._lastWholeDay = whole
      bus?.emit('day.changed', { day: whole })
    }
    return simDt
  }

  label() {
    const h = this.hour
    const hh = String(Math.floor(h) % 24).padStart(2, '0')
    const mm = String(Math.floor((h % 1) * 60)).padStart(2, '0')
    return { day: this.wholeDay, time: `${hh}:${mm}` }
  }
}

/** Map 0..1 day fraction to hours so daylight takes `daylight` of the cycle */
export function dayFracToHour(f, daylight = 0.7) {
  if (f < daylight) return 6 + (f / daylight) * 14
  return (20 + ((f - daylight) / (1 - daylight)) * 10) % 24
}

/** Inverse of dayFracToHour, used when the user picks an hour on the timeline */
export function hourToDayFrac(h, daylight = 0.7) {
  const hh = ((h % 24) + 24) % 24
  if (hh >= 6 && hh < 20) return ((hh - 6) / 14) * daylight
  const n = hh >= 20 ? hh - 20 : hh + 4
  return daylight + (n / 10) * (1 - daylight)
}
