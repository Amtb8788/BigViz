<template>
  <div class="bv-flip" role="img" :aria-label="ariaLabel">
    <span v-if="label" class="bv-flip__label">{{ label }}</span>
    <span class="bv-flip__digits" aria-hidden="true">
      <template v-for="(c, i) in chars" :key="`${chars.length - i}`">
        <span v-if="/\d/.test(c)" class="bv-flip__cell">
          <span class="bv-flip__reel" :style="{ transform: `translateY(${-Number(c) * 10}%)` }">
            <span v-for="d in 10" :key="d">{{ d - 1 }}</span>
          </span>
        </span>
        <span v-else class="bv-flip__sep">{{ c }}</span>
      </template>
      <span v-if="unit" class="bv-flip__unit">{{ unit }}</span>
    </span>
  </div>
</template>

<script setup lang="ts">
// Flip counter (DataV "数字翻牌器"): each digit sits in its own tile and rolls to the new value.
// Digits are keyed from the right, so 999 → 1,000 rolls the existing tiles and adds one on the left.
// Reduced motion: no roll (transition removed in CSS).
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    value: number
    label?: string
    unit?: string
    decimals?: number
    /** Pad with leading zeros to at least this many integer digits (fixed-width tiles, no separators) */
    minDigits?: number
    locale?: string
  }>(),
  { label: '', unit: '', decimals: 0, minDigits: 0, locale: 'en' }
)

const fmt = computed(
  () =>
    new Intl.NumberFormat(props.locale, {
      minimumFractionDigits: props.decimals,
      maximumFractionDigits: props.decimals,
      minimumIntegerDigits: Math.max(1, props.minDigits),
      useGrouping: !props.minDigits
    })
)
const chars = computed(() => [...fmt.value.format(Math.max(0, props.value))])
const ariaLabel = computed(() => `${props.label} ${fmt.value.format(props.value)} ${props.unit}`.trim())
</script>

<style scoped>
.bv-flip {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.bv-flip__label {
  font-size: 14px;
  color: var(--bv-text-dim);
  letter-spacing: 0.04em;
}

.bv-flip__digits {
  display: flex;
  align-items: flex-end;
  gap: 6px;
}

.bv-flip__cell {
  position: relative;
  width: 0.82em;
  height: 1.3em;
  overflow: hidden;
  font-family: var(--bv-font-number);
  font-size: 40px;
  font-weight: 700;
  line-height: 1.3em;
  color: var(--bv-text);
  text-align: center;
  background: linear-gradient(180deg, var(--bv-panel-top), var(--bv-panel-bottom));
  border: 1px solid var(--bv-line);
  border-radius: var(--bv-radius);
  box-shadow: inset 0 0 12px color-mix(in srgb, var(--bv-accent) 18%, transparent);
}

/* Split line across the middle of the tile */
.bv-flip__cell::after {
  position: absolute;
  inset: 50% 0 auto;
  height: 1px;
  content: '';
  background: color-mix(in srgb, var(--bv-bg0) 70%, transparent);
}

.bv-flip__reel {
  display: flex;
  flex-direction: column;
  height: 1000%;
  transition: transform 0.9s cubic-bezier(0.22, 1, 0.36, 1);
}

.bv-flip__reel > span {
  height: 10%;
  text-shadow: 0 0 10px var(--bv-glow);
}

.bv-flip__sep {
  font-family: var(--bv-font-number);
  font-size: 32px;
  font-weight: 700;
  line-height: 1.3;
  color: var(--bv-text-dim);
}

.bv-flip__unit {
  margin-left: 4px;
  font-size: 16px;
  line-height: 2;
  color: var(--bv-text-dim);
}

@media (prefers-reduced-motion: reduce) {
  .bv-flip__reel { transition: none; }
}
</style>
