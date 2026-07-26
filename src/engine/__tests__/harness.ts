// Test harness: drives the engine the way the app does — issue a prescription,
// record what happened, fold the whole log again — so the invariant tests
// exercise the real path rather than a hand-built state object.

import { computeState, type FoldResult } from '../fold.ts'
import { prescribe, type PrescribeOptions } from '../prescribe.ts'
import { addDays, asLocalDate, type LocalDate } from '../dates.ts'
import type { AppEvent, PainLocation, Prescription } from '../types.ts'

export const d = asLocalDate

/**
 * The payload half of an event, distributed over the union.
 *
 * A plain `Omit<AppEvent, ...>` collapses the discriminated union into one
 * object type with only its common keys, so `prescription` and friends would
 * stop type-checking. Distributing preserves each member.
 */
type EventPayload<T = AppEvent> = T extends AppEvent
  ? Omit<T, 'id' | 'at' | 'date' | 'schema'>
  : never

export class Sim {
  events: AppEvent[] = []
  readonly start: LocalDate
  private seq = 0

  constructor(start: LocalDate = d('2026-07-27')) { // a Monday
    this.start = start
  }

  private id(): string {
    this.seq += 1
    return `E${String(this.seq).padStart(6, '0')}`
  }

  push(date: LocalDate, payload: EventPayload): void {
    this.events.push({ id: this.id(), at: `${date}T12:00:00Z`, date, schema: 1, ...payload } as AppEvent)
  }

  state(today: LocalDate): FoldResult {
    return computeState(this.events, today)
  }

  /** What the engine would prescribe today, without recording anything. */
  peek(today: LocalDate, opts: Partial<PrescribeOptions> = {}): Prescription {
    return prescribe(this.state(today), today, { id: this.id(), ...opts })
  }

  open(date: LocalDate): void {
    this.push(date, { type: 'app_open' })
  }

  /** Issue today's prescription and freeze it into the log. */
  issue(date: LocalDate, opts: Partial<PrescribeOptions> = {}): Prescription {
    this.open(date)
    const p = prescribe(this.state(date), date, { id: this.id(), ...opts })
    this.push(date, { type: 'prescription_issued', prescription: p })
    return p
  }

  /** Issue and complete in one step. Returns the prescription that was run. */
  run(date: LocalDate, opts: Partial<PrescribeOptions> = {}): Prescription {
    const p = this.issue(date, opts)
    if (p.plannedJogMin > 0) this.push(date, { type: 'session_completed', prescriptionId: p.id })
    return p
  }

  cutShort(date: LocalDate, jogMinDone: number): Prescription {
    const p = this.issue(date)
    this.push(date, { type: 'session_cut_short', prescriptionId: p.id, jogMinDone })
    return p
  }

  miss(date: LocalDate): Prescription {
    const p = this.issue(date)
    this.push(date, { type: 'session_missed', prescriptionId: p.id })
    return p
  }

  pain(date: LocalDate, location: PainLocation, severity: number, o: { gaitAltering?: boolean; when?: 'during' | 'after' | 'next_am' } = {}): void {
    this.push(date, {
      type: 'pain_reported', location, severity,
      gaitAltering: o.gaitAltering ?? false, when: o.when ?? 'during',
    })
  }

  soreness(date: LocalDate, score: 0 | 1 | 2 | 3): void {
    this.push(date, { type: 'soreness_reported', score })
  }

  probe(date: LocalDate, fixedSpeedMph: number, rpe: number, hrAtMin5: number | null = null): void {
    this.push(date, { type: 'probe_result', fixedSpeedMph, rpe, hrAtMin5 })
  }

  hrSummary(date: LocalDate, o: Partial<{
    meanFirst10: number | null; meanFirst20: number | null; meanMin15to25: number | null
    peakFirst20: number | null; discardedPct: number; confidence: 'none' | 'low' | 'usable'
  }> = {}): void {
    this.push(date, {
      type: 'hr_summary', prescriptionId: null,
      meanFirst10: o.meanFirst10 ?? null, meanFirst20: o.meanFirst20 ?? null,
      meanMin15to25: o.meanMin15to25 ?? null, peakFirst20: o.peakFirst20 ?? null,
      sampleCount: 600, discardedPct: o.discardedPct ?? 0, confidence: o.confidence ?? 'usable',
    })
  }

  external(date: LocalDate, durationMin: number): void {
    this.push(date, { type: 'external_session', durationMin, surface: 'road', intensityGuess: 'mixed' })
  }

  profile(date: LocalDate, p: { footwearState?: 'none' | 'non_running' | 'new_under_50mi' | 'broken_in'; surface?: 'treadmill' | 'road' | 'mixed'; hrDevicePresent?: boolean }): void {
    this.push(date, { type: 'profile_updated', ...p })
  }

  answerGate(date: LocalDate, gate: 'pre_20min' | 'pre_team' | 'post_pain'): void {
    this.push(date, { type: 'gate_answered', gate, answer: 'yes' })
  }

  /** Complete calibration so the engine has a speed to prescribe against. */
  calibrate(passedSpeedMph = 6.2, hr: number | null = 158, date: LocalDate = this.start): void {
    for (let i = 0; i < 2; i++) {
      const on = addDays(date, i)
      this.open(on)
      this.push(on, {
        type: 'talk_test_result',
        steps: [
          { speedMph: 4.0, meanHrLast60s: hr === null ? null : hr - 20 },
          { speedMph: passedSpeedMph, meanHrLast60s: hr },
        ],
        passedSpeedMph,
        stopReason: 'breathing_change',
      })
    }
  }

  /** Run every scheduled session cleanly for N weeks from `from`. */
  runWeeks(from: LocalDate, weeks: number): void {
    for (let i = 0; i < weeks * 7; i++) {
      const day = addDays(from, i)
      const p = this.peek(day)
      if (p.plannedJogMin > 0) this.run(day)
      else this.open(day)
    }
  }
}

export function weekOf(sim: Sim, from: LocalDate): number {
  let total = 0
  for (let i = 0; i < 7; i++) {
    const day = addDays(from, i)
    const rec = sim.state(day).timeline.days.get(day)
    total += rec?.jogMin ?? 0
  }
  return Math.round(total * 10) / 10
}
