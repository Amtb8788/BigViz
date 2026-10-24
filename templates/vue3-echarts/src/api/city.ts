/**
 * City screen data access: plain `fetch` of `mock/city.json` (or `VITE_CITY_API_URL`), validated
 * at the boundary, plus a composable with a 60 s silent refresh that pauses while the page is
 * hidden. Same contract style as ./screen.ts.
 */
import { onMounted, ref, shallowRef } from 'vue'
import { useVisibleInterval } from '@/kit/core/motion'
import type { AlertLevel } from '@/kit/3d/types'
import type { AlertType, CityKpiId, CityScreenData } from '@/views/City/types'
import { ShapeError, arr, num, numIn, obj, oneOf, str } from './validate'

/** Request timeout (ms) */
const TIMEOUT = 10_000
/** Silent refresh interval (ms) */
const REFRESH_INTERVAL = 60_000

/** Endpoint: `VITE_CITY_API_URL` if set, else the bundled mock next to the app */
export const CITY_URL = import.meta.env.VITE_CITY_API_URL || `${import.meta.env.BASE_URL}mock/city.json`

const KPI_IDS: readonly CityKpiId[] = ['health', 'sensors', 'speed', 'gridLoad']
const LEVELS: readonly AlertLevel[] = ['info', 'warn', 'critical']
const TYPES: readonly AlertType[] = ['traffic', 'power', 'water', 'air', 'fire', 'crowd', 'parking']

/**
 * Validate an unknown payload and return a typed copy containing only known fields.
 * @throws ShapeError when a field is missing or has the wrong type
 */
export function parseCityData(raw: unknown): CityScreenData {
  const d = obj(raw, '$')
  const trend = obj(d.trend, 'trend')
  const levels = obj(d.levels, 'levels')
  const data: CityScreenData = {
    project: str(d.project, 'project'),
    kpis: arr(d.kpis, 'kpis', (x, p) => {
      const k = obj(x, p)
      return { id: oneOf(k.id, `${p}.id`, KPI_IDS), value: num(k.value, `${p}.value`), delta: num(k.delta, `${p}.delta`) }
    }),
    alerts: arr(
      d.alerts,
      'alerts',
      (x, p) => {
        const a = obj(x, p)
        return {
          id: str(a.id, `${p}.id`, 64),
          type: oneOf(a.type, `${p}.type`, TYPES),
          level: oneOf(a.level, `${p}.level`, LEVELS),
          place: str(a.place, `${p}.place`, 80),
          x: numIn(a.x, `${p}.x`, -1, 1),
          z: numIn(a.z, `${p}.z`, -1, 1),
          value: num(a.value, `${p}.value`),
          unit: str(a.unit, `${p}.unit`, 12),
          time: str(a.time, `${p}.time`, 5)
        }
      },
      // Beacons are real geometry; keep the count sane
      32
    ),
    levels: {
      info: num(levels.info, 'levels.info'),
      warn: num(levels.warn, 'levels.warn'),
      critical: num(levels.critical, 'levels.critical')
    },
    trend: {
      hours: arr(trend.hours, 'trend.hours', (x, p) => str(x, p, 5)),
      energy: arr(trend.energy, 'trend.energy', num),
      traffic: arr(trend.traffic, 'trend.traffic', num)
    },
    districts: arr(d.districts, 'districts', (x, p) => {
      const t = obj(x, p)
      return { name: str(t.name, `${p}.name`, 60), load: numIn(t.load, `${p}.load`, 0, 100) }
    }),
    roads: arr(d.roads, 'roads', (x, p) => {
      const t = obj(x, p)
      return { name: str(t.name, `${p}.name`, 60), delay: num(t.delay, `${p}.delay`) }
    })
  }
  const n = data.trend.hours.length
  if (data.trend.energy.length !== n || data.trend.traffic.length !== n) {
    throw new ShapeError('trend', 'hours, energy and traffic of equal length')
  }
  if (new Set(data.alerts.map((a) => a.id)).size !== data.alerts.length) {
    throw new ShapeError('alerts', 'unique ids')
  }
  return data
}

/**
 * Fetch and validate the city data.
 * @param signal optional abort signal (a 10 s timeout is always applied)
 * @throws on network error, non-2xx status, timeout or invalid shape
 */
export async function fetchCityData(signal?: AbortSignal): Promise<CityScreenData> {
  const timeout = AbortSignal.timeout(TIMEOUT)
  const res = await fetch(CITY_URL, {
    headers: { Accept: 'application/json' },
    cache: 'no-store',
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout
  })
  if (!res.ok) throw new Error(`City data request failed: HTTP ${res.status}`)
  return parseCityData(await res.json())
}

/** Load once on mount, then refresh silently every 60 s while visible; keeps the last good data */
export function useCityData() {
  const data = shallowRef<CityScreenData | null>(null)
  const loading = ref(true)
  const error = ref<string | null>(null)
  let controller: AbortController | null = null

  const request = () => {
    controller?.abort()
    controller = new AbortController()
    return fetchCityData(controller.signal)
  }

  const load = async () => {
    loading.value = true
    error.value = null
    try {
      data.value = await request()
    } catch (e) {
      data.value = null
      error.value = e instanceof Error ? e.message : String(e)
    } finally {
      loading.value = false
    }
  }

  const silentRefresh = async () => {
    if (!data.value) return
    try {
      data.value = await request()
    } catch {
      // Keep the previous data; the next tick retries
    }
  }

  useVisibleInterval(silentRefresh, REFRESH_INTERVAL, { ignoreReducedMotion: true })
  onMounted(load)

  return { data, loading, error, reload: load }
}
