// Scene registry. Each scene pack is lazily loaded: ?scene=<id>
// New scene: `node ../../scripts/new-scene.mjs <id> "<name>"` copies scenes/_template and
// adds one line here. scenes/_template itself is not registered (it is the skeleton).

export const SCENES = {
  construction: () => import('./construction/index.js'),
  factory: () => import('./factory/index.js'),
  park: () => import('./park/index.js'),
  street: () => import('./street/index.js'),
  tunnel: () => import('./tunnel/index.js'),
  bridge: () => import('./bridge/index.js')
}
