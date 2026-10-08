<template>
  <section class="bv-panel" :class="`bv-panel--from-${from}`" :style="vars" :aria-labelledby="titleId">
    <!-- Corner marks (top-left / bottom-right are the root pseudo-elements) and the border spark -->
    <i class="bv-panel__corner bv-panel__corner--tr" aria-hidden="true" />
    <i class="bv-panel__corner bv-panel__corner--bl" aria-hidden="true" />
    <i class="bv-panel__spark" aria-hidden="true" />
    <header class="bv-panel__head">
      <span class="bv-panel__head-bg" aria-hidden="true" />
      <h2 :id="titleId" class="bv-panel__title">{{ title }}</h2>
      <div v-if="$slots.extra" class="bv-panel__extra">
        <slot name="extra" />
      </div>
    </header>
    <div class="bv-panel__body">
      <slot />
    </div>
  </section>
</template>

<script setup lang="ts">
// Panel frame: glowing border, corner marks, title bar that unrolls on entrance. Content via slot.
import { computed, useId } from 'vue'
import { ENTRANCE } from './motion'

const props = withDefaults(
  defineProps<{
    title: string
    /** Entrance start (s). Also staggers the ambient loops so panels never sweep in sync. */
    delay?: number
    /** Entrance direction of the whole panel */
    from?: 'left' | 'right' | 'up' | 'none'
  }>(),
  { delay: ENTRANCE.panels, from: 'up' }
)

const titleId = useId()
const vars = computed(() => ({ '--delay': `${props.delay}s`, '--done': `${ENTRANCE.done}s` }))
</script>

<style scoped>
.bv-panel {
  --from: translate3d(0, 24px, 0);

  position: relative;
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  background: linear-gradient(180deg, var(--bv-panel-top), var(--bv-panel-bottom));
  border: 1px solid var(--bv-line);
  border-radius: var(--bv-radius);
  box-shadow:
    inset 0 0 24px color-mix(in srgb, var(--bv-primary) 22%, transparent),
    0 0 12px color-mix(in srgb, var(--bv-primary) 25%, transparent);
  animation: bv-panel-in 0.8s cubic-bezier(0.22, 1, 0.36, 1) var(--delay) both;
}

.bv-panel--from-left {
  --from: translate3d(-60px, 0, 0);
}

.bv-panel--from-right {
  --from: translate3d(60px, 0, 0);
}

.bv-panel--from-none {
  animation: none;
}

/* Corner marks breathe in opacity only */
.bv-panel::before,
.bv-panel::after,
.bv-panel__corner {
  position: absolute;
  z-index: 2;
  width: 14px;
  height: 14px;
  pointer-events: none;
  content: '';
  border: 2px solid var(--bv-accent);
  animation: bv-panel-corner 3.1s ease-in-out calc(var(--done) + var(--delay)) infinite;
}

.bv-panel::before {
  top: -1px;
  left: -1px;
  border-right: none;
  border-bottom: none;
}

.bv-panel::after {
  right: -1px;
  bottom: -1px;
  border-top: none;
  border-left: none;
}

.bv-panel__corner--tr {
  top: -1px;
  right: -1px;
  border-bottom: none;
  border-left: none;
}

.bv-panel__corner--bl {
  bottom: -1px;
  left: -1px;
  border-top: none;
  border-right: none;
}

/* Spark track clipped to the panel width; the bright segment translates inside it */
.bv-panel__spark {
  position: absolute;
  top: -2px;
  right: 14px;
  left: 14px;
  z-index: 2;
  height: 3px;
  overflow: hidden;
  pointer-events: none;
}

.bv-panel__spark::after {
  position: absolute;
  inset: 0;
  content: '';
  background: linear-gradient(
    90deg,
    transparent calc(100% - 80px),
    color-mix(in srgb, var(--bv-accent) 90%, transparent) calc(100% - 6px),
    transparent 100%
  );
  opacity: 0;
  transform: translateX(-100%);
  animation: bv-panel-spark 8.9s linear calc(var(--done) + var(--delay) * 2.3) infinite;
}

.bv-panel__head {
  position: relative;
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: space-between;
  height: 40px;
  padding: 0 16px 0 20px;
}

/* Title bar background unrolls from the left (scaleX), then a soft sweep passes periodically */
.bv-panel__head-bg {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
  background: linear-gradient(90deg, color-mix(in srgb, var(--bv-primary) 45%, transparent), transparent 70%);
  border-bottom: 1px solid var(--bv-line-soft);
  transform-origin: left center;
  animation: bv-panel-unroll 0.7s cubic-bezier(0.22, 1, 0.36, 1) calc(var(--delay) + 0.15s) both;
}

.bv-panel__head-bg::after {
  position: absolute;
  inset: 0;
  width: 24%;
  content: '';
  background: linear-gradient(100deg, transparent, color-mix(in srgb, var(--bv-accent) 28%, transparent), transparent);
  transform: translateX(-100%);
  animation: bv-panel-sweep 6.7s ease-in-out calc(var(--done) + var(--delay) * 3.1) infinite;
}

.bv-panel__title {
  position: relative;
  margin: 0;
  font-size: 19px;
  font-weight: 700;
  color: var(--bv-text);
  letter-spacing: 1px;
  text-shadow: 0 0 8px var(--bv-glow);
  animation: bv-panel-fade 0.6s ease-out calc(var(--delay) + 0.35s) both;
}

.bv-panel__extra {
  position: relative;
  display: flex;
  gap: 16px;
  align-items: center;
  font-size: 14px;
  color: var(--bv-text-dim);
  animation: bv-panel-fade 0.6s ease-out calc(var(--delay) + 0.45s) both;
}

.bv-panel__body {
  position: relative;
  flex: 1;
  min-height: 0;
  padding: 12px 16px;
}

@keyframes bv-panel-in {
  from {
    opacity: 0;
    transform: var(--from);
  }

  to {
    opacity: 1;
    transform: none;
  }
}

@keyframes bv-panel-unroll {
  from {
    transform: scaleX(0);
  }

  to {
    transform: scaleX(1);
  }
}

@keyframes bv-panel-fade {
  from {
    opacity: 0;
  }

  to {
    opacity: 1;
  }
}

/* First 25 % sweeps across, then waits off to the right */
@keyframes bv-panel-sweep {
  0% {
    transform: translateX(-100%);
  }

  25%,
  100% {
    transform: translateX(420%);
  }
}

@keyframes bv-panel-corner {
  0%,
  100% {
    opacity: 1;
  }

  50% {
    opacity: 0.45;
  }
}

@keyframes bv-panel-spark {
  0% {
    opacity: 0;
    transform: translateX(-100%);
  }

  6%,
  34% {
    opacity: 1;
  }

  40%,
  100% {
    opacity: 0;
    transform: translateX(0);
  }
}

/* Reduced motion: no entrance, no loops; the static frame is the final look */
@media (prefers-reduced-motion: reduce) {
  .bv-panel,
  .bv-panel::before,
  .bv-panel::after,
  .bv-panel__corner,
  .bv-panel__head-bg,
  .bv-panel__head-bg::after,
  .bv-panel__title,
  .bv-panel__extra,
  .bv-panel__spark::after {
    animation: none;
  }
}
</style>
