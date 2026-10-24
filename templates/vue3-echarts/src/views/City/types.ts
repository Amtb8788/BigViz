/** Data contract of the city screen (`/mock/city.json` or `VITE_CITY_API_URL`). All data is fictional. */
import type { AlertLevel } from '@/kit/3d/types'

export type CityKpiId = 'health' | 'sensors' | 'speed' | 'gridLoad'
export type AlertType = 'traffic' | 'power' | 'water' | 'air' | 'fire' | 'crowd' | 'parking'

export interface CityKpi {
  id: CityKpiId
  value: number
  /** Change vs. yesterday, percent */
  delta: number
}

export interface CityAlertRecord {
  id: string
  /** Category, translated on screen */
  type: AlertType
  level: AlertLevel
  /** Area name as delivered by the API (shown as-is) */
  place: string
  /** Normalised city coords, -1 … 1 */
  x: number
  z: number
  value: number
  unit: string
  /** `HH:MM` local time */
  time: string
}

export interface CityTrend {
  /** `HH:MM` */
  hours: string[]
  /** Grid power, MW */
  energy: number[]
  /** Vehicles per hour, thousands */
  traffic: number[]
}

export interface CityDistrict {
  name: string
  /** Utilisation, percent */
  load: number
}

export interface CityRoad {
  name: string
  /** Average delay, minutes */
  delay: number
}

export interface CityScreenData {
  project: string
  kpis: CityKpi[]
  alerts: CityAlertRecord[]
  /** Alert counts today per level */
  levels: Record<AlertLevel, number>
  trend: CityTrend
  districts: CityDistrict[]
  roads: CityRoad[]
}
