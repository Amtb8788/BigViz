<template>
  <!-- Back layer: rotating rays + breathing glow, sits under the base image (z-index -1) -->
  <div v-if="layer === 'back'" class="bv-crown bv-crown--back" :style="vars" aria-hidden="true">
    <i class="bv-crown__rays" />
    <i class="bv-crown__glow" />
  </div>
  <!-- Front layer: metal sheen masked to the art, star glint, base ripples, rising embers -->
  <div v-else class="bv-crown bv-crown--front" :style="vars" aria-hidden="true">
    <i class="bv-crown__shine" />
    <i class="bv-crown__glint" />
    <i class="bv-crown__ripple" />
    <i class="bv-crown__ripple bv-crown__ripple--late" />
    <i
      v-for="(e, i) in EMBERS"
      :key="i"
      class="bv-crown__ember"
      :style="{ '--x': e.x, '--s': `${e.size}px`, '--dur': `${e.dur}s`, '--delay': `${e.delay}s`, '--dx': `${e.dx}px` }"
    />
  </div>
</template>

<script setup lang="ts">
// Trophy effect for the podium winner, in two layers. Both must be direct children of the podium
// board: the back layer relies on the board's `isolation: isolate` to slide under the base image.
//
// LESSON: never animate `opacity` on the front layer as a whole. An animated opacity < 1 makes the
// element its own isolated group, and the children's `mix-blend-mode: screen` then blends with
// nothing instead of with the trophy pixels underneath. Animate the children instead.
import { computed } from 'vue'
import { ENTRANCE } from './motion'
import type { CrownGeometry } from './types'

const props = defineProps<{
  layer: 'back' | 'front'
  /** Entrance moment (s), aligned with the winner's label */
  delay: number
  /** Base image URL, used as a mask so the sheen only lights trophy pixels */
  mask: string
  geometry: CrownGeometry
}>()

/** Glow burst duration (s). Loops start after the entrance and the burst, never fighting it. */
const BURST = 1.2

const pct = (n: number) => `${(n * 100).toFixed(2)}%`

const vars = computed(() => {
  const g = props.geometry
  return {
    '--crown-in': `${props.delay}s`,
    '--crown-loop': `${Math.max(ENTRANCE.done, props.delay + BURST)}s`,
    '--crown-mask': `url("${props.mask}")`,
    '--cx': pct(g.cx),
    '--cy': pct(g.cy),
    '--star-y': pct(g.starY),
    '--ring-y': pct(g.ringY),
    '--cup-l': pct(g.cup.l),
    '--cup-t': pct(g.cup.t),
    '--cup-r': pct(1 - g.cup.r),
    '--cup-b': pct(1 - g.cup.b),
    '--cup-w': pct(g.cup.r - g.cup.l),
    '--cup-h': pct(g.cup.b)
  }
})

// Fixed ember parameters (x = % across the cup width) so nothing jumps between renders
const EMBERS = [
  { x: 18, size: 2, dur: 3.6, delay: 0.2, dx: -6 },
  { x: 27, size: 3, dur: 4.2, delay: 1.9, dx: 4 },
  { x: 35, size: 2, dur: 3.1, delay: 0.9, dx: -3 },
  { x: 44, size: 2, dur: 3.8, delay: 2.7, dx: 5 },
  { x: 52, size: 3, dur: 3.3, delay: 0.5, dx: -4 },
  { x: 60, size: 2, dur: 4.0, delay: 1.4, dx: 6 },
  { x: 68, size: 2, dur: 3.4, delay: 3.1, dx: -5 },
  { x: 76, size: 3, dur: 3.9, delay: 0.1, dx: 3 },
  { x: 84, size: 2, dur: 3.2, delay: 2.2, dx: -2 },
  { x: 40, size: 1.5, dur: 2.8, delay: 3.6, dx: 2 },
  { x: 63, size: 1.5, dur: 3.0, delay: 1.1, dx: -3 }
]
</script>

<style scoped src="./PodiumCrown.css"></style>
