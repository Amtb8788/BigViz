<template>
  <div ref="rootRef" class="bv3-stage" :data-state="state" :data-ready="ready ? 'true' : undefined">
    <canvas v-show="state !== 'fallback'" ref="canvasRef" class="bv3-stage__canvas" :aria-label="label" role="img" />
    <slot v-if="state === 'fallback'" name="fallback" />
    <slot v-else />
  </div>
</template>

<script setup lang="ts">
// WebGL host for one three.js scene: owns the canvas and renderer, sizes them in design px (the
// stage is CSS-zoomed, so layout px are design px), caps the pixel ratio, runs the render loop
// only while the page is visible, renders a single still frame under reduced motion, frees every
// GPU resource on unmount and falls back to the `#fallback` slot when WebGL is unavailable.
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { WebGLRenderer } from 'three'
import { useScreen } from '@/screen/context'
import { useDocumentVisible, useReducedMotion } from '@/screen/motion'
import { disposeObject } from './dispose'
import type { StageScene, StageSetup, StageState } from './types'

/** Never render more than this many device pixels (a 4K canvas at DPR 2 would be 33 MP) */
const MAX_PIXELS = 1920 * 1080 * 2.25
/** How long to wait for `webglcontextrestored` before giving up and showing the fallback */
const RESTORE_TIMEOUT = 3000
/** Largest frame delta fed to the scene, so a long frame never makes animations jump */
const MAX_DT = 0.1

const props = withDefaults(
  defineProps<{
    /** Scene factory, called with the renderer once WebGL is up (and again after a context restore) */
    setup: StageSetup
    /** Accessible description of the canvas */
    label?: string
    /** Pixel ratio cap (renderer pixel ratio = min(stage pixel ratio, maxPixelRatio)) */
    maxPixelRatio?: number
    /** Stop the loop without unmounting (the last frame stays on screen) */
    paused?: boolean
  }>(),
  { label: '', maxPixelRatio: 2, paused: false }
)

const emit = defineEmits<{
  /** First frame is on screen */
  ready: []
  /** WebGL is unavailable, init threw, or the context was lost for good */
  fallback: [reason: string]
}>()

const rootRef = ref<HTMLDivElement>()
const canvasRef = ref<HTMLCanvasElement>()
const state = ref<StageState>('loading')
const ready = ref(false)

const { pixelRatio: stageRatio } = useScreen()
const reduced = useReducedMotion()
const visible = useDocumentVisible()

let renderer: WebGLRenderer | null = null
let scene: StageScene | null = null
let size = { w: 0, h: 0, ratio: 1 }
let time = 0
let raf = 0
let stillRaf = 0
let lastNow = 0
let observer: ResizeObserver | null = null
let restoreTimer: ReturnType<typeof setTimeout> | undefined

// ─── Sizing ───────────────────────────────────────────────────────────────────

/** min(stage ratio, cap), lowered further when the canvas would exceed MAX_PIXELS */
const cappedRatio = (w: number, h: number) => {
  const want = Math.min(stageRatio.value, props.maxPixelRatio)
  const budget = Math.sqrt(MAX_PIXELS / Math.max(w * h, 1))
  return Math.max(0.5, Math.min(want, budget))
}

/** clientWidth/Height are layout px inside the zoomed stage, i.e. design px */
const measure = () => {
  const el = rootRef.value
  return { w: el?.clientWidth ?? 0, h: el?.clientHeight ?? 0 }
}

const applySize = () => {
  const { w, h } = measure()
  if (!renderer || !scene || w === 0 || h === 0) return
  const ratio = cappedRatio(w, h)
  if (w === size.w && h === size.h && ratio === size.ratio) return
  size = { w, h, ratio }
  renderer.setPixelRatio(ratio)
  renderer.setSize(w, h, true)
  scene.resize(w, h, ratio)
  invalidate()
}

// ─── Frames ───────────────────────────────────────────────────────────────────

const draw = (dt: number) => {
  if (!scene) return
  scene.update(time, dt)
  scene.render()
  if (!ready.value) {
    ready.value = true
    emit('ready')
  }
}

const frame = (now: number) => {
  const dt = lastNow ? Math.min((now - lastNow) / 1000, MAX_DT) : 0
  lastNow = now
  time += dt
  draw(dt)
  raf = requestAnimationFrame(frame)
}

const shouldLoop = () => state.value === 'ready' && visible.value && !reduced.value && !props.paused

const stopLoop = () => {
  cancelAnimationFrame(raf)
  raf = 0
  lastNow = 0
}

const syncLoop = () => {
  if (shouldLoop()) {
    if (!raf) raf = requestAnimationFrame(frame)
  } else {
    stopLoop()
    invalidate()
  }
}

/** One still frame on the next animation frame (coalesced); a no-op while the loop runs */
function invalidate() {
  if (raf || stillRaf || state.value !== 'ready') return
  stillRaf = requestAnimationFrame(() => {
    stillRaf = 0
    if (!raf) draw(0)
  })
}

// ─── Lifecycle ────────────────────────────────────────────────────────────────

const fail = (reason: string) => {
  teardown()
  state.value = 'fallback'
  emit('fallback', reason)
}

const init = () => {
  const canvas = canvasRef.value
  if (!canvas) return
  try {
    // Probe WebGL2 explicitly so we can fall back instead of throwing inside three.js
    const gl = canvas.getContext('webgl2', { antialias: true, alpha: false, powerPreference: 'high-performance' })
    if (!gl) return fail('webgl2-unavailable')
    renderer = new WebGLRenderer({ canvas, context: gl, antialias: true, alpha: false })
    const { w, h } = measure()
    const ratio = cappedRatio(w || 1, h || 1)
    size = { w, h, ratio }
    renderer.setPixelRatio(ratio)
    renderer.setSize(w || 1, h || 1, true)
    state.value = 'ready'
    scene = props.setup({
      renderer,
      canvas,
      width: w || 1,
      height: h || 1,
      pixelRatio: ratio,
      reducedMotion: () => reduced.value,
      invalidate
    })
    syncLoop()
    invalidate()
  } catch (e) {
    console.error('[ThreeStage] init failed', e)
    fail('init-error')
  }
}

/** Free the scene and the renderer (the canvas element stays for a possible restore) */
function teardown() {
  stopLoop()
  cancelAnimationFrame(stillRaf)
  stillRaf = 0
  if (scene) {
    try {
      scene.dispose()
      if (scene.root) disposeObject(scene.root)
    } catch (e) {
      console.warn('[ThreeStage] dispose failed', e)
    }
    scene = null
  }
  if (renderer) {
    renderer.renderLists.dispose()
    renderer.dispose()
    renderer = null
  }
}

/** Tear down and build the scene again (e.g. a new seed) */
const rebuild = () => {
  if (state.value === 'fallback') return
  teardown()
  size = { w: 0, h: 0, ratio: 1 }
  init()
}

// The browser may drop the context (GPU reset, too many contexts). preventDefault() asks for a
// restore; if none arrives we fall back to the static slot.
const onLost = (e: Event) => {
  e.preventDefault()
  stopLoop()
  restoreTimer = setTimeout(() => fail('context-lost'), RESTORE_TIMEOUT)
}
const onRestored = () => {
  clearTimeout(restoreTimer)
  teardown()
  init()
}

onMounted(() => {
  const canvas = canvasRef.value
  if (!canvas) return
  canvas.addEventListener('webglcontextlost', onLost)
  canvas.addEventListener('webglcontextrestored', onRestored)
  init()
  observer = new ResizeObserver(applySize)
  if (rootRef.value) observer.observe(rootRef.value)
})

watch([visible, reduced, () => props.paused], syncLoop)
watch(stageRatio, applySize)

onBeforeUnmount(() => {
  clearTimeout(restoreTimer)
  observer?.disconnect()
  const canvas = canvasRef.value
  canvas?.removeEventListener('webglcontextlost', onLost)
  canvas?.removeEventListener('webglcontextrestored', onRestored)
  const r = renderer
  teardown()
  // Release the context now instead of waiting for GC (browsers cap live contexts at ~16)
  try {
    r?.forceContextLoss()
  } catch {
    // context already gone
  }
})

defineExpose({
  /** Request one render while the loop is stopped */
  invalidate,
  rebuild,
  /** The canvas element (pointer picking) */
  getCanvas: () => canvasRef.value ?? null,
  state
})
</script>

<style scoped>
.bv3-stage {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.bv3-stage__canvas {
  position: absolute;
  inset: 0;
  display: block;
  width: 100%;
  height: 100%;
  outline: none;
}
</style>
