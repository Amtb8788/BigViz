// Click an object -> select its entity (info card, follow). Hover shows a pointer cursor.
// A ground ring marks the selection (materials are shared, so no per-object tinting).

import * as THREE from 'three'

export class Picker {
  constructor(stage, world, onPick) {
    this.stage = stage
    this.world = world
    this.onPick = onPick
    this.ray = new THREE.Raycaster()
    this.mouse = new THREE.Vector2()
    this.selected = null
    this.ring = new THREE.Mesh(new THREE.RingGeometry(1, 1.25, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#f2b51c', transparent: true, opacity: 0.9, depthWrite: false }))
    this.ring.visible = false
    this.ring.renderOrder = 7
    stage.scene.add(this.ring)
    const el = stage.canvas
    let down = null
    el.addEventListener('pointerdown', (e) => (down = { x: e.clientX, y: e.clientY }))
    el.addEventListener('pointerup', (e) => {
      if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5) return
      const ent = this.pick(e)
      this.select(ent)
    })
  }

  pick(ev) {
    const r = this.stage.canvas.getBoundingClientRect()
    this.mouse.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1)
    this.ray.setFromCamera(this.mouse, this.stage.camera)
    this.lastHit = null
    // overlays (twin device markers) are tested first: they draw on top
    const pre = this.prePick?.(this.ray)
    if (pre) { this.lastHit = pre.object; return pre.entity }
    const roots = []
    for (const e of this.world.all()) if (e.info && e.object3d.visible) roots.push(e.object3d)
    const hits = this.ray.intersectObjects(roots, true)
    for (const h of hits) {
      if (!shown(h.object)) continue
      let o = h.object
      while (o && !o.userData.entityId) o = o.parent
      if (o) { this.lastHit = h.object; return this.world.get(o.userData.entityId) }
    }
    return null
  }

  /** `lastHit` (raw object under the cursor) is only valid during the onPick callback */
  select(e) {
    this.selected = e
    this.ring.visible = !!e
    this.onPick?.(e)
    this.lastHit = null
  }

  update(time) {
    const e = this.selected
    if (!e) return
    if (!e.object3d.visible) { this.ring.visible = false; return }
    this.ring.visible = true
    const p = e.object3d.position
    const s = e.info?.ring ?? (e.kind === 'walker' ? 1 : 4)
    this.ring.position.set(p.x, (e.agent?.y ?? p.y) + 0.08, p.z)
    this.ring.scale.setScalar(s * (1 + Math.sin(time * 4) * 0.06))
  }
}

/** raycasts ignore .visible; skip hits inside hidden groups (isolated floors, cutaways) */
function shown(o) {
  for (; o; o = o.parent) if (!o.visible) return false
  return true
}
