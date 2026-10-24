<template>
  <div class="bv-geo">
    <nav v-if="stack.length > 1" class="bv-geo__crumbs" :aria-label="backLabel">
      <button type="button" class="bv-geo__back" @click="back">‹ {{ backLabel }}</button>
      <span v-for="(l, i) in stack" :key="l.code" class="bv-geo__crumb" :class="{ 'is-current': i === stack.length - 1 }">
        {{ l.name }}
      </span>
    </nav>
    <ScreenChart v-if="ready" :key="current.code" :option="option" :label="label" @ready="onReady" />
    <div v-if="status" class="bv-geo__status" role="status">{{ status }}</div>
  </div>
</template>

<script setup lang="ts">
// Region map with drill-down (country → province → city …), choropleth values, rippling markers
// and animated flylines. Boundary data comes from `loader(code)` (GeoJSON), so the kit ships no
// map data: plug in your approved source (see docs/guide-spec.md "Panel types"). Clicking a region drills
// in while `depth < maxDepth`; the breadcrumb goes back. The parent supplies data for the
// current level by listening to `level`.
import { computed, ref, shallowRef, watch } from 'vue'
import ScreenChart from './ScreenChart.vue'
import { getMap, registerMap, type ECharts, type EChartsOption } from '../charts/echarts'
import { alpha, readPalette } from '@/kit/core/palette'
import { useReducedMotion } from '@/kit/core/motion'
import type { AlertLevel, GeoJSONLike, GeoLevel } from '../types'

const props = withDefaults(
  defineProps<{
    /** Top level shown first */
    root: GeoLevel
    /** Fetch GeoJSON for a level code. Features need `properties.name`; `adcode` enables drill-down. */
    loader: (code: string) => Promise<GeoJSONLike>
    /** Region values (choropleth), by region name */
    regions?: { name: string; value: number }[]
    /** Markers: [lon, lat] */
    points?: { name: string; coord: [number, number]; value?: number; level?: AlertLevel }[]
    /** Flylines between two coordinates */
    lines?: { from: [number, number]; to: [number, number] }[]
    /** Levels below the root that can be opened by clicking */
    maxDepth?: number
    label?: string
    backLabel?: string
    loadingText?: string
    errorText?: string
  }>(),
  {
    regions: () => [],
    points: () => [],
    lines: () => [],
    maxDepth: 2,
    label: 'Map',
    backLabel: 'Back',
    loadingText: 'Loading map…',
    errorText: 'Map data unavailable'
  }
)

const emit = defineEmits<{
  /** A level finished loading (root, drill in or back). Swap `regions` / `points` / `lines` for it. */
  level: [level: GeoLevel, depth: number, geojson: GeoJSONLike]
  /** Region clicked at the deepest level (or one without children) */
  select: [name: string, level: GeoLevel]
}>()

const reduced = useReducedMotion()
const stack = ref<GeoLevel[]>([props.root])
const current = computed<GeoLevel>(() => stack.value[stack.value.length - 1] ?? props.root)
const mapId = computed(() => `bv-geo:${current.value.code}`)
const ready = ref(false)
const status = ref('')
const geo = shallowRef<GeoJSONLike | null>(null)
const cache = new Map<string, GeoJSONLike>()

watch(
  current,
  async (lvl) => {
    ready.value = false
    status.value = props.loadingText
    try {
      let data = cache.get(lvl.code)
      if (!data) {
        data = await props.loader(lvl.code)
        cache.set(lvl.code, data)
      }
      if (!getMap(`bv-geo:${lvl.code}`)) registerMap(`bv-geo:${lvl.code}`, data as never)
      if (lvl.code !== current.value.code) return // navigated again while loading
      geo.value = data
      emit('level', lvl, stack.value.length - 1, data)
      status.value = ''
      ready.value = true
    } catch {
      status.value = props.errorText
    }
  },
  { immediate: true }
)

watch(() => props.root.code, () => (stack.value = [props.root]))

const back = () => {
  if (stack.value.length < 2) return
  stack.value = stack.value.slice(0, -1)
}

const onReady = (chart: ECharts) => {
  chart.on('click', (e: { componentType?: string; seriesType?: string; name?: string }) => {
    const onRegion = e.componentType === 'geo' || e.seriesType === 'map'
    if (!onRegion || !e.name) return
    const feature = geo.value?.features.find((f) => f.properties.name === e.name)
    const code = feature?.properties.adcode
    if (code == null || stack.value.length > props.maxDepth) {
      emit('select', e.name, current.value)
      return
    }
    stack.value = [...stack.value, { code: String(code), name: e.name }]
  })
}

const LEVEL_COLOR: Record<AlertLevel, (p: ReturnType<typeof readPalette>) => string> = {
  info: (p) => p.accent,
  warn: (p) => p.warn,
  critical: () => '#ff5a6a'
}

const option = computed<EChartsOption>(() => {
  const p = readPalette()
  const values = props.regions.map((r) => r.value)
  const max = Math.max(...values, 1)
  return {
    tooltip: {
      trigger: 'item',
      backgroundColor: alpha(p.bg1, 0.92),
      borderColor: p.accent,
      textStyle: { color: p.text }
    },
    visualMap: props.regions.length
      ? {
          min: 0,
          max,
          show: true,
          left: 8,
          bottom: 8,
          itemWidth: 10,
          itemHeight: 80,
          calculable: false,
          seriesIndex: 0,
          textStyle: { color: alpha(p.text, 0.7), fontSize: 11 },
          inRange: { color: [alpha(p.primary, 0.12), alpha(p.primary, 0.38), alpha(p.accent, 0.55)] }
        }
      : undefined,
    geo: {
      map: mapId.value,
      roam: false,
      layoutCenter: ['50%', '52%'],
      layoutSize: '92%',
      label: { show: true, color: alpha(p.text, 0.75), fontSize: 11 },
      itemStyle: {
        areaColor: alpha(p.primary, 0.18),
        borderColor: alpha(p.accent, 0.8),
        borderWidth: 1,
        shadowColor: alpha(p.accent, 0.5),
        shadowBlur: 10
      },
      emphasis: {
        label: { color: p.text },
        itemStyle: { areaColor: alpha(p.accent, 0.45) }
      },
      select: { disabled: true }
    },
    series: [
      {
        type: 'map',
        geoIndex: 0,
        data: props.regions
      },
      {
        type: 'effectScatter',
        coordinateSystem: 'geo',
        rippleEffect: { scale: reduced.value ? 0 : 3.5, brushType: 'stroke' },
        showEffectOn: 'render',
        symbolSize: 8,
        zlevel: 2,
        label: { show: false },
        data: props.points.map((pt) => ({
          name: pt.name,
          value: [...pt.coord, pt.value ?? 0],
          itemStyle: { color: LEVEL_COLOR[pt.level ?? 'info'](p) }
        }))
      },
      {
        type: 'lines',
        coordinateSystem: 'geo',
        zlevel: 1,
        effect: { show: !reduced.value, period: 4, trailLength: 0.4, symbolSize: 4, color: p.text },
        lineStyle: { color: p.accent, width: 1.2, opacity: 0.6, curveness: 0.25 },
        data: props.lines.map((l) => ({ coords: [l.from, l.to] }))
      }
    ]
  }
})

defineExpose({ back, level: current })
</script>

<style scoped>
.bv-geo {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 0;
}

.bv-geo__crumbs {
  position: absolute;
  top: 4px;
  left: 4px;
  z-index: 1;
  display: flex;
  gap: 8px;
  align-items: center;
  font-size: 13px;
  color: var(--bv-text-muted);
}

.bv-geo__crumb + .bv-geo__crumb::before {
  margin-right: 8px;
  content: '/';
  color: var(--bv-line);
}
.bv-geo__crumb.is-current { color: var(--bv-text); }

.bv-geo__back {
  padding: 2px 10px;
  font: inherit;
  color: var(--bv-accent);
  cursor: pointer;
  background: color-mix(in srgb, var(--bv-primary) 20%, transparent);
  border: 1px solid var(--bv-line);
  border-radius: var(--bv-radius);
}
.bv-geo__back:focus-visible {
  outline: 2px solid var(--bv-accent);
  outline-offset: 1px;
}

.bv-geo__status {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  color: var(--bv-text-muted);
}
</style>
