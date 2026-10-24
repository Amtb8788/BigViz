// node --test: pure style maths (no DOM / WebGL)

import test from 'node:test'
import assert from 'node:assert/strict'
import { resolveStyle, sunAngles, sunDirection, STYLES } from '../src/render/style.js'

test('style resolution: url > option > scene > diorama', () => {
  assert.equal(resolveStyle({}), 'diorama')
  assert.equal(resolveStyle({ scene: 'realistic' }), 'realistic')
  assert.equal(resolveStyle({ opt: 'diorama', scene: 'realistic' }), 'diorama')
  assert.equal(resolveStyle({ url: 'realistic', opt: 'diorama' }), 'realistic')
  assert.equal(resolveStyle({ url: 'bogus', scene: 'realistic' }), 'realistic')
  assert.ok(STYLES.realistic.sky && !STYLES.realistic.desk && STYLES.diorama.desk)
})

test('sun is up by day, down at night, highest near noon', () => {
  assert.ok(sunAngles(12.5).el > 0.9)
  assert.ok(sunAngles(9).el > 0.3)
  assert.ok(sunAngles(23).el < 0)
  assert.ok(sunAngles(2).el < 0)
  assert.ok(sunAngles(12.5).el > sunAngles(8).el)
  for (let h = 0; h < 24; h += 0.25) {
    const d = sunDirection(h)
    assert.ok(Math.abs(Math.hypot(d.x, d.y, d.z) - 1) < 1e-9, `unit at ${h}`)
  }
})

test('sun rises in the east (+x) and sets in the west (-x)', () => {
  assert.ok(sunDirection(6.5).x > 0.3)
  assert.ok(sunDirection(18.5).x < -0.3)
})
