<template>
  <div
    v-if="items.length"
    class="bv-rank"
    :class="[`bv-rank--${rankStyle}`, { 'is-grown': grown, 'is-scroll': scrollable }]"
    :style="{ '--done': `${ENTRANCE.done}s`, '--start': `${ENTRANCE.content}s`, '--visible': visible }"
  >
    <ol
      class="bv-rank__track"
      :class="{ 'is-resetting': resetting }"
      :style="{ '--offset': offset }"
      @transitionend="onTrackEnd"
    >
      <li
        v-for="(row, index) in displayRows"
        :key="row.key"
        class="bv-rank__item"
        :class="{ 'is-active': index === activeIndex }"
        :style="{ '--i': index }"
        :aria-hidden="row.clone || undefined"
      >
        <span class="bv-rank__no" :class="`bv-rank__no--${Math.min(row.rank, 4)}`">{{ row.rank }}</span>
        <img
          v-if="row.item.image"
          class="bv-rank__img"
          :src="row.item.image"
          width="36"
          height="36"
          alt=""
          loading="lazy"
        />
        <span class="bv-rank__label" :title="row.item.label">{{ row.item.label }}</span>
        <span v-if="row.item.sub" class="bv-rank__sub">{{ row.item.sub }}</span>
        <span class="bv-rank__bar" aria-hidden="true">
          <i :style="barStyle(row.item.value, index)" />
          <b v-if="row.rank === 1 && ratio(row.item.value) > 0" class="bv-rank__tip" />
        </span>
        <span class="bv-rank__value">
          <CountUp :value="row.item.value" :delay="ENTRANCE.content + index * STAGGER" :locale="locale" />
          {{ unit }}
        </span>
      </li>
    </ol>
  </div>
  <div v-else class="bv-rank-empty">{{ emptyText }}</div>
</template>

<script setup lang="ts">
// Rank list with bars normalised to the leader. More rows than `visible` → seamless upward scroll;
// otherwise the highlight steps through the rows.
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import type { RankRow } from './types'
import CountUp from './CountUp.vue'
import { ENTRANCE, useReducedMotion, useVisibleInterval } from './motion'

/** Row entrance stagger (s) */
const STAGGER = 0.08
/** Bar growth duration (s), matches the CSS transition */
const GROW_DURATION = 1.2

const props = withDefaults(
  defineProps<{
    items: RankRow[]
    unit?: string
    /** medal: shield badges for 1–3; plain: digits only */
    rankStyle?: 'medal' | 'plain'
    /** Visible rows; more items than this enables scrolling */
    visible?: number
    /** Rank of the first row (4 when the list continues a podium) */
    startRank?: number
    /** Bar normalisation base; defaults to the first row */
    maxValue?: number
    /** Step interval of scroll / highlight (ms) */
    interval?: number
    emptyText?: string
    locale?: string
  }>(),
  {
    unit: '',
    rankStyle: 'medal',
    visible: 5,
    startRank: 1,
    maxValue: undefined,
    interval: 2800,
    emptyText: 'No data',
    locale: 'en-US'
  }
)

// ─── Scroll mode ──────────────────────────────────────────────────────────────
// The track gets clones of the first `visible` rows. At offset === items.length the frame equals
// the start, so the transition is switched off for one frame and the offset jumps back to 0.
const scrollable = computed(() => props.items.length > props.visible)
const displayRows = computed(() => {
  const rows = props.items.map((item, i) => ({ key: String(item.id), item, rank: i + props.startRank, clone: false }))
  if (!scrollable.value) return rows
  const clones = rows.slice(0, props.visible).map((row) => ({ ...row, key: `clone-${row.key}`, clone: true }))
  return [...rows, ...clones]
})

const offset = ref(0)
const resetting = ref(false)
const onTrackEnd = (e: TransitionEvent) => {
  if (e.target !== e.currentTarget || e.propertyName !== 'transform') return
  if (offset.value < props.items.length) return
  resetting.value = true
  offset.value = 0
  requestAnimationFrame(() => requestAnimationFrame(() => (resetting.value = false)))
}
watch(
  () => props.items.length,
  (len) => {
    if (offset.value > len) offset.value = 0
  }
)

const ratio = (value: number) => {
  const max = props.maxValue ?? props.items[0]?.value ?? 0
  return max > 0 ? Math.min(1, Math.max(0, value / max)) : 0
}

// ─── Bar growth ───────────────────────────────────────────────────────────────
// Bars are full width and scaled with scaleX (compositor-friendly). Only the first growth staggers.
const reduced = useReducedMotion()
const grown = ref(reduced.value)
const entering = ref(!reduced.value)
const barStyle = (value: number, index: number) => ({
  transform: `scaleX(${grown.value ? ratio(value) : 0})`,
  transitionDelay: entering.value ? `${index * STAGGER}s` : '0s'
})

const timers: ReturnType<typeof setTimeout>[] = []
if (!reduced.value) {
  timers.push(
    setTimeout(() => (grown.value = true), ENTRANCE.content * 1000),
    setTimeout(() => (entering.value = false), (ENTRANCE.content + GROW_DURATION + 1) * 1000)
  )
}
// If reduced motion is switched on mid-entrance, jump to the end state
watch(reduced, (r) => {
  if (r) grown.value = true
})

// ─── Loop: scroll one row or move the highlight ───────────────────────────────
const activeIndex = ref(-1)
useVisibleInterval(
  () => {
    if (scrollable.value) {
      if (!resetting.value) offset.value = Math.min(offset.value + 1, props.items.length)
      return
    }
    const len = props.items.length
    activeIndex.value = len ? (activeIndex.value + 1) % len : -1
  },
  props.interval,
  { delay: ENTRANCE.done * 1000 }
)

onBeforeUnmount(() => timers.forEach(clearTimeout))
</script>

<style scoped src="./RankList.css"></style>
