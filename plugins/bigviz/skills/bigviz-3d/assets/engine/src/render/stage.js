// Stage: renderer, scene root, light rig, post FX, quality tiers and frame capture.
// Units: 1 = 1 metre of the model world. The board (plinth) top is y = 0.

import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js'
import { TiltShiftShader } from './tiltshift.js'
import { SkyRig } from './sky.js'
import { STYLES } from './style.js'
import { setDetail } from './detail.js'

// ao: GTAO pass (realistic style only)
export const QUALITY = {
  low: { pixelRatio: 1, shadows: 0, post: false, bloom: false, samples: 0, particles: 0.4 },
  medium: { pixelRatio: 1, shadows: 1024, post: false, cssTilt: true, bloom: false, samples: 0, particles: 0.7 },
  high: { pixelRatio: 1.5, shadows: 2048, post: true, bloom: true, ao: true, samples: 4, particles: 1 }
}

export class Stage {
  /** @param {HTMLCanvasElement} canvas */
  constructor(canvas, { boardHalf = 50 } = {}) {
    this.canvas = canvas
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' })
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.05
    renderer.shadowMap.enabled = true
    // PCFSoft was removed in r18x (falls back with a warning); PCF + shadow.radius is soft
    renderer.shadowMap.type = THREE.PCFShadowMap
    this.renderer = renderer
    this.style = STYLES.diorama
    this.skyRig = null
    this.gtao = null

    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color('#1b1712')
    this.scene.fog = new THREE.Fog('#1b1712', 260, 620)

    const pmrem = new THREE.PMREMGenerator(renderer)
    this.envMap = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
    this.scene.environment = this.envMap
    this.scene.environmentIntensity = 0.6
    pmrem.dispose()

    this.camera = new THREE.PerspectiveCamera(32, 16 / 9, 0.5, 2000)
    this.camera.position.set(95, 85, 110)

    // light rig
    this.hemi = new THREE.HemisphereLight('#dfe9ff', '#5a4632', 0.9)
    this.sun = new THREE.DirectionalLight('#fff1d6', 2.6)
    this.sun.position.set(60, 90, 40)
    this.sun.castShadow = true
    const sc = this.sun.shadow.camera
    sc.left = -boardHalf; sc.right = boardHalf; sc.top = boardHalf; sc.bottom = -boardHalf
    sc.near = 10; sc.far = 260
    this.sun.shadow.bias = -0.0004
    this.sun.shadow.normalBias = 0.04
    this.sun.shadow.mapSize.set(2048, 2048)
    this.lamp = new THREE.SpotLight('#ffcf8a', 0, 520, 0.62, 0.55, 1.2)
    this.lamp.position.set(-150, 170, -120)
    this.lamp.target.position.set(0, 0, 0)
    this.scene.add(this.hemi, this.sun, this.sun.target, this.lamp, this.lamp.target)

    this.root = new THREE.Group()
    this.root.name = 'world'
    this.scene.add(this.root)

    this.quality = 'high'
    this.tilt = { enabled: true, focus: 0.5, amount: 1 }
    this.size = { w: 1, h: 1 }
    this._buildComposer()
    this.setQuality('high')
  }

  _buildComposer() {
    const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 })
    this.composer = new EffectComposer(this.renderer, rt)
    // the scene always renders into renderTarget1 (MSAA + depth texture); see _pinSceneTarget
    this.sceneDepth = new THREE.DepthTexture(1, 1)
    this.sceneDepth.type = THREE.UnsignedIntType
    this.composer.renderTarget1.depthTexture = this.sceneDepth
    this.renderPass = new RenderPass(this.scene, this.camera)
    // one pass, always enabled (amount 0 = pass-through) so the ping-pong order stays fixed
    this.tiltPass = new ShaderPass(TiltShiftShader)
    // bloom makes floodlights / windows glow at night; strength is driven by EnvironmentSystem
    this.bloom = new UnrealBloomPass(new THREE.Vector2(512, 512), 0.35, 0.6, 0.82)
    this.composer.addPass(this.renderPass)
    this.composer.addPass(this.bloom)
    this.composer.addPass(this.tiltPass)
    this.composer.addPass(new OutputPass())
  }

  /** Switch visual style; call once before the scene is built ('diorama' is the default) */
  setStyle(id) {
    const s = STYLES[id] || STYLES.diorama
    this.style = s
    const cam = this.camera
    cam.near = s.near
    cam.far = s.far
    cam.fov = s.fov
    cam.updateProjectionMatrix()
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = s.exposure
    if (s.sky) {
      this.scene.background = null
      this.scene.fog = new THREE.FogExp2('#b9c4cf', 0.0011)
      this.skyRig ??= new SkyRig(this.renderer, this.scene)
      this.lamp.intensity = 0
      // soft PCF shadows over the whole board + street ring
      const sc = this.sun.shadow.camera
      sc.left = -95; sc.right = 95; sc.top = 95; sc.bottom = -95
      sc.near = 20; sc.far = 520
      sc.updateProjectionMatrix()
      this.sun.shadow.radius = 3
      this.sun.shadow.bias = -0.0003
      this.sun.shadow.normalBias = 0.05
      // subtle bloom: only HDR emissives (lamps, windows at night) pass the threshold
      this.bloom.threshold = 1.6
      this.bloom.radius = 0.45
      this.bloom.strength = 0
      if (!this.gtao) {
        this.gtao = new GTAOPass(this.scene, this.camera, 512, 512)
        // depth from the scene pass, normals reconstructed from depth: no second geometry pass.
        // (passing depthTexture to the constructor crashes in r186: it reads normalRenderTarget
        // before creating it, so build the default G-buffer first, then swap the source)
        this.gtao.setGBuffer(this.sceneDepth)
        this.gtao.blendIntensity = 0.85
        this.gtao.updateGtaoMaterial({ radius: 1.6, distanceExponent: 1.5, thickness: 2, scale: 1, samples: 12 })
        this.gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 12 })
        this.composer.insertPass(this.gtao, 1)
      }
    }
    this.setTilt({ enabled: s.tilt })
    this.setQuality(this.quality)
  }

  setQuality(name) {
    const q = QUALITY[name] || QUALITY.high
    this.quality = name
    this.q = q
    setDetail(name)
    const dpr = Math.min(window.devicePixelRatio || 1, q.pixelRatio)
    this.renderer.setPixelRatio(dpr)
    this.renderer.shadowMap.enabled = q.shadows > 0
    this.sun.castShadow = q.shadows > 0
    if (q.shadows && this.sun.shadow.mapSize.x !== q.shadows) {
      this.sun.shadow.mapSize.set(q.shadows, q.shadows)
      this.sun.shadow.map?.dispose()
      this.sun.shadow.map = null
    }
    // MSAA only matters for the scene render; the other ping-pong buffer stays single-sample
    this.composer.renderTarget1.samples = q.samples
    this.composer.renderTarget2.samples = 0
    this.composer.setPixelRatio(dpr)
    this.bloom.enabled = q.bloom
    if (this.gtao) this.gtao.enabled = !!q.ao
    this.forcePost = false
    this._cssTilt()
    this.resize(this.size.w, this.size.h)
    // materials must recompile when shadow state flips
    this.scene.traverse((o) => { if (o.material) [].concat(o.material).forEach((m) => (m.needsUpdate = true)) })
  }

  resize(w, h) {
    this.size = { w: Math.max(1, w), h: Math.max(1, h) }
    this.renderer.setSize(this.size.w, this.size.h, false)
    this.composer.setSize(this.size.w, this.size.h)
    this.camera.aspect = this.size.w / this.size.h
    this.camera.updateProjectionMatrix()
    const pr = this.renderer.getPixelRatio()
    const u = this.tiltPass.uniforms
    u.texel.value = [1 / (this.size.w * pr), 1 / (this.size.h * pr)]
    u.maxPx.value = 6 * pr
  }

  setTilt({ enabled, focus, amount } = {}) {
    if (enabled != null) { this.tilt.enabled = enabled; this._cssTilt() }
    if (focus != null) this.tilt.focus = focus
    if (amount != null) this.tilt.amount = amount
    this.tiltPass.uniforms.focus.value = this.tilt.focus
    this.resize(this.size.w, this.size.h)
  }

  render(camera = this.camera) {
    const ri = this.renderer.info
    ri.autoReset = false
    ri.reset()
    const tiltOn = this.tilt.enabled && this.tilt.amount > 0.01
    this.tiltPass.uniforms.amount.value = tiltOn ? this.tilt.amount : 0
    this.skyRig?.follow(camera)
    // realistic: bloom only when there is something to bloom (night lights)
    const bloomOn = this.bloom.enabled && (!this.style.sky || this.bloom.strength > 0.02)
    const aoOn = !!this.gtao?.enabled
    if ((this.q.post || this.forcePost) && (tiltOn || bloomOn || aoOn)) {
      this.renderPass.camera = camera
      if (this.gtao) this.gtao.camera = camera
      const b = this.bloom.enabled
      this.bloom.enabled = bloomOn
      this._pinSceneTarget()
      this.composer.render()
      this.bloom.enabled = b
    } else {
      this.renderer.render(this.scene, camera)
    }
  }

  /**
   * RenderPass draws into composer.readBuffer, and the pass chain swaps an odd or even number of
   * times depending on which passes are enabled. Without pinning, the scene alternated between the
   * MSAA target and the plain one (AA flickering frame to frame, AO reading a stale depth).
   */
  _pinSceneTarget() {
    const C = this.composer
    C.readBuffer = C.renderTarget1
    C.writeBuffer = C.renderTarget2
  }

  /**
   * Render one frame from `camera` and copy it into a small data URL (shot dock thumbnails).
   * Copies in the same task as the draw, so preserveDrawingBuffer is not needed.
   */
  snapshot(camera, w = 192, h = 108) {
    const prevAspect = camera.aspect
    camera.aspect = this.size.w / this.size.h
    camera.updateProjectionMatrix()
    this.renderer.render(this.scene, camera)
    const c = document.createElement('canvas')
    c.width = w
    c.height = h
    const ctx = c.getContext('2d')
    const sw = this.canvas.width
    const sh = this.canvas.height
    const srcAspect = sw / sh
    const dstAspect = w / h
    let sx = 0, sy = 0, cw = sw, ch = sh
    if (srcAspect > dstAspect) { cw = sh * dstAspect; sx = (sw - cw) / 2 } else { ch = sw / dstAspect; sy = (sh - ch) / 2 }
    ctx.drawImage(this.canvas, sx, sy, cw, ch, 0, 0, w, h)
    camera.aspect = prevAspect
    camera.updateProjectionMatrix()
    // restore the main view: when the rAF loop is paused (deterministic capture) nothing else
    // would redraw it, and screenshots would show the last thumbnail instead
    this.render()
    return c.toDataURL('image/jpeg', 0.82)
  }

  /** medium quality: tilt-shift as a CSS backdrop blur overlay (no extra GPU passes in WebGL) */
  _cssTilt() {
    const on = !!this.q.cssTilt && this.tilt.enabled && !this.forcePost
    document.body.classList.toggle('css-tilt', on)
  }

  /** recorder: burn the real tilt-shift into the video regardless of quality */
  setForcePost(on) {
    this.forcePost = on
    if (on) { this.composer.renderTarget1.samples = Math.max(2, this.q.samples) }
    this._cssTilt()
  }

  get info() {
    const i = this.renderer.info
    return { calls: i.render.calls, triangles: i.render.triangles, geometries: i.memory.geometries, textures: i.memory.textures }
  }
}
