/**
 * Deterministic random numbers for procedural scenes: the same seed always builds the same city,
 * so screenshots and GIFs are reproducible.
 */

/** Returns floats in [0, 1) */
export type Random = () => number

/** mulberry32: tiny, fast, good enough for layout jitter (not for cryptography) */
export function mulberry32(seed: number): Random {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Uniform float in [min, max) */
export const between = (rnd: Random, min: number, max: number) => min + (max - min) * rnd()

/** One element of a non-empty list */
export const pickOne = <T>(rnd: Random, list: readonly [T, ...T[]]): T => list[Math.floor(rnd() * list.length)] ?? list[0]
