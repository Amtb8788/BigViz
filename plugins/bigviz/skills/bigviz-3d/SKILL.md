---
name: bigviz-3d
description: "Build data-driven, time-driven living 3D worlds with a three.js engine: construction sites, factories, parks and city streets with agents (workers, machines, vehicles), road networks and traffic signals, progress over days, weather, camera shots and storyboards, verified in a real browser with screenshots and recordings. Evolving into a digital-twin platform: realistic render tier with glTF assets, IoT devices bound to any component, alarms, building interiors, business-system integration and BigViz dashboard embedding. Use when the user wants a 3D construction-site / smart-site / smart-factory / smart-park / city-street scene, a living diorama, a digital twin, a 3D hero for a dashboard, or says 数字孪生, 智慧工地, 智慧工厂, 智慧园区, 三维工地, 3D 场景, 施工模拟, 红绿灯路口, 设备上图, IoT 绑定, 进入楼内, 沙盘."
---

# BigViz 3D

three.js engine (`assets/engine`) that turns a scene pack (data + small glue functions) into a
live world: terrain, ground layers, roads, prefabs, agents with plans, progress curves, shots.
Design and roadmap for the digital-twin evolution: `references/architecture.md`.
Skill-family / multi-agent design: `references/agent-design.md`. Prompt library: `references/prompts.md`.

## When to use

- A 3D scene that changes over time (build progress, shifts, traffic, weather, day/night).
- A 3D hero for a BigViz dashboard (`templates/vue3-echarts/src/screen3d`), with alarms/telemetry.
- Not for: static product renders, pure 2D charts, GIS analysis (use proper GIS tools).

## Quick start

```bash
cd assets/engine
npm install
npm run dev            # http://127.0.0.1:5173/?scene=construction
npm run build          # dist/ (required by verify / record)
npm run verify         # browser QA: screenshots + simulation checks + FPS -> verify-out/
npm run validate       # static scene checks in Node (no build): -- --scene <id> | --all | --file x.json, --json, --strict
npm run record -- --tour            # storyboard -> rec-out/*.mp4 (frame-exact; see "Record")
npm test               # node --test test/
node ../../scripts/new-scene.mjs <id> "<name>"   # copy scenes/_template + register (--remove to undo)
```

URL params (`src/main.js`): `scene, day, speed, weather, hour, shot, quality (low|medium|high), fps`.
Fixing `quality` disables auto quality.

## Engine map

| Path | Role |
|---|---|
| `src/engine.js`, `src/builder.js` | Engine loop; SceneBuilder (desk, terrain, ground, roads, buckets, entities, places) |
| `src/core/` | `world.js` (entities + blackboard: vars, signals, locks), `clock.js`, `events.js`, `rng.js` |
| `src/systems/` | `roads.js` RoadGraph, `agents.js` plans, `steps-*.js` step types, `camera.js`, `director.js`, `weather.js`, `environment.js`, `perf.js`, `recorder.js`, `timeline.js` |
| `src/prefabs/` | `PREFABS` registry (`index.js`), procedural kit (`kit.js`), machines, vehicles, people, cranes, building |
| `src/render/` | `stage.js` (QUALITY tiers, composer, bloom), materials, textures, desk, tilt-shift |
| `src/scenes/` | `index.js` registry (`?scene=<id>`), `construction/` reference pack, `_template/` minimal skeleton (not registered) |
| `src/ui/` | HUD, dock (shots), panel, overlay |

Parallel work may add: a realistic render tier + glTF asset registry with procedural fallback,
traffic intersections/signals, and `src/twin/` (devices, bindings, mock telemetry, alarms,
interior floors). Read those modules before authoring against them; do not assume APIs.

## Authoring a scene

1. `node ../../scripts/new-scene.mjs <id> "<name>"` (copies `src/scenes/_template/`: road, building,
   4 agents, 2 shots, 3 devices; registers it). Grow it using `construction/` as the pattern
   (`layout.js`, `props.js`, `fleet.js`, `crew.js`, `city.js`, `work.js`, `shots.js`). Run
   `npm run validate -- --scene <id>` after every edit; fix all errors.
2. Default export fields: `meta, board, desk, clock, camera, terrain, ground, roads, places,
   props, buckets, entities, vars, progress, timeline, shots, storyboards, autoDirector, hooks, weather`.
3. Units are metres; +x east, +z south (toward the default camera), y up.
4. Roads: `roads.nodes { id: [x, z] }`, `roads.edges [[a, b, { lane, width, site, dashes, surface }]]`.
   Give every vehicle entrance an off-board node (`offE`, `offW`) and use `hide/teleport/show/drive`.
5. Entities: `{ id, prefab, name, x, z, ry, params, info, life: { windows, enter, exit }, drive, agent }`.
   `prefab` must exist in `PREFABS` (`src/prefabs/index.js`) or be added via `registerPrefab()`.
6. Agents: `agent.plans [{ id, when, spawn, steps, loop, interruptible, stagger }]`.
   `when`: `day, hour, weather, notWeather, phase, var, signal, test`.
   Steps (`systems/steps-*.js`): `walk drive reverse path face teleport wander wait anim tween crane
   ride carry tool work waitFor waitVar lock unlock set add signal clear emit fx log say show hide call`,
   plus `repeat` / `choose`. Coordinate agents with `lock/signal/var`, not by tuning timings.
   Randomise (`wait: [a, b]`, `stagger`) so crews never move in sync.
7. Progress: `progress.curves { name: [[day, value], ...] }` + `progress.events` (log + shot).
8. Shots: at least 6 (verify requires `>= 6`), plus storyboards for recording.
9. Keep `hooks` (setup / jump / update) as thin glue. New logic belongs in systems or step types
   (`registerStep(name, handler, label)`), not in scene hooks.

For realistic / twin scenes follow `references/architecture.md`: JSON-first scene DSL, every
entity with `asset.ref` + `asset.fallback` (a PREFABS name), `twin.props` and anchors for IoT.

## Verify (always, before claiming done)

```bash
npm run build
node ../../scripts/verify.mjs --scene <id> [--quality high] [--quick] [--headed] [--no-gpu] [--out verify-out]
```

It boots the built `dist/` in Playwright, screenshots HUD, every dock shot, key days, night,
rain/snow/fog, runs deterministic stepping (rAF paused) and samples FPS. Read the report:
- every check `PASS`; look at the PNGs yourself (scale, floating objects, clipping, labels);
- `renderer` field: FPS on SwiftShader / software GL is not a performance result, say so.

Automation API `window.__diorama`: `shots() shot(id, blend) free() day(d) hour(h) speed(s)
weather(w) quality(q) ui(on) storyboards() play(id, record) playing() lastRecording() stats()
entities(tag) pauseLoop() resumeLoop() step(dt, n)`. Use `pauseLoop` + `step` for
frame-exact captures and assertions.

`validate-scene.mjs` checks (static, Node + DOM stub): required fields, unique ids (entities,
shots, storyboards, plans, devices, zones), shot / storyboard / autoDirector / progress-event
refs, step types against the live registry (incl. `registerStep` from the pack), prefab / prop
keys, place and road-node refs, road graph + signals (node exists, >= 3 edges), curves sorted,
twin `attachTo` resolved against entities, rig parts (prefabs built in Node), building
floors / rooms and zones, thresholds `min <= alarmLow < warnLow < warn < alarm <= max`.

## Record

```bash
node ../../scripts/record.mjs --tour [promo60] | --shot <id>  [--seconds 10] [--fps 30]
     [--size 1920x1080] [--style realistic|diorama] [--day 8.4 --hour 15 --weather rain]
     [--out rec-out] [--frames] [--dev --port 5183 | --dist <dir>] [--seed 1]
```

Pauses rAF, seeds `Math.random`, virtualises `performance.now`, then `step(1/fps)` + screenshot
per frame: same args + same build = identical frames, independent of machine speed (~0.5 s
per 1080p frame). ffmpeg on PATH -> H.264 mp4; otherwise PNG sequence (+ WebM if Playwright's
ffmpeg is installed). Uses `dist/` when present, else the Vite dev server (no HMR).

## Realism: honest rules

- Procedural box prefabs cannot look photoreal. For the realistic tier use real glTF/GLB assets
  (bought, scanned, or AI-generated then cleaned), normalised to metres, Y-up, base-centre pivot,
  rig nodes named for the animators; keep the procedural prefab as `fallback`.
- Realistic mode means no desk, no tilt-shift, HDRI lighting, ACES, proper shadows.
- Budget for integrated GPUs (1080p, 30 fps): about 1.5 M visible triangles, 300 draw calls,
  384 MB textures (KTX2). Instance anything repeated 8+ times. Full table in architecture.md §9.
- Tall lattice / articulated machines (tower crane, pump boom, excavator arm) from image-to-3D
  are reference or far-LOD only. Prompts and negatives: `references/prompts.md` §B.

## IoT / twin (when `src/twin/` exists)

Devices attach to any entity via `attachTo { entity, anchor }`; bindings map
device point -> entity prop -> visual state (fixed effect vocabulary, whitelisted expressions,
never `eval`). Browser adapters are read-only; credentials come from env or backend tokens,
never from scene files. Examples: architecture.md §5.

## Workflow for a new request

1. Brief: fill the template in `references/prompts.md` §A (concrete numbers only); confirm
   render tier, target hardware, asset sources and whether real data is connected.
2. Layout -> screenshot top view -> user confirms.
3. Assets (parallel) and simulation.
4. IoT bindings with a mock script covering every alarm rule.
5. QA: validate, build, verify, record; show screenshots as evidence.

Multi-agent split and BigViz integration (`TwinHero.vue` beside `CityHero.vue`): `references/agent-design.md`.

## Pitfalls

- `verify` needs `dist/`; rebuild after every change.
- `validate` is static: it cannot see runtime-only problems (agents stuck, overlaps); `verify` can.
- Timeline jumps call `hooks.jump` and re-seat agents; reset any blackboard vars there.
- Do not hard-code credentials, real intranet URLs or personal data in scenes.

## Credits

The scene-building method draws on the `living-diorama` skill in
[joonsp/threejs-skills](https://github.com/joonsp/threejs-skills) (MIT). This engine was written
separately for BigViz scenes and digital twins.
