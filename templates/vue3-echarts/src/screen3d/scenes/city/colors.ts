/**
 * City colours, all derived from the theme tokens (readPalette + `--bv-danger`), plus the uniform
 * objects shared by every city material so one write per frame updates them all.
 */
import { Color, Vector2 } from 'three'
import { readPalette, type Palette } from '@/screen/palette'
import type { AlertLevel } from '../../types'

/** Used when `--bv-danger` is not defined by the theme */
const DANGER_FALLBACK = '#FF4D5E'

export interface CityColors {
  palette: Palette
  /** Fog / sky at the horizon: bg0 lifted slightly towards primary */
  fog: Color
  /** Ground base */
  ground: Color
  /** Building base (dark) and glow tones */
  base: Color
  primary: Color
  accent: Color
  violet: Color
  /** Warm lit-window tint, from warn */
  warm: Color
  level: Record<AlertLevel, Color>
}

/** Read the palette once at scene build time */
export function cityColors(root: Element | null = typeof document === 'undefined' ? null : document.documentElement): CityColors {
  const p = readPalette(root)
  const danger = (root && getComputedStyle(root).getPropertyValue('--bv-danger').trim()) || DANGER_FALLBACK
  const c = (s: string) => new Color(s)
  return {
    palette: p,
    fog: c(p.bg0).lerp(c(p.primary), 0.08),
    ground: c(p.bg0).lerp(c(p.bg1), 0.5),
    base: c(p.bg0).lerp(c(p.primary), 0.12),
    primary: c(p.primary),
    accent: c(p.accent),
    violet: c(p.violet),
    warm: c(p.warn).lerp(c(p.text), 0.35),
    level: { info: c(p.ok), warn: c(p.warn), critical: c(danger) }
  }
}

/** Uniforms shared (by reference) between the building, ground and traffic shaders */
export function sharedUniforms(colors: CityColors) {
  return {
    uTime: { value: 0 },
    /** Entrance progress 0 → 1 (buildings rise, roads light up) */
    uGrow: { value: 0 },
    /** Scan ring: centre (x, z), radius, strength 0–1 */
    uScanCenter: { value: new Vector2() },
    uScanRadius: { value: 0 },
    uScanStrength: { value: 0 },
    uFogColor: { value: colors.fog.clone() },
    uFogDensity: { value: 0.00042 }
  }
}

export type SharedUniforms = ReturnType<typeof sharedUniforms>

/** GLSL for the shared uniforms; prepend to fragment shaders that use them */
export const SHARED_GLSL = /* glsl */ `
uniform float uTime;
uniform float uGrow;
uniform vec2 uScanCenter;
uniform float uScanRadius;
uniform float uScanStrength;
uniform vec3 uFogColor;
uniform float uFogDensity;

float fogFactor(float dist) {
  float f = uFogDensity * dist;
  return 1.0 - exp(-f * f);
}

/** Bright front of the expanding scan ring at horizontal distance d, plus a fading wake */
float scanBand(vec2 xz) {
  float d = distance(xz, uScanCenter);
  // x * x, not pow(x, 2.0): pow of a negative base is undefined in GLSL
  float k = (d - uScanRadius) / 26.0;
  float front = exp(-k * k);
  float wake = smoothstep(uScanRadius, uScanRadius - 260.0, d) * step(d, uScanRadius) * 0.35;
  return (front + wake) * uScanStrength;
}

/** exp(-x²) without pow(): pow of a negative base is undefined in GLSL */
float gauss(float x) {
  return exp(-x * x);
}

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
`
