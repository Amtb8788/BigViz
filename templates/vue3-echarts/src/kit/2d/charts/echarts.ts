/**
 * Tree-shaken ECharts entry for the kit. Register any extra chart or component you need here
 * instead of importing the full `echarts` bundle.
 */
import { use } from 'echarts/core'
import {
  BarChart,
  EffectScatterChart,
  FunnelChart,
  GaugeChart,
  LineChart,
  LinesChart,
  MapChart,
  PieChart,
  RadarChart,
  ScatterChart
} from 'echarts/charts'
import {
  DatasetComponent,
  GeoComponent,
  GraphicComponent,
  GridComponent,
  LegendComponent,
  MarkLineComponent,
  MarkPointComponent,
  RadarComponent,
  TitleComponent,
  TooltipComponent,
  VisualMapComponent
} from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'

use([
  BarChart,
  EffectScatterChart,
  FunnelChart,
  GaugeChart,
  LineChart,
  LinesChart,
  MapChart,
  PieChart,
  RadarChart,
  ScatterChart,
  DatasetComponent,
  GeoComponent,
  GraphicComponent,
  GridComponent,
  LegendComponent,
  MarkLineComponent,
  MarkPointComponent,
  RadarComponent,
  TitleComponent,
  TooltipComponent,
  VisualMapComponent,
  CanvasRenderer
])

export { init, registerMap, getMap, type ECharts, type EChartsCoreOption as EChartsOption } from 'echarts/core'

const HTML_ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }

/**
 * Escape text for ECharts HTML tooltips. Custom `formatter` functions return raw HTML, so any
 * string from the API (names, categories) must pass through here.
 */
export const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => HTML_ESCAPES[c] ?? c)
