// Device markers: a screen-sized icon billboard per device that follows its host every
// frame, a level-coloured ring (pulses when critical) and a vertical alarm beacon.
// Icons render on top (no depth test) so indoor / occluded devices stay readable.

// Declutter (unless `showAll`): markers hidden behind the building ghost to 25 %, far ones
// shrink / drop out, eye-level shots keep only near + unoccluded ones; alarming and
// selected markers always show. Overlapping icons fan out on a ring in screen space.

import * as THREE from 'three'
import { LEVEL_COLORS } from './bindings.js'
import { viewMode, markerTier, segBoxHit, fanOut } from './declutter.js'

const _p = new THREE.Vector3()
const _a = new THREE.Vector3()
const _b = new THREE.Vector3()
const _inv = new THREE.Matrix4()

const texCache = new Map()

function iconTexture(glyph, color, ring) {
  const key = `${glyph}|${color}|${ring}`
  if (texCache.has(key)) return texCache.get(key)
  const c = document.createElement('canvas')
  c.width = c.height = 96
  const g = c.getContext('2d')
  g.beginPath()
  g.arc(48, 48, 40, 0, Math.PI * 2)
  g.fillStyle = 'rgba(18,20,26,0.88)'
  g.fill()
  g.lineWidth = 9
  g.strokeStyle = ring
  g.stroke()
  g.fillStyle = color
  g.font = 'bold 44px "PingFang SC","Microsoft YaHei","Noto Sans SC",sans-serif'
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.fillText(glyph, 48, 51)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  texCache.set(key, t)
  return t
}

let ringTex = null
function haloTexture() {
  if (ringTex) return ringTex
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const g = c.getContext('2d')
  const grd = g.createRadialGradient(64, 64, 30, 64, 64, 62)
  grd.addColorStop(0, 'rgba(255,255,255,0)')
  grd.addColorStop(0.55, 'rgba(255,255,255,0.9)')
  grd.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = grd
  g.fillRect(0, 0, 128, 128)
  ringTex = new THREE.CanvasTexture(c)
  return ringTex
}

const BEAM = new THREE.CylinderGeometry(0.07, 0.07, 1, 6).translate(0, 0.5, 0)
// sizeAttenuation off: scale is a fraction of 2*tan(fov/2) -> ~30 px at fov 32 / 900 px
const SIZE = 0.02

export class DeviceMarkers {
  constructor(twin) {
    this.twin = twin
    this.group = new THREE.Group()
    this.group.name = 'twin.markers'
    twin.E.stage.scene.add(this.group)
    this.items = new Map()
    this.hiddenTypes = new Set()
    this.enabled = true
    /** true = no declutter (every enabled marker, full size, no occlusion fade) */
    this.showAll = false
    this.mode = 'aerial'
    this.selected = null
    this.t = 0
    for (const d of twin.registry.all()) this.add(d)
  }
  add(d) {
    const icon = new THREE.Sprite(new THREE.SpriteMaterial({ map: iconTexture(d.icon, d.color, LEVEL_COLORS.ok), depthTest: false, depthWrite: false, sizeAttenuation: false, fog: false, toneMapped: false }))
    icon.scale.setScalar(SIZE)
    icon.renderOrder = 20
    icon.userData.twinDevice = d.id
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTexture(), color: LEVEL_COLORS.critical, transparent: true, depthTest: false, depthWrite: false, sizeAttenuation: false, fog: false, toneMapped: false, blending: THREE.AdditiveBlending }))
    halo.renderOrder = 19
    halo.visible = false
    halo.raycast = () => {}
    const beam = new THREE.Mesh(BEAM, new THREE.MeshBasicMaterial({ color: LEVEL_COLORS.warn, transparent: true, opacity: 0.6, depthWrite: false, fog: false, toneMapped: false }))
    beam.visible = false
    beam.renderOrder = 18
    beam.raycast = () => {}
    const root = new THREE.Group()
    root.add(beam, halo, icon)
    root.userData.twinDevice = d.id
    this.group.add(root)
    this.items.set(d.id, { d, root, icon, halo, beam, level: 'ok', shown: false, pos: root.position, opacity: 1, occluded: false, scale: 1, off: { x: 0, y: 0 } })
  }

  remove(id) {
    const it = this.items.get(id)
    if (!it) return
    this.group.remove(it.root)
    it.icon.material.dispose()
    it.halo.material.dispose()
    it.beam.material.dispose()
    this.items.delete(id)
  }

  setTypeVisible(type, on) {
    if (on) this.hiddenTypes.delete(type)
    else this.hiddenTypes.add(type)
  }

  /** pickable sprites (visible only) */
  pickables() {
    const out = []
    for (const it of this.items.values()) if (it.shown) out.push(it.icon)
    return out
  }

  /** building occluder in rig-local space: built floors (interior: floors below the cut) */
  _occluder() {
    const tw = this.twin
    const r = tw.E.building?.rig
    if (!r) return null
    const I = tw.interior
    const floors = I.active ? I.floor : Math.min(r.N, Math.floor(tw.E.progress.state.floors || 0))
    if (floors < 1) return null
    r.root.updateWorldMatrix(true, false)
    _inv.copy(r.root.matrixWorld).invert()
    return { min: [-r.W / 2, 0, -r.D / 2], max: [r.W / 2, floors * r.FH - 0.3, r.D / 2], inv: _inv }
  }

  update(dt) {
    this.t += dt
    const tw = this.twin
    const M = tw.model
    const cam = tw.E.stage.camera
    const camPos = cam.position
    this.mode = viewMode({ y: camPos.y, fov: cam.fov, mode: tw.E.camera.mode })
    const occ = this.showAll ? null : this._occluder()
    if (occ) _a.copy(camPos).applyMatrix4(occ.inv)
    const { w, h } = tw.E.stage.size
    const pxPerUnit = h / (2 * Math.tan((cam.fov * Math.PI) / 360))
    const k = dt > 0 ? 1 - Math.exp(-dt * 10) : 1
    const pts = []
    for (const it of this.items.values()) {
      const d = it.d
      const node = tw.hostOf(d)
      const on = this.enabled && !this.hiddenTypes.has(d.type) && !!node && M.shown(node)
      if (!on) { it.root.visible = it.shown = false; continue }
      tw.devicePos(d, node, it.pos)
      const v = tw.store.visual(d.id)
      const alarm = v.level === 'warn' || v.level === 'critical'
      it.occluded = !!occ && segBoxHit(_a.toArray(), _b.copy(it.pos).applyMatrix4(occ.inv).toArray(), occ)
      const tier = markerTier({ dist: camPos.distanceTo(it.pos), mode: this.mode, occluded: it.occluded, alarm, selected: this.selected === d.id, all: this.showAll })
      it.root.visible = it.shown = tier.show
      if (!tier.show) { it.opacity = 0; continue }
      it.opacity += (tier.opacity - it.opacity) * (it.opacity === 0 ? 1 : k)
      it.scale = tier.scale
      _p.copy(it.pos).project(cam)
      if (_p.z > 1) continue
      pts.push({ id: d.id, x: (_p.x * 0.5 + 0.5) * w, y: (-_p.y * 0.5 + 0.5) * h, prio: (this.selected === d.id ? 4 : 0) + (v.level === 'critical' ? 2 : alarm ? 1 : 0) + (it.occluded ? 0 : 0.5) })
    }
    const fan = fanOut(pts, { radius: SIZE * pxPerUnit * 0.9, gap: SIZE * pxPerUnit * 1.15 })
    for (const it of this.items.values()) {
      if (!it.shown) continue
      const d = it.d
      const f = fan.get(d.id)
      it.off.x += ((f?.dx || 0) - it.off.x) * k
      it.off.y += ((f?.dy || 0) - it.off.y) * k
      const v = tw.store.visual(d.id)
      if (v.level !== it.level || v.color !== it.color) {
        it.level = v.level
        it.color = v.color
        it.icon.material.map = iconTexture(d.icon, d.color, v.color)
        it.icon.material.needsUpdate = true
      }
      const sel = this.selected === d.id
      const s = SIZE * it.scale * (sel ? 1.35 : 1)
      it.icon.scale.setScalar(s)
      it.icon.material.opacity = it.opacity
      // fan-out: shift the sprite anchor so the icon moves by `off` px (raycast honours center)
      const cx = -it.off.x / (s * pxPerUnit)
      const cy = it.off.y / (s * pxPerUnit)
      it.icon.center.set(0.5 + cx, 0.5 + cy)
      // halo: selected (accent) or alarming (pulsing)
      const alarm = v.level === 'warn' || v.level === 'critical'
      it.halo.visible = sel || alarm
      if (it.halo.visible) {
        const p = v.pulse ? 0.5 + 0.5 * Math.sin(this.t * 7) : 0.6
        it.halo.material.color.set(sel && !alarm ? '#f2b51c' : v.color)
        it.halo.material.opacity = (0.35 + 0.5 * p) * Math.max(it.opacity, 0.6)
        const hs = SIZE * it.scale * (2 + (v.pulse ? p * 1.2 : 0.4))
        it.halo.scale.setScalar(hs)
        it.halo.center.set(0.5 - it.off.x / (hs * pxPerUnit), 0.5 + it.off.y / (hs * pxPerUnit))
      }
      // beacon column above the device (height = level + value)
      it.beam.visible = v.beacon > 0
      if (it.beam.visible) {
        it.beam.scale.set(1, 4 + v.beacon * 14, 1)
        it.beam.material.color.set(v.color)
        it.beam.material.opacity = (0.35 + 0.3 * (v.pulse ? 0.5 + 0.5 * Math.sin(this.t * 7) : 0.5)) * Math.max(it.opacity, 0.5)
      }
    }
  }

  dispose() {
    for (const id of [...this.items.keys()]) this.remove(id)
    this.group.removeFromParent()
  }
}