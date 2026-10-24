<template>
  <div
    class="bv-stable"
    :style="{ '--rows': visible, '--cols': gridCols }"
    @mouseenter="hover = true"
    @mouseleave="hover = false"
    @focusin="hover = true"
    @focusout="hover = false"
  >
    <div class="bv-stable__head" role="row">
      <span v-for="c in columns" :key="c.key" role="columnheader" :class="`is-${c.align ?? 'left'}`">{{ c.title }}</span>
    </div>
    <div class="bv-stable__body" role="rowgroup">
      <div v-if="!rows.length" class="bv-stable__empty">{{ empty }}</div>
      <div
        v-else
        class="bv-stable__track"
        :class="{ 'no-anim': jump }"
        :style="{ transform: `translateY(${(-offset * 100) / track.length}%)`, height: `${(track.length / visible) * 100}%` }"
        @transitionend="onEnd"
      >
        <div
          v-for="(r, i) in track"
          :key="`${i}-${r[rowKey]}`"
          class="bv-stable__row"
          role="row"
          :class="{ 'is-odd': (i % rows.length) % 2 === 1 }"
          :aria-hidden="i >= rows.length || undefined"
        >
          <span v-for="c in columns" :key="c.key" role="cell" :class="[`is-${c.align ?? 'left'}`, tone(c, r)]">
            <i v-if="c.badge" class="bv-stable__badge">{{ cell(c, r) }}</i>
            <template v-else>{{ cell(c, r) }}</template>
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts" generic="Row extends Record<string, unknown>">
// Seamless scrolling table (DataV "滚动表格"): fixed header, `visible` rows in view, the body
// steps up one row every `interval` ms and loops without a seam (the first rows are rendered
// again after the last). Pauses on hover / focus, when the tab is hidden and under reduced motion.
// Short lists (rows ≤ visible) do not scroll.
import { computed, ref, watch } from 'vue'
import { ENTRANCE, useVisibleInterval } from '@/kit/core/motion'
import type { ScrollColumn } from '../types'


const props = withDefaults(
  defineProps<{
    columns: ScrollColumn<Row>[]
    rows: Row[]
    /** Rows in view */
    visible?: number
    /** ms between steps */
    interval?: number
    rowKey?: string
    empty?: string
  }>(),
  { visible: 5, interval: 2500, rowKey: 'id', empty: 'No data' }
)

const gridCols = computed(() => props.columns.map((c) => c.width ?? '1fr').join(' '))
const scrolls = computed(() => props.rows.length > props.visible)
const track = computed(() => (scrolls.value ? [...props.rows, ...props.rows.slice(0, props.visible)] : props.rows))

const offset = ref(0)
const jump = ref(false)
const hover = ref(false)

watch(() => props.rows.length, () => { jump.value = true; offset.value = 0 })

useVisibleInterval(
  () => {
    if (!scrolls.value || hover.value) return
    jump.value = false
    offset.value += 1
  },
  props.interval,
  { delay: ENTRANCE.done * 1000 }
)

/** After the copy of the first rows slid into view, snap back to the real first rows */
const onEnd = () => {
  if (offset.value < props.rows.length) return
  jump.value = true
  offset.value = 0
}

const cell = (c: ScrollColumn<Row>, r: Row) => (c.format ? c.format(r) : String(r[c.key] ?? ''))
const tone = (c: ScrollColumn<Row>, r: Row) => {
  const t = c.tone?.(r)
  return t ? `tone-${t}` : ''
}
</script>

<style scoped>
.bv-stable {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  font-size: 14px;
}

.bv-stable__head,
.bv-stable__row {
  display: grid;
  grid-template-columns: var(--cols);
  gap: 8px;
  align-items: center;
  padding: 0 12px;
}

.bv-stable__head {
  flex: none;
  height: 34px;
  font-size: 13px;
  color: var(--bv-accent);
  background: color-mix(in srgb, var(--bv-primary) 22%, transparent);
  border-bottom: 1px solid var(--bv-line);
}

.bv-stable__body {
  position: relative;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.bv-stable__track {
  display: flex;
  flex-direction: column;
  transition: transform 0.6s ease;
}
.bv-stable__track.no-anim { transition: none; }

.bv-stable__row {
  flex: 1 1 0;
  min-height: 0;
  color: var(--bv-text);
  border-bottom: 1px dashed var(--bv-line-soft);
}
.bv-stable__row.is-odd { background: color-mix(in srgb, var(--bv-primary) 8%, transparent); }

.bv-stable span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.is-center { text-align: center; }
.is-right { text-align: right; font-family: var(--bv-font-number); }

.tone-ok { color: var(--bv-ok); }
.tone-warn { color: var(--bv-warn); }
.tone-danger { color: var(--bv-danger); }
.tone-accent { color: var(--bv-accent); }

.bv-stable__badge {
  display: inline-block;
  padding: 1px 8px;
  font-size: 12px;
  font-style: normal;
  line-height: 18px;
  border: 1px solid currentcolor;
  border-radius: 10px;
  background: color-mix(in srgb, currentcolor 14%, transparent);
}

.bv-stable__empty {
  display: grid;
  height: 100%;
  place-items: center;
  color: var(--bv-text-muted);
}

@media (prefers-reduced-motion: reduce) {
  .bv-stable__track { transition: none; }
}
</style>
