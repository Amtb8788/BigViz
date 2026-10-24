<template>
  <BigScreen>
    <div class="gl-screen">
      <header class="gl-head">
        <h1>{{ t.title }}</h1>
        <p>{{ t.subtitle }}</p>
        <button type="button" class="gl-lang" @click="lang = lang === 'zh' ? 'en' : 'zh'">{{ t.switchTo }}</button>
      </header>

      <main class="gl-main">
        <div class="gl-col">
          <ScreenPanel :title="t.panel.gauge" from="left" :delay="panelDelay(0)">
            <div class="gl-pair">
              <ScreenChart :option="gaugeA" :label="t.gauge.a" />
              <ScreenChart :option="gaugeB" :label="t.gauge.b" />
            </div>
          </ScreenPanel>
          <ScreenPanel :title="t.panel.liquid" from="left" :delay="panelDelay(1)">
            <div class="gl-pair">
              <LiquidFill :value="water" :label="t.liquid.a" :warn="0.8" :danger="0.92" :locale="locale" />
              <LiquidFill :value="0.86" :label="t.liquid.b" :warn="0.8" :danger="0.92" :locale="locale" />
            </div>
          </ScreenPanel>
          <ScreenPanel :title="t.panel.radar" from="left" :delay="panelDelay(2)">
            <ScreenChart :option="radar" :label="t.panel.radar" />
          </ScreenPanel>
        </div>

        <div class="gl-col gl-col--center">
          <div class="gl-flips">
            <FlipNumber :value="workers" :label="t.flip.workers" :unit="t.flip.unitPeople" :locale="locale" />
            <FlipNumber :value="days" :label="t.flip.days" :unit="t.flip.unitDays" :min-digits="4" :locale="locale" />
          </div>
          <ScreenPanel class="gl-map" :title="t.panel.map" from="up" :delay="panelDelay(1)">
            <GeoMap
              :key="lang"
              :root="{ code: 'demo', name: t.mapRoot }"
              :loader="loader"
              :regions="mapData.regions"
              :points="mapData.points"
              :lines="mapData.lines"
              :label="t.panel.map"
              :back-label="t.back"
              :loading-text="t.loading"
              @level="(_l, _d, geo) => (mapData = levelData(geo as DemoGeoJSON))"
            />
          </ScreenPanel>
        </div>

        <div class="gl-col">
          <ScreenPanel :title="t.panel.funnel" from="right" :delay="panelDelay(0)">
            <ScreenChart :option="funnel" :label="t.panel.funnel" />
          </ScreenPanel>
          <ScreenPanel :title="t.panel.table" from="right" :delay="panelDelay(1)">
            <ScrollTable :columns="columns" :rows="rows" :visible="4" :empty="t.empty" />
          </ScreenPanel>
          <ScreenPanel :title="t.panel.alerts" from="right" :delay="panelDelay(2)">
            <AlertFeed :items="alerts" :max="4" :levels="t.levels" :empty="t.empty" />
          </ScreenPanel>
        </div>
      </main>
    </div>
  </BigScreen>
</template>

<script setup lang="ts">
// Component gallery (`#/gallery`): every catalog component on one screen with live demo data,
// in zh / en. Used as the visual reference for bigviz-build and as the QA target for the kit.
import { computed, ref, shallowRef, watch } from 'vue'
import BigScreen from '@/kit/core/BigScreen.vue'
import ScreenPanel from '@/kit/2d/components/ScreenPanel.vue'
import ScreenChart from '@/kit/2d/components/ScreenChart.vue'
import LiquidFill from '@/kit/2d/components/LiquidFill.vue'
import FlipNumber from '@/kit/2d/components/FlipNumber.vue'
import GeoMap from '@/kit/2d/components/GeoMap.vue'
import ScrollTable from '@/kit/2d/components/ScrollTable.vue'
import AlertFeed from '@/kit/2d/components/AlertFeed.vue'
import { funnelOption, gaugeOption, radarOption } from '@/kit/2d/charts/options'
import { panelDelay, useVisibleInterval } from '@/kit/core/motion'
import { readPalette } from '@/kit/core/palette'
import type { DemoGeoJSON } from './demo-map'
import type { AlertItem, ScrollColumn } from '@/kit/2d/types'
import { FUNNEL, RADAR, crews, demoLoader, levelData, nextAlert, type CrewRow, type Lang } from './demo'
import { DICT } from './i18n'

const lang = ref<Lang>(navigator.language.startsWith('zh') ? 'zh' : 'en')
const t = computed(() => DICT[lang.value])
const locale = computed(() => (lang.value === 'zh' ? 'zh-CN' : 'en-US'))
const p = readPalette()

// ─── Live values (drift on a timer so the gallery shows updates) ──────────────
const progress = ref(68)
const water = ref(0.62)
const workers = ref(1286)
const days = ref(412)
const alerts = shallowRef<AlertItem[]>([])

const seedAlerts = () => (alerts.value = Array.from({ length: 4 }, () => nextAlert(lang.value)).reverse())
seedAlerts()
watch(lang, seedAlerts)

useVisibleInterval(() => {
  progress.value = Math.min(100, Math.max(40, progress.value + (Math.random() - 0.4) * 4))
  water.value = Math.min(0.95, Math.max(0.3, water.value + (Math.random() - 0.5) * 0.08))
  workers.value += Math.round(Math.random() * 6)
}, 3000, { delay: 2400 })
useVisibleInterval(() => (alerts.value = [nextAlert(lang.value), ...alerts.value].slice(0, 8)), 5000, { delay: 3000 })

// ─── Chart options ────────────────────────────────────────────────────────────
const gaugeA = computed(() => gaugeOption({ value: progress.value, unit: '%', label: t.value.gauge.a, warn: 0.9 }, p, locale.value))
const gaugeB = computed(() => gaugeOption({ value: 72, max: 100, unit: 'dB', label: t.value.gauge.b, warn: 0.7, danger: 0.85 }, p, locale.value))
const radar = computed(() =>
  radarOption({ indicators: RADAR[lang.value].axes.map((name) => ({ name, max: 100 })), series: RADAR[lang.value].series }, p)
)
const funnel = computed(() => funnelOption({ stages: FUNNEL[lang.value] }, p, locale.value))

// ─── Table and map ────────────────────────────────────────────────────────────
const rows = computed(() => crews(lang.value))
const columns = computed<ScrollColumn<CrewRow>[]>(() => [
  { key: 'team', title: t.value.table.team, width: '1.4fr' },
  { key: 'zone', title: t.value.table.zone },
  { key: 'people', title: t.value.table.people, align: 'right', width: '64px' },
  {
    key: 'status',
    title: t.value.table.status,
    align: 'center',
    width: '76px',
    badge: true,
    format: (r) => t.value.status[r.status],
    tone: (r) => ({ ok: 'ok', warn: 'warn', off: undefined })[r.status]
  }
])

const loader = computed(() => demoLoader(lang.value))
const mapData = shallowRef(levelData(undefined))
</script>

<style scoped>
.gl-screen {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 0 24px 24px;
  background:
    radial-gradient(ellipse at 50% 0%, color-mix(in srgb, var(--bv-primary) 24%, transparent), transparent 60%),
    var(--bv-bg0);
}

.gl-head {
  position: relative;
  display: flex;
  flex: none;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 88px;
}
.gl-head h1 {
  margin: 0;
  font-size: 30px;
  letter-spacing: 0.12em;
  text-shadow: 0 0 16px var(--bv-glow);
}
.gl-head p {
  margin: 4px 0 0;
  font-size: 13px;
  color: var(--bv-text-muted);
}

.gl-lang {
  position: absolute;
  top: 28px;
  right: 0;
  padding: 4px 14px;
  font: inherit;
  font-size: 13px;
  color: var(--bv-accent);
  cursor: pointer;
  background: transparent;
  border: 1px solid var(--bv-line);
  border-radius: var(--bv-radius);
}

.gl-main {
  display: grid;
  flex: 1;
  grid-template-columns: 460px 1fr 460px;
  gap: var(--bv-gap);
  min-height: 0;
}

.gl-col {
  display: grid;
  grid-template-rows: repeat(3, 1fr);
  gap: var(--bv-gap);
  min-height: 0;
}
.gl-col--center { grid-template-rows: auto 1fr; }

.gl-pair {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  height: 100%;
}

.gl-flips {
  display: flex;
  gap: 48px;
  justify-content: center;
  padding: 8px 0 4px;
}

.gl-map { min-height: 0; }
</style>
