<template>
  <div class="ex-conv">
    <div class="ex-conv__avg">
      <div class="ex-conv__label">{{ t.conv.avg }}</div>
      <div class="ex-conv__num">
        <CountUp :value="data.avgPoints" :decimals="1" :delay="ENTRANCE.content" :locale="tag" /><small>{{
          t.unit.points
        }}</small>
      </div>
      <div class="ex-conv__sub">
        {{ t.conv.redeemers }}
        <CountUp :value="data.redeemers" :delay="ENTRANCE.content" :locale="tag" />
        {{ t.unit.people }}
      </div>
    </div>
    <i class="ex-conv__divider" aria-hidden="true" />
    <div v-for="(ring, i) in rings" :key="ring.id" class="ex-conv__ring">
      <div
        class="ex-ring"
        :class="{ 'is-reverse': i % 2 === 1, 'is-on': on }"
        role="img"
        :aria-label="`${ring.name} ${ring.value}%`"
        :style="{ '--p': clamp(ring.value), '--c1': ring.colors[0], '--c2': ring.colors[1], '--d': `${ringDelay(i)}s` }"
      >
        <!-- Pointer rotates to the end of the arc (transform transition) -->
        <i class="ex-ring__pointer" aria-hidden="true" />
        <span aria-hidden="true">
          <CountUp :value="ring.value" :decimals="1" :delay="ringDelay(i)" :separator="false" />%
        </span>
      </div>
      <div class="ex-ring__name">{{ ring.name }}</div>
      <div class="ex-ring__formula">{{ ring.formula }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
// Points usage: average per scorer + two progress rings (CSS conic-gradient). The arc itself is
// static (animating the gradient would repaint every frame); the ring sweeps in with a rotate and
// the pointer travels to the end with a transform transition.
import { computed, onBeforeUnmount, ref } from 'vue'
import CountUp from '@/screen/CountUp.vue'
import { ENTRANCE, useReducedMotion } from '@/screen/motion'
import { useI18n } from '../i18n'
import type { ExampleConversion } from '../types'

const props = defineProps<{ data: ExampleConversion }>()
const { t, tag } = useI18n()

const ringDelay = (i: number) => ENTRANCE.content + 0.2 + i * 0.15

// `on` flips after mount so the pointer transitions from 0 to its value
const reduced = useReducedMotion()
const on = ref(reduced.value)
const raf = requestAnimationFrame(() => requestAnimationFrame(() => (on.value = true)))
onBeforeUnmount(() => cancelAnimationFrame(raf))

const rings = computed(() => [
  {
    id: 'usage',
    name: t.value.conv.usage,
    formula: t.value.conv.usageFormula,
    value: props.data.usageRate,
    colors: ['var(--bv-ok)', 'var(--bv-primary)']
  },
  {
    id: 'participation',
    name: t.value.conv.participation,
    formula: t.value.conv.participationFormula,
    value: props.data.participationRate,
    colors: ['var(--bv-violet)', 'var(--bv-primary)']
  }
])

const clamp = (v: number) => Math.max(0, Math.min(100, v))
</script>

<style scoped>
/* Average card | divider | two rings, each centred in its cell */
.ex-conv {
  box-sizing: border-box;
  display: grid;
  grid-template-columns: 1.15fr auto 1fr 1fr;
  column-gap: 14px;
  align-items: center;
  height: 100%;
  padding: 6px 0;
}

.ex-conv__avg {
  position: relative;
  min-width: 0;
  padding: 14px 12px 14px 18px;
  background: linear-gradient(90deg, color-mix(in srgb, var(--bv-primary) 18%, transparent), transparent);
  border-radius: 4px;
}

.ex-conv__avg::before {
  position: absolute;
  top: 12px;
  bottom: 12px;
  left: 0;
  width: 3px;
  content: '';
  background: linear-gradient(180deg, var(--bv-accent), var(--bv-primary));
  border-radius: 2px;
  box-shadow: 0 0 8px var(--bv-glow);
}

.ex-conv__divider {
  align-self: stretch;
  width: 1px;
  margin: 10px 0;
  background: linear-gradient(180deg, transparent, var(--bv-line) 30%, var(--bv-line) 70%, transparent);
}

.ex-conv__label {
  font-size: 15px;
  color: var(--bv-text-dim);
}

.ex-conv__num {
  margin: 10px 0 12px;
  font-family: var(--bv-font-number);
  font-size: 46px;
  font-weight: 700;
  line-height: 1;
  text-shadow: 0 0 12px var(--bv-glow);
}

.ex-conv__num small {
  margin-left: 6px;
  font-size: 18px;
  font-weight: 400;
}

.ex-conv__sub {
  font-size: 13px;
  line-height: 1.4;
  color: var(--bv-accent);
  /* The column is min-width: 0, so long labels (en) must wrap instead of spilling onto the rings */
  overflow-wrap: anywhere;
}

.ex-conv__ring {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 0;
  text-align: center;
}

.ex-ring {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 96px;
  height: 96px;
  background: conic-gradient(var(--c1) 0, var(--c2) calc(var(--p) * 1%), var(--bv-track) calc(var(--p) * 1%) 100%);
  filter: drop-shadow(0 0 6px var(--bv-glow));
  border-radius: 50%;
  animation: ex-ring-in 0.9s cubic-bezier(0.22, 1, 0.36, 1) var(--d) both;
}

/* Hollow centre */
.ex-ring::before {
  position: absolute;
  inset: 10px;
  content: '';
  background: color-mix(in srgb, var(--bv-bg1) 70%, var(--bv-primary));
  border-radius: 50%;
}

/* Dashed outer scale, slowly rotating; the second ring turns the other way */
.ex-ring::after {
  position: absolute;
  inset: -7px;
  pointer-events: none;
  content: '';
  border: 1px dashed color-mix(in srgb, var(--bv-accent) 45%, transparent);
  border-radius: 50%;
  animation: ex-ring-spin 17s linear infinite;
}

.ex-ring.is-reverse::after {
  animation-direction: reverse;
}

.ex-ring span {
  position: relative;
  font-size: 19px;
  font-weight: 700;
}

/* Pointer: 0deg = 12 o'clock like the conic start; rotates to the arc end */
.ex-ring__pointer {
  position: absolute;
  inset: 0;
  z-index: 1;
  pointer-events: none;
  transform: rotate(0deg);
  transition: transform 1.6s cubic-bezier(0.22, 1, 0.36, 1) var(--d);
}

.ex-ring.is-on .ex-ring__pointer {
  transform: rotate(calc(var(--p) * 3.6deg));
}

/* Glowing dot on the ring centre-line (ring is 10px wide); breathes in opacity */
.ex-ring__pointer::before {
  position: absolute;
  top: 1px;
  left: 50%;
  width: 8px;
  height: 8px;
  margin-left: -4px;
  content: '';
  background: #e6fbff;
  border-radius: 50%;
  box-shadow:
    0 0 6px 2px var(--c1),
    0 0 12px 4px var(--bv-glow);
  animation: ex-ring-dot 2.3s ease-in-out infinite;
}

.ex-ring.is-reverse .ex-ring__pointer::before {
  animation-delay: -1.1s;
}

.ex-ring__name {
  margin-top: 14px;
  font-size: 15px;
  font-weight: 600;
  white-space: nowrap;
}

.ex-ring__formula {
  margin-top: 4px;
  font-size: 12px;
  color: var(--bv-text-muted);
  white-space: nowrap;
}

@keyframes ex-ring-in {
  from {
    opacity: 0;
    transform: rotate(-90deg) scale(0.7);
  }

  to {
    opacity: 1;
    transform: none;
  }
}

@keyframes ex-ring-spin {
  to {
    transform: rotate(360deg);
  }
}

@keyframes ex-ring-dot {
  0%,
  100% {
    opacity: 0.55;
  }

  50% {
    opacity: 1;
  }
}

@media (prefers-reduced-motion: reduce) {
  .ex-ring,
  .ex-ring::after,
  .ex-ring__pointer::before {
    animation: none;
  }

  .ex-ring__pointer {
    transition: none;
  }
}
</style>
