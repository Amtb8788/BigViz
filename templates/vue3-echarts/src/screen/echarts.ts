/**
 * Tree-shaken ECharts entry for the kit. Register any extra chart or component you need here
 * (e.g. `MapChart`, `GeoComponent`) instead of importing the full `echarts` bundle.
 */
import { use } from 'echarts/core'
import { BarChart, EffectScatterChart, GaugeChart, LineChart, PieChart, ScatterChart } from 'echarts/charts'
import {
  DatasetComponent,
  GraphicComponent,
  GridComponent,
  LegendComponent,
  MarkLineComponent,
  MarkPointComponent,
  TitleComponent,
  TooltipComponent
} from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'

use([
  BarChart,
  EffectScatterChart,
  GaugeChart,
  LineChart,
  PieChart,
  ScatterChart,
  DatasetComponent,
  GraphicComponent,
  GridComponent,
  LegendComponent,
  MarkLineComponent,
  MarkPointComponent,
  TitleComponent,
  TooltipComponent,
  CanvasRenderer
])

export { init, type ECharts, type EChartsCoreOption as EChartsOption } from 'echarts/core'

const HTML_ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }

/**
 * Escape text for ECharts HTML tooltips. Custom `formatter` functions return raw HTML, so any
 * string from the API (names, categories) must pass through here.
 */
export const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => HTML_ESCAPES[c] ?? c)
