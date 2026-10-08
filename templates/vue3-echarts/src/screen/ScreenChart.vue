<template>
  <div ref="elRef" class="bv-chart" :style="{ height }" role="img" :aria-label="label" />
</template>

<script setup lang="ts">
// ECharts container: takes a full option, resizes with its box, and re-creates the chart when the
// stage pixel ratio changes (devicePixelRatio is an init-only setting in ECharts).
import { markRaw, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { init, type ECharts, type EChartsOption } from './echarts'
import { useScreen } from './context'
import { useReducedMotion } from './motion'

const props = withDefaults(
  defineProps<{
    option: EChartsOption
    /** Accessible description of what the chart shows */
    label: string
    height?: string
    /** Override the pixel ratio; defaults to the BigScreen value (zoom × DPR) */
    pixelRatio?: number
  }>(),
  { height: '100%', pixelRatio: undefined }
)

const emit = defineEmits<{
  /** Fired after the chart instance is (re)created; carousels should reset their state */
  ready: [chart: ECharts]
}>()

const { pixelRatio: stageRatio } = useScreen()
const reduced = useReducedMotion()
const elRef = ref<HTMLDivElement>()
const chart = shallowRef<ECharts | null>(null)
let observer: ResizeObserver | null = null

/** Reduced motion: no transitions; effect loops (ripples) are disabled by the option builder */
const withMotion = (option: EChartsOption): EChartsOption =>
  reduced.value ? { ...option, animation: false } : option

const create = () => {
  const el = elRef.value
  if (!el) return
  chart.value?.dispose()
  const instance = markRaw(
    init(el, undefined, { devicePixelRatio: props.pixelRatio ?? stageRatio.value, renderer: 'canvas' })
  )
  instance.setOption(withMotion(props.option))
  chart.value = instance
  emit('ready', instance)
}

onMounted(() => {
  create()
  // ResizeObserver reports layout (pre-zoom) pixels, which is what ECharts lays out in
  observer = new ResizeObserver(() => chart.value?.resize())
  if (elRef.value) observer.observe(elRef.value)
})

// Data refresh: merge so ECharts animates from old values to new ones
watch(
  () => props.option,
  (option) => chart.value?.setOption(withMotion(option)),
  { deep: false }
)

watch([() => props.pixelRatio ?? stageRatio.value, reduced], create)

onBeforeUnmount(() => {
  observer?.disconnect()
  chart.value?.dispose()
  chart.value = null
})

/** Live instance for carousels (showTip / highlight). May be null before mount. */
const getChart = () => chart.value

defineExpose({ getChart })
</script>

<style scoped>
.bv-chart {
  width: 100%;
  min-height: 0;
}
</style>
