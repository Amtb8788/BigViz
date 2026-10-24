// Asset registry: swap a procedural prefab for a glTF / GLB model without touching scenes.
//
// How to add a model (no network access needed at runtime, nothing is downloaded):
//   1. drop the file at  public/models/<slot>.glb      e.g. public/models/excavator.glb
//   2. list it in        public/models/index.json      { "models": ["excavator", "tower-crane"] }
//      (a manifest avoids 404 probes, which would show up as console errors)
//      entries may also be objects: { "slot": "worker", "file": "worker.glb", "scale": 1,
//      "fit": true, "yaw": 0, "draco": "/draco/", "ktx2": "/basis/" }
//   3. reload. makePrefab(<prefab>) builds the procedural rig as before, hides its meshes
//      (they stay as invisible pick proxies) and attaches the model. Nodes in the glTF named
//      like a rig pivot ("slew", "boom", "arm", "bucket", "jib", "trolley", "cage", ...) are
//      re-parented under that pivot so the existing animators keep driving them.
// Optional decoders: DRACOLoader / KTX2Loader are imported only when an entry names their
// decoder path (host the decoder files yourself under public/).
// Code alternative: registerAsset('excavator', { url: '/models/my-digger.glb' }) before boot.

import * as THREE from 'three'

/** slot (file name) -> prefab key used by scenes */
export const SLOTS = {
  excavator: 'excavator',
  'tower-crane': 'towerCrane',
  'mixer-truck': 'mixer',
  'dump-truck': 'dumpTruck',
  'pump-truck': 'pumpTruck',
  'mobile-crane': 'mobileCrane',
  flatbed: 'flatbed',
  forklift: 'forklift',
  hoist: 'hoist',
  worker: 'worker',
  civilian: 'civilian',
  car: 'car',
  'traffic-light': 'trafficLight',
  tree: 'tree'
}

/** prefab key -> { url, scale, fit, yaw, draco, ktx2 } */
const entries = new Map()
/** prefab key -> loaded THREE.Object3D template */
const templates = new Map()

export function registerAsset(slotOrPrefab, opts = {}) {
  const prefab = SLOTS[slotOrPrefab] || slotOrPrefab
  entries.set(prefab, { url: `${base()}models/${slotOrPrefab}.glb`, fit: true, ...opts })
}

const base = () => (typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL) || '/'

/** Read public/models/index.json (if any) and load every listed model. Never throws. */
export async function loadAssets({ manifest = `${base()}models/index.json`, renderer } = {}) {
  try {
    const res = await fetch(manifest, { cache: 'no-cache' })
    const type = res.headers.get('content-type') || ''
    // vite / static servers answer unknown paths with index.html: treat as "no manifest"
    if (res.ok && type.includes('json')) {
      const j = await res.json()
      for (const m of j.models || []) {
        if (typeof m === 'string') registerAsset(m)
        else if (m?.slot) registerAsset(m.slot, { ...m, url: m.url || `${base()}models/${m.file || m.slot + '.glb'}` })
      }
    }
  } catch { /* no manifest: procedural only */ }
  if (!entries.size) return 0
  const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js')
  const { clone } = await import('three/examples/jsm/utils/SkeletonUtils.js')
  cloneFn = clone
  const loader = new GLTFLoader()
  let n = 0
  await Promise.all([...entries].map(async ([prefab, e]) => {
    try {
      if (e.draco) {
        const { DRACOLoader } = await import('three/examples/jsm/loaders/DRACOLoader.js')
        loader.setDRACOLoader(new DRACOLoader().setDecoderPath(e.draco))
      }
      if (e.ktx2) {
        const { KTX2Loader } = await import('three/examples/jsm/loaders/KTX2Loader.js')
        if (renderer) loader.setKTX2Loader(new KTX2Loader().setTranscoderPath(e.ktx2).detectSupport(renderer))
      }
      const gltf = await loader.loadAsync(e.url)
      const root = gltf.scene
      root.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true } })
      templates.set(prefab, root)
      n++
    } catch (err) {
      console.warn(`asset "${prefab}" failed to load from ${e.url}, using procedural`, err?.message || err)
    }
  }))
  return n
}

export const hasAsset = (prefab) => templates.has(prefab)

const _box = new THREE.Box3()
const _size = new THREE.Vector3()
const _m = new THREE.Matrix4()

/**
 * Swap visuals of a built prefab ({ object, rig }) for the loaded model, keeping the rig.
 * Returns `made` unchanged when no model is registered for this prefab.
 */
let cloneFn = (o) => o.clone(true)

export function applyAsset(prefab, made) {
  const tpl = templates.get(prefab)
  if (!tpl || !made?.object) return made
  const e = entries.get(prefab) || {}
  const host = made.object
  // procedural size (before hiding) for auto-fit
  host.updateMatrixWorld(true)
  _box.setFromObject(host)
  const want = _box.getSize(_size).clone()
  host.traverse((o) => { if (o.isMesh) { o.visible = false; o.userData.proxy = true } })
  const model = cloneFn(tpl)
  model.name = `asset.${prefab}`
  model.rotation.y = e.yaw || 0
  if (e.scale) model.scale.setScalar(e.scale)
  if (e.fit !== false && !e.scale) {
    model.updateMatrixWorld(true)
    _box.setFromObject(model)
    const have = _box.getSize(_size)
    const k = Math.max(want.x, want.y, want.z) / Math.max(1e-3, have.x, have.y, have.z)
    if (Number.isFinite(k) && k > 0) model.scale.setScalar(k)
  }
  // stand on y = 0
  model.updateMatrixWorld(true)
  _box.setFromObject(model)
  model.position.y -= _box.min.y
  host.add(model)
  host.updateMatrixWorld(true)
  // re-parent glTF nodes named like rig pivots under those pivots (keeps world transform)
  const pivots = new Map()
  host.traverse((o) => { if (!o.isMesh && o.name && o !== host && !isInside(o, model)) pivots.set(o.name, o) })
  const moves = []
  model.traverse((o) => { if (o !== model && pivots.has(o.name)) moves.push([o, pivots.get(o.name)]) })
  for (const [o, p] of moves) {
    o.updateMatrixWorld(true)
    _m.copy(p.matrixWorld).invert().multiply(o.matrixWorld)
    p.add(o)
    _m.decompose(o.position, o.quaternion, o.scale)
  }
  made.rig = { ...made.rig, asset: model }
  return made
}

function isInside(o, root) {
  for (let p = o; p; p = p.parent) if (p === root) return true
  return false
}
