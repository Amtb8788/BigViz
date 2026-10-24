#!/usr/bin/env node
// Record a shot or a storyboard (director tour) frame by frame, deterministically:
// the rAF loop is paused and the engine is advanced with fixed steps of 1/fps (sim time is
// independent of how long a screenshot takes); Math.random is seeded before page scripts.
// Encodes to H.264 MP4 with ffmpeg when it is on PATH (frames piped, nothing on disk), else
// writes a PNG sequence and replays it at the exact fps into a Playwright WebM.
// Usage (from the engine dir):
//   node ../../scripts/record.mjs --tour [promo60] | --shot <id> [--seconds 10] [--fps 30]
//        [--size 1920x1080] [--style realistic|diorama] [--scene construction] [--day 8.4]
//        [--hour 15] [--weather rain] [--speed 1] [--quality high] [--twin off]
//        [--out rec-out] [--name clip] [--frames] [--no-ffmpeg] [--crf 18]
//        [--dev [--port 5183]] [--dist path] [--headed] [--no-gpu] [--seed 1]
// Source: --dist <dir> | <engine>/dist when built | --dev (Vite dev server on --port).

import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { spawn, spawnSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'
import { serve, launch, open, arg } from './lib/browser.mjs'

const engineDir = path.resolve(arg('engine', process.cwd()))
const scene = arg('scene', 'construction')
const tour = arg('tour', false)
const shotId = arg('shot', null)
const fps = Number(arg('fps', 30))
const [W, H] = String(arg('size', '1920x1080')).split('x').map(Number)
const out = path.resolve(engineDir, arg('out', 'rec-out'))
const useFfmpeg = !arg('no-ffmpeg', false) && spawnSync('ffmpeg', ['-version'], { stdio: 'ignore' }).status === 0
const keepFrames = !!arg('frames', false) || !useFfmpeg
const seed = Number(arg('seed', 1))
const die = (m) => { console.error(`record: ${m}`); process.exit(2) }

if (!tour && !shotId) die('pass --shot <id> or --tour [storyboard id]')
if (!(fps > 0 && fps <= 120) || !(W >= 64 && H >= 64)) die('bad --fps or --size (e.g. --fps 30 --size 1920x1080)')
fs.mkdirSync(out, { recursive: true })

/** static dist (default when built) or a Vite dev server (--dev) */
async function source() {
  const dist = path.resolve(engineDir, arg('dist', 'dist'))
  if (!arg('dev', false) && fs.existsSync(path.join(dist, 'index.html'))) {
    const s = await serve(dist)
    return { url: s.url, close: s.close, kind: `dist ${dist}` }
  }
  if (!arg('dev', false)) console.log('dist/ not found - starting the Vite dev server (pass --dev to do this explicitly)')
  const port = Number(arg('port', 5183))
  const vitePath = path.join(engineDir, 'node_modules/vite/dist/node/index.js')
  if (!fs.existsSync(vitePath)) die('vite not installed: run `npm install` in the engine dir')
  const { createServer } = await import(pathToFileURL(vitePath).href)
  const server = await createServer({ root: engineDir, configFile: path.join(engineDir, 'vite.config.js'), logLevel: 'warn', server: { host: '127.0.0.1', port, strictPort: true, hmr: false, watch: null } })
  await server.listen()
  return { url: `http://127.0.0.1:${port}/`, close: () => server.close(), kind: `vite dev :${port}` }
}

/**
 * Installed before any page script: seeded Math.random (mulberry32), a virtual
 * performance.now() that only advances with __advance(ms), and rAF callbacks held (never
 * run) so no free-running frame consumes randomness or time before capture starts.
 */
const seedScript = (s) => `(() => {
  let a = ${s} >>> 0
  Math.random = () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
  window.__reseed = (n) => { a = n >>> 0 }
  let vt = 0
  performance.now = () => vt
  window.__advance = (ms) => { vt += ms }
  window.requestAnimationFrame = () => 0
})()`
function query() {
  const q = new URLSearchParams({ scene, quality: arg('quality', 'high'), ui: '0' })
  for (const k of ['style', 'day', 'twin']) if (arg(k, null) != null) q.set(k, arg(k))
  return `?${q}`
}

/** inside the page: pause, hide chrome, warm up, then (re)start the shot / storyboard */
function setupPage({ tour, shotId, seed, day, hour, weather, speed, fps }) {
  const D = window.__diorama
  const E = D.engine
  D.pauseLoop()
  const ld = document.getElementById('loading')
  if (ld) ld.style.display = 'none'
  document.body.classList.add('immersive', 'directing')
  const boards = E.scene.storyboards || []
  let board = null
  let shot = null
  if (tour) {
    board = typeof tour === 'string' ? boards.find((b) => b.id === tour) : boards[0]
    if (!board) return { error: `storyboard "${tour}" not found (have: ${boards.map((b) => b.id).join(', ') || 'none'})` }
  } else {
    shot = E.shots.find((s) => s.id === shotId)
    if (!shot) return { error: `shot "${shotId}" not found (have: ${E.shots.map((s) => s.id).join(', ')})` }
    if (shot.type === 'walk') return { error: 'walk shots are interactive (WASD); pick another shot' }
  }
  const startDay = day ?? (board ? board.segments[0]?.day : null) ?? E.clock.day
  if (weather) E.weather.set(weather)
  if (hour != null) E.clock.lockHour = hour
  // warm-up: compile shaders, fill shadow maps, settle weather blends (not recorded)
  if (shot) E.camera.play(shot, { blend: 0 })
  for (let i = 0; i < Math.round(fps * 1.5); i++) { window.__advance(1000 / fps); D.step(1 / fps, 1) }
  // deterministic start: same seed + same day -> same agent decisions
  window.__reseed(seed)
  E.time = 0
  E.frame = 0
  E.clock.elapsed = 0
  E.fx.clear()
  E.jumpTo(startDay)
  E.clock.speed = speed ?? (board ? 1 : E.clock.speed)
  if (board) {
    if (board.letterbox) document.body.classList.add('letterboxed')
    E.director.play(board)
  } else E.camera.play(shot, { blend: 0 })
  const gl = document.createElement('canvas').getContext('webgl2')
  const ext = gl && gl.getExtension('WEBGL_debug_renderer_info')
  return {
    board: board?.id || null,
    shot: shot?.id || null,
    seconds: board ? board.segments.reduce((a, s) => a + s.t, 0) : null,
    day: +E.clock.day.toFixed(3),
    style: E.style,
    quality: E.stage.quality,
    renderer: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'unknown'
  }
}

/** ffmpeg sink: PNG frames on stdin -> H.264 mp4 */
function ffmpegSink(file) {
  const crf = String(arg('crf', 18))
  const p = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'png', '-i', '-',
    '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2', '-c:v', 'libx264', '-preset', 'medium', '-crf', crf, '-pix_fmt', 'yuv420p', '-movflags', '+faststart', file], { stdio: ['pipe', 'inherit', 'pipe'] })
  let stderr = ''
  p.stderr.on('data', (d) => (stderr += d))
  const done = new Promise((resolve, reject) => p.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}: ${stderr.trim()}`)))))
  return {
    write: (buf) => (p.stdin.write(buf) ? null : new Promise((r) => p.stdin.once('drain', r))),
    end: () => { p.stdin.end(); return done }
  }
}
/**
 * fallback (no ffmpeg on PATH): replay the PNG sequence at `fps` on a canvas and record it,
 * with Playwright video (needs Playwright's own ffmpeg: `npx playwright install ffmpeg`) or,
 * failing that, MediaRecorder (often unavailable in headless Chromium). -> { method, late } | null
 */
async function webmFromFrames(browser, dir, n, file) {
  try {
    const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1, recordVideo: { dir: out, size: { width: W, height: H } } })
    const page = await ctx.newPage()
    const late = await replay(page, dir, n, null)
    const video = page.video()
    await ctx.close()
    await video.saveAs(file)
    await video.delete()
    return { method: 'playwright-video', late }
  } catch (e) {
    console.warn(`playwright video unavailable (${e.message.split('\n')[0].slice(0, 90)}); trying MediaRecorder`)
  }
  const ctx = await browser.newContext({ viewport: { width: Math.min(W, 1280), height: Math.min(H, 720) }, deviceScaleFactor: 1 })
  const page = await ctx.newPage()
  const fd = fs.openSync(file, 'w')
  await page.exposeFunction('__chunk', (b64) => { fs.writeSync(fd, Buffer.from(b64, 'base64')) })
  const late = await replay(page, dir, n, true)
  fs.closeSync(fd)
  await ctx.close()
  if (fs.statSync(file).size > 0) return { method: 'mediarecorder', late }
  fs.rmSync(file)
  return null
}

/** paced canvas replay of f00000.png.. served from memory; mr = also MediaRecorder -> __chunk */
async function replay(page, dir, n, mr) {
  await page.route('http://frames.local/**', (route) => {
    const name = new URL(route.request().url()).pathname.slice(1)
    if (!name) return route.fulfill({ contentType: 'text/html', body: '<body style="margin:0;background:#000;overflow:hidden"><canvas id="c" style="width:100vw;height:100vh;display:block"></canvas></body>' })
    route.fulfill({ contentType: 'image/png', body: fs.readFileSync(path.join(dir, name)) })
  })
  await page.goto('http://frames.local/')
  return page.evaluate(async ({ n, fps, W, H, mr }) => {
    const c = document.getElementById('c')
    c.width = W
    c.height = H
    const g = c.getContext('2d')
    g.fillRect(0, 0, W, H)
    let pending = Promise.resolve()
    // optional MediaRecorder: 1 s chunks streamed to Node as base64 (bounded memory)
    const startRec = () => {
      const mime = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'].find((m) => MediaRecorder.isTypeSupported(m))
      const r = new MediaRecorder(c.captureStream(fps), { mimeType: mime, videoBitsPerSecond: Math.round(W * H * fps * 0.25) })
      r.ondataavailable = (ev) => {
        if (!ev.data.size) return
        pending = pending.then(async () => {
          const u8 = new Uint8Array(await ev.data.arrayBuffer())
          let s = ''
          for (let j = 0; j < u8.length; j += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(j, j + 0x8000))
          await window.__chunk(btoa(s))
        })
      }
      r.stopped = new Promise((res) => (r.onstop = res))
      r.start(1000)
      return r
    }
    const rec = mr ? startRec() : null
    const load = (i) => fetch(`/f${String(i).padStart(5, '0')}.png`).then((r) => r.blob()).then(createImageBitmap)
    let next = load(0)
    let late = 0
    const t0 = performance.now()
    for (let i = 0; i < n; i++) {
      const bmp = await next
      if (i + 1 < n) next = load(i + 1)
      const due = t0 + (i * 1000) / fps
      const wait = due - performance.now()
      if (wait > 0) await new Promise((r) => setTimeout(r, wait))
      else if (wait < -1000 / fps) late++
      g.drawImage(bmp, 0, 0, W, H)
      bmp.close()
    }
    await new Promise((r) => setTimeout(r, 1000 / fps))
    if (rec) {
      rec.stop()
      await rec.stopped
      await pending
    }
    return late
  }, { n, fps, W, H, mr })
}

const t0 = Date.now()
const src = await source()
const { browser, executablePath } = await launch({ engineDir, headless: !arg('headed', false), gpu: !arg('no-gpu', false) })
const report = { scene, source: src.kind, browser: executablePath, fps, size: `${W}x${H}`, encoder: useFfmpeg ? 'ffmpeg/libx264' : 'playwright/webm', seed }
let code = 0
try {
  const { page, errors, state } = await open(browser, `${src.url}${query()}`, { width: W, height: H, init: seedScript(seed), timeout: 180000 })
  if (!state.ready) throw new Error(`boot failed: ${state.error}`)
  const num = (k) => (arg(k, null) == null ? undefined : Number(arg(k)))
  const info = await page.evaluate(setupPage, { tour, shotId, seed, day: num('day'), hour: num('hour'), weather: arg('weather', null), speed: num('speed'), fps })
  if (info.error) throw new Error(info.error)
  Object.assign(report, info)
  const seconds = Number(arg('seconds', info.seconds ?? 10))
  const n = Math.max(1, Math.round(seconds * fps))
  const base = arg('name', `${scene}-${info.board || info.shot}-${W}x${H}-${fps}fps`)
  const framesDir = path.join(out, `${base}-frames`)
  if (keepFrames) fs.mkdirSync(framesDir, { recursive: true })
  const file = path.join(out, `${base}.${useFfmpeg ? 'mp4' : 'webm'}`)
  const sink = useFfmpeg ? ffmpegSink(file) : null
  const hashes = new Set()
  console.log(`recording ${info.board ? `storyboard "${info.board}"` : `shot "${info.shot}"`}: ${n} frames (${seconds}s @ ${fps}fps) ${W}x${H}, style ${info.style}, ${src.kind}`)
  console.log(`renderer: ${info.renderer}`)
  for (let i = 0; i < n; i++) {
    await page.evaluate((dt) => { window.__advance(dt * 1000); window.__diorama.step(dt, 1) }, 1 / fps)
    const buf = await page.screenshot({ type: 'png' })
    hashes.add(crypto.createHash('sha1').update(buf).digest('hex'))
    if (keepFrames) fs.writeFileSync(path.join(framesDir, `f${String(i).padStart(5, '0')}.png`), buf)
    if (sink) await sink.write(buf)
    if (i % fps === 0 || i === n - 1) process.stdout.write(`\r  frame ${i + 1}/${n}`)
  }
  process.stdout.write('\n')
  let video = file
  if (sink) await sink.end()
  else {
    const r = await webmFromFrames(browser, framesDir, n, file)
    if (r) Object.assign(report, { encoder: r.method, lateFrames: r.late })
    else {
      video = null
      report.encoder = 'none (png sequence only)'
      console.warn('no video encoder available: put ffmpeg on PATH (or `npx playwright install ffmpeg`); PNG frames kept')
      console.warn(`  encode later: ffmpeg -framerate ${fps} -i "${path.join(framesDir, 'f%05d.png')}" -c:v libx264 -pix_fmt yuv420p -crf 18 out.mp4`)
    }
  }
  const bytes = video ? fs.statSync(video).size : fs.readdirSync(framesDir).reduce((a, f) => a + fs.statSync(path.join(framesDir, f)).size, 0)
  Object.assign(report, { frames: n, seconds, uniqueFrames: hashes.size, file: video || framesDir, bytes, framesDir: keepFrames ? framesDir : null, endDay: await page.evaluate(() => +window.__diorama.engine.clock.day.toFixed(3)), errors })
  if (hashes.size < Math.min(3, n)) console.warn('WARNING: frames are (nearly) identical - is the canvas rendering?')
  if (errors.length) console.warn(`console errors: ${errors.slice(0, 3).join(' | ')}`)
} catch (err) {
  report.error = String(err.stack || err)
  console.error(`record failed: ${report.error}`)
  code = 1
} finally {
  await browser.close()
  await src.close()
  report.elapsed = +((Date.now() - t0) / 1000).toFixed(1)
  fs.writeFileSync(path.join(out, 'record-report.json'), JSON.stringify(report, null, 2))
  if (!code) console.log(`wrote ${report.file} (${(report.bytes / 1048576).toFixed(2)} MB, ${report.frames} frames, ${report.uniqueFrames} distinct) in ${report.elapsed}s`)
  process.exit(code)
}
