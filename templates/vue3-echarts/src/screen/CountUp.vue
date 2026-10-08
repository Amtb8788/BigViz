<template>
  <span class="bv-count">{{ text }}</span>
</template>

<script setup lang="ts">
// Rolling number: 0 → value on first render, old → new on data refresh. Thousands separators.
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { tweenNumber, useReducedMotion } from './motion'

const props = withDefaults(
  defineProps<{
    value: number
    decimals?: number
    /** Seconds */
    duration?: number
    /** Delay (s) of the first roll, to line up with the entrance timeline */
    delay?: number
    separator?: boolean
    /** BCP 47 locale for number formatting */
    locale?: string
  }>(),
  { decimals: 0, duration: 1.6, delay: 0, separator: true, locale: 'en-US' }
)

const reduced = useReducedMotion()
const current = ref(0)
let cancel: (() => void) | null = null

const text = computed(() => {
  const n = Number(current.value.toFixed(props.decimals))
  if (!props.separator) return n.toFixed(props.decimals)
  return n.toLocaleString(props.locale, {
    minimumFractionDigits: props.decimals,
    maximumFractionDigits: props.decimals
  })
})

// The first change uses the entrance delay; later changes (refresh) start immediately
let first = true
watch(
  () => props.value,
  (raw) => {
    const to = Number.isFinite(raw) ? raw : 0
    cancel?.()
    if (reduced.value) current.value = to
    else {
      cancel = tweenNumber(current.value, to, (v) => (current.value = v), {
        duration: props.duration,
        delay: first ? props.delay : 0
      })
    }
    first = false
  },
  { immediate: true }
)

onBeforeUnmount(() => cancel?.())
</script>

<style scoped>
.bv-count {
  font-variant-numeric: tabular-nums;
}
</style>
