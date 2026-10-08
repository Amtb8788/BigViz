/**
 * ECharts options for the example screen. Colours come from the theme tokens via readPalette(),
 * so the canvas matches the CSS. The screen is always dark; it does not follow OS colour scheme.
 */
import { escapeHtml, type EChartsOption } from '@/screen/echarts'
import { ENTRANCE } from '@/screen/motion'
import { alpha, type Palette } from '@/screen/palette'
import type { ExampleCategory, ExampleTrend } from './types'

/** First render waits for the panels to slide in; update animations are not delayed */
const ENTER_DELAY = ENTRANCE.content * 1000

/** Category colours, in legend order */
export const categoryColors = (p: Palette) => [p.primary, p.ok, p.warn, p.violet, p.accent]

const axisLabel = (p: Palette) => ({ color: alpha(p.text, 0.72), fontSize: 13 })
const tooltipBase = (p: Palette) => ({
  backgroundColor: alpha(p.bg1, 0.92),
  borderColor: p.accent,
  textStyle: { color: p.text }
})

export interface TrendLabels {
  points: string
  people: string
  monthTotal: string
  unitPoints: string
}

/**
 * Points trend: bars = scorers (right axis), line = points earned (left axis).
 * @param months already formatted for the current locale
 * @param reduced swap the rippling effectScatter for a static dot
 */
export function buildTrendOption(
  trend: ExampleTrend,
  months: string[],
  labels: TrendLabels,
  p: Palette,
  locale: string,
  reduced: boolean
): EChartsOption {
  const last = trend.points.length - 1
  const lastValue = trend.points[last] ?? 0
  const compact = new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 1 })
  return {
    animationDurationUpdate: 800,
    animationEasingUpdate: 'cubicInOut',
    tooltip: {
      ...tooltipBase(p),
      trigger: 'axis',
      axisPointer: { type: 'shadow', shadowStyle: { color: alpha(p.accent, 0.12) } }
    },
    grid: { top: 30, right: 8, bottom: 4, left: 4, containLabel: true },
    xAxis: {
      type: 'category',
      data: months,
      axisLine: { lineStyle: { color: alpha(p.primary, 0.5) } },
      axisTick: { show: false },
      axisLabel: axisLabel(p)
    },
    yAxis: [
      {
        type: 'value',
        axisLabel: { ...axisLabel(p), formatter: (v: number) => compact.format(v) },
        splitLine: { lineStyle: { color: alpha(p.primary, 0.18), type: 'dashed' } }
      },
      { type: 'value', axisLabel: axisLabel(p), splitLine: { show: false } }
    ],
    series: [
      {
        name: labels.people,
        type: 'bar',
        yAxisIndex: 1,
        barWidth: 12,
        data: trend.people,
        // Bars grow left to right
        animationDuration: 900,
        animationEasing: 'cubicOut',
        animationDelay: (idx: number) => ENTER_DELAY + idx * 70,
        emphasis: { itemStyle: { shadowBlur: 12, shadowColor: p.accent } },
        itemStyle: {
          borderRadius: [6, 6, 0, 0],
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: p.accent },
              { offset: 1, color: alpha(p.primary, 0.2) }
            ]
          }
        }
      },
      {
        name: labels.points,
        type: 'line',
        smooth: true,
        symbol: 'circle',
        symbolSize: 6,
        data: trend.points,
        // Line draws once the bars are half grown
        animationDuration: 1600,
        animationEasing: 'cubicInOut',
        animationDelay: ENTER_DELAY + 400,
        lineStyle: { width: 3, color: p.warn, shadowBlur: 8, shadowColor: p.warn },
        itemStyle: { color: p.warn },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: alpha(p.warn, 0.28) },
              { offset: 1, color: alpha(p.warn, 0) }
            ]
          }
        },
        markPoint: {
          animationDelay: ENTER_DELAY + 1800,
          symbol: 'roundRect',
          symbolSize: [104, 26],
          symbolOffset: [-34, -22],
          itemStyle: { color: alpha(p.warn, 0.9) },
          label: {
            color: p.text,
            fontWeight: 'bold',
            formatter: () => `${lastValue.toLocaleString(locale)} ${labels.unitPoints}`
          },
          data: [{ name: labels.monthTotal, coord: [last, lastValue], value: lastValue }]
        }
      },
      {
        // Latest month: rippling dot (static under reduced motion)
        name: labels.monthTotal,
        type: reduced ? 'scatter' : 'effectScatter',
        symbolSize: 10,
        ...(reduced ? {} : { rippleEffect: { scale: 3.2, period: 3.4, brushType: 'stroke' } }),
        itemStyle: { color: p.warn, shadowBlur: 10, shadowColor: p.warn },
        tooltip: { show: false },
        animationDelay: ENTER_DELAY + 1800,
        data: [[last, lastValue]],
        z: 5
      }
    ]
  }
}

/** Redemption mix donut; the centre title shows the total and is swapped by the carousel */
export function buildCategoryOption(
  list: ExampleCategory[],
  totalLabel: string,
  unit: string,
  p: Palette,
  locale: string
): EChartsOption {
  const total = list.reduce((sum, item) => sum + item.value, 0)
  return {
    color: categoryColors(p),
    animationDurationUpdate: 800,
    tooltip: {
      ...tooltipBase(p),
      trigger: 'item',
      formatter: (params: unknown) => {
        const { name, value, percent } = params as { name: string; value: number; percent: number }
        return `${escapeHtml(String(name))}: ${Number(value).toLocaleString(locale)} ${escapeHtml(unit)} (${percent}%)`
      }
    },
    title: {
      text: total.toLocaleString(locale),
      subtext: totalLabel,
      left: 'center',
      top: 'middle',
      itemGap: 6,
      textStyle: { color: p.text, fontSize: 24, fontWeight: 'bold' },
      subtextStyle: { color: alpha(p.text, 0.72), fontSize: 13 }
    },
    series: [
      {
        type: 'pie',
        radius: ['62%', '84%'],
        center: ['50%', '50%'],
        padAngle: 2,
        itemStyle: { borderRadius: 4 },
        label: { show: false },
        // Sweeps open clockwise
        animationType: 'expansion',
        animationDuration: 1400,
        animationEasing: 'cubicOut',
        animationDelay: ENTER_DELAY,
        emphasis: { scale: true, scaleSize: 6, itemStyle: { shadowBlur: 16, shadowColor: alpha(p.accent, 0.8) } },
        data: list
      }
    ]
  }
}
