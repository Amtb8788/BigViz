// Rigid-skinned machines: every part is welded to one bone, all parts of one machine merge
// into a single vertex-coloured SkinnedMesh (one draw call however many joints it has).
// Bones are plain Object3D pivots, so animators just set bone.rotation / position.

import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { tone, vcMaterials, styleVC } from '../../render/materials.js'

const mats = new Map()
/** shared skinned vertex-colour material per finish */
function skinMat(finish) {
  if (!mats.has(finish)) {
    const f = { paint: [0.42, 0.25], metal: [0.32, 0.8], dark: [0.6, 0.3] }[finish] || [0.45, 0.3]
    const m = styleVC(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: f[0], metalness: f[1], name: `vc.rigid.${finish}` }))
    vcMaterials.add(m)
    mats.set(finish, m)
  }
  return mats.get(finish)
}

export class Rigid {
  constructor() {
    this.bones = []
    this.parts = new Map()
    this.root = new THREE.Bone()
    this.root.name = 'root'
    this.bones.push(this.root)
  }

  /** new bone under parent (default root) at local x, y, z */
  bone(name, parent = this.root, x = 0, y = 0, z = 0) {
    const b = new THREE.Bone()
    b.name = name
    b.position.set(x, y, z)
    parent.add(b)
    this.bones.push(b)
    return b
  }

  /** add geometry in bone-local space with a colour; finish 'paint' | 'metal' | 'dark' */
  geo(bone, g, color, p = {}, finish = 'paint') {
    if (p.rx || p.ry || p.rz) g.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(p.rx || 0, p.ry || 0, p.rz || 0)))
    g.translate(p.x || 0, p.y || 0, p.z || 0)
    const c = tone(color)
    const n = g.attributes.position.count
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3).map((_, i) => [c.r, c.g, c.b][i % 3]), 3))
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2))
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(k)) g.deleteAttribute(k)
    const key = finish
    if (!this.parts.has(key)) this.parts.set(key, [])
    this.parts.get(key).push({ bone, g: g.index ? g.toNonIndexed() : g })
    return this
  }

  box(bone, w, h, d, color, p = {}, finish) {
    const g = p.round ? new RoundedBoxGeometry(w, h, d, 2, p.round) : new THREE.BoxGeometry(w, h, d)
    if (p.base) g.translate(0, h / 2, 0)
    return this.geo(bone, g, color, p, finish)
  }

  /** cylinder; axis 'y' | 'x' | 'z' */
  cyl(bone, rt, rb, h, color, p = {}, finish) {
    const g = new THREE.CylinderGeometry(rt, rb, h, p.seg || 16)
    if (p.base) g.translate(0, h / 2, 0)
    if (p.axis === 'x') g.rotateZ(Math.PI / 2)
    if (p.axis === 'z') g.rotateX(Math.PI / 2)
    return this.geo(bone, g, color, p, finish)
  }

  sphere(bone, r, color, p = {}, finish) {
    return this.geo(bone, new THREE.SphereGeometry(r, p.seg || 14, (p.seg || 14) >> 1), color, p, finish)
  }

  /** rod between two bone-local points */
  rod(bone, a, b, r, color, finish, seg = 8) {
    const A = new THREE.Vector3(...a)
    const B = new THREE.Vector3(...b)
    const d = B.clone().sub(A)
    const g = new THREE.CylinderGeometry(r, r, d.length(), seg).translate(0, d.length() / 2, 0)
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()))
    return this.geo(bone, g, color, { x: A.x, y: A.y, z: A.z }, finish)
  }

  /** -> THREE.Group holding the bones + one SkinnedMesh per finish */
  build(name = 'machine') {
    const group = new THREE.Group()
    group.name = name
    group.add(this.root)
    group.updateMatrixWorld(true)
    const index = new Map(this.bones.map((b, i) => [b, i]))
    for (const [finish, list] of this.parts) {
      const geos = list.map(({ bone, g }) => {
        // geometry authored in bone space -> bind (world-at-rest) space
        g.applyMatrix4(bone.matrixWorld)
        const n = g.attributes.position.count
        const bi = index.get(bone)
        g.setAttribute('skinIndex', new THREE.BufferAttribute(new Uint16Array(n * 4).map((_, i) => (i % 4 === 0 ? bi : 0)), 4))
        g.setAttribute('skinWeight', new THREE.BufferAttribute(new Float32Array(n * 4).map((_, i) => (i % 4 === 0 ? 1 : 0)), 4))
        return g
      })
      const merged = mergeGeometries(geos, false)
      geos.forEach((g) => g.dispose())
      const mesh = new THREE.SkinnedMesh(merged, skinMat(finish))
      mesh.name = `${name}.${finish}`
      mesh.castShadow = true
      mesh.receiveShadow = true
      mesh.frustumCulled = false
      mesh.userData.keep = true
      group.add(mesh)
      mesh.bind(new THREE.Skeleton(this.bones), new THREE.Matrix4())
    }
    for (const b of this.bones) b.userData.dynamic = true
    return group
  }
}
