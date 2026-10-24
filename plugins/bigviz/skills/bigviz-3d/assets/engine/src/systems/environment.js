// Time of day + lighting. Hour -> sun/moon, sky, fog, exposure, desk lamp, night factor.
// Night factor drives every emissive "night lit" material, glow groups, head-light beams
// and the few real floodlight spot lights. Weather multiplies on top (see weather.js).

import * as THREE from 'three'
import { clamp, keyframes, smoothstep } from '../core/math.js'
import { nightLit } from '../render/materials.js'
import { beamMat } from '../prefabs/vehicles.js'
import { sunDirection } from '../render/style.js'

const C = (hex) => new THREE.Color(hex)
const SKY = [[0, C('#0e1320')], [5, C('#1a2133')], [6.5, C('#e9a87a')], [8, C('#d9d2c4')], [12, C('#ddd8cc')], [17, C('#e3c9a6')], [18.6, C('#d9875a')], [19.6, C('#3a3048')], [21, C('#141a2a')], [24, C('#0e1320')]]
const SUNC = [[5.5, C('#ff9a5a')], [7.5, C('#ffe2bf')], [12, C('#fff4e2')], [16.5, C('#ffdcae')], [18.5, C('#ff8a4a')], [19.5, C('#6d7fb8')]]

function colorAt(keys, h, out) {
  if (h <= keys[0][0]) return out.copy(keys[0][1])
  for (let i = 1; i < keys.length; i++) {
    if (h <= keys[i][0]) {
      const [h0, c0] = keys[i - 1]
      const [h1, c1] = keys[i]
      return out.copy(c0).lerp(c1, (h - h0) / (h1 - h0))
    }
  }
  return out.copy(keys[keys.length - 1][1])
}

export class EnvironmentSystem {
  /**
   * @param {import('../render/stage.js').Stage} stage
   * @param {import('../render/glows.js').GlowField} glows
   */
  constructor(stage, glows, opts = {}) {
    this.stage = stage
    this.glows = glows
    this.night = 0
    this.siteActive = true
    this.windowsLit = 1
    this.spots = []
    this.opts = opts
    this._c = new THREE.Color()
  }

  /** Real spot lights for the site floodlight masts (max 3) */
  addSpot(pos, target, color = '#ffc06a') {
    if (this.spots.length >= 3) return null
    const s = new THREE.SpotLight(color, 0, 70, 0.75, 0.6, 1.6)
    s.position.copy(pos)
    s.target.position.copy(target)
    s.castShadow = false
    this.stage.scene.add(s, s.target)
    this.spots.push(s)
    return s
  }

  update(hour, weather, dt) {
    if (this.stage.skyRig) return this._updateRealistic(hour, weather, dt)
    const st = this.stage
    const w = weather.mix
    const sun = keyframes([[0, 0], [5.6, 0], [7, 1.6], [10, 2.7], [15, 2.7], [17.8, 1.7], [19.2, 0.2], [20, 0], [24, 0]], hour) * w.sun
    const night = 1 - smoothstep(0.15, 1.2, sun / Math.max(0.2, w.sun))
    this.night = clamp(night + w.dark * 0.35, 0, 1)
    const n = this.night

    // sun path: east (+x) in the morning to west (-x) in the evening, elevation kept >= 25deg
    const t = clamp((hour - 6) / 13, 0, 1)
    const az = lerpA(-1.9, 1.9, t)
    const el = 0.45 + Math.sin(t * Math.PI) * 0.6
    if (sun > 0.05) {
      st.sun.position.set(Math.sin(az) * 120 * Math.cos(el) * -1, Math.sin(el) * 120, Math.cos(az) * 120 * Math.cos(el) * 0.6 + 30)
      st.sun.intensity = sun
      colorAt(SUNC, hour, st.sun.color)
    } else {
      st.sun.position.set(-60, 110, -50)
      st.sun.intensity = 0.35 * w.sun
      st.sun.color.set('#9fb2e8')
    }
    st.hemi.intensity = (0.25 + (1 - n) * 0.75) * w.ambient + weather.flash * 3
    st.hemi.color.set(n > 0.5 ? '#6b7fb3' : '#dfe9ff')
    st.lamp.intensity = n * 900 * (this.opts.deskLamp ?? 1)
    colorAt(SKY, hour, this._c)
    this._c.lerp(w.fogColor, w.fogMix)
    st.scene.background.copy(this._c).multiplyScalar(0.55)
    st.scene.fog.color.copy(this._c).multiplyScalar(0.55)
    st.scene.fog.near = 220 * w.fogNear
    st.scene.fog.far = 640 * w.fogFar
    st.renderer.toneMappingExposure = 1.0 + n * 0.25
    st.scene.environmentIntensity = 0.65 - n * 0.45
    if (st.bloom) st.bloom.strength = 0.18 + n * 0.62

    // emissive + glows
    const site = n * (this.siteActive ? 1 : 0.15)
    for (const l of nightLit) {
      const lvl = l.group === 'site' ? site : l.group === 'windows' ? n * this.windowsLit : l.group === 'vehicle' ? 0.25 + n * 0.75 : n
      l.material.emissiveIntensity = 0.03 + lvl * l.base
    }
    this.glows.setLevel('street', n)
    this.glows.setLevel('street.new', n)
    this.glows.setLevel('site', site)
    this.glows.setLevel('windows', n * this.windowsLit)
    beamMat.opacity = n * 0.16
    beamMat.visible = n > 0.05
    for (const s of this.spots) s.intensity = site * 2200
  }
}

const lerpA = (a, b, t) => a + (b - a) * t

// realistic style: horizon haze colour by hour (fog must roughly match the sky's horizon)
const HAZE = [[0, C('#0b0f18')], [5, C('#141a26')], [6, C('#c89b84')], [7.5, C('#c3c9cf')], [12, C('#bcc8d4')], [17, C('#c9c3b8')], [18.8, C('#d29a76')], [19.8, C('#3a3a4a')], [21, C('#10141e')], [24, C('#0b0f18')]]
const _sd = new THREE.Vector3()
const _sv = { x: 0, y: 0, z: 0 }

EnvironmentSystem.prototype._updateRealistic = function (hour, weather, dt) {
  const st = this.stage
  const w = weather.mix
  sunDirection(hour, _sv)
  _sd.set(_sv.x, _sv.y, _sv.z)
  const el = Math.asin(clamp(_sv.y, -1, 1))
  const cover = clamp(1 - w.sun, 0, 1)
  const env = st.skyRig.update(_sd, { cover, haze: clamp(w.fogMix, 0, 1) }, dt, st.q.ao ? 0.25 : 1)
  if (env) st.scene.environment = env
  // night factor from real sun elevation, darkened by weather
  const day = smoothstep(-0.1, 0.12, el)
  this.night = clamp(1 - day + w.dark * 0.35, 0, 1)
  const n = this.night
  // sun light (clamped elevation for stable shadows) or a dim cool moon
  if (el > -0.02) {
    const e = Math.max(el, 0.12)
    const c = Math.cos(e)
    st.sun.position.set(_sv.x / Math.max(1e-3, Math.hypot(_sv.x, _sv.z)) * c * 260, Math.sin(e) * 260, _sv.z / Math.max(1e-3, Math.hypot(_sv.x, _sv.z)) * c * 260)
    const warm = smoothstep(0, 0.45, el)
    st.sun.color.set('#ff9a5c').lerp(_wc.set('#fff3e3'), warm)
    st.sun.intensity = 3.2 * smoothstep(-0.02, 0.2, el) * (0.25 + w.sun * 0.75)
  } else {
    st.sun.position.set(-120, 200, -90)
    st.sun.color.set('#9fb4e6')
    st.sun.intensity = 0.25 * w.sun
  }
  st.hemi.color.set(n > 0.5 ? '#4a5a80' : '#cfdcf0')
  st.hemi.groundColor.set('#4a4238')
  st.hemi.intensity = (0.06 + (1 - n) * 0.12) * w.ambient + weather.flash * 3
  // keep sky fill well below the sun so shadows read (too much env = flat, washed out)
  st.scene.environmentIntensity = (0.08 + day * 0.42) * (0.75 + 0.25 * w.ambient)
  st.renderer.toneMappingExposure = st.style.exposure * (1 + n * 0.9) * (1 + cover * 0.25)
  // exp fog: base haze, thicker with weather; colour follows the horizon
  colorAt(HAZE, hour, this._c)
  this._c.lerp(w.fogColor, w.fogMix * 0.8 * day)
  st.scene.fog.color.copy(this._c)
  st.scene.fog.density = 0.0011 / Math.max(0.15, w.fogNear) + w.fogMix * 0.002
  st.bloom.strength = n * 0.45
  // emissive + glows (same grouping as diorama, slightly lower base so bloom stays subtle)
  const site = n * (this.siteActive ? 1 : 0.15)
  for (const l of nightLit) {
    const lvl = l.group === 'site' ? site : l.group === 'windows' ? n * this.windowsLit : l.group === 'vehicle' ? 0.25 + n * 0.75 : n
    l.material.emissiveIntensity = 0.02 + lvl * l.base * 1.4
  }
  this.glows.setLevel('street', n)
  this.glows.setLevel('street.new', n)
  this.glows.setLevel('site', site)
  this.glows.setLevel('windows', n * this.windowsLit)
  beamMat.opacity = n * 0.1
  beamMat.visible = n > 0.05
  for (const s of this.spots) s.intensity = site * 2200
}
const _wc = new THREE.Color()
