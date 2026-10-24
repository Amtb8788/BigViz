<template>
  <div class="ct-donut">
    <div class="ct-donut__chart">
      <i class="ct-donut__orbit" aria-hidden="true" />
      <ScreenChart :option="option" :label="t.chart.levels" />
    </div>
    <ul class="ct-donut__legend">
      <li v-for="item in legend" :key="item.level">
        <i :style="{ background: colors[item.level] }" aria-hidden="true" />
        <span class="ct-donut__name">{{ item.name }}</span>
        <span class="ct-donut__count">{{ item.value.toLocaleString(tag) }}</span>
        <span class="ct-donut__pct">{{ item.percent }}%</span>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
// Alerts per level: donut (colours shared with the 3D beacons) and a legend with counts.
import { computed } from 'vue'
import ScreenChart from '@/kit/2d/components/ScreenChart.vue'
import { readPalette } from '@/kit/core/palette'
import type { AlertLevel } from '@/kit/3d/types'
import { buildLevelOption, levelColors } from '../chart-options'
import { useI18n } from '../i18n'

const props = defineProps<{ levels: Record<AlertLevel, number> }>()
const { t, tag } = useI18n()

const palette = readPalette()
const colors = levelColors(palette)
const ORDER: AlertLevel[] = ['critical', 'warn', 'info']

const legend = computed(() => {
  const total = ORDER.reduce((s, l) => s + props.levels[l], 0)
  return ORDER.map((level) => ({
    level,
    name: t.value.level[level],
    value: props.levels[level],
    percent: total > 0 ? ((props.levels[level] / total) * 100).toFixed(1) : '0.0'
  }))
})

const option = computed(() => buildLevelOption(legend.value, t.value.chart.total, palette, tag.value))
</script>

<style scoped>
.ct-donut {
  display: flex;
  gap: 16px;
  align-items: center;
  height: 100%;
}

.ct-donut__chart {
  position: relative;
  display: flex;
  flex: 0 0 170px;
  align-self: stretch;
}

.ct-donut__chart > :deep(.bv-chart) {
  position: relative;
}

.ct-donut__orbit {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 164px;
  aspect-ratio: 1;
  pointer-events: none;
  border: 1px dashed color-mix(in srgb, var(--bv-accent) 40%, transparent);
  border-radius: 50%;
  transform: translate(-50%, -50%);
  animation: ct-orbit 23s linear infinite;
}

.ct-donut__orbit::after {
  position: absolute;
  inset: -2px;
  content: '';
  border: 2px solid transparent;
  border-top-color: var(--bv-accent);
  border-radius: 50%;
}

.ct-donut__legend {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 14px;
  min-width: 0;
  padding: 0;
  margin: 0;
  list-style: none;
}

.ct-donut__legend li {
  display: grid;
  grid-template-columns: 12px 1fr auto 52px;
  gap: 10px;
  align-items: center;
  font-size: 16px;
}

.ct-donut__legend i {
  width: 12px;
  height: 12px;
  border-radius: 2px;
}

.ct-donut__name {
  overflow: hidden;
  color: var(--bv-text-dim);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ct-donut__count {
  font-family: var(--bv-font-number);
  font-weight: 700;
}

.ct-donut__pct {
  font-family: var(--bv-font-number);
  color: var(--bv-text-muted);
  text-align: right;
}

@keyframes ct-orbit {
  to {
    transform: translate(-50%, -50%) rotate(360deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .ct-donut__orbit {
    animation: none;
  }
}
</style>
