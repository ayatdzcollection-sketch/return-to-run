// ============================================================
// MODIFIERS: footwear, surface, heat, and the weekly probe.
//
// Each returns a cap or a multiplier plus an audit record. None of them can
// ever raise a limit; the strongest applies and the rest are logged.
// ============================================================

import type { LocalDate } from './dates.ts'
import { trailingWindow, withinWindow } from './dates.ts'
import type { CapRecord, FootwearState, Surface } from './types.ts'
import type { Timeline } from './timeline.ts'
import { TUNABLES } from '../config/tunables.ts'

// ── Footwear ────────────────────────────────────────────────
// Deliberately de-emphasised relative to the build brief. No study anywhere
// examines running injury in people running in non-running footwear, and at
// this athlete's paces the shoe term is where it matters least, speed
// dominates tibial shock over cushioning by eta-squared 0.80 vs 0.39. The caps
// below are kept as cheap precaution and labelled as such. The one footwear
// transition with real evidence is minimalist, and it gets a real modifier.

export interface FootwearLimit {
  sessionCapMin: number | null
  budgetFactor: number
  outdoorAllowed: boolean
  record: CapRecord | null
  advice: string | null
}

export function footwearLimit(state: FootwearState, sessionsSinceChange: number): FootwearLimit {
  switch (state) {
    case 'none':
    case 'non_running':
      return {
        sessionCapMin: TUNABLES.FOOTWEAR.NONE_SESSION_CAP_MIN,
        budgetFactor: TUNABLES.FOOTWEAR.NONE_BUDGET_FACTOR,
        outdoorAllowed: false,
        record: {
          rule: 'footwear_none',
          original: TUNABLES.FOOTWEAR.NONE_SESSION_CAP_MIN,
          applied: TUNABLES.FOOTWEAR.NONE_SESSION_CAP_MIN,
          note: 'precautionary, no direct evidence exists either way',
        },
        advice: 'Use the most cushioned, lightest shoes you have. Avoid hard-soled skate or court shoes.',
      }
    case 'new_under_50mi':
      if (sessionsSinceChange >= TUNABLES.FOOTWEAR.NEW_SHOES_SESSIONS) {
        return { sessionCapMin: null, budgetFactor: 1, outdoorAllowed: true, record: null, advice: null }
      }
      return {
        sessionCapMin: TUNABLES.FOOTWEAR.NEW_SHOES_DAILY_CAP_MIN,
        budgetFactor: 1,
        outdoorAllowed: true,
        record: {
          rule: 'footwear_new',
          original: TUNABLES.FOOTWEAR.NEW_SHOES_DAILY_CAP_MIN,
          applied: TUNABLES.FOOTWEAR.NEW_SHOES_DAILY_CAP_MIN,
          note: 'precautionary, break-in periods for conventional trainers are lore',
        },
        advice: null,
      }
    case 'broken_in':
      return { sessionCapMin: null, budgetFactor: 1, outdoorAllowed: true, record: null, advice: null }
  }
}

// ── Surface transition ──────────────────────────────────────
// Re-based, not removed. The brief's rationale (belt-assisted push-off, lower
// impact) is wrong: propulsion is identical by Galilean equivalence, peak
// vertical GRF shows no difference, and Achilles load is 12.5% HIGHER on a
// treadmill. The real reason is that the changeover stacks five or six novel
// stressors inside 48 hours, and that at slow speeds treadmill heart rate and
// RPE run LOWER than overground at matched speed, so the same minutes
// outdoors are a higher internal load. See RESEARCH.md §A22.

export interface SurfaceLimit {
  durationFactor: number
  /** Speed is the escalation risk outdoors, not minutes. */
  capSpeedToCeiling: boolean
  record: CapRecord | null
}

export function surfaceLimit(surface: Surface, outdoorSessions: number): SurfaceLimit {
  if (surface === 'treadmill') return { durationFactor: 1, capSpeedToCeiling: false, record: null }
  const { ROAD_TRANSITION_SESSIONS, ROAD_TAPER_SESSIONS, ROAD_TRANSITION_FACTOR, ROAD_TAPER_FACTOR } = TUNABLES.SURFACE
  if (outdoorSessions < ROAD_TRANSITION_SESSIONS) {
    return {
      durationFactor: ROAD_TRANSITION_FACTOR,
      capSpeedToCeiling: true,
      record: { rule: 'surface_transition', original: 1, applied: ROAD_TRANSITION_FACTOR, note: `outdoor session ${outdoorSessions + 1}` },
    }
  }
  if (outdoorSessions < ROAD_TRANSITION_SESSIONS + ROAD_TAPER_SESSIONS) {
    return {
      durationFactor: ROAD_TAPER_FACTOR,
      capSpeedToCeiling: true,
      record: { rule: 'surface_taper', original: 1, applied: ROAD_TAPER_FACTOR, note: `outdoor session ${outdoorSessions + 1}` },
    }
  }
  return { durationFactor: 1, capSpeedToCeiling: false, record: null }
}

// ── Heat ────────────────────────────────────────────────────
// August in Michigan: on roughly 74% of afternoons an unfit, unacclimatized
// youth is in a band calling for reduced intensity AND duration; ~19% reach
// "cancel". At 7-9am those figures are 22% and 0%, which is why any session
// the engine schedules itself in August is a morning session.

export type HeatLevel = 'none' | 'mild' | 'moderate' | 'high' | 'unsafe'

export interface HeatLimit {
  level: HeatLevel
  durationFactor: number
  dropSpeedCeiling: boolean
  /** No outdoor session is prescribed at all. */
  prohibited: boolean
  record: CapRecord | null
}

/**
 * `wbgtC` is the raw forecast; the safety margin is added here rather than by
 * the caller. Gridded and app-derived estimates read 1-3 C low and
 * systematically under-classify risk, so the engine never trusts one at face
 * value.
 */
export function heatLimit(wbgtC: number | null): HeatLimit {
  if (wbgtC === null) return { level: 'none', durationFactor: 1, dropSpeedCeiling: false, prohibited: false, record: null }
  const adj = wbgtC + TUNABLES.HEAT.FORECAST_SAFETY_MARGIN_C
  const H = TUNABLES.HEAT
  const rec = (level: HeatLevel, factor: number): CapRecord => ({
    rule: `heat_${level}`, original: 1, applied: factor, note: `adjusted WBGT ${adj.toFixed(1)} C`,
  })
  if (adj >= H.LEVEL4_WBGT_C) return { level: 'unsafe', durationFactor: 0, dropSpeedCeiling: true, prohibited: true, record: rec('unsafe', 0) }
  if (adj >= H.LEVEL3_WBGT_C) return { level: 'high', durationFactor: H.LEVEL3_DURATION_FACTOR, dropSpeedCeiling: true, prohibited: false, record: rec('high', H.LEVEL3_DURATION_FACTOR) }
  if (adj >= H.LEVEL2_WBGT_C) return { level: 'moderate', durationFactor: H.LEVEL2_DURATION_FACTOR, dropSpeedCeiling: true, prohibited: false, record: rec('moderate', H.LEVEL2_DURATION_FACTOR) }
  if (adj >= H.LEVEL1_WBGT_C) return { level: 'mild', durationFactor: H.LEVEL1_DURATION_FACTOR, dropSpeedCeiling: false, prohibited: false, record: rec('mild', H.LEVEL1_DURATION_FACTOR) }
  return { level: 'none', durationFactor: 1, dropSpeedCeiling: false, prohibited: false, record: null }
}

// ── Weekly probe ────────────────────────────────────────────
// Constant speed, falling heart rate is aerobic progress, and it is the ONLY
// evidence that may raise a ceiling. RPE is kept regardless of whether the
// watch is present: it costs one tap and it is the check on the sensor.

export type ProbeTrend = 'falling' | 'flat' | 'rising' | 'insufficient'

export interface ProbeState {
  trend: ProbeTrend
  /** Consecutive weeks of improvement. Two permits a ceiling rise. */
  consecutiveImprovements: number
  /** Neither HR nor RPE improving across the flag window. */
  stagnant: boolean
  mayRaiseCeiling: boolean
}

export function computeProbe(t: Timeline, today: LocalDate): ProbeState {
  const probes = t.ordered
    .filter((d) => d.probe !== null && d.date <= today)
    .map((d) => ({ date: d.date, hr: d.probe!.hrAtMin5, rpe: d.probe!.rpe, speed: d.probe!.fixedSpeedMph }))

  if (probes.length < 2) {
    return { trend: 'insufficient', consecutiveImprovements: 0, stagnant: false, mayRaiseCeiling: false }
  }

  // Only compare probes run at the SAME frozen speed, that is the whole point
  // of freezing it. A probe at a different speed is not comparable.
  const latestSpeed = probes.at(-1)!.speed
  const comparable = probes.filter((p) => Math.abs(p.speed - latestSpeed) < 0.05)
  if (comparable.length < 2) {
    return { trend: 'insufficient', consecutiveImprovements: 0, stagnant: false, mayRaiseCeiling: false }
  }

  let improvements = 0
  for (let i = comparable.length - 1; i > 0; i--) {
    const cur = comparable[i]!, prev = comparable[i - 1]!
    const hrFell = cur.hr !== null && prev.hr !== null && cur.hr < prev.hr
    const rpeFell = cur.rpe < prev.rpe
    if (hrFell || (cur.hr === null && rpeFell)) improvements++
    else break
  }

  const recent = comparable.slice(-TUNABLES.PROBE.FLAT_WEEKS_FLAG - 1)
  const stagnant = recent.length > TUNABLES.PROBE.FLAT_WEEKS_FLAG && !improvedAcross(recent)

  const last = comparable.at(-1)!, prev = comparable.at(-2)!
  const trend: ProbeTrend = improvements > 0 ? 'falling'
    : (last.hr !== null && prev.hr !== null && last.hr > prev.hr) || last.rpe > prev.rpe ? 'rising'
      : 'flat'

  return {
    trend,
    consecutiveImprovements: improvements,
    stagnant,
    // Invariant 12: ceilings rise ONLY here, and only on two consecutive weeks
    // of falling heart rate at a fixed speed. Never because he feels good,
    // never because he asked.
    mayRaiseCeiling: improvements >= TUNABLES.PROBE.RAISE_CONSECUTIVE_WEEKS,
  }
}

function improvedAcross(probes: { hr: number | null; rpe: number }[]): boolean {
  const first = probes[0]!, last = probes.at(-1)!
  if (first.hr !== null && last.hr !== null) return last.hr < first.hr
  return last.rpe < first.rpe
}

/** Aerobic-drift breaches inside the rolling window. Two drops both ceilings. */
export function countDriftEvents(t: Timeline, today: LocalDate, isBreach: (date: LocalDate) => boolean): number {
  const w = trailingWindow(today, TUNABLES.HR.DRIFT_WINDOW_DAYS)
  return t.ordered.filter((d) => withinWindow(d.date, w.start, w.end) && isBreach(d.date)).length
}
