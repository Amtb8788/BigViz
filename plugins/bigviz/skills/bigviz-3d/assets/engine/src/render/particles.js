// Pooled particle FX: dust, exhaust, sparks, concrete splash, steam, leaves.
// One draw call per blend mode. Systems call fx.emit('dust', position, n).

import * as THREE from 'three'
import { radialTexture } from './textures.js'

const PRESETS = {
  dust: { color: [0.72, 0.62, 0.48], size: [1.2, 2.6], life: [1.6, 3], vel: [0.6, 0.9, 0.6], grav: -0.15, drag: 0.9, alpha: 0.42, add: false, grow: 1.8 },
  exhaust: { color: [0.35, 0.35, 0.36], size: [0.5, 0.9], life: [1, 1.8], vel: [0.2, 1.1, 0.2], grav: -0.1, drag: 0.8, alpha: 0.35, add: false, grow: 2.2 },
  steam: { color: [0.92, 0.92, 0.92], size: [0.5, 1.1], life: [1.5, 2.5], vel: [0.15, 0.8, 0.15], grav: -0.2, drag: 0.85, alpha: 0.25, add: false, grow: 2 },
  splash: { color: [0.55, 0.54, 0.5], size: [0.25, 0.5], life: [0.4, 0.8], vel: [1.2, 1.6, 1.2], grav: 9, drag: 0.98, alpha: 0.9, add: false, grow: 0.6 },
  sparks: { color: [1, 0.72, 0.28], size: [0.18, 0.35], life: [0.3, 0.8], vel: [2.4, 2.2, 2.4], grav: 9.8, drag: 0.97, alpha: 1, add: true, grow: 0.3 },
  leaves: { color: [0.42, 0.62, 0.24], size: [0.25, 0.4], life: [2, 4], vel: [0.8, 0.6, 0.8], grav: 0.8, drag: 0.95, alpha: 0.9, add: false, grow: 1 },
  confetti: { color: [1, 0.85, 0.3], size: [0.3, 0.5], life: [2, 3.5], vel: [2, 5, 2], grav: 3, drag: 0.96, alpha: 1, add: true, grow: 1 }
}

const VERT = /* glsl */ `
attribute float aSize;
attribute float aAlpha;
attribute vec3 aColor;
varying float vAlpha;
varying vec3 vColor;
uniform float uScale;
void main() {
  vAlpha = aAlpha;
  vColor = aColor;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = aSize * uScale / -mv.z;
  gl_Position = projectionMatrix * mv;
}`

const FRAG = /* glsl */ `
uniform sampler2D uMap;
varying float vAlpha;
varying vec3 vColor;
void main() {
  vec4 t = texture2D(uMap, gl_PointCoord);
  gl_FragColor = vec4(vColor, t.a * vAlpha);
  if (gl_FragColor.a < 0.01) discard;
  #include <colorspace_fragment>
}`

class Pool {
  constructor(max, additive) {
    this.max = max
    this.n = 0
    this.p = new Float32Array(max * 3)
    this.v = new Float32Array(max * 3)
    this.size = new Float32Array(max)
    this.size0 = new Float32Array(max)
    this.alpha = new Float32Array(max)
    this.color = new Float32Array(max * 3)
    this.life = new Float32Array(max)
    this.age = new Float32Array(max)
    this.preset = new Array(max)
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(this.p, 3).setUsage(THREE.DynamicDrawUsage))
    geo.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage))
    geo.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage))
    geo.setAttribute('aColor', new THREE.BufferAttribute(this.color, 3).setUsage(THREE.DynamicDrawUsage))
    geo.setDrawRange(0, 0)
    this.mat = new THREE.ShaderMaterial({
      uniforms: { uMap: { value: radialTexture() }, uScale: { value: 600 } },
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending
    })
    this.points = new THREE.Points(geo, this.mat)
    this.points.frustumCulled = false
    this.points.renderOrder = 5
  }
}

export class ParticleFX {
  constructor(scene) {
    this.normal = new Pool(1800, false)
    this.add = new Pool(600, true)
    scene.add(this.normal.points, this.add.points)
    this.budget = 1
    this._rand = Math.random
  }

  /** @param {keyof PRESETS} type @param {{x:number,y:number,z:number}} at */
  emit(type, at, count = 6, opts = {}) {
    const pr = PRESETS[type]
    if (!pr) return
    const pool = pr.add ? this.add : this.normal
    const n = Math.max(1, Math.round(count * this.budget))
    const r = this._rand
    for (let k = 0; k < n; k++) {
      if (pool.n >= pool.max) return
      const i = pool.n++
      pool.p[i * 3] = at.x + (r() - 0.5) * (opts.spread ?? 0.6)
      pool.p[i * 3 + 1] = at.y + (r() - 0.5) * 0.2
      pool.p[i * 3 + 2] = at.z + (r() - 0.5) * (opts.spread ?? 0.6)
      const dir = opts.dir || { x: 0, y: 1, z: 0 }
      pool.v[i * 3] = (r() * 2 - 1) * pr.vel[0] + dir.x * (opts.speed || 0)
      pool.v[i * 3 + 1] = r() * pr.vel[1] + dir.y * (opts.speed || 0)
      pool.v[i * 3 + 2] = (r() * 2 - 1) * pr.vel[2] + dir.z * (opts.speed || 0)
      pool.size0[i] = pr.size[0] + r() * (pr.size[1] - pr.size[0])
      pool.life[i] = pr.life[0] + r() * (pr.life[1] - pr.life[0])
      pool.age[i] = 0
      const c = opts.color || pr.color
      const jitter = 0.9 + r() * 0.2
      pool.color[i * 3] = c[0] * jitter
      pool.color[i * 3 + 1] = c[1] * jitter
      pool.color[i * 3 + 2] = c[2] * jitter
      pool.preset[i] = pr
    }
  }

  update(dt, viewportH = 900) {
    for (const pool of [this.normal, this.add]) {
      pool.mat.uniforms.uScale.value = viewportH * 0.9
      let i = 0
      while (i < pool.n) {
        pool.age[i] += dt
        if (pool.age[i] >= pool.life[i]) {
          this._swap(pool, i, --pool.n)
          continue
        }
        const pr = pool.preset[i]
        const t = pool.age[i] / pool.life[i]
        const drag = Math.pow(pr.drag, dt * 60)
        pool.v[i * 3] *= drag
        pool.v[i * 3 + 2] *= drag
        pool.v[i * 3 + 1] = pool.v[i * 3 + 1] * drag - pr.grav * dt
        pool.p[i * 3] += pool.v[i * 3] * dt
        pool.p[i * 3 + 1] = Math.max(0.02, pool.p[i * 3 + 1] + pool.v[i * 3 + 1] * dt)
        pool.p[i * 3 + 2] += pool.v[i * 3 + 2] * dt
        pool.size[i] = pool.size0[i] * (1 + (pr.grow - 1) * t)
        pool.alpha[i] = pr.alpha * (t < 0.15 ? t / 0.15 : 1 - (t - 0.15) / 0.85)
        i++
      }
      const geo = pool.points.geometry
      geo.setDrawRange(0, pool.n)
      for (const k of ['position', 'aSize', 'aAlpha', 'aColor']) geo.attributes[k].needsUpdate = true
    }
  }

  _swap(pool, i, j) {
    if (i === j) return
    for (let k = 0; k < 3; k++) {
      pool.p[i * 3 + k] = pool.p[j * 3 + k]
      pool.v[i * 3 + k] = pool.v[j * 3 + k]
      pool.color[i * 3 + k] = pool.color[j * 3 + k]
    }
    pool.size0[i] = pool.size0[j]
    pool.size[i] = pool.size[j]
    pool.alpha[i] = pool.alpha[j]
    pool.life[i] = pool.life[j]
    pool.age[i] = pool.age[j]
    pool.preset[i] = pool.preset[j]
  }

  clear() {
    this.normal.n = 0
    this.add.n = 0
  }
}
