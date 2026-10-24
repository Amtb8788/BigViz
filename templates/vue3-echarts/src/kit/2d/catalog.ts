/**
 * Panel catalog: every `panels[].type` in bigviz.yaml and the kit component that builds it.
 * Mirrors `cli/src/bigviz/catalog.py` (the CLI test suite checks both lists match).
 * `bigviz-build` maps panels with this table; anything not here is a `custom` local component.
 */
export const PANEL_CATALOG = {
  line: 'ScreenChart',
  bar: 'ScreenChart',
  pie: 'ScreenChart',
  ring: 'ScreenChart',
  rank: 'RankList',
  podium: 'Podium',
  kpi: 'KpiCards',
  gauge: 'ScreenChart',
  liquid: 'LiquidFill',
  radar: 'ScreenChart',
  funnel: 'ScreenChart',
  map: 'GeoMap',
  'scroll-table': 'ScrollTable',
  alerts: 'AlertFeed',
  flip: 'FlipNumber',
  table: 'custom',
  custom: 'custom'
} as const

export type PanelType = keyof typeof PANEL_CATALOG
