/** Stage context shared by BigScreen with its descendants (charts need zoom for crisp canvases). */
import { computed, inject, type ComputedRef, type InjectionKey } from 'vue'

export interface ScreenContext {
  /** Current CSS zoom of the stage */
  zoom: ComputedRef<number>
  /** Stage size in design pixels (one side is always the base size) */
  stageWidth: ComputedRef<number>
  stageHeight: ComputedRef<number>
  /** Canvas pixel ratio for ECharts: zoom × DPR, rounded up to 0.5, clamped to [1, 4] */
  pixelRatio: ComputedRef<number>
}

export const SCREEN_CONTEXT: InjectionKey<ScreenContext> = Symbol('bigviz-screen')

/**
 * Canvas pixel ratio for a zoomed stage. Canvases are laid out in design pixels and then zoomed,
 * so they must be rasterised at zoom × DPR to stay sharp on 4K. Rounding to 0.5 avoids rebuilding
 * charts on every pixel of window drag; the cap of 4 bounds canvas memory.
 */
export function chartPixelRatio(zoom: number, dpr: number): number {
  const raw = zoom * (dpr || 1)
  return Math.min(Math.max(Math.ceil(raw * 2) / 2, 1), 4)
}

/** Read the stage context; falls back to zoom 1 when used outside BigScreen. */
export function useScreen(): ScreenContext {
  const ctx = inject(SCREEN_CONTEXT, null)
  if (ctx) return ctx
  const one = computed(() => 1)
  const dpr = computed(() => chartPixelRatio(1, typeof window === 'undefined' ? 1 : window.devicePixelRatio))
  return { zoom: one, stageWidth: computed(() => 1920), stageHeight: computed(() => 1080), pixelRatio: dpr }
}
