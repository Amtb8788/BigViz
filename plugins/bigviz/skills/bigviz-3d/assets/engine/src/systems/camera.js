// CameraManager: free diorama orbit (OrbitControls, clamped), data-driven shots
// (static / orbit / follow / dolly / crane / ride / top / street), eased blends between
// shots, walk mode (WASD at eye height), collision with ground + building boxes.

import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { clamp, easeInOut, lerp } from '../core/math.js'

const V = (a) => new THREE.Vector3(a[0], a[1], a[2])
const tmp = new THREE.Vector3()
const tmp2 = new THREE.Vector3()

export class CameraManager {
  /**
   * @param {THREE.PerspectiveCamera} camera
   * @param {HTMLElement} dom
   * @param {{ bounds:{x:number,z:number}, minDist?:number, maxDist?:number, home:object, colliders?:THREE.Box3[] }} cfg
   */
  constructor(camera, dom, ctx, cfg) {
    this.camera = camera
    this.ctx = ctx
    this.cfg = cfg
    this.controls = new OrbitControls(camera, dom)
    const c = this.controls
    c.enableDamping = true
    c.dampingFactor = 0.08
    c.minDistance = cfg.minDist ?? 12
    c.maxDistance = cfg.maxDist ?? 330
    c.minPolarAngle = 0.08
    c.maxPolarAngle = 1.45
    c.zoomSpeed = 0.9
    c.screenSpacePanning = false
    c.addEventListener('start', () => this._userTook())
    this.shot = null
    this.shotT = 0
    this.blend = null
    this.mode = 'free'
    this.colliders = cfg.colliders || []
    this.pose = { pos: camera.position.clone(), look: new THREE.Vector3(), fov: camera.fov }
    this.walk = { yaw: 0, pitch: -0.05, keys: new Set(), pos: new THREE.Vector3() }
    this.listeners = new Set()
    this._bindWalk(dom)
    this.setPose(this.evalShot(cfg.home, 0))
    this.controls.target.copy(this.pose.look)
  }

  onChange(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn) }
  _emit() { this.listeners.forEach((f) => f(this)) }

  _userTook() {
    if (this.mode === 'shot' && !this.shot?.lockInput) {
      this.mode = 'free'
      this.shot = null
      this.blend = null
      this._emit()
    }
  }

  setPose(p) {
    this.camera.position.copy(p.pos)
    this.camera.lookAt(p.look)
    if (p.fov && Math.abs(this.camera.fov - p.fov) > 0.01) { this.camera.fov = p.fov; this.camera.updateProjectionMatrix() }
    this.pose.pos.copy(p.pos)
    this.pose.look.copy(p.look)
    this.pose.fov = p.fov ?? this.camera.fov
  }

  /** Switch to a shot with an eased blend from wherever the camera is */
  play(shot, { blend = 1.4 } = {}) {
    if (!shot) return
    if (shot.type === 'walk') return this.startWalk(shot)
    this.mode = 'shot'
    this.shot = shot
    this.shotT = shot.t0 || 0
    this._afterBlend = false
    this.blend = blend > 0 ? { t: 0, dur: shot.blend ?? blend, from: { pos: this.camera.position.clone(), look: this._lookPoint(), fov: this.camera.fov } } : null
    this._emit()
  }

  /** Free orbit around an entity that keeps moving */
  follow(entity, dist = 28) {
    this.play({ id: `follow:${entity.id}`, name: entity.name, type: 'follow', entity: entity.id, dist, height: dist * 0.55, orbit: 0.06 })
  }

  free() {
    this.mode = 'free'
    this.shot = null
    this.controls.target.copy(this._lookPoint())
    this._emit()
  }

  _lookPoint() {
    const d = this.camera.getWorldDirection(tmp).clone()
    const t = this.controls.target
    const dist = this.camera.position.distanceTo(t) || 60
    return this.camera.position.clone().addScaledVector(d, dist)
  }

  _entityPos(id, out) {
    const e = this.ctx.world.get(id)
    if (!e) return null
    out.copy(e.object3d.position)
    if (e.agent?.attach || e.agent?.onDeck) out.y = e.agent.y
    return e
  }

  /** Evaluate a shot spec at time t -> { pos, look, fov } (pure, also used for thumbnails) */
  evalShot(s, t) {
    const fov = s.fov ?? 32
    switch (s.type) {
      case 'orbit': {
        const c = s.center ? V(s.center) : new THREE.Vector3()
        if (s.entity) this._entityPos(s.entity, c)
        const ang = (s.start ?? 0.8) + t * (s.speed ?? 0.06)
        return { pos: new THREE.Vector3(c.x + Math.sin(ang) * s.radius, c.y + s.height, c.z + Math.cos(ang) * s.radius), look: c.clone().add(new THREE.Vector3(0, s.lookY ?? 0, 0)), fov }
      }
      case 'follow': {
        const p = new THREE.Vector3()
        const e = this._entityPos(s.entity, p)
        if (!e) return this.evalShot(this.cfg.home, t)
        const yaw = (s.relative === false ? 0 : e.object3d.rotation.y) + (s.angle ?? 2.4) + t * (s.orbit ?? 0)
        const d = s.dist ?? 22
        return { pos: new THREE.Vector3(p.x + Math.sin(yaw) * d, p.y + (s.height ?? d * 0.5), p.z + Math.cos(yaw) * d), look: p.clone().add(new THREE.Vector3(0, s.lookY ?? 1.5, 0)), fov }
      }
      case 'dolly': {
        const k = s.loop ? (t / s.dur) % 1 : clamp(t / s.dur, 0, 1)
        const e = s.ease === false ? k : easeInOut(k)
        const pc = s._pc || (s._pc = new THREE.CatmullRomCurve3(s.path.map(V)))
        const lc = s._lc || (s._lc = s.look.length > 1 ? new THREE.CatmullRomCurve3(s.look.map(V)) : null)
        return { pos: pc.getPoint(e), look: lc ? lc.getPoint(e) : V(s.look[0]), fov }
      }
      case 'crane': {
        const e = this.ctx.world.get(s.entity)
        if (!e) return this.evalShot(this.cfg.home, t)
        const r = e.rig
        r.slew.updateWorldMatrix(true, false)
        const pos = r.slew.localToWorld(tmp.set(...(s.offset || [1.9, 2.2, 1.5]))).clone()
        const look = r.hook.getWorldPosition(tmp2).clone()
        look.y = lerp(look.y, pos.y - 6, 0.4)
        return { pos, look, fov: s.fov ?? 55 }
      }
      case 'ride': {
        const e = this.ctx.world.get(s.entity)
        if (!e) return this.evalShot(this.cfg.home, t)
        const o = s.part ? e.rig[s.part] : e.object3d
        o.updateWorldMatrix(true, false)
        const pos = o.localToWorld(tmp.set(...(s.offset || [0, 3, -9]))).clone()
        const look = o.localToWorld(tmp2.set(...(s.lookAt || [0, 1.5, 10]))).clone()
        return { pos, look, fov: s.fov ?? 50 }
      }
      case 'top': {
        const c = s.center ? V(s.center) : new THREE.Vector3()
        return { pos: new THREE.Vector3(c.x + 0.01, s.height ?? 150, c.z + (s.tilt ?? 6)), look: c, fov: s.fov ?? 30 }
      }
      case 'street': {
        const k = s.path ? clamp(t / (s.dur || 20), 0, 1) : 0
        const pc = s.path && (s._pc || (s._pc = new THREE.CatmullRomCurve3(s.path.map(V))))
        const pos = pc ? pc.getPoint(k) : V(s.pos)
        const ahead = pc ? pc.getPoint(Math.min(1, k + 0.04)) : V(s.look)
        if (s.look) ahead.lerp(V(s.look), 0.6)
        pos.y = s.eye ?? 2.1
        ahead.y = s.lookY ?? 6
        return { pos, look: ahead, fov: s.fov ?? 58 }
      }
      default:
        return { pos: V(s.pos), look: V(s.look), fov }
    }
  }

  // ---------------------------------------------------------------- walk mode
  startWalk(shot) {
    this.mode = 'walk'
    this.shot = shot
    const p = shot?.pos ? V(shot.pos) : this.controls.target.clone()
    this.walk.pos.set(p.x, shot?.eye ?? 2.1, p.z)
    this.walk.yaw = shot?.yaw ?? Math.PI
    this.walk.pitch = -0.05
    this._emit()
  }

  _bindWalk(dom) {
    let drag = null
    window.addEventListener('keydown', (e) => { if (this.mode === 'walk' && !e.target.closest?.('input,textarea')) this.walk.keys.add(e.code) })
    window.addEventListener('keyup', (e) => this.walk.keys.delete(e.code))
    dom.addEventListener('pointerdown', (e) => { if (this.mode === 'walk') drag = { x: e.clientX, y: e.clientY } })
    window.addEventListener('pointerup', () => (drag = null))
    window.addEventListener('pointermove', (e) => {
      if (!drag || this.mode !== 'walk') return
      this.walk.yaw -= (e.clientX - drag.x) * 0.005
      this.walk.pitch = clamp(this.walk.pitch - (e.clientY - drag.y) * 0.004, -1.2, 0.8)
      drag = { x: e.clientX, y: e.clientY }
    })
  }

  _updateWalk(dt) {
    const w = this.walk
    const k = w.keys
    const sp = (k.has('ShiftLeft') ? 9 : 4.2) * dt
    const fx = Math.sin(w.yaw)
    const fz = Math.cos(w.yaw)
    if (k.has('KeyW') || k.has('ArrowUp')) { w.pos.x += fx * sp; w.pos.z += fz * sp }
    if (k.has('KeyS') || k.has('ArrowDown')) { w.pos.x -= fx * sp; w.pos.z -= fz * sp }
    if (k.has('KeyA')) { w.pos.x += fz * sp; w.pos.z -= fx * sp }
    if (k.has('KeyD')) { w.pos.x -= fz * sp; w.pos.z += fx * sp }
    if (k.has('ArrowLeft')) w.yaw += 1.6 * dt
    if (k.has('ArrowRight')) w.yaw -= 1.6 * dt
    const b = this.cfg.bounds
    w.pos.x = clamp(w.pos.x, -b.x, b.x)
    w.pos.z = clamp(w.pos.z, -b.z, b.z)
    this._collide(w.pos)
    const look = w.pos.clone().add(new THREE.Vector3(fx * Math.cos(w.pitch), Math.sin(w.pitch), fz * Math.cos(w.pitch)))
    this.setPose({ pos: w.pos, look, fov: 62 })
  }

  /** Keep a point out of building boxes and above ground */
  _collide(p, minY = 1.2) {
    p.y = Math.max(minY, p.y)
    for (const box of this.colliders) {
      if (!box.containsPoint(p)) continue
      const c = box.getCenter(tmp2)
      const s = box.getSize(new THREE.Vector3())
      const dx = (p.x - c.x) / s.x
      const dz = (p.z - c.z) / s.z
      if (Math.abs(dx) > Math.abs(dz)) p.x = c.x + Math.sign(dx || 1) * (s.x / 2 + 0.6)
      else p.z = c.z + Math.sign(dz || 1) * (s.z / 2 + 0.6)
    }
    return p
  }

  /**
   * Eye-level shots (`shot.clear` = radius in m): hide people / vehicles whose footprint comes
   * within the radius of the lens (xz), so nobody walks or drives through the near plane.
   * Restores them once they are 0.6 m further out or the shot ends. Life-tracked entities get
   * their visibility from the lifecycle every frame; the rest are restored here.
   */
  _clearNear(r) {
    const hidden = this._nearHidden || (this._nearHidden = new Set())
    if (!r && !hidden.size) return
    const p = this.camera.position
    const world = this.ctx?.world
    if (!world) return
    for (const e of world.all()) {
      const a = e.agent
      if (!a || !e.object3d || (a.kind !== 'walker' && a.kind !== 'vehicle')) continue
      const half = a.kind === 'vehicle' ? (a.length || 4.6) / 2 : 0.3
      const d = Math.hypot(e.object3d.position.x - p.x, e.object3d.position.z - p.z) - half
      const was = hidden.has(e)
      if (r && d < r + (was ? 0.6 : 0) && e.object3d.visible) {
        if (!was) hidden.add(e)
        e.object3d.visible = false
      } else if (r && was && d < r + 0.6) {
        e.object3d.visible = false
      } else if (was) {
        hidden.delete(e)
        if (!e.life) e.object3d.visible = true
      }
    }
  }

  update(dt) {
    this.controls.enabled = this.mode !== 'walk'
    if (this.mode === 'walk') { this._clearNear(0); return this._updateWalk(dt) }
    if (this.mode === 'shot' && this.shot) {
      this.shotT += dt
      const target = this.evalShot(this.shot, this.shotT)
      if (this.blend) {
        this.blend.t += dt
        const k = easeInOut(clamp(this.blend.t / this.blend.dur, 0, 1))
        const f = this.blend.from
        target.pos.lerpVectors(f.pos, target.pos, k)
        target.look.lerpVectors(f.look, target.look, k)
        target.fov = lerp(f.fov, target.fov, k)
        if (k >= 1) {
          this.blend = null
          if (this._afterBlend) {
            this._afterBlend = false
            this.setPose(target)
            this.controls.target.copy(target.look)
            this.mode = 'free'
            this.shot = null
            this._emit()
            return
          }
        }
      }
      if (this.shot.type !== 'crane' && this.shot.type !== 'ride') this._collide(target.pos, 1.6)
      this.setPose(target)
      this.controls.target.copy(target.look)
      this._clearNear(this.shot.clear)
      return
    }
    this._clearNear(0)
    // free orbit
    const c = this.controls
    const b = this.cfg.bounds
    c.target.x = clamp(c.target.x, -b.x, b.x)
    c.target.z = clamp(c.target.z, -b.z, b.z)
    c.target.y = clamp(c.target.y, 0, 40)
    c.update()
    this._collide(this.camera.position, 1.6)
    this.pose.pos.copy(this.camera.position)
    this.pose.look.copy(c.target)
  }

  /** Fly the free orbit camera to look at a point from the current direction */
  focus(point, dist = 40) {
    const dir = this.camera.position.clone().sub(this.controls.target).normalize()
    this.play({ id: 'focus', type: 'static', pos: point.clone().addScaledVector(dir, dist).toArray(), look: point.toArray(), fov: this.camera.fov })
    this._afterBlend = true
  }
}
