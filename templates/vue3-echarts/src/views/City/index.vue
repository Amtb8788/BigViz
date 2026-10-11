<template>
  <div class="ct-screen">
    <BigScreen>
      <!-- Full-bleed 3D city behind everything; panels float over it as glass -->
      <CityHero
        ref="heroRef"
        class="ct-hero"
        :alerts="beacons"
        :focus-id="focusId"
        :seed="SEED"
        :label="t.sceneLabel"
        :locale="tag"
        :label-insets="LABEL_INSETS"
        @select="onBeaconSelect"
      />
      <div class="ct-vignette" aria-hidden="true" />

      <CityHeader class="ct-layer" :project="data?.project ?? ''" />

      <main v-if="data" class="ct-main ct-layer">
        <div class="ct-col ct-col--left">
          <ScreenPanel :title="t.panel.alerts" from="left" :delay="panelDelay(0)">
            <template #extra>
              <span class="ct-live"><i aria-hidden="true" />LIVE</span>
            </template>
            <AlertList :items="data.alerts" :focus-id="focusId" @select="onListSelect" />
          </ScreenPanel>
          <ScreenPanel class="ct-trend" :title="t.panel.trend" from="left" :delay="panelDelay(1)">
            <template #extra>
              <span class="ct-legend"><i class="is-energy" aria-hidden="true" />{{ t.legend.energy }}</span>
              <span class="ct-legend"><i class="is-traffic" aria-hidden="true" />{{ t.legend.traffic }}</span>
            </template>
            <ScreenChart :option="trendOption" :label="t.chart.trend" />
          </ScreenPanel>
        </div>

        <!-- Centre stays clear: pointer events fall through to the canvas -->
        <div class="ct-col ct-col--center">
          <KpiCards class="ct-kpis" :items="kpis" :locale="tag" />
          <p class="ct-hint">
            <span v-for="lvl in LEVELS" :key="lvl" class="ct-hint__lvl" :class="`is-${lvl}`">
              <i aria-hidden="true" />{{ t.level[lvl] }}
            </span>
            <span class="ct-hint__text">{{ t.hint }}</span>
          </p>
        </div>

        <div class="ct-col ct-col--right">
          <ScreenPanel :title="t.panel.levels" from="right" :delay="panelDelay(0)">
            <LevelDonut :levels="data.levels" />
          </ScreenPanel>
          <ScreenPanel :title="t.panel.districts" from="right" :delay="panelDelay(1)">
            <ScreenChart :option="districtOption" :label="t.chart.districts" />
          </ScreenPanel>
          <ScreenPanel :title="t.panel.roads" from="right" :delay="panelDelay(2)">
            <RankList class="ct-roads" :items="roadRows" :unit="t.unit.min" :visible="5" :empty-text="t.empty" :locale="tag" />
          </ScreenPanel>
        </div>
      </main>

      <div v-else-if="loading" class="ct-state ct-layer" role="status">{{ t.loading }}</div>
      <div v-else class="ct-state ct-layer" role="alert">
        <p>{{ t.loadError }}</p>
        <button type="button" class="ct-retry" @click="reload">{{ t.retry }}</button>
      </div>
    </BigScreen>
  </div>
</template>

<script setup lang="ts">
// Smart City Operations Center: a procedural 3D night city (CityHero, lazy three.js) behind glass
// side panels, driven by /mock/city.json (or VITE_CITY_API_URL). Alerts appear as beacons; the
// focus rotates through them, and clicking a row or a beacon flies the camera there.
import { computed, ref } from 'vue'
import BigScreen from '@/screen/BigScreen.vue'
import ScreenPanel from '@/screen/ScreenPanel.vue'
import ScreenChart from '@/screen/ScreenChart.vue'
import RankList from '@/screen/RankList.vue'
import KpiCards from '@/screen/KpiCards.vue'
import { ENTRANCE, panelDelay, useReducedMotion, useVisibleInterval } from '@/screen/motion'
import { readPalette } from '@/screen/palette'
import type { KpiItem, RankRow } from '@/screen/types'
import { CityHero, type AlertLevel, type CityAlert, type LabelInsets } from '@/screen3d'
import { useCityData } from '@/api/city'
import CityHeader from './components/CityHeader.vue'
import AlertList from './components/AlertList.vue'
import LevelDonut from './components/LevelDonut.vue'
import { buildDistrictOption, buildTrendOption } from './chart-options'
import { useI18n } from './i18n'
import type { CityKpiId } from './types'

/** City layout seed: change it for a different (but again reproducible) city */
const SEED = 20251
/** Focus carousel step (ms); not a multiple of the other loops so they never sync up */
const FOCUS_STEP = 7900
/** After a manual pick the carousel waits this long (ms) */
const MANUAL_HOLD = 14_000
const LEVELS: AlertLevel[] = ['critical', 'warn', 'info']
/**
 * Beacon labels stay in the centre column, between the KPI strip and the legend (design px, from
 * index.css: 90 header + 12 padding + 104 KPIs; 20 padding + 450 column + 24 gap; legend ≈ 40 + 20).
 * Small margins keep them off the panel borders.
 */
const LABEL_INSETS: LabelInsets = { top: 214, right: 500, bottom: 68, left: 500 }

const { data, loading, reload } = useCityData()
const { t, tag } = useI18n()
const reduced = useReducedMotion()
const palette = readPalette()

// ─── View models ──────────────────────────────────────────────────────────────

const beacons = computed<CityAlert[]>(() =>
  (data.value?.alerts ?? []).map((a) => ({
    id: a.id,
    label: t.value.type[a.type],
    level: a.level,
    x: a.x,
    z: a.z,
    value: a.value,
    unit: a.unit
  }))
)

const KPI_META: Record<CityKpiId, { unit: keyof typeof t.value.unit; decimals: number }> = {
  health: { unit: 'score', decimals: 1 },
  sensors: { unit: 'sensors', decimals: 0 },
  speed: { unit: 'kmh', decimals: 1 },
  gridLoad: { unit: 'pct', decimals: 1 }
}

const kpis = computed<KpiItem[]>(() =>
  (data.value?.kpis ?? []).map((k) => ({
    id: k.id,
    label: t.value.kpi[k.id],
    value: k.value,
    unit: t.value.unit[KPI_META[k.id].unit] || undefined,
    decimals: KPI_META[k.id].decimals,
    delta: k.delta,
    deltaLabel: t.value.kpi.vsYesterday
  }))
)

const trendOption = computed(() => {
  const trend = data.value?.trend
  if (!trend?.hours.length) return {}
  return buildTrendOption(trend, t.value.legend, palette, reduced.value)
})

const districtOption = computed(() => (data.value?.districts.length ? buildDistrictOption(data.value.districts, palette) : {}))

const roadRows = computed<RankRow[]>(() =>
  (data.value?.roads ?? []).map((r) => ({ id: r.name, label: r.name, value: r.delay }))
)

// ─── Focus ────────────────────────────────────────────────────────────────────

const heroRef = ref<InstanceType<typeof CityHero>>()
const focusId = ref<string | null>(null)
let manualAt = 0

const focus = (id: string) => {
  focusId.value = id
  manualAt = Date.now()
}

/** Row click: fly the camera, highlight */
const onListSelect = (id: string) => {
  heroRef.value?.flyTo(id)
  focus(id)
}
/** Beacon / label click: CityHero is already flying there */
const onBeaconSelect = (id: string) => focus(id)

// Carousel: highlight the next alert (beacon brightens, row and label light up)
useVisibleInterval(
  () => {
    if (Date.now() - manualAt < MANUAL_HOLD) return
    const list = data.value?.alerts ?? []
    if (!list.length) return
    const i = list.findIndex((a) => a.id === focusId.value)
    focusId.value = list[(i + 1) % list.length]?.id ?? null
  },
  FOCUS_STEP,
  { delay: ENTRANCE.done * 1000 }
)
</script>

<style scoped src="./index.css"></style>
