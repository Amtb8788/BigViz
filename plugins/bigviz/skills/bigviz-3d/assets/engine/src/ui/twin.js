// Twin panel (left): adapter status, device-type layers, interior (enter / floor / exit),
// live alarm list (click = fly to device), selection detail with live values + sparklines.
// Also floating value labels over alarming / selected device markers, and hotkeys.

import * as THREE from 'three'
import { h } from './dom.js'
import { LEVEL_COLORS, LEVEL_CN, fmtValue } from '../twin/bindings.js'

const KIND_CN = { site: '场地', building: '建筑', floor: '楼层', room: '房间', corridor: '走廊', component: '构件', zone: '区域', vehicle: '车辆', machine: '机械', person: '人员', prop: '设施', entity: '对象' }
const STATUS_CN = { open: '已连接', connecting: '连接中…', error: '连接失败', closed: '已断开', idle: '未连接' }
const v3 = new THREE.Vector3()

export const TWIN_HELP = [['I', '进入 / 退出楼内'], [', .', '楼内：下一层 / 上一层'], ['M', '显示 / 隐藏设备标记'], ['N', '全部标记 / 智能避让']]

export class TwinPanel {
  constructor(engine, root) {
    this.E = engine
    const T = (this.T = engine.twin)
    this.dirty = true
    this.rows = []
    this.statusEl = h('span.twin__status')
    this.summary = h('div.twin__summary', { 'aria-live': 'polite' })
    this.enterBtn = h('button.btn', { onclick: () => this.toggleInterior(), 'aria-label': '进入或退出楼内 (I)' }, '⌂ 进入楼内')
    this.floorEl = h('span.twin__floor.mono', { text: '—' })
    this.downBtn = h('button.chip', { onclick: () => T.interior.step(-1), 'aria-label': '下一层 (,)' }, '▾')
    this.upBtn = h('button.chip', { onclick: () => T.interior.step(1), 'aria-label': '上一层 (.)' }, '▴')
    this.layers = h('div.seg.twin__layers')
    this.markersChk = h('input', { type: 'checkbox', checked: true, onchange: (e) => (T.markers.enabled = e.target.checked) })
    this.alarmList = h('ol.twin__alarms', { 'aria-label': '告警列表' })
    this.detail = h('div.twin__detail')
    this.body = h('div.twin__body', {},
      this.summary,
      h('div.label', { text: '楼内' }),
      h('div.row', {}, this.enterBtn, this.downBtn, this.floorEl, this.upBtn),
      h('div.label', {}, h('label.twin__master', {}, this.markersChk, ' 设备图层')),
      this.layers,
      h('div.label', { text: '告警 ALARMS' }),
      this.alarmList,
      this.detail
    )
    this.el = h('section.twin', { 'aria-label': '数字孪生' },
      h('header.panel__head', {},
        h('span', {}, '数字孪生 · IoT ', this.statusEl),
        h('button.dock__btn', { 'aria-label': '折叠孪生面板', onclick: () => this.el.classList.toggle('is-collapsed') }, '–')
      ),
      this.body
    )
    this.labels = h('div.twin-labels', { 'aria-hidden': 'true' })
    this.pool = []
    root.append(this.labels, this.el)
    this._layers()
    for (const ev of ['alarm', 'clear', 'alarm.level', 'ack', 'online']) T.store.on(ev, () => (this.dirty = true))
    T.onChange(() => this._renderDetail())
    T.interior.onChange(() => this._syncInterior())
    T.adapter?.onStatus?.(() => this._status())
    engine.bus.on('frame', () => this._labels())
    this._keys()
    this._status()
    this._syncInterior()
    this._renderDetail()
    setInterval(() => this.tick(), 250)
  }
  _layers() {
    const T = this.T
    const types = T.registry.usedTypes()
    this.layers.replaceChildren(...types.map((t) => {
      const def = T.registry.types[t]
      const n = T.registry.byType(t).length
      const b = h('button.chip.is-on', { 'data-type': t, title: def.name, 'aria-pressed': 'true', onclick: () => {
        const on = T.markers.hiddenTypes.has(t)
        T.markers.setTypeVisible(t, on)
        b.classList.toggle('is-on', on)
        b.setAttribute('aria-pressed', String(on))
      } }, h('b.twin__glyph', { text: def.icon, style: { color: def.color } }), ` ${def.name} ${n}`)
      return b
    }))
  }

  _status() {
    const a = this.T.adapter
    const s = a ? a.status : 'closed'
    const kind = a ? a.kind || 'custom' : 'off'
    this.statusEl.className = `twin__status is-${s}`
    this.statusEl.textContent = `${kind.toUpperCase()} · ${STATUS_CN[s] || s}`
  }

  _syncInterior() {
    const I = this.T.interior
    const n = I.builtFloors()
    this.enterBtn.textContent = I.active ? '⇱ 退出楼内' : '⌂ 进入楼内'
    this.enterBtn.classList.toggle('is-on', I.active)
    this.enterBtn.disabled = !I.active && n < 1
    this.floorEl.textContent = I.active ? `${I.floor + 1}F / ${n}F` : n ? `已建 ${n}F` : '未出地面'
    this.downBtn.disabled = I.active ? I.floor <= 0 : n < 1
    this.upBtn.disabled = I.active ? I.floor >= n - 1 : n < 1
  }

  toggleInterior() {
    const I = this.T.interior
    if (I.active) return I.exit()
    // enter the selected floor if a floor / room is selected
    const n = this.T.selected?.node || (this.T.selected?.device && this.T.hostOf(this.T.selected.device))
    const f = n ? this.T.model.floorOf(n).floor : null
    I.enter(f ? f.floor : undefined)
  }

  _keys() {
    const E = this.E
    window.addEventListener('keydown', (e) => {
      if (e.target.closest?.('input,textarea,select') || e.ctrlKey || e.metaKey || e.altKey) return
      if (E.camera.mode === 'walk') return
      const I = this.T.interior
      switch (e.key) {
        case 'i': case 'I': this.toggleInterior(); break
        case ',': case '<': if (I.active) I.step(-1); break
        case '.': case '>': if (I.active) I.step(1); break
        case 'm': case 'M': this.T.markers.enabled = !this.T.markers.enabled; this.markersChk.checked = this.T.markers.enabled; break
        case 'n': case 'N': this.T.markers.showAll = !this.T.markers.showAll; E.log?.(this.T.markers.showAll ? '显示全部设备标记' : '设备标记智能避让', '◎'); break
        case 'Escape': if (I.active) I.exit(); break
      }
    })
  }

  tick() {
    const T = this.T
    const all = T.registry.all()
    const act = T.store.alarms()
    const crit = act.filter((a) => a.level === 'critical').length
    const off = all.filter((d) => T.store.get(d.id)?.online === false).length
    this.summary.replaceChildren(
      h('span.ctr', {}, h('b', { text: all.length }), '设备'),
      h('span.ctr', {}, h('b', { text: all.length - off }), '在线'),
      h('span.ctr.is-warn', {}, h('b', { text: act.length - crit }), '预警'),
      h('span.ctr.is-crit', {}, h('b', { text: crit }), '报警')
    )
    if (this.dirty) { this.dirty = false; this._renderAlarms() }
    this._syncInterior()
    this._refreshRows()
  }
  _renderAlarms() {
    const T = this.T
    const list = T.store.alarms().slice(0, 8)
    if (!list.length) { this.alarmList.replaceChildren(h('li.twin__empty', { text: '暂无告警 · 全部正常' })); return }
    this.alarmList.replaceChildren(...list.map((a) => {
      const d = T.registry.get(a.device)
      const spec = d?.props[a.prop]
      return h('li', {},
        h('button.twin__alarm', { 'data-level': a.level, title: '定位到设备', onclick: () => { T.select(a.device); T.flyTo(a.device) } },
          h('i', { style: { background: LEVEL_COLORS[a.level] } }),
          h('span.twin__alarm-main', {}, h('b', { text: `${LEVEL_CN[a.level]} · ${a.propName}` }), h('span', { text: `${a.deviceName} ${fmtValue(spec, a.value)}` })),
          h('span.twin__alarm-t.mono', { text: a.clock ? `D${a.clock.day} ${a.clock.time}` : '' })
        ),
        a.acked ? h('span.twin__ack', { text: '已确认' }) : h('button.chip', { 'aria-label': `确认告警 ${a.deviceName}`, onclick: () => T.store.ack(a.id) }, '确认')
      )
    }))
  }

  _renderDetail() {
    const T = this.T
    const sel = T.selected
    this.rows = []
    if (!sel) { this.detail.replaceChildren(); this.detail.hidden = true; return }
    this.detail.hidden = false
    if (sel.device) return this._renderDevice(sel.device)
    const n = sel.node
    const devs = T.devicesOn(n)
    const { floor } = T.model.floorOf(n)
    const canEnter = floor && floor.floor < T.interior.builtFloors()
    this.detail.replaceChildren(
      h('div.info__eyebrow', { text: KIND_CN[n.kind] || n.kind }),
      h('div.info__name', { text: n.room?.label || n.name }),
      h('div.twin__path.mono', { text: n.path }),
      h('div.label', { text: devs.length ? `挂载设备 ${devs.length}` : '暂无挂载设备' }),
      h('ul.twin__devs', {}, ...devs.slice(0, 12).map((d) => this._devRow(d))),
      h('div.row', {},
        canEnter && !(T.interior.active && T.interior.floor === floor.floor) ? h('button.btn', { onclick: () => T.interior.enter(floor.floor) }, `⌂ 进入 ${floor.floor + 1}F`) : null,
        h('button.btn', { onclick: () => T.flyTo(n.id) }, '⌖ 定位'),
        h('button.btn', { onclick: () => T.select(null) }, '关闭')
      )
    )
  }

  _devRow(d) {
    const T = this.T
    const dot = h('i.twin__dot')
    const val = h('span.mono')
    this.rows.push({ d, dot, val })
    return h('li', {}, h('button.twin__dev', { onclick: () => { T.select(d.id); T.flyTo(d.id) } },
      h('b.twin__glyph', { text: d.icon, style: { color: d.color } }), h('span', { text: d.name }), val, dot))
  }

  _renderDevice(d) {
    const T = this.T
    const host = T.hostOf(d)
    const props = Object.values(d.props).map((p) => {
      const val = h('span.twin__val.mono')
      const spark = h('canvas.twin__spark', { width: 120, height: 26, 'aria-hidden': 'true' })
      const lvl = h('i.twin__dot')
      this.rows.push({ d, prop: p, val, spark, dot: lvl })
      const th = [p.warn != null && `预警 ≥${p.warn}`, p.alarm != null && `报警 ≥${p.alarm}`, p.warnLow != null && `预警 ≤${p.warnLow}`].filter(Boolean).join(' · ')
      return h('li.twin__prop', { title: th }, h('span.twin__pname', { text: p.name || p.key }), val, lvl, spark)
    })
    this.posEl = d.track ? h('div.twin__path.mono') : null
    this.detail.replaceChildren(
      h('div.info__eyebrow', { text: T.registry.types[d.type]?.name || d.type }),
      h('div.info__name', {}, h('b.twin__glyph', { text: d.icon, style: { color: d.color } }), ` ${d.name}`),
      host ? h('button.twin__host', { onclick: () => T.select(host.id) }, `挂载于 ${host.room?.label || host.name} ›`) : h('div.twin__path', { text: '未挂载' }),
      this.posEl,
      h('ul.twin__props', {}, ...props),
      h('div.row', {},
        h('button.btn', { onclick: () => T.flyTo(d.id) }, '⌖ 定位'),
        h('button.btn', { onclick: () => T.select(null) }, '关闭')
      )
    )
    this._refreshRows()
  }
  _refreshRows() {
    const S = this.T.store
    for (const r of this.rows) {
      const st = S.get(r.d.id)
      if (r.prop) {
        const k = r.prop.key
        const lvl = st?.levels[k] || 'ok'
        r.val.textContent = fmtValue(r.prop, st?.values[k])
        r.dot.style.background = LEVEL_COLORS[lvl]
        r.dot.title = LEVEL_CN[lvl]
        if (!r.prop.states) spark(r.spark, S.history(r.d.id, k), r.prop, LEVEL_COLORS[lvl])
        else r.spark.hidden = true
      } else {
        const v = S.visual(r.d.id)
        r.val.textContent = v.label
        r.dot.style.background = v.color
        r.dot.title = LEVEL_CN[v.level]
      }
    }
    const sd = this.T.selected?.device
    if (this.posEl && sd) {
      const p = this.T.devicePos(sd, undefined, v3)
      this.posEl.textContent = `位置 x ${p.x.toFixed(1)}  y ${p.y.toFixed(1)}  z ${p.z.toFixed(1)} m`
    }
  }

  /** value tags over markers that are alarming or selected */
  _labels() {
    const T = this.T
    let n = 0
    if (!document.body.classList.contains('immersive')) {
      for (const it of T.markers.items.values()) {
        if (!it.shown || n >= 14) continue
        const sel = T.markers.selected === it.d.id
        if (!sel && it.level !== 'warn' && it.level !== 'critical') continue
        const p = this.E.project(it.pos)
        if (!p.visible) continue
        const el = this.pool[n] || (this.pool[n] = this.labels.appendChild(h('div.twin-label')))
        n++
        const v = T.store.visual(it.d.id)
        const text = sel ? `${it.d.name} · ${v.label}` : v.label
        if (el.textContent !== text) el.textContent = text
        el.style.borderColor = v.color
        el.style.transform = `translate(${p.x + it.off.x}px, ${p.y + it.off.y}px) translate(-50%, calc(-100% - 18px))`
        el.style.opacity = it.opacity < 0.5 ? '0.6' : ''
        el.hidden = false
      }
    }
    for (let i = n; i < this.pool.length; i++) this.pool[i].hidden = true
  }
}

/** tiny canvas sparkline with warn / alarm guide lines */
function spark(c, data, spec, color) {
  const g = c.getContext('2d')
  const W = c.width
  const H = c.height
  g.clearRect(0, 0, W, H)
  if (data.length < 2) return
  let lo = Math.min(...data)
  let hi = Math.max(...data)
  for (const t of [spec.warn, spec.alarm, spec.warnLow]) if (t != null && t > lo - (hi - lo) && t < hi + (hi - lo)) { lo = Math.min(lo, t); hi = Math.max(hi, t) }
  if (hi - lo < 1e-6) { hi += 1; lo -= 1 }
  const y = (v) => H - 2 - ((v - lo) / (hi - lo)) * (H - 4)
  g.lineWidth = 1
  g.setLineDash([2, 2])
  for (const [t, col] of [[spec.warn, LEVEL_COLORS.warn], [spec.alarm, LEVEL_COLORS.critical], [spec.warnLow, LEVEL_COLORS.warn]]) {
    if (t == null || t < lo || t > hi) continue
    g.strokeStyle = col
    g.beginPath(); g.moveTo(0, y(t)); g.lineTo(W, y(t)); g.stroke()
  }
  g.setLineDash([])
  g.strokeStyle = color
  g.lineWidth = 1.5
  g.beginPath()
  data.forEach((v, i) => { const x = (i / (data.length - 1)) * W; i ? g.lineTo(x, y(v)) : g.moveTo(x, y(v)) })
  g.stroke()
}