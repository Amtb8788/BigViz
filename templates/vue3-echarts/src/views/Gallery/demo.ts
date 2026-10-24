/**
 * Demo data for the component gallery (`#/gallery`): a fictional smart construction site.
 * Map boundaries are synthetic (demo-map.ts), so the page works offline and ships no
 * real map data. Values drift on a timer to show live updates.
 */
import { demoMap, type DemoGeoJSON } from './demo-map'
import type { AlertItem } from '@/kit/2d/types'

export type Lang = 'zh' | 'en'

export const DISTRICTS: Record<Lang, string[]> = {
  zh: ['北区', '东区', '南区', '西区', '中心区', '高新区'],
  en: ['North', 'East', 'South', 'West', 'Central', 'Hi-Tech']
}

const SUB: Record<Lang, string[]> = {
  zh: ['一号地块', '二号地块', '三号地块', '四号地块', '五号地块'],
  en: ['Plot 1', 'Plot 2', 'Plot 3', 'Plot 4', 'Plot 5']
}

const maps = new Map<string, DemoGeoJSON>()

/** Loader for GeoMap: root `demo` → districts → plots */
export function demoLoader(lang: Lang) {
  return async (code: string): Promise<DemoGeoJSON> => {
    const key = `${lang}:${code}`
    let m = maps.get(key)
    if (!m) {
      const depth = code.split('-').length - 1
      m = depth === 0 ? demoMap(code, DISTRICTS[lang]) : demoMap(code, SUB[lang], [116.4, 39.9], 0.8)
      if (depth >= 2) m.features.forEach((f) => delete (f.properties as Partial<typeof f.properties>).adcode)
      maps.set(key, m)
    }
    return m
  }
}

/** Region values and markers for whatever level is open */
export function levelData(map: DemoGeoJSON | undefined) {
  const f = map?.features ?? []
  const regions = f.map((x, i) => ({ name: x.properties.name, value: 40 + ((i * 37) % 60) }))
  const points = f.slice(0, 4).map((x, i) => ({
    name: x.properties.name,
    coord: x.properties.center,
    level: (['info', 'warn', 'critical', 'info'] as const)[i]
  }))
  const hub = f[4]?.properties.center ?? f[0]?.properties.center
  const lines = hub ? f.slice(0, 4).map((x) => ({ from: hub, to: x.properties.center })) : []
  return { regions, points, lines }
}

export const RADAR = {
  zh: {
    axes: ['安全', '质量', '进度', '环保', '文明施工', '人员'],
    series: [{ name: '本月', values: [92, 86, 78, 88, 81, 90] }, { name: '上月', values: [85, 82, 84, 76, 79, 83] }]
  },
  en: {
    axes: ['Safety', 'Quality', 'Schedule', 'Environment', 'Site order', 'Staffing'],
    series: [{ name: 'This month', values: [92, 86, 78, 88, 81, 90] }, { name: 'Last month', values: [85, 82, 84, 76, 79, 83] }]
  }
}

const FUNNEL_VALUES = [328, 301, 254, 219, 196]
const stages = (names: string[]) => names.map((name, i) => ({ name, value: FUNNEL_VALUES[i] ?? 0 }))
export const FUNNEL = {
  zh: stages(['隐患上报', '已派单', '整改中', '已整改', '已复核']),
  en: stages(['Reported', 'Assigned', 'Fixing', 'Fixed', 'Verified'])
}

export interface CrewRow extends Record<string, unknown> {
  id: number
  team: string
  zone: string
  people: number
  status: 'ok' | 'warn' | 'off'
}

export function crews(lang: Lang): CrewRow[] {
  const teams = lang === 'zh'
    ? ['钢筋班', '木工班', '混凝土班', '架子工班', '电工班', '水暖班', '塔吊班', '焊工班']
    : ['Rebar', 'Formwork', 'Concrete', 'Scaffold', 'Electrical', 'Plumbing', 'Tower crane', 'Welding']
  return teams.map((team, i) => ({
    id: i + 1,
    team,
    zone: DISTRICTS[lang][i % 6] as string,
    people: 12 + ((i * 7) % 20),
    status: i === 3 ? 'warn' : i === 6 ? 'off' : 'ok'
  }))
}

const ALERTS = {
  zh: [
    { level: 'critical', title: '塔吊风速超限', source: '3 号塔吊' },
    { level: 'warn', title: '扬尘浓度偏高', source: '东区 环境监测' },
    { level: 'info', title: '人员进场 32 人', source: '南门 闸机' },
    { level: 'warn', title: '未佩戴安全帽', source: '北区 AI 摄像头' },
    { level: 'critical', title: '基坑位移预警', source: '中心区 监测点 B4' },
    { level: 'info', title: '混凝土浇筑完成', source: '西区 5 层' }
  ],
  en: [
    { level: 'critical', title: 'Crane wind speed over limit', source: 'Tower crane 3' },
    { level: 'warn', title: 'Dust level high', source: 'East · air monitor' },
    { level: 'info', title: '32 workers checked in', source: 'South gate' },
    { level: 'warn', title: 'No hard hat detected', source: 'North · AI camera' },
    { level: 'critical', title: 'Excavation movement', source: 'Central · sensor B4' },
    { level: 'info', title: 'Concrete pour finished', source: 'West · level 5' }
  ]
} as const

let seq = 0
/** Next alert in the demo cycle, stamped with the current time */
export function nextAlert(lang: Lang, now = new Date()): AlertItem {
  const list = ALERTS[lang]
  const a = list[seq % list.length] as (typeof list)[number]
  seq += 1
  const time = now.toLocaleTimeString(lang === 'zh' ? 'zh-CN' : 'en-GB', { hour12: false })
  return { id: seq, ...a, time }
}
