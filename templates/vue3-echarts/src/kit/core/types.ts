/** Types shared by the 2D and 3D kits. */

/**
 * One published asset, exactly as `bigviz publish` writes it into `assets.manifest.ts`.
 * All geometry comes from measuring the final PNG, so components never hard-code aspect ratios.
 */
export interface BigVizAsset {
  /** Asset id from `bigviz.yaml` `assets[].id` */
  id: string
  /** Bundler-resolved URL (the manifest imports the PNG) */
  src: string
  /** Natural pixel width */
  width: number
  /** Natural pixel height */
  height: number
  /** width / height, rounded to 4 decimals */
  aspect: number
  /** Transparent margins (alpha ≤ 8) as fractions: l/r of width, t/b of height */
  trim: { l: number; t: number; r: number; b: number }
}

/** Severity of an alert: AlertFeed rows, map markers and 3D beacons */
export type AlertLevel = 'info' | 'warn' | 'critical'
