<template>
  <div ref="viewportRef" class="bv-viewport">
    <div class="bv-stage" :style="stageStyle">
      <slot :zoom="zoom" :stage-width="stage.w" :stage-height="stage.h" :pixel-ratio="pixelRatio" />
    </div>
  </div>
</template>

<script setup lang="ts">
// Full-viewport stage: lays out at a 1920×1080 design size, stretches one side to follow the
// container aspect (clamped 4/3 – 32/9), then scales with CSS `zoom` and centres with flex.
import { computed, onBeforeUnmount, onMounted, provide, ref } from 'vue'
import { SCREEN_CONTEXT, chartPixelRatio } from './context'

const props = withDefaults(
  defineProps<{
    /** Design width in px */
    baseWidth?: number
    /** Design height in px */
    baseHeight?: number
    /** Narrowest aspect the stage will stretch to; beyond it the stage letterboxes */
    minAspect?: number
    /** Widest aspect the stage will stretch to */
    maxAspect?: number
  }>(),
  { baseWidth: 1920, baseHeight: 1080, minAspect: 4 / 3, maxAspect: 32 / 9 }
)

// ─── Container size (observed, so it also works inside a host layout) ─────────
const viewportRef = ref<HTMLElement>()
const box = ref({ w: props.baseWidth, h: props.baseHeight })
const dpr = ref(typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1)

let observer: ResizeObserver | null = null
let dprQuery: MediaQueryList | null = null

/** DPR changes when the window moves between monitors or the browser zoom changes */
const watchDpr = () => {
  dprQuery?.removeEventListener('change', watchDpr)
  dpr.value = window.devicePixelRatio || 1
  dprQuery = window.matchMedia(`(resolution: ${dpr.value}dppx)`)
  dprQuery.addEventListener('change', watchDpr)
}

onMounted(() => {
  const el = viewportRef.value
  if (!el) return
  observer = new ResizeObserver(([entry]) => {
    if (!entry) return
    const { width, height } = entry.contentRect
    if (width > 0 && height > 0) box.value = { w: width, h: height }
  })
  observer.observe(el)
  watchDpr()
})

onBeforeUnmount(() => {
  observer?.disconnect()
  dprQuery?.removeEventListener('change', watchDpr)
})

// ─── Stage geometry ───────────────────────────────────────────────────────────
// Wider than 16:9 → the stage gets wider (centre column grows); squarer → it gets taller.
const stage = computed(() => {
  const { w, h } = box.value
  const base = props.baseWidth / props.baseHeight
  const ratio = Math.min(Math.max(w / h, props.minAspect), props.maxAspect)
  const sw = ratio >= base ? Math.round(props.baseHeight * ratio) : props.baseWidth
  const sh = ratio >= base ? props.baseHeight : Math.round(props.baseWidth / ratio)
  return { w: sw, h: sh, zoom: Math.min(w / sw, h / sh) }
})

const zoom = computed(() => stage.value.zoom)
const pixelRatio = computed(() => chartPixelRatio(zoom.value, dpr.value))

// `zoom` instead of `transform: scale`: zoom takes part in layout, so text, 1px borders and corner
// marks are re-rasterised at the final size. A transform stretches a bitmap and blurs at
// non-integer scales.
const stageStyle = computed(() => ({
  width: `${stage.value.w}px`,
  height: `${stage.value.h}px`,
  zoom: stage.value.zoom
}))

provide(SCREEN_CONTEXT, {
  zoom,
  pixelRatio,
  stageWidth: computed(() => stage.value.w),
  stageHeight: computed(() => stage.value.h)
})

defineExpose({ zoom, pixelRatio })
</script>

<style scoped>
/* Fills its container. For a standalone page the container is the viewport; when embedding,
   give the parent a definite size (see README "Embedding"). */
.bv-viewport {
  position: relative;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: var(--bv-bg0);
}

/* Centred by the flex parent (no translate(-50%), which lands on half pixels after zoom) */
.bv-stage {
  position: relative;
  flex: none;
  box-sizing: border-box;
  overflow: hidden;
  color: var(--bv-text);
  font-family: var(--bv-font-ui);
}
</style>
