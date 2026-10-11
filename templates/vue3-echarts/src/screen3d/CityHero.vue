<template>
  <div class="bv3-hero" :data-ready="ready || failed ? 'true' : undefined" :data-fallback="failed ? 'true' : undefined">
    <CityCanvas
      v-if="!failed"
      ref="canvasRef"
      :alerts="alerts"
      :focus-id="focusId"
      :seed="seed"
      :auto-tour="autoTour"
      :label="label"
      :locale="locale"
      :label-insets="labelInsets"
      @select="(id) => emit('select', id)"
      @ready="ready = true"
      @fallback="onFallback"
    />
    <!-- WebGL unavailable or the 3D chunk failed to load: static artwork (HeroHub-style) -->
    <div v-else class="bv3-hero__fallback">
      <slot name="fallback">
        <img
          v-if="fallback"
          class="bv3-hero__img"
          :src="fallback.src"
          :width="fallback.width"
          :height="fallback.height"
          :style="{ aspectRatio: String(fallback.aspect) }"
          :alt="fallbackAlt"
        />
      </slot>
    </div>
  </div>
</template>

<script setup lang="ts">
// Public 3D hero: a procedural night-time digital-twin city with alert beacons. This file does
// not import three.js; CityCanvas (and with it the `three` chunk) is loaded on first mount, so
// screens that never render a CityHero never download it.
import { defineAsyncComponent, onErrorCaptured, ref } from 'vue'
import type { BigVizAsset } from '@/screen/types'
import type { CityAlert, LabelInsets } from './types'

const CityCanvas = defineAsyncComponent(() => import('./CityCanvas.vue'))

withDefaults(
  defineProps<{
    /** Beacons; x / z are normalised city coords (-1 … 1) */
    alerts: CityAlert[]
    /** Highlighted alert (brighter beacon and label). Does not move the camera; use `flyTo`. */
    focusId?: string | null
    /** City layout seed; the same seed always builds the same city */
    seed?: number
    /** Slow orbit around the city (ignored under reduced motion) */
    autoTour?: boolean
    /** Static artwork shown when WebGL is unavailable */
    fallback?: BigVizAsset
    fallbackAlt?: string
    /** Accessible description of the canvas */
    label?: string
    /** Locale for label values */
    locale?: string
    /** Keep beacon labels inside the canvas minus these insets (design px); default: whole canvas */
    labelInsets?: LabelInsets
  }>(),
  {
    focusId: null,
    seed: 7,
    autoTour: true,
    fallback: undefined,
    fallbackAlt: '',
    label: '',
    locale: 'en-US',
    labelInsets: undefined
  }
)

const emit = defineEmits<{
  /** A beacon or its label was clicked (the camera is already flying there) */
  select: [id: string]
  /** The 3D view gave up; the fallback is shown */
  fallback: [reason: string]
}>()

const canvasRef = ref<{ flyTo(id: string): boolean } | null>(null)
const ready = ref(false)
const failed = ref(false)

const onFallback = (reason: string) => {
  failed.value = true
  emit('fallback', reason)
}

// The async chunk itself failed to load (offline, CSP): same fallback
onErrorCaptured((err) => {
  console.error('[CityHero]', err)
  onFallback('load-error')
  return false
})

/**
 * Fly the camera to an alert, hold ~8 s, then resume the tour. Jumps under reduced motion.
 * @returns false if the 3D view is not ready or the id is unknown
 */
const flyTo = (id: string) => canvasRef.value?.flyTo(id) ?? false

defineExpose({ flyTo })
</script>

<style scoped>
.bv3-hero {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: var(--bv-bg0);
}

.bv3-hero__fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
}

.bv3-hero__img {
  width: min(60%, 1000px);
  height: auto;
}
</style>
