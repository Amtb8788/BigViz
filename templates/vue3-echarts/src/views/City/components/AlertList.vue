<template>
  <ul v-if="items.length" class="ct-alerts" :style="{ '--start': `${ENTRANCE.content}s` }">
    <li v-for="(a, i) in items" :key="a.id" :style="{ '--i': i }">
      <button
        type="button"
        class="ct-alert"
        :class="[`ct-alert--${a.level}`, { 'is-focus': a.id === focusId }]"
        :aria-pressed="a.id === focusId"
        @click="emit('select', a.id)"
      >
        <span class="ct-alert__level">{{ t.level[a.level] }}</span>
        <span class="ct-alert__main">
          <span class="ct-alert__type">{{ t.type[a.type] }}</span>
          <span class="ct-alert__place">{{ a.place }}</span>
        </span>
        <span class="ct-alert__value">{{ format(a.value) }}<small>{{ a.unit }}</small></span>
        <time class="ct-alert__time">{{ a.time }}</time>
      </button>
    </li>
  </ul>
  <div v-else class="ct-alerts-empty">{{ t.empty }}</div>
</template>

<script setup lang="ts">
// Live alert list: one button per alert. Clicking selects (the screen flies the camera there);
// the focused alert is highlighted, whether it was clicked here, on the map or by the carousel.
import { computed } from 'vue'
import { ENTRANCE } from '@/kit/core/motion'
import { useI18n } from '../i18n'
import type { CityAlertRecord } from '../types'

defineProps<{
  items: CityAlertRecord[]
  /** Highlighted alert id */
  focusId: string | null
}>()

const emit = defineEmits<{ select: [id: string] }>()
const { t, tag } = useI18n()
const fmt = computed(() => new Intl.NumberFormat(tag.value, { maximumFractionDigits: 2 }))
const format = (v: number) => fmt.value.format(v)
</script>

<style scoped>
.ct-alerts {
  display: flex;
  flex-direction: column;
  gap: 6px;
  height: 100%;
  padding: 0;
  margin: 0;
  overflow: hidden;
  list-style: none;
}

/* Rows stretch to fill the panel (capped so a short list does not balloon) */
.ct-alerts li {
  display: flex;
  flex: 1 1 0;
  min-height: 46px;
  max-height: 64px;
  animation: ct-row-in 0.5s ease-out calc(var(--start) + var(--i) * 0.07s) both;
}

.ct-alert {
  --lvl: var(--bv-ok);

  position: relative;
  box-sizing: border-box;
  display: grid;
  grid-template-columns: 58px 1fr auto 46px;
  gap: 10px;
  align-items: center;
  width: 100%;
  min-height: 46px;
  padding: 4px 10px 4px 8px;
  /* stretch inside the flex li */
  align-self: stretch;
  font: inherit;
  color: var(--bv-text);
  text-align: left;
  cursor: pointer;
  background: color-mix(in srgb, var(--bv-primary) 10%, transparent);
  border: 1px solid transparent;
  border-left: 3px solid var(--lvl);
  border-radius: 3px;
  transition:
    background-color 0.3s ease,
    border-color 0.3s ease,
    transform 0.3s ease;
}

.ct-alert--warn {
  --lvl: var(--bv-warn);
}

.ct-alert--critical {
  --lvl: var(--bv-danger, #ff4d5e);
}

.ct-alert:hover {
  background: color-mix(in srgb, var(--bv-primary) 22%, transparent);
}

.ct-alert.is-focus {
  background: linear-gradient(90deg, color-mix(in srgb, var(--lvl) 30%, transparent), transparent);
  border-color: color-mix(in srgb, var(--lvl) 55%, transparent);
  transform: translateX(4px);
}

.ct-alert:focus-visible {
  outline: 2px solid var(--bv-accent);
  outline-offset: 1px;
}

.ct-alert__level {
  padding: 2px 0;
  font-size: 13px;
  font-weight: 700;
  color: var(--lvl);
  text-align: center;
  background: color-mix(in srgb, var(--lvl) 16%, transparent);
  border: 1px solid color-mix(in srgb, var(--lvl) 50%, transparent);
  border-radius: 2px;
}

.ct-alert__main {
  display: flex;
  flex-direction: column;
  min-width: 0;
  line-height: 1.25;
}

.ct-alert__type {
  overflow: hidden;
  font-size: 15px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ct-alert__place {
  overflow: hidden;
  font-size: 13px;
  color: var(--bv-text-dim);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ct-alert__value {
  font-family: var(--bv-font-number);
  font-size: 18px;
  font-weight: 700;
  color: var(--lvl);
  white-space: nowrap;
}

.ct-alert__value small {
  margin-left: 2px;
  font-size: 12px;
  font-weight: 400;
}

.ct-alert__time {
  font-family: var(--bv-font-number);
  font-size: 13px;
  color: var(--bv-text-muted);
  text-align: right;
}

.ct-alerts-empty {
  display: grid;
  place-items: center;
  height: 100%;
  color: var(--bv-text-dim);
}

@keyframes ct-row-in {
  from {
    opacity: 0;
    transform: translateX(-16px);
  }

  to {
    opacity: 1;
    transform: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .ct-alerts li {
    animation: none;
  }

  .ct-alert {
    transition: none;
  }
}
</style>
