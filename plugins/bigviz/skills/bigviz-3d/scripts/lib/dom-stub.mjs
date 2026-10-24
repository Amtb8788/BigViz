// Minimal DOM stub so scene packs and procedural prefabs import / build in plain Node.
// Only canvas 2D drawing is faked (texture generation); nothing is rendered. Install it
// before importing any engine module: `import './lib/dom-stub.mjs'`.

const noop = () => {}
const fakeImage = (w = 1, h = 1) => ({ data: new Uint8ClampedArray(Math.max(1, (w | 0) * (h | 0)) * 4), width: w, height: h })
const SPECIAL = {
  measureText: () => (t) => ({ width: String(t ?? '').length * 6 }),
  getImageData: () => (x, y, w, h) => fakeImage(w, h),
  createImageData: () => (w, h) => fakeImage(w, h),
  createLinearGradient: () => () => ({ addColorStop: noop }),
  createRadialGradient: () => () => ({ addColorStop: noop }),
  createConicGradient: () => () => ({ addColorStop: noop }),
  createPattern: () => () => ({}),
  getTransform: () => () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 })
}

function ctx2d(canvas) {
  return new Proxy({ canvas }, {
    get: (t, k) => (k in t ? t[k] : SPECIAL[k] ? SPECIAL[k]() : noop),
    set: (t, k, v) => { t[k] = v; return true }
  })
}

function element(tag) {
  const el = { tagName: String(tag).toUpperCase(), width: 300, height: 150, style: {}, dataset: {}, children: [], addEventListener: noop, removeEventListener: noop, appendChild: (c) => c, setAttribute: noop, toDataURL: () => 'data:,' }
  el.getContext = () => (el._ctx ||= ctx2d(el))
  return el
}

export function installDomStub() {
  if (globalThis.document) return false
  globalThis.document = { createElement: element, createElementNS: (ns, tag) => element(tag), addEventListener: noop, body: element('body') }
  globalThis.requestAnimationFrame ??= () => 0
  globalThis.cancelAnimationFrame ??= noop
  if (!globalThis.navigator) globalThis.navigator = { userAgent: 'node' }
  return true
}

installDomStub()
