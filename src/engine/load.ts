// ============================================================
// LOAD — how much running has happened, and how much is allowed next.
//
// THE ACWR CLAMP IS DELIBERATELY ABSENT. It is not disabled, not set to a wide
// band, not computed for display. The research pass found it contradicted in
// DIRECTION in both prospective running cohorts that tested it, null in its one
// adolescent RCT, arithmetically undefined at a 12-month-detrained baseline,
// and — worst — that its 0.8 lower bound would instruct this athlete to train
// MORE in order to satisfy a metric. See RESEARCH.md §A6.
//
// What replaces it is a per-session cap against the longest session of the
// trailing 30 days, from the only study that tested session-level, weekly, and
// ACWR exposures head to head in the same data (Frandsen 2025, n=5,205).
// ============================================================

import type { LocalDate } from './dates.ts'
import { addDays, diffDays, mondayOf, trailingWindow, withinWindow } from './dates.ts'
import { round1 } from './events.ts'
import type { CapRecord } from './types.ts'
import type { Timeline } from './timeline.ts'
import { TUNABLES } from '../config/tunables.ts'

export interface LoadWindows {
  acuteMin: number
  chronicMin: number
  thisWeekMin: number
  lastWeekMin: number
  /** Baseline for the weekly cap: the last completed BUILD week, not a down week. */
  lastBuildWeekMin: number | null
  /** The number the session cap is measured against. */
  longest30dMin: number
  newLongestThisWeek: number
  daysSinceLastRun: number | null
}

export function computeWindows(t: Timeline, today: LocalDate): LoadWindows {
  const acute = trailingWindow(today, 7)
  const chronic = trailingWindow(today, 28)
  const longestWindow = trailingWindow(today, TUNABLES.LOAD.LONGEST_LOOKBACK_DAYS)
  const weekStart = mondayOf(today)
  const lastWeekStart = addDays(weekStart, -7)

  let acuteMin = 0, chronicMin = 0, thisWeekMin = 0, lastWeekMin = 0
  let longest30 = 0, newLongestThisWeek = 0, lastRun: LocalDate | null = null
  let runningLongest = 0

  for (const d of t.ordered) {
    if (d.jogMin <= 0) continue
    if (!lastRun || d.date > lastRun) lastRun = d.date
    if (withinWindow(d.date, acute.start, acute.end)) acuteMin += d.jogMin
    if (withinWindow(d.date, chronic.start, chronic.end)) chronicMin += d.jogMin
    if (withinWindow(d.date, weekStart, addDays(weekStart, 6))) thisWeekMin += d.jogMin
    if (withinWindow(d.date, lastWeekStart, addDays(lastWeekStart, 6))) lastWeekMin += d.jogMin
    if (withinWindow(d.date, longestWindow.start, longestWindow.end)) longest30 = Math.max(longest30, d.jogMin)
    // A session counts as a "new longest" if it exceeded everything before it.
    if (d.jogMin > runningLongest) {
      runningLongest = d.jogMin
      if (withinWindow(d.date, weekStart, addDays(weekStart, 6))) newLongestThisWeek++
    }
  }

  return {
    acuteMin: round1(acuteMin),
    chronicMin: round1(chronicMin / 4),
    thisWeekMin: round1(thisWeekMin),
    lastWeekMin: round1(lastWeekMin),
    lastBuildWeekMin: lastWeekMin > 0 ? round1(lastWeekMin) : null,
    longest30dMin: round1(longest30),
    newLongestThisWeek,
    daysSinceLastRun: lastRun ? Math.max(0, diffDays(today, lastRun)) : null,
  }
}

export interface CapContext {
  /** What the ladder would like to prescribe, in jogging minutes. */
  desiredJogMin: number
  windows: LoadWindows
  /** Weeks since the first session; drives the elevated-risk damping. */
  weekNumber: number
  isDownWeek: boolean
  toleranceFactor: number
}

export interface CapResult {
  jogMin: number
  caps: CapRecord[]
  binding: string | null
}

/**
 * Apply every load ceiling and return the smallest survivor.
 *
 * Each cap is recorded with the value it replaced, whether or not it bound —
 * invariant 7 required that only for ACWR, and there is no reason the rest
 * should be less auditable. `binding` names the one that actually decided the
 * number, which is what the rationale sentence is built from.
 */
export function applyLoadCaps(ctx: CapContext): CapResult {
  const { desiredJogMin, windows, weekNumber, isDownWeek, toleranceFactor } = ctx
  const caps: CapRecord[] = []
  let value = desiredJogMin
  let binding: string | null = null

  const clamp = (rule: string, limit: number, note?: string) => {
    if (limit < value) {
      caps.push({ rule, original: round1(value), applied: round1(limit), note })
      value = limit
      binding = rule
    } else {
      caps.push({ rule, original: round1(value), applied: round1(value), note })
    }
  }

  // 1. THE PRIMARY GUARDRAIL. Against the 30-day longest, not a weekly ratio.
  //    Near zero a pure 10% rule is degenerate (10% of 8 minutes is 48 seconds),
  //    so an absolute floor applies, itself bounded so it cannot run away later.
  const L = windows.longest30dMin
  if (L > 0) {
    const relative = L * TUNABLES.LOAD.SESSION_CAP_FACTOR
    const floored = Math.max(relative, L + TUNABLES.LOAD.SESSION_CAP_MIN_INCREMENT_MIN)
    const bounded = Math.min(floored, L + TUNABLES.LOAD.SESSION_CAP_MAX_INCREMENT_MIN)
    clamp('session_cap', bounded, `longest in ${TUNABLES.LOAD.LONGEST_LOOKBACK_DAYS}d was ${L} min`)

    // 2. The session cap does not compose across a week on its own: three
    //    compliant +10% steps in seven days is not a compliant week.
    if (windows.newLongestThisWeek >= TUNABLES.LOAD.NEW_LONGEST_SESSIONS_PER_WEEK) {
      clamp('one_new_longest_per_week', L, 'already set a new longest this week')
    }
  }

  // 3. Terminal ceiling. 30 minutes is the top of the tolerable bracket, not a
  //    waypoint: injury incidence in untrained males ran 24% at 30 min per
  //    session but 54% at 45 (Pollock 1977).
  clamp('terminal_ceiling', TUNABLES.LOAD.TERMINAL_SESSION_CEILING_MIN)

  // 4. Elevated-risk damping. The load-change signal appears at ~21 days and
  //    military BSI care-seeking peaks weeks 5-8, so increments are halved
  //    across that window rather than after it.
  if (weekNumber >= TUNABLES.LOAD.HIGH_RISK_WEEK_FIRST && weekNumber <= TUNABLES.LOAD.HIGH_RISK_WEEK_LAST && L > 0) {
    const damped = L + (value - L) * TUNABLES.LOAD.HIGH_RISK_INCREMENT_FACTOR
    clamp('high_risk_window', damped, `week ${weekNumber} of the elevated-risk window`)
  }

  // 5. Secondary weekly cap. Cheap insurance only — no weekly-level signal was
  //    found in this athlete's own population, so it must never be presented as
  //    evidence-based and never overrides the session cap.
  const base = windows.lastBuildWeekMin
  if (base !== null && base > 0) {
    const weeklyAllowance = Math.min(
      base * TUNABLES.LOAD.WEEKLY_GROWTH_MAX,
      base + TUNABLES.LOAD.WEEKLY_ABS_INCREASE_MAX_MIN,
    ) * toleranceFactor
    const remaining = Math.max(0, weeklyAllowance - windows.thisWeekMin)
    clamp('weekly_cap', remaining, `week allowance ${round1(weeklyAllowance)} min, ${windows.thisWeekMin} used`)
  }

  // 6. Down week. Not skippable, not deferrable, and tolerance class does not
  //    exempt it — `aggressive` buys earlier gates, never more volume.
  if (isDownWeek) {
    clamp('down_week', desiredJogMin * (1 - TUNABLES.DOWN_WEEK.CUT), 'scheduled absorption week')
  }

  // 7. Longest session <= 30% of weekly minutes (invariant 9). Only meaningful
  //    once a week's worth of history exists; during the ramp the ladder's own
  //    step sizes are far more binding.
  if (base !== null && base >= 30) {
    clamp('longest_session_share', base * 0.30, 'invariant 9')
  }

  return { jogMin: round1(Math.max(0, value)), caps, binding }
}
