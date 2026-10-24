<template>
  <div class="bv-liquid" :class="`is-${level}`" role="img" :aria-label="ariaLabel">
    <svg viewBox="0 0 200 200" aria-hidden="true">
      <defs>
        <clipPath :id="clipId"><circle cx="100" cy="100" r="84" /></clipPath>
        <radialGradient :id="glowId" cx="50%" cy="40%" r="60%">
          <stop offset="0%" stop-color="var(--c)" stop-opacity="0.18" />
          <stop offset="100%" stop-color="var(--c)" stop-opacity="0" />
        </radialGradient>
      </defs>
      <circle cx="100" cy="100" r="96" class="bv-liquid__ring" />
      <circle cx="100" cy="100" r="84" :fill="`url(#${glowId})`" />
      <g :clip-path="`url(#${clipId})`">
        <g class="bv-liquid__level" :style="{ transform: `translateY(${surface}px)` }">
          <path class="bv-liquid__wave bv-liquid__wave--back" :d="WAVE" />
          <path class="bv-liquid__wave" :d="WAVE" />
        </g>
      </g>
    </svg>
    <div class="bv-liquid__text">
      <span class="bv-liquid__value">{{ shown }}<small>%</small></span>
      <span v-if="label" class="bv-liquid__label">{{ label }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
// Liquid-fill ball: a ratio (0–1) shown as water in a sphere with two drifting waves. Pure SVG +
// CSS (no echarts-liquidfill dependency). Colour shifts to warn / danger above the thresholds.
// Reduced motion: waves stand still, the number jumps straight to the value.
import { computed, onBeforeUnmount, ref, useId, watch } from 'vue'
import { ENTRANCE, tweenNumber, useReducedMotion } from '@/kit/core/motion'

const props = withDefaults(
  defineProps<{
    /** Fill ratio, 0–1 */
    value: number
    label?: string
    /** Ratio where the colour turns warn / danger (e.g. tank level, disk usage) */
    warn?: number
    danger?: number
    decimals?: number
    locale?: string
  }>(),
  { label: '', warn: undefined, danger: undefined, decimals: 1, locale: 'en' }
)

/** Two wave periods wide so translateX(-50%) loops seamlessly */
const WAVE = 'M0 0 Q25 -8 50 0 T100 0 T150 0 T200 0 T250 0 T300 0 T350 0 T400 0 V220 H0 Z'

const uid = useId()
const clipId = `bv-lq-clip-${uid}`
const glowId = `bv-lq-glow-${uid}`
const reduced = useReducedMotion()

const display = ref(0)
const clamped = computed(() => Math.min(1, Math.max(0, props.value)))
/** Surface y in the 200×200 box: 16 (full) … 184 (empty); follows the tweened number */
const surface = computed(() => 184 - display.value * 168)
const level = computed(() =>
  props.danger != null && clamped.value >= props.danger ? 'danger' : props.warn != null && clamped.value >= props.warn ? 'warn' : 'ok'
)

const fmt = computed(() => new Intl.NumberFormat(props.locale, { minimumFractionDigits: props.decimals, maximumFractionDigits: props.decimals }))
const shown = computed(() => fmt.value.format(display.value * 100))
const ariaLabel = computed(() => `${props.label} ${fmt.value.format(clamped.value * 100)}%`.trim())

let cancel: (() => void) | null = null
let first = true
watch(
  [clamped, reduced],
  ([v]) => {
    cancel?.()
    if (reduced.value) { display.value = v; first = false; return }
    cancel = tweenNumber(display.value, v, (x) => (display.value = x), { duration: 1.4, delay: first ? ENTRANCE.content : 0 })
    first = false
  },
  { immediate: true }
)
onBeforeUnmount(() => cancel?.())
</script>

<style scoped>
.bv-liquid {
  --c: var(--bv-accent);
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 0;
  container-type: size;
  max-width: 100%;
  margin: 0 auto;
}
.bv-liquid.is-warn { --c: var(--bv-warn); }
.bv-liquid.is-danger { --c: var(--bv-danger); }

.bv-liquid svg {
  display: block;
  width: 100%;
  height: 100%;
}

.bv-liquid__ring {
  fill: none;
  stroke: var(--c);
  stroke-width: 3;
  stroke-opacity: 0.7;
  filter: drop-shadow(0 0 6px var(--c));
}


.bv-liquid__wave {
  fill: var(--c);
  fill-opacity: 0.55;
  animation: bv-lq-drift 4s linear infinite;
}
.bv-liquid__wave--back {
  fill-opacity: 0.28;
  animation-duration: 6.5s;
  animation-direction: reverse;
}

@keyframes bv-lq-drift {
  from { transform: translateX(0); }
  to { transform: translateX(-200px); }
}

.bv-liquid__text {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  pointer-events: none;
}

.bv-liquid__value {
  font-family: var(--bv-font-number);
  font-size: clamp(18px, 22cqmin, 34px);
  font-weight: 700;
  color: var(--bv-text);
  text-shadow: 0 0 8px var(--bv-bg0), 0 0 2px var(--bv-bg0);
}
.bv-liquid__value small {
  margin-left: 2px;
  font-size: 0.5em;
  color: var(--bv-text-dim);
}

.bv-liquid__label {
  font-size: 13px;
  color: var(--bv-text-dim);
  text-shadow: 0 0 6px var(--bv-bg0);
}

@media (prefers-reduced-motion: reduce) {
  .bv-liquid__wave { animation: none; }

}
</style>
