// Tiny DOM helpers (no framework): h('div.cls#id', { attrs }, children)

export function h(tag, attrs = {}, ...kids) {
  const [base, ...rest] = tag.split(/(?=[.#])/)
  const el = document.createElement(base || 'div')
  for (const r of rest) {
    if (r[0] === '.') el.classList.add(r.slice(1))
    else if (r[0] === '#') el.id = r.slice(1)
  }
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue
    if (k.startsWith('on')) el.addEventListener(k.slice(2).toLowerCase(), v)
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v)
    else if (k === 'text') el.textContent = v
    else if (k === 'html') el.innerHTML = v
    else el.setAttribute(k, v === true ? '' : v)
  }
  for (const c of kids.flat()) if (c != null && c !== false) el.append(c.nodeType ? c : document.createTextNode(String(c)))
  return el
}

export const ICONS = {
  play: '▶', pause: '❚❚', rec: '●', stop: '■', auto: '◎', eye: '◐', camera: '⌖', back: '⟲',
  orbit: '⟳', follow: '◉', dolly: '↝', crane: '⊤', ride: '⇥', top: '⊞', street: '⌂', static: '▣', walk: '⇄'
}

export function fmtDay(d) {
  return `Day ${String(Math.floor(d)).padStart(2, '0')}`
}
