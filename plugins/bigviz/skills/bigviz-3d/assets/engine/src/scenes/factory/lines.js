// Factory pack - line controllers (driven from scene hooks, pure functions of sim dt):
//  PressLine: tandem line clock (6 s / stroke, presses phase-shifted 0.3), slide crank
//    motion, loader / 4 transfer / unloader robots in polar keyframes, panels handed press
//    to press, exit belt, die change (presses stop, bolster rolls out, crane 2 swaps the die).
//  WeldLine: weld (robots run random seam programs) -> index (clamps open, parts shuttle one
//    station, clamps close) -> weld; random robot faults stop the line until maintenance.
// Both expose status for the andon boards, devices and info cards.

import * as THREE from 'three'
import { clamp, lerp, smoothstep, easeInOut } from '../../core/math.js'
import { solveIK } from './robot.js'
import { PRESS, LINE_Z, EXIT_X, DESTACK_X } from './layout.js'

const T = 7 // tandem cycle (s) -> 8.6 SPM
const OFF = 0.3 // phase offset between neighbours
// robot k (picks from station k-1, places into press k), local u = line u - k * OFF:
//   pick at u = 0 (station k-1 at top dead centre), release in press k at u = 0.49
//   (press k at TDC there). Window entries keep neighbours apart (see PressLine notes).
const KEY_U = { pick: 0, release: 0.47 }
const tmp = new THREE.Vector3()
const fract = (x) => x - Math.floor(x)

/** polar keyframes [u, theta, r, h, held] -> pose at u (cyclic 0..1) */
function polar(keys, u) {
  u = fract(u)
  for (let i = 0; i < keys.length - 1; i++) {
    const a = keys[i]
    const b = keys[i + 1]
    if (u >= a[0] && u <= b[0]) {
      const k = easeInOut((u - a[0]) / Math.max(1e-6, b[0] - a[0]))
      return { th: lerp(a[1], b[1], k), r: lerp(a[2], b[2], k), h: lerp(a[3], b[3], k), held: a[4] }
    }
  }
  const z = keys[0]
  return { th: z[1], r: z[2], h: z[3], held: z[4] }
}

export class PressLine {
  constructor(E) {
    this.E = E
    const W = E.world
    this.presses = PRESS.map((p) => W.get(p.id))
    this.robots = ['pr-0', 'pr-1', 'pr-2', 'pr-3', 'pr-4', 'pr-5'].map((id) => W.get(id))
    this.belt = W.get('exit-belt')
    this.t = 0
    this.strokes = 18420
    this.running = true
    this.dieChange = false
    this.roll = 0
    this.status = '运行'
    // polar keyframes per robot (local frame: line along x, theta 0 = +z toward the aisle)
    // window radius: tool tip 0.45 m outside the press face, entered at die + 0.3 m
    this.keys = this.robots.map((rb, k) => {
      const x = rb.object3d.position.x
      const up = k === 0 ? DESTACK_X - 0.2 : PRESS[k - 1].x
      const dn = k === 5 ? EXIT_X - 4 : PRESS[k].x
      const halfU = k === 0 ? 0.6 : this.presses[k - 1].rig.W / 2
      const halfD = k === 5 ? 0.6 : this.presses[k].rig.W / 2
      const hUp = k === 0 ? 1.55 : this.presses[k - 1].rig.dieY + 0.02
      const hDn = k === 5 ? 1.2 : this.presses[k].rig.dieY + 0.02
      const rU = Math.abs(x - up)
      const rD = Math.abs(x - dn)
      const wU = rU - halfU - 0.45
      const wD = rD - halfD - 0.45
      const tU = up < x ? -Math.PI / 2 : Math.PI / 2
      const tD = dn < x ? -Math.PI / 2 : Math.PI / 2
      const rs = 2.8
      return [
        [0, tU, rU, hUp, true], [0.03, tU, rU, hUp + 0.3, true], [0.08, tU, wU, hUp + 0.3, true],
        [0.22, tD, rs, hDn + 0.9, true], [0.36, tD, wD, hDn + 0.3, true], [0.43, tD, rD, hDn + 0.3, true],
        [0.47, tD, rD, hDn, false], [0.5, tD, rD, hDn + 0.3, false], [0.55, tD, wD, hDn + 0.3, false],
        [0.72, tU, rs, hUp + 1.0, false], [0.92, tU, wU, hUp + 0.3, false], [0.96, tU, rU, hUp + 0.3, false], [1, tU, rU, hUp, true]
      ]
    })
  }

  /**
   * stroke 0 (TDC) .. 1 (BDC) of press i. The picker (robot i+1, downstream window) needs it
   * open over line u in (i+1)OFF + [-0.08, 0.08], the placer (robot i, upstream window) over
   * (i+1)OFF + [0.06, 0.25]; TDC sits in the middle of that span.
   */
  stroke(i, u) {
    return 0.5 - 0.5 * Math.cos(fract(u - (i + 1) * OFF - 0.085) * Math.PI * 2)
  }

  update(dt) {
    const E = this.E
    const W = E.world
    const hour = E.clock.hour
    // die change window 09:30-09:55 (P3) until crane 2 reports done
    this.dieChange = hour >= 9.5 && hour < 9.95 && !W.getVar('die.done')
    const stop = this.dieChange
    this.running = !stop
    if (!stop) {
      const before = Math.floor(this.t / T)
      this.t += dt
      this.strokes += Math.floor(this.t / T) - before
    }
    // bolster roll-out (P3) once crane 2 asks for it
    const want = stop && W.getVar('die.roll') ? 1 : 0
    this.roll = clamp(this.roll + Math.sign(want - this.roll) * dt * 0.08, 0, 1)
    W.setVar('die.rolled', this.roll)
    this.status = stop ? (this.roll > 0.98 ? '换模 · 台车已开出' : '换模中') : `运行 · ${(60 / T).toFixed(1)} SPM`
    const u = this.t / T
    this.presses.forEach((p, i) => {
      const r = p.rig
      const s = stop ? 0 : this.stroke(i, u)
      r.slide.position.y = r.yOpen - s * r.stroke
      r.flywheel.rotation.x += dt * (stop ? 0.4 : 4.2)
      r.bolster.position.z = i === 2 ? this.roll * 5.2 : 0
      // panel on press i between robot i release (0.49) and robot i+1 grip (1.0 + OFF)
      r.part.visible = fract(u - i * OFF - KEY_U.release) < 1 + OFF - KEY_U.release - 1e-3 && (!stop || i !== 2 || this.roll < 0.02)
      p.status = stop && i === 2 ? '换模' : stop ? '待机' : s > 0.7 ? '冲压 · 合模' : '冲压 · 开模'
    })
    this.robots.forEach((rb, k) => {
      const rig = rb.rig
      let pose = polar(this.keys[k], u - k * OFF)
      if (stop) {
        const cur = rb._pose || pose
        const a = Math.min(1, dt * 1.2)
        const home = { th: 0, r: 2.8, h: 3.2 }
        pose = { th: lerp(cur.th, home.th, a), r: lerp(cur.r, home.r, a), h: lerp(cur.h, home.h, a), held: false }
      }
      rb._pose = pose
      tmp.set(Math.sin(pose.th) * pose.r, pose.h, Math.cos(pose.th) * pose.r)
      solveIK(rig, tmp, 0)
      rig.held.visible = pose.held
      rb.status = stop ? '原点待机' : pose.held ? '搬运中' : '空载返回'
    })
    // exit belt: robot 5 releases at line u = 5 * OFF + 0.49, panels ride at 1.0 m/s
    if (this.belt) {
      const r = this.belt.rig
      const u5 = u - 5 * OFF - KEY_U.release
      const n0 = Math.floor(u5)
      r.parts.forEach((m, j) => {
        const age = (u5 - (n0 - j)) * T
        const x = -4 + age * 1.0
        m.visible = age >= 0 && x < r.L / 2 - 0.6
        m.position.x = x
      })
    }
  }

  draw(ctx, w, h) {
    board(ctx, w, h, { title: '冲压线 · TANDEM P1-P5', state: this.dieChange ? 'warn' : 'ok', status: this.status, a: ['节拍', `${(60 / T).toFixed(1)} SPM`], b: ['今日冲次', String(this.strokes)], c: ['模具', this.dieChange ? '换模 P3' : 'D-4471 门外板'] })
  }
}

// ---------------------------------------------------------------- weld lines
export class WeldLine {
  /** @param {object} E engine  @param {{ id, name, z, cell, robots: string[], X: number[] }} cfg */
  constructor(E, cfg) {
    this.E = E
    this.cfg = cfg
    this.cell = E.world.get(cfg.cell)
    this.robots = cfg.robots.map((id) => E.world.get(id))
    this.X = cfg.X
    this.state = 'weld'
    this.t = 0
    this.good = 4100 + Math.floor(Math.random() * 300)
    this.plan = 640
    this.cycleT = 0
    this.lastCycle = 58
    this.fault = null
    this.loaded = true
    this.progs = this.robots.map(() => null)
    this.status = '自动运行'
    this._spark = this.robots.map(() => 0)
    this.robots.forEach((r, i) => this._program(i))
  }

  /** random seam program for robot i (robot-local targets) */
  _program(i) {
    const rb = this.robots[i]
    const o = rb.object3d
    const st = Math.floor(i / 2)
    const sx = this.X[st + 1]
    const side = Math.sign(o.position.z - this.cfg.z)
    const n = 3 + Math.floor(Math.random() * 4)
    const seams = []
    for (let k = 0; k < n; k++) {
      const x0 = sx + (Math.random() - 0.5) * 1.2
      const len = 0.15 + Math.random() * 0.25
      const z0 = this.cfg.z + side * (0.3 + Math.random() * 0.2)
      seams.push([this._local(rb, x0, 1.12, z0), this._local(rb, x0 + len * (Math.random() < 0.5 ? 1 : -1), 1.12, z0 + side * 0.03)])
    }
    const home = this._local(rb, o.position.x, 2.0, this.cfg.z + side * 1.4)
    this.progs[i] = { seams, k: 0, ph: 'move', t: 0, home, from: home.clone(), done: false, dur: 1.2 + Math.random(), wait: Math.random() * 6, alpha: 0.95 + Math.random() * 0.25, roll: (Math.random() - 0.5) * 0.8 }
  }

  _local(rb, x, y, z) {
    const o = rb.object3d
    const v = new THREE.Vector3(x - o.position.x, y - o.position.y, z - o.position.z)
    v.applyAxisAngle(new THREE.Vector3(0, 1, 0), -o.rotation.y)
    return v
  }

  _pose(rb, p) {
    solveIK(rb.rig, p, this.progs[this.robots.indexOf(rb)].alpha, this.progs[this.robots.indexOf(rb)].roll)
  }

  update(dt) {
    const E = this.E
    const W = E.world
    this.cycleT += dt
    const fix = this.cell.rig
    if (this.state === 'fault') {
      this.t += dt
      const rb = this.robots[this.fault]
      if (W.take(`${this.cfg.id}.repaired`) || this.t > 70) {
        E.log(`${this.cfg.name} ${rb.name} 故障已排除`, '✔')
        this.state = 'weld'
        this.fault = null
        this.t = 0
      }
      this.status = `故障停线 · ${rb.name}`
    }
    if (this.state === 'weld') {
      let all = true
      this.robots.forEach((rb, i) => {
        const P = this.progs[i]
        if (!P.done) all = false
        this._runRobot(rb, i, P, dt)
      })
      // random fault: ~6% of cycles, mid-program
      if (!this.fault && this.state === 'weld' && Math.random() < dt * 0.0012) {
        this.fault = Math.floor(Math.random() * this.robots.length)
        this.state = 'fault'
        this.t = 0
        W.setVar(`${this.cfg.id}.faultX`, this.robots[this.fault].object3d.position.x)
        W.signal(`${this.cfg.id}.fault`)
        E.log(`${this.cfg.name} ${this.robots[this.fault].name} 报警：焊枪碰撞`, '⚠')
      } else if (all) {
        this.state = 'index'
        this.t = 0
        this.lastCycle = this.cycleT
        this.cycleT = 0
      }
      if (this.state === 'weld') this.status = '自动运行 · 焊接中'
    }
    if (this.state === 'index') {
      this.t += dt
      const k = this.t
      const open = smoothstep(0, 0.8, k) * (1 - smoothstep(4.2, 5, k))
      const slide = smoothstep(1, 4, k)
      fix.clamps.forEach((c) => c.children.forEach((a) => (a.rotation.x = a.userData.side * open * 1.3)))
      fix.parts.forEach((p, i) => {
        p.position.x = this.X[i] + (i < this.X.length - 1 ? (this.X[i + 1] - this.X[i]) * slide : 0)
        p.visible = i === this.X.length - 1 ? slide < 0.05 : i === 0 ? this.loaded : true
        p.position.y = fix.FIX_Y + 0.02 + Math.sin(slide * Math.PI) * 0.25
      })
      this.status = '工件转运'
      if (k >= 5) {
        fix.parts.forEach((p, i) => { p.position.x = this.X[i]; p.position.y = fix.FIX_Y + 0.02; p.visible = i > 0 })
        this.good++
        this.loaded = false
        W.signal(`${this.cfg.id}.load`)
        W.signal(`${this.cfg.id}.unload`)
        this.state = 'weld'
        this.t = 0
        this.robots.forEach((r, i) => this._program(i))
      }
    }
    // operator loads a new part (signal from the step) or auto after 10 s
    if (!this.loaded) {
      this._lt = (this._lt || 0) + dt
      if (W.take(`${this.cfg.id}.loaded`) || this._lt > 10) { this.loaded = true; this._lt = 0; fix.parts[0].visible = true }
    }
    // stack lights: green run / amber index / red flash on fault
    const s = fix.stack
    const tt = E.time
    s.g.emissiveIntensity = this.state === 'weld' ? 2.2 : 0.05
    s.a.emissiveIntensity = this.state === 'index' ? (Math.sin(tt * 6) > 0 ? 2.4 : 0.3) : 0.05
    s.r.emissiveIntensity = this.state === 'fault' ? (Math.sin(tt * 8) > 0 ? 3 : 0.2) : 0.05
  }

  _runRobot(rb, i, P, dt) {
    const E = this.E
    const rig = rb.rig
    if (this.fault === i) { rb.status = '报警 · 待处理'; rig.arc.visible = false; return }
    if (P.wait > 0) { P.wait -= dt; this._pose(rb, P.home); rig.arc.visible = false; rb.status = '等待'; return }
    P.t += dt
    const seam = P.seams[P.k]
    let p
    rig.arc.visible = false
    if (P.done) { this._pose(rb, P.home); rb.status = '原点 · 等待转运'; return }
    if (P.ph === 'move') {
      const to = seam ? seam[0] : P.home
      const k = easeInOut(clamp(P.t / P.dur, 0, 1))
      p = P.from.clone().lerp(to, k)
      if (seam) p.y += Math.sin(k * Math.PI) * 0.25
      if (P.t >= P.dur) {
        P.t = 0
        if (!seam) { P.done = true } else { P.ph = 'weld'; P.dur = 2.2 + Math.random() * 1.8 }
      }
      rb.status = seam ? '移动至焊缝' : '回原点'
    } else {
      const k = clamp(P.t / P.dur, 0, 1)
      p = seam[0].clone().lerp(seam[1], k)
      rig.arc.visible = true
      rig.arc.scale.setScalar(0.7 + Math.random() * 0.8)
      this._spark[i] -= dt
      if (this._spark[i] <= 0) {
        this._spark[i] = 0.05 + Math.random() * 0.05
        E.fx.emit('sparks', rig.tip.getWorldPosition(tmp), 3)
      }
      rb.status = `焊接中 · 焊缝 ${P.k + 1}/${P.seams.length}`
      if (P.t >= P.dur) {
        P.t = 0
        P.from = seam[1].clone()
        P.k++
        P.ph = 'move'
        P.dur = P.k < P.seams.length ? 0.6 + Math.random() * 0.4 : 1.2
      }
    }
    if (p) this._pose(rb, p)
  }

  get oee() { return Math.min(99, 82 + (this.good % 9) + (this.state === 'fault' ? -6 : 0)) }

  draw(ctx, w, h) {
    board(ctx, w, h, {
      title: this.cfg.name, state: this.state === 'fault' ? 'bad' : this.state === 'index' ? 'warn' : 'ok', status: this.status,
      a: ['计划 / 实际', `${this.plan} / ${this.good % 1000}`], b: ['节拍', `${this.lastCycle.toFixed(0)} s`], c: ['OEE', `${this.oee}%`]
    })
  }
}

/** andon board painter */
function board(ctx, w, h, d) {
  const C = { ok: '#1fae5b', warn: '#e2a21a', bad: '#d8352a' }
  ctx.fillStyle = '#0b0e12'
  ctx.fillRect(0, 0, w, h)
  ctx.fillStyle = C[d.state]
  ctx.fillRect(0, 0, w, h * 0.3)
  ctx.fillStyle = '#ffffff'
  ctx.font = `bold ${Math.round(h * 0.15)}px sans-serif`
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'left'
  ctx.fillText(d.title, w * 0.03, h * 0.15)
  ctx.textAlign = 'right'
  ctx.font = `bold ${Math.round(h * 0.11)}px sans-serif`
  ctx.fillText(d.status, w * 0.97, h * 0.15)
  ctx.textAlign = 'center'
  const cols = [d.a, d.b, d.c]
  cols.forEach(([k, v], i) => {
    const x = w * (i + 0.5) / 3
    ctx.fillStyle = '#8fa3b5'
    ctx.font = `${Math.round(h * 0.09)}px sans-serif`
    ctx.fillText(k, x, h * 0.45)
    ctx.fillStyle = i === 2 && d.state === 'bad' ? '#ff6a5a' : '#f2f5f7'
    ctx.font = `bold ${Math.round(h * 0.22)}px monospace`
    ctx.fillText(v, x, h * 0.72)
  })
  ctx.fillStyle = '#1e252d'
  for (let i = 1; i < 3; i++) ctx.fillRect((w * i) / 3 - 1, h * 0.36, 2, h * 0.56)
}
