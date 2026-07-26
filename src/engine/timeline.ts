// ============================================================
// TIMELINE — the one pass over the event log that everything else reads.
//
// The fold is not allowed to scan the log repeatedly with slightly different
// rules; that is how two derivations quietly disagree. Instead this module
// reduces the log once into a per-day record, and every downstream module
// (load, phases, interrupts, probe) reads from that.
// ============================================================

import type { LocalDate } from './dates.ts'
import { compareDates } from './dates.ts'
import type { AppEvent, HrConfidence, PainLocation, Prescription, StopReason, Surface } from './types.ts'
import { isBonyLocation } from './types.ts'
import { normalizeEvents, round1 } from './events.ts'

export type Outcome = 'completed' | 'cut_short' | 'missed' | 'pending'

export interface PainRecord {
  location: PainLocation
  severity: number
  gaitAltering: boolean
  bony: boolean
  when: 'during' | 'after' | 'next_am'
}

export interface DayRecord {
  date: LocalDate
  opened: boolean
  /** Jogging minutes actually credited for this day. Walking never counts. */
  jogMin: number
  /** Longest unbroken jog actually completed, for the phase gates. */
  longestBoutMin: number
  prescription: Prescription | null
  outcome: Outcome
  externalMin: number
  pain: PainRecord[]
  soreness: number | null
  probe: { fixedSpeedMph: number; rpe: number; hrAtMin5: number | null } | null
  hr: {
    meanFirst10: number | null
    meanFirst20: number | null
    meanMin15to25: number | null
    peakFirst20: number | null
    discardedPct: number
    confidence: HrConfidence
  } | null
  feltAwful: boolean
}

export interface Profile {
  hrDevicePresent: boolean
  footwearState: 'none' | 'non_running' | 'new_under_50mi' | 'broken_in'
  surface: Surface
}

export interface Timeline {
  days: Map<LocalDate, DayRecord>
  ordered: DayRecord[]
  profile: Profile
  talkTests: { date: LocalDate; passedSpeedMph: number; maxSpeedMph: number; stopReason: StopReason; hrAtPassedSpeed: number | null }[]
  gateAnswers: Set<string>
  firstDate: LocalDate | null
  lastOpenDate: LocalDate | null
}

function blank(date: LocalDate): DayRecord {
  return {
    date, opened: false, jogMin: 0, longestBoutMin: 0, prescription: null,
    outcome: 'pending', externalMin: 0, pain: [], soreness: null, probe: null,
    hr: null, feltAwful: false,
  }
}

/**
 * Fold the log into per-day records.
 *
 * Two rules that are easy to get wrong and matter a lot:
 *
 * 1. Completed sessions carry no minutes. They reference a frozen
 *    `prescription_issued` event and the minutes are read from there. That is
 *    what makes exception-only reporting work — a Done tap is one bit.
 *
 * 2. Contradictions resolve conservatively. If the same prescription is both
 *    completed and missed (two devices, a mis-tap, a late correction), the
 *    outcome that credits LESS training wins. Over-crediting inflates the
 *    baseline every future cap is computed from; under-crediting only slows
 *    him down.
 */
export function buildTimeline(events: readonly AppEvent[]): Timeline {
  const sorted = normalizeEvents(events)
  const days = new Map<LocalDate, DayRecord>()
  const prescriptions = new Map<string, Prescription>()
  const outcomes = new Map<string, Outcome>()
  const cutShortMin = new Map<string, number>()
  const talkTests: Timeline['talkTests'] = []
  const gateAnswers = new Set<string>()
  const profile: Profile = { hrDevicePresent: false, footwearState: 'none', surface: 'treadmill' }
  let lastOpenDate: LocalDate | null = null

  const day = (d: LocalDate): DayRecord => {
    let rec = days.get(d)
    if (!rec) { rec = blank(d); days.set(d, rec) }
    return rec
  }

  for (const e of sorted) {
    const rec = day(e.date)
    switch (e.type) {
      case 'app_open':
        rec.opened = true
        if (lastOpenDate === null || e.date > lastOpenDate) lastOpenDate = e.date
        break
      case 'prescription_issued':
        // First issue for a date wins; a duplicate from another device is ignored.
        if (!rec.prescription) {
          rec.prescription = e.prescription
          prescriptions.set(e.prescription.id, e.prescription)
        }
        break
      case 'session_completed':
        if (!outcomes.has(e.prescriptionId)) outcomes.set(e.prescriptionId, 'completed')
        break
      case 'session_cut_short': {
        outcomes.set(e.prescriptionId, 'cut_short')
        const prev = cutShortMin.get(e.prescriptionId)
        // Two reports of the same shortfall: believe the smaller one.
        cutShortMin.set(e.prescriptionId, prev === undefined ? e.jogMinDone : Math.min(prev, e.jogMinDone))
        break
      }
      case 'session_missed':
        if (e.prescriptionId) outcomes.set(e.prescriptionId, 'missed')
        else rec.outcome = 'missed'
        break
      case 'external_session':
        rec.externalMin += e.durationMin
        break
      case 'pain_reported':
        rec.pain.push({
          location: e.location, severity: e.severity, gaitAltering: e.gaitAltering,
          bony: isBonyLocation(e.location), when: e.when,
        })
        break
      case 'felt_awful':
        rec.feltAwful = true
        break
      case 'soreness_reported':
        rec.soreness = rec.soreness === null ? e.score : Math.max(rec.soreness, e.score)
        break
      case 'talk_test_result': {
        const step = e.steps.find((s) => s.speedMph === e.passedSpeedMph)
        talkTests.push({
          date: e.date,
          passedSpeedMph: e.passedSpeedMph,
          maxSpeedMph: e.steps.reduce((m, s) => Math.max(m, s.speedMph), 0),
          stopReason: e.stopReason,
          hrAtPassedSpeed: step?.meanHrLast60s ?? null,
        })
        break
      }
      case 'probe_result':
        rec.probe = { fixedSpeedMph: e.fixedSpeedMph, rpe: e.rpe, hrAtMin5: e.hrAtMin5 }
        break
      case 'hr_summary':
        rec.hr = {
          meanFirst10: e.meanFirst10, meanFirst20: e.meanFirst20,
          meanMin15to25: e.meanMin15to25, peakFirst20: e.peakFirst20,
          discardedPct: e.discardedPct, confidence: e.confidence,
        }
        break
      case 'gate_answered':
        gateAnswers.add(e.gate)
        break
      case 'profile_updated':
        if (e.hrDevicePresent !== undefined) profile.hrDevicePresent = e.hrDevicePresent
        if (e.footwearState !== undefined) profile.footwearState = e.footwearState
        if (e.surface !== undefined) profile.surface = e.surface
        break
      case 'note':
        break
    }
  }

  // Resolve each prescription's outcome into credited minutes.
  for (const rec of days.values()) {
    const p = rec.prescription
    if (!p) continue
    const outcome = outcomes.get(p.id) ?? rec.outcome
    rec.outcome = outcome === 'pending' ? 'pending' : outcome
    if (outcome === 'completed') {
      rec.jogMin += p.plannedJogMin
      rec.longestBoutMin = Math.max(rec.longestBoutMin, longestBoutOf(p))
    } else if (outcome === 'cut_short') {
      const done = Math.min(cutShortMin.get(p.id) ?? 0, p.plannedJogMin)
      rec.jogMin += done
      // A cut-short session cannot have completed a longer bout than it ran.
      rec.longestBoutMin = Math.max(rec.longestBoutMin, Math.min(done, longestBoutOf(p)))
    }
  }

  // External sessions count toward load identically to prescribed ones.
  for (const rec of days.values()) {
    if (rec.externalMin > 0) {
      rec.jogMin = round1(rec.jogMin + rec.externalMin)
      rec.longestBoutMin = Math.max(rec.longestBoutMin, rec.externalMin)
    }
  }

  const ordered = [...days.values()].sort((a, b) => compareDates(a.date, b.date))
  return {
    days, ordered, profile, talkTests, gateAnswers,
    firstDate: ordered[0]?.date ?? null,
    lastOpenDate,
  }
}

function longestBoutOf(p: Prescription): number {
  let best = 0
  let run = 0
  const flat = p.structure.flatMap((b) => (b.kind === 'repeat' ? Array.from({ length: b.times }, () => b.blocks).flat() : [b]))
  for (const b of flat) {
    if (b.kind === 'walk') run = 0
    else { run += b.kind === 'jog' ? b.minutes : (b.count * b.seconds) / 60; best = Math.max(best, run) }
  }
  return round1(best)
}

/** Days with any credited running, most recent first. */
export function runDays(t: Timeline): DayRecord[] {
  return t.ordered.filter((d) => d.jogMin > 0)
}
