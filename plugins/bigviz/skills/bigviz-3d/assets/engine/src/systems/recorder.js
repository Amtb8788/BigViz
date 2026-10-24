// Recorder: composites the WebGL canvas + burned-in caption / letterbox / watermark onto a
// 2D canvas every frame and records it with MediaRecorder (webm). Call frame() right after
// render() in the same task, so preserveDrawingBuffer is not needed.

export class Recorder {
  constructor(source) {
    this.source = source
    this.canvas = document.createElement('canvas')
    this.ctx2d = this.canvas.getContext('2d')
    this.rec = null
    this.chunks = []
    this.overlay = { caption: null, letterbox: false, watermark: '', day: '' }
    this.startedAt = 0
    this.lastUrl = null
  }

  get recording() {
    return !!this.rec
  }

  static supported() {
    return typeof MediaRecorder !== 'undefined' && !!HTMLCanvasElement.prototype.captureStream
  }

  start({ fps = 60, bitrate = 16e6 } = {}) {
    if (this.rec || !Recorder.supported()) return false
    this.canvas.width = this.source.width
    this.canvas.height = this.source.height
    const stream = this.canvas.captureStream(fps)
    const types = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm', 'video/mp4']
    const mimeType = types.find((t) => MediaRecorder.isTypeSupported(t)) || ''
    this.chunks = []
    this.rec = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: bitrate })
    this.rec.ondataavailable = (e) => e.data.size && this.chunks.push(e.data)
    this.rec.start(250)
    this.mime = mimeType || 'video/webm'
    this.startedAt = performance.now()
    return true
  }

  /** Stop and resolve with { blob, url, seconds }; also triggers a download unless download:false */
  stop({ download = true, name = 'diorama' } = {}) {
    if (!this.rec) return Promise.resolve(null)
    const rec = this.rec
    this.rec = null
    return new Promise((resolve) => {
      rec.onstop = () => {
        const blob = new Blob(this.chunks, { type: this.mime })
        if (this.lastUrl) URL.revokeObjectURL(this.lastUrl)
        const url = URL.createObjectURL(blob)
        this.lastUrl = url
        const seconds = (performance.now() - this.startedAt) / 1000
        if (download) {
          const a = document.createElement('a')
          a.href = url
          a.download = `${name}-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}.webm`
          document.body.appendChild(a)
          a.click()
          a.remove()
        }
        window.__lastRecording = { url, size: blob.size, seconds, type: blob.type }
        resolve({ blob, url, seconds })
      }
      rec.stop()
    })
  }

  frame() {
    if (!this.rec) return
    const c = this.canvas
    const g = this.ctx2d
    if (c.width !== this.source.width || c.height !== this.source.height) {
      c.width = this.source.width
      c.height = this.source.height
    }
    g.drawImage(this.source, 0, 0)
    drawOverlay(g, c.width, c.height, this.overlay)
  }
}

/** Shared caption renderer (used by the recorder; the DOM caption mirrors its style) */
export function drawOverlay(g, w, h, o) {
  const s = h / 1080
  if (o.letterbox) {
    const bar = Math.round((h - w / 2.39) / 2)
    if (bar > 0) {
      g.fillStyle = '#000'
      g.fillRect(0, 0, w, bar)
      g.fillRect(0, h - bar, w, bar)
    }
  }
  if (o.caption) {
    const a = Math.min(1, o.caption.t / 0.6, Math.max(0, (o.caption.life ?? 99) - o.caption.t) / 0.6)
    g.save()
    g.globalAlpha = a
    const x = 96 * s
    const y = h - (o.letterbox ? 200 : 150) * s
    g.fillStyle = '#f2b51c'
    g.fillRect(x, y - 54 * s, 8 * s, 92 * s)
    g.fillStyle = 'rgba(12,16,24,0.55)'
    const tw = Math.max(measure(g, o.caption.title, 52 * s, 'bold'), measure(g, o.caption.sub, 26 * s, ''))
    g.fillRect(x + 8 * s, y - 54 * s, tw + 48 * s, 92 * s)
    g.fillStyle = '#fff8ea'
    g.font = `bold ${52 * s}px "PingFang SC","Microsoft YaHei",sans-serif`
    g.fillText(o.caption.title, x + 30 * s, y + 2 * s)
    g.fillStyle = 'rgba(255,248,234,0.75)'
    g.font = `${26 * s}px "PingFang SC","Microsoft YaHei",sans-serif`
    g.fillText(o.caption.sub || '', x + 30 * s, y + 30 * s)
    g.restore()
  }
  if (o.day) {
    g.save()
    g.font = `bold ${30 * s}px ui-monospace,Consolas,monospace`
    g.fillStyle = 'rgba(255,248,234,0.85)'
    g.textAlign = 'right'
    g.fillText(o.day, w - 72 * s, (o.letterbox ? 150 : 84) * s)
    g.restore()
  }
  if (o.watermark) {
    g.save()
    g.font = `${20 * s}px sans-serif`
    g.fillStyle = 'rgba(255,255,255,0.45)'
    g.textAlign = 'right'
    g.fillText(o.watermark, w - 72 * s, h - (o.letterbox ? 160 : 60) * s)
    g.restore()
  }
}

function measure(g, text, px, weight) {
  g.font = `${weight} ${px}px "PingFang SC","Microsoft YaHei",sans-serif`
  return g.measureText(text || '').width
}
