#!/usr/bin/env node
// Static validation of a scene pack, in plain Node (no browser, no build).
// Imports the pack with a tiny DOM stub (scripts/lib/dom-stub.mjs) so procedural prefabs
// can be built to learn their rig parts, then checks: required fields, shot / storyboard /
// auto-director references, step types against the live step registry (steps-*.js +
// traffic-steps.js + registerStep() from the pack), prefab keys, place / road-node refs,
// road graph + signals, progress curves, twin devices (ids, types, attachTo, thresholds).
// Usage (from the engine dir):
//   node ../../scripts/validate-scene.mjs [src/scenes] [--scene construction | --all | --file path/scene.json]
//        [--json] [--strict] [--verbose]
// Exit: 0 ok, 1 errors (or warnings with --strict), 2 could not load.

import './lib/dom-stub.mjs'
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { arg } from './lib/browser.mjs'
import { checkScene } from './lib/scene-checks.mjs'

const pos = process.argv.slice(2).find((a, i, all) => !a.startsWith('--') && !(all[i - 1] || '').match(/^--(scene|file|engine)$/))
const engineDir = path.resolve(arg('engine', process.cwd()))
const scenesDir = path.resolve(engineDir, pos || 'src/scenes')
const srcDir = path.dirname(scenesDir)
const asJson = !!arg('json', false)
const strict = !!arg('strict', false)
const verbose = !!arg('verbose', false)
const url = (rel) => pathToFileURL(path.join(srcDir, rel)).href

function fail(msg) {
  if (asJson) console.log(JSON.stringify({ ok: false, fatal: msg }, null, 2))
  else console.error(`validate-scene: ${msg}`)
  process.exit(2)
}

if (!fs.existsSync(path.join(scenesDir, 'index.js'))) fail(`no scene registry at ${path.join(scenesDir, 'index.js')}`)

// engine registries (live objects: packs may add to them on import)
const [steps, prefabs, props, devices, interior, roadsMod, trafficMod, weather, people, bindings] = await Promise.all([
  import(url('systems/steps.js')),
  import(url('prefabs/index.js')),
  import(url('prefabs/props.js')),
  import(url('twin/devices.js')),
  import(url('twin/interior.js')),
  import(url('systems/roads.js')),
  import(url('systems/traffic.js')),
  import(url('systems/weather.js')),
  import(url('systems/animate-people.js')),
  import(url('twin/bindings.js'))
]).catch((e) => fail(`could not import engine modules from ${srcDir}: ${e.message}`))
await import(url('systems/traffic-steps.js'))
const env = {
  STEPS: steps.STEPS, PREFABS: prefabs.PREFABS, PROPS: props.PROPS, makePrefab: prefabs.makePrefab,
  DEVICE_TYPES: devices.DEVICE_TYPES, planFloor: interior.planFloor, RoadGraph: roadsMod.RoadGraph,
  TrafficSystem: trafficMod.TrafficSystem, WEATHERS: weather.WEATHERS, POSE_NAMES: people.POSE_NAMES, LEVELS: bindings.LEVELS
}
/** -> [{ id, load: () => scene }] */
async function targets() {
  const file = arg('file', null)
  if (file) {
    const f = path.resolve(process.cwd(), file)
    if (!fs.existsSync(f)) fail(`file not found: ${f}`)
    const load = f.endsWith('.json') ? async () => JSON.parse(fs.readFileSync(f, 'utf8')) : async () => (await import(pathToFileURL(f).href)).default
    return [{ id: path.basename(path.dirname(f)), load, file: true }]
  }
  const { SCENES } = await import(pathToFileURL(path.join(scenesDir, 'index.js')).href)
  const ids = Object.keys(SCENES)
  const want = arg('all', false) ? ids : [arg('scene', 'construction')]
  for (const id of want) if (!SCENES[id]) fail(`scene "${id}" is not registered in ${path.join(scenesDir, 'index.js')} (have: ${ids.join(', ')})`)
  return want.map((id) => ({ id, load: async () => (await SCENES[id]()).default }))
}

const results = []
for (const t of await targets()) {
  let scene
  try {
    scene = await t.load()
  } catch (e) {
    results.push({ id: t.id, errors: [{ where: 'import', msg: String(e.stack || e).split('\n').slice(0, 3).join(' | ') }], warnings: [], info: [], stats: {} })
    continue
  }
  const r = checkScene(scene, env, { id: t.id })
  if (!t.file && scene?.meta?.id && scene.meta.id !== t.id) r.warnings.push({ where: 'meta.id', msg: `meta.id "${scene.meta.id}" differs from the registry key "${t.id}"` })
  results.push(r)
}

const bad = (r) => r.errors.length > 0 || (strict && r.warnings.length > 0)
const ok = !results.some(bad)
if (asJson) {
  console.log(JSON.stringify({ ok, strict, scenes: results }, null, 2))
} else {
  for (const r of results) {
    const st = r.stats || {}
    console.log(`\nscene "${r.id}"  entities ${st.entities ?? '-'} (agents ${st.agents ?? '-'})  shots ${st.shots ?? '-'}  storyboards ${st.storyboards ?? '-'}  roads ${st.roadNodes ?? '-'}/${st.roadEdges ?? '-'}  signals ${st.signals ?? '-'}  devices ${st.devices ?? '-'}`)
    if (st.steps && Object.keys(st.steps).length) console.log(`  step types: ${Object.entries(st.steps).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k}x${n}`).join(' ')}`)
    const print = (tag, list) => list.forEach((x) => console.log(`  ${tag}  ${x.where}: ${x.msg}`))
    print('ERROR', r.errors)
    print('WARN ', r.warnings)
    if (verbose) print('info ', r.info)
    else if (r.info.length) console.log(`  (${r.info.length} info note(s); --verbose to show)`)
    console.log(`  => ${r.errors.length} error(s), ${r.warnings.length} warning(s)  ${bad(r) ? 'FAIL' : 'OK'}`)
  }
  console.log(`\n${ok ? 'VALID' : 'INVALID'}${strict ? ' (strict)' : ''}`)
}
process.exit(ok ? 0 : 1)
