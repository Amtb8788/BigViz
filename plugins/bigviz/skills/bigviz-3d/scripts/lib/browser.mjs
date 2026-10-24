// Shared helpers for verify / record / thumbs: static server for dist/, browser discovery
// (any local Playwright Chromium, system Chrome / Edge, or CHROME_PATH) and page boot.

import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { createRequire } from 'node:module'

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.glb': 'model/gltf-binary', '.webm': 'video/webm' }

/** Serve a directory on 127.0.0.1 (random port). Resolves { url, close } */
export function serve(dir) {
  const root = path.resolve(dir)
  const server = http.createServer((req, res) => {
    const u = decodeURIComponent(new URL(req.url, 'http://x').pathname)
    let f = path.join(root, u === '/' ? 'index.html' : u)
    if (!f.startsWith(root)) { res.writeHead(403); return res.end() }
    if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(root, 'index.html')
    res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' })
    fs.createReadStream(f).pipe(res)
  })
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve({ url: `http://127.0.0.1:${server.address().port}/`, close: () => server.close() })))
}

/** Find a Chromium-family executable */
export function findBrowser() {
  if (process.env.CHROME_PATH && fs.existsSync(process.env.CHROME_PATH)) return process.env.CHROME_PATH
  const home = os.homedir()
  const pw = [path.join(home, 'AppData/Local/ms-playwright'), path.join(home, '.cache/ms-playwright'), path.join(home, 'Library/Caches/ms-playwright')]
  for (const base of pw) {
    if (!fs.existsSync(base)) continue
    const dirs = fs.readdirSync(base).filter((d) => /^chromium-\d+$/.test(d)).sort((a, b) => +b.split('-')[1] - +a.split('-')[1])
    for (const d of dirs) {
      for (const rel of ['chrome-win64/chrome.exe', 'chrome-win/chrome.exe', 'chrome-linux/chrome', 'chrome-linux64/chrome', 'chrome-mac/Chromium.app/Contents/MacOS/Chromium', 'chrome-mac-arm64/Chromium.app/Contents/MacOS/Chromium']) {
        const p = path.join(base, d, rel)
        if (fs.existsSync(p)) return p
      }
    }
  }
  const sys = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser']
  return sys.find((p) => fs.existsSync(p)) || null
}

/** Launch Chromium with GPU if possible (headed GPU is faster; headless falls back to SwiftShader) */
export async function launch({ engineDir, headless = true, gpu = true } = {}) {
  const require = createRequire(path.join(engineDir, 'package.json'))
  let pw
  try {
    pw = require('playwright-core')
  } catch {
    throw new Error('playwright-core not installed. Run `npm install` in the engine directory.')
  }
  const executablePath = findBrowser()
  if (!executablePath) throw new Error('No Chromium/Chrome/Edge found. Set CHROME_PATH to a Chromium-based browser.')
  const args = ['--enable-webgl', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required']
  if (gpu) args.push('--enable-gpu-rasterization', '--use-angle=default', ...(process.env.DGPU ? ['--force_high_performance_gpu'] : []))
  else args.push('--use-angle=swiftshader', '--enable-unsafe-swiftshader')
  const browser = await pw.chromium.launch({ executablePath, headless, args })
  return { browser, executablePath }
}

/** Open the app and wait for window.__diorama.ready; collects console errors */
export async function open(browser, url, { width = 1600, height = 900, timeout = 90000, init = null, context = null } = {}) {
  const page = await (context || browser).newPage(context ? undefined : { viewport: { width, height }, deviceScaleFactor: 1 })
  // init: script evaluated before any page script (e.g. seeded Math.random for recording)
  if (init) await page.addInitScript(init)
  const errors = []
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
  page.on('pageerror', (e) => errors.push(String(e.stack || e)))
  await page.goto(url, { waitUntil: 'load' })
  // poll from Node: in-page waitForFunction relies on rAF / performance.now, which
  // record.mjs replaces (deterministic mode)
  const until = Date.now() + timeout
  while (!(await page.evaluate(() => !!(window.__diorama && (window.__diorama.ready || window.__diorama.error))).catch(() => false))) {
    if (Date.now() > until) throw new Error(`timeout ${timeout} ms waiting for window.__diorama.ready`)
    await new Promise((r) => setTimeout(r, 250))
  }
  const state = await page.evaluate(() => ({ ready: window.__diorama.ready, error: window.__diorama.error }))
  return { page, errors, state }
}

export function arg(name, def) {
  const i = process.argv.indexOf(`--${name}`)
  if (i < 0) return def
  const v = process.argv[i + 1]
  return v == null || v.startsWith('--') ? true : v
}
