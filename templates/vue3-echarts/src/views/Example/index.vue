<template>
  <!-- Fixed full-viewport wrapper: host layout rules cannot shrink it (see README "Embedding") -->
  <div class="ex-screen">
    <BigScreen>
      <Ambient />
      <ExampleHeader :project="data?.project ?? ''" />

      <main v-if="data" class="ex-main">
        <!-- Left column: how points are earned -->
        <div class="ex-col ex-col--left">
          <ScreenPanel :title="t.panel.trend" from="left" :delay="panelDelay(0)">
            <template #extra>
              <span class="ex-legend"><i class="is-line" aria-hidden="true" />{{ t.legend.points }}</span>
              <span class="ex-legend"><i class="is-bar" aria-hidden="true" />{{ t.legend.people }}</span>
            </template>
            <ScreenChart ref="trendRef" :option="trendOption" :label="t.chart.trend" @ready="trendIndex = -1" />
          </ScreenPanel>
          <ScreenPanel :title="t.panel.people" from="left" :delay="panelDelay(1)">
            <RankList :items="personRows" :unit="t.unit.points" :visible="5" :empty-text="t.empty" :locale="tag" />
          </ScreenPanel>
          <ScreenPanel :title="t.panel.teams" from="left" :delay="panelDelay(2)">
            <Podium
              :items="teamRows"
              :image="ASSETS['team-podium']"
              :image-alt="t.podiumAlt"
              :unit="t.unit.points"
              :empty-text="t.empty"
              :locale="tag"
            />
          </ScreenPanel>
        </div>

        <!-- Centre column: KPIs + the points cycle -->
        <div class="ex-col ex-col--center">
          <KpiCards class="ex-kpis" :items="kpis" :locale="tag" />
          <HeroHub :nodes="hubNodes" :image="ASSETS['center-hub']" :image-alt="t.hubAlt" :locale="tag" />
        </div>

        <!-- Right column: how points are spent -->
        <div class="ex-col ex-col--right">
          <ScreenPanel :title="t.panel.conversion" from="right" :delay="panelDelay(0)">
            <ConversionRings :data="data.conversion" />
          </ScreenPanel>
          <ScreenPanel :title="t.panel.goods" from="right" :delay="panelDelay(1)">
            <RankList :items="goodsRows" :unit="t.unit.times" rank-style="plain" :empty-text="t.empty" :locale="tag" />
          </ScreenPanel>
          <ScreenPanel :title="t.panel.categories" from="right" :delay="panelDelay(2)">
            <CategoryDonut :items="data.categories" />
          </ScreenPanel>
        </div>
      </main>

      <div v-else-if="loading" class="ex-state" role="status">{{ t.loading }}</div>
      <div v-else class="ex-state" role="alert">
        <p>{{ t.loadError }}</p>
        <button type="button" class="ex-retry" @click="reload">{{ t.retry }}</button>
      </div>
    </BigScreen>
  </div>
</template>

<script setup lang="ts">
// Example screen: full-viewport 1920×1080 dashboard driven by /mock/example.json (or VITE_API_URL).
import { computed, ref } from 'vue'
import BigScreen from '@/screen/BigScreen.vue'
import ScreenPanel from '@/screen/ScreenPanel.vue'
import ScreenChart from '@/screen/ScreenChart.vue'
import RankList from '@/screen/RankList.vue'
import KpiCards from '@/screen/KpiCards.vue'
import HeroHub from '@/screen/HeroHub.vue'
import Podium from '@/screen/Podium.vue'
import { ENTRANCE, panelDelay, useReducedMotion, useVisibleInterval } from '@/screen/motion'
import { readPalette } from '@/screen/palette'
import type { HubNode, KpiItem, RankRow } from '@/screen/types'
import { useScreenData } from '@/api/screen'
import Ambient from './components/Ambient.vue'
import ExampleHeader from './components/ExampleHeader.vue'
import ConversionRings from './components/ConversionRings.vue'
import CategoryDonut from './components/CategoryDonut.vue'
import { ASSETS } from './assets.manifest'
import { buildTrendOption } from './chart-options'
import { useI18n } from './i18n'
import type { KpiId } from './types'

const { data, loading, reload } = useScreenData()
const { t, tag } = useI18n()
const reduced = useReducedMotion()
const palette = readPalette()

// ─── View models ──────────────────────────────────────────────────────────────

/** `YYYY-MM` → short month in the current locale (built in UTC so no timezone shift) */
const formatMonth = (ym: string, fmt: Intl.DateTimeFormat) => {
  const [y, m] = ym.split('-').map(Number)
  if (!y || !m) return ym
  return fmt.format(new Date(Date.UTC(y, m - 1, 1)))
}

const trendOption = computed(() => {
  const trend = data.value?.trend
  if (!trend?.months.length) return {}
  const fmt = new Intl.DateTimeFormat(tag.value, { month: 'short', timeZone: 'UTC' })
  const months = trend.months.map((ym) => formatMonth(ym, fmt))
  const labels = {
    points: t.value.legend.points,
    people: t.value.legend.people,
    monthTotal: t.value.chart.monthTotal,
    unitPoints: t.value.unit.points
  }
  return buildTrendOption(trend, months, labels, palette, tag.value, reduced.value)
})

type UnitKey = 'people' | 'points' | 'times' | 'items'
const KPI_META: Record<KpiId, { icon: keyof typeof ASSETS; unit: UnitKey }> = {
  users: { icon: 'kpi-users', unit: 'people' },
  pointsRedeemed: { icon: 'kpi-coins', unit: 'points' },
  redemptions: { icon: 'kpi-exchange-count', unit: 'times' },
  itemsRedeemed: { icon: 'kpi-gift', unit: 'items' }
}

const kpis = computed<KpiItem[]>(() =>
  (data.value?.kpis ?? []).map((k) => ({
    id: k.id,
    label: t.value.kpi[k.id],
    value: k.value,
    unit: t.value.unit[KPI_META[k.id].unit],
    delta: k.delta,
    deltaLabel: t.value.kpi.vsLastMonth,
    icon: ASSETS[KPI_META[k.id].icon]
  }))
)

// Clockwise flow from top-left: scorers → points earned → points redeemed → redemptions
const hubNodes = computed<HubNode[]>(() => {
  const c = data.value?.cycle
  if (!c) return []
  const h = t.value.hub
  const u = t.value.unit
  return [
    { id: 'people', ...h.people, value: c.people, unit: u.people, icon: ASSETS['ring-helmet'] },
    { id: 'earned', ...h.earned, value: c.earned, unit: u.points, icon: ASSETS['ring-coins'] },
    { id: 'redeemed', ...h.redeemed, value: c.redeemed, unit: u.points, icon: ASSETS['ring-cart'] },
    { id: 'redemptions', ...h.redemptions, value: c.redemptions, unit: u.times, icon: ASSETS['ring-gift'] }
  ]
})

const teamRows = computed<RankRow[]>(() =>
  (data.value?.teams ?? []).map((x) => ({ id: x.team, label: x.team, value: x.points }))
)

const personRows = computed<RankRow[]>(() =>
  (data.value?.people ?? []).map((x) => ({ id: x.id, label: x.name, sub: x.team, value: x.points }))
)

const GOODS_IMAGES = [ASSETS['goods-1'], ASSETS['goods-2'], ASSETS['goods-3'], ASSETS['goods-4'], ASSETS['goods-5']]
const goodsRows = computed<RankRow[]>(() =>
  (data.value?.goods ?? []).map((x, i) => ({ id: x.name, label: x.name, image: GOODS_IMAGES[i]?.src, value: x.times }))
)

// ─── Trend tooltip carousel ───────────────────────────────────────────────────

const trendRef = ref<InstanceType<typeof ScreenChart>>()
const trendIndex = ref(-1)
useVisibleInterval(
  () => {
    const chart = trendRef.value?.getChart()
    const n = data.value?.trend.months.length ?? 0
    if (!chart || !n) return
    trendIndex.value = (trendIndex.value + 1) % n
    chart.dispatchAction({ type: 'showTip', seriesIndex: 0, dataIndex: trendIndex.value })
  },
  2600,
  { delay: (ENTRANCE.done + 1.2) * 1000 }
)
</script>

<style scoped>
/* The screen owns the whole viewport; BigScreen fills this wrapper */
.ex-screen {
  position: fixed;
  inset: 0;
  z-index: 1;
}

/* Stage backdrop: centre glow + fine grid + vertical gradient */
.ex-screen :deep(.bv-stage) {
  background:
    radial-gradient(ellipse 45% 50% at 50% 55%, color-mix(in srgb, var(--bv-primary) 35%, transparent), transparent 70%),
    linear-gradient(color-mix(in srgb, var(--bv-primary) 6%, transparent) 1px, transparent 1px) 0 0 / 40px 40px,
    linear-gradient(90deg, color-mix(in srgb, var(--bv-primary) 6%, transparent) 1px, transparent 1px) 0 0 / 40px 40px,
    linear-gradient(180deg, var(--bv-bg1) 0%, var(--bv-bg0) 100%);
}

/* Three columns 24 / 52 / 24 of the content width */
.ex-main {
  position: relative;
  z-index: 1;
  box-sizing: border-box;
  display: grid;
  grid-template-columns: 24fr 52fr 24fr;
  gap: 20px;
  height: calc(100% - 90px);
  padding: 12px 20px 20px;
}

.ex-col {
  display: grid;
  gap: var(--bv-gap);
  min-width: 0;
  min-height: 0;
}

/* Row weights keep each panel's height when the stage grows taller */
.ex-col--left {
  grid-template-rows: 1.05fr 1.1fr 1.25fr;
}

.ex-col--right {
  grid-template-rows: 0.8fr 1.2fr 1fr;
}

.ex-col--center {
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: center;
}

.ex-kpis {
  flex-shrink: 0;
  align-self: stretch;
  height: 110px;
}

.ex-legend {
  display: inline-flex;
  gap: 6px;
  align-items: center;
  white-space: nowrap;
}

.ex-legend i {
  display: inline-block;
  border-radius: 2px;
}

.ex-legend .is-line {
  width: 18px;
  height: 3px;
  background: var(--bv-warn);
}

.ex-legend .is-bar {
  width: 10px;
  height: 12px;
  background: linear-gradient(180deg, var(--bv-accent), var(--bv-primary));
}

.ex-state {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  gap: 16px;
  align-items: center;
  justify-content: center;
  height: calc(100% - 90px);
  font-size: 20px;
  color: var(--bv-text-dim);
}

.ex-state p {
  margin: 0;
}

.ex-retry {
  padding: 8px 24px;
  font: inherit;
  font-size: 16px;
  color: var(--bv-text);
  cursor: pointer;
  background: var(--bv-primary);
  border: none;
  border-radius: 4px;
}

.ex-retry:focus-visible {
  outline: 2px solid var(--bv-accent);
  outline-offset: 2px;
}
</style>
