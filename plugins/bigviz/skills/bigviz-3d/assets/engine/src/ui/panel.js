// Title card (top-left) and control panel (top-right): playback, speed, timeline with
// milestone ticks + day chips, time of day, weather, quality, effects, stats.

import { h } from './dom.js'
import { SPEEDS } from '../core/clock.js'
import { WEATHERS, WEATHER_LABELS } from '../systems/weather.js'

const PHASE_CN = { foundation: '基础施工', columns: '立柱施工', formwork: '支模', rebar: '绑扎钢筋', pour: '浇筑混凝土', cure: '养护', done: '主体完成' }

export class Panel {
  constructor(engine, root) {
    this.E = engine
    const E = engine
    const meta = E.scene.meta
    this.title = h('section.title', { 'aria-label': '项目' },
      h('div.title__eyebrow', { text: meta.eyebrow || 'LIVING DIORAMA' }),
      h('h1.title__name', { text: meta.title }),
      h('div.title__sub', { text: meta.subtitle || '' }),
      (this.readout = h('div.title__readout'))
    )
    const speedBtns = SPEEDS.filter((s) => s > 0).map((s) => h('button.chip', { 'data-speed': s, onclick: () => { E.clock.speed = s; this.sync() } }, `${s}×`))
    this.playBtn = h('button.btn.btn--primary', { 'aria-label': '播放/暂停 (空格)', onclick: () => this.togglePlay() }, '❚❚')
    const range = E.clock
    this.slider = h('input.timeline__range', { type: 'range', min: range.dayStart, max: range.dayEnd + 0.999, step: 0.01, value: range.day, 'aria-label': '施工进度时间轴' })
    this.slider.addEventListener('input', () => { E.jumpTo(+this.slider.value); this.sync() })
    const ticks = h('div.timeline__ticks')
    for (const m of E.scene.progress?.events || []) {
      const p = (m.day - range.dayStart) / (range.dayEnd + 1 - range.dayStart)
      ticks.append(h('button.tick', { style: { left: `${p * 100}%` }, title: `Day ${m.day.toFixed(1)} · ${m.text}`, 'aria-label': m.text, onclick: () => { E.jumpTo(m.day - 0.02); this.sync() } }))
    }
    const chips = h('div.daychips')
    for (const d of E.scene.timeline?.keyDays || []) chips.append(h('button.chip', { onclick: () => { E.jumpTo(d.day); this.sync() }, title: d.items?.join(' / ') }, `D${d.day}`))
    this.hourSel = h('div.seg', {},
      ...[['跟随', null], ['清晨', 7], ['正午', 12], ['黄昏', 18.4], ['夜晚', 21.5]].map(([n, v]) => h('button.chip', { 'data-hour': v ?? 'auto', onclick: () => { E.clock.lockHour = v; this.sync() } }, n))
    )
    this.weatherSel = h('div.seg', {}, ...Object.keys(WEATHERS).map((w) => h('button.chip', { 'data-weather': w, onclick: () => { E.weather.set(w); this.sync() } }, WEATHER_LABELS[w])))
    this.qualitySel = h('div.seg', {},
      ...[['自动', 'auto'], ['高', 'high'], ['中', 'medium'], ['低', 'low']].map(([n, v]) => h('button.chip', { 'data-q': v, onclick: () => this.setQuality(v) }, n))
    )
    this.tilt = h('input', { type: 'checkbox', checked: true, onchange: (e) => E.stage.setTilt({ enabled: e.target.checked }) })
    this.labels = h('input', { type: 'checkbox', checked: true, onchange: (e) => E.bus.emit('ui.labels', e.target.checked) })
    this.stats = h('pre.stats')
    this.body = h('div.panel__body', {},
      h('div.row', {}, this.playBtn, h('div.seg', {}, ...speedBtns)),
      h('div.label', { text: '施工进度' }),
      h('div.timeline', {}, this.slider, ticks),
      chips,
      h('div.label', { text: '时间' }), this.hourSel,
      h('div.label', { text: '天气' }), this.weatherSel,
      h('div.label', { text: '画质 · 60 FPS 目标' }), this.qualitySel,
      h('div.row.row--opts', {}, h('label', {}, this.tilt, ' 移轴微缩'), h('label', {}, this.labels, ' 标签气泡')),
      this.stats
    )
    this.panel = h('section.panel', { 'aria-label': '控制面板' },
      h('header.panel__head', {}, h('span', { text: '控制台' }), h('button.dock__btn', { 'aria-label': '折叠面板', onclick: () => this.panel.classList.toggle('is-collapsed') }, '–')),
      this.body
    )
    root.append(this.title, this.panel)
    E.perf.onChange(() => this.sync())
    setInterval(() => this.tick(), 250)
    this.sync()
  }

  togglePlay() {
    const c = this.E.clock
    if (c.speed === 0) c.speed = this._lastSpeed || 1
    else { this._lastSpeed = c.speed; c.speed = 0 }
    this.sync()
  }

  setQuality(v) {
    const p = this.E.perf
    if (v === 'auto') p.auto = true
    else { p.auto = false; this.E.stage.setQuality(v) }
    this.sync()
  }

  sync() {
    const E = this.E
    this.playBtn.textContent = E.clock.speed === 0 ? '▶' : '❚❚'
    for (const b of this.panel.querySelectorAll('[data-speed]')) b.classList.toggle('is-on', +b.dataset.speed === E.clock.speed)
    for (const b of this.panel.querySelectorAll('[data-hour]')) b.classList.toggle('is-on', String(E.clock.lockHour ?? 'auto') === b.dataset.hour)
    for (const b of this.panel.querySelectorAll('[data-weather]')) b.classList.toggle('is-on', b.dataset.weather === E.weather.current)
    for (const b of this.panel.querySelectorAll('[data-q]')) b.classList.toggle('is-on', E.perf.auto ? b.dataset.q === 'auto' : b.dataset.q === E.stage.quality)
  }

  tick() {
    const E = this.E
    const { day, time } = E.clock.label()
    if (document.activeElement !== this.slider) this.slider.value = E.clock.day
    const b = E.building
    const floors = b ? Math.min(b.rig.N, Math.floor(E.progress.state.floors || 0)) : 0
    const s = E.stats()
    this.readout.replaceChildren(
      h('span.big', { text: `Day ${String(day).padStart(2, '0')}` }),
      h('span.mono', { text: time }),
      h('span', { text: WEATHER_LABELS[E.weather.current] }),
      b ? h('span', { text: `${floors}/${b.rig.N} 层 · ${PHASE_CN[b.phase] || b.phase}` }) : null,
      h('span', { text: `工人 ${s.workers} · 车辆 ${s.vehicles}` })
    )
    const st = E.perf.stats()
    this.stats.textContent = `FPS ${st.fps} (avg ${st.avg}, min ${st.min})  ${st.ms} ms\n画质 ${st.quality}${E.perf.auto ? ' · 自动' : ''}  DC ${st.calls}  三角 ${(st.triangles / 1000).toFixed(0)}k`
    this.sync()
  }
}

export { PHASE_CN }
