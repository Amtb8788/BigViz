// Topic helpers shared by bindings and adapters. MQTT-style filters: `+` one level,
// `#` rest; `{name}` is a named `+` that is captured into params.

/** compile 'site/{device}/telemetry' -> { filter: 'site/+/telemetry', names: ['device'] } */
export function compileTopic(pattern) {
  const names = []
  const filter = pattern.split('/').map((s) => {
    const m = /^\{(\w+)\}$/.exec(s)
    if (m) { names.push(m[1]); return '+' }
    return s
  }).join('/')
  return { pattern, filter, names }
}

/** match a topic against a filter; returns captured `+` segments array or null */
export function matchTopic(filter, topic) {
  const f = filter.split('/')
  const t = topic.split('/')
  const caps = []
  for (let i = 0; i < f.length; i++) {
    if (f[i] === '#') return caps
    if (i >= t.length) return null
    if (f[i] === '+') caps.push(t[i])
    else if (f[i] !== t[i]) return null
  }
  return f.length === t.length ? caps : null
}

/** match a compiled pattern; returns { name: value } or null */
export function matchPattern(compiled, topic) {
  const caps = matchTopic(compiled.filter, topic)
  if (!caps) return null
  const params = {}
  compiled.names.forEach((n, i) => (params[n] = caps[i]))
  return params
}

/** in-process pub/sub used by every adapter for local fan-out */
export class TopicRouter {
  constructor() {
    this.subs = []
  }

  add(filter, cb) {
    const s = { filter, cb }
    this.subs.push(s)
    return () => (this.subs = this.subs.filter((x) => x !== s))
  }

  dispatch(topic, payload) {
    let n = 0
    for (const s of this.subs) if (matchTopic(s.filter, topic)) { s.cb(payload, topic); n++ }
    return n
  }

  filters() {
    return [...new Set(this.subs.map((s) => s.filter))]
  }
}
