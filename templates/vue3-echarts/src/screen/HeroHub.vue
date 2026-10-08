<template>
  <div class="bv-hub" :style="rootStyle">
    <!-- Orbit: dashed track, one arrowed arc between consecutive nodes, travelling dots -->
    <svg class="bv-hub__ring" :viewBox="`0 0 ${width} ${height}`" aria-hidden="true">
      <defs>
        <marker :id="`${uid}-arrow`" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="5" markerHeight="5" orient="auto">
          <path d="M0 0 L10 5 L0 10 z" class="bv-hub__arrow" />
        </marker>
        <radialGradient :id="`${uid}-glow`">
          <stop offset="0%" stop-color="#fff" />
          <stop offset="35%" class="bv-hub__stop-mid" stop-opacity="0.9" />
          <stop offset="100%" class="bv-hub__stop-end" stop-opacity="0" />
        </radialGradient>
        <filter :id="`${uid}-blur`" x="-100%" y="-100%" width="300%" height="300%">
          <feGaussianBlur stdDeviation="1.5" />
        </filter>
      </defs>
      <ellipse class="bv-hub__track" :cx="cx" :cy="cy" :rx="rx" :ry="ry" />
      <path
        v-for="(d, i) in arcs"
        :key="i"
        class="bv-hub__arc"
        :style="{ '--d': `${nodeDelay(i) + 0.1}s` }"
        :d="d"
        :marker-end="`url(#${uid}-arrow)`"
      />
      <g v-if="orbitOn" class="bv-hub__orbit">
        <g v-for="(phase, di) in DOT_PHASES" :key="phase">
          <circle
            v-for="(part, pi) in DOT_PARTS"
            :key="pi"
            :ref="(el) => setPartRef(di, pi, el)"
            :r="part.r"
            :opacity="part.opacity"
            :style="{ fill: part.fill === 'glow' ? `url(#${uid}-glow)` : part.fill }"
            :filter="part.blur ? `url(#${uid}-blur)` : undefined"
          />
        </g>
      </g>
    </svg>

    <!-- Centre artwork: size from the manifest aspect, pedestal ripples positioned on it -->
    <div v-if="image" class="bv-hub__visual" :style="visualStyle">
      <span class="bv-hub__wave" aria-hidden="true" />
      <span class="bv-hub__wave bv-hub__wave--late" aria-hidden="true" />
      <img
        class="bv-hub__img"
        :src="image.src"
        :width="image.width"
        :height="image.height"
        :alt="imageAlt"
        loading="eager"
        fetchpriority="high"
      />
      <slot name="center" />
    </div>

    <div
      v-for="(node, i) in nodes"
      :key="node.id"
      class="bv-hub__node"
      :class="{ 'is-pulse': pulse[i] }"
      :style="nodeStyle(i)"
    >
      <span v-if="node.icon" class="bv-hub__icon" aria-hidden="true">
        <img
          class="bv-hub__icon-img"
          :src="node.icon.src"
          :width="node.icon.width"
          :height="node.icon.height"
          :style="{ aspectRatio: node.icon.aspect }"
          alt=""
        />
      </span>
      <div class="bv-hub__card">
        <div class="bv-hub__title">{{ node.title }}</div>
        <div class="bv-hub__body">
          <div class="bv-hub__label">{{ node.label }}</div>
          <div class="bv-hub__value">
            <CountUp :value="node.value" :delay="nodeDelay(i) + 0.2" :locale="locale" /><small v-if="node.unit">{{
              node.unit
            }}</small>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// Hero hub: centre artwork on an elliptical orbit with N nodes placed clockwise. Arrowed arcs link
// consecutive nodes; two dots travel the orbit and make each node pulse as they pass.
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useId, watch } from 'vue'
import type { BigVizAsset, HubNode } from './types'
import CountUp from './CountUp.vue'
import { ENTRANCE, useDocumentVisible, useReducedMotion } from './motion'

const props = withDefaults(
  defineProps<{
    /** Nodes in clockwise flow order, starting at `startAngle` */
    nodes: HubNode[]
    /** Centre artwork from the manifest */
    image?: BigVizAsset
    imageAlt?: string
    /** Box size in design px */
    width?: number
    height?: number
    /** Orbit radii */
    rx?: number
    ry?: number
    /** Angle of the first node, degrees, screen coords (0 = right, 90 = down). 225 = top-left. */
    startAngle?: number
    /** Node distance from centre as a multiple of the orbit radius */
    nodeRadius?: number
    /** Share of the gap between two nodes covered by the arc (0–1) */
    arcFill?: number
    /** Rendered artwork width (px); height follows the manifest aspect */
    imageWidth?: number
    /** Artwork top offset (px) */
    imageTop?: number
    /** Vertical centre of the pedestal ripples, as a fraction of the artwork height */
    baseY?: number
    /** Seconds per orbit lap */
    period?: number
    locale?: string
  }>(),
  {
    image: undefined,
    imageAlt: '',
    width: 880,
    height: 800,
    rx: 330,
    ry: 290,
    startAngle: 225,
    nodeRadius: 1.2,
    arcFill: 0.36,
    imageWidth: 500,
    imageTop: 150,
    baseY: 0.857,
    period: 12,
    locale: 'en-US'
  }
)

const uid = `bv-hub-${useId()}`
const cx = computed(() => props.width / 2)
const cy = computed(() => props.height / 2)
const rad = (deg: number) => (deg * Math.PI) / 180
const point = (deg: number, k = 1) => ({
  x: cx.value + props.rx * k * Math.cos(rad(deg)),
  y: cy.value + props.ry * k * Math.sin(rad(deg))
})

/** Angle of node i (clockwise because screen y points down) */
const step = computed(() => 360 / Math.max(props.nodes.length, 1))
const nodeAngle = (i: number) => props.startAngle + i * step.value

/** Arcs centred between node i and i+1, leaving room around each node */
const arcs = computed(() => {
  if (props.nodes.length < 2) return []
  const half = (step.value * props.arcFill) / 2
  return props.nodes.map((_, i) => {
    const mid = nodeAngle(i) + step.value / 2
    const a = point(mid - half)
    const b = point(mid + half)
    const large = half * 2 > 180 ? 1 : 0
    const f = (n: number) => n.toFixed(1)
    return `M${f(a.x)} ${f(a.y)} A${props.rx} ${props.ry} 0 ${large} 1 ${f(b.x)} ${f(b.y)}`
  })
})

const nodeDelay = (i: number) => ENTRANCE.nodes + i * ENTRANCE.nodeGap

const nodeStyle = (i: number) => {
  const p = point(nodeAngle(i), props.nodeRadius)
  return { left: `${p.x}px`, top: `${p.y}px`, '--d': `${nodeDelay(i)}s`, '--step': i }
}

const rootStyle = computed(() => ({
  width: `${props.width}px`,
  height: `${props.height}px`,
  '--hub-in': `${ENTRANCE.hub}s`,
  '--done': `${ENTRANCE.done}s`
}))

const visualStyle = computed(() => ({
  left: `${(props.width - props.imageWidth) / 2}px`,
  top: `${props.imageTop}px`,
  width: `${props.imageWidth}px`,
  // Height from the real asset aspect (never a hard-coded ratio)
  aspectRatio: props.image ? String(props.image.aspect) : undefined,
  '--base-y': props.baseY
}))

// ─── Travelling dots ──────────────────────────────────────────────────────────
// Positions are written straight to the SVG `transform` attribute each frame (a transform, so no
// layout), instead of through reactive state that would re-render 16 circles at 60 fps.
const DOT_PHASES = [0, 0.5]
interface DotPart {
  lag: number
  r: number
  opacity?: number
  fill: string
  blur?: boolean
}
const DOT_PARTS: DotPart[] = [
  // Six-step tail: further back = smaller and fainter
  ...Array.from({ length: 6 }, (_, i) => ({
    lag: (6 - i) * 0.006,
    r: 3 - (5 - i) * 0.35,
    opacity: 0.55 - (5 - i) * 0.08,
    fill: 'var(--bv-accent)'
  })),
  { lag: 0, r: 14, fill: 'glow' },
  { lag: 0, r: 3.5, fill: '#fff', blur: true }
]

const reduced = useReducedMotion()
const visible = useDocumentVisible()
const started = ref(false)
const orbitOn = computed(() => !reduced.value && props.nodes.length > 0)
const pulse = ref<boolean[]>([])

const dotEls: (SVGCircleElement | undefined)[][] = DOT_PHASES.map(() => [])
const setPartRef = (di: number, pi: number, el: unknown) => {
  const row = dotEls[di]
  if (row) row[pi] = (el as SVGCircleElement | null) ?? undefined
}

const pulseTimers: ReturnType<typeof setTimeout>[] = []
const firePulse = (i: number) => {
  if (pulse.value[i]) return
  pulse.value[i] = true
  clearTimeout(pulseTimers[i])
  pulseTimers[i] = setTimeout(() => (pulse.value[i] = false), 800)
}

/** Phase (0–1) of each node on the orbit; phase p ↔ angle 360·p */
const nodePhases = computed(() =>
  props.nodes.map((_, i) => ((((nodeAngle(i) % 360) + 360) % 360) / 360))
)

let t = 0
let lastPhases = DOT_PHASES.slice()
let raf = 0
let lastNow = 0

const render = () => {
  DOT_PHASES.forEach((start, di) => {
    const p = (start + t) % 1
    DOT_PARTS.forEach((part, pi) => {
      const q = (p - part.lag + 1) % 1
      const { x, y } = point(q * 360)
      dotEls[di]?.[pi]?.setAttribute('transform', `translate(${x.toFixed(2)} ${y.toFixed(2)})`)
    })
    // Fire a pulse when this frame crossed a node phase (handles the 1 → 0 wrap)
    const prev = lastPhases[di] ?? p
    nodePhases.value.forEach((np, ni) => {
      const crossed = prev <= p ? prev < np && np <= p : np > prev || np <= p
      if (crossed) firePulse(ni)
    })
    lastPhases[di] = p
  })
}

const frame = (now: number) => {
  if (lastNow) t = (t + (now - lastNow) / 1000 / props.period) % 1
  lastNow = now
  render()
  raf = requestAnimationFrame(frame)
}

const stop = () => {
  cancelAnimationFrame(raf)
  raf = 0
  lastNow = 0
}

const sync = () => {
  if (started.value && visible.value && orbitOn.value) {
    if (!raf) {
      lastPhases = DOT_PHASES.map((s) => (s + t) % 1)
      raf = requestAnimationFrame(frame)
    }
  } else stop()
}

// Place the dots once so they never flash at the SVG origin; they start moving after the entrance
onMounted(render)
const startTimer = setTimeout(() => (started.value = true), ENTRANCE.done * 1000)
watch([started, visible, orbitOn], sync, { flush: 'post' })
watch(orbitOn, (on) => on && nextTick(render))

onBeforeUnmount(() => {
  stop()
  clearTimeout(startTimer)
  pulseTimers.forEach(clearTimeout)
})
</script>

<style scoped src="./HeroHub.css"></style>
