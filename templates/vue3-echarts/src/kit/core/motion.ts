/**
 * Motion infrastructure for BigViz screens: the shared entrance timeline, a reduced-motion flag,
 * a visibility-aware interval and a tiny number tween. No animation library required.
 * Components animate only their own inner elements and read their start times from ENTRANCE.
 */
import { computed, getCurrentScope, onScopeDispose, ref, watch, type Ref } from 'vue'

/** Key moments of the entrance timeline, in seconds. Inner animations use these as delays. */
export const ENTRANCE = {
  /** Header and background in place */
  header: 0,
  /** Side panels start sliding in */
  panels: 0.3,
  /** Gap between consecutive panels of one column */
  panelGap: 0.12,
  /** KPI cards pop in */
  kpis: 0.5,
  /** Hero visual scales up */
  hub: 0.7,
  /** Hero nodes light up one after another, `nodeGap` apart */
  nodes: 1.2,
  nodeGap: 0.18,
  /** Panel content (charts, ranks, rings) starts animating */
  content: 1.0,
  /** Entrance finished; ambient loops may start */
  done: 2.4
} as const

/** Entrance time (s) of the n-th panel in a column */
export const panelDelay = (n: number) => ENTRANCE.panels + n * ENTRANCE.panelGap

// ─── Shared reactive sources (one listener for the whole app) ─────────────────

const hasWindow = typeof window !== 'undefined'
const reducedQuery = hasWindow ? window.matchMedia('(prefers-reduced-motion: reduce)') : null
const reducedState = ref(reducedQuery?.matches ?? false)
reducedQuery?.addEventListener('change', (e) => (reducedState.value = e.matches))

const visibleState = ref(hasWindow ? document.visibilityState === 'visible' : true)
if (hasWindow) {
  document.addEventListener('visibilitychange', () => {
    visibleState.value = document.visibilityState === 'visible'
  })
}

/** True when the OS asks for reduced motion. Loops stop; numbers jump straight to the value. */
export function useReducedMotion(): Readonly<Ref<boolean>> {
  return computed(() => reducedState.value)
}

/** True while the document is visible (tab in front, window not minimised). */
export function useDocumentVisible(): Readonly<Ref<boolean>> {
  return computed(() => visibleState.value)
}

/** setTimeout that is cleared automatically when the current effect scope is disposed. */
function scopedTimeout(fn: () => void, ms: number) {
  const id = setTimeout(fn, ms)
  if (getCurrentScope()) onScopeDispose(() => clearTimeout(id))
}

export interface VisibleIntervalOptions {
  /** Delay (ms) before the first run, e.g. to wait for the entrance */
  delay?: number
  /** Keep running under reduced motion (use for data refresh, not for visual loops). Default false. */
  ignoreReducedMotion?: boolean
}

/**
 * Interval that only runs while the page is visible (and, by default, motion is allowed).
 * Pauses when the tab is hidden, resumes when it comes back, cleans up with the component.
 */
export function useVisibleInterval(fn: () => void, interval: number, options: VisibleIntervalOptions = {}) {
  const visible = useDocumentVisible()
  const reduced = useReducedMotion()
  const ready = ref(!options.delay)
  let timer: ReturnType<typeof setInterval> | null = null

  const pause = () => {
    if (timer !== null) clearInterval(timer)
    timer = null
  }
  const resume = () => {
    if (timer === null) timer = setInterval(fn, interval)
  }
  const sync = () => {
    const motionOk = options.ignoreReducedMotion || !reduced.value
    if (ready.value && visible.value && motionOk) resume()
    else pause()
  }

  if (options.delay) scopedTimeout(() => (ready.value = true), options.delay)
  watch([visible, reduced, ready], sync, { immediate: true })
  if (getCurrentScope()) onScopeDispose(pause)

  return { pause, resume }
}

/** easeOutCubic, close to GSAP's power3.out used in the original screen */
export const easeOut = (t: number) => 1 - (1 - t) ** 3

/**
 * Tween a number with requestAnimationFrame. Returns a cancel function.
 * @param from start value
 * @param to end value
 * @param onUpdate called every frame with the current value
 * @param opts.duration seconds; opts.delay seconds before starting
 */
export function tweenNumber(
  from: number,
  to: number,
  onUpdate: (v: number) => void,
  opts: { duration?: number; delay?: number } = {}
): () => void {
  const duration = (opts.duration ?? 1.6) * 1000
  const delay = (opts.delay ?? 0) * 1000
  let raf = 0
  let start = 0
  const frame = (now: number) => {
    if (!start) start = now + delay
    const t = Math.min(1, Math.max(0, (now - start) / duration))
    onUpdate(from + (to - from) * easeOut(t))
    if (t < 1) raf = requestAnimationFrame(frame)
  }
  raf = requestAnimationFrame(frame)
  return () => cancelAnimationFrame(raf)
}
