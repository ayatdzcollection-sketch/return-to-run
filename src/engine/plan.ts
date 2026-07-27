// ============================================================
// PLAN: the arc, not just today.
//
// The engine deliberately commits to one day at a time, because a prescription
// is a function of what has actually happened. But an athlete who can only see
// today has no idea what he is in the middle of, and a plan that never says
// when it ends never tells anyone it is over.
//
// So this module answers three questions without weakening that:
//
//   Where am I?      levels done, phase, block
//   What is coming?  a PROVISIONAL projection, clearly labelled as such
//   Is this done?    when the engine has run out of structure to offer
//
// The projection assumes every remaining session goes clean, which is the best
// case and not the likely one. It is shown as an estimate that moves, never as
// a promise, for the same reason the narrative layer may not claim a gradual
// build prevents injury.
// ============================================================

import type { LocalDate } from './dates.ts'
import { addDays, dayOfWeek, diffDays, weeksBetween } from './dates.ts'
import { FIRST_LEVEL, LADDER, TOP_LEVEL, levelAt } from '../config/seedPlan.ts'
import { PLAN, TUNABLES } from '../config/tunables.ts'

/** Monday, Wednesday, Friday. Must match prescribe.ts. */
const RUN_DAYS = [0, 2, 4]
/** Friday is the long day, so that is where a full-length bout happens. */
const LONG_DAY = 4

export type BlockId = 'return' | 'season' | 'needs_new_plan'

export interface PlanStatus {
  block: BlockId
  /** Ladder rungs completed, for the progress arc. */
  levelsDone: number
  levelsTotal: number
  /** First date a full-length session at the top rung was completed. */
  reachedGoalAt: LocalDate | null
  weeksAtTopLevel: number
  /**
   * True when the engine has nothing structured left to give and a human
   * should write the next block. This is a hand-off, not a failure.
   */
  needsNewPlan: boolean
  reason: string | null
}

export interface ProjectedDay {
  date: LocalDate
  isRunDay: boolean
  level: number
  /** Provisional. Ignores every cap that depends on what actually happens. */
  approxJogMin: number
  isLongDay: boolean
}

export interface Projection {
  days: ProjectedDay[]
  /** Provisional date of the first full 30-minute continuous run. */
  goalDate: LocalDate | null
  weeksToGoal: number | null
  /** Set when the goal date falls after the date the plan is aimed at. */
  missesTargetBy: number | null
}

export interface PlanInputs {
  today: LocalDate
  level: number
  cleanSessionsAtLevel: number
  sessionsNeededPerLevel: number
  bestContinuousMin: number
  firstDate: LocalDate | null
  /** Dates on which a full-length top-rung session was completed. */
  topLevelCompletions: LocalDate[]
  interrupted: boolean
}

/**
 * Walk the calendar forward assuming every session goes clean.
 *
 * Deliberately does NOT call prescribe(). Prescribe needs a folded state that
 * only exists once events have happened, and simulating those events would
 * produce a number precise enough to be mistaken for a commitment. This models
 * the ladder's shape and nothing else.
 */
export function projectPlan(inp: PlanInputs, horizonWeeks = 16): Projection {
  const days: ProjectedDay[] = []
  let level = Math.max(FIRST_LEVEL, inp.level)
  let clean = inp.cleanSessionsAtLevel
  let goalDate: LocalDate | null = null

  for (let i = 0; i < horizonWeeks * 7; i++) {
    const date = addDays(inp.today, i)
    const dow = dayOfWeek(date)
    const isRunDay = RUN_DAYS.includes(dow)
    const isLongDay = dow === LONG_DAY
    const rung = levelAt(level)
    // Matches prescribe.ts DAY_FACTOR. Long / short / medium, because failing
    // to alternate carried OR 3.0 for early-season injury.
    const factor = dow === 0 ? 0.85 : dow === 2 ? 0.7 : 1.0

    days.push({
      date,
      isRunDay,
      level,
      approxJogMin: isRunDay ? Math.round(rung.jogMin * factor) : 0,
      isLongDay,
    })

    if (isRunDay) {
      // The goal is a FULL 30-minute continuous run, which only the long day
      // asks for. Reaching the top rung on a short day is not the same thing.
      if (goalDate === null && level >= TOP_LEVEL && isLongDay) goalDate = date
      clean += 1
      if (clean >= inp.sessionsNeededPerLevel && level < TOP_LEVEL) {
        level += 1
        clean = 0
      }
    }
  }

  // Already done is already done.
  if (inp.bestContinuousMin >= TUNABLES.LOAD.TERMINAL_SESSION_CEILING_MIN) {
    goalDate = inp.topLevelCompletions[0] ?? inp.today
  }

  const weeksToGoal = goalDate === null ? null : Math.max(0, Math.ceil(diffDays(goalDate, inp.today) / 7))
  const missesTargetBy = goalDate === null || goalDate <= PLAN.TARGET_DATE
    ? null
    : diffDays(goalDate, PLAN.TARGET_DATE)

  return { days, goalDate, weeksToGoal, missesTargetBy }
}

/**
 * Which block he is in, and whether the engine has run out of road.
 *
 * Block 1 (return) is the ladder. Block 2 (season) holds at 30 minutes and
 * folds in team practice; 30 is a terminal ceiling rather than a waypoint,
 * because injury incidence in untrained males ran 24% at 30 min per session
 * against 54% at 45. Block 3 is not a block: it is the engine saying a human
 * needs to write what comes next.
 */
export function planStatus(inp: PlanInputs): PlanStatus {
  const reachedGoal = inp.bestContinuousMin >= TUNABLES.LOAD.TERMINAL_SESSION_CEILING_MIN
  const reachedGoalAt = inp.topLevelCompletions[0] ?? null
  const weeksAtTop = reachedGoalAt === null ? 0 : Math.max(0, weeksBetween(inp.today, reachedGoalAt))

  const pastHorizon = inp.today > PLAN.HORIZON_DATE
  const stalled = reachedGoal && weeksAtTop >= PLAN.SEASON_REVIEW_WEEKS

  let block: BlockId = reachedGoal ? 'season' : 'return'
  let reason: string | null = null
  if (pastHorizon) {
    block = 'needs_new_plan'
    reason = 'this plan was written to cover the season, and the season is over'
  } else if (stalled) {
    block = 'needs_new_plan'
    reason = `${weeksAtTop} weeks of holding at 30 minutes, which is as far as this plan goes`
  }

  return {
    block,
    levelsDone: reachedGoal ? TOP_LEVEL : Math.max(0, Math.min(TOP_LEVEL, inp.level) - 1),
    levelsTotal: TOP_LEVEL,
    reachedGoalAt,
    weeksAtTopLevel: weeksAtTop,
    needsNewPlan: block === 'needs_new_plan',
    reason,
  }
}

/** Human label for a ladder rung, for the arc and the plan view. */
export function rungLabel(level: number): string {
  return levelAt(level).label
}

export const LADDER_SUMMARY = LADDER.map((l) => ({
  level: l.level,
  label: l.label,
  jogMin: l.jogMin,
  longestBoutMin: l.longestBoutMin,
}))
