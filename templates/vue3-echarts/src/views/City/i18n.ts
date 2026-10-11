/**
 * en / zh dictionary for the city screen. UI chrome and alert categories are translated here;
 * place names come from the API as-is. Shares the stored locale with the example screen, so the
 * language survives switching between `#/` and `#/city`.
 */
import { computed, ref, watchEffect } from 'vue'
import type { AlertLevel } from '@/screen3d/types'
import type { AlertType, CityKpiId } from './types'

export type Locale = 'en' | 'zh'

const en = {
  title: 'Smart City Operations Center',
  loading: 'Loading data…',
  loadError: 'Failed to load data',
  retry: 'Retry',
  empty: 'No data',
  switchTo: '中文',
  switchLabel: 'Switch language to Chinese',
  logoAlt: 'BigViz logo',
  sceneLabel: 'Night-time 3D view of the city with alert beacons',
  hint: 'Drag to rotate · Right-drag to pan · Scroll to zoom · Click a beacon to fly there',
  panel: {
    alerts: 'Live Alerts',
    trend: 'Energy & Traffic · 24 h',
    levels: 'Alerts by Level',
    districts: 'District Load',
    roads: 'Top Congested Roads'
  },
  legend: { energy: 'Grid power', traffic: 'Traffic flow' },
  kpi: {
    health: 'City Health Index',
    sensors: 'Online Sensors',
    speed: 'Avg Traffic Speed',
    gridLoad: 'Grid Load',
    vsYesterday: 'vs yesterday'
  } satisfies Record<CityKpiId | 'vsYesterday', string>,
  level: { info: 'Info', warn: 'Warning', critical: 'Critical' } satisfies Record<AlertLevel, string>,
  type: {
    traffic: 'Congestion',
    power: 'Power overload',
    water: 'Pipe pressure',
    air: 'Air quality',
    fire: 'Fire alarm',
    crowd: 'Crowd density',
    parking: 'Parking full'
  } satisfies Record<AlertType, string>,
  chart: {
    trend: 'Grid power and traffic flow over the last 24 hours',
    levels: 'Share of alerts today by level',
    districts: 'Load per district, percent',
    total: 'Alerts today'
  },
  unit: { score: 'pts', sensors: '', kmh: 'km/h', pct: '%', mw: 'MW', kveh: 'k veh/h', min: 'min' }
}

type Dict = typeof en

const zh: Dict = {
  title: '智慧城市运行中心',
  loading: '数据加载中…',
  loadError: '数据加载失败',
  retry: '重新加载',
  empty: '暂无数据',
  switchTo: 'EN',
  switchLabel: '切换为英文',
  logoAlt: 'BigViz 标志',
  sceneLabel: '夜间城市三维视图，带告警信标',
  hint: '拖动旋转 · 右键平移 · 滚轮缩放 · 点击信标飞抵现场',
  panel: {
    alerts: '实时告警',
    trend: '能耗与交通 · 24 小时',
    levels: '告警等级分布',
    districts: '片区负荷',
    roads: '拥堵道路排行'
  },
  legend: { energy: '电网功率', traffic: '车流量' },
  kpi: {
    health: '城市健康指数',
    sensors: '在线感知设备',
    speed: '平均车速',
    gridLoad: '电网负荷',
    vsYesterday: '较昨日'
  },
  level: { info: '提示', warn: '预警', critical: '严重' },
  type: {
    traffic: '道路拥堵',
    power: '电力过载',
    water: '管网压力',
    air: '空气质量',
    fire: '火情告警',
    crowd: '人流密集',
    parking: '车位已满'
  },
  chart: {
    trend: '近 24 小时电网功率与车流量',
    levels: '今日各等级告警占比',
    districts: '各片区负荷百分比',
    total: '今日告警'
  },
  unit: { score: '分', sensors: '台', kmh: 'km/h', pct: '%', mw: 'MW', kveh: '千辆/时', min: '分钟' }
}

const DICTS: Record<Locale, Dict> = { en, zh }
/** Same key as the example screen: one language choice for the whole app */
const STORAGE_KEY = 'bigviz-example-locale'

const initial = (): Locale => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'en' || saved === 'zh') return saved
  } catch {
    // storage may be blocked; fall through
  }
  return 'en'
}

const locale = ref<Locale>(initial())

watchEffect(() => {
  document.documentElement.lang = locale.value === 'zh' ? 'zh-CN' : 'en'
  try {
    localStorage.setItem(STORAGE_KEY, locale.value)
  } catch {
    // ignore
  }
})

/** Shared locale state and dictionary for the city screen */
export function useI18n() {
  const t = computed(() => DICTS[locale.value])
  /** BCP 47 tag for Intl formatting */
  const tag = computed(() => (locale.value === 'zh' ? 'zh-CN' : 'en-US'))
  const toggle = () => (locale.value = locale.value === 'en' ? 'zh' : 'en')
  return { locale, t, tag, toggle }
}
