// Visual style presets. 'diorama' = miniature on a desk (tilt-shift, plinth, toon-ish palette).
// 'realistic' = real-scale city: Preetham sky, PMREM from the sky, ground to the horizon,
// exp fog, GTAO on high, muted real-world palette. Style is a load-time choice (reload to switch).
// Pure module (no DOM) so the sun maths is testable in node.

export const STYLES = {
  diorama: { id: 'diorama', desk: true, tilt: true, sky: false, ao: false, near: 0.5, far: 2000, fov: 32, exposure: 1.05 },
  realistic: { id: 'realistic', desk: false, tilt: false, sky: true, ao: true, near: 0.3, far: 12000, fov: 40, exposure: 0.62 }
}

/** url param > engine option > scene.style > 'diorama' */
export function resolveStyle({ url, opt, scene } = {}) {
  for (const s of [url, opt, scene]) if (s && STYLES[s]) return s
  return 'diorama'
}

const SUNRISE = 5.6
const SUNSET = 19.4
// rotate the whole sun path a little so the noon sun is not straight behind the default camera
const BEARING = -0.55

/**
 * Sun angles for an hour of day. el: radians above horizon (negative at night),
 * az: 0 = east, PI/2 = south (+z), PI = west.
 */
export function sunAngles(hour) {
  const h = ((hour % 24) + 24) % 24
  const day = SUNSET - SUNRISE
  const t = (h - SUNRISE) / day
  let el
  if (t >= 0 && t <= 1) el = Math.sin(t * Math.PI) * 1.05
  else {
    // below the horizon at night: mirror arc to about -0.5 rad at midnight
    const n = t > 1 ? (h - SUNSET) / (24 - day) : (h + 24 - SUNSET) / (24 - day)
    el = -Math.sin(n * Math.PI) * 0.5
  }
  const az = Math.min(1, Math.max(0, t)) * Math.PI + BEARING
  return { el, az }
}

/** Unit vector toward the sun ({x,y,z}); +x east, +z south */
export function sunDirection(hour, out = { x: 0, y: 0, z: 0 }) {
  const { el, az } = sunAngles(hour)
  const c = Math.cos(el)
  out.x = Math.cos(az) * c
  out.y = Math.sin(el)
  out.z = Math.sin(az) * c
  return out
}
