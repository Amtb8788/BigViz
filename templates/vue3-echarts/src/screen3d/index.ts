/**
 * Optional 3D kit. Import `CityHero` from here in views; it lazy-loads three.js on first mount.
 * Import ThreeStage / scenes directly only from code that is itself lazily loaded, since those
 * modules import three.js statically.
 */
export { default as CityHero } from './CityHero.vue'
export type { AlertLevel, CityAlert, LabelInsets, StageContext, StageScene, StageSetup, StageState } from './types'
