// Shot dock (bottom-left): clickable camera cards with live thumbnails, hotkeys, type icon,
// availability (e.g. "Day 3-12" when the subject is not on site), active state.

import * as THREE from 'three'
import { h, ICONS } from './dom.js'

export class ShotDock {
  constructor(engine, root) {
    this.E = engine
    this.cards = new Map()
    this.el = h('section.dock', { 'aria-label': '镜头' },
      h('header.dock__head', {},
        h('span.dock__title', { text: '镜头 SHOTS' }),
        h('button.dock__btn', { title: '刷新缩略图', 'aria-label': '刷新缩略图', onclick: () => this.refreshThumbs() }, '⟲')
      ),
      (this.list = h('div.dock__list', { role: 'listbox' }))
    )
    root.append(this.el)
    const shots = engine.shots.filter((s) => s.dock !== false)
    shots.forEach((s, i) => {
      const key = s.key ?? (i < 9 ? String(i + 1) : i === 9 ? '0' : '')
      s._key = key
      const img = h('div.card__thumb', {}, h('span.card__icon', { text: ICONS[s.type] || ICONS.static }))
      const card = h('button.card', { role: 'option', title: s.hint || s.name, 'aria-label': `${s.name}${key ? `，快捷键 ${key}` : ''}`, onclick: () => this.play(s) },
        img,
        h('div.card__meta', {}, h('span.card__name', { text: s.name }), h('span.card__hint', { text: s.sub || typeLabel(s.type) })),
        key ? h('kbd.card__key', { text: key }) : null,
        h('span.card__na')
      )
      this.list.append(card)
      this.cards.set(s.id, { card, img, shot: s })
    })
    engine.camera.onChange(() => this.sync())
    window.addEventListener('keydown', (e) => {
      if (e.target.closest?.('input,textarea,select') || e.ctrlKey || e.metaKey || e.altKey) return
      const s = shots.find((x) => x._key && x._key === e.key)
      if (s && engine.camera.mode !== 'walk') this.play(s)
    })
    this._thumbTimer = setTimeout(() => this.refreshThumbs(), 1200)
    this._avail = setInterval(() => this.sync(), 700)
  }

  play(s) {
    if (!this.E.shotAvailable(s)) return
    this.E.director.stopAuto()
    this.E.camera.play(s)
  }

  sync() {
    const cur = this.E.camera.shot?.id
    for (const { card, shot } of this.cards.values()) {
      card.classList.toggle('is-active', shot.id === cur)
      card.setAttribute('aria-selected', shot.id === cur ? 'true' : 'false')
      const ok = this.E.shotAvailable(shot)
      card.classList.toggle('is-na', !ok)
      card.querySelector('.card__na').textContent = ok ? '' : shot.when || '暂不在场'
    }
  }

  /** Render each shot once from a scratch camera into its card (spread over frames) */
  refreshThumbs() {
    const E = this.E
    const cam = new THREE.PerspectiveCamera(32, 16 / 9, 0.5, 2000)
    const items = [...this.cards.values()]
    let i = 0
    const next = () => {
      if (i >= items.length) return
      const { img, shot } = items[i++]
      if (E.shotAvailable(shot) && shot.type !== 'walk') {
        try {
          const pose = E.camera.evalShot(shot, shot.thumbT ?? 2)
          cam.fov = pose.fov
          cam.position.copy(pose.pos)
          cam.lookAt(pose.look)
          const url = E.stage.snapshot(cam)
          img.style.backgroundImage = `url(${url})`
          img.classList.add('has-img')
        } catch (err) {
          console.warn('thumb failed', shot.id, err)
        }
      }
      requestAnimationFrame(next)
    }
    requestAnimationFrame(next)
  }
}

function typeLabel(t) {
  return { orbit: '环绕', follow: '跟随', dolly: '运镜', crane: '驾驶室', ride: '随车', top: '俯视', street: '街景', walk: '漫游', static: '定机位' }[t] || '镜头'
}
