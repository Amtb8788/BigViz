// Desk paper: blueprint sheets, site plans, sticky notes and the plinth plaque. These are the
// "背景桌面" that makes the scene read as a model on an architect's table.

import * as THREE from 'three'
import { createRng } from '../core/rng.js'
import { makeCanvas } from './textures.js'

function tex(c) {
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  return t
}

function paperBase(ctx, w, h, color, rng) {
  ctx.fillStyle = color
  ctx.fillRect(0, 0, w, h)
  // fibre noise
  for (let i = 0; i < 2600; i++) {
    ctx.fillStyle = `rgba(255,255,255,${rng.range(0.01, 0.05)})`
    ctx.fillRect(rng.range(0, w), rng.range(0, h), rng.range(1, 3), 1)
  }
  // folds
  ctx.strokeStyle = 'rgba(0,0,0,0.08)'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(w / 2, 0)
  ctx.lineTo(w / 2, h)
  ctx.moveTo(0, h / 2)
  ctx.lineTo(w, h / 2)
  ctx.stroke()
}

/**
 * Blueprint sheet. kind: 'plan' | 'elevation' | 'site'
 * @param {{ kind?: string, title?: string, code?: string, seed?: number, ink?: string, paper?: string }} o
 */
export function blueprintTexture(o = {}) {
  const { kind = 'plan', title = 'PROJECT', code = 'A-101', seed = 3 } = o
  const ink = o.ink || 'rgba(225,238,255,0.85)'
  const w = 1024
  const h = 724
  const c = makeCanvas(w, h)
  const ctx = c.getContext('2d')
  const rng = createRng(seed)
  paperBase(ctx, w, h, o.paper || '#1d4f86', rng)
  ctx.strokeStyle = 'rgba(200,225,255,0.12)'
  ctx.lineWidth = 1
  for (let x = 0; x < w; x += 24) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke()
  }
  for (let y = 0; y < h; y += 24) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke()
  }
  ctx.strokeStyle = ink
  ctx.fillStyle = ink
  ctx.lineWidth = 3
  ctx.strokeRect(28, 28, w - 56, h - 56)
  ctx.lineWidth = 2
  if (kind === 'plan') drawPlan(ctx, rng)
  else if (kind === 'elevation') drawElevation(ctx, rng)
  else drawSite(ctx, rng)
  // title block
  ctx.lineWidth = 2
  ctx.strokeRect(w - 330, h - 150, 302, 122)
  ctx.beginPath(); ctx.moveTo(w - 330, h - 100); ctx.lineTo(w - 28, h - 100); ctx.stroke()
  ctx.font = 'bold 30px monospace'
  ctx.fillText(title, w - 316, h - 112)
  ctx.font = '20px monospace'
  ctx.fillText(`DWG ${code}   SCALE 1:200`, w - 316, h - 70)
  ctx.fillText(`REV C   ${new Date(2026, 8, 9).toISOString().slice(0, 10)}`, w - 316, h - 42)
  return tex(c)
}

function dim(ctx, x0, y0, x1, y1, label) {
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke()
  ctx.beginPath(); ctx.arc(x0, y0, 3, 0, 7); ctx.arc(x1, y1, 3, 0, 7); ctx.fill()
  ctx.font = '16px monospace'
  ctx.fillText(label, (x0 + x1) / 2 - 20, (y0 + y1) / 2 - 6)
}

function drawPlan(ctx, rng) {
  const ox = 120, oy = 110, cw = 110, ch = 100, nx = 6, ny = 4
  ctx.lineWidth = 5
  ctx.strokeRect(ox, oy, cw * nx, ch * ny)
  ctx.lineWidth = 2
  for (let i = 0; i <= nx; i++) for (let j = 0; j <= ny; j++) ctx.fillRect(ox + i * cw - 7, oy + j * ch - 7, 14, 14)
  for (let i = 1; i < nx; i++) if (rng.chance(0.6)) { ctx.beginPath(); ctx.moveTo(ox + i * cw, oy); ctx.lineTo(ox + i * cw, oy + ch * (1 + rng.int(0, 2))); ctx.stroke() }
  ctx.beginPath(); ctx.moveTo(ox, oy + ch * 2); ctx.lineTo(ox + cw * nx, oy + ch * 2); ctx.stroke()
  // stair + core
  ctx.strokeRect(ox + cw * 2.2, oy + ch * 1.1, cw * 1.6, ch * 0.8)
  for (let k = 0; k < 8; k++) { ctx.beginPath(); ctx.moveTo(ox + cw * 2.2 + k * 22, oy + ch * 1.1); ctx.lineTo(ox + cw * 2.2 + k * 22, oy + ch * 1.9); ctx.stroke() }
  // door swings
  for (let k = 0; k < 6; k++) { const x = ox + rng.int(0, nx - 1) * cw + 20, y = oy + rng.int(0, ny) * ch; ctx.beginPath(); ctx.arc(x, y, 30, 0, Math.PI / 2); ctx.stroke() }
  dim(ctx, ox, oy - 40, ox + cw * nx, oy - 40, '48 000')
  dim(ctx, ox - 50, oy, ox - 50, oy + ch * ny, '30 000')
  for (let i = 0; i <= nx; i++) { ctx.beginPath(); ctx.arc(ox + i * cw, oy + ch * ny + 50, 16, 0, 7); ctx.stroke(); ctx.font = '16px monospace'; ctx.fillText(String(i + 1), ox + i * cw - 5, oy + ch * ny + 56) }
}

function drawElevation(ctx, rng) {
  const ox = 180, base = 610, fw = 520, fh = 38, floors = 12
  ctx.lineWidth = 4
  ctx.beginPath(); ctx.moveTo(60, base); ctx.lineTo(980, base); ctx.stroke()
  ctx.lineWidth = 2
  ctx.strokeRect(ox, base - fh * floors, fw, fh * floors)
  for (let f = 0; f < floors; f++) {
    const y = base - fh * (f + 1)
    ctx.beginPath(); ctx.moveTo(ox, y); ctx.lineTo(ox + fw, y); ctx.stroke()
    for (let k = 0; k < 10; k++) ctx.strokeRect(ox + 12 + k * 51, y + 8, 36, fh - 16)
    ctx.font = '14px monospace'
    ctx.fillText(`${(f + 1) * 3.6}`.padStart(5), ox + fw + 18, y + 6)
  }
  // tower crane sketch
  ctx.beginPath(); ctx.moveTo(ox + fw + 90, base); ctx.lineTo(ox + fw + 90, base - fh * floors - 80); ctx.lineTo(ox - 60, base - fh * floors - 80); ctx.stroke()
  ctx.setLineDash([8, 6]); ctx.beginPath(); ctx.moveTo(ox + 140, base - fh * floors - 80); ctx.lineTo(ox + 140, base - fh * 9); ctx.stroke(); ctx.setLineDash([])
  ctx.font = '18px monospace'
  ctx.fillText('SOUTH ELEVATION', ox, base + 40)
  rng.next()
}

function drawSite(ctx, rng) {
  ctx.lineWidth = 26
  ctx.strokeStyle = 'rgba(225,238,255,0.25)'
  ctx.strokeRect(110, 100, 720, 480)
  ctx.strokeStyle = 'rgba(225,238,255,0.85)'
  ctx.lineWidth = 2
  ctx.strokeRect(170, 160, 600, 360)
  ctx.setLineDash([10, 8]); ctx.strokeRect(150, 140, 640, 400); ctx.setLineDash([])
  ctx.strokeRect(360, 250, 220, 160)
  ctx.font = '18px monospace'
  ctx.fillText('BLDG A  12F', 410, 336)
  for (let i = 0; i < 14; i++) { ctx.beginPath(); ctx.arc(rng.range(130, 820), rng.range(560, 640), rng.range(8, 16), 0, 7); ctx.stroke() }
  ctx.beginPath(); ctx.arc(250, 230, 120, -0.3, 1.2); ctx.stroke()
  ctx.fillText('TC-1  R=50m', 200, 220)
  ctx.beginPath(); ctx.moveTo(900, 120); ctx.lineTo(900, 60); ctx.lineTo(890, 80); ctx.moveTo(900, 60); ctx.lineTo(910, 80); ctx.stroke()
  ctx.fillText('N', 894, 50)
}

/** Kraft / white paper notes with handwriting-like scribbles */
export function noteTexture(lines = ['Day 12 封顶', '塔吊拆除'], color = '#f4d36b', seed = 5) {
  const c = makeCanvas(256)
  const ctx = c.getContext('2d')
  const rng = createRng(seed)
  ctx.fillStyle = color
  ctx.fillRect(0, 0, 256, 256)
  ctx.fillStyle = 'rgba(0,0,0,0.06)'
  ctx.fillRect(0, 0, 256, 34)
  ctx.fillStyle = '#3a3226'
  ctx.font = 'bold 30px sans-serif'
  lines.forEach((l, i) => ctx.fillText(l, 18 + rng.jitter(3), 86 + i * 52))
  return tex(c)
}

/** Brass plaque on the plinth front */
export function plaqueTexture(title, subtitle) {
  const c = makeCanvas(1024, 160)
  const ctx = c.getContext('2d')
  const g = ctx.createLinearGradient(0, 0, 0, 160)
  g.addColorStop(0, '#d8b46a'); g.addColorStop(0.5, '#b88f45'); g.addColorStop(1, '#8e6a2e')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 1024, 160)
  ctx.strokeStyle = 'rgba(60,40,10,0.6)'; ctx.lineWidth = 4; ctx.strokeRect(8, 8, 1008, 144)
  ctx.fillStyle = '#3b2a10'
  ctx.textAlign = 'center'
  ctx.font = 'bold 54px serif'
  ctx.fillText(title, 512, 78)
  ctx.font = '30px serif'
  ctx.fillText(subtitle, 512, 126)
  return tex(c)
}

/** Generic sign / banner text texture */
export function labelTexture(text, { bg = '#f2c230', fg = '#1b1b1b', w = 512, h = 128, font = 'bold 64px sans-serif' } = {}) {
  const c = makeCanvas(w, h)
  const ctx = c.getContext('2d')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, w, h)
  ctx.fillStyle = fg
  ctx.font = font
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, w / 2, h / 2 + 4)
  return tex(c)
}
