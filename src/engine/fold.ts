// ============================================================
// THE FOLD — events in, athlete state out. Nothing is ever stored.
//
// computeState(events, today) is a pure function. The same log and the same
// date produce the same state on any device, in any timezone, at any hour.
// That is what makes every invariant test in this suite a statement about what
// the athlete will actually see, rather than about a snapshot somebody wrote.
//
// Interrupts, silence decay, ceiling changes and recalibration all happen HERE,
// as derivations. There is no `applyPainInterrupt()` to forget to call.
// ============================================================

import type { LocalDate } from './dates.ts'
import { addDays, diffDays, mondayOf, weeksBetween } from './dates.ts'
import type { AthleteState, HrConfidence, ToleranceClass } from './types.ts'
import { buildTimeline, type Timeline } from './timeline.ts'
import { computeWindows } from './load.ts'
import {
  assignToleranceClass, calibrate, easyHrCeiling, sessionsPerLevel, toleranceFactor,
} from './calibration.ts'
import {
  bestContinuous, computeLadder, computePhase, computeUnbrokenWeeks, demote,
  painFreeSince, recentSoreness,
} from './phases.ts'
import { blocksRunning, computeGateDue, computeInterrupt, computeSilence } from './interrupts.ts'
import { computeProbe } from './modifiers.ts'
import { breachedCeiling, evaluateDrift } from './hr.ts'
import { TUNABLES } from '../config/tunables.ts'
import { FIRST_LEVEL } from '../config/seedPlan.ts'

export interface FoldResult extends AthleteState {
  timeline: Timeline
  level: number
  sessionsAtLevel: number
  cleanSessionsAtLevel: number
  outdoorSessions: number
  interruptKind: 'none' | 'soft' | 'bone' | 'referral'
  referralRequired: boolean
  interruptReason: string | null
  ceilingProvisional: boolean
  belowJogFloor: boolean
  toleranceFactor: number
  sessionsNeededPerLevel: number
}

export function computeState(events: readonly import('./types.ts').AppEvent[], today: LocalDate): FoldResult {
  const t = buildTimeline(events)
  const audit = { notes: [] as string[], clamps: [] as import('./types.ts').CapRecord[] }

  // ── Calendar position ─────────────────────────────────────
  const weekNumber = t.firstDate ? weeksBetween(today, t.firstDate) + 1 : 1
  // Not skippable, not deferrable, and tolerance class does not exempt it.
  const isDownWeek = weekNumber > 0 && weekNumber % TUNABLES.DOWN_WEEK.EVERY_N_WEEKS === 0

  // ── Interrupts, computed before anything that depends on them ──
  const interrupt = computeInterrupt(t, today)
  const silence = computeSilence(t, today)
  const interrupted = interrupt.kind !== 'none'

  // ── Ladder and phase ──────────────────────────────────────
  const toleranceClass: ToleranceClass | null = assignToleranceClass(t, today)
  const needed = sessionsPerLevel(toleranceClass)
  const ladder = computeLadder(t, needed)
  const unbrokenWeeks = computeUnbrokenWeeks(t, today)
  const bestCont = bestContinuous(t)
  const sessionsLogged = t.ordered.filter((d) => d.outcome === 'completed' || d.outcome === 'cut_short').length
  const teamWeeksCapped = countTeamWeeks(t)

  let phase = computePhase({
    sessionsLogged,
    toleranceAssigned: toleranceClass !== null,
    bestContinuousMin: bestCont,
    worstRecentSoreness: recentSoreness(t, today),
    painFree7d: painFreeSince(t, today, 7),
    unbrokenWeeks,
    teamWeeksCapped,
    interrupted,
  })

  // Phases fall freely. A pain interrupt drops one; so does going silent. Both
  // are derived, so neither can be skipped by not opening the app — which is
  // precisely the case the silence rule exists for.
  if (interrupted) { phase = demote(phase); audit.notes.push(`phase demoted: ${interrupt.reason}`) }
  if (silence.decayed) { phase = demote(phase); audit.notes.push(`phase demoted: ${silence.daysSinceOpen} days without opening the app`) }

  // ── Load ──────────────────────────────────────────────────
  const windows = computeWindows(t, today)
  const chronicDecayed = windows.chronicMin * silence.factor
  if (silence.decayed) {
    audit.clamps.push({
      rule: 'silence_decay', original: windows.chronicMin, applied: chronicDecayed,
      note: `no app open for ${silence.daysSinceOpen} days`,
    })
  }

  // ── Heart rate ────────────────────────────────────────────
  const cal = calibrate(t)
  const hrConfidence = latestHrConfidence(t)
  const hrCeilingRaw = easyHrCeiling(cal.hrAtTalkSpeed)
  if (hrCeilingRaw.truncated) {
    audit.clamps.push({
      rule: 'hr_absolute_cap', original: (cal.hrAtTalkSpeed ?? 0) - TUNABLES.HR.EASY_CEILING_BACKOFF_BPM,
      applied: TUNABLES.HR.ABSOLUTE_CAP_BPM, note: 'artifact guard, not a zone',
    })
  }
  if (hrCeilingRaw.rejected && cal.hrAtTalkSpeed !== null) {
    audit.notes.push(`HR of ${cal.hrAtTalkSpeed} at talk-test speed is outside the plausible band — treated as sensor error, not accepted`)
  }

  // ── Ceilings: ratchet down freely, rise only on probe evidence ──
  const probe = computeProbe(t, today)
  const { driftEvents, ceilingBreaches } = countBreaches(t, hrCeilingRaw.ceiling)
  // Two different signals with two different urgencies. Aerobic drift is
  // inferential — it says the pace was probably above easy — so it takes two
  // occurrences. A ceiling breach is direct: his measured easy ceiling was
  // exceeded while the belt sat at the prescribed speed, which means the speed
  // is wrong now, not eventually.
  const drops = Math.floor(driftEvents / TUNABLES.HR.DRIFT_EVENTS_BEFORE_DROP) + ceilingBreaches
  const driftBreaches = driftEvents + ceilingBreaches

  let speedCeiling = cal.conversationalSpeedMph
  let hrCeiling = hrCeilingRaw.ceiling
  if (drops > 0 && speedCeiling !== null) {
    const dropped = round1(speedCeiling - drops * TUNABLES.HR.DRIFT_AUTODROP_SPEED_MPH)
    audit.clamps.push({ rule: 'drift_autodrop_speed', original: speedCeiling, applied: dropped, note: `${driftBreaches} drift events` })
    speedCeiling = dropped
  }
  if (drops > 0 && hrCeiling !== null) {
    const dropped = hrCeiling - drops * TUNABLES.HR.DRIFT_AUTODROP_HR_BPM
    audit.clamps.push({ rule: 'drift_autodrop_hr', original: hrCeiling, applied: dropped, note: `${driftBreaches} drift events` })
    hrCeiling = dropped
  }
  // The ONLY path that raises a ceiling. Not feeling good, not asking.
  if (probe.mayRaiseCeiling && speedCeiling !== null) {
    speedCeiling = round1(speedCeiling + TUNABLES.PROBE.RAISE_STEP_MPH)
    audit.notes.push(`ceiling raised on ${probe.consecutiveImprovements} weeks of falling probe HR at fixed speed`)
  }

  // ── Gates ─────────────────────────────────────────────────
  const aboutToRun20 = bestCont < 20 && ladder.level >= 8
  const aboutToJoinTeam = phase === 'P3' && teamWeeksCapped === 0
  const gateDue = computeGateDue(t, { aboutToRun20Continuous: aboutToRun20, aboutToJoinTeam, interrupt })

  // ── Recalibration ─────────────────────────────────────────
  const lastRecal = t.talkTests.at(-1)?.date ?? null
  const recalibrationDue = lastRecal === null
    || diffDays(today, lastRecal) >= TUNABLES.RECALIBRATION.INTERVAL_DAYS
    || interrupted

  const outdoorSessions = t.ordered.filter((d) => d.jogMin > 0 && t.profile.surface !== 'treadmill').length

  return {
    today,
    phase,
    toleranceClass,
    ceilings: {
      conversationalSpeedMph: cal.conversationalSpeedMph,
      speedCeilingMph: speedCeiling,
      easyHrCeiling: hrCeiling,
      probeSpeedMph: t.ordered.find((d) => d.probe)?.probe?.fixedSpeedMph ?? cal.conversationalSpeedMph,
    },
    load: {
      acuteMin: windows.acuteMin,
      chronicMin: round1(chronicDecayed),
      acwr: null, // Deliberately absent. See load.ts and RESEARCH.md §A6.
      thisWeekMin: windows.thisWeekMin,
      lastBuildWeekMin: windows.lastBuildWeekMin,
      silenceDecayFactor: silence.factor,
    },
    hrDevicePresent: t.profile.hrDevicePresent,
    hrConfidence,
    continuousCapacityMin: bestCont,
    weeklyImpactBudgetMin: round1((windows.lastBuildWeekMin ?? 0) * TUNABLES.LOAD.WEEKLY_GROWTH_MAX),
    footwearState: t.profile.footwearState,
    surface: t.profile.surface,
    forcedRestUntil: interrupt.restUntil,
    gateDue,
    daysSinceLastRun: windows.daysSinceLastRun,
    daysSinceLastAppOpen: silence.daysSinceOpen,
    lastRecalibrationAt: lastRecal,
    recalibrationDue,
    driftEvents: driftBreaches,
    probeTrend: probe.trend,
    probeStagnantFlag: probe.stagnant,
    unbrokenWeeks,
    weekNumber,
    isDownWeek,
    sessionsCompleted: sessionsLogged,
    audit,

    // Extras the prescriber needs that are not part of the brief's state vector.
    timeline: t,
    level: Math.max(FIRST_LEVEL, ladder.level),
    sessionsAtLevel: ladder.sessionsAtLevel,
    cleanSessionsAtLevel: ladder.cleanSessionsAtLevel,
    outdoorSessions,
    interruptKind: interrupt.kind,
    referralRequired: interrupt.referralRequired,
    interruptReason: interrupt.reason,
    ceilingProvisional: cal.provisional,
    belowJogFloor: cal.belowJogFloor,
    toleranceFactor: toleranceFactor(toleranceClass),
    sessionsNeededPerLevel: needed,
  }
}

/** True when no session may be prescribed today. */
export function isBlocked(state: FoldResult): boolean {
  if (state.gateDue !== null) return true
  return blocksRunning(
    { kind: state.interruptKind, restUntil: state.forcedRestUntil, since: null, cleanDays: 0, referralRequired: state.referralRequired, reason: state.interruptReason },
    state.today,
  )
}

function latestHrConfidence(t: Timeline): HrConfidence {
  for (let i = t.ordered.length - 1; i >= 0; i--) {
    const hr = t.ordered[i]!.hr
    if (hr) return hr.confidence
  }
  return 'none'
}

/**
 * Count drift breaches across the whole log, not a rolling window.
 *
 * Invariant 12 says ceilings ratchet DOWN freely and rise only on probe
 * evidence. A rolling count would let a drop expire on its own after two weeks,
 * which is a rise without evidence. Cumulative counting is the conservative
 * reading and the one that matches the invariant.
 */
function countBreaches(t: Timeline, hrCeiling: number | null): { driftEvents: number; ceilingBreaches: number } {
  let driftEvents = 0
  let ceilingBreaches = 0
  for (const d of t.ordered) {
    if (!d.hr || !d.prescription) continue
    const verdict = evaluateDrift({
      meanFirst10: d.hr.meanFirst10,
      meanMin15to25: d.hr.meanMin15to25,
      sessionMin: d.prescription.plannedTotalMin,
      confidence: d.hr.confidence,
      // No weather integration in v1: indoor treadmill sessions sit inside the
      // reference thermal band by default. When outdoor environment data
      // arrives it is supplied here and the verdict becomes unassessable in
      // heat rather than being corrected by an uncertain coefficient.
      wbgtC: null,
    })
    if (verdict === 'too_fast') driftEvents++
    // The ceiling applies to the first 20 minutes only; drift beyond that is
    // expected at constant pace and is not a breach.
    if (breachedCeiling(d.hr.meanFirst20, hrCeiling, d.hr.confidence)) ceilingBreaches++
  }
  return { driftEvents, ceilingBreaches }
}

function countTeamWeeks(t: Timeline): number {
  const weeks = new Set<string>()
  for (const d of t.ordered) if (d.externalMin > 0) weeks.add(mondayOf(d.date))
  return weeks.size
}

function round1(n: number): number { return Math.round(n * 10) / 10 }

export { addDays }
