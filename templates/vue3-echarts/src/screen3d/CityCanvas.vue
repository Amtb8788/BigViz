<template>
  <ThreeStage
    ref="stageRef"
    class="bv3-city"
    :class="{ 'is-hover': hoverId !== null, 'is-dragging': dragging }"
    :setup="setup"
    :label="label"
    @ready="emit('ready')"
    @fallback="(r) => emit('fallback', r)"
  >
    <!-- DOM labels; positions are written straight to `style.transform` every frame -->
    <div ref="layerRef" class="bv3-city__labels">
      <!-- Zero-size anchor at the projected point; the button inside is offset and scaled -->
      <div
        v-for="alert in alerts"
        :key="alert.id"
        :ref="(el) => setLabelRef(alert.id, el)"
        class="bv3-anchor"
        :class="[`bv3-label--${alert.level}`, { 'is-focus': alert.id === focusId }]"
      >
        <button type="button" class="bv3-label" @click="select(alert.id)">
          <i class="bv3-label__dot" aria-hidden="true" />
          <span class="bv3-label__text">{{ alert.label }}</span>
          <b v-if="alert.value !== undefined" class="bv3-label__value">
            {{ formatValue(alert.value) }}<small v-if="alert.unit">{{ alert.unit }}</small>
          </b>
        </button>
      </div>
    </div>
  </ThreeStage>
</template>

<script setup lang="ts">
// The three.js half of CityHero (loaded lazily): mounts the procedural city in a ThreeStage,
// keeps beacons in sync with `alerts` / `focusId`, positions the DOM labels after every frame and
// turns clicks on the canvas into `select`. Picking works in design px, so it is exact under the
// stage's CSS zoom.
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import ThreeStage from './ThreeStage.vue'
import { createCityScene, type CityScene, type ProjectedLabel } from './scenes/city'
import type { CityAlert, LabelInsets, StageContext } from './types'

const props = withDefaults(
  defineProps<{
    alerts: CityAlert[]
    focusId?: string | null
    seed?: number
    autoTour?: boolean
    label?: string
    locale?: string
    labelInsets?: LabelInsets
  }>(),
  { focusId: null, seed: 7, autoTour: true, label: '', locale: 'en-US', labelInsets: undefined }
)

const emit = defineEmits<{
  select: [id: string]
  ready: []
  fallback: [reason: string]
}>()

const stageRef = ref<InstanceType<typeof ThreeStage>>()
const hoverId = ref<string | null>(null)
let city: CityScene | null = null

// ─── Labels ───────────────────────────────────────────────────────────────────
const layerRef = ref<HTMLElement>()
const labelEls = new Map<string, HTMLElement>()
const projected = new Map<string, ProjectedLabel>()
const setLabelRef = (id: string, el: unknown) => {
  if (el instanceof HTMLElement) labelEls.set(id, el)
  else labelEls.delete(id)
}

/** Gap between the label's bottom edge and the anchor (matches `.bv3-label { bottom }`) */
const LEADER = 10
/** Focused labels are drawn at this scale (matches `.is-focus > .bv3-label`) */
const FOCUS_SCALE = 1.12
/** Label box sizes in layout px (transform-independent); dropped when texts can change */
const sizes = new Map<string, { w: number; h: number }>()
const labelSize = (id: string, el: HTMLElement) => {
  let s = sizes.get(id)
  if (!s) {
    const btn = el.firstElementChild as HTMLElement | null
    s = { w: btn?.offsetWidth ?? 0, h: btn?.offsetHeight ?? 0 }
    if (s.w) sizes.set(id, s)
  }
  return s
}
watch([() => props.alerts, () => props.locale], () => sizes.clear(), { flush: 'post' })
if (typeof document !== 'undefined') void document.fonts?.ready.then(() => sizes.clear())

/** Toggle a class / tab stop only when it changes (this runs every frame) */
const setOut = (el: HTMLElement, out: boolean) => {
  if (el.classList.contains('is-out') === out) return
  el.classList.toggle('is-out', out)
  const btn = el.firstElementChild as HTMLElement | null
  if (btn) btn.tabIndex = out ? -1 : 0
}

const numberFormat = ref(new Intl.NumberFormat(props.locale, { maximumFractionDigits: 1 }))
watch(
  () => props.locale,
  (l) => (numberFormat.value = new Intl.NumberFormat(l, { maximumFractionDigits: 1 }))
)
const formatValue = (v: number) => numberFormat.value.format(v)

/** Called after every rendered frame: no reactive writes, only style on existing elements */
const placeLabels = () => {
  if (!city) return
  city.projectLabels(projected)
  const layer = layerRef.value
  const ins = props.labelInsets
  // Safe rect in design px (the label layer is laid out at design size)
  const r = layer && ins ? { l: ins.left, t: ins.top, r: layer.clientWidth - ins.right, b: layer.clientHeight - ins.bottom } : null
  // Read all sizes before writing any style (no layout thrash)
  if (r) for (const [id, el] of labelEls) labelSize(id, el)
  for (const [id, el] of labelEls) {
    const p = projected.get(id)
    if (!p || !p.visible) {
      el.style.visibility = 'hidden'
      continue
    }
    const focus = id === props.focusId
    let x = p.x
    let y = p.y
    let out = false
    let clamped = false
    if (r) {
      const s = labelSize(id, el)
      const k = focus ? FOCUS_SCALE : 1
      const hw = (s.w * k) / 2
      const top = y - LEADER - s.h * k
      if (focus) {
        // Always shown: shift the anchor so the whole box fits (the leader line is hidden then)
        const nx = Math.min(Math.max(x, r.l + hw), r.r - hw)
        const ny = Math.min(Math.max(y, r.t + LEADER + s.h * k), r.b)
        clamped = Math.abs(nx - x) > 0.5 || Math.abs(ny - y) > 0.5
        x = nx
        y = ny
      } else {
        out = x - hw < r.l || x + hw > r.r || top < r.t || y > r.b
      }
    }
    setOut(el, out)
    el.classList.toggle('is-clamped', clamped)
    el.style.visibility = 'visible'
    el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`
    el.style.zIndex = String(focus ? 1000 : Math.round((1 - p.depth) * 900))
    el.style.opacity = out ? '0' : focus ? '1' : String(Math.max(0.55, 1 - p.depth * 0.6))
  }
}

// ─── Scene ────────────────────────────────────────────────────────────────────
const setup = (ctx: StageContext) => {
  const scene = createCityScene(ctx, { seed: props.seed, autoTour: props.autoTour })
  scene.setAlerts(props.alerts)
  scene.setFocus(props.focusId ?? null)
  city = scene
  return {
    ...scene,
    render() {
      scene.render()
      placeLabels()
    },
    dispose() {
      if (city === scene) city = null
      scene.dispose()
    }
  }
}

watch(
  () => props.alerts,
  (alerts) => city?.setAlerts(alerts)
)
watch(
  () => props.focusId,
  (id) => city?.setFocus(id ?? null)
)
watch(
  () => props.autoTour,
  (on) => city?.setAutoTour(on)
)
watch(
  () => props.seed,
  () => stageRef.value?.rebuild()
)

// ─── Pointer ──────────────────────────────────────────────────────────────────
// clientX/Y and getBoundingClientRect are both in zoomed CSS px; their ratio times the canvas
// design size (clientWidth/Height) gives the point in design px, whatever the stage zoom is.
const toDesign = (e: PointerEvent | MouseEvent) => {
  const canvas = stageRef.value?.getCanvas()
  if (!canvas) return null
  const rect = canvas.getBoundingClientRect()
  if (!rect.width || !rect.height) return null
  return {
    x: ((e.clientX - rect.left) / rect.width) * canvas.clientWidth,
    y: ((e.clientY - rect.top) / rect.height) * canvas.clientHeight
  }
}

/** CSS px → design px ratio of the canvas (the stage may be CSS-zoomed) */
const designScale = () => {
  const canvas = stageRef.value?.getCanvas()
  const w = canvas?.getBoundingClientRect().width
  return canvas && w ? canvas.clientWidth / w : 1
}

// Drag: left = orbit, right / middle / shift+left = pan. Wheel = zoom. A press that moves less
// than DRAG_SLOP px stays a click (beacon picking).
const DRAG_SLOP = 4
let drag: { id: number; x: number; y: number; mode: 'rotate' | 'pan'; moved: boolean } | null = null
let swallowClick = false
const dragging = ref(false)

const onDown = (e: PointerEvent) => {
  if (drag || !city) return
  const mode = e.button === 0 && !e.shiftKey ? 'rotate' : e.button <= 2 ? 'pan' : null
  if (!mode) return
  drag = { id: e.pointerId, x: e.clientX, y: e.clientY, mode, moved: false }
  swallowClick = false
}

const onMove = (e: PointerEvent) => {
  if (drag && e.pointerId === drag.id) {
    const dx = e.clientX - drag.x
    const dy = e.clientY - drag.y
    if (!drag.moved) {
      if (Math.hypot(dx, dy) < DRAG_SLOP) return
      drag.moved = true
      dragging.value = true
      hoverId.value = null
      stageRef.value?.getCanvas()?.setPointerCapture(e.pointerId)
    }
    drag.x = e.clientX
    drag.y = e.clientY
    const k = designScale()
    if (drag.mode === 'rotate') city?.rotate(dx * k, dy * k)
    else city?.pan(dx * k, dy * k)
    return
  }
  const p = toDesign(e)
  hoverId.value = p && city ? city.pick(p.x, p.y) : null
}

const onUp = (e: PointerEvent) => {
  if (!drag || e.pointerId !== drag.id) return
  // The click that follows a drag must not pick a beacon
  swallowClick = drag.moved
  drag = null
  dragging.value = false
}

const onWheel = (e: WheelEvent) => {
  if (!city) return
  e.preventDefault()
  // Normalise line / page deltas to px; ~10 % per notch
  const px = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaMode === 2 ? e.deltaY * 400 : e.deltaY
  city.zoom(Math.exp(Math.max(-200, Math.min(200, px)) * 0.001))
}

const onContextMenu = (e: MouseEvent) => e.preventDefault()

const onClick = (e: MouseEvent) => {
  if (swallowClick) {
    swallowClick = false
    return
  }
  const p = toDesign(e)
  const id = p && city ? city.pick(p.x, p.y) : null
  if (id) select(id)
}
const onLeave = () => (hoverId.value = null)

function select(id: string) {
  flyTo(id)
  emit('select', id)
}

/** Fly the camera to an alert, hold ~8 s, then resume the tour */
function flyTo(id: string) {
  return city?.flyTo(id) ?? false
}

onMounted(() => {
  const canvas = stageRef.value?.getCanvas()
  canvas?.addEventListener('pointerdown', onDown)
  canvas?.addEventListener('pointermove', onMove)
  canvas?.addEventListener('pointerup', onUp)
  canvas?.addEventListener('pointercancel', onUp)
  canvas?.addEventListener('pointerleave', onLeave)
  canvas?.addEventListener('wheel', onWheel, { passive: false })
  canvas?.addEventListener('contextmenu', onContextMenu)
  canvas?.addEventListener('click', onClick)
})

onBeforeUnmount(() => {
  const canvas = stageRef.value?.getCanvas()
  canvas?.removeEventListener('pointerdown', onDown)
  canvas?.removeEventListener('pointermove', onMove)
  canvas?.removeEventListener('pointerup', onUp)
  canvas?.removeEventListener('pointercancel', onUp)
  canvas?.removeEventListener('pointerleave', onLeave)
  canvas?.removeEventListener('wheel', onWheel)
  canvas?.removeEventListener('contextmenu', onContextMenu)
  canvas?.removeEventListener('click', onClick)
  labelEls.clear()
})

defineExpose({ flyTo })
</script>

<style scoped>
.bv3-city :deep(canvas) {
  cursor: grab;
  /* Touch drags orbit the city instead of scrolling the page */
  touch-action: none;
}

.bv3-city.is-hover :deep(canvas) {
  cursor: pointer;
}

.bv3-city.is-dragging :deep(canvas) {
  cursor: grabbing;
}

.bv3-city__labels {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
}

.bv3-anchor {
  position: absolute;
  top: 0;
  left: 0;
  width: 0;
  height: 0;
  visibility: hidden;
  transition: opacity 0.35s ease;
  will-change: transform;

  --lvl: var(--bv-ok);
}

/* Bottom-centre sits on the anchor (the beacon top) */
.bv3-label {
  position: absolute;
  bottom: 10px;
  left: 0;
  display: flex;
  gap: 8px;
  align-items: center;
  padding: 5px 12px 5px 10px;
  margin: 0;
  font: inherit;
  font-size: 15px;
  line-height: 1.2;
  color: var(--bv-text);
  white-space: nowrap;
  cursor: pointer;
  pointer-events: auto;
  background: color-mix(in srgb, var(--bv-bg0) 72%, transparent);
  border: 1px solid color-mix(in srgb, var(--lvl) 70%, transparent);
  border-radius: 3px;
  box-shadow: 0 0 12px color-mix(in srgb, var(--lvl) 35%, transparent);
  transform: translateX(-50%);
  transform-origin: 50% 100%;
  transition:
    transform 0.3s ease,
    background-color 0.3s ease;
}

/* Leader line down to the beacon */
.bv3-label::after {
  position: absolute;
  top: 100%;
  left: 50%;
  width: 1px;
  height: 10px;
  content: '';
  background: var(--lvl);
}

/* Outside the safe rect: faded out and not clickable (the pillar stays) */
.is-out > .bv3-label {
  pointer-events: none;
}

/* Clamped into the safe rect: the leader no longer points at the beacon */
.is-clamped > .bv3-label::after {
  display: none;
}

.bv3-label--warn {
  --lvl: var(--bv-warn);
}

.bv3-label--critical {
  --lvl: var(--bv-danger, #ff4d5e);
}

.is-focus > .bv3-label {
  background: color-mix(in srgb, var(--lvl) 30%, var(--bv-bg0));
  transform: translateX(-50%) scale(1.12);
}

.bv3-label:focus-visible {
  outline: 2px solid var(--bv-accent);
  outline-offset: 2px;
}

.bv3-label__dot {
  flex: none;
  width: 8px;
  height: 8px;
  background: var(--lvl);
  border-radius: 50%;
  box-shadow: 0 0 8px var(--lvl);
}

.bv3-label__value {
  font-family: var(--bv-font-number);
  font-size: 16px;
  color: var(--lvl);
}

.bv3-label__value small {
  margin-left: 2px;
  font-size: 12px;
  font-weight: 400;
}

@media (prefers-reduced-motion: reduce) {
  .bv3-anchor,
  .bv3-label {
    transition: none;
  }
}
</style>
