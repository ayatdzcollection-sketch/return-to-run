// ============================================================
// DOMAIN TYPES — the contracts every other engine module compiles against.
//
// Two rules shape everything in this file:
//
//   1. MINUTES ARE THE UNIT (invariant 1). There is no distance field on any
//      prescription, any event, or any state value. Treadmill belt calibration
//      is unreliable and this athlete's speed is derived from a talk test, not
//      measured — so distance is not merely untrusted, it is absent. If you
//      find yourself wanting to add one, the answer is no.
//
//   2. THE LOG IS THE TRUTH. Every value in AthleteState is computed by folding
//      events (see fold.ts). Nothing here is written by hand or persisted as
//      mutable state. Interrupts, decay, and ceiling changes are DERIVATIONS,
//      not commands — which is what makes them impossible to forget or to
//      apply twice.
// ============================================================

import type { LocalDate } from './dates.ts'

// ── Phases ──────────────────────────────────────────────────
// Phases move DOWN freely (pain interrupt, silence decay) and UP only through
// the gates in phases.ts. See brief §5.
export const PHASES = ['P0', 'P1', 'P2', 'P3', 'P4'] as const
export type Phase = (typeof PHASES)[number]

/** Ordinal for comparison and for the "phase −1" interrupt. */
export function phaseIndex(p: Phase): number { return PHASES.indexOf(p) }
export function phaseFromIndex(i: number): Phase {
  const clamped = Math.max(0, Math.min(PHASES.length - 1, i))
  return PHASES[clamped]!
}

// ── Session tiers ───────────────────────────────────────────
// Ordered by intensity. Invariant 4: nothing above `strides` unlocks before 8
// unbroken weeks. Invariant 5: no two consecutive days above `easy`.
export const TIERS = ['rest', 'walk', 'walk_run', 'easy', 'strides', 'hills', 'threshold'] as const
export type SessionTier = (typeof TIERS)[number]

export function tierIndex(t: SessionTier): number { return TIERS.indexOf(t) }
/** True for tiers that count as "above easy" for the consecutive-day rule. */
export function isAboveEasy(t: SessionTier): boolean { return tierIndex(t) > tierIndex('easy') }

// ── Simple enumerations ─────────────────────────────────────
export type ToleranceClass = 'conservative' | 'standard' | 'aggressive'
export type HrConfidence = 'none' | 'low' | 'usable'
export type FootwearState = 'none' | 'non_running' | 'new_under_50mi' | 'broken_in'
export type Surface = 'treadmill' | 'road' | 'mixed'
export type GateId = 'pre_20min' | 'pre_team' | 'post_pain'

/**
 * Where it hurts.
 *
 * The `bony` flag is the load-bearing part: invariant 8 escalates pain at a
 * bony landmark at ANY severity, because that is the presentation of a bone
 * stress injury and a 15-year-old will rate it low and keep running. Muscular
 * locations escalate only at the severity threshold.
 */
export const PAIN_LOCATIONS = {
  shin:          { label: 'Shin (front of lower leg)', bony: true },
  top_of_foot:   { label: 'Top of foot',               bony: true },
  heel:          { label: 'Heel bone',                 bony: true },
  ankle_bone:    { label: 'Ankle bone',                bony: true },
  kneecap:       { label: 'Kneecap',                   bony: true },
  hip_bone:      { label: 'Hip bone / groin crease',   bony: true },
  achilles:      { label: 'Achilles tendon',           bony: false },
  arch:          { label: 'Arch of foot',              bony: false },
  calf:          { label: 'Calf',                      bony: false },
  hamstring:     { label: 'Hamstring',                 bony: false },
  quad:          { label: 'Thigh (front)',             bony: false },
  glute:         { label: 'Glute / buttock',           bony: false },
  knee_general:  { label: 'Knee (general ache)',       bony: false },
  hip_general:   { label: 'Hip (general ache)',        bony: false },
  other:         { label: 'Somewhere else',            bony: false },
} as const

export type PainLocation = keyof typeof PAIN_LOCATIONS
export function isBonyLocation(loc: PainLocation): boolean { return PAIN_LOCATIONS[loc].bony }

// ── Session structure ───────────────────────────────────────
// A prescription is a list of blocks. `repeat` nests exactly one level, which
// is enough for every structure this engine generates ("5 min walk, then 8x
// (1 min jog / 2 min walk), then 5 min walk") and keeps minute-counting
// total and obviously correct.

export type SimpleBlock =
  | { kind: 'walk'; minutes: number }
  | { kind: 'jog'; minutes: number }
  /** P4 only. Brief accelerations; counted as jogging minutes for load. */
  | { kind: 'strides'; count: number; seconds: number }

export type IntervalBlock = SimpleBlock | { kind: 'repeat'; times: number; blocks: SimpleBlock[] }

// ── Prescriptions ───────────────────────────────────────────

export type PrescriptionKind =
  | 'rest'                     // forced or scheduled; structure is empty
  | 'calibration_discovery'    // P0 session 1: the talk-test speed ladder
  | 'calibration_observation'  // P0 sessions 2-5: fixed structure, observe
  | 'walk_run'                 // the main P1 progression
  | 'continuous'               // P2+
  | 'team_capped'              // P3: a participation cap, not a workout
  | 're_entry'                 // after silence decay or a pain interrupt

/**
 * One cap that was consulted while building a prescription.
 *
 * Every clamp is recorded with the value it replaced — invariant 7 requires it
 * for ACWR specifically, and there is no reason the other caps should be less
 * auditable. `audit.binding` names the single rule that actually determined
 * the final number, which is what the rationale sentence is built from.
 */
export interface CapRecord {
  rule: string
  original: number
  applied: number
  note?: string
}

export interface PrescriptionAudit {
  caps: CapRecord[]
  /** The rule that bound — i.e. produced the lowest value. Null when nothing capped. */
  binding: string | null
}

export interface Prescription {
  id: string
  date: LocalDate
  phase: Phase
  kind: PrescriptionKind
  tier: SessionTier
  structure: IntervalBlock[]
  /** Jogging minutes only. Walking is not load. Invariant 1. */
  plannedJogMin: number
  /** Everything including walk portions — what the session costs in wall time. */
  plannedTotalMin: number
  /**
   * The belt speed. `ceiling` is the control (invariant 11) and is what the UI
   * shows prominently; min/max frame it. Null on rest days and during speed
   * discovery, where the ladder defines its own speeds.
   */
  speedCeilingMph: number | null
  speedMinMph: number | null
  speedMaxMph: number | null
  /**
   * Empirical easy-HR ceiling, or null when there is no device, no calibration
   * yet, or HR is not trustworthy. NEVER derived from a maximum heart rate
   * (invariant 13) — it is measured at the talk-test speed and then truncated.
   * Not applied to P4 interval reps (HR lags effort; see brief §8).
   */
  hrCeiling: number | null
  inclinePct: number
  /** P3 only: minutes of team practice to participate in before peeling off. */
  teamCapMin?: number
  rationaleCode: RationaleCode
  audit: PrescriptionAudit
}

// ── Rationale codes ─────────────────────────────────────────
// The narrative layer maps these to sentences (src/lib/narrative.ts). The
// engine only ever emits a code — it never writes prose, and prose never
// feeds back into state (brief §15).
export const RATIONALE_CODES = [
  'seed_prior',
  'calibration_discovery',
  'calibration_observation',
  'progression_frequency',
  'progression_duration',
  'progression_continuity',
  'progression_intensity',
  'held_weekly_cap',
  'held_session_cap',
  'held_longest_session',
  'held_footwear',
  'held_surface_transition',
  'down_week',
  'forced_rest_pain',
  'forced_rest_consecutive',
  'scheduled_rest',
  're_entry_silence',
  're_entry_pain',
  'team_cap',
  'probe_day',
  'gate_blocked',
  'ceiling_lowered_drift',
  'ceiling_lowered_hr_breach',
  'ceiling_raised_probe',
] as const
export type RationaleCode = (typeof RATIONALE_CODES)[number]

// ── Events ──────────────────────────────────────────────────
// APPEND ONLY. The log is a grow-only set: events are never edited, never
// deleted, and merging two devices is set union. Combined with a fold that
// sorts before reducing, that makes state convergent without any conflict
// resolution at all.

export interface EventBase {
  /** ULID — globally unique and lexicographically time-ordered. */
  id: string
  /** ISO datetime with offset, device wall clock at creation. Audit + tiebreak. */
  at: string
  /** The athlete-local calendar day this event is ABOUT. The fold key. */
  date: LocalDate
  /** Per-event payload version, for additive migration on read. */
  schema: number
}

export type StopReason = 'breathing_change' | 'nasal_breathing_lost' | 'time_limit' | 'other'

export type AppEvent = EventBase &
  (
    /** Implicit confirmation that he is still engaging. Silence decay watches this. */
    | { type: 'app_open' }
    /**
     * The engine's output for a date, frozen at the moment it was first shown.
     *
     * Prescriptions are events for three reasons: a `session_completed` then
     * carries no numbers (exception-only reporting), tunable changes cannot
     * retroactively rewrite what he was actually told to do, and the audit
     * trail of clamps survives with it.
     */
    | { type: 'prescription_issued'; prescription: Prescription }
    | { type: 'session_completed'; prescriptionId: string }
    | { type: 'session_cut_short'; prescriptionId: string; jogMinDone: number }
    | { type: 'session_missed'; prescriptionId: string | null }
    /** Team practice or any run the engine did not prescribe. Counts identically. */
    | { type: 'external_session'; durationMin: number; surface: Surface; intensityGuess: 'easy' | 'mixed' | 'hard' }
    | {
        type: 'pain_reported'
        location: PainLocation
        /** 0-10. Invariant 8 escalates at >= threshold, or at ANY value if bony. */
        severity: number
        gaitAltering: boolean
        when: 'during' | 'after' | 'next_am'
      }
    | { type: 'felt_awful' }
    /** Next-morning soreness, one tap. Feeds tolerance_class. */
    | { type: 'soreness_reported'; score: 0 | 1 | 2 | 3 }
    /** P0 session 1 output: the speed ladder and where it stopped. */
    | {
        type: 'talk_test_result'
        steps: { speedMph: number; meanHrLast60s: number | null }[]
        /** The speed of the last step COMPLETED before the stop criterion hit. */
        passedSpeedMph: number
        stopReason: StopReason
      }
    /** Monday, first 5 minutes at the frozen probe speed. RPE always; HR when trusted. */
    | { type: 'probe_result'; fixedSpeedMph: number; rpe: number; hrAtMin5: number | null }
    /**
     * The reduced output of the HR quality pipeline for one session. Raw samples
     * live in a side store and never enter the fold — thousands of rows per run
     * would swamp it, and the fold only needs the conclusions.
     */
    | {
        type: 'hr_summary'
        prescriptionId: string | null
        meanFirst10: number | null
        meanFirst20: number | null
        meanMin15to25: number | null
        peakFirst20: number | null
        sampleCount: number
        discardedPct: number
        confidence: HrConfidence
      }
    | { type: 'gate_answered'; gate: GateId; answer: string }
    | {
        type: 'profile_updated'
        footwearState?: FootwearState
        surface?: Surface
        hrDevicePresent?: boolean
      }
    | { type: 'note'; text: string }
  )

export type AppEventType = AppEvent['type']

/**
 * An event minus the fields the storage layer stamps on.
 *
 * Distributed over the union deliberately: a plain `Omit<AppEvent, ...>`
 * collapses a discriminated union into one object type carrying only the keys
 * every member shares, so `prescription`, `location` and the rest would stop
 * type-checking at every call site.
 */
export type EventDraft<T = AppEvent> = T extends AppEvent
  ? Omit<T, 'id' | 'at' | 'schema'>
  : never

/** Narrowing helper: `isEvent(e, 'pain_reported')` gives the full payload type. */
export function isEvent<T extends AppEventType>(
  e: AppEvent,
  type: T,
): e is Extract<AppEvent, { type: T }> {
  return e.type === type
}

// ── Athlete state ───────────────────────────────────────────

export interface LoadState {
  /** Rolling 7-day jogging minutes. */
  acuteMin: number
  /** Rolling 28-day jogging minutes, expressed per-week (total / 4). */
  chronicMin: number
  /** Null until there is enough history for the ratio to mean anything. */
  acwr: { raw: number; clamped: number } | null
  /** Completed jogging minutes in the current Monday-anchored week. */
  thisWeekMin: number
  /** The baseline invariant 2 grows from: the last completed BUILD week. */
  lastBuildWeekMin: number | null
  /** Scaled down when he has stopped opening the app. See interrupts.ts. */
  silenceDecayFactor: number
}

export interface CeilingState {
  /** Talk-test speed minus the safety margin. Null before calibration. */
  conversationalSpeedMph: number | null
  /** The number on the belt. Ratchets down freely, rises only on probe evidence. */
  speedCeilingMph: number | null
  /** Empirical, truncated by the absolute cap. Null without usable HR. */
  easyHrCeiling: number | null
  /** Frozen at calibration; the probe always runs here so HR is comparable. */
  probeSpeedMph: number | null
}

export interface AthleteState {
  today: LocalDate
  phase: Phase
  toleranceClass: ToleranceClass | null
  ceilings: CeilingState
  load: LoadState

  hrDevicePresent: boolean
  hrConfidence: HrConfidence

  /** Longest continuous jog block completed to date. Gates P1 -> P2. */
  continuousCapacityMin: number
  /** After footwear and down-week modifiers. */
  weeklyImpactBudgetMin: number

  footwearState: FootwearState
  surface: Surface

  /** Null when not in a pain interrupt; otherwise the last forced-rest day. */
  forcedRestUntil: LocalDate | null
  /** Non-null blocks prescription until answered. */
  gateDue: GateId | null

  daysSinceLastRun: number | null
  daysSinceLastAppOpen: number
  lastRecalibrationAt: LocalDate | null
  recalibrationDue: boolean

  /** Aerobic-drift breaches inside the rolling window. Two -> ceilings drop. */
  driftEvents: number
  probeTrend: 'falling' | 'flat' | 'rising' | 'insufficient'
  /** Raised when neither HR nor RPE has improved across the flag window. */
  probeStagnantFlag: boolean

  /** Consecutive weeks with at least one run and no interrupt. Gates P4 tiers. */
  unbrokenWeeks: number
  /** 1-based index of the current week since the first session. */
  weekNumber: number
  isDownWeek: boolean

  sessionsCompleted: number
  audit: StateAudit
}

/** Everything the fold decided and why, for the detail view and for tests. */
export interface StateAudit {
  notes: string[]
  clamps: CapRecord[]
}
