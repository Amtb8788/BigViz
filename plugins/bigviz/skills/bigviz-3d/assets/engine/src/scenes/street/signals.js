// Street pack - signal plan. Replaces the engine's 2-group + walk cycle with a 150 s plan:
//   1 中山路 non-motorised lead (bikes 4 s)   2 中山路 through + right (+ bus priority extension)
//   3 中山路 protected left                   4 解放路 non-motorised lead
//   5 解放路 through + right                  6 解放路 protected left
//   7 pedestrian scramble (all crossings, two-stage via the islands) + flashing clearance
// Every change goes through yellow + 3 s all-red. Same interface as systems/traffic.js
// SignalController (aspect / aspects / phase / remaining / state / setPhase / setMode ...)
// so stop lines, pedestrian zones, lamps, twin bindings and the HUD keep working.
// Groups: ew / ns (ball heads), ewL / nsL (left arrows), ewB / nsB (bike heads), ped.

import * as THREE from 'three'
import { makeCanvas } from '../../render/textures.js'

const R = { ew: 'red', ewL: 'red', ewB: 'red', ns: 'red', nsL: 'red', nsB: 'red', ped: 'dont' }
const st = (id, name, t, on = {}) => ({ id, name, t, a: { ...R, ...on } })
export const STAGES = [
  st('EW_BIKE', '中山路 非机动车先行', 4, { ewB: 'green' }),
  st('EW_GREEN', '中山路 直行 + 右转', 33, { ew: 'green', ewB: 'green' }),
  st('EW_YELLOW', '中山路 黄灯', 3, { ew: 'yellow', ewB: 'yellow' }),
  st('ALL_RED_1', '全红清空', 3),
  st('EW_LEFT', '中山路 左转', 15, { ewL: 'green' }),
  st('EW_LEFT_Y', '中山路 左转黄灯', 3, { ewL: 'yellow' }),
  st('ALL_RED_2', '全红清空', 3),
  st('NS_BIKE', '解放路 非机动车先行', 4, { nsB: 'green' }),
  st('NS_GREEN', '解放路 直行 + 右转', 24, { ns: 'green', nsB: 'green' }),
  st('NS_YELLOW', '解放路 黄灯', 3, { ns: 'yellow', nsB: 'yellow' }),
  st('ALL_RED_3', '全红清空', 3),
  st('NS_LEFT', '解放路 左转', 13, { nsL: 'green' }),
  st('NS_LEFT_Y', '解放路 左转黄灯', 3, { nsL: 'yellow' }),
  st('ALL_RED_4', '全红清空', 3),
  st('WALK', '行人全向通行', 20, { ped: 'walk' }),
  st('PED_CLEAR', '行人清空', 9, { ped: 'flash' }),
  st('ALL_RED_5', '全红清空', 3)
]
const IDX = Object.fromEntries(STAGES.map((s, i) => [s.id, i]))
const SAFE = new Set(STAGES.filter((s) => /YELLOW|_Y$|ALL_RED|PED_CLEAR/.test(s.id)).map((s) => s.id))
// engine phase names (HUD / twin manual control) -> stage
const ALIAS = { NS_GREEN: 'NS_GREEN', EW_GREEN: 'EW_GREEN', WALK: 'WALK', ALL_RED: 'ALL_RED_5' }
const BUS_EXT = 10

export class SixPhaseController {
  /** @param {object} base the engine controller being replaced (id, node, name, position) */
  constructor(base, { offset = 0 } = {}) {
    this.id = base.id
    this.node = base.node
    this.name = base.name
    this.position = { ...base.position }
    this.timing = { ...base.timing }
    this.mode = 'auto'
    this.i = 0
    this.t = 0
    this.ext = 0
    this.extUsed = false
    this.busPriority = 0
    this.target = null
    this.hold = false
    this.onChange = null
    this.elapsed = 0
    this.queue = 0
    this.busNear = null // () => bool, set by the pack (bus within 70 m of a 中山路 stop line)
    if (offset) this.update(offset, true)
  }

  get stage() { return STAGES[this.i] }
  get phase() { return this.stage.id }
  durOf(i) { return STAGES[i].t + (i === IDX.EW_GREEN ? this.ext : 0) }
  get remaining() { return Math.max(0, this.durOf(this.i) - this.t) }
  get cycle() { return STAGES.reduce((s, x) => s + x.t, 0) }

  _go(i, silent) {
    const from = this.phase
    this.i = i
    this.t = 0
    if (i === 0) { this.ext = 0; this.extUsed = false }
    if (!silent && this.onChange && from !== this.phase) this.onChange(this, from)
  }

  _advance(silent) {
    let n = (this.i + 1) % STAGES.length
    // manual transition: run the clearance stages, then jump to the requested one
    if (this.target != null && !SAFE.has(STAGES[n].id) && STAGES[n].id !== this.target) n = IDX[this.target]
    this._go(n, silent)
    if (this.target != null && this.phase === this.target) { this.mode = this.wantHold ? 'manual' : 'auto'; this.hold = this.wantHold; this.target = null }
  }

  update(dt, silent = false) {
    if (!(dt > 0)) return this
    this.elapsed += dt
    if (this.mode === 'flash' || this.mode === 'off') return this
    this.t += dt
    // bus priority: extend 中山路 green once per cycle when a bus is about to arrive
    if (this.i === IDX.EW_GREEN && !this.extUsed && this.mode === 'auto' && this.remaining < 4 && this.busNear?.()) {
      this.ext = BUS_EXT
      this.extUsed = true
      this.busPriority++
      this.onBus?.(this)
    }
    for (let g = 0; g < 64; g++) {
      const d = this.durOf(this.i)
      if (this.t < d) break
      if (this.hold) { this.t = d; break }
      const over = this.t - d
      this._advance(silent)
      this.t = over
    }
    return this
  }

  setPhase(id, { hold = true, immediate = false } = {}) {
    const want = STAGES[IDX[id]] ? id : ALIAS[id]
    if (!want) throw new Error(`Unknown signal phase "${id}"`)
    if (this.mode === 'flash' || this.mode === 'off') this.mode = 'auto'
    this.hold = false
    if (immediate || this.phase === want) { this._go(IDX[want]); this.mode = hold ? 'manual' : 'auto'; this.hold = hold; return this }
    this.mode = 'manual'
    this.target = want
    this.wantHold = hold
    if (!SAFE.has(this.phase)) { this._advance(); this.t = 0 }
    return this
  }

  release() { this.target = null; this.hold = false; this.mode = 'auto'; return this }

  setMode(mode) {
    if (mode === 'auto' || mode === 'manual') return this.release()
    if (mode !== 'flash' && mode !== 'off') throw new Error(`Unknown signal mode "${mode}"`)
    const from = this.phase
    this.mode = mode
    this.target = null
    this.hold = false
    this.onChange?.(this, from)
    return this
  }

  setTiming(patch = {}) {
    for (const [k, v] of Object.entries(patch)) {
      const s = STAGES.find((x) => x.id === k)
      if (!s || !(v >= 0)) throw new Error(`Bad timing ${k}=${v}`)
      s.t = v
    }
    return this
  }

  aspects() {
    if (this.mode === 'flash') return { ...Object.fromEntries(Object.keys(R).map((k) => [k, 'flash'])), ped: 'off' }
    if (this.mode === 'off') return Object.fromEntries(Object.keys(R).map((k) => [k, 'off']))
    return this.stage.a
  }

  aspect(group) { return this.aspects()[group] ?? 'red' }

  get color() {
    if (this.mode === 'flash' || this.mode === 'off') return this.mode
    const a = this.aspects()
    const v = Object.entries(a).filter(([k]) => k !== 'ped').map(([, x]) => x)
    return v.includes('green') ? 'green' : v.includes('yellow') ? 'yellow' : 'red'
  }

  /** seconds until `group` turns green (0 while green) */
  untilGreen(group) {
    if (this.aspect(group) === 'green') return 0
    let s = this.remaining
    for (let k = 1; k < STAGES.length; k++) {
      const j = (this.i + k) % STAGES.length
      if (STAGES[j].a[group] === 'green') return s
      s += this.durOf(j)
    }
    return s
  }

  /** seconds of green left for `group` (through its green stages; 0 when not green) */
  greenLeft(group) {
    if (this.aspect(group) !== 'green') return 0
    let s = this.remaining
    for (let k = 1; k < STAGES.length; k++) {
      const j = (this.i + k) % STAGES.length
      if (STAGES[j].a[group] !== 'green') break
      s += this.durOf(j)
    }
    return s
  }

  /** pedestrian window: 'walk' | 'flash' | 'dont' and seconds until crossings must be clear */
  pedWindow() {
    const a = this.aspect('ped')
    if (a === 'walk') return { state: 'walk', left: this.remaining + STAGES[IDX.PED_CLEAR].t }
    if (a === 'flash') return { state: 'flash', left: this.remaining }
    return { state: a, left: 0 }
  }

  state() {
    return {
      id: this.id, node: this.node, name: this.name, position: { ...this.position },
      color: this.color, queue: this.queue, mode: this.mode, phase: this.phase, stage: this.stage.name,
      remaining: this.remaining, cycle: this.cycle, busPriority: this.busPriority, hold: this.hold, target: this.target,
      aspects: { ...this.aspects() }, timing: Object.fromEntries(STAGES.map((s) => [s.id, s.t]))
    }
  }
}

// ---------------------------------------------------------------- lamps
const COL = { red: '#ff2d1a', yellow: '#ffb21a', green: '#22ff7a' }
const OFF = { red: '#3a0d0a', yellow: '#3a2a08', green: '#0a2a14' }

/** glyph lens: emissive map = white glyph on black (arrow / bicycle) */
function glyph(kind) {
  const c = makeCanvas(64, 64)
  const g = c.getContext('2d')
  g.fillStyle = '#000'
  g.fillRect(0, 0, 64, 64)
  g.fillStyle = '#fff'
  g.strokeStyle = '#fff'
  g.lineCap = 'round'
  g.lineJoin = 'round'
  if (kind === 'left') {
    g.beginPath(); g.moveTo(10, 32); g.lineTo(30, 14); g.lineTo(30, 25); g.lineTo(54, 25); g.lineTo(54, 39); g.lineTo(30, 39); g.lineTo(30, 50); g.closePath(); g.fill()
  } else {
    g.lineWidth = 4
    for (const x of [17, 47]) { g.beginPath(); g.arc(x, 42, 10, 0, Math.PI * 2); g.stroke() }
    g.beginPath(); g.moveTo(17, 42); g.lineTo(28, 24); g.lineTo(44, 24); g.lineTo(47, 42); g.moveTo(28, 24); g.lineTo(33, 42); g.lineTo(44, 24); g.moveTo(25, 19); g.lineTo(32, 19); g.stroke()
  }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

function lens(color, map) {
  const m = new THREE.MeshStandardMaterial({ color: '#0c0c0c', emissive: COL[color], emissiveMap: map, emissiveIntensity: 0.06, roughness: 0.3 })
  m.userData.color = color
  return m
}

/** 3-aspect glyph head (left arrow or bicycle) facing local +z */
function glyphHead(kind, small = false) {
  const map = glyph(kind)
  const mats = { red: lens('red', map), yellow: lens('yellow', map), green: lens('green', map) }
  const s = small ? 0.62 : 1
  const g = new THREE.Group()
  const housing = new THREE.MeshStandardMaterial({ color: '#202326', roughness: 0.6, metalness: 0.4 })
  const back = new THREE.MeshStandardMaterial({ color: '#15171a', roughness: 0.7 })
  g.add(new THREE.Mesh(new THREE.BoxGeometry(0.36 * s, 1.05 * s, 0.3 * s), housing))
  const bp = new THREE.Mesh(new THREE.BoxGeometry(0.56 * s, 1.25 * s, 0.04), back)
  bp.position.z = -0.17 * s
  g.add(bp)
  ;[['red', 0.33], ['yellow', 0], ['green', -0.33]].forEach(([k, y]) => {
    const l = new THREE.Mesh(new THREE.CircleGeometry(0.12 * s, 20), mats[k])
    l.position.set(0, y * s, 0.152 * s)
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.3 * s, 0.03 * s, 0.18 * s), housing)
    visor.position.set(0, (y + 0.15) * s, 0.24 * s)
    g.add(l, visor)
  })
  g.traverse((o) => { if (o.isMesh) o.castShadow = false })
  return { object: g, mats }
}

// countdown display: 2 digits, colour of the current state, one texture per approach group
function countdown() {
  const c = makeCanvas(128, 96)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  const m = new THREE.MeshStandardMaterial({ color: '#050505', emissive: '#ffffff', emissiveMap: t, emissiveIntensity: 1.6, roughness: 0.4 })
  const g = new THREE.Group()
  g.add(new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.48, 0.12), new THREE.MeshStandardMaterial({ color: '#1a1c1f', roughness: 0.6, metalness: 0.3 })))
  const face = new THREE.Mesh(new THREE.PlaneGeometry(0.54, 0.4), m)
  face.position.z = 0.062
  g.add(face)
  return { object: g, draw: (n, col) => {
    const x = c.getContext('2d')
    x.fillStyle = '#000'
    x.fillRect(0, 0, 128, 96)
    x.fillStyle = COL[col] || '#ff2d1a'
    x.font = 'bold 78px monospace'
    x.textAlign = 'center'
    x.textBaseline = 'middle'
    x.fillText(String(Math.min(99, Math.max(0, n))).padStart(2, '0'), 64, 52)
    t.needsUpdate = true
  } }
}

/**
 * Extra furniture on the engine's signal poles (computed from junction geometry): left-arrow
 * head beside the inner-lane ball head, countdown on the mast arm, bike heads on posts at the
 * bike stop lines. Returns { object, sync(ctl, t) }.
 */
export function dressSignals(j, { bikeStops }) {
  const root = new THREE.Group()
  root.name = 'street.signals'
  const groups = { ewL: [], nsL: [], ewB: [], nsB: [] }
  const counters = { ew: countdown(), ns: countdown() }
  const counterMeshes = { ew: [], ns: [] }
  const place = (o, p, yaw, lx, y, lz = 0) => {
    o.position.set(p.x + Math.cos(yaw) * lx + Math.sin(yaw) * lz, y, p.z - Math.sin(yaw) * lx + Math.cos(yaw) * lz)
    o.rotation.y = yaw
    root.add(o)
  }
  for (const p of j.poles) {
    const inner = p.arm[0]
    const s = Math.sign(inner) || -1
    const h = glyphHead('left')
    place(h.object, p, p.yaw, inner - s * 0.62, 5.6 - 0.78, 0.1)
    groups[p.group + 'L'].push(h.mats)
    // countdown hangs on the arm between the kerb-lane head and the pole
    const last = p.arm[p.arm.length - 1]
    const cd = counters[p.group].object.clone()
    place(cd, p, p.yaw, last * 0.5, 5.6 - 0.42, 0.12)
    counterMeshes[p.group].push(cd)
  }
  for (const b of bikeStops) {
    const post = new THREE.Group()
    const steel = new THREE.MeshStandardMaterial({ color: '#8c939a', roughness: 0.4, metalness: 0.85 })
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.075, 3.2, 10).translate(0, 1.6, 0), steel)
    pole.castShadow = true
    post.add(pole)
    const h = glyphHead('bike', true)
    h.object.position.set(0, 2.7, 0.14)
    post.add(h.object)
    place(post, b, b.yaw, 0, 0)
    groups[b.group].push(h.mats)
  }
  let lastN = { ew: -1, ns: -1 }
  let lastC = { ew: '', ns: '' }
  return {
    object: root,
    sync(ctl, t) {
      const blink = Math.floor(t * 2) % 2 === 0
      for (const [g, list] of Object.entries(groups)) {
        const a = ctl.aspect(g)
        for (const mats of list) {
          for (const [k, m] of Object.entries(mats)) {
            const on = a === k || (a === 'flash' && k === 'yellow' && blink)
            m.emissiveIntensity = on ? 3.4 : 0.06
            m.color.set(on ? '#2a2a2a' : OFF[k])
          }
        }
      }
      for (const g of ['ew', 'ns']) {
        const a = ctl.aspect(g)
        const n = Math.ceil(a === 'green' ? ctl.greenLeft(g) : a === 'yellow' ? ctl.remaining : ctl.untilGreen(g))
        const c = a === 'green' ? 'green' : a === 'yellow' ? 'yellow' : 'red'
        if (n !== lastN[g] || c !== lastC[g]) { counters[g].draw(n, c); lastN[g] = n; lastC[g] = c }
        const vis = ctl.mode !== 'off' && ctl.mode !== 'flash'
        for (const m of counterMeshes[g]) m.visible = vis
      }
    }
  }
}

/** HUD / info label of the current stage */
export function stageLabel(c) {
  if (c.mode === 'flash') return '黄闪'
  if (c.mode === 'off') return '关闭'
  const ext = c.phase === 'EW_GREEN' && c.ext ? ' · 公交优先 +10s' : ''
  return `${c.stage.name} ${Math.ceil(c.remaining)}s${ext}${c.mode === 'manual' ? ' · 手动' : ''}`
}
