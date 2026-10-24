/** Types for the 2D kit. `BigVizAsset` and `AlertLevel` live in `core/types` and are re-exported. */
import type { AlertLevel, BigVizAsset } from '@/kit/core/types'

export type { AlertLevel, BigVizAsset }

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

/** Column of ScrollTable */
export interface ScrollColumn<R> {
  key: string
  title: string
  /** CSS grid track, e.g. '2fr' or '80px'. Default 1fr. */
  width?: string
  align?: 'left' | 'center' | 'right'
  format?: (row: R) => string
  /** Colour the cell: 'ok' | 'warn' | 'danger' | 'accent' */
  tone?: (row: R) => string | undefined
  /** Render the value as a pill (status, level) */
  badge?: boolean
}

/** One row of AlertFeed */
export interface AlertItem {
  id: string | number
  level: AlertLevel
  title: string
  /** Where it happened (site, device, area) */
  source?: string
  /** Display time, already formatted (e.g. '14:32:05') */
  time: string
}

/** One level of GeoMap (country, province, city, site …) */
export interface GeoLevel {
  /** Code passed to the loader; the GeoJSON `adcode` of the parent region */
  code: string
  name: string
}

/** Minimal GeoJSON shape GeoMap needs: features with `properties.name` (and `adcode` to drill) */
export interface GeoJSONLike {
  features: { properties: { name?: string; adcode?: string | number } }[]
}
