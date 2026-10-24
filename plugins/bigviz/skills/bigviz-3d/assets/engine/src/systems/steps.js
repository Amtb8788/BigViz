// Step registry. A step handler is { start?(ctx, entity, step, state) -> true if instant,
// update?(ctx, entity, step, state, dt) -> true when done, cancel?(ctx, entity, step, state) }.

import { moveSteps } from './steps-move.js'
import { workSteps } from './steps-work.js'

export const STEPS = { ...moveSteps, ...workSteps }

/** Default status text shown on the info card / labels (scene can override with step.label) */
export const STEP_LABELS = {
  walk: '步行中',
  drive: '行驶中',
  reverse: '倒车中',
  path: '场内移动',
  wait: '待命',
  anim: '作业中',
  tween: '机械动作',
  crane: '吊装作业',
  ride: '乘施工电梯',
  waitFor: '等待配合',
  waitVar: '等待物料',
  wander: '巡视',
  lock: '排队等候',
  face: '调整朝向',
  work: '作业中'
}

/** Register a custom step type from a scene pack */
export function registerStep(name, handler, label) {
  STEPS[name] = handler
  if (label) STEP_LABELS[name] = label
}
