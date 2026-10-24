// Weather: clear | cloudy | rain | storm | snow | fog. Blends over ~3 s.
// Rain = line streaks, snow = drifting points (both around the camera target),
// wet ground (lower roughness), snow cover (shader patch on up-facing surfaces),
// wind (tree sway, crane hook), storm lightning flashes, splash particles.

import * as THREE from 'three'
import { damp } from '../core/math.js'

export const WEATHERS = {
  clear: { sun: 1, ambient: 1, dark: 0, rain: 0, snow: 0, wet: 0, wind: 0.2, fogMix: 0, fogNear: 1, fogFar: 1 },
  cloudy: { sun: 0.45, ambient: 0.9, dark: 0.1, rain: 0, snow: 0, wet: 0, wind: 0.5, fogMix: 0.3, fogNear: 0.8, fogFar: 0.85 },
  rain: { sun: 0.3, ambient: 0.75, dark: 0.25, rain: 1, snow: 0, wet: 1, wind: 0.6, fogMix: 0.45, fogNear: 0.6, fogFar: 0.7 },
  storm: { sun: 0.15, ambient: 0.6, dark: 0.45, rain: 1.6, snow: 0, wet: 1, wind: 1.6, fogMix: 0.55, fogNear: 0.5, fogFar: 0.6 },
  snow: { sun: 0.5, ambient: 1.05, dark: 0.1, rain: 0, snow: 1, wet: 0.2, wind: 0.4, fogMix: 0.5, fogNear: 0.55, fogFar: 0.7 },
  fog: { sun: 0.4, ambient: 0.9, dark: 0.1, rain: 0, snow: 0, wet: 0.3, wind: 0.1, fogMix: 0.9, fogNear: 0.18, fogFar: 0.34 }
}
export const WEATHER_LABELS = { clear: '晴', cloudy: '多云', rain: '雨', storm: '雷雨', snow: '雪', fog: '雾' }

/** Shared uniform for the snow-cover shader patch */
export const snowUniform = { value: 0 }

/** Patch a MeshStandardMaterial so up-facing fragments turn white with snowUniform */
export function snowable(m) {
  if (m.userData.snowable) return m
  m.userData.snowable = true
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uSnow = snowUniform
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uSnow;')
      .replace(
        '#include <lights_fragment_begin>',
        `{ vec3 wN = normalize((vec4(normal, 0.0) * viewMatrix).xyz);
           float up = smoothstep(0.55, 0.9, wN.y);
           float k = up * uSnow;
           diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.93, 0.95, 0.98), k);
           roughnessFactor = mix(roughnessFactor, 0.9, k); }
         #include <lights_fragment_begin>`
      )
  }
  m.customProgramCacheKey = () => 'snowable'
  m.needsUpdate = true
  return m
}

export class WeatherSystem {
  constructor(scene, fx) {
    this.scene = scene
    this.fx = fx
    this.current = 'clear'
    this.mix = { ...WEATHERS.clear, fogColor: new THREE.Color('#9aa3ad') }
    this.flash = 0
    this.wetMats = []
    this.trees = []
    this.center = new THREE.Vector3()
    this.snowCover = 0
    this._buildRain()
    this._buildSnow()
  }

  set(name) {
    if (WEATHERS[name]) this.current = name
  }

  /** materials that look wet in rain: [{material, dry}] */
  addWet(m) {
    this.wetMats.push({ m, rough: m.roughness, color: m.color.clone() })
  }

  _buildRain() {
    const N = 2400
    this.rainN = N
    this.rainPos = new Float32Array(N * 6)
    this.rainSeed = new Float32Array(N * 3)
    for (let i = 0; i < N; i++) { this.rainSeed[i * 3] = Math.random(); this.rainSeed[i * 3 + 1] = Math.random(); this.rainSeed[i * 3 + 2] = Math.random() }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(this.rainPos, 3).setUsage(THREE.DynamicDrawUsage))
    this.rain = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: '#aac4dd', transparent: true, opacity: 0, depthWrite: false }))
    this.rain.frustumCulled = false
    this.scene.add(this.rain)
  }

  _buildSnow() {
    const N = 1800
    this.snowN = N
    this.snowPos = new Float32Array(N * 3)
    for (let i = 0; i < N * 3; i++) this.snowPos[i] = Math.random()
    this.snowSeed = this.snowPos.slice()
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(this.snowPos, 3).setUsage(THREE.DynamicDrawUsage))
    this.snow = new THREE.Points(g, new THREE.PointsMaterial({ color: '#ffffff', size: 0.45, transparent: true, opacity: 0, depthWrite: false }))
    this.snow.frustumCulled = false
    this.scene.add(this.snow)
  }

  update(dt, time, camTarget, budget = 1) {
    const T = WEATHERS[this.current]
    const k = damp(0.8, dt)
    for (const key of Object.keys(T)) this.mix[key] += (T[key] - this.mix[key]) * k
    const m = this.mix
    this.center.copy(camTarget)
    // rain streaks
    const rainOn = m.rain > 0.02
    this.rain.visible = rainOn
    if (rainOn) {
      const n = Math.floor(this.rainN * Math.min(1, m.rain) * budget)
      const R = 70
      const H = 45
      const slant = m.wind * 0.35
      for (let i = 0; i < n; i++) {
        const sx = this.rainSeed[i * 3]
        const sy = this.rainSeed[i * 3 + 1]
        const sz = this.rainSeed[i * 3 + 2]
        const y = H - (((time * (32 + sy * 10)) + sy * H) % H)
        const x = this.center.x + (sx - 0.5) * R * 2 + slant * y
        const z = this.center.z + (sz - 0.5) * R * 2
        const o = i * 6
        this.rainPos[o] = x; this.rainPos[o + 1] = y; this.rainPos[o + 2] = z
        this.rainPos[o + 3] = x - slant * 1.4; this.rainPos[o + 4] = y + 1.4; this.rainPos[o + 5] = z
      }
      this.rain.geometry.setDrawRange(0, n * 2)
      this.rain.geometry.attributes.position.needsUpdate = true
      this.rain.material.opacity = 0.35 * Math.min(1, m.rain)
      if (Math.random() < dt * 14 * m.rain * budget) this.fx.emit('splash', { x: this.center.x + (Math.random() - 0.5) * 80, y: 0.05, z: this.center.z + (Math.random() - 0.5) * 60 }, 3)
    }
    // snow
    const snowOn = m.snow > 0.02
    this.snow.visible = snowOn
    if (snowOn) {
      const R = 75
      const H = 45
      const n = Math.floor(this.snowN * budget)
      for (let i = 0; i < n; i++) {
        const s = this.snowSeed
        const y = H - (((time * (2.4 + s[i * 3 + 1] * 1.6)) + s[i * 3 + 1] * H) % H)
        this.snowPos[i * 3] = this.center.x + (s[i * 3] - 0.5) * R * 2 + Math.sin(time * 0.8 + i) * 1.2 + m.wind * y * 0.2
        this.snowPos[i * 3 + 1] = y
        this.snowPos[i * 3 + 2] = this.center.z + (s[i * 3 + 2] - 0.5) * R * 2 + Math.cos(time * 0.6 + i * 0.7) * 1.2
      }
      this.snow.geometry.setDrawRange(0, n)
      this.snow.geometry.attributes.position.needsUpdate = true
      this.snow.material.opacity = 0.9 * m.snow
    }
    // snow accumulates slowly, melts faster
    this.snowCover += (m.snow > 0.5 ? dt * 0.05 : -dt * 0.08)
    this.snowCover = Math.max(0, Math.min(0.85, this.snowCover))
    snowUniform.value = this.snowCover
    // wet ground
    for (const w of this.wetMats) {
      w.m.roughness = w.rough + (0.18 - w.rough) * m.wet * 0.85
      w.m.color.copy(w.color).multiplyScalar(1 - m.wet * 0.28)
    }
    // lightning
    this.flash *= Math.exp(-dt * 9)
    if (this.current === 'storm' && Math.random() < dt * 0.25) this.flash = 1
    // wind sway
    for (const t of this.trees) {
      const s = Math.sin(time * (1.3 + m.wind) + t.phase) * 0.03 * (0.4 + m.wind)
      t.canopy.rotation.z = s
      t.canopy.rotation.x = s * 0.6
    }
    this.mix.fogColor.set(this.current === 'snow' ? '#c9d3dc' : '#8e98a3')
  }
}
