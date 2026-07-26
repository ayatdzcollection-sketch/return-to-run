// ============================================================
// PRESCRIBE — one function for every kind of session.
//
// Rest days, calibration, walk/run, continuous runs, re-entry after an
// interrupt, and team participation caps all come out of here. That is
// deliberate: a separate code path per session kind is a separate code path
// that can skip a cap.
// ============================================================

import type { LocalDate } from './dates.ts'
import { dayOfWeek } from './dates.ts'
import type {
  CapRecord, IntervalBlock, Prescription, PrescriptionAudit, PrescriptionKind,
  RationaleCode, SimpleBlock,
} from './types.ts'
import { jogMinutes, longestContinuousJogMin, round1, totalMinutes } from './events.ts'
import { applyLoadCaps, computeWindows } from './load.ts'
import { footwearLimit, heatLimit, surfaceLimit } from './modifiers.ts'
import type { FoldResult } from './fold.ts'
import { isBlocked } from './fold.ts'
import { TUNABLES } from '../config/tunables.ts'
import { buildStructure, ENTRY_GATE_WALK_MIN, levelAt } from '../config/seedPlan.ts'

/** Monday, Wednesday, Friday. */
const RUN_DAYS = [0, 2, 4]

/**
 * Long / short / medium, by weekday.
 *
 * Not cosmetic. Failing to alternate short and long days carried OR 3.0
 * (95% CI 1.4-6.4) for early-season injury in high-school cross-country
 * runners — better prospective support than any volume rule in the build
 * brief, which did not mention it at all. Monday is the medium day because it
 * also carries the weekly probe.
 */
const DAY_FACTOR: Record<number, number> = { 0: 0.85, 2: 0.7, 4: 1.0 }

export interface PrescribeOptions {
  /** Raw forecast WBGT for an outdoor session. Null indoors or unknown. */
  wbgtC?: number | null
  /** Minutes of team practice available, when he has one that day. */
  teamPracticeMin?: number | null
  /** Deterministic id for the emitted prescription. */
  id: string
}

export function prescribe(state: FoldResult, date: LocalDate, opts: PrescribeOptions): Prescription {
  const base = {
    id: opts.id,
    date,
    phase: state.phase,
    inclinePct: TUNABLES.SURFACE.TREADMILL_INCLINE_PCT,
  }

  // ── 1. Blocks, in order of authority ──────────────────────

  if (state.referralRequired) {
    return rest(base, 'forced_rest_pain', [{
      rule: 'referral_required', original: 0, applied: 0,
      note: state.interruptReason ?? 'bone-site pain requires assessment before any running',
    }])
  }

  if (state.interruptKind === 'bone') {
    return rest(base, 'forced_rest_pain', [{
      rule: 'bone_protocol', original: 0, applied: 0,
      note: `pain-free walking and ${TUNABLES.PAIN.HOP_TEST_REPS} pain-free hops on ${TUNABLES.PAIN.BONE_CLEAN_DAYS_REQUIRED} consecutive days before running resumes`,
    }])
  }

  if (isBlocked(state)) {
    const code: RationaleCode = state.gateDue ? 'gate_blocked' : 'forced_rest_pain'
    return rest(base, code, [{
      rule: state.gateDue ? `gate_${state.gateDue}` : 'forced_rest',
      original: 0, applied: 0,
      note: state.interruptReason ?? 'one question to answer first',
    }])
  }

  // ── 2. Calibration comes before anything can be prescribed ──

  if (state.ceilings.conversationalSpeedMph === null) {
    return {
      ...base,
      kind: 'calibration_discovery',
      tier: 'walk_run',
      structure: discoveryStructure(),
      plannedJogMin: TUNABLES.TALK_TEST.LADDER_MAX_MIN,
      plannedTotalMin: 10 + TUNABLES.TALK_TEST.LADDER_MAX_MIN,
      speedCeilingMph: null,
      speedMinMph: TUNABLES.TALK_TEST.LADDER_START_MPH,
      speedMaxMph: round1(TUNABLES.TALK_TEST.LADDER_START_MPH
        + (TUNABLES.TALK_TEST.LADDER_MAX_MIN / TUNABLES.TALK_TEST.LADDER_STEP_MIN) * TUNABLES.TALK_TEST.LADDER_STEP_MPH),
      hrCeiling: null,
      rationaleCode: 'calibration_discovery',
      audit: {
        caps: [{ rule: 'entry_gate', original: ENTRY_GATE_WALK_MIN, applied: ENTRY_GATE_WALK_MIN, note: 'pain-free 30 min brisk walk required before session 1' }],
        binding: null,
      },
    }
  }

  // ── 3. Scheduled rest ─────────────────────────────────────
  // Three runs a week, never consecutive, 48 hours apart. Every located
  // protocol — studied or clinical — prescribes 2-4 days; none prescribes the
  // 5-7 the brief assumed. Tendon net collagen balance is negative for the
  // first 24-36 hours after a loading bout, so a fourth day inside a seven-day
  // week cannot satisfy the spacing rule and is not offered.
  const dow = dayOfWeek(date)
  const isTeamDay = (opts.teamPracticeMin ?? 0) > 0
  if (!RUN_DAYS.includes(dow) && !isTeamDay) {
    return rest(base, 'scheduled_rest', [{
      rule: 'rest_day', original: 0, applied: 0,
      note: `${TUNABLES.FREQUENCY.MIN_HOURS_BETWEEN_RUNS} h between runs`,
    }])
  }

  // ── 4. Build the session ──────────────────────────────────

  const level = levelAt(state.level)
  const dayFactor = DAY_FACTOR[dow] ?? 0.85
  const caps: CapRecord[] = []

  const footwear = footwearLimit(state.footwearState, state.sessionsCompleted)
  if (footwear.record) caps.push(footwear.record)
  const surface = surfaceLimit(state.surface, state.outdoorSessions)
  if (surface.record) caps.push(surface.record)
  const heat = heatLimit(opts.wbgtC ?? null)
  if (heat.record) caps.push(heat.record)

  if (heat.prohibited && state.surface !== 'treadmill') {
    return rest(base, 'scheduled_rest', [...caps, {
      rule: 'heat_unsafe', original: 0, applied: 0, note: 'conditions above the cancel threshold',
    }])
  }
  if (!footwear.outdoorAllowed && state.surface !== 'treadmill') {
    return rest(base, 'held_footwear', [...caps, {
      rule: 'no_running_shoes', original: 0, applied: 0, note: 'outdoor running disabled until running shoes arrive',
    }])
  }

  const desired = level.jogMin * dayFactor * footwear.budgetFactor * surface.durationFactor * heat.durationFactor
  const windows = computeWindows(state.timeline, date)
  const loadResult = applyLoadCaps({
    desiredJogMin: desired,
    windows,
    weekNumber: state.weekNumber,
    isDownWeek: state.isDownWeek,
    toleranceFactor: state.toleranceFactor,
  })
  caps.push(...loadResult.caps)

  let jogMin = loadResult.jogMin
  if (footwear.sessionCapMin !== null && footwear.sessionCapMin < jogMin) {
    caps.push({ rule: 'footwear_session_cap', original: jogMin, applied: footwear.sessionCapMin })
    jogMin = footwear.sessionCapMin
  }

  // ── 5. Team practice becomes a participation cap, not a workout ──
  if (isTeamDay) {
    const capMin = jogMin
    return {
      ...base,
      kind: 'team_capped',
      tier: 'easy',
      structure: [{ kind: 'walk', minutes: 5 }, { kind: 'jog', minutes: capMin }, { kind: 'walk', minutes: 5 }],
      plannedJogMin: capMin,
      plannedTotalMin: capMin + 10,
      speedCeilingMph: state.ceilings.speedCeilingMph,
      speedMinMph: null,
      speedMaxMph: state.ceilings.speedCeilingMph,
      hrCeiling: state.ceilings.easyHrCeiling,
      teamCapMin: capMin,
      rationaleCode: 'team_cap',
      audit: {
        caps: [...caps, {
          rule: 'team_participation_cap',
          original: opts.teamPracticeMin ?? 0,
          applied: capMin,
          note: 'cap derives from his own trailing sessions, never from what the team is doing',
        }],
        binding: 'team_participation_cap',
      },
    }
  }

  // ── 6. Scale the ladder structure to the allowed minutes ──
  const structure = scaleStructure(buildStructure(level), jogMin)
  const actualJog = jogMinutes(structure)
  const kind: PrescriptionKind = state.daysSinceLastRun !== null && state.daysSinceLastRun >= 7
    ? 're_entry'
    : longestContinuousJogMin(structure) === actualJog && actualJog > 0
      ? 'continuous'
      : 'walk_run'

  const rationaleCode: RationaleCode = kind === 're_entry' ? 're_entry_silence'
    : state.isDownWeek ? 'down_week'
      : loadResult.binding === 'session_cap' ? 'held_weekly_cap'
        : loadResult.binding === 'down_week' ? 'down_week'
          : heat.level !== 'none' ? 'held_surface_transition'
            : surface.record ? 'held_surface_transition'
              : footwear.record ? 'held_footwear'
                : dow === 0 ? 'probe_day'
                  : 'progression_duration'

  return {
    ...base,
    kind,
    tier: state.phase === 'P0' ? 'walk_run' : 'easy',
    structure,
    plannedJogMin: actualJog,
    plannedTotalMin: totalMinutes(structure),
    speedCeilingMph: state.ceilings.speedCeilingMph,
    speedMinMph: state.ceilings.speedCeilingMph === null ? null : round1(state.ceilings.speedCeilingMph - 0.4),
    speedMaxMph: state.ceilings.speedCeilingMph,
    // HR governs easy running only, and only for the first 20 minutes. It is
    // never applied to P4 interval reps: HR lags effort by 30-60 s, so by the
    // time the number arrives the rep is over.
    hrCeiling: state.phase === 'P4' ? null : state.ceilings.easyHrCeiling,
    rationaleCode,
    audit: { caps, binding: loadResult.binding },
  }
}

// ── Helpers ─────────────────────────────────────────────────

function rest(
  base: { id: string; date: LocalDate; phase: import('./types.ts').Phase; inclinePct: number },
  code: RationaleCode,
  caps: CapRecord[],
): Prescription {
  return {
    ...base,
    kind: 'rest',
    tier: 'rest',
    structure: [],
    plannedJogMin: 0,
    plannedTotalMin: 0,
    speedCeilingMph: null,
    speedMinMph: null,
    speedMaxMph: null,
    hrCeiling: null,
    rationaleCode: code,
    audit: { caps, binding: caps[0]?.rule ?? null },
  }
}

function discoveryStructure(): IntervalBlock[] {
  return [
    { kind: 'walk', minutes: 5 },
    { kind: 'jog', minutes: TUNABLES.TALK_TEST.LADDER_MAX_MIN },
    { kind: 'walk', minutes: 5 },
  ]
}

/**
 * Shrink a level's structure to fit an allowed jog-minute budget.
 *
 * Repeat-based levels lose repetitions rather than shortening each interval —
 * the interval length is the thing being trained, so cutting it would change
 * what the session is. Levels built from explicit jog blocks scale those blocks
 * proportionally instead.
 */
export function scaleStructure(structure: readonly IntervalBlock[], targetJogMin: number): IntervalBlock[] {
  const current = jogMinutes(structure)
  if (current <= 0 || targetJogMin >= current) return [...structure]
  if (targetJogMin <= 0) return structure.filter((b) => b.kind === 'walk')

  const factor = targetJogMin / current
  const hasRepeat = structure.some((b) => b.kind === 'repeat')

  return structure.map((b): IntervalBlock => {
    if (b.kind === 'repeat') {
      return { ...b, times: Math.max(1, Math.round(b.times * factor)) }
    }
    if (hasRepeat || b.kind === 'walk') return b
    if (b.kind === 'jog') return { ...b, minutes: Math.max(1, roundHalf(b.minutes * factor)) }
    return b
  })
}

function roundHalf(n: number): number { return Math.round(n * 2) / 2 }

export type { SimpleBlock, PrescriptionAudit }
