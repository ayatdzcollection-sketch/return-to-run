// ============================================================
// HEART RATE: a corroborating signal, never a governor.
//
// Everything here exists because the device is a budget wrist optical sensor
// and the athlete lives, for two months, in exactly the band where such
// sensors are least accurate: mean absolute error 5-8 bpm, 95% limits of
// agreement +/- 20-25, and worst at low intensity.
//
// The failure mode that shapes this module is CADENCE LOCK: accelerometer-
// referenced artifact cancellation works by finding the accelerometer's
// dominant spectral peak and suppressing the matching peak in the optical
// signal, so when cadence and heart rate share a frequency, the peak to
// suppress and the peak to keep are the same peak, and the algorithm must
// guess. It often guesses cadence.
//
// THE TRAP THE BUILD BRIEF FELL INTO: for THIS athlete, bpm ~ cadence is the
// EXPECTED state during a legitimate easy run. His easy heart rate will sit
// around 140-155; a novice adolescent's jogging cadence is 150-170. Discarding
// on coincidence alone would throw away most good sessions and mark honest
// data unusable. Coincidence therefore lowers confidence; only independent
// evidence of artifact discards. See RESEARCH.md §A15.
// ============================================================

import type { HrConfidence } from './types.ts'
import { TUNABLES } from '../config/tunables.ts'

export interface RawHrSample {
  /** Seconds from the start of the session. */
  t: number
  bpm: number
  cadenceSpm: number | null
  /** Belt speed at this moment, when known. Drives the transition test. */
  speedMph?: number
}

export type DiscardReason = 'transition' | 'variance' | 'implausible'

export interface HrSummaryDraft {
  meanFirst10: number | null
  meanFirst20: number | null
  meanMin15to25: number | null
  peakFirst20: number | null
  sampleCount: number
  keptCount: number
  discardedPct: number
  confidence: HrConfidence
  /** Samples merely coincident with cadence, down-weighted, not dropped. */
  suspectPct: number
  reasons: DiscardReason[]
}

const EMPTY: HrSummaryDraft = {
  meanFirst10: null, meanFirst20: null, meanMin15to25: null, peakFirst20: null,
  sampleCount: 0, keptCount: 0, discardedPct: 0, confidence: 'none', suspectPct: 0, reasons: [],
}

/**
 * Reduce a session's raw samples to the handful of numbers the fold needs.
 *
 * Pure and side-effect free: the caller wraps the result in an `hr_summary`
 * event. Raw samples never enter the fold, thousands of rows per run would
 * swamp it, and the fold only needs conclusions.
 */
export function evaluateHrSamples(samples: readonly RawHrSample[]): HrSummaryDraft {
  if (samples.length === 0) return { ...EMPTY }
  const sorted = [...samples].sort((a, b) => a.t - b.t)
  const reasons = new Set<DiscardReason>()
  const discarded = new Set<number>()
  let suspect = 0

  for (let i = 0; i < sorted.length; i++) {
    const s = sorted[i]!

    // Physiologically impossible readings are artifact regardless of cause.
    if (s.bpm < 30 || s.bpm > 240) {
      discarded.add(i); reasons.add('implausible'); continue
    }

    // Coincidence with cadence, its sub-harmonic, or its super-harmonic. The
    // sub-harmonic is the dangerous one: locked at half cadence, a too-hard run
    // reads as suspiciously easy.
    if (s.cadenceSpm !== null && matchesCadence(s.bpm, s.cadenceSpm)) suspect++

    // THE TRANSITION TEST: the primary discriminating evidence. Heart rate has
    // a 20-30 second time constant and physically cannot step; cadence follows
    // a belt change within one or two strides. A jump this fast, coincident
    // with a speed change, is the sensor tracking the treadmill.
    const prev = sorted[i - 1]
    if (prev && s.t - prev.t <= TUNABLES.HR.TRANSITION_WINDOW_SECONDS) {
      const jumped = Math.abs(s.bpm - prev.bpm) > TUNABLES.HR.TRANSITION_JUMP_BPM
      const speedChanged = prev.speedMph !== undefined && s.speedMph !== undefined
        && Math.abs(s.speedMph - prev.speedMph) > 0.05
      if (jumped && speedChanged) { discarded.add(i); reasons.add('transition') }
    }
  }

  // THE VARIANCE TEST. A locked trace is pathologically smooth because it is
  // tracking a metronomic belt rather than a heart.
  for (const [start, end] of windowsOf(sorted, TUNABLES.HR.VARIANCE_WINDOW_SECONDS)) {
    const slice = sorted.slice(start, end)
    if (slice.length < 5) continue
    if (stdev(slice.map((s) => s.bpm)) < TUNABLES.HR.VARIANCE_FLOOR_BPM && cadenceStable(slice)) {
      for (let i = start; i < end; i++) discarded.add(i)
      reasons.add('variance')
    }
  }

  const kept = sorted.filter((_, i) => !discarded.has(i))
  const discardedPct = discarded.size / sorted.length
  const suspectPct = suspect / sorted.length

  // The opening minutes are excluded from every statistic, not discarded as
  // artifact: cold-hand vasoconstriction collapses the optical signal exactly
  // then, and heart rate has not reached steady state either way.
  const settled = kept.filter((s) => s.t >= TUNABLES.HR.IGNORE_FIRST_MINUTES * 60)

  const confidence: HrConfidence =
    discardedPct > TUNABLES.HR.DISCARD_CONFIDENCE_NONE_PCT || settled.length < 10 ? 'none'
      : suspectPct > 0.5 ? 'low'
        : 'usable'

  return {
    meanFirst10: meanBetween(settled, 0, 10 * 60),
    meanFirst20: meanBetween(settled, 0, 20 * 60),
    meanMin15to25: meanBetween(settled, 15 * 60, 25 * 60),
    peakFirst20: peakBetween(settled, 0, 20 * 60),
    sampleCount: sorted.length,
    keptCount: kept.length,
    discardedPct: round2(discardedPct),
    confidence,
    suspectPct: round2(suspectPct),
    reasons: [...reasons],
  }
}

function matchesCadence(bpm: number, cadence: number): boolean {
  const band = TUNABLES.HR.CADENCE_LOCK_BAND_BPM
  return Math.abs(bpm - cadence) <= band
    || Math.abs(bpm - cadence / 2) <= band
    || Math.abs(bpm - cadence * 2) <= band
}

function cadenceStable(slice: readonly RawHrSample[]): boolean {
  const cadences = slice.map((s) => s.cadenceSpm).filter((c): c is number => c !== null)
  return cadences.length === 0 || stdev(cadences) < 5
}

function* windowsOf(samples: readonly RawHrSample[], seconds: number): Generator<[number, number]> {
  for (let start = 0; start < samples.length; start++) {
    const from = samples[start]!.t
    let end = start
    while (end < samples.length && samples[end]!.t - from < seconds) end++
    if (samples[end - 1]!.t - from >= seconds - 1) yield [start, end]
  }
}

function meanBetween(samples: readonly RawHrSample[], from: number, to: number): number | null {
  const slice = samples.filter((s) => s.t >= from && s.t < to)
  if (slice.length === 0) return null
  return Math.round(slice.reduce((a, s) => a + s.bpm, 0) / slice.length)
}

function peakBetween(samples: readonly RawHrSample[], from: number, to: number): number | null {
  const slice = samples.filter((s) => s.t >= from && s.t < to)
  return slice.length === 0 ? null : Math.max(...slice.map((s) => s.bpm))
}

function stdev(xs: readonly number[]): number {
  if (xs.length < 2) return 0
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length
  return Math.sqrt(xs.reduce((a, x) => a + (x - mean) ** 2, 0) / (xs.length - 1))
}

function round2(n: number): number { return Math.round(n * 100) / 100 }

// ── Aerobic drift ───────────────────────────────────────────

export type DriftVerdict = 'no_drift' | 'expected_drift' | 'too_fast' | 'not_assessable'

export interface DriftInput {
  meanFirst10: number | null
  meanMin15to25: number | null
  sessionMin: number
  confidence: HrConfidence
  /** Adjusted WBGT at the time of the session, when known. */
  wbgtC: number | null
}

/**
 * Was the pace too fast, or was it just warm?
 *
 * Heart rate cannot answer that on its own, it is the summed output of
 * metabolic and thermoregulatory demand, and at 35 C it rises 11% from minute
 * 15 to 45 at a CONSTANT work rate versus 2% at 22 C. At this athlete's working
 * heart rate that is roughly 16 bpm of purely heat-driven drift, which would
 * trip any threshold worth having.
 *
 * So outside the reference thermal band the engine declines to draw the
 * conclusion rather than correcting it with an uncertain coefficient. A
 * suppressed verdict generates no notification, which is exactly right for an
 * exception-only app.
 */
export function evaluateDrift(inp: DriftInput): DriftVerdict {
  if (inp.confidence !== 'usable' || inp.meanFirst10 === null || inp.meanMin15to25 === null) {
    return 'not_assessable'
  }
  if (inp.wbgtC !== null && inp.wbgtC > TUNABLES.HEAT.REFERENCE_BAND_WBGT_C) return 'not_assessable'

  const rise = inp.meanMin15to25 - inp.meanFirst10
  const threshold = inp.sessionMin <= TUNABLES.HR.DRIFT_SHORT_RUN_MAX_MIN
    ? TUNABLES.HR.DRIFT_SHORT_THRESHOLD_BPM
    : TUNABLES.HR.DRIFT_LONG_THRESHOLD_BPM

  if (rise <= 0) return 'no_drift'
  // Onset timing is the real discriminator. On a run short enough that
  // thermoregulatory drift has not begun, any meaningful rise means he never
  // reached steady state, i.e. the pace was above easy from the start.
  if (rise > threshold) return 'too_fast'
  return 'expected_drift'
}

/** Did HR exceed the easy ceiling while the belt was at the prescribed speed? */
export function breachedCeiling(
  meanFirst20: number | null, ceiling: number | null, confidence: HrConfidence): boolean {
  // The ceiling applies to the first 20 minutes only. Beyond that, cardiac
  // drift of 5-10 bpm at constant pace is expected and is not a breach.
  //
  // Accepts `low` as well as `usable`, unlike the drift check above. A MEAN is
  // robust to exactly the per-sample noise that makes drift unreliable on a
  // budget sensor, and v1 heart-rate entry is the athlete typing the average
  // his watch showed him, which is `low` by definition. Refusing `low` here
  // meant this check could never fire at all.
  if (ceiling === null || meanFirst20 === null || confidence === 'none') return false
  return meanFirst20 > ceiling
}
