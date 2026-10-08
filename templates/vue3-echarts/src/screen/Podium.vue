<template>
  <div v-if="items.length" class="bv-podium">
    <!-- The fit box takes the remaining height and is a size container; the board inside is
         contain-sized from the real asset aspect, so it never distorts or crops -->
    <div class="bv-podium__fit">
      <div class="bv-podium__board" :style="{ '--aspect': image.aspect }">
        <!-- Effect layers must be direct children of the board (back layer uses z-index -1) -->
        <slot name="back" :delay="winnerDelay">
          <PodiumCrown v-if="crown" layer="back" :delay="winnerDelay" :mask="image.src" :geometry="crown" />
        </slot>
        <img
          class="bv-podium__scene"
          :src="image.src"
          :width="image.width"
          :height="image.height"
          :alt="imageAlt"
          loading="lazy"
        />
        <slot name="front" :delay="winnerDelay">
          <PodiumCrown v-if="crown" layer="front" :delay="winnerDelay" :mask="image.src" :geometry="crown" />
        </slot>
        <div
          v-for="slot in podiumSlots"
          :key="slot.item.id"
          class="bv-podium__tag"
          :class="`bv-podium__tag--${slot.rank}`"
          :style="tagStyle(slot.rank, slot.order)"
        >
          <span class="bv-sr-only">#{{ slot.rank }}</span>
          <span class="bv-podium__name" :title="slot.item.label">{{ slot.item.label }}</span>
          <span class="bv-podium__value">
            <CountUp :value="slot.item.value" :delay="ENTRANCE.content" :locale="locale" />
            <small v-if="unit">{{ unit }}</small>
          </span>
        </div>
      </div>
    </div>
    <RankList
      v-if="rest.length"
      class="bv-podium__rest"
      :items="rest"
      :unit="unit"
      :start-rank="4"
      :max-value="items[0]?.value"
      :visible="restVisible"
      :locale="locale"
    />
  </div>
  <div v-else class="bv-podium-empty">{{ emptyText }}</div>
</template>

<script setup lang="ts">
// Podium: the top three stand on a base image (pedestals and rank digits are part of the art);
// names and values are text overlaid at fractional positions, so they stay crisp and live.
// Remaining ranks continue in a RankList below.
import { computed } from 'vue'
import type { BigVizAsset, CrownGeometry, PodiumTag, RankRow } from './types'
import CountUp from './CountUp.vue'
import RankList from './RankList.vue'
import PodiumCrown from './PodiumCrown.vue'
import { ENTRANCE } from './motion'

const props = withDefaults(
  defineProps<{
    /** Sorted descending */
    items: RankRow[]
    /** Base image from the manifest (aspect drives the layout) */
    image: BigVizAsset
    imageAlt?: string
    unit?: string
    /** Label positions for ranks 1–3, fractions of the image */
    tags?: Record<1 | 2 | 3, PodiumTag>
    /** Trophy effect geometry; `false` disables the built-in effect (slots still work) */
    crown?: CrownGeometry | false
    /** Visible rows of the remainder list */
    restVisible?: number
    emptyText?: string
    locale?: string
  }>(),
  {
    imageAlt: '',
    unit: '',
    // Defaults fit the bundled example artwork (team-podium.png)
    tags: () => ({
      1: { x: 0.5, y: 0.49, anchor: 'center', width: 0.24 },
      2: { x: 0.226, y: 0.357, anchor: 'bottom', width: 0.26 },
      3: { x: 0.785, y: 0.416, anchor: 'bottom', width: 0.26 }
    }),
    crown: () => ({ cup: { l: 0.4, t: 0.02, r: 0.6, b: 0.34 }, cx: 0.5, cy: 0.15, starY: 0.114, ringY: 0.323 }),
    restVisible: 2,
    emptyText: 'No data',
    locale: 'en-US'
  }
)

// Entrance order: 3rd → 2nd → 1st
const ORDER = { 1: 2, 2: 1, 3: 0 } as const
type Rank = keyof typeof ORDER

const podiumSlots = computed(() =>
  props.items.slice(0, 3).map((item, i) => {
    const rank = (i + 1) as Rank
    return { item, rank, order: ORDER[rank] }
  })
)
const rest = computed(() => props.items.slice(3))
/** The trophy lights up together with the winner label */
const winnerDelay = ENTRANCE.content + ORDER[1] * 0.15

const pct = (n: number) => `${(n * 100).toFixed(2)}%`
const tagStyle = (rank: Rank, order: number) => {
  const tag = props.tags[rank]
  const pos = tag.anchor === 'center' ? { top: pct(tag.y), '--ty': '-50%' } : { bottom: pct(1 - tag.y), '--ty': '0%' }
  return { ...pos, left: pct(tag.x), width: pct(tag.width), '--d': `${ENTRANCE.content + order * 0.15}s` }
}
</script>

<style scoped src="./Podium.css"></style>
