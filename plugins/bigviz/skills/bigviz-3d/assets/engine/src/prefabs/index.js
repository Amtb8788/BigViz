// Prefab registry. Scenes reference prefabs by name; the registry says which animator
// drives the rig. Add a new asset = add one line here (or registerPrefab from a scene pack).

import { human } from './people.js'
import { mixer, dumpTruck, flatbed, car } from './vehicles.js'
import { forklift, excavator, mobileCrane, pumpTruck } from './machines.js'
import { towerCrane, hoist } from './cranes.js'
import { progressiveBuilding } from './building.js'
import { tree, shrub, planter, cityBlock, fenceLine } from './nature.js'
import { makeProp, PROPS } from './props.js'
import { stockPile, heap } from './props-extra.js'
import { applyAsset } from '../render/assets.js'

/** name -> { make(params), animator, kind } */
export const PREFABS = {
  worker: { make: (p) => human({ ...p }), animator: 'human', kind: 'walker' },
  civilian: { make: (p) => human({ ...p, civilian: true }), animator: 'human', kind: 'walker' },
  mixer: { make: mixer, animator: 'vehicle', kind: 'vehicle', length: 8.6 },
  dumpTruck: { make: dumpTruck, animator: 'vehicle', kind: 'vehicle', length: 8.2 },
  flatbed: { make: flatbed, animator: 'vehicle', kind: 'vehicle', length: 9.4 },
  car: { make: car, animator: 'vehicle', kind: 'vehicle', length: 4.6 },
  forklift: { make: forklift, animator: 'vehicle', kind: 'vehicle', length: 3.4 },
  excavator: { make: excavator, animator: 'vehicle', kind: 'machine', length: 5 },
  mobileCrane: { make: mobileCrane, animator: 'vehicle', kind: 'vehicle', length: 11 },
  pumpTruck: { make: pumpTruck, animator: 'vehicle', kind: 'vehicle', length: 10.5 },
  towerCrane: { make: towerCrane, animator: 'towerCrane', kind: 'machine' },
  hoist: { make: hoist, animator: 'hoist', kind: 'machine' },
  building: { make: progressiveBuilding, animator: null, kind: 'structure' },
  tree: { make: tree, animator: null, kind: 'nature' },
  shrub: { make: shrub, animator: null, kind: 'nature' },
  planter: { make: planter, animator: null, kind: 'nature' },
  cityBlock: { make: cityBlock, animator: null, kind: 'structure' },
  fence: { make: (p) => fenceLine(p.points, p), animator: null, kind: 'structure' },
  stockPile: { make: stockPile, animator: null, kind: 'prop' },
  heap: { make: heap, animator: null, kind: 'prop' }
}

export function registerPrefab(name, def) {
  PREFABS[name] = def
}

export function makePrefab(name, params = {}) {
  const def = PREFABS[name]
  // glTF override from render/assets.js (public/models/<slot>.glb); procedural otherwise
  if (def) return applyAsset(name, { ...def.make(params), def })
  if (PROPS[name]) return applyAsset(name, { ...makeProp(name, params), def: { animator: null, kind: 'prop' } })
  throw new Error(`Unknown prefab "${name}"`)
}

export const PREFAB_NAMES = () => [...Object.keys(PREFABS), ...Object.keys(PROPS)]
