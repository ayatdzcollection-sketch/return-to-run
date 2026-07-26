// ============================================================
// INTERRUPTS — pain, silence, and the gates that block a prescription.
//
// These are DERIVATIONS, not commands. Nothing calls `applyPainInterrupt()`;
// the fold recomputes the interrupt state from the log every time it runs. No
// code path can forget to apply one, apply one twice, or let one expire early,
// which is the only way "mechanical, not advisory" can actually be true when
// the athlete is motivated to route around it.
// ============================================================

import type { LocalDate } from './dates.ts'
import { addDays, diffDays, trailingWindow, withinWindow } from './dates.ts'
import type { GateId } from './types.ts'
import type { DayRecord, PainRecord, Timeline } from './timeline.ts'
import { TUNABLES } from '../config/tunables.ts'

export type InterruptKind = 'none' | 'soft' | 'bone' | 'referral'

export interface InterruptState {
  kind: InterruptKind
  /** Last forced-rest day, inclusive. Null for a bone interrupt — see below. */
  restUntil: LocalDate | null
  since: LocalDate | null
  /** Bone branch: consecutive clean days accumulated toward the re-entry gate. */
  cleanDays: number
  /** Bone branch: true once this stops being something to self-manage. */
  referralRequired: boolean
  reason: string | null
}

const NO_INTERRUPT: InterruptState = {
  kind: 'none', restUntil: null, since: null, cleanDays: 0, referralRequired: false, reason: null,
}

/**
 * Does this pain report escalate, and how far?
 *
 * Severity alone is the weakest of the three tests and deliberately not the
 * first. Pain severity correlates poorly with radiological severity in bone
 * stress injury, and it is the one input a motivated 15-year-old can shade
 * downward at no cost — so location and function trigger independently of it.
 */
export function classifyPain(p: PainRecord): InterruptKind {
  // Any pain on a bony landmark, at ANY severity. This is the rule the
  // evidence supports most strongly, and the one he is most likely to
  // under-report his way past.
  if (p.bony) return 'bone'
  // Gait change means the tissue is failing under load, not warming up.
  if (p.gaitAltering) return 'bone'
  // Pain at rest or waking him at night is a LATE sign, not an early one.
  if (p.when === 'next_am' && p.severity >= TUNABLES.PAIN.SEVERITY_INTERRUPT) return 'soft'
  if (p.severity >= TUNABLES.PAIN.SEVERITY_INTERRUPT) return 'soft'
  return 'none'
}

/**
 * Current interrupt state, derived from the whole log.
 *
 * The two branches differ in kind, not degree:
 *
 *   soft — a countdown. Muscular, non-bony, resolves on a timer.
 *   bone — NEVER a countdown. A fixed 3-day timer manufactures a false
 *          "cleared" state when conservative tibial bone stress injury
 *          management runs 6-27 weeks. It exits only on consecutive clean
 *          days, and if it has not cleared within the referral window, or
 *          recurs at the same site, it stops being ours to manage.
 */
export function computeInterrupt(t: Timeline, today: LocalDate): InterruptState {
  let state: InterruptState = { ...NO_INTERRUPT }

  for (const d of t.ordered) {
    if (d.date > today) break

    // A clean day advances a bone interrupt toward its re-entry gate.
    if (state.kind === 'bone' && d.pain.length === 0) {
      state = { ...state, cleanDays: state.cleanDays + 1 }
      if (state.cleanDays >= TUNABLES.PAIN.BONE_CLEAN_DAYS_REQUIRED) state = { ...NO_INTERRUPT }
    }

    for (const p of d.pain) {
      const kind = classifyPain(p)
      if (kind === 'none') continue

      if (kind === 'bone') {
        // A second bony trigger inside the recurrence window ends self-management.
        const recurred = state.kind === 'bone' || hadRecentBonyPain(t, d.date, p.location)
        state = {
          kind: recurred ? 'referral' : 'bone',
          restUntil: null,
          since: d.date,
          cleanDays: 0,
          referralRequired: recurred,
          reason: recurred
            ? `pain at ${p.location} returned within ${TUNABLES.PAIN.BONE_RECURRENCE_WINDOW_DAYS} days`
            : `pain at ${p.location}`,
        }
      } else if (state.kind === 'none') {
        state = {
          kind: 'soft',
          restUntil: addDays(d.date, TUNABLES.PAIN.NON_BONY_REST_DAYS),
          since: d.date,
          cleanDays: 0,
          referralRequired: false,
          reason: `${p.location} pain at ${p.severity}/10`,
        }
      }
    }
  }

  // A soft interrupt expires on its own; a bone interrupt escalates instead.
  if (state.kind === 'soft' && state.restUntil && today > state.restUntil) return { ...NO_INTERRUPT }
  if (state.kind === 'bone' && state.since
      && diffDays(today, state.since) > TUNABLES.PAIN.BONE_REFERRAL_AFTER_DAYS) {
    return { ...state, kind: 'referral', referralRequired: true, reason: `${state.reason} — not clear after ${TUNABLES.PAIN.BONE_REFERRAL_AFTER_DAYS} days` }
  }
  return state
}

function hadRecentBonyPain(t: Timeline, on: LocalDate, location: string): boolean {
  const w = trailingWindow(addDays(on, -1), TUNABLES.PAIN.BONE_RECURRENCE_WINDOW_DAYS)
  return t.ordered.some((d) =>
    withinWindow(d.date, w.start, w.end) && d.pain.some((p) => p.location === location && p.bony))
}

/** True when no session may be prescribed on this date. */
export function blocksRunning(state: InterruptState, today: LocalDate): boolean {
  if (state.kind === 'none') return false
  if (state.kind === 'soft') return !!state.restUntil && today <= state.restUntil
  return true
}

// ── Silence decay ───────────────────────────────────────────
// Assume-completed is only valid while he is opening the app: opening it and
// not logging an exception is an implicit confirmation. Once that stops, the
// engine knows nothing, and "nothing" must not be read as "as prescribed" —
// that path hands a detrained kid week six of the plan.

export interface SilenceState {
  daysSinceOpen: number
  decayed: boolean
  /** Multiplier applied to chronic load. 1 when he is engaging. */
  factor: number
}

export function computeSilence(t: Timeline, today: LocalDate): SilenceState {
  const days = t.lastOpenDate === null ? Number.POSITIVE_INFINITY : diffDays(today, t.lastOpenDate)
  if (!Number.isFinite(days) || days < TUNABLES.SILENCE.TRIGGER_DAYS) {
    return { daysSinceOpen: Number.isFinite(days) ? days : 0, decayed: false, factor: 1 }
  }
  const silent = days - TUNABLES.SILENCE.TRIGGER_DAYS
  return {
    daysSinceOpen: days,
    decayed: true,
    factor: Math.pow(TUNABLES.SILENCE.DECAY_PER_DAY, silent + 1),
  }
}

// ── Mandatory gates ─────────────────────────────────────────
// Three one-question interrupts, not a habit. Each blocks until answered.

export function computeGateDue(
  t: Timeline,
  opts: { aboutToRun20Continuous: boolean; aboutToJoinTeam: boolean; interrupt: InterruptState },
): GateId | null {
  if (opts.interrupt.kind !== 'none' && !t.gateAnswers.has('post_pain')) return 'post_pain'
  if (opts.aboutToJoinTeam && !t.gateAnswers.has('pre_team')) return 'pre_team'
  if (opts.aboutToRun20Continuous && !t.gateAnswers.has('pre_20min')) return 'pre_20min'
  return null
}

/** Days with any pain report, used by the phase gates. */
export function painFreeSince(t: Timeline, today: LocalDate, days: number): boolean {
  const w = trailingWindow(today, days)
  return !t.ordered.some((d: DayRecord) => withinWindow(d.date, w.start, w.end) && d.pain.length > 0)
}
