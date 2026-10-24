#!/usr/bin/env node
// Scaffold a scene pack: copy src/scenes/_template -> src/scenes/<id>, set id / title and
// register it in src/scenes/index.js (lazy import). Remove one again with --remove.
// Usage (from the engine dir):
//   node ../../scripts/new-scene.mjs <id> "<name>"      e.g. new-scene.mjs smart-park "智慧园区"
//   node ../../scripts/new-scene.mjs <id> --remove      unregister + delete scenes/<id>/
// Then: npm run validate -- --scene <id>, npm run dev -> http://127.0.0.1:5173/?scene=<id>

import fs from 'node:fs'
import path from 'node:path'
import { arg } from './lib/browser.mjs'

const engineDir = path.resolve(arg('engine', process.cwd()))
const scenesDir = path.join(engineDir, 'src/scenes')
const indexFile = path.join(scenesDir, 'index.js')
const pos = process.argv.slice(2).filter((a, i, all) => !a.startsWith('--') && all[i - 1] !== '--engine')
const [id, name = id] = pos
const die = (msg) => { console.error(`new-scene: ${msg}`); process.exit(1) }

if (!id) die('usage: new-scene.mjs <id> "<name>"  |  new-scene.mjs <id> --remove')
if (!/^[a-z][a-z0-9-]{1,40}$/.test(id)) die(`invalid id "${id}" (lowercase letters, digits, '-'; starts with a letter)`)
if (!fs.existsSync(indexFile)) die(`no scene registry at ${indexFile} (run from the engine dir or pass --engine)`)
const key = /^[a-z][a-z0-9]*$/.test(id) ? id : `'${id}'`
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\-]/g, '\\$&')
const entryRe = new RegExp(`\\n[ \\t]*(?:${esc(id)}|'${esc(id)}'|"${esc(id)}")\\s*:\\s*\\(\\)\\s*=>\\s*import\\([^)]*\\),?`)
const src = fs.readFileSync(indexFile, 'utf8')
const block = /export const SCENES = \{\n([\s\S]*?)\n\}/

if (arg('remove', false)) {
  if (id === 'construction' && !arg('force', false)) die('refusing to remove the reference pack "construction" (use --force)')
  const next = src.replace(entryRe, '').replace(block, (m, body) => `export const SCENES = {\n${body.replace(/,\s*$/, '')}\n}`)
  if (next !== src) fs.writeFileSync(indexFile, next)
  const dir = path.join(scenesDir, id)
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true })
  console.log(`removed scene "${id}" (${next !== src ? 'unregistered' : 'was not registered'}, ${dir})`)
  process.exit(0)
}

const tpl = path.join(scenesDir, '_template')
const dest = path.join(scenesDir, id)
if (!fs.existsSync(tpl)) die(`template missing: ${tpl}`)
if (fs.existsSync(dest)) die(`${dest} already exists`)
if (entryRe.test(src)) die(`"${id}" is already registered in ${indexFile}`)
if (!block.test(src)) die(`could not find "export const SCENES = { ... }" in ${indexFile}`)

// copy + personalise (id in meta, display name in strings)
const lit = (s) => String(s).replace(/[\r\n]+/g, ' ').replace(/\\/g, '\\\\').replace(/'/g, "\\'")
fs.cpSync(tpl, dest, { recursive: true })
for (const f of fs.readdirSync(dest, { recursive: true })) {
  const p = path.join(dest, f)
  if (!/\.(js|json|mjs)$/.test(p) || !fs.statSync(p).isFile()) continue
  const text = fs.readFileSync(p, 'utf8')
    .replace(/^\/\/ Scene pack template:/m, `// Scene pack: ${String(name).replace(/[\r\n]+/g, ' ')} (from scenes/_template):`)
    .replace(/id: '_template'/g, `id: '${id}'`)
    .replace(/Template Scene/g, lit(name))
  fs.writeFileSync(p, text)
}

// register: append one lazy import line to SCENES
const next = src.replace(block, (m, body) => `export const SCENES = {\n${body.replace(/\s*$/, '').replace(/,?$/, ',')}\n  ${key}: () => import('./${id}/index.js')\n}`)
fs.writeFileSync(indexFile, next)
console.log(`created ${dest}\nregistered "${id}" in ${indexFile}`)
console.log(`next: npm run validate -- --scene ${id}   |   npm run dev -> ?scene=${id}`)
