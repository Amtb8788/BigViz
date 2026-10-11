/**
 * Alert beacons: per alert a light pillar (outer glow + bright core), an expanding ground ripple
 * and a spinning diamond on top, coloured by level. Also projects beacons to screen space for the
 * DOM labels and for pointer picking (cheaper and more forgiving than raycasting thin cylinders).
 */
import {
  AdditiveBlending,
  Color,
  CylinderGeometry,
  DoubleSide,
  Group,
  Mesh,
  OctahedronGeometry,
  PlaneGeometry,
  ShaderMaterial,
  Vector3,
  type Camera
} from 'three'
import type { AlertLevel, CityAlert } from '../../types'
import { SHARED_GLSL, type CityColors, type SharedUniforms } from './colors'
import { CITY } from './layout'

/** Pillar height per level (world units) */
const HEIGHT: Record<AlertLevel, number> = { info: 260, warn: 340, critical: 440 }
/** Picking tolerance in design px around the pillar segment */
const PICK_PX = 22

const pillarVertex = /* glsl */ `
varying vec3 vWorld;
varying vec3 vNormalW;
varying float vH;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  vNormalW = normalize(mat3(modelMatrix) * normal);
  vH = position.y + 0.5;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`

const pillarFragment = /* glsl */ `
${SHARED_GLSL}
uniform vec3 uColor;
uniform float uIntensity;
varying vec3 vWorld;
varying vec3 vNormalW;
varying float vH;
void main() {
  vec3 view = normalize(cameraPosition - vWorld);
  // Guard normalize(0) (caps / top-down view) and MSAA overshoot of vH: pow of a negative base is NaN
  vec2 nh = vNormalW.xz, vh = view.xz;
  float facing = abs(dot(nh, vh)) / max(length(nh) * length(vh), 1e-4);
  float body = pow(clamp(facing, 0.0, 1.0), 1.5);
  float fade = pow(clamp(1.0 - vH, 0.0, 1.0), 1.6);
  float bands = 0.65 + 0.35 * smoothstep(0.6, 1.0, fract(vH * 9.0 - uTime * 0.8));
  float a = body * fade * bands * uIntensity;
  float fog = 1.0 - fogFactor(distance(vWorld, cameraPosition)) * 0.7;
  gl_FragColor = vec4(uColor * a * fog, 1.0);
}
`

const rippleVertex = /* glsl */ `
varying vec2 vUv;
varying vec3 vWorld;
void main() {
  vUv = uv * 2.0 - 1.0;
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`

const rippleFragment = /* glsl */ `
${SHARED_GLSL}
uniform vec3 uColor;
uniform float uIntensity;
uniform float uPhase;
varying vec2 vUv;
varying vec3 vWorld;
void main() {
  float r = length(vUv);
  float aa = fwidth(r) * 1.5;
  float rings = 0.0;
  for (int i = 0; i < 3; i++) {
    float t = fract(uTime * 0.45 + uPhase + float(i) / 3.0);
    float rr = t * 0.95;
    rings += (1.0 - smoothstep(0.0, 0.025 + aa, abs(r - rr))) * (1.0 - t);
  }
  float disc = (1.0 - smoothstep(0.0, 0.22, r)) * 0.6;
  float ring0 = 1.0 - smoothstep(0.0, 0.02 + aa, abs(r - 0.3));
  float a = (rings + disc + ring0 * 0.5) * (1.0 - smoothstep(0.9, 1.0, r)) * uIntensity;
  float fog = 1.0 - fogFactor(distance(vWorld, cameraPosition)) * 0.7;
  gl_FragColor = vec4(uColor * a * fog, 1.0);
}
`

interface Beacon {
  alert: CityAlert
  group: Group
  /** World position of the pillar base and of the label anchor (above the diamond) */
  base: Vector3
  top: Vector3
  materials: ShaderMaterial[]
  diamond: Mesh
  rippleScale: number
}

export interface BeaconLayer {
  group: Group
  setAlerts(alerts: CityAlert[]): void
  setFocus(id: string | null): void
  /** World position of a beacon base (for camera flights) */
  baseOf(id: string): Vector3 | null
  update(time: number): void
  /**
   * Project label anchors to design px. Writes into `out` (id → x, y, depth, visible).
   * @param width canvas width in design px
   */
  project(camera: Camera, width: number, height: number, out: Map<string, ProjectedLabel>): void
  /** Nearest beacon to a point in design px, within PICK_PX of its pillar, or null */
  pick(camera: Camera, px: number, py: number, width: number, height: number): string | null
  dispose(): void
}

export interface ProjectedLabel {
  x: number
  y: number
  /** 0 (near) … 1 (far), for z-ordering and fading */
  depth: number
  visible: boolean
}

/** Map normalised alert coords (-1…1) to world x/z */
export const alertToWorld = (a: Pick<CityAlert, 'x' | 'z'>) => ({ x: a.x * CITY.radius, z: a.z * CITY.radius })

export function createBeacons(colors: CityColors, shared: SharedUniforms): BeaconLayer {
  const group = new Group()
  group.name = 'beacons'
  const pillarGeo = new CylinderGeometry(1, 1, 1, 24, 1, true)
  const rippleGeo = new PlaneGeometry(1, 1)
  rippleGeo.rotateX(-Math.PI / 2)
  const diamondGeo = new OctahedronGeometry(1, 0)
  const beacons = new Map<string, Beacon>()
  let focus: string | null = null

  const additive = (vertexShader: string, fragmentShader: string, color: Color, extra: Record<string, { value: unknown }> = {}) =>
    new ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: { ...shared, uColor: { value: color.clone() }, uIntensity: { value: 1 }, ...extra },
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      side: DoubleSide
    })

  const build = (alert: CityAlert, index: number): Beacon => {
    const color = colors.level[alert.level]
    const { x, z } = alertToWorld(alert)
    const h = HEIGHT[alert.level]
    const g = new Group()
    g.position.set(x, 0, z)

    const outerMat = additive(pillarVertex, pillarFragment, color)
    const outer = new Mesh(pillarGeo, outerMat)
    outer.scale.set(9, h, 9)
    outer.position.y = h / 2
    // The core is pushed towards white so bloom reads it as a hot beam
    const coreMat = additive(pillarVertex, pillarFragment, color.clone().lerp(new Color(1, 1, 1), 0.45))
    const core = new Mesh(pillarGeo, coreMat)
    core.scale.set(2.2, h * 0.96, 2.2)
    core.position.y = (h * 0.96) / 2

    const rippleMat = additive(rippleVertex, rippleFragment, color, { uPhase: { value: (index * 0.37) % 1 } })
    const ripple = new Mesh(rippleGeo, rippleMat)
    const rippleScale = alert.level === 'critical' ? 150 : alert.level === 'warn' ? 120 : 95
    ripple.scale.setScalar(rippleScale)
    ripple.position.y = 1.2

    const diamondMat = additive(
      pillarVertex,
      /* glsl */ `
      ${SHARED_GLSL}
      uniform vec3 uColor;
      uniform float uIntensity;
      varying vec3 vWorld;
      varying vec3 vNormalW;
      void main() {
        float rim = 1.0 - abs(dot(normalize(vNormalW), normalize(cameraPosition - vWorld)));
        gl_FragColor = vec4(uColor * (0.8 + rim * 1.6) * uIntensity, 1.0);
      }`,
      color.clone().lerp(new Color(1, 1, 1), 0.25)
    )
    const diamond = new Mesh(diamondGeo, diamondMat)
    diamond.scale.set(11, 17, 11)
    diamond.position.y = h + 26

    for (const m of [outer, core, ripple, diamond]) m.frustumCulled = false
    outer.renderOrder = core.renderOrder = diamond.renderOrder = 4
    ripple.renderOrder = 3
    g.add(ripple, outer, core, diamond)
    group.add(g)
    return {
      alert,
      group: g,
      base: new Vector3(x, 0, z),
      top: new Vector3(x, h + 60, z),
      materials: [outerMat, coreMat, rippleMat, diamondMat],
      diamond,
      rippleScale
    }
  }

  const disposeBeacon = (b: Beacon) => {
    group.remove(b.group)
    b.materials.forEach((m) => m.dispose())
  }

  const applyFocus = () => {
    for (const [id, b] of beacons) {
      const on = id === focus
      const k = focus === null ? 1 : on ? 1.6 : 0.65
      b.materials.forEach((m) => {
        const u = m.uniforms.uIntensity
        if (u) u.value = k
      })
      b.group.children[0]?.scale.setScalar(b.rippleScale * (on ? 1.5 : 1))
    }
  }

  const tmp = new Vector3()
  const tmp2 = new Vector3()

  /** World → design px; z in NDC (> 1 means behind the camera) */
  const toScreen = (v: Vector3, camera: Camera, width: number, height: number, out: Vector3) => {
    out.copy(v).project(camera)
    const z = out.z
    out.set((out.x * 0.5 + 0.5) * width, (-out.y * 0.5 + 0.5) * height, z)
    return out
  }

  return {
    group,
    setAlerts(alerts) {
      const next = new Set(alerts.map((a) => a.id))
      for (const [id, b] of beacons) {
        const a = alerts.find((x) => x.id === id)
        // Rebuild when level or position changed; otherwise keep (label text is DOM)
        if (!next.has(id) || !a || a.level !== b.alert.level || a.x !== b.alert.x || a.z !== b.alert.z) {
          disposeBeacon(b)
          beacons.delete(id)
        } else b.alert = a
      }
      alerts.forEach((a, i) => {
        if (!beacons.has(a.id)) beacons.set(a.id, build(a, i))
      })
      applyFocus()
    },
    setFocus(id) {
      focus = id
      applyFocus()
    },
    baseOf(id) {
      return beacons.get(id)?.base ?? null
    },
    update(time) {
      for (const b of beacons.values()) {
        b.diamond.rotation.y = time * 1.2
        b.diamond.position.y = b.top.y - 34 + Math.sin(time * 2 + b.base.x) * 4
      }
    },
    project(camera, width, height, out) {
      for (const [id, b] of beacons) {
        toScreen(b.top, camera, width, height, tmp)
        const visible = tmp.z < 1 && tmp.x > -100 && tmp.x < width + 100 && tmp.y > -100 && tmp.y < height + 100
        const depth = Math.min(1, Math.max(0, camera.position.distanceTo(b.top) / 4000))
        const prev = out.get(id)
        if (prev) {
          prev.x = tmp.x
          prev.y = tmp.y
          prev.depth = depth
          prev.visible = visible
        } else out.set(id, { x: tmp.x, y: tmp.y, depth, visible })
      }
      for (const id of out.keys()) if (!beacons.has(id)) out.delete(id)
    },
    pick(camera, px, py, width, height) {
      let best: string | null = null
      let bestD = PICK_PX
      for (const [id, b] of beacons) {
        const a = toScreen(b.base, camera, width, height, tmp)
        const ax = a.x
        const ay = a.y
        const az = a.z
        const t = toScreen(b.top, camera, width, height, tmp2)
        if (az > 1 || t.z > 1) continue
        // Distance from the point to the segment base → top
        const vx = t.x - ax
        const vy = t.y - ay
        const len2 = vx * vx + vy * vy || 1
        const s = Math.min(1, Math.max(0, ((px - ax) * vx + (py - ay) * vy) / len2))
        const d = Math.hypot(px - (ax + vx * s), py - (ay + vy * s))
        if (d < bestD) {
          bestD = d
          best = id
        }
      }
      return best
    },
    dispose() {
      for (const b of beacons.values()) disposeBeacon(b)
      beacons.clear()
      pillarGeo.dispose()
      rippleGeo.dispose()
      diamondGeo.dispose()
    }
  }
}
