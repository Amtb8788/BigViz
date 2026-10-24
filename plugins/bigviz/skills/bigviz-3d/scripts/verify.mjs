#!/usr/bin/env node
// Verify a built scene in a real browser:
//  - boots without console errors, WebGL available
//  - screenshots every key day + every dock shot + night / rain / snow
//  - deterministic fast-forward: agents move, floors rise, counters advance
//  - FPS sample at the chosen quality (honest: reports the renderer actually used)
// Usage (from the engine dir, after `npm run build`):
//   node ../../scripts/verify.mjs [--scene construction] [--out verify-out] [--quality high] [--headed] [--no-gpu] [--quick]

import fs from 'node:fs'
import path from 'node:path'
import { serve, launch, open, arg } from './lib/browser.mjs'

const engineDir = path.resolve(arg('engine', process.cwd()))
const dist = path.join(engineDir, 'dist')
const scene = arg('scene', 'construction')
const out = path.resolve(engineDir, arg('out', 'verify-out'))
const quality = arg('quality', 'high')
const quick = !!arg('quick', false)
if (!fs.existsSync(path.join(dist, 'index.html'))) {
  console.error('dist/ not found - run `npm run build` first')
  process.exit(2)
}
fs.mkdirSync(out, { recursive: true })

const report = { scene, quality, startedAt: new Date().toISOString(), checks: [], shots: [], fps: null, errors: [] }
const check = (name, ok, detail = '') => { report.checks.push({ name, ok: !!ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  - ' + detail : ''}`) }

const srv = await serve(dist)
const { browser, executablePath } = await launch({ engineDir, headless: !arg('headed', false), gpu: !arg('no-gpu', false) })
report.browser = executablePath
try {
  const { page, errors, state } = await open(browser, `${srv.url}?scene=${scene}&quality=${quality}&day=8.45`)
  check('boot', state.ready, state.error || '')
  if (!state.ready) throw new Error(state.error)
  report.renderer = await page.evaluate(() => {
    const gl = document.createElement('canvas').getContext('webgl2')
    const ext = gl && gl.getExtension('WEBGL_debug_renderer_info')
    return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'unknown'
  })
  console.log(`renderer: ${report.renderer}`)
  await page.waitForTimeout(2500)
  const snap = async (name) => {
    const f = path.join(out, `${name}.png`)
    await page.screenshot({ path: f })
    report.shots.push(path.basename(f))
  }
  await snap('00-hud')

  // shots in the dock
  const shots = await page.evaluate(() => window.__diorama.shots())
  check('shots defined', shots.length >= 6, `${shots.length} shots`)
  await page.evaluate(() => window.__diorama.ui(false))
  for (const s of shots.filter((x) => x.type !== 'walk').slice(0, quick ? 4 : 99)) {
    const ok = await page.evaluate((id) => window.__diorama.shot(id, 0), s.id)
    await page.waitForTimeout(900)
    if (ok) await snap(`shot-${s.id}`)
  }
  await page.evaluate(() => window.__diorama.shot('overview', 0))

  // key days
  const days = quick ? [1.3, 8.4, 16.4] : [1.3, 3.2, 5.2, 8.2, 12.2, 16.4]
  for (const d of days) {
    await page.evaluate((d) => { window.__diorama.day(d); window.__diorama.hour(14) }, d)
    await page.waitForTimeout(1200)
    await snap(`day-${String(d).replace('.', '_')}`)
  }
  // night / weather
  await page.evaluate(() => { window.__diorama.day(9.3); window.__diorama.hour(21.5); window.__diorama.weather('clear') })
  await page.waitForTimeout(1500)
  await snap('night')
  for (const w of quick ? ['rain'] : ['rain', 'snow', 'fog']) {
    await page.evaluate((w) => { window.__diorama.hour(15); window.__diorama.weather(w) }, w)
    await page.waitForTimeout(3500)
    await snap(`weather-${w}`)
  }
  await page.evaluate(() => { window.__diorama.weather('clear'); window.__diorama.hour(null) })

  // simulation: deterministic stepping (rAF paused) from day 4.6 for 180 sim seconds at 2x
  const sim = await page.evaluate(() => {
    const D = window.__diorama
    D.pauseLoop()
    D.day(4.6)
    D.speed(2)
    const before = D.stats()
    const pos0 = D.entities().filter((e) => e.active).length
    const E = D.engine
    const p0 = [...E.world.all()].filter((e) => e.agent && e.active).map((e) => [e.id, e.agent.x, e.agent.z])
    D.step(1 / 30, 2700)
    const after = D.stats()
    const moved = p0.filter(([id, x, z]) => { const a = E.world.get(id).agent; return Math.hypot(a.x - x, a.z - z) > 1 }).length
    const plans = {}
    for (const e of E.world.all()) if (e.agent && e.active) plans[e.id] = e.agent.planId
    D.resumeLoop()
    D.speed(1)
    return { before, after, moved, agents: p0.length, active: pos0, plans }
  })
  report.sim = sim
  check('agents move', sim.moved >= Math.min(8, sim.agents * 0.4), `${sim.moved}/${sim.agents} agents moved > 1 m`)
  check('floors rise', sim.after.floors > sim.before.floors, `${sim.before.floors.toFixed(2)} -> ${sim.after.floors.toFixed(2)}`)
  check('crane lifts happen', sim.after.lifts > sim.before.lifts, `${sim.before.lifts} -> ${sim.after.lifts}`)
  check('concrete pours happen', sim.after.pours + sim.after.concrete > sim.before.pours + sim.before.concrete, `pours ${sim.before.pours} -> ${sim.after.pours}`)

  // FPS sample
  await page.evaluate(() => { window.__diorama.day(9.3); window.__diorama.hour(15); window.__diorama.shot('orbit', 0); window.__diorama.quality(document.location.search.includes('quality=') ? new URLSearchParams(location.search).get('quality') : 'high') })
  await page.waitForTimeout(6000)
  report.fps = await page.evaluate(() => window.__diorama.stats())
  console.log(`fps: ${report.fps.fps} (avg ${report.fps.avg}, min ${report.fps.min}) quality ${report.fps.quality} calls ${report.fps.calls} tris ${report.fps.triangles}`)
  report.errors = errors
  check('no console errors', errors.length === 0, errors.slice(0, 3).join(' | '))
} catch (err) {
  check('run', false, String(err.stack || err))
} finally {
  await browser.close()
  srv.close()
  report.ok = report.checks.every((c) => c.ok)
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2))
  console.log(`\n${report.ok ? 'ALL CHECKS PASSED' : 'SOME CHECKS FAILED'} - report: ${path.join(out, 'report.json')}`)
  process.exit(report.ok ? 0 : 1)
}
