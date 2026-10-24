/**
 * ECharts options for the city screen. Colours come from the theme tokens via readPalette() (and
 * `--bv-danger` for critical), so the charts match the 3D beacons and the CSS.
 */
import { escapeHtml, type EChartsOption } from '@/kit/2d/charts/echarts'
import { ENTRANCE } from '@/kit/core/motion'
import { alpha, type Palette } from '@/kit/core/palette'
import type { AlertLevel } from '@/kit/3d/types'
import type { CityDistrict, CityTrend } from './types'

const ENTER_DELAY = ENTRANCE.content * 1000

/** `--bv-danger` (theme) or the kit fallback */
export const dangerColor = () =>
  (typeof document !== 'undefined' &&
    getComputedStyle(document.documentElement).getPropertyValue('--bv-danger').trim()) ||
  '#FF4D5E'

/** Level colours, same mapping as the beacons */
export const levelColors = (p: Palette): Record<AlertLevel, string> => ({
  info: p.ok,
  warn: p.warn,
  critical: dangerColor()
})

const axisLabel = (p: Palette) => ({ color: alpha(p.text, 0.72), fontSize: 13 })
const tooltipBase = (p: Palette) => ({
  backgroundColor: alpha(p.bg1, 0.92),
  borderColor: p.accent,
  textStyle: { color: p.text }
})
const vGradient = (top: string, bottom: string) => ({
  type: 'linear' as const,
  x: 0,
  y: 0,
  x2: 0,
  y2: 1,
  colorStops: [
    { offset: 0, color: top },
    { offset: 1, color: bottom }
  ]
})

/** Energy (area, left axis) + traffic (line, right axis) over 24 h */
export function buildTrendOption(
  trend: CityTrend,
  labels: { energy: string; traffic: string },
  p: Palette,
  reduced: boolean
): EChartsOption {
  const last = trend.hours.length - 1
  return {
    animationDurationUpdate: 800,
    tooltip: { ...tooltipBase(p), trigger: 'axis' },
    grid: { top: 20, right: 6, bottom: 2, left: 4, containLabel: true },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: trend.hours,
      axisLine: { lineStyle: { color: alpha(p.primary, 0.5) } },
      axisTick: { show: false },
      axisLabel: { ...axisLabel(p), interval: 2 }
    },
    yAxis: [
      { type: 'value', axisLabel: axisLabel(p), splitLine: { lineStyle: { color: alpha(p.primary, 0.18), type: 'dashed' } } },
      { type: 'value', axisLabel: axisLabel(p), splitLine: { show: false } }
    ],
    series: [
      {
        name: labels.energy,
        type: 'line',
        smooth: true,
        symbol: 'none',
        data: trend.energy,
        animationDuration: 1600,
        animationDelay: ENTER_DELAY,
        lineStyle: { width: 2.5, color: p.accent, shadowBlur: 8, shadowColor: p.accent },
        areaStyle: { color: vGradient(alpha(p.accent, 0.35), alpha(p.accent, 0)) }
      },
      {
        name: labels.traffic,
        type: 'line',
        yAxisIndex: 1,
        smooth: true,
        symbol: 'none',
        data: trend.traffic,
        animationDuration: 1600,
        animationDelay: ENTER_DELAY + 300,
        lineStyle: { width: 2.5, color: p.violet, shadowBlur: 8, shadowColor: p.violet },
        areaStyle: { color: vGradient(alpha(p.violet, 0.2), alpha(p.violet, 0)) }
      },
      {
        // Latest reading: rippling dot (static under reduced motion)
        name: labels.energy,
        type: reduced ? 'scatter' : 'effectScatter',
        symbolSize: 8,
        ...(reduced ? {} : { rippleEffect: { scale: 3.2, period: 3.4, brushType: 'stroke' } }),
        itemStyle: { color: p.accent, shadowBlur: 10, shadowColor: p.accent },
        tooltip: { show: false },
        animationDelay: ENTER_DELAY + 1600,
        data: [[last, trend.energy[last] ?? 0]],
        z: 5
      }
    ]
  }
}

/** Horizontal load bars; above 90 % turns danger, above 75 % warn */
export function buildDistrictOption(list: CityDistrict[], p: Palette): EChartsOption {
  const danger = dangerColor()
  const colorFor = (v: number) => (v >= 90 ? danger : v >= 75 ? p.warn : p.accent)
  const rows = [...list].reverse()
  return {
    animationDurationUpdate: 800,
    grid: { top: 4, right: 44, bottom: 4, left: 4, containLabel: true },
    xAxis: { type: 'value', max: 100, show: false },
    yAxis: {
      type: 'category',
      data: rows.map((d) => d.name),
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { ...axisLabel(p), fontSize: 14 }
    },
    series: [
      {
        // Track
        type: 'bar',
        data: rows.map(() => 100),
        barWidth: 10,
        barGap: '-100%',
        silent: true,
        itemStyle: { color: alpha(p.primary, 0.16), borderRadius: 5 },
        animation: false
      },
      {
        type: 'bar',
        barWidth: 10,
        data: rows.map((d) => ({
          value: d.load,
          itemStyle: {
            borderRadius: 5,
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 1,
              y2: 0,
              colorStops: [
                { offset: 0, color: alpha(colorFor(d.load), 0.25) },
                { offset: 1, color: colorFor(d.load) }
              ]
            },
            shadowBlur: 8,
            shadowColor: alpha(colorFor(d.load), 0.6)
          }
        })),
        label: {
          show: true,
          position: 'right',
          distance: 8,
          color: p.text,
          fontSize: 14,
          fontWeight: 'bold',
          formatter: (v: unknown) => `${(v as { value: number }).value}%`
        },
        animationDuration: 1200,
        animationEasing: 'cubicOut',
        animationDelay: (i: number) => ENTER_DELAY + i * 80
      }
    ]
  }
}

/** Donut of alerts per level; the centre shows the total */
export function buildLevelOption(
  items: { name: string; value: number; level: AlertLevel }[],
  totalLabel: string,
  p: Palette,
  locale: string
): EChartsOption {
  const colors = levelColors(p)
  const total = items.reduce((s, i) => s + i.value, 0)
  return {
    animationDurationUpdate: 800,
    tooltip: {
      ...tooltipBase(p),
      trigger: 'item',
      formatter: (params: unknown) => {
        const { name, value, percent } = params as { name: string; value: number; percent: number }
        return `${escapeHtml(String(name))}: ${Number(value).toLocaleString(locale)} (${percent}%)`
      }
    },
    title: {
      text: total.toLocaleString(locale),
      subtext: totalLabel,
      left: 'center',
      top: 'middle',
      itemGap: 4,
      textStyle: { color: p.text, fontSize: 24, fontWeight: 'bold' },
      subtextStyle: { color: alpha(p.text, 0.72), fontSize: 12 }
    },
    series: [
      {
        type: 'pie',
        radius: ['64%', '86%'],
        padAngle: 3,
        itemStyle: { borderRadius: 4 },
        label: { show: false },
        animationType: 'expansion',
        animationDuration: 1400,
        animationDelay: ENTER_DELAY,
        emphasis: { scale: true, scaleSize: 5 },
        data: items.map((i) => ({
          name: i.name,
          value: i.value,
          itemStyle: { color: colors[i.level], shadowBlur: 10, shadowColor: alpha(colors[i.level], 0.5) }
        }))
      }
    ]
  }
}
