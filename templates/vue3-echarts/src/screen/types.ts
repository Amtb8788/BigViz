/** Shared types for the BigViz screen kit. */

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

/** Row rendered by RankList / Podium */
export interface RankRow {
  /** Stable unique key (display labels may repeat) */
  id: string | number
  /** Main text */
  label: string
  /** Secondary text, e.g. the team of a person */
  sub?: string
  /** Leading thumbnail URL */
  image?: string
  /** Value used for the bar and the number */
  value: number
}

/** KPI card item */
export interface KpiItem {
  id: string
  label: string
  value: number
  unit?: string
  /** Number of decimals for the value */
  decimals?: number
  /** Optional change vs. previous period, in percent (positive = up) */
  delta?: number
  /** Caption before the delta, e.g. "vs last month" */
  deltaLabel?: string
  /** Icon asset; geometry is read from the manifest */
  icon?: BigVizAsset
}

/** Geometry of the podium winner's trophy, as fractions (0–1) of the podium base image */
export interface CrownGeometry {
  /** Trophy bounding box (l/r of width, t/b of height, measured from the top-left) */
  cup: { l: number; t: number; r: number; b: number }
  /** Centre of the cup body (rays and glow) */
  cx: number
  cy: number
  /** Vertical position of the star glint */
  starY: number
  /** Vertical centre of the pedestal ring (ripples) */
  ringY: number
}

/** Where one podium label sits on the base image (fractions of width / height) */
export interface PodiumTag {
  /** Horizontal centre */
  x: number
  /** Vertical position of the anchor edge */
  y: number
  /** `bottom`: text sits above y; `center`: text is centred on y */
  anchor: 'bottom' | 'center'
  /** Label width as a fraction of the image width */
  width: number
}

/** Node on the HeroHub orbit */
export interface HubNode {
  id: string
  title: string
  label: string
  value: number
  unit?: string
  icon?: BigVizAsset
}
