/**
 * Option builders for the catalog chart types (gauge, radar, funnel). Each takes plain data and
 * the palette from readPalette(), so canvas colours follow the theme tokens. Pass the result to
 * ScreenChart. Line / bar / pie stay per-view (their layouts vary too much to share one builder).
 */
import type { EChartsOption } from './echarts'
import { ENTRANCE } from '@/kit/core/motion'
import { alpha, type Palette } from '@/kit/core/palette'

const ENTER_DELAY = ENTRANCE.content * 1000

/** colors[i] wrapping around (lists are never empty) */
const pick = (list: string[], i: number) => list[i % list.length] as string

const tooltip = (p: Palette) => ({
  backgroundColor: alpha(p.bg1, 0.92),
  borderColor: p.accent,
  textStyle: { color: p.text }
})

/** Series colours, in order */
export const seriesColors = (p: Palette) => [p.accent, p.warn, p.ok, p.violet, p.primary]

export interface GaugeData {
  value: number
  min?: number
  max?: number
  unit?: string
  /** Caption under the number */
  label?: string
  /** Fraction (0–1) of the range where the warn colour starts; above `danger` it turns red */
  warn?: number
  danger?: number
  decimals?: number
}

/** Ring gauge: thick progress arc, faint track, big number in the middle */
export function gaugeOption(d: GaugeData, p: Palette, locale = 'en'): EChartsOption {
  const min = d.min ?? 0
  const max = d.max ?? 100
  const ratio = (d.value - min) / (max - min || 1)
  const color = d.danger != null && ratio >= d.danger ? '#ff5a6a' : d.warn != null && ratio >= d.warn ? p.warn : p.accent
  const fmt = new Intl.NumberFormat(locale, { maximumFractionDigits: d.decimals ?? 0 })
  return {
    animationDelay: ENTER_DELAY,
    animationDurationUpdate: 800,
    series: [
      {
        type: 'gauge',
        min,
        max,
        startAngle: 220,
        endAngle: -40,
        radius: '92%',
        center: ['50%', '56%'],
        progress: { show: true, width: 12, roundCap: true, itemStyle: { color, shadowBlur: 12, shadowColor: alpha(color, 0.6) } },
        axisLine: { roundCap: true, lineStyle: { width: 12, color: [[1, alpha(p.primary, 0.22)]] } },
        axisTick: { distance: -24, splitNumber: 4, length: 4, lineStyle: { color: alpha(p.accent, 0.45), width: 1 } },
        splitLine: { distance: -26, length: 8, lineStyle: { color: alpha(p.accent, 0.7), width: 2 } },
        axisLabel: { show: false },
        pointer: { show: false },
        anchor: { show: false },
        title: { offsetCenter: [0, '38%'], color: alpha(p.text, 0.72), fontSize: 13 },
        detail: {
          offsetCenter: [0, '0%'],
          valueAnimation: true,
          color: p.text,
          fontSize: 30,
          fontWeight: 700,
          fontFamily: 'DIN Alternate, Bahnschrift, Inter, sans-serif',
          formatter: (v: number) => `${fmt.format(v)}${d.unit ? `{u|${d.unit}}` : ''}`,
          rich: { u: { fontSize: 14, color: alpha(p.text, 0.7), padding: [8, 0, 0, 2] } }
        },
        data: [{ value: d.value, name: d.label ?? '' }]
      }
    ]
  }
}

export interface RadarData {
  /** Axes, in clockwise order from the top */
  indicators: { name: string; max: number }[]
  /** One polygon per series; values follow `indicators` */
  series: { name: string; values: number[] }[]
}

/** Radar: polygon grid, one filled shape per series */
export function radarOption(d: RadarData, p: Palette): EChartsOption {
  const colors = seriesColors(p)
  return {
    animationDelay: ENTER_DELAY,
    color: colors,
    tooltip: { ...tooltip(p), trigger: 'item' },
    legend: d.series.length > 1
      ? { bottom: 0, icon: 'roundRect', itemWidth: 10, itemHeight: 4, textStyle: { color: alpha(p.text, 0.72), fontSize: 12 } }
      : undefined,
    radar: {
      indicator: d.indicators,
      radius: d.series.length > 1 ? '62%' : '70%',
      center: ['50%', d.series.length > 1 ? '46%' : '52%'],
      splitNumber: 4,
      shape: 'polygon',
      axisName: { color: alpha(p.text, 0.78), fontSize: 12 },
      splitLine: { lineStyle: { color: alpha(p.primary, 0.35) } },
      splitArea: { areaStyle: { color: [alpha(p.primary, 0.04), alpha(p.primary, 0.1)] } },
      axisLine: { lineStyle: { color: alpha(p.primary, 0.35) } }
    },
    series: [
      {
        type: 'radar',
        symbol: 'circle',
        symbolSize: 5,
        data: d.series.map((s, i) => ({
          name: s.name,
          value: s.values,
          lineStyle: { width: 2, color: pick(colors, i) },
          areaStyle: { color: alpha(pick(colors, i), 0.22) }
        }))
      }
    ]
  }
}

export interface FunnelData {
  /** Stages from the widest (top) to the narrowest */
  stages: { name: string; value: number }[]
  unit?: string
}

/** Funnel: stages narrowing top to bottom, conversion rate vs the first stage in the label */
export function funnelOption(d: FunnelData, p: Palette, locale = 'en'): EChartsOption {
  const first = d.stages[0]?.value || 1
  const max = Math.max(...d.stages.map((s) => s.value), 1)
  const num = new Intl.NumberFormat(locale)
  const pct = new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 1 })
  const colors = [p.accent, p.primary, p.violet, p.ok, p.warn]
  return {
    animationDelay: ENTER_DELAY,
    tooltip: { ...tooltip(p), trigger: 'item' },
    series: [
      {
        type: 'funnel',
        sort: 'none',
        left: '6%',
        right: '36%',
        top: 6,
        bottom: 6,
        min: 0,
        max,
        minSize: '18%',
        gap: 4,
        itemStyle: { borderWidth: 0 },
        label: {
          position: 'right',
          color: p.text,
          fontSize: 13,
          formatter: ({ name, value }: { name: string; value: number }) =>
            `{n|${name}}  {v|${num.format(value)}${d.unit ?? ''}}  {r|${pct.format(value / first)}}`,
          rich: {
            n: { color: alpha(p.text, 0.8), fontSize: 13 },
            v: { color: p.text, fontSize: 14, fontWeight: 700 },
            r: { color: p.accent, fontSize: 12 }
          }
        },
        labelLine: { length: 12, lineStyle: { color: alpha(p.accent, 0.5) } },
        data: d.stages.map((s, i) => ({
          ...s,
          itemStyle: {
            color: {
              type: 'linear', x: 0, y: 0, x2: 1, y2: 0,
              colorStops: [
                { offset: 0, color: alpha(pick(colors, i), 0.35) },
                { offset: 0.5, color: alpha(pick(colors, i), 0.9) },
                { offset: 1, color: alpha(pick(colors, i), 0.35) }
              ]
            }
          }
        }))
      }
    ]
  }
}
