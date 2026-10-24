// Bridge pack - construction schedule as pure functions of the day (scrub-safe):
// wind (Beaufort >= 6 halts traveller / launcher / crane work), working time after halts,
// balanced-cantilever cycle state per carriageway, form-traveller poses, beam erection cycle.

import { TIPS, SEGS } from './layout.js'

export const SPD = 240 // seconds per sim day (clock.secondsPerDay)
export const DAY_END = 27
export const HALT_WIND = 10.8 // m/s, Beaufort 6 (13.8 = 7, alarm)
export const UP_SHIFT = 12 // upstream carriageway runs the same programme 12 days later
const sm = (a, b, v) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t) }
const lin = (a, b, v) => Math.min(1, Math.max(0, (v - a) / (b - a)))

/** scripted gusts: base diurnal wind + two fronts (days 9.6-10.1 and 19.3-19.8) */
export function windAt(day) {
  const h = (day % 1) * 24
  const base = 4.2 + 2.4 * Math.sin(((h - 9) / 24) * Math.PI * 2) + 0.9 * Math.sin(day * 7.3) + 0.5 * Math.sin(day * 23.1)
  const front = (a, b, peak) => sm(a - 0.15, a, day) * (1 - sm(b, b + 0.15, day)) * peak
  return Math.max(0.5, base + front(9.6, 10.1, 9.5) + front(19.3, 19.8, 11))
}

// cumulative halted time (days) sampled every 0.005 d
const STEP = 0.005
const HALT = [0]
for (let d = 1; d <= DAY_END + 1; d += STEP) HALT.push(HALT[HALT.length - 1] + (windAt(d) >= HALT_WIND ? STEP : 0))
/** working time: day minus the halted time before it (+ extra from a manual wind override) */
export function workDay(day, extra = 0) {
  const k = Math.max(0, (day - 1) / STEP)
  const i = Math.min(HALT.length - 2, Math.floor(k))
  return day - (HALT[i] + (HALT[i + 1] - HALT[i]) * (k - i)) - extra
}
export const halted = (day, override = null) => (override ?? windAt(day)) >= HALT_WIND

// ---------------------------------------------------------------- balanced cantilever
export const CYC = 0.5
const PH = { move: 0.08, form: 0.18, rebar: 0.32, pour: 0.62, cure: 0.88 }
export const T0 = { bracket: 1.0, pour0: 1.6, cure0: 2.2, assemble: 2.4, cycles: 3.0 }
const N = SEGS.length
export const cyclesEnd = T0.cycles + N * CYC
export const PIER_LAG = { W: 0, E: 0.17 }
const TL = { cipFrom: 7.5, cipTo: 8.3, sideMove: 0.2, sidePour: 0.6, mainMove: 1.2, mainPour: 1.6, finishFrom: 3.2, finishTo: 7 }

/** carriageway state for pier 'W' | 'E' at working time t (programme time, 0 shift applied) */
export function pierState(t, pier, up = false) {
  const lag = PIER_LAG[pier]
  const u = t - lag - (up ? UP_SHIFT : 0)
  const s = { lifts: 99, brackets: false, pairs: -1, wet: 0, cip: false, cipWet: 0, sideClosure: false, sideWet: 0, mainClosure: false, mainWet: 0, climbing: false, pour: false, phase: 'idle' }
  if (up) {
    // upstream walls climb 1 lift / day from day 1 (climbing formwork), done by day 11
    const k = t - 1
    s.lifts = Math.max(1, Math.min(10, 1 + Math.floor(k)))
    s.climbing = k < 10
    if (s.climbing) s.phase = 'climb'
  }
  if (u >= T0.bracket && u < T0.cycles + 1) s.brackets = true
  if (u >= T0.pour0) { s.pairs = 0; s.phase = '0#' }
  if (u >= T0.pour0 && u < T0.cure0) { s.wet = 1; s.pour = u < T0.pour0 + 0.35 }
  if (u >= T0.cycles) {
    const c = Math.min(N, Math.floor((u - T0.cycles) / CYC) + 1)
    const f = c >= N && u >= cyclesEnd ? 1 : ((u - T0.cycles) / CYC) % 1
    s.cycle = c
    s.cf = f
    s.pairs = f >= PH.pour ? c : f >= PH.rebar ? c : c - 1
    s.wet = f < PH.rebar ? 0 : f < PH.pour ? 1 : 1 - lin(PH.pour, PH.cure, f)
    s.pour = f >= PH.rebar && f < PH.pour && u < cyclesEnd
    s.cage = f >= PH.form && f < PH.rebar
    s.phase = u >= cyclesEnd ? 'cantilever done' : f < PH.move ? 'traveller advance' : f < PH.form ? 'formwork' : f < PH.rebar ? 'rebar + ducts' : f < PH.pour ? 'pouring' : f < PH.cure ? 'curing' : 'post-tensioning'
    if (u >= cyclesEnd) { s.pairs = N; s.wet = 0; s.cage = false }
  }
  const e = u - cyclesEnd
  if (u >= TL.cipFrom) { s.cip = true; s.cipWet = 1 - lin(TL.cipFrom + 0.3, TL.cipTo + 0.4, u); if (u < TL.cipFrom + 0.3) s.pour = true }
  if (e >= TL.sidePour) { s.sideClosure = true; s.sideWet = 1 - lin(TL.sidePour + 0.2, TL.sidePour + 0.8, e); if (e < TL.sidePour + 0.2) { s.pour = true; s.phase = 'side closure' } }
  if (e >= TL.mainPour) { s.mainClosure = true; s.mainWet = 1 - lin(TL.mainPour + 0.2, TL.mainPour + 0.8, e); if (e < TL.mainPour + 0.2) { s.pour = true; s.phase = 'main closure' } }
  s.finish = lin(TL.finishFrom, TL.finishTo, e)
  if (e >= TL.finishFrom) s.phase = s.finish < 1 ? 'deck finishing' : 'complete'
  return s
}

/**
 * Form traveller on pier 'W'|'E', facing 'in' (main span) or 'out' (side span), at time t.
 * -> { visible, pos (fractional tip index into TIPS + [TIP + 2]), up (carriageway), lift (m, assembly) }
 */
export function travellerState(t, pier, face) {
  for (const up of [true, false]) {
    const u = t - PIER_LAG[pier] - (up ? UP_SHIFT : 0)
    if (u < T0.assemble - 0.3) continue
    const e = u - cyclesEnd
    // dismantle time on this carriageway
    const gone = face === 'out' ? TL.sidePour + 0.9 : pier === 'W' ? 0.3 : TL.mainPour + 0.9
    if (e > gone + 0.5) { if (up) continue; return { visible: false } }
    let pos = 0
    if (u >= T0.cycles) {
      const c = Math.min(N, Math.floor((u - T0.cycles) / CYC) + 1)
      const f = u >= cyclesEnd ? 1 : ((u - T0.cycles) / CYC) % 1
      pos = c - 1 + sm(0, PH.move, f)
    }
    const toClosure = face === 'out' ? sm(TL.sideMove, TL.sideMove + 0.3, e) : pier === 'E' ? sm(TL.mainMove, TL.mainMove + 0.3, e) : 0
    if (e >= 0) pos = N + toClosure
    const lift = (1 - sm(T0.assemble - 0.3, T0.assemble + 0.3, u)) * 10 + sm(gone, gone + 0.5, e) * 10
    return { visible: true, pos, up, lift, cage: pierState(t, pier, up).cage && e < 0 }
  }
  return { visible: false }
}
export const TIPS_X = [...TIPS, TIPS[TIPS.length - 1] + 2]
export const PH_POUR = PH
