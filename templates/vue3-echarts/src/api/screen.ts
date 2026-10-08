/**
 * Screen data access: plain `fetch` of the mock JSON (or `VITE_API_URL`), validated at the
 * boundary so a malformed response fails loudly instead of rendering NaN, plus a composable with
 * a 60 s silent refresh that pauses while the page is hidden.
 */
import { onMounted, ref, shallowRef } from 'vue'
import { useVisibleInterval } from '@/screen/motion'
import type { ExampleScreenData, KpiId } from '@/views/Example/types'

/** Request timeout (ms) */
const TIMEOUT = 10_000
/** Silent refresh interval (ms) */
export const REFRESH_INTERVAL = 60_000

/** Endpoint: `VITE_API_URL` if set, else the bundled mock next to the app (works under any base) */
export const SCREEN_URL = import.meta.env.VITE_API_URL || `${import.meta.env.BASE_URL}mock/example.json`

// ─── Boundary validation ──────────────────────────────────────────────────────

class ShapeError extends Error {
  constructor(path: string, expected: string) {
    super(`Invalid screen data at "${path}": expected ${expected}`)
    this.name = 'ShapeError'
  }
}

type Obj = Record<string, unknown>
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v)

const obj = (v: unknown, path: string): Obj => {
  if (!isObj(v)) throw new ShapeError(path, 'object')
  return v
}
const num = (v: unknown, path: string): number => {
  if (typeof v !== 'number' || !Number.isFinite(v)) throw new ShapeError(path, 'finite number')
  return v
}
const str = (v: unknown, path: string, max = 200): string => {
  if (typeof v !== 'string' || v.length > max) throw new ShapeError(path, `string ≤ ${max} chars`)
  return v
}
const arr = <T>(v: unknown, path: string, item: (x: unknown, p: string) => T, max = 500): T[] => {
  if (!Array.isArray(v) || v.length > max) throw new ShapeError(path, `array ≤ ${max} items`)
  return v.map((x, i) => item(x, `${path}[${i}]`))
}

const KPI_IDS: readonly KpiId[] = ['users', 'pointsRedeemed', 'redemptions', 'itemsRedeemed']
const kpiId = (v: unknown, path: string): KpiId => {
  if (!KPI_IDS.includes(v as KpiId)) throw new ShapeError(path, KPI_IDS.join(' | '))
  return v as KpiId
}

/**
 * Validate an unknown payload and return a typed copy containing only known fields.
 * @throws ShapeError when a field is missing or has the wrong type
 */
export function parseScreenData(raw: unknown): ExampleScreenData {
  const d = obj(raw, '$')
  const trend = obj(d.trend, 'trend')
  const cycle = obj(d.cycle, 'cycle')
  const conv = obj(d.conversion, 'conversion')
  const data: ExampleScreenData = {
    project: str(d.project, 'project'),
    kpis: arr(d.kpis, 'kpis', (x, p) => {
      const k = obj(x, p)
      return { id: kpiId(k.id, `${p}.id`), value: num(k.value, `${p}.value`), delta: num(k.delta, `${p}.delta`) }
    }),
    trend: {
      months: arr(trend.months, 'trend.months', (x, p) => str(x, p, 7)),
      points: arr(trend.points, 'trend.points', num),
      people: arr(trend.people, 'trend.people', num)
    },
    categories: arr(d.categories, 'categories', (x, p) => {
      const c = obj(x, p)
      return { name: str(c.name, `${p}.name`), value: num(c.value, `${p}.value`) }
    }),
    cycle: {
      people: num(cycle.people, 'cycle.people'),
      earned: num(cycle.earned, 'cycle.earned'),
      redeemed: num(cycle.redeemed, 'cycle.redeemed'),
      redemptions: num(cycle.redemptions, 'cycle.redemptions')
    },
    conversion: {
      avgPoints: num(conv.avgPoints, 'conversion.avgPoints'),
      redeemers: num(conv.redeemers, 'conversion.redeemers'),
      usageRate: num(conv.usageRate, 'conversion.usageRate'),
      participationRate: num(conv.participationRate, 'conversion.participationRate')
    },
    teams: arr(d.teams, 'teams', (x, p) => {
      const t = obj(x, p)
      return { team: str(t.team, `${p}.team`), points: num(t.points, `${p}.points`) }
    }),
    people: arr(d.people, 'people', (x, p) => {
      const t = obj(x, p)
      return {
        id: num(t.id, `${p}.id`),
        name: str(t.name, `${p}.name`),
        team: str(t.team, `${p}.team`),
        points: num(t.points, `${p}.points`)
      }
    }),
    goods: arr(d.goods, 'goods', (x, p) => {
      const g = obj(x, p)
      return { name: str(g.name, `${p}.name`), times: num(g.times, `${p}.times`) }
    })
  }
  const n = data.trend.months.length
  if (data.trend.points.length !== n || data.trend.people.length !== n) {
    throw new ShapeError('trend', 'months, points and people of equal length')
  }
  return data
}

// ─── Fetch ────────────────────────────────────────────────────────────────────

/**
 * Fetch and validate the screen data.
 * @param signal optional abort signal (a 10 s timeout is always applied)
 * @throws on network error, non-2xx status, timeout or invalid shape
 */
export async function fetchScreenData(signal?: AbortSignal): Promise<ExampleScreenData> {
  const timeout = AbortSignal.timeout(TIMEOUT)
  const res = await fetch(SCREEN_URL, {
    headers: { Accept: 'application/json' },
    cache: 'no-store',
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout
  })
  if (!res.ok) throw new Error(`Screen data request failed: HTTP ${res.status}`)
  return parseScreenData(await res.json())
}

/**
 * Load once on mount, then refresh silently every 60 s while the page is visible.
 * Silent refresh never shows loading or errors and keeps the last good data on failure,
 * so components animate from old to new values.
 */
export function useScreenData() {
  const data = shallowRef<ExampleScreenData | null>(null)
  const loading = ref(true)
  const error = ref<string | null>(null)
  let controller: AbortController | null = null

  const request = () => {
    controller?.abort()
    controller = new AbortController()
    return fetchScreenData(controller.signal)
  }

  /** Visible load: drives the loading and error states */
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

  // Data refresh is not motion, so it keeps running under prefers-reduced-motion
  useVisibleInterval(silentRefresh, REFRESH_INTERVAL, { ignoreReducedMotion: true })
  onMounted(load)

  return { data, loading, error, reload: load }
}
