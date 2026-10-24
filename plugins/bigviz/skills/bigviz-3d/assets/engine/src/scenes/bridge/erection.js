// Bridge pack - west approach T-beam erection as a pure function of working time: yard
// gantries load a beam onto the transporter, it drives out along the erected deck to the
// launcher, front + rear trolleys take the beam over the span, traverse to the slot, lower onto
// the bearings, release; after each span (7 beams) the launcher launches 30 m forward.

import { BEAM, DN } from './layout.js'
import { WEST_SPANS } from './viaduct.js'
import { SPD } from './schedule.js'

const sm = (a, b, v) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t) }
export const YARD_X = -400 // transporter centre while loading
export const STORE_Z = DN + 13 // yard storage row (world z); the transporter lane is z = DN
export const ER = { assemble: 1.6, start: 2.5, launch: 0.3, finishLag: 2.2, vLoaded: 5, vEmpty: 8 }
const S = { load: 10, hook: 6, carry: 18, traverse: 14, release: 12 }
const d = (sec) => sec / SPD

/** transporter centre x when the beam (centre span start - 15) is under the pick points */
const feedX = (k) => WEST_SPANS[k][0] - 15 - 0.15
// erection order: span 0..6, slot 0..6 (z from -7.07 to +7.07)
export const BEAMS = []
{
  let t = ER.start
  for (let k = 0; k < WEST_SPANS.length; k++) {
    if (k) t += ER.launch
    for (let s = 0; s < BEAM.n; s++) {
      const dist = Math.abs(feedX(k) - YARD_X)
      const drive = dist / ER.vLoaded
      const back = dist / ER.vEmpty
      const place = S.load + drive + S.hook + S.carry + S.traverse + S.release
      const cyc = Math.max(place, S.load + drive + S.hook + back + 6)
      BEAMS.push({ k, s, t0: t, dur: d(cyc), drive: d(drive), back: d(back), feed: feedX(k) })
      t += d(cyc)
    }
  }
}
export const ERECTION_END = BEAMS[BEAMS.length - 1].t0 + BEAMS[BEAMS.length - 1].dur
const spanDone = WEST_SPANS.map((_, k) => { const b = BEAMS[k * BEAM.n + BEAM.n - 1]; return b.t0 + b.dur })

/**
 * -> { launchX (mid-leg station), up (assembly lift m), placed, finished, phase,
 *      trolleys: [{ x, z, drop }, { x, z, drop }] (launcher local),
 *      carry: null | { x, z, lift } (world x / z; lift = beam top above the deck line),
 *      transX, yard: { z (world), beam: null | top above the yard floor } }
 */
export function erectionState(t) {
  const st = { launchX: WEST_SPANS[0][0], up: 0, placed: 0, finished: 0, phase: 'assembly', trolleys: [{ x: 0, z: 0, drop: 3 }, { x: -30, z: 0, drop: 3 }], carry: null, transX: YARD_X, yard: { z: STORE_Z, beam: null } }
  st.finished = spanDone.filter((e) => t >= e + ER.finishLag).length
  st.up = (1 - sm(ER.assemble, ER.start - 0.1, t)) * 14
  if (t < ER.start) return st
  if (t >= ERECTION_END) {
    st.placed = BEAMS.length
    st.phase = 'erection done'
    st.launchX = WEST_SPANS[6][0]
    st.up = sm(ERECTION_END + 0.3, ERECTION_END + 1.2, t) * 14
    st.gone = t > ERECTION_END + 1.2
    return st
  }
  let i = BEAMS.findIndex((b) => t < b.t0 + b.dur)
  const b = BEAMS[i]
  st.launchX = WEST_SPANS[b.k][0]
  st.placed = i
  if (t < b.t0) {
    // launching to the next span
    const prev = WEST_SPANS[b.k - 1][0]
    st.launchX = prev + (WEST_SPANS[b.k][0] - prev) * sm(b.t0 - ER.launch, b.t0, t)
    st.phase = 'launching'
    return st
  }
  const u = t - b.t0
  const P = [d(S.load), b.drive, d(S.hook), d(S.carry), d(S.traverse), d(S.release)]
  const at = P.reduce((a, x) => (a.push(a[a.length - 1] + x), a), [0])
  const zSlot = (b.s - (BEAM.n - 1) / 2) * BEAM.pitch
  const cx0 = WEST_SPANS[b.k][0] - 15 // beam centre at pick: front end under the front trolley (local 0)
  const LIFT_T = 4.85 // beam top above the deck line while on the transporter / carried
  const drop = (lift) => 10.3 - (lift + 0.18) - 1.2 + 0.18
  const T = st.trolleys
  st.yard = { z: STORE_Z, beam: null }
  if (u < at[1]) {
    st.phase = 'loading'
    const k = (u - at[0]) / P[0]
    st.yard = { z: DN, beam: 7.5 - sm(0, 1, k) * (7.5 - LIFT_T) }
    st.transX = YARD_X
  } else if (u < at[2]) {
    st.phase = 'transporting'
    st.transX = YARD_X + (b.feed - YARD_X) * sm(at[1], at[2], u)
    st.carry = { x: st.transX + 0.15, z: DN, lift: LIFT_T, onTransporter: true }
  } else {
    st.transX = b.feed + (YARD_X - b.feed) * sm(at[3], at[3] + b.back, u)
    if (u < at[3]) {
      st.phase = 'hooking'
      // hooks come down (40 %), then take the load and lift 0.3 m
      const kd = sm(at[2], at[2] + P[2] * 0.4, u)
      const k = sm(at[2] + P[2] * 0.5, at[3], u)
      st.carry = { x: cx0, z: DN, lift: LIFT_T + k * 0.3 }
      const dr = 3 + (drop(LIFT_T + k * 0.3) - 3) * kd
      T[0] = { x: 0, z: 0, drop: dr }
      T[1] = { x: -30, z: 0, drop: dr }
    } else if (u < at[4]) {
      st.phase = 'feeding'
      const k = sm(at[3], at[4], u)
      st.carry = { x: cx0 + 30 * k, z: DN, lift: LIFT_T + 0.3 }
      T[0] = { x: 30 * k, z: 0, drop: drop(LIFT_T + 0.3) }
      T[1] = { x: -30 + 30 * k, z: 0, drop: drop(LIFT_T + 0.3) }
    } else if (u < at[5]) {
      st.phase = 'traverse + lower'
      const kz = sm(at[4], at[4] + P[4] * 0.5, u)
      const ky = sm(at[4] + P[4] * 0.35, at[5], u)
      const lift = (LIFT_T + 0.3) * (1 - ky)
      st.carry = { x: cx0 + 30, z: DN + zSlot * kz, lift }
      T[0] = { x: 30, z: zSlot * kz, drop: drop(lift) }
      T[1] = { x: 0, z: zSlot * kz, drop: drop(lift) }
    } else {
      st.phase = 'releasing'
      st.placed = i + 1
      const k = sm(at[5], at[6], u)
      const kr = sm(at[5], at[5] + P[5] * 0.3, u)
      T[0] = { x: 30 - 30 * k, z: zSlot * (1 - k), drop: drop(0) - kr * (drop(0) - 3) }
      T[1] = { x: -30 * k, z: zSlot * (1 - k), drop: drop(0) - kr * (drop(0) - 3) }
    }
    // the gantries pick the next beam while the transporter is away, and hold it
    if (i + 1 < BEAMS.length && BEAMS[i + 1].k === b.k) {
      // trolley over the store, hook on, lift to 7.5 m, traverse over the lane and hold
      const k = sm(at[2] + d(8), at[3] + P[3] * 0.4, u)
      st.yard = { z: STORE_Z + (DN - STORE_Z) * sm(at[3] + P[3] * 0.4, at[4] + P[4], u), beam: u < at[2] + d(8) ? null : 2.4 + k * 5.1 }
    }
  }
  st.span = b.k
  st.slot = b.s
  st.beamIndex = i
  return st
}
