// Small math helpers shared by systems, prefabs and tests (no three.js dependency).

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v)
export const lerp = (a, b, t) => a + (b - a) * t
export const smoothstep = (a, b, v) => {
  const t = clamp((v - a) / (b - a || 1e-6), 0, 1)
  return t * t * (3 - 2 * t)
}
export const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
export const easeOut = (t) => 1 - Math.pow(1 - t, 3)

/** Shortest signed angle from a to b (radians) */
export function angleDelta(a, b) {
  let d = (b - a) % (Math.PI * 2)
  if (d > Math.PI) d -= Math.PI * 2
  if (d < -Math.PI) d += Math.PI * 2
  return d
}

/** Move angle a toward b by at most step */
export function approachAngle(a, b, step) {
  const d = angleDelta(a, b)
  return Math.abs(d) <= step ? b : a + Math.sign(d) * step
}

/** Move value toward target by at most step */
export function approach(v, target, step) {
  return Math.abs(target - v) <= step ? target : v + Math.sign(target - v) * step
}

/** Exponential damping factor independent of frame rate */
export const damp = (lambda, dt) => 1 - Math.exp(-lambda * dt)

/**
 * Piecewise-linear lookup over keyframes [[x, y], ...] sorted by x.
 * Used for every timeline curve (floors per day, workers per day, light per hour).
 */
export function keyframes(keys, x) {
  if (!keys.length) return 0
  if (x <= keys[0][0]) return keys[0][1]
  for (let i = 1; i < keys.length; i++) {
    const [x1, y1] = keys[i]
    if (x <= x1) {
      const [x0, y0] = keys[i - 1]
      return lerp(y0, y1, (x - x0) / (x1 - x0 || 1e-6))
    }
  }
  return keys[keys.length - 1][1]
}

/** Length of a polyline of {x, z} points */
export function polylineLength(pts) {
  let len = 0
  for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z)
  return len
}
