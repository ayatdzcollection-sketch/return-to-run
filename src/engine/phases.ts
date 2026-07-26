// ============================================================
// PHASES — P0 through P4, and the ladder position inside them.
//
// Phases move DOWN freely and UP only through gates. Every gate below is a
// demonstration of capability, never an elapsed-time check: he reaches P2 by
// completing 15 minutes continuous, not by spending three weeks trying to.
// ============================================================

import type { LocalDate } from './dates.ts'
import { addDays, mondayOf, trailingWindow, weeksBetween, withinWindow } from './dates.ts'
import type { Phase, SessionTier } from './types.ts'
import { phaseFromIndex, phaseIndex } from './types.ts'
import type { Timeline } from './timeline.ts'
import { painFreeSince } from './interrupts.ts'
import { TUNABLES } from '../config/tunables.ts'
import { FIRST_LEVEL, TOP_LEVEL } from '../config/seedPlan.ts'

export interface LadderPosition {
  level: number
  sessionsAtLevel: number
  cleanSessionsAtLevel: number
  consecutiveFailures: number
}

/**
 * Walk the log forward, advancing and regressing the ladder as it goes.
 *
 * A session is "clean" when it was completed as prescribed with no pain during
 * it and none the next morning. Anything else is a failure at that level: two
 * consecutive failures step back, matching the regression rule that every
 * clinical protocol has and the build brief's ladder lacked.
 */
export function computeLadder(t: Timeline, sessionsNeeded: number): LadderPosition {
  let level = FIRST_LEVEL
  let sessionsAtLevel = 0
  let cleanSessionsAtLevel = 0
  let consecutiveFailures = 0

  for (let i = 0; i < t.ordered.length; i++) {
    const d = t.ordered[i]!
    if (d.outcome === 'pending' || !d.prescription) continue
    if (d.prescription.kind === 'rest' || d.prescription.kind === 'team_capped') continue

    sessionsAtLevel++
    const nextMorning = t.ordered[i + 1]
    const clean = d.outcome === 'completed'
      && d.pain.length === 0
      && (nextMorning?.pain.length ?? 0) === 0

    if (clean) {
      cleanSessionsAtLevel++
      consecutiveFailures = 0
      if (cleanSessionsAtLevel >= sessionsNeeded && level < TOP_LEVEL) {
        level++
        sessionsAtLevel = 0
        cleanSessionsAtLevel = 0
      }
    } else {
      consecutiveFailures++
      cleanSessionsAtLevel = 0
      if (consecutiveFailures >= TUNABLES.LADDER.FAILURES_BEFORE_REGRESSION && level > FIRST_LEVEL) {
        level--
        sessionsAtLevel = 0
        consecutiveFailures = 0
      }
    }
  }

  return { level, sessionsAtLevel, cleanSessionsAtLevel, consecutiveFailures }
}

export interface PhaseInputs {
  sessionsLogged: number
  toleranceAssigned: boolean
  bestContinuousMin: number
  worstRecentSoreness: number
  painFree7d: boolean
  unbrokenWeeks: number
  teamWeeksCapped: number
  interrupted: boolean
}

/**
 * The highest phase the evidence supports. Never uses elapsed time as a gate.
 */
export function computePhase(inp: PhaseInputs): Phase {
  // P3 -> P4 needs eight unbroken weeks. That gate is about tier unlocks, not
  // about being allowed to run: nothing above easy+strides opens before it.
  if (inp.teamWeeksCapped >= 2 && !inp.interrupted && inp.unbrokenWeeks >= TUNABLES.LADDER.SESSIONS_PER_LEVEL_DEFAULT) {
    if (inp.unbrokenWeeks >= 8) return 'P4'
    return 'P3'
  }
  if (inp.bestContinuousMin >= 30 && inp.painFree7d) return 'P3'
  if (inp.bestContinuousMin >= 15 && inp.worstRecentSoreness <= 1) return 'P2'
  if (inp.sessionsLogged >= TUNABLES.LADDER.SESSIONS_PER_LEVEL_DEFAULT + 2 && inp.toleranceAssigned) return 'P1'
  return 'P0'
}

/** Phase after an interrupt: down one, floored at P0. Never skipped. */
export function demote(p: Phase, steps = 1): Phase {
  return phaseFromIndex(phaseIndex(p) - steps)
}

/**
 * Highest session tier available.
 *
 * Invariant 4: nothing above `easy` + strides unlocks before eight unbroken
 * weeks of running. `unbrokenWeeks` resets to zero on any week with no running
 * or any interrupt, so a missed week genuinely restarts the counter.
 */
export function maxTier(phase: Phase, unbrokenWeeks: number): SessionTier {
  if (phase !== 'P4' || unbrokenWeeks < 8) {
    return phase === 'P0' ? 'walk_run' : 'easy'
  }
  if (unbrokenWeeks < 10) return 'strides'
  if (unbrokenWeeks < 12) return 'hills'
  return 'threshold'
}

/** Consecutive Monday-anchored weeks containing at least one run, no interrupt. */
export function computeUnbrokenWeeks(t: Timeline, today: LocalDate): number {
  if (!t.firstDate) return 0
  const weeks = weeksBetween(today, t.firstDate)
  let streak = 0
  for (let w = 0; w <= weeks; w++) {
    const start = addWeeks(mondayOf(t.firstDate), w)
    const end = addWeeks(start, 1)
    const inWeek = t.ordered.filter((d) => d.date >= start && d.date < end)
    const ran = inWeek.some((d) => d.jogMin > 0)
    const hurt = inWeek.some((d) => d.pain.length > 0)
    streak = ran && !hurt ? streak + 1 : 0
  }
  return streak
}

function addWeeks(d: LocalDate, n: number): LocalDate {
  return addDays(d, n * 7)
}

/** Best unbroken jog actually completed to date. Gates P1 -> P2 -> P3. */
export function bestContinuous(t: Timeline): number {
  return t.ordered.reduce((best, d) => Math.max(best, d.longestBoutMin), 0)
}

/** Worst next-morning soreness in the trailing window. */
export function recentSoreness(t: Timeline, today: LocalDate, days = 7): number {
  const w = trailingWindow(today, days)
  return t.ordered
    .filter((d) => withinWindow(d.date, w.start, w.end))
    .reduce((worst, d) => Math.max(worst, d.soreness ?? 0), 0)
}

export { painFreeSince }
