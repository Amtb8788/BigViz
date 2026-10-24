// Overlay layer: speech bubbles above agents, floating name tags, info card for the
// selected entity, caption lower-third (mirrors the recorder burn-in), event log ticker.

import * as THREE from 'three'
import { h } from './dom.js'

const v = new THREE.Vector3()

export class Overlay {
  constructor(engine, root) {
    this.E = engine
    this.labelsOn = true
    this.layer = h('div.overlay', { 'aria-hidden': 'true' })
    this.caption = h('div.caption', { role: 'status' })
    this.card = h('aside.info', { 'aria-live': 'polite' })
    this.card.hidden = true
    this.log = h('ol.log', { 'aria-label': '现场动态' })
    this.counters = h('div.counters')
    this.logBox = h('section.logbox', { 'aria-label': '现场动态' }, h('header.dock__head', {}, h('span.dock__title', { text: '现场动态 LIVE' })), this.counters, this.log)
    root.append(this.layer, this.caption, this.card, this.logBox)
    this.pool = []
    engine.bus.on('log', (l) => this._log(l))
    engine.bus.on('select', (e) => this._select(e))
    engine.bus.on('ui.labels', (on) => (this.labelsOn = on))
    engine.bus.on('frame', () => this.frame())
    setInterval(() => this._counters(), 500)
  }

  _log(l) {
    const li = h('li', {}, h('span.log__t', { text: `D${l.day} ${l.time}` }), h('span.log__i', { text: l.icon }), h('span', { text: l.text }))
    this.log.prepend(li)
    while (this.log.children.length > 7) this.log.lastChild.remove()
  }

  _counters() {
    const s = this.E.stats()
    const items = [['工人', s.workers], ['车辆', s.vehicles], ['吊次', s.lifts], ['浇筑', s.pours], ['进料', s.deliveries]]
    this.counters.replaceChildren(...items.map(([k, n]) => h('span.ctr', {}, h('b', { text: n }), k)))
  }

  _select(e) {
    this.sel = e
    if (!e) { this.card.hidden = true; return }
    this.card.hidden = false
    this._renderCard()
  }

  _renderCard() {
    const e = this.sel
    const E = this.E
    const i = e.info || {}
    this.card.replaceChildren(
      h('div.info__eyebrow', { text: i.role || e.kind }),
      h('div.info__name', { text: e.name }),
      i.desc ? h('p.info__desc', { text: i.desc }) : null,
      h('div.info__status', {}, h('i'), (this.statusEl = h('span', { text: e.status || '待命' }))),
      h('div.row', {},
        e.agent ? h('button.btn', { onclick: () => E.camera.follow(e, e.kind === 'walker' ? 12 : 26) }, '◉ 跟随') : null,
        h('button.btn', { onclick: () => E.camera.focus(e.object3d.position.clone(), e.kind === 'walker' ? 14 : 40) }, '⌖ 聚焦'),
        h('button.btn', { onclick: () => E.picker.select(null) }, '关闭')
      )
    )
  }

  _bubble(i) {
    if (!this.pool[i]) { this.pool[i] = h('div.bubble'); this.layer.append(this.pool[i]) }
    return this.pool[i]
  }

  frame() {
    const E = this.E
    let n = 0
    if (this.labelsOn && !document.body.classList.contains('immersive')) {
      for (const b of E.bubbles) {
        const o = b.e.object3d
        if (!o.visible) continue
        v.set(o.position.x, (b.e.agent?.y ?? o.position.y) + (b.e.kind === 'walker' ? 3 : 6), o.position.z)
        const p = E.project(v)
        if (!p.visible) continue
        const el = this._bubble(n++)
        if (el.textContent !== b.text) el.textContent = b.text
        el.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, -100%)`
        el.style.opacity = Math.min(1, b.t / 0.4, (b.life - b.t) / 0.25 + 0.2)
        el.hidden = false
      }
    }
    for (let i = n; i < this.pool.length; i++) this.pool[i].hidden = true
    if (this.sel && this.statusEl && this.statusEl.textContent !== (this.sel.status || '待命')) this.statusEl.textContent = this.sel.status || '待命'
    // caption (DOM version; recorder burns its own)
    const cap = E.director.caption
    const rec = E.recorder
    rec.overlay.caption = cap
    rec.overlay.day = E.director.playing ? `Day ${String(E.clock.wholeDay).padStart(2, '0')}  ${E.clock.label().time}` : ''
    if (cap) {
      this.caption.hidden = false
      if (this.caption.dataset.t !== cap.title) {
        this.caption.dataset.t = cap.title
        this.caption.replaceChildren(h('b', { text: cap.title }), h('span', { text: cap.sub }))
      }
      this.caption.style.opacity = Math.min(1, cap.t / 0.6, Math.max(0, cap.life - cap.t) / 0.6)
    } else this.caption.hidden = true
    // while recording the DOM caption would be duplicated by the burn-in, hide it
    if (rec.recording) this.caption.hidden = true
  }
}
