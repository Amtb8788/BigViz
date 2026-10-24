// Static checks for a scene pack (the object a scenes/<id>/index.js exports, or a parsed
// scene.json). Pure: everything engine-specific comes in through `env` (registries loaded
// by validate-scene.mjs). Returns { errors, warnings, info, stats }.

const SHOT_TYPES = ['static', 'orbit', 'follow', 'dolly', 'crane', 'ride', 'top', 'street', 'walk']
const STYLES = ['realistic', 'diorama']
const CONTROL = ['repeat', 'choose', 'steps', 'label']
const isNum = (v) => typeof v === 'number' && Number.isFinite(v)
const isVec = (v, n = 3) => Array.isArray(v) && v.length >= n && v.slice(0, n).every(isNum)
const isRange = (v) => Array.isArray(v) && v.length === 2 && v.every((x) => isNum(x) || x === Infinity)

/** collect every string id a scene function source mentions via signal('x') / take('x') */
function fnSignals(scene) {
  const out = new Set()
  const seen = new Set()
  const visit = (v, depth) => {
    if (v == null || depth > 12) return
    if (typeof v === 'function') {
      for (const m of String(v).matchAll(/\.(?:signal)\(\s*['"`]([^'"`]+)['"`]/g)) out.add(m[1])
      return
    }
    if (typeof v !== 'object' || seen.has(v) || v.isObject3D || v.isBox3) return
    seen.add(v)
    for (const x of Array.isArray(v) ? v : Object.values(v)) visit(x, depth + 1)
  }
  visit(scene, 0)
  return out
}

export function checkScene(scene, env, { id = scene?.meta?.id || '?' } = {}) {
  const errors = []
  const warnings = []
  const info = []
  const err = (where, msg) => errors.push({ where, msg })
  const warn = (where, msg) => warnings.push({ where, msg })
  const note = (where, msg) => info.push({ where, msg })
  const ctx = { scene, env, err, warn, note, ids: new Set(), places: new Set(Object.keys(scene?.places || {})), nodes: new Set(), rigCache: new Map(), stepUse: {} }

  if (!scene || typeof scene !== 'object') {
    err('scene', 'scene pack did not export an object (export default { meta, board, ... })')
    return { id, errors, warnings, info, stats: {} }
  }
  structure(ctx)
  roads(ctx)
  entities(ctx)
  shots(ctx)
  agents(ctx)
  progress(ctx)
  twin(ctx)
  const s = scene
  const stats = {
    entities: (s.entities || []).length,
    agents: (s.entities || []).filter((e) => e.agent).length,
    shots: (s.shots || []).length,
    storyboards: (s.storyboards || []).length,
    roadNodes: Object.keys(s.roads?.nodes || {}).length,
    roadEdges: (s.roads?.edges || []).length,
    signals: (s.roads?.signals || []).length,
    devices: (s.twin?.devices || []).length,
    steps: ctx.stepUse
  }
  return { id, errors, warnings, info, stats }
}
// ---------------------------------------------------------------- top level
function structure({ scene: s, err, warn }) {
  if (!s.meta || typeof s.meta !== 'object') err('meta', 'missing meta { id, title }')
  else {
    if (!s.meta.id) err('meta.id', 'missing scene id')
    if (!s.meta.title) warn('meta.title', 'missing title (HUD shows it)')
    if (s.meta.seed != null && !isNum(s.meta.seed)) err('meta.seed', 'seed must be a number')
  }
  if (!s.board || !(s.board.w > 0) || !(s.board.d > 0)) err('board', 'board { w, d } (metres, > 0) is required')
  const c = s.clock
  if (!c) err('clock', 'missing clock { dayStart, dayEnd, secondsPerDay }')
  else {
    for (const k of ['dayStart', 'dayEnd', 'secondsPerDay']) if (!isNum(c[k])) err(`clock.${k}`, 'must be a number')
    if (isNum(c.dayStart) && isNum(c.dayEnd) && c.dayEnd <= c.dayStart) err('clock', `dayEnd (${c.dayEnd}) must be > dayStart (${c.dayStart})`)
    if (c.secondsPerDay != null && !(c.secondsPerDay > 0)) err('clock.secondsPerDay', 'must be > 0')
    if (c.daylight != null && !(c.daylight > 0 && c.daylight < 1)) err('clock.daylight', 'must be in (0, 1)')
    if (isNum(c.startDay) && isNum(c.dayStart) && (c.startDay < c.dayStart || c.startDay > c.dayEnd + 1)) warn('clock.startDay', `startDay ${c.startDay} outside [${c.dayStart}, ${c.dayEnd}]`)
  }
  if (!Array.isArray(s.entities)) err('entities', 'entities[] is required (may be empty)')
  if (!Array.isArray(s.shots) || !s.shots.length) err('shots', 'at least one shot is required')
  if (s.style != null && !STYLES.includes(s.style)) err('style', `unknown style "${s.style}" (${STYLES.join(' | ')})`)
  for (const k of ['ground', 'props', 'storyboards']) if (s[k] != null && !Array.isArray(s[k])) err(k, 'must be an array')
  for (const k of ['places', 'vars', 'buckets']) if (s[k] != null && (typeof s[k] !== 'object' || Array.isArray(s[k]))) err(k, 'must be an object map')
  if (s.hooks) for (const [k, f] of Object.entries(s.hooks)) if (typeof f !== 'function') err(`hooks.${k}`, 'hooks must be functions')
}

// ---------------------------------------------------------------- roads + signals
function roads(ctx) {
  const { scene: s, env, err, warn, nodes } = ctx
  const R = s.roads
  if (!R) return
  if (!R.nodes || typeof R.nodes !== 'object') return err('roads.nodes', 'roads need nodes { id: [x, z] }')
  for (const [id, p] of Object.entries(R.nodes)) {
    if (!isVec(p, 2)) err(`roads.nodes.${id}`, 'node must be [x, z]')
    nodes.add(id)
  }
  const deg = new Map([...nodes].map((n) => [n, 0]))
  const seen = new Set()
  let bad = false
  const parent = new Map([...nodes].map((n) => [n, n]))
  const root = (n) => (parent.get(n) === n ? n : root(parent.get(n)))
  ;(R.edges || []).forEach((e, i) => {
    if (!Array.isArray(e) || e.length < 2) return err(`roads.edges[${i}]`, 'edge must be [a, b, opts?]')
    const [a, b, o = {}] = e
    for (const n of [a, b]) if (!nodes.has(n)) { bad = true; err(`roads.edges[${i}]`, `unknown node "${n}"`) }
    if (a === b) err(`roads.edges[${i}]`, `self-loop on "${a}"`)
    const key = [a, b].sort().join('|')
    if (seen.has(key)) warn(`roads.edges[${i}]`, `duplicate edge ${a}-${b}`)
    seen.add(key)
    if (o.lanes != null && !(o.lanes >= 1)) err(`roads.edges[${i}]`, 'lanes must be >= 1')
    if (nodes.has(a) && nodes.has(b)) {
      deg.set(a, deg.get(a) + 1)
      deg.set(b, deg.get(b) + 1)
      parent.set(root(a), root(b))
      const [ax, az] = R.nodes[a]
      const [bx, bz] = R.nodes[b]
      if (Math.hypot(ax - bx, az - bz) < 0.5) warn(`roads.edges[${i}]`, `${a}-${b} is shorter than 0.5 m`)
    }
  })
  for (const [n, d] of deg) if (d === 0) warn(`roads.nodes.${n}`, 'node has no edges')
  const comps = new Set([...nodes].filter((n) => deg.get(n) > 0).map(root))
  if (comps.size > 1) warn('roads', `road graph has ${comps.size} disconnected parts (drive between them fails)`)
  let graph = null
  if (env.RoadGraph && !bad) {
    try { graph = new env.RoadGraph(R) } catch (e) { err('roads', `RoadGraph: ${e.message}`) }
  }
  ctx.graph = graph
  ctx.signalIds = []
  const sig = R.signals || []
  if (!Array.isArray(sig)) return err('roads.signals', 'must be an array')
  sig.forEach((g, i) => {
    const where = `roads.signals[${i}]`
    if (!g || !g.node) return err(where, 'signal needs { node }')
    if (!nodes.has(g.node)) return err(where, `signal references unknown road node "${g.node}"`)
    const d = deg.get(g.node)
    if (d < 3) warn(where, `node "${g.node}" has ${d} edge(s); a signalised junction needs >= 3`)
    const sid = g.id || `signal-${g.node}`
    if (ctx.signalIds.includes(sid)) err(where, `duplicate signal id "${sid}"`)
    ctx.signalIds.push(sid)
    if (sig.filter((x) => x?.node === g.node).length > 1) warn(where, `more than one signal on node "${g.node}"`)
    if (g.offset != null && !isNum(g.offset)) err(where, 'offset must be a number (sim seconds)')
  })
  const T = { ...(R.signalTiming || {}) }
  for (const [k, v] of Object.entries(T)) if (!isNum(v) || v < 0) err(`roads.signalTiming.${k}`, 'must be a number >= 0')
  if (isNum(T.green) && T.green <= 0) err('roads.signalTiming.green', 'green must be > 0')
  if (graph && sig.length && env.TrafficSystem) {
    try { ctx.traffic = new env.TrafficSystem(graph, { signals: sig, timing: R.signalTiming, geometry: R.junction }) } catch (e) { err('roads.signals', `TrafficSystem: ${e.message}`) }
  }
}
// ---------------------------------------------------------------- entities, places, props
function entities(ctx) {
  const { scene: s, env, err, warn, ids } = ctx
  const known = (k) => k in env.PREFABS || k in env.PROPS
  const bw = (s.board?.w || 0) / 2 + 30
  const bd = (s.board?.d || 0) / 2 + 30
  for (const sid of ctx.signalIds || []) ids.add(sid)
  ;(s.entities || []).forEach((e, i) => {
    const where = `entities[${e?.id ?? i}]`
    if (!e || typeof e !== 'object') return err(`entities[${i}]`, 'entity must be an object')
    if (!e.id) err(where, 'entity needs an id')
    else if (ids.has(e.id)) err(where, `duplicate id "${e.id}"`)
    else ids.add(e.id)
    if (!e.prefab) err(where, 'entity needs a prefab')
    else if (!known(e.prefab)) err(where, `unknown prefab "${e.prefab}" (not in PREFABS / PROPS; registerPrefab() it in the pack)`)
    for (const k of ['x', 'z', 'y', 'ry']) if (e[k] != null && !isNum(e[k])) err(where, `${k} must be a number`)
    if (s.board && (Math.abs(e.x || 0) > bw || Math.abs(e.z || 0) > bd)) warn(where, `position (${e.x}, ${e.z}) is far outside the board`)
    const w = e.life?.windows
    if (w != null) {
      if (!Array.isArray(w) || !w.every(isRange)) err(where, 'life.windows must be [[fromDay, toDay], ...]')
      else w.forEach(([a, b]) => b <= a && err(where, `life window [${a}, ${b}] is empty`))
    }
    if (e.agent && !Array.isArray(e.agent.plans)) err(where, 'agent needs plans[]')
    if (e.agent && env.PREFABS[e.prefab] && !['walker', 'vehicle', 'machine'].includes(env.PREFABS[e.prefab].kind)) warn(where, `prefab "${e.prefab}" (kind ${env.PREFABS[e.prefab].kind}) has no animator for agents`)
  })
  for (const [k, p] of Object.entries(s.places || {})) {
    if (ctx.nodes.has(k)) warn(`places.${k}`, 'place id shadows a road node of the same name')
    if (typeof p === 'string') { if (!ctx.places.has(p) && !ctx.nodes.has(p)) err(`places.${k}`, `alias to unknown place "${p}"`); continue }
    if (!p || !isNum(p.x) || !isNum(p.z)) err(`places.${k}`, 'place needs numeric { x, z }')
  }
  ;(s.props || []).forEach((p, i) => {
    const where = `props[${i}]`
    if (!p?.type) return err(where, 'prop needs a type')
    if (!known(p.type)) err(where, `unknown prop / prefab "${p.type}"`)
    if (p.line && !(isVec(p.line.from, 2) && isVec(p.line.to, 2) && p.line.n >= 1)) err(where, 'line needs { from: [x, z], to: [x, z], n >= 1 }')
    if (p.at && !(Array.isArray(p.at) && p.at.every((a) => isVec(a, 2)))) err(where, 'at must be [[x, z, ry?], ...]')
    if (p.bucket && p.bucket !== 'static' && s.buckets && !(p.bucket in s.buckets)) warn(where, `bucket "${p.bucket}" has no entry in scene.buckets (always visible)`)
  })
  ;(s.ground || []).forEach((g, i) => {
    if (!(g?.w > 0) || !(g?.d > 0)) err(`ground[${i}]`, 'ground layer needs w, d > 0')
  })
}

/** Build a prefab once (DOM stub) to learn its rig parts; null when it cannot be built */
function rigOf(ctx, ent) {
  if (ctx.rigCache.has(ent.id)) return ctx.rigCache.get(ent.id)
  let rig = null
  try {
    const made = ctx.env.makePrefab(ent.prefab, ent.params || {})
    rig = made.rig || {}
  } catch (e) {
    ctx.note(`entities[${ent.id}]`, `prefab "${ent.prefab}" could not be built in Node (${e.message.split('\n')[0]}); rig parts not checked`)
  }
  ctx.rigCache.set(ent.id, rig)
  return rig
}
const entityById = (s, id) => (s.entities || []).find((e) => e?.id === id)
// ---------------------------------------------------------------- shots, storyboards, director
const SHOT_NEEDS = {
  static: (s) => isVec(s.pos) && isVec(s.look) || 'needs pos [x,y,z] and look [x,y,z]',
  orbit: (s) => isNum(s.radius) && isNum(s.height) && (s.center == null || isVec(s.center)) || 'needs radius, height (center [x,y,z] optional)',
  follow: (s) => !!s.entity || 'needs entity',
  dolly: (s) => Array.isArray(s.path) && s.path.length >= 2 && s.path.every((p) => isVec(p)) && Array.isArray(s.look) && s.look.length >= 1 && s.dur > 0 || 'needs path [[x,y,z] x2+], look [[x,y,z]], dur > 0',
  crane: (s) => !!s.entity || 'needs entity (a towerCrane)',
  ride: (s) => !!s.entity || 'needs entity (and optional part)',
  top: () => true,
  street: (s) => (Array.isArray(s.path) && s.path.length >= 2 && s.path.every((p) => isVec(p))) || (isVec(s.pos) && isVec(s.look)) || 'needs path [[x,y,z] x2+] or pos + look',
  walk: () => true
}

function shots(ctx) {
  const { scene: s, err, warn } = ctx
  const ids = new Set()
  ;(s.shots || []).forEach((sh, i) => {
    const where = `shots[${sh?.id ?? i}]`
    if (!sh?.id) return err(`shots[${i}]`, 'shot needs an id')
    if (ids.has(sh.id)) err(where, `duplicate shot id "${sh.id}"`)
    ids.add(sh.id)
    const type = sh.type || 'static'
    if (!SHOT_TYPES.includes(type)) return err(where, `unknown shot type "${type}" (${SHOT_TYPES.join(', ')})`)
    const ok = SHOT_NEEDS[type](sh)
    if (ok !== true) err(where, `${type} shot ${ok}`)
    if (sh.fov != null && !(sh.fov > 5 && sh.fov < 120)) warn(where, `fov ${sh.fov} looks wrong (degrees, 5..120)`)
    if (sh.entity) {
      const ent = entityById(s, sh.entity)
      if (!ent) return err(where, `entity "${sh.entity}" does not exist`)
      if (type === 'crane' && ent.prefab !== 'towerCrane') warn(where, `crane shot on "${ent.prefab}" (expects rig.slew + rig.hook)`)
      if (type === 'crane' || (type === 'ride' && sh.part)) {
        const rig = rigOf(ctx, ent)
        const need = type === 'crane' ? ['slew', 'hook'] : [sh.part]
        if (rig) for (const p of need) if (!rig[p]?.isObject3D) err(where, `entity "${ent.id}" (${ent.prefab}) has no rig part "${p}"`)
      }
    }
  })
  ctx.shotIds = ids
  if (s.shots?.length && s.shots.length < 6) warn('shots', `${s.shots.length} shot(s); verify.mjs expects >= 6`)
  if (s.camera?.home && !ids.has(s.camera.home)) err('camera.home', `unknown shot "${s.camera.home}"`)
  const boards = new Set()
  ;(s.storyboards || []).forEach((b, i) => {
    const where = `storyboards[${b?.id ?? i}]`
    if (!b?.id) return err(`storyboards[${i}]`, 'storyboard needs an id')
    if (boards.has(b.id)) err(where, `duplicate storyboard id "${b.id}"`)
    boards.add(b.id)
    if (!Array.isArray(b.segments) || !b.segments.length) return err(where, 'needs segments[]')
    b.segments.forEach((g, j) => {
      const w = `${where}.segments[${j}]`
      if (!(g?.t > 0)) err(w, 'segment needs t > 0 (seconds)')
      if (typeof g?.shot === 'string' && !ids.has(g.shot)) err(w, `unknown shot "${g.shot}"`)
      if (g?.weather && !(g.weather in ctx.env.WEATHERS)) err(w, `unknown weather "${g.weather}"`)
      if (g?.day != null && s.clock && (g.day < s.clock.dayStart - 1 || g.day > s.clock.dayEnd + 1)) warn(w, `day ${g.day} outside the clock range`)
    })
    if (!b.segments[0]?.shot) warn(`${where}.segments[0]`, 'first segment has no shot (keeps whatever camera was active)')
  })
  for (const [ev, r] of Object.entries(s.autoDirector || {})) if (typeof r === 'string' && !ids.has(r)) err(`autoDirector.${ev}`, `unknown shot "${r}"`)
  if (s.weather && !(s.weather in ctx.env.WEATHERS)) err('weather', `unknown weather "${s.weather}" (${Object.keys(ctx.env.WEATHERS).join(', ')})`)
}
// ---------------------------------------------------------------- agents (plans + steps)
/** string place refs resolve against places, road nodes, then entity ids (builder.resolve) */
function placeRef(ctx, where, spec, { node = false } = {}) {
  if (spec == null || typeof spec === 'function') return
  if (typeof spec === 'string') {
    if (node) { if (!ctx.nodes.has(spec)) ctx.err(where, `"${spec}" is not a road node`) }
    else if (!ctx.places.has(spec) && !ctx.nodes.has(spec) && !ctx.ids.has(spec)) ctx.err(where, `unknown place "${spec}" (not a place, road node or entity)`)
    return
  }
  if (Array.isArray(spec)) { if (!isVec(spec, 2)) ctx.err(where, 'point must be [x, z] or [x, z, y]'); return }
  if (typeof spec !== 'object') return ctx.err(where, `bad place spec ${JSON.stringify(spec)}`)
  if (spec.entity && !ctx.ids.has(spec.entity)) ctx.err(where, `unknown entity "${spec.entity}"`)
  if (typeof spec.area === 'string' && !ctx.places.has(spec.area)) ctx.err(where, `unknown area place "${spec.area}"`)
  if (spec.place != null) placeRef(ctx, where, spec.place)
}

function agents(ctx) {
  const { scene: s, env, err, warn, note } = ctx
  const produced = fnSignals(s)
  const waited = new Map()
  const locks = new Map()
  const unlocks = new Set()
  const weathers = env.WEATHERS
  for (const e of s.entities || []) {
    if (!e?.agent?.plans) continue
    const walker = env.PREFABS[e.prefab]?.kind === 'walker'
    const planIds = new Set()
    if (!e.agent.plans.length) warn(`entities[${e.id}]`, 'agent has no plans (stands still)')
    e.agent.plans.forEach((p, i) => {
      const where = `entities[${e.id}].plans[${p?.id ?? i}]`
      if (!p || typeof p !== 'object') return err(where, 'plan must be an object')
      if (p.id && planIds.has(p.id)) warn(where, `duplicate plan id "${p.id}"`)
      planIds.add(p.id)
      const w = p.when || {}
      if (w.day != null && !isRange(w.day)) err(where, 'when.day must be [fromDay, toDay]')
      if (w.hour != null && !(isRange(w.hour) && w.hour.every((h) => h >= 0 && h <= 24))) err(where, 'when.hour must be [h0, h1] within 0..24')
      for (const k of ['weather', 'notWeather']) for (const x of [].concat(w[k] || [])) if (!(x in weathers)) err(where, `when.${k}: unknown weather "${x}"`)
      if (typeof w.signal === 'string') waited.set(w.signal, where)
      if (p.spawn) placeRef(ctx, `${where}.spawn`, p.spawn)
      if (!Array.isArray(p.steps) || !p.steps.length) return err(where, 'plan needs steps[]')
      walk(p.steps, where)
    })
    function walk(steps, where) {
      if (!Array.isArray(steps)) return err(where, 'steps must be an array')
      steps.forEach((st, j) => {
        const w = `${where}.steps[${j}]`
        if (!st || typeof st !== 'object') return err(w, 'step must be an object')
        if (st.choose) {
          if (!Array.isArray(st.choose) || !st.choose.every(Array.isArray)) return err(w, 'choose must be [[steps], [steps], ...]')
          return st.choose.forEach((b, k) => walk(b, `${w}.choose[${k}]`))
        }
        if (st.repeat != null || (st.steps && !st.do)) {
          if (st.repeat != null && !(isNum(st.repeat) || isRange(st.repeat))) err(w, 'repeat must be n or [min, max]')
          return walk(st.steps, `${w}.repeat`)
        }
        if (!st.do) return err(w, `step has no "do" (keys: ${Object.keys(st).filter((k) => !CONTROL.includes(k)).join(', ')})`)
        ctx.stepUse[st.do] = (ctx.stepUse[st.do] || 0) + 1
        if (!(st.do in env.STEPS)) return err(w, `unknown step type "${st.do}" (registered: ${Object.keys(env.STEPS).sort().join(', ')})`)
        refs(st, w)
      })
    }
    function refs(st, w) {
      const d = st.do
      if (d === 'drive') {
        placeRef(ctx, `${w}.to`, st.to, { node: true })
        for (const t of [].concat(typeof st.through === 'function' ? [] : st.through || [])) placeRef(ctx, `${w}.through`, t, { node: true })
        for (const v of st.via || []) placeRef(ctx, `${w}.via`, v)
        for (const v of st.then || []) placeRef(ctx, `${w}.then`, v)
        if (!ctx.nodes.size) err(w, 'drive needs scene.roads')
      } else if (d === 'roadEnter') {
        for (const a of [].concat(typeof st.at === 'function' ? [] : st.at || [])) placeRef(ctx, `${w}.at`, a, { node: true })
      } else if (d === 'walk' || d === 'path' || d === 'reverse' || d === 'face') {
        const list = (v) => (Array.isArray(v) ? v : [])
        if (d === 'path' && !Array.isArray(st.points)) err(w, 'path step needs points [[x, z], ...]')
        for (const v of [...list(st.via), ...list(st.path), ...list(st.points)]) placeRef(ctx, w, v)
        if (st.to != null) placeRef(ctx, `${w}.to`, st.to)
      } else if (d === 'anim' && walker && typeof st.anim === 'string' && env.POSE_NAMES && !env.POSE_NAMES.includes(st.anim)) {
        warn(w, `unknown pose "${st.anim}" (falls back to idle)`)
      } else if (d === 'ride' && st.hoist && !ctx.ids.has(st.hoist)) err(w, `unknown hoist entity "${st.hoist}"`)
      else if (d === 'crane') {
        if (e.prefab !== 'towerCrane') warn(w, `crane step on a "${e.prefab}" (expects a towerCrane rig)`)
        if (st.from != null) placeRef(ctx, `${w}.from`, st.from)
        if (st.to != null) placeRef(ctx, `${w}.to`, st.to)
        if (st.atPick) produced.add(st.atPick)
        if (st.atDrop) produced.add(st.atDrop)
        produced.add('crane.atPick').add('crane.atDrop')
      } else if (d === 'signal' && st.name) produced.add(st.name)
      else if (d === 'waitFor' && st.signal) waited.set(st.signal, w)
      else if (d === 'lock' && st.key) locks.set(st.key, w)
      else if (d === 'unlock' && st.key) unlocks.add(st.key)
      else if (d === 'call' && typeof st.fn !== 'function') err(w, 'call step needs fn(ctx, entity, dt, state)')
      if (st.face != null && d === 'anim') placeRef(ctx, `${w}.face`, st.face)
    }
  }
  for (const [k, w] of waited) if (!produced.has(k)) note(w, `waits for signal "${k}" that no step / hook visibly raises (ok if a step handler or hook does)`)
  for (const [k, w] of locks) if (!unlocks.has(k)) warn(w, `lock "${k}" is never unlocked`)
}
// ---------------------------------------------------------------- progress / timeline / drive curves
function curve(ctx, where, keys) {
  if (typeof keys === 'function') return
  if (!Array.isArray(keys) || !keys.length || !keys.every((k) => Array.isArray(k) && k.length >= 2 && isNum(k[0]))) return ctx.err(where, 'curve must be [[day, value], ...]')
  for (let i = 1; i < keys.length; i++) if (keys[i][0] < keys[i - 1][0]) return ctx.err(where, `keyframes not sorted by day (${keys[i - 1][0]} > ${keys[i][0]})`)
}

function progress(ctx) {
  const { scene: s, err, warn } = ctx
  for (const e of s.entities || []) for (const [k, v] of Object.entries(e?.drive || {})) curve(ctx, `entities[${e.id}].drive.${k}`, v)
  const P = s.progress
  if (P) {
    if (!P.curves || typeof P.curves !== 'object') err('progress.curves', 'progress needs curves { name: [[day, v], ...] }')
    else for (const [k, v] of Object.entries(P.curves)) curve(ctx, `progress.curves.${k}`, v)
    if (P.target) {
      const t = entityById(s, P.target)
      if (!t) err('progress.target', `unknown entity "${P.target}"`)
      else if (t.prefab === 'building') for (const k of ['found', 'floors', 'facade', 'windows']) if (!(k in (P.curves || {}))) warn('progress.curves', `building target without "${k}" curve (treated as 0)`)
    }
    for (const [k, d] of Object.entries(P.flags || {})) if (!isNum(d)) err(`progress.flags.${k}`, 'flag must be a day number')
    ;(P.events || []).forEach((ev, i) => {
      if (!isNum(ev?.day)) err(`progress.events[${i}]`, 'event needs a numeric day')
      if (ev?.shot && ctx.shotIds && !ctx.shotIds.has(ev.shot)) err(`progress.events[${i}]`, `unknown shot "${ev.shot}"`)
    })
  }
  ;(s.timeline?.keyDays || []).forEach((k, i) => { if (!isNum(k?.day)) err(`timeline.keyDays[${i}]`, 'needs a numeric day') })
}

// ---------------------------------------------------------------- digital twin
/** node ids under a building entity: parts, floors, floor sub-parts, rooms (twin/model.js) */
function buildingNodes(ctx, ent, out) {
  const rig = rigOf(ctx, ent)
  const id = ent.id
  for (const k of ['found', 'core', 'scaffold', 'net', 'roof', 'lobby', 'deck']) if (!rig || rig[k]) out.add(`${id}.${k}`)
  const N = rig?.N ?? rig?.floors?.length ?? ent.params?.floors ?? 0
  const W = rig?.W ?? ent.params?.w ?? 24
  const D = rig?.D ?? ent.params?.d ?? 14
  const core = rig?.core ? { x: rig.core.position.x, z: rig.core.position.z, w: 4.2, d: 5 } : undefined
  const plan = ctx.env.planFloor ? ctx.env.planFloor({ W, D, core }) : { rooms: [], corridor: { key: 'corridor' } }
  for (let f = 1; f <= N; f++) {
    const fid = `${id}.F${f}`
    out.add(fid)
    for (const k of ['columns', 'slab', 'facade0', 'facade1', 'facade2', 'facade3', ...plan.rooms.map((r) => r.key), plan.corridor.key]) out.add(`${fid}.${k}`)
  }
  return N
}

/** threshold order: min <= alarmLow < warnLow < warn < alarm <= max (skip missing) */
function thresholds(ctx, where, p) {
  const chain = ['min', 'alarmLow', 'warnLow', 'warn', 'alarm', 'max'].filter((k) => p[k] != null)
  for (const k of chain) if (!isNum(p[k])) return ctx.err(where, `${k} must be a number`)
  for (let i = 1; i < chain.length; i++) {
    const a = chain[i - 1]
    const b = chain[i]
    const soft = a === 'min' || b === 'max'
    if (soft ? p[a] > p[b] : p[a] >= p[b]) ctx.err(where, `threshold order: ${a} (${p[a]}) must be ${soft ? '<=' : '<'} ${b} (${p[b]})`)
  }
  if (p.hyst != null && !(p.hyst >= 0)) ctx.err(where, 'hyst must be >= 0')
  if (p.states) for (const [v, l] of Object.entries(p.states)) if (ctx.env.LEVELS && !ctx.env.LEVELS.includes(l)) ctx.err(where, `state "${v}" maps to unknown level "${l}" (${ctx.env.LEVELS.join(', ')})`)
  const base = p.mock?.base
  if (isNum(base) && ((p.min != null && base < p.min) || (p.max != null && base > p.max))) ctx.warn(where, `mock.base ${base} outside [${p.min ?? '-inf'}, ${p.max ?? 'inf'}]`)
  if (isNum(base) && ((p.alarm != null && base >= p.alarm) || (p.alarmLow != null && base <= p.alarmLow))) ctx.warn(where, `mock.base ${base} is already in alarm`)
}
function twin(ctx) {
  const { scene: s, env, err, warn, note } = ctx
  const T = s.twin
  if (!T) return
  const types = { ...env.DEVICE_TYPES, ...(T.types || {}) }
  const nodes = new Set(['site', ...ctx.ids])
  for (const e of s.entities || []) if (e?.prefab === 'building') buildingNodes(ctx, e, nodes)
  const zones = new Set()
  ;(T.zones || []).forEach((z, i) => {
    if (!z?.id) return err(`twin.zones[${i}]`, 'zone needs an id')
    if (zones.has(z.id) || ctx.ids.has(z.id)) err(`twin.zones[${z.id}]`, `duplicate node id "${z.id}"`)
    zones.add(z.id)
    nodes.add(z.id)
    if (!isNum(z.x) || !isNum(z.z)) err(`twin.zones[${z.id}]`, 'zone needs numeric x, z')
  })
  if (T.adapter?.type && !['mock', 'ws', 'mqtt', 'none'].includes(T.adapter.type)) warn('twin.adapter', `adapter type "${T.adapter.type}" (mock | ws | mqtt)`)
  const resolve = (ref) => {
    if (nodes.has(ref)) return true
    if (ref.includes('/')) return resolve(ref.split('/').filter((x, i) => !(i === 0 && x === 'site')).join('.'))
    const host = (s.entities || []).filter((e) => e?.id && ref.startsWith(`${e.id}.`)).sort((a, b) => b.id.length - a.id.length)[0]
    if (!host) return 'no such entity / zone / building part'
    if (host.prefab === 'building') return `not a part of building "${host.id}" (parts: found, core, deck, F1..F${ctx.rigCache.get(host.id)?.N ?? host.params?.floors ?? '?'}, F<n>.<room>)`
    const rig = rigOf(ctx, host)
    if (!rig) return null
    const part = ref.slice(host.id.length + 1)
    if (rig[part]?.isObject3D && rig[part] !== rig.root) return true
    return `"${host.id}" (${host.prefab}) has no rig part "${part}" (has: ${Object.keys(rig).filter((k) => rig[k]?.isObject3D && k !== 'root').join(', ') || 'none'})`
  }
  const ids = new Set()
  const nSig = (s.roads?.signals || []).length
  ;(T.devices || []).forEach((d, i) => {
    const where = `twin.devices[${d?.id ?? i}]`
    if (!d?.id) return err(`twin.devices[${i}]`, 'device needs an id')
    if (ids.has(d.id)) err(where, `duplicate device id "${d.id}"`)
    ids.add(d.id)
    const type = types[d.type]
    if (!type) return err(where, `unknown device type "${d.type}" (${Object.keys(types).join(', ')})`)
    if (d.offset != null && !isVec(d.offset)) err(where, 'offset must be [x, y, z]')
    if (d.attachTo == null) warn(where, 'no attachTo (marker sits at the origin)')
    else {
      const r = resolve(String(d.attachTo))
      if (r === null) note(where, `attachTo "${d.attachTo}" not verified (prefab not buildable in Node)`)
      else if (r !== true) (d.meta?.signal != null ? warn : err)(where, `attachTo "${d.attachTo}": ${r}`)
    }
    const sg = d.meta?.signal
    if (sg != null) {
      if (!nSig) warn(where, 'meta.signal set but the scene has no roads.signals (falls back to mock values)')
      else if (typeof sg === 'number' && !(sg >= 0 && sg < nSig)) warn(where, `meta.signal index ${sg} out of range (0..${nSig - 1}); falls back to the nearest signal`)
      else if (typeof sg === 'string' && !(ctx.signalIds || []).includes(sg)) err(where, `meta.signal "${sg}" is not a signal id (${(ctx.signalIds || []).join(', ')})`)
    }
    const props = {}
    for (const [k, p] of Object.entries(type.props || {})) props[k] = { ...p, ...(d.props?.[k] || {}) }
    for (const [k, p] of Object.entries(d.props || {})) props[k] ??= p
    for (const [k, p] of Object.entries(props)) thresholds(ctx, `${where}.props.${k}`, p)
    if (d.visual?.prop && !(d.visual.prop in props)) err(where, `visual.prop "${d.visual.prop}" is not a prop of ${d.type} (${Object.keys(props).join(', ')})`)
  })
  for (const [k, t] of Object.entries(T.types || {})) for (const [pk, p] of Object.entries(t.props || {})) thresholds(ctx, `twin.types.${k}.${pk}`, p)
  ;(T.bindings || []).forEach((b, i) => {
    if (!b?.topic) err(`twin.bindings[${i}]`, 'binding needs a topic pattern')
    if (b?.device && !ids.has(b.device)) err(`twin.bindings[${i}]`, `unknown device "${b.device}"`)
    if (b?.map != null && typeof b.map !== 'function') err(`twin.bindings[${i}]`, 'map must be a function')
  })
}
