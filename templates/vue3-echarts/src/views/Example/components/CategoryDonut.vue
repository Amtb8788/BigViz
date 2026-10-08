<template>
  <div class="ex-donut">
    <div class="ex-donut__chart">
      <!-- Rotating scale rings around the donut (decorative) -->
      <i class="ex-donut__orbit" aria-hidden="true" />
      <i class="ex-donut__orbit ex-donut__orbit--inner" aria-hidden="true" />
      <ScreenChart ref="chartRef" :option="option" :label="t.chart.categories" @ready="onReady" />
    </div>
    <ul class="ex-donut__legend">
      <li v-for="(item, i) in legend" :key="item.name" :class="{ 'is-active': i === active }">
        <i :style="{ background: colors[i % colors.length] }" aria-hidden="true" />
        <span class="ex-donut__name">{{ item.name }}</span>
        <span class="ex-donut__pct">{{ item.percent }}%</span>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
// Redemption mix: donut with a highlight carousel; centre text and legend follow the active slice.
import { computed, ref } from 'vue'
import ScreenChart from '@/screen/ScreenChart.vue'
import { ENTRANCE, useVisibleInterval } from '@/screen/motion'
import { readPalette } from '@/screen/palette'
import { buildCategoryOption, categoryColors } from '../chart-options'
import { useI18n } from '../i18n'
import type { ExampleCategory } from '../types'

const props = defineProps<{ items: ExampleCategory[] }>()
const { t, tag } = useI18n()

const palette = readPalette()
const colors = categoryColors(palette)
const option = computed(() =>
  props.items.length ? buildCategoryOption(props.items, t.value.chart.total, t.value.unit.items, palette, tag.value) : {}
)

const legend = computed(() => {
  const total = props.items.reduce((sum, item) => sum + item.value, 0)
  return props.items.map((item) => ({
    name: item.name,
    percent: total > 0 ? ((item.value / total) * 100).toFixed(1) : '0.0'
  }))
})

const chartRef = ref<InstanceType<typeof ScreenChart>>()
const active = ref(-1)
// A rebuilt chart (pixel ratio change) has no highlight, so the legend resets too
const onReady = () => (active.value = -1)

useVisibleInterval(
  () => {
    const chart = chartRef.value?.getChart()
    const n = props.items.length
    if (!chart || !n) return
    if (active.value >= 0) chart.dispatchAction({ type: 'downplay', seriesIndex: 0, dataIndex: active.value })
    active.value = (active.value + 1) % n
    const item = legend.value[active.value]
    if (!item) return
    chart.dispatchAction({ type: 'highlight', seriesIndex: 0, dataIndex: active.value })
    chart.setOption({ title: { text: `${item.percent}%`, subtext: item.name } })
  },
  3000,
  { delay: (ENTRANCE.done + 1.9) * 1000 }
)
</script>

<style scoped>
.ex-donut {
  display: flex;
  gap: 12px;
  align-items: center;
  height: 100%;
}

.ex-donut__chart {
  position: relative;
  display: flex;
  flex: 0 0 200px;
  align-self: stretch;
  align-items: center;
  justify-content: center;
}

.ex-donut__chart > :deep(.bv-chart) {
  position: relative;
  align-self: stretch;
}

/* Concentric with the donut (outer radius 84 % of the short side); counter-rotating */
.ex-donut__orbit {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 196px;
  aspect-ratio: 1;
  pointer-events: none;
  border: 1px dashed color-mix(in srgb, var(--bv-accent) 45%, transparent);
  border-radius: 50%;
  transform: translate(-50%, -50%);
  animation: ex-orbit 23s linear infinite;
}

/* Bright arc that reads as a scanning sweep while rotating */
.ex-donut__orbit::after {
  position: absolute;
  inset: -2px;
  content: '';
  border: 2px solid transparent;
  border-top-color: var(--bv-accent);
  border-radius: 50%;
}

.ex-donut__orbit--inner {
  width: 100px;
  border-color: color-mix(in srgb, var(--bv-accent) 25%, transparent);
  animation-duration: 17s;
  animation-direction: reverse;
}

.ex-donut__legend {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 14px;
  min-width: 0;
  padding: 0;
  margin: 0;
  list-style: none;
}

.ex-donut__legend li {
  position: relative;
  display: flex;
  gap: 10px;
  align-items: center;
  padding: 2px 6px;
  font-size: 16px;
  transition: transform 0.4s ease;
}

/* Carousel highlight: gradient wash fades in, row nudges right */
.ex-donut__legend li::before {
  position: absolute;
  inset: 0;
  content: '';
  background: linear-gradient(90deg, color-mix(in srgb, var(--bv-accent) 28%, transparent), transparent);
  border-left: 2px solid var(--bv-accent);
  border-radius: 2px;
  opacity: 0;
  transition: opacity 0.4s ease;
}

.ex-donut__legend li.is-active {
  transform: translateX(6px);
}

.ex-donut__legend li.is-active::before {
  opacity: 1;
}

.ex-donut__legend i {
  position: relative;
  flex: none;
  width: 12px;
  height: 12px;
  border-radius: 2px;
}

.ex-donut__name {
  position: relative;
  flex: 1;
  overflow: hidden;
  color: var(--bv-text-dim);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ex-donut__pct {
  position: relative;
  font-weight: 700;
}

@keyframes ex-orbit {
  to {
    transform: translate(-50%, -50%) rotate(360deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .ex-donut__orbit {
    animation: none;
  }

  .ex-donut__legend li,
  .ex-donut__legend li::before {
    transition: none;
  }
}
</style>
