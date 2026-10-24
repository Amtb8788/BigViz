<template>
  <div class="bv-feed">
    <TransitionGroup v-if="shown.length" tag="ul" name="bv-feed" class="bv-feed__list">
      <li v-for="a in shown" :key="a.id" class="bv-feed__item" :class="`is-${a.level}`">
        <button type="button" class="bv-feed__btn" @click="emit('select', a)">
          <span class="bv-feed__dot" aria-hidden="true" />
          <span class="bv-feed__level">{{ levels[a.level] }}</span>
          <span class="bv-feed__main">
            <span class="bv-feed__title">{{ a.title }}</span>
            <span v-if="a.source" class="bv-feed__source">{{ a.source }}</span>
          </span>
          <time class="bv-feed__time">{{ a.time }}</time>
        </button>
      </li>
    </TransitionGroup>
    <div v-else class="bv-feed__empty">{{ empty }}</div>
  </div>
</template>

<script setup lang="ts">
// Live alert / event feed (Grafana-style): newest on top, new items slide in, critical rows pulse.
// Push a new item to the front of `items` (or replace the array) and the list animates.
// Only the first `max` items render. Reduced motion: no slide, no pulse.
import { computed } from 'vue'
import type { AlertItem, AlertLevel } from '../types'

const props = withDefaults(
  defineProps<{
    /** Newest first */
    items: AlertItem[]
    max?: number
    /** Level captions, e.g. { info: '提示', warn: '预警', critical: '告警' } */
    levels?: Record<AlertLevel, string>
    empty?: string
  }>(),
  { max: 6, levels: () => ({ info: 'Info', warn: 'Warn', critical: 'Alarm' }), empty: 'No alerts' }
)

const emit = defineEmits<{ select: [item: AlertItem] }>()
const shown = computed(() => props.items.slice(0, props.max))
</script>

<style scoped>
.bv-feed {
  height: 100%;
  min-height: 0;
  overflow: hidden;
}

.bv-feed__list {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 0;
  margin: 0;
  list-style: none;
}

.bv-feed__item {
  --c: var(--bv-accent);
}
.bv-feed__item.is-warn { --c: var(--bv-warn); }
.bv-feed__item.is-critical { --c: var(--bv-danger); }

.bv-feed__btn {
  display: grid;
  grid-template-columns: auto auto 1fr auto;
  gap: 10px;
  align-items: center;
  width: 100%;
  height: 44px;
  padding: 0 12px;
  font: inherit;
  color: var(--bv-text);
  text-align: left;
  cursor: pointer;
  background: linear-gradient(90deg, color-mix(in srgb, var(--c) 16%, transparent), transparent 70%);
  border: 0;
  border-left: 3px solid var(--c);
  border-radius: 2px;
}
.bv-feed__btn:focus-visible {
  outline: 2px solid var(--bv-accent);
  outline-offset: 1px;
}

.bv-feed__dot {
  width: 8px;
  height: 8px;
  background: var(--c);
  border-radius: 50%;
  box-shadow: 0 0 8px var(--c);
}
.is-critical .bv-feed__dot { animation: bv-feed-pulse 1.2s ease-in-out infinite; }

.bv-feed__level {
  padding: 1px 6px;
  font-size: 12px;
  color: var(--c);
  border: 1px solid var(--c);
  border-radius: 2px;
}

.bv-feed__main {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.bv-feed__title,
.bv-feed__source {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.bv-feed__title { font-size: 14px; }
.bv-feed__source { font-size: 12px; color: var(--bv-text-muted); }

.bv-feed__time {
  font-family: var(--bv-font-number);
  font-size: 13px;
  color: var(--bv-text-dim);
}

.bv-feed__empty {
  display: grid;
  height: 100%;
  place-items: center;
  color: var(--bv-text-muted);
}

/* New items slide in from the left; old ones fade out; the rest glide down */
.bv-feed-enter-from { opacity: 0; transform: translateX(-24px); }
.bv-feed-leave-to { opacity: 0; }
.bv-feed-enter-active,
.bv-feed-leave-active,
.bv-feed-move { transition: all 0.5s ease; }
.bv-feed-leave-active { position: absolute; width: 100%; }

@keyframes bv-feed-pulse {
  50% { opacity: 0.25; box-shadow: 0 0 2px var(--c); }
}

@media (prefers-reduced-motion: reduce) {
  .bv-feed-enter-active,
  .bv-feed-leave-active,
  .bv-feed-move { transition: none; }
  .is-critical .bv-feed__dot { animation: none; }
}
</style>
