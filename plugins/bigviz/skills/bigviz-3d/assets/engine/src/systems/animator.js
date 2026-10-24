// AnimatorSystem: per-frame rig update for visible entities, dispatched by prefab animator.
// Animation never lives in prefabs and never decides behaviour; it only reads agent state.

import { animateHuman } from './animate-people.js'
import { animateVehicle, animateTowerCrane, animateHoist } from './animate-machines.js'

const ANIMATORS = {
  human: (e, dt, t, env) => animateHuman(e, dt, t, env),
  vehicle: (e, dt, t, env, fx) => animateVehicle(e, dt, t, env, fx),
  towerCrane: (e, dt, t, env) => animateTowerCrane(e, dt, t, env),
  hoist: (e) => animateHoist(e)
}

export function registerAnimator(name, fn) {
  ANIMATORS[name] = fn
}

export class AnimatorSystem {
  constructor(fx) {
    this.fx = fx
    this.items = []
    this.time = 0
  }

  track(e) {
    if (e.animator && ANIMATORS[e.animator]) this.items.push(e)
  }

  update(dt, env) {
    this.time += dt
    for (const e of this.items) {
      if (!e.object3d.visible || !e.agent) continue
      ANIMATORS[e.animator](e, dt, this.time, env, this.fx)
    }
  }
}
