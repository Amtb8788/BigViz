// Cheap night lighting: additive glow sprites at every lamp + soft "light pools" on the
// ground. Real dynamic lights are limited to a handful (sun, desk lamp, 2-3 floodlights);
// everything else is faked here so 60+ lamps cost two draw calls per group.

import * as THREE from 'three'
import { radialTexture } from './textures.js'

class Group {
  constructor(name, parent) {
    this.name = name
    this.items = []
    this.parent = parent
    this.level = 0
    this.points = null
    this.pools = null
  }
}

export class GlowField {
  constructor(scene) {
    this.scene = scene
    this.groups = new Map()
    this.dirty = new Set()
    this.levels = Object.create(null)
  }

  _group(name) {
    if (!this.groups.has(name)) this.groups.set(name, new Group(name, this.scene))
    return this.groups.get(name)
  }

  /**
   * Register a static lamp.
   * @param {string} group 'street' | 'site' | 'windows' | ...
   * @param {THREE.Vector3} pos glow centre (bulb)
   * @param {{color?:string,size?:number,pool?:number,poolY?:number}} o pool = radius of ground light pool (0 = none)
   */
  add(group, pos, o = {}) {
    const g = this._group(group)
    g.items.push({ pos: pos.clone(), color: new THREE.Color(o.color || '#ffcf7a'), size: o.size ?? 2.2, pool: o.pool ?? 0, poolY: o.poolY ?? 0.03, on: true })
    this.dirty.add(g)
    return g.items.length - 1
  }

  /** Remove all lamps of a group (scene rebuild) */
  clear(group) {
    const g = this.groups.get(group)
    if (!g) return
    g.items.length = 0
    this.dirty.add(g)
  }

  setEnabled(group, index, on) {
    const g = this.groups.get(group)
    if (!g || !g.items[index] || g.items[index].on === on) return
    g.items[index].on = on
    this.dirty.add(g)
  }

  /** 0..1 brightness per base group ("site" also drives "site@bucket"), driven by EnvironmentSystem */
  setLevel(base, level) {
    this.levels[base] = level
    for (const g of this.groups.values()) if (g.name.split('@')[0] === base) this._apply(g)
  }

  /** Visibility factor for every group of a prop bucket (bucket lifecycle) */
  setVis(bucket, k) {
    for (const g of this.groups.values()) if (g.name.endsWith('@' + bucket) && g.vis !== k) { g.vis = k; this._apply(g) }
  }

  _apply(g) {
    const level = (this.levels[g.name.split('@')[0]] ?? 0) * (g.vis ?? 1)
    g.level = level
    if (g.points) {
      g.points.material.opacity = level
      g.points.visible = level > 0.01
    }
    if (g.pools) {
      g.pools.material.opacity = level * 0.55
      g.pools.visible = level > 0.01
    }
  }

  /** Rebuild buffers for groups that changed (call once per frame; cheap when nothing changed) */
  flush() {
    for (const g of this.dirty) this._rebuild(g)
    this.dirty.clear()
  }

  _rebuild(g) {
    if (g.points) { this.scene.remove(g.points); g.points.geometry.dispose() }
    if (g.pools) { this.scene.remove(g.pools); g.pools.geometry.dispose() }
    const on = g.items.filter((i) => i.on)
    if (!on.length) { g.points = g.pools = null; return }
    const pos = new Float32Array(on.length * 3)
    const col = new Float32Array(on.length * 3)
    const size = new Float32Array(on.length)
    on.forEach((it, i) => {
      pos.set([it.pos.x, it.pos.y, it.pos.z], i * 3)
      col.set([it.color.r, it.color.g, it.color.b], i * 3)
      size[i] = it.size
    })
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    geo.setAttribute('aColor', new THREE.BufferAttribute(col, 3))
    geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1))
    const mat = new THREE.ShaderMaterial({
      uniforms: { uMap: { value: radialTexture() }, uOpacity: { value: g.level } },
      vertexShader: `attribute vec3 aColor; attribute float aSize; varying vec3 vC;
        void main(){ vC=aColor; vec4 mv=modelViewMatrix*vec4(position,1.0);
        gl_PointSize = aSize * 900.0 / -mv.z; gl_Position=projectionMatrix*mv; }`,
      fragmentShader: `uniform sampler2D uMap; uniform float uOpacity; varying vec3 vC;
        void main(){ float a=texture2D(uMap,gl_PointCoord).a*uOpacity; if(a<0.01) discard; gl_FragColor=vec4(vC*a,a);
        #include <colorspace_fragment>
        }`,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    })
    Object.defineProperty(mat, 'opacity', { get: () => mat.uniforms.uOpacity.value, set: (v) => (mat.uniforms.uOpacity.value = v) })
    g.points = new THREE.Points(geo, mat)
    g.points.renderOrder = 6
    g.points.frustumCulled = false
    g.points.visible = g.level > 0.01
    this.scene.add(g.points)
    this._apply(g)

    const poolItems = on.filter((i) => i.pool > 0)
    if (poolItems.length) {
      const pm = new THREE.MeshBasicMaterial({ map: radialTexture('rgba(255,210,140,1)'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: g.level * 0.55 })
      const inst = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), pm, poolItems.length)
      const m = new THREE.Matrix4()
      poolItems.forEach((it, i) => {
        m.makeScale(it.pool * 2, 1, it.pool * 2).setPosition(it.pos.x, it.poolY, it.pos.z)
        inst.setMatrixAt(i, m)
        inst.setColorAt(i, it.color)
      })
      inst.renderOrder = 4
      inst.visible = g.level > 0.01
      g.pools = inst
      this.scene.add(inst)
    } else g.pools = null
  }
}
