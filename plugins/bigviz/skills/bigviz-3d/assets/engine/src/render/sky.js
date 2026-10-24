// Realistic sky rig: Preetham Sky addon (with its cloud layer) as the background, and a
// PMREM environment rendered from the same sky (sun disc off) so PBR reflections and
// ambient match the time of day. The PMREM is re-baked only when the sun or clouds move.

import * as THREE from 'three'
import { Sky } from 'three/examples/jsm/objects/Sky.js'

export class SkyRig {
  /** @param {THREE.WebGLRenderer} renderer */
  constructor(renderer, scene) {
    this.renderer = renderer
    this.sky = new Sky()
    this.sky.name = 'sky'
    this.sky.scale.setScalar(9000)
    this.sky.frustumCulled = false
    this.sky.raycast = () => {}
    scene.add(this.sky)
    this.u = this.sky.material.uniforms
    this.u.mieDirectionalG.value = 0.8
    this.u.cloudScale.value = 0.00025
    this.u.cloudSpeed.value = 0.00003
    this.u.cloudElevation.value = 0.55
    // separate scene for env baking: same material, sun disc hidden while baking
    this.envSky = new Sky()
    this.envSky.material = this.sky.material
    this.envSky.scale.setScalar(900)
    this.envScene = new THREE.Scene()
    this.envScene.add(this.envSky)
    this.pmrem = new THREE.PMREMGenerator(renderer)
    this.rt = null
    this.sun = new THREE.Vector3(0, 1, 0)
    this._last = { sun: new THREE.Vector3(9, 9, 9), cover: -1, t: 0 }
    this.time = 0
  }

  /**
   * @param {THREE.Vector3} sunDir unit vector toward the sun
   * @param {{ cover:number, haze:number }} w 0..1 cloud cover and haze
   * @returns {THREE.Texture|null} new env texture when re-baked, else null
   */
  update(sunDir, w, dt, minInterval = 0.25) {
    const u = this.u
    this.time += dt
    u.time.value = this.time
    this.sun.copy(sunDir)
    u.sunPosition.value.copy(sunDir)
    u.turbidity.value = 2.2 + w.haze * 8
    u.rayleigh.value = 1.1 + w.haze * 1.6 - w.cover * 0.6
    u.mieCoefficient.value = 0.004 + w.haze * 0.012
    u.cloudCoverage.value = 0.18 + w.cover * 0.7
    u.cloudDensity.value = 0.35 + w.cover * 0.55
    this._cover = w.cover
    const L = this._last
    L.t += dt
    const moved = L.sun.angleTo(sunDir) > 0.012 || Math.abs(L.cover - w.cover) > 0.03
    if (!this.rt || (moved && L.t >= minInterval)) return this.bake()
    return null
  }

  /** keep the sky box centred on the camera (it renders at the far plane anyway) */
  follow(camera) {
    this.sky.position.copy(camera.position)
  }

  bake() {
    const L = this._last
    this.u.showSunDisc.value = 0
    const rt = this.pmrem.fromScene(this.envScene, 0, 1, 2000, { size: 128 })
    this.u.showSunDisc.value = 1
    this.rt?.dispose()
    this.rt = rt
    L.sun.copy(this.sun)
    L.cover = this._cover ?? 0
    L.t = 0
    return rt.texture
  }
}
