// Geometric detail tier shared by prefabs (set by Stage.setQuality). Prefab parts that only
// exist for close-up realism use a material whose `visible` follows the tier, so switching
// quality at runtime costs nothing (no rebuild) and hidden parts cost no draw call.

const RANK = { low: 0, medium: 1, high: 2 }
let level = 2

export function setDetail(name) {
  level = RANK[name] ?? 2
}

export const detailLevel = () => level

/**
 * Make `material.visible` follow the detail tier: shown while min <= level <= max.
 * Survives material.clone() (clone copies the boolean, so call again on clones).
 */
export function detailOnly(material, min = 1, max = 2) {
  Object.defineProperty(material, 'visible', {
    configurable: true,
    get: () => level >= min && level <= max,
    set: () => {}
  })
  material.userData.detail = [min, max]
  return material
}

/** Shared wind clock for vertex-shader sway (seconds); bumped by any foliage draw */
export const windTime = { value: 0 }
const t0 = typeof performance !== 'undefined' ? performance.now() : 0
export function tickWind() {
  windTime.value = ((typeof performance !== 'undefined' ? performance.now() : 0) - t0) / 1000
}
