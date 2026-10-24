// HUD composition + director bar (bottom-centre) + hotkeys + immersive mode + help.

import { h } from './dom.js'
import { Panel } from './panel.js'
import { ShotDock } from './dock.js'
import { Overlay } from './overlay.js'
import { Recorder } from '../systems/recorder.js'
import { TwinPanel, TWIN_HELP } from './twin.js'

const HELP = [
  ['1-9 / 0', '切换镜头'], ['空格', '暂停 / 继续'], ['[ ]', '前一天 / 后一天'], ['- =', '减速 / 加速'],
  ['H', '沉浸模式（隐藏界面）'], ['R', '开始 / 停止录制'], ['P', '播放分镜'], ['A', '智能导播'],
  ['L', '电影遮幅'], ['F', '跟随选中对象'], ['Esc', '自由视角'], ['W A S D', '漫游模式行走'], ['?', '快捷键']
]

export class HUD {
  constructor(engine, root) {
    this.E = engine
    this.root = root
    this.panel = new Panel(engine, root)
    this.dock = new ShotDock(engine, root)
    this.overlay = new Overlay(engine, root)
    if (engine.twin) this.twin = new TwinPanel(engine, root)
    this._directorBar()
    this._help()
    this._keys()
    engine.director.onChange(() => this.sync())
    engine.camera.onChange(() => this.sync())
    this.sync()
  }

  _directorBar() {
    const E = this.E
    const boards = E.scene.storyboards || []
    this.boardSel = h('select.select', { 'aria-label': '分镜脚本' }, ...boards.map((b, i) => h('option', { value: i, text: `${b.name} · ${Math.round(b.segments.reduce((a, s) => a + s.t, 0))}s` })))
    this.playBtn = h('button.btn.btn--primary', { onclick: () => this.toggleBoard(false) }, '▶ 分镜')
    this.recBtn = h('button.btn.btn--rec', { onclick: () => this.toggleBoard(true), disabled: !Recorder.supported() }, '● 录制成片')
    this.autoBtn = h('button.btn', { onclick: () => this.toggleAuto() }, '◎ 智能导播')
    this.boxBtn = h('button.btn', { onclick: () => this.letterbox() }, '▭ 遮幅')
    this.immBtn = h('button.btn', { onclick: () => this.immersive() }, '◐ 沉浸')
    this.freeBtn = h('button.btn', { onclick: () => E.camera.free() }, '⌖ 自由视角')
    this.bar = h('div.bar__progress', {}, h('i'))
    this.director = h('section.director', { 'aria-label': '导演台' },
      h('div.row', {}, this.boardSel, this.playBtn, this.recBtn, this.autoBtn),
      h('div.row', {}, this.freeBtn, this.boxBtn, this.immBtn, (this.status = h('span.director__status'))),
      this.bar
    )
    this.root.append(this.director)
    this.letterboxEl = h('div.letterbox', { 'aria-hidden': 'true' }, h('i'), h('i'))
    this.root.append(this.letterboxEl)
    E.bus.on('frame', () => {
      if (E.director.playing) this.bar.firstChild.style.width = `${E.director.progress * 100}%`
    })
  }

  _help() {
    this.helpEl = h('div.help', { role: 'dialog', 'aria-label': '快捷键' },
      h('div.help__card', {}, h('h2', { text: '快捷键' }), h('dl', {}, ...[...HELP, ...(this.twin ? TWIN_HELP : [])].flatMap(([k, v]) => [h('dt', {}, h('kbd', { text: k })), h('dd', { text: v })])), h('button.btn', { onclick: () => (this.helpEl.hidden = true) }, '关闭'))
    )
    this.helpEl.hidden = true
    this.root.append(this.helpEl, h('button.helpbtn', { 'aria-label': '快捷键帮助', onclick: () => (this.helpEl.hidden = !this.helpEl.hidden) }, '?'))
  }

  _keys() {
    const E = this.E
    window.addEventListener('keydown', (e) => {
      if (e.target.closest?.('input,textarea,select') || e.ctrlKey || e.metaKey) return
      const walk = E.camera.mode === 'walk'
      switch (e.key) {
        case ' ': e.preventDefault(); this.panel.togglePlay(); break
        case '[': E.jumpTo(Math.max(E.clock.dayStart, Math.floor(E.clock.day) - 1 + 0.15)); break
        case ']': E.jumpTo(Math.floor(E.clock.day) + 1 + 0.15); break
        case '-': this._speed(-1); break
        case '=': case '+': this._speed(1); break
        case 'h': case 'H': this.immersive(); break
        case 'r': case 'R': this.toggleBoard(true); break
        case 'p': case 'P': this.toggleBoard(false); break
        case 'a': case 'A': if (!walk) this.toggleAuto(); break
        case 'l': case 'L': this.letterbox(); break
        case 'f': case 'F': if (E.picker.selected) E.camera.follow(E.picker.selected); break
        case 'Escape': E.director.stop(); E.director.stopAuto(); E.camera.free(); document.body.classList.remove('immersive'); this.helpEl.hidden = true; break
        case '?': this.helpEl.hidden = !this.helpEl.hidden; break
      }
      this.panel.sync()
    })
  }

  _speed(dir) {
    const S = [0.25, 0.5, 1, 2, 4, 8, 16]
    const c = this.E.clock
    const i = Math.max(0, S.indexOf(c.speed))
    c.speed = S[Math.max(0, Math.min(S.length - 1, i + dir))]
  }

  toggleBoard(record) {
    const E = this.E
    if (E.director.playing) {
      E.director.stop()
      return
    }
    const board = E.scene.storyboards?.[+this.boardSel.value || 0]
    if (!board) return
    this._prev = { speed: E.clock.speed, weather: E.weather.current, lockHour: E.clock.lockHour }
    document.body.classList.add('immersive', 'directing')
    if (board.letterbox) this.letterbox(true)
    if (record) {
      E.recorder.overlay.letterbox = !!board.letterbox
      E.recorder.overlay.watermark = E.scene.meta.watermark || ''
      E.stage.setForcePost(true)
      E.recorder.start({ fps: 60 })
    }
    E.director.play(board, {
      onDone: async () => {
        document.body.classList.remove('immersive', 'directing')
        this.letterbox(false)
        if (E.recorder.recording) await E.recorder.stop({ name: board.id })
        E.stage.setForcePost(false)
        E.weather.set(this._prev.weather)
        E.clock.lockHour = this._prev.lockHour
        E.clock.speed = this._prev.speed || 1
        E.camera.free()
        this.sync()
      }
    })
    this.sync()
  }

  toggleAuto() {
    const D = this.E.director
    if (D.auto) D.stopAuto()
    else D.startAuto(this.E.scene.autoDirector || {})
    this.sync()
  }

  letterbox(force) {
    const on = force ?? !document.body.classList.contains('letterboxed')
    document.body.classList.toggle('letterboxed', on)
  }

  immersive() {
    document.body.classList.toggle('immersive')
  }

  sync() {
    const E = this.E
    const D = E.director
    this.playBtn.textContent = D.playing && !E.recorder.recording ? '■ 停止' : '▶ 分镜'
    this.recBtn.textContent = E.recorder.recording ? '■ 停止录制' : '● 录制成片'
    this.recBtn.classList.toggle('is-on', E.recorder.recording)
    this.autoBtn.classList.toggle('is-on', D.auto)
    const shot = E.camera.shot
    this.status.textContent = D.playing ? `分镜 ${D.board.name}` : E.camera.mode === 'walk' ? '漫游中 · WASD 移动，拖拽转向' : shot ? `镜头：${shot.name}` : '自由视角 · 拖拽旋转 / 右键平移 / 滚轮缩放'
  }
}
