// Every research-derived number must state where it came from and how much to
// trust it. These tests make that mechanical rather than aspirational: a value
// cannot enter the engine without an evidence entry, and an evidence entry
// cannot outlive the value it describes.

import { describe, expect, it } from 'vitest'
import { EVIDENCE, TUNABLES, tunablePaths } from '../tunables.ts'
import { LADDER, TOP_LEVEL, buildStructure, levelAt } from '../seedPlan.ts'
import { jogMinutes, longestContinuousJogMin } from '../../engine/events.ts'

describe('every tunable carries evidence', () => {
  const paths = tunablePaths()

  it('finds the tunables (guards against a vacuous pass)', () => {
    expect(paths.length).toBeGreaterThan(50)
    expect(paths).toContain('HR.ABSOLUTE_CAP_BPM')
  })

  it('has an evidence entry for every value', () => {
    expect(paths.filter((p) => !EVIDENCE[p])).toEqual([])
  })

  it('has no orphaned evidence entries', () => {
    const known = new Set(paths)
    expect(Object.keys(EVIDENCE).filter((k) => !known.has(k))).toEqual([])
  })

  it('rates every entry at a known confidence level', () => {
    const levels = new Set(['strong', 'moderate', 'weak', 'lore'])
    const bad = Object.entries(EVIDENCE).filter(([, e]) => !levels.has(e.level))
    expect(bad).toEqual([])
  })

  it('cites a real source for every entry', () => {
    // A one-word placeholder would satisfy a presence check but not a reader.
    const thin = Object.entries(EVIDENCE).filter(([, e]) => e.source.trim().length < 40)
    expect(thin.map(([k]) => k)).toEqual([])
  })
})

describe('the values the research pass changed stay changed', () => {
  // These are the amendments where the brief and the evidence disagreed. If
  // someone reverts one to the brief's value, that is a decision worth making
  // deliberately, so it breaks a test rather than passing silently.

  it('subtracts 1.0 mph from the talk test, not 0.4', () => {
    // 0.4 was below the instrument's own minimal detectable change (~0.9 mph).
    expect(TUNABLES.TALK_TEST.BACKOFF_MPH).toBe(1.0)
  })

  it('has no ACWR clamp anywhere', () => {
    // Removed, not weakened: the lower bound would have told a detrained
    // 15-year-old to train MORE to satisfy a metric.
    expect(JSON.stringify(TUNABLES).toLowerCase()).not.toContain('acwr')
  })

  it('caps sessions against the 30-day longest, not against a weekly ratio', () => {
    expect(TUNABLES.LOAD.SESSION_CAP_FACTOR).toBe(1.10)
    expect(TUNABLES.LOAD.LONGEST_LOOKBACK_DAYS).toBe(30)
  })

  it('runs three days a week with 48 hours between', () => {
    expect(TUNABLES.FREQUENCY.RUN_DAYS_PER_WEEK).toBe(3)
    expect(TUNABLES.FREQUENCY.MIN_HOURS_BETWEEN_RUNS).toBe(48)
    expect(TUNABLES.FREQUENCY.MAX_RUN_DAYS_PER_WEEK).toBeLessThanOrEqual(4)
  })

  it('guards through week 10, not week 6', () => {
    expect(TUNABLES.LOAD.HIGH_RISK_WEEK_LAST).toBeGreaterThanOrEqual(10)
  })

  it('keeps the 150 bpm cap and rejects rather than truncates above 165', () => {
    expect(TUNABLES.HR.ABSOLUTE_CAP_BPM).toBe(150)
    expect(TUNABLES.HR.SANITY_HI_BPM).toBe(165)
    expect(TUNABLES.HR.SANITY_HI_BPM).toBeGreaterThan(TUNABLES.HR.ABSOLUTE_CAP_BPM)
  })

  it('sets a drift threshold above the sensor noise floor', () => {
    // Budget wrist PPG has 5-8 bpm MAE; the brief's 8-10 bpm measured noise.
    expect(TUNABLES.HR.DRIFT_SHORT_THRESHOLD_BPM).toBeGreaterThan(10)
  })

  it('inclines the treadmill below the 1% convention', () => {
    expect(TUNABLES.SURFACE.TREADMILL_INCLINE_PCT).toBeLessThan(1)
    expect(TUNABLES.SURFACE.TREADMILL_INCLINE_PCT).toBeGreaterThan(0)
  })
})

describe('the seed ladder', () => {
  it('reaches exactly the tryout standard and stops there', () => {
    const top = levelAt(TOP_LEVEL)
    expect(top.jogMin).toBe(30)
    expect(top.longestBoutMin).toBe(30)
    // 30 min is a terminal ceiling, not a waypoint: injury incidence in
    // untrained males ran 24% at 30 min/session but 54% at 45 (Pollock 1977).
    expect(top.jogMin).toBeLessThanOrEqual(TUNABLES.LOAD.TERMINAL_SESSION_CEILING_MIN)
  })

  it('declares jog minutes that match its own structure', () => {
    for (const level of LADDER) {
      expect(jogMinutes(level.core)).toBe(level.jogMin)
      expect(longestContinuousJogMin(level.core)).toBe(level.longestBoutMin)
    }
  })

  it('grows the unbroken bout by at most 85%, or 2 minutes at the bottom', () => {
    // The brief's ladder jumped 12 -> 30 min with nothing between, which meant
    // his first 20-minute continuous run would happen during the graded test.
    //
    // The absolute escape hatch is the same degeneracy the research pass found
    // in percentage progression rules: at a 1-minute bout, "no more than +85%"
    // means 51 seconds, which is not a meaningful prescription. Near zero,
    // absolute increments are the sane unit.
    for (let i = 1; i < LADDER.length; i++) {
      const prev = LADDER[i - 1]!.longestBoutMin
      const next = LADDER[i]!.longestBoutMin
      const ok = next / prev <= 1.85 || next - prev <= 2
      expect(ok, `level ${i} -> ${i + 1}: ${prev} -> ${next} min`).toBe(true)
    }
  })

  it('includes a 20-minute continuous bout before the 30-minute test', () => {
    expect(LADDER.map((l) => l.longestBoutMin)).toContain(20)
  })

  it('smooths the two steepest jog-minute jumps the brief had', () => {
    // Brief: 8 -> 14 (+75%) and 18 -> 25 (+39%). Both exceeded, inside a single
    // step, the >30%-per-two-weeks marker associated with injury.
    for (let i = 1; i < LADDER.length; i++) {
      const growth = LADDER[i]!.jogMin / LADDER[i - 1]!.jogMin
      expect(growth).toBeLessThanOrEqual(1.30)
    }
  })

  it('allows bout length to grow while total volume falls', () => {
    // Level 8 trades volume down for bout length up. That is the point of it.
    const seven = levelAt(7), eight = levelAt(8)
    expect(eight.longestBoutMin).toBeGreaterThan(seven.longestBoutMin)
    expect(eight.jogMin).toBeGreaterThanOrEqual(seven.jogMin)
  })

  it('wraps every level in a walking warm-up and cool-down', () => {
    for (const level of LADDER) {
      const structure = buildStructure(level)
      expect(structure[0]).toEqual({ kind: 'walk', minutes: 5 })
      expect(structure.at(-1)).toEqual({ kind: 'walk', minutes: 5 })
      expect(jogMinutes(structure)).toBe(level.jogMin)
    }
  })
})
