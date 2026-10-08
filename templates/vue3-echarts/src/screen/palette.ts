/**
 * Read the theme tokens from CSS so canvas charts (which cannot use CSS variables) share the
 * same palette as the DOM. theme.css stays the single source of truth.
 */

/** Preset palette keys (ARCHITECTURE.md §5) */
export type PaletteKey = 'bg0' | 'bg1' | 'primary' | 'accent' | 'warn' | 'ok' | 'violet' | 'text'
export type Palette = Record<PaletteKey, string>

/** deep-tech-blue fallbacks, used before styles load or outside a browser */
const FALLBACK: Palette = {
  bg0: '#020B1F',
  bg1: '#06173A',
  primary: '#1E7BFF',
  accent: '#3FD0FF',
  warn: '#FFB547',
  ok: '#2EE6B6',
  violet: '#8A7BFF',
  text: '#FFFFFF'
}

const KEYS = Object.keys(FALLBACK) as PaletteKey[]

/** Current palette from `--bv-*` custom properties on :root */
export function readPalette(el: Element | null = typeof document === 'undefined' ? null : document.documentElement): Palette {
  if (!el) return { ...FALLBACK }
  const style = getComputedStyle(el)
  const out = { ...FALLBACK }
  for (const key of KEYS) {
    const v = style.getPropertyValue(`--bv-${key}`).trim()
    if (v) out[key] = v
  }
  return out
}

/** `#RRGGBB` (or `#RGB`) + alpha → `rgba()`; other formats are returned unchanged */
export function alpha(color: string, a: number): string {
  let hex = color.trim().replace(/^#/, '')
  if (hex.length === 3) hex = [...hex].map((c) => c + c).join('')
  if (!/^[0-9a-f]{6}$/i.test(hex)) return color
  const n = Number.parseInt(hex, 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`
}
