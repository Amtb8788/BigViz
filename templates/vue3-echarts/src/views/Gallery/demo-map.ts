/**
 * Synthetic GeoJSON for demos and tests: a blob-shaped "city" cut into wedge districts, each of
 * which can be drilled into the same way. Deterministic per code, works offline, and carries no
 * real boundaries (so no licensing or map-approval questions). Replace with real data in
 * production; see docs/guide-spec.md "Panel types".
 */

import { mulberry32 } from '@/kit/core/random'

export interface DemoFeatureProps {
  name: string
  adcode: string
  center: [number, number]
}

export interface DemoGeoJSON {
  type: 'FeatureCollection'
  features: {
    type: 'Feature'
    properties: DemoFeatureProps
    geometry: { type: 'Polygon'; coordinates: [number, number][][] }
  }[]
}

const hash = (s: string) => [...s].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) | 0, 7)

/**
 * @param code map code; districts get `${code}-${i}`
 * @param names district names (also sets the count)
 * @param center lon/lat of the middle
 * @param radius degrees
 */
export function demoMap(code: string, names: string[], center: [number, number] = [116.4, 39.9], radius = 1): DemoGeoJSON {
  const rnd = mulberry32(hash(code) >>> 0)
  const n = names.length
  const steps = 6 // boundary points per wedge
  // irregular outline, shared by neighbouring wedges so they tile without gaps
  const phase = rnd() * Math.PI * 2
  const rim: [number, number][] = []
  for (let k = 0; k < n * steps; k++) {
    const a = (k / (n * steps)) * Math.PI * 2
    const r = radius * (0.9 + 0.1 * rnd()) * (1 + 0.1 * Math.sin(a * 3 + phase) + 0.05 * Math.sin(a * 7 + phase * 2))
    rim.push([center[0] + Math.cos(a) * r * 1.3, center[1] + Math.sin(a) * r])
  }
  // inner hub, offset a little so wedges differ in size
  const hub: [number, number] = [center[0] + (rnd() - 0.5) * radius * 0.3, center[1] + (rnd() - 0.5) * radius * 0.3]
  const features = names.map((name, i) => {
    const ring: [number, number][] = [hub]
    for (let k = i * steps; k <= (i + 1) * steps; k++) ring.push(rim[k % rim.length] as [number, number])
    ring.push(hub)
    const mid = rim[(i * steps + steps / 2) % rim.length] as [number, number]
    const c: [number, number] = [(hub[0] + mid[0] * 2) / 3, (hub[1] + mid[1] * 2) / 3]
    return {
      type: 'Feature' as const,
      properties: { name, adcode: `${code}-${i}`, center: c },
      geometry: { type: 'Polygon' as const, coordinates: [ring] }
    }
  })
  return { type: 'FeatureCollection', features }
}

/** Centre of a district of a demo map, for drilling into it */
export function demoCenter(map: DemoGeoJSON, adcode: string): [number, number] | undefined {
  return map.features.find((f) => f.properties.adcode === adcode)?.properties.center
}
