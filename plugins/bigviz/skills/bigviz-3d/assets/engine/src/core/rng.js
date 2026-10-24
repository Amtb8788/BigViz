// Deterministic random numbers. Every scene is generated from a seed so the same URL
// always produces the same diorama (important for screenshots, QA and video retakes).

/** mulberry32: tiny, fast, good enough for layout jitter */
export function createRng(seed = 1) {
  let s = seed >>> 0
  const next = () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  return {
    next,
    range: (a, b) => a + (b - a) * next(),
    int: (a, b) => Math.floor(a + (b - a + 1) * next()),
    pick: (arr) => arr[Math.floor(next() * arr.length)],
    chance: (p) => next() < p,
    /** symmetric jitter in [-a, a] */
    jitter: (a) => (next() * 2 - 1) * a,
    fork: (salt) => createRng((seed * 9301 + salt * 49297) >>> 0)
  }
}

/** String -> 32-bit seed */
export function hashSeed(str) {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}
