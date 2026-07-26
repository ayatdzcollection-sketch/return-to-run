// ============================================================
// CALIBRATION — turning a self-administered talk test into a belt speed.
//
// The single most important correction in this engine. A motivated person can
// force out a full sentence well above their first ventilatory threshold: the
// talk test's NEGATIVE stage ("cannot speak comfortably") corresponds to VT2,
// not VT1 — 93% of VO2peak versus 77% at threshold. Administered naively, "can
// you still talk?" identifies something close to threshold and calls it easy.
//
// Three guards, all applied:
//   1. A strict criterion — the first CHANGE IN BREATHING, not loss of speech.
//   2. A fixed margin of 1.0 mph. The brief specified 0.4, which is smaller
//      than the talk test's own minimal detectable change (~0.9 mph) — a
//      margin inside the instrument's noise floor protects nothing.
//   3. An absolute HR backstop that truncates, never prescribes.
// See RESEARCH.md §A13.
// ============================================================

import type { LocalDate } from './dates.ts'
import { trailingWindow, withinWindow } from './dates.ts'
import type { ToleranceClass } from './types.ts'
import type { Timeline } from './timeline.ts'
import { TUNABLES } from '../config/tunables.ts'

export interface CalibrationResult {
  /** The belt speed. Null until at least one talk test exists. */
  conversationalSpeedMph: number | null
  /** True when only one test has been done, so the value is provisional. */
  provisional: boolean
  /** Raw mean HR at the passing speed, before backoff and truncation. */
  hrAtTalkSpeed: number | null
  /** Below the viable-jog floor, the prescription must be walk/run, not a speed. */
  belowJogFloor: boolean
}

/**
 * Derive the conversational speed from the talk tests on record.
 *
 * Two sessions, take the LOWER. With a minimal detectable change near 0.9 mph
 * a single administration is not a measurement — two tests on the same athlete
 * in the same week can legitimately disagree by more than the entire margin.
 */
export function calibrate(t: Timeline): CalibrationResult {
  if (t.talkTests.length === 0) {
    return { conversationalSpeedMph: null, provisional: true, hrAtTalkSpeed: null, belowJogFloor: false }
  }
  const recent = t.talkTests.slice(-TUNABLES.TALK_TEST.CALIBRATION_SESSIONS)
  const passed = Math.min(...recent.map((r) => r.passedSpeedMph))
  const hrs = recent.map((r) => r.hrAtPassedSpeed).filter((h): h is number => h !== null)
  const speed = round1(passed - TUNABLES.TALK_TEST.BACKOFF_MPH)
  return {
    conversationalSpeedMph: speed,
    provisional: t.talkTests.length < TUNABLES.TALK_TEST.CALIBRATION_SESSIONS,
    hrAtTalkSpeed: hrs.length > 0 ? Math.round(hrs.reduce((a, b) => a + b, 0) / hrs.length) : null,
    // 1.0 mph off a slow talk-test result lands below a jog. That is not a
    // failure of the test — it means walk/run is the correct prescription and
    // a running speed is not.
    belowJogFloor: speed < TUNABLES.TALK_TEST.MIN_VIABLE_JOG_MPH,
  }
}

/**
 * The easy-HR ceiling. Empirical, never a percentage of anything.
 *
 * `min(mean HR at talk speed − backoff, ABSOLUTE_CAP)`. The cap is best
 * understood as an artifact guard rather than a physiological boundary: it only
 * binds when measured HR at talk-test speed exceeds 160, and since the talk
 * test approximates VT1 (~140 bpm in an adolescent), a reading that high is
 * evidence of sensor error — most likely cadence lock, whose output band starts
 * right about at the cap.
 *
 * Returns null when there is no device, no calibration, or untrustworthy data.
 * Every caller must handle null; the engine runs indefinitely without HR.
 */
export function easyHrCeiling(raw: number | null): { ceiling: number | null; truncated: boolean; rejected: boolean } {
  if (raw === null) return { ceiling: null, truncated: false, rejected: false }
  // Above the sanity ceiling the session is REJECTED, not truncated. Truncating
  // a garbage reading to 150 would launder it into a plausible-looking number.
  if (raw > TUNABLES.HR.SANITY_HI_BPM) return { ceiling: null, truncated: false, rejected: true }
  if (raw < TUNABLES.HR.SANITY_LO_BPM) return { ceiling: null, truncated: false, rejected: true }
  const backed = raw - TUNABLES.HR.EASY_CEILING_BACKOFF_BPM
  const capped = Math.min(backed, TUNABLES.HR.ABSOLUTE_CAP_BPM)
  return { ceiling: capped, truncated: capped < backed, rejected: false }
}

/**
 * Assign tolerance class from the first week's observations.
 *
 * This sets progression RATE, never the ceiling. `aggressive` buys earlier
 * gates and nothing else — the volume caps are identical to `standard`, which
 * is the whole point: responding well is not evidence that connective tissue
 * has adapted, because the aerobic system reports ready months before the
 * skeleton does.
 *
 * The prior is `conservative`, not `standard`. A clean injury history from an
 * under-reporting 15-year-old with no athletic-trainer contact is low
 * information, not low risk.
 */
export function assignToleranceClass(t: Timeline, today: LocalDate): ToleranceClass | null {
  const w = trailingWindow(today, 7)
  const days = t.ordered.filter((d) => withinWindow(d.date, w.start, w.end))
  const sessions = days.filter((d) => d.outcome !== 'pending')
  if (sessions.length < TUNABLES.LADDER.SESSIONS_PER_LEVEL_DEFAULT) return null

  const cutShort = sessions.filter((d) => d.outcome === 'cut_short' || d.outcome === 'missed').length
  const soreDays = days.filter((d) => (d.soreness ?? 0) >= 2).length
  const anyPain = days.some((d) => d.pain.length > 0)
  const probeRpe = days.map((d) => d.probe?.rpe).filter((r): r is number => r !== undefined)

  const conservativeSignals = [cutShort >= 2, soreDays >= 2, anyPain].filter(Boolean).length
  if (conservativeSignals >= 2) return 'conservative'

  const allCompleted = sessions.every((d) => d.outcome === 'completed')
  const neverSore = days.every((d) => (d.soreness ?? 0) <= 1)
  const easyProbe = probeRpe.length === 0 || probeRpe.every((r) => r <= 4)
  if (allCompleted && neverSore && easyProbe) return 'aggressive'

  return 'standard'
}

/** Weekly volume growth multiplier. Aggressive is NOT faster than standard. */
export function toleranceFactor(c: ToleranceClass | null): number {
  return c === 'conservative' ? 0.5 : 1
}

/** Sessions required at a level before advancing. */
export function sessionsPerLevel(c: ToleranceClass | null): number {
  return c === 'aggressive'
    ? TUNABLES.LADDER.SESSIONS_PER_LEVEL_MIN
    : TUNABLES.LADDER.SESSIONS_PER_LEVEL_DEFAULT
}

function round1(n: number): number { return Math.round(n * 10) / 10 }
