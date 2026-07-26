// ============================================================
// THE SAFETY RAILS. One named block per invariant.
//
// Invariants 7 and 2 are not tested as the build brief wrote them, the
// research pass replaced the ACWR clamp outright and demoted the 10% rule.
// Each block below states what it now asserts and why, so a reader comparing
// against the brief can see the divergence rather than assume a gap.
// ============================================================

import { describe, expect, it } from 'vitest'
import { Sim, d, weekOf } from './harness.ts'
import { addDays } from '../dates.ts'
import { applyLoadCaps } from '../load.ts'
import { classifyPain } from '../interrupts.ts'
import { maxTier } from '../phases.ts'
import { jogMinutes, longestContinuousJogMin } from '../events.ts'
import { TUNABLES } from '../../config/tunables.ts'
import { LADDER } from '../../config/seedPlan.ts'

const MON = d('2026-07-27')

describe('I1: prescriptions are in minutes, and distance never enters the model', () => {
  it('exposes no distance field on any prescription', () => {
    const sim = new Sim(); sim.calibrate()
    const p = sim.peek(addDays(MON, 7))
    for (const key of Object.keys(p)) {
      expect(key.toLowerCase()).not.toMatch(/mile|distance|km|metre|meter/)
    }
  })

  it('counts only jogging minutes as load, walking is free', () => {
    // Every level is mostly walking early on. If walking counted, the caps
    // would bind on warm-ups.
    const walkHeavy = LADDER[0]!
    expect(jogMinutes(walkHeavy.core)).toBe(8)
    expect(jogMinutes([{ kind: 'walk', minutes: 60 }])).toBe(0)
  })

  it('ignores a note event containing distances', () => {
    const sim = new Sim(); sim.calibrate()
    const before = sim.state(addDays(MON, 7)).load.acuteMin
    sim.push(addDays(MON, 3), { type: 'note', text: 'felt like 3 miles at 8:00 pace' })
    expect(sim.state(addDays(MON, 7)).load.acuteMin).toBe(before)
  })
})

describe('I2: weekly volume growth is capped (demoted from safety rule to governor)', () => {
  // The brief called +10%/week protective. Buist 2008 (RCT, n=532, same
  // 12-months-detrained entry criterion) found 20.8% vs 20.3% injury against a
  // faster ramp, p=0.90. The cap is kept as a ceiling and labelled LORE; the
  // guardrail that actually carries evidence is the session cap in I7.
  it('never lets a week exceed the allowance built from the prior week', () => {
    const sim = new Sim(); sim.calibrate()
    sim.runWeeks(MON, 4)
    for (let w = 1; w < 4; w++) {
      const prev = weekOf(sim, addDays(MON, (w - 1) * 7))
      const cur = weekOf(sim, addDays(MON, w * 7))
      if (prev > 0) {
        const allowance = Math.min(prev * TUNABLES.LOAD.WEEKLY_GROWTH_MAX, prev + TUNABLES.LOAD.WEEKLY_ABS_INCREASE_MAX_MIN)
        expect(cur).toBeLessThanOrEqual(allowance + 0.1)
      }
    }
  })

  it('caps the absolute increase when the baseline is near zero', () => {
    // A percentage rule is degenerate here: 10% of 8 minutes is 48 seconds.
    const r = applyLoadCaps({
      desiredJogMin: 100,
      windows: { acuteMin: 8, chronicMin: 2, thisWeekMin: 8, lastWeekMin: 8, lastBuildWeekMin: 8, longest30dMin: 8, newLongestThisWeek: 0, daysSinceLastRun: 2 },
      weekNumber: 1, isDownWeek: false, toleranceFactor: 1,
    })
    expect(r.jogMin).toBeLessThanOrEqual(8 + TUNABLES.LOAD.SESSION_CAP_MAX_INCREMENT_MIN)
  })
})

describe('I3: one dimension progresses at a time', () => {
  it('holds frequency fixed at three runs a week', () => {
    // Frequency cannot be the progressing dimension: no located protocol runs
    // a novice more than 4 days/week, and a 4th day inside a 7-day week cannot
    // satisfy the 48-hour spacing rule. So duration and continuity progress.
    const sim = new Sim(); sim.calibrate()
    sim.runWeeks(MON, 3)
    for (let w = 0; w < 3; w++) {
      const start = addDays(MON, w * 7)
      let runDays = 0
      for (let i = 0; i < 7; i++) {
        const rec = sim.state(addDays(start, i)).timeline.days.get(addDays(start, i))
        if ((rec?.jogMin ?? 0) > 0) runDays++
      }
      expect(runDays).toBeLessThanOrEqual(TUNABLES.FREQUENCY.MAX_RUN_DAYS_PER_WEEK)
    }
  })

  it('advances the ladder one level at a time, never two', () => {
    const sim = new Sim(); sim.calibrate()
    let last = sim.state(MON).level
    for (let i = 0; i < 40; i++) {
      const day = addDays(MON, i)
      const p = sim.peek(day)
      if (p.plannedJogMin > 0) sim.run(day); else sim.open(day)
      const now = sim.state(day).level
      expect(now - last).toBeLessThanOrEqual(1)
      last = now
    }
  })
})

describe('I4: no tier above easy+strides before eight unbroken weeks', () => {
  it('locks every tier above easy until the eighth week', () => {
    for (let w = 0; w < 8; w++) {
      expect(maxTier('P4', w)).toBe('easy')
    }
    expect(maxTier('P4', 8)).toBe('strides')
  })

  it('keeps tiers locked in earlier phases regardless of weeks', () => {
    expect(maxTier('P2', 20)).toBe('easy')
    expect(maxTier('P0', 20)).toBe('walk_run')
  })
})

describe('I5: no two consecutive days above easy', () => {
  it('never schedules runs on consecutive days at all', () => {
    // Stronger than the invariant requires. 48 hours between runs is the
    // collagen rule: net balance is negative for the first 24-36 hours.
    const sim = new Sim(); sim.calibrate()
    sim.runWeeks(MON, 4)
    for (let i = 1; i < 28; i++) {
      const yesterday = addDays(MON, i - 1)
      const today = addDays(MON, i)
      const a = sim.state(today).timeline.days.get(yesterday)?.jogMin ?? 0
      const b = sim.state(today).timeline.days.get(today)?.jogMin ?? 0
      expect(a > 0 && b > 0, `ran on both ${yesterday} and ${today}`).toBe(false)
    }
  })
})

describe('I6: the down week is mandatory', () => {
  it('cuts week four even for an aggressive responder', () => {
    const sim = new Sim(); sim.calibrate()
    // Aggressive requires every session completed, soreness never above 1.
    for (let i = 0; i < 28; i++) {
      const day = addDays(MON, i)
      const p = sim.peek(day)
      if (p.plannedJogMin > 0) { sim.run(day); sim.soreness(addDays(day, 1), 0) } else sim.open(day)
    }
    const state = sim.state(addDays(MON, 21))
    expect(state.weekNumber).toBe(4)
    expect(state.isDownWeek).toBe(true)
  })

  it('applies the cut through the load caps, not by convention', () => {
    const windows = { acuteMin: 40, chronicMin: 30, thisWeekMin: 0, lastWeekMin: 45, lastBuildWeekMin: 45, longest30dMin: 20, newLongestThisWeek: 0, daysSinceLastRun: 2 }
    const normal = applyLoadCaps({ desiredJogMin: 18, windows, weekNumber: 3, isDownWeek: false, toleranceFactor: 1 })
    const down = applyLoadCaps({ desiredJogMin: 18, windows, weekNumber: 4, isDownWeek: true, toleranceFactor: 1 })
    expect(down.jogMin).toBeLessThan(normal.jogMin)
    expect(down.caps.some((c) => c.rule === 'down_week')).toBe(true)
  })

  it('is not exempted by tolerance class', () => {
    const windows = { acuteMin: 40, chronicMin: 30, thisWeekMin: 0, lastWeekMin: 45, lastBuildWeekMin: 45, longest30dMin: 20, newLongestThisWeek: 0, daysSinceLastRun: 2 }
    for (const factor of [0.5, 1]) {
      const r = applyLoadCaps({ desiredJogMin: 18, windows, weekNumber: 4, isDownWeek: true, toleranceFactor: factor })
      expect(r.caps.some((c) => c.rule === 'down_week')).toBe(true)
    }
  })
})

describe('I7: the load guardrail (ACWR REPLACED, not clamped)', () => {
  // The brief clamped ACWR to 0.8-1.3. That clamp is gone: its source figure is
  // under a retraction request, the association ran BACKWARDS in both
  // prospective running cohorts, its one adolescent RCT was null, it is
  // undefined at a zero baseline, and a 0.8 LOWER bound would have told a
  // detrained 15-year-old to train more. See RESEARCH.md §A6.
  it('computes no ACWR at all', () => {
    const sim = new Sim(); sim.calibrate(); sim.runWeeks(MON, 3)
    expect(sim.state(addDays(MON, 20)).load.acwr).toBeNull()
  })

  it('caps a session against the 30-day longest and logs the original', () => {
    // A generous weekly base, so the session cap is the rule under test rather
    // than the 30%-of-week share incidentally binding first.
    const windows = { acuteMin: 60, chronicMin: 55, thisWeekMin: 10, lastWeekMin: 90, lastBuildWeekMin: 90, longest30dMin: 20, newLongestThisWeek: 0, daysSinceLastRun: 2 }
    const r = applyLoadCaps({ desiredJogMin: 30, windows, weekNumber: 12, isDownWeek: false, toleranceFactor: 1 })
    expect(r.jogMin).toBeLessThanOrEqual(20 * TUNABLES.LOAD.SESSION_CAP_FACTOR + 0.01)
    const cap = r.caps.find((c) => c.rule === 'session_cap')
    expect(cap).toBeDefined()
    expect(cap!.original).toBe(30)
    expect(cap!.applied).toBeLessThan(cap!.original)
    expect(r.binding).toBe('session_cap')
  })

  it('permits only one new-longest session per week', () => {
    const windows = { acuteMin: 40, chronicMin: 25, thisWeekMin: 22, lastWeekMin: 40, lastBuildWeekMin: 40, longest30dMin: 20, newLongestThisWeek: 1, daysSinceLastRun: 2 }
    const r = applyLoadCaps({ desiredJogMin: 25, windows, weekNumber: 12, isDownWeek: false, toleranceFactor: 1 })
    expect(r.jogMin).toBeLessThanOrEqual(20)
    expect(r.caps.some((c) => c.rule === 'one_new_longest_per_week')).toBe(true)
  })

  it('records every cap it consulted, bound or not', () => {
    const windows = { acuteMin: 30, chronicMin: 20, thisWeekMin: 10, lastWeekMin: 30, lastBuildWeekMin: 30, longest30dMin: 20, newLongestThisWeek: 0, daysSinceLastRun: 2 }
    const r = applyLoadCaps({ desiredJogMin: 22, windows, weekNumber: 12, isDownWeek: false, toleranceFactor: 1 })
    for (const c of r.caps) {
      expect(typeof c.original).toBe('number')
      expect(typeof c.applied).toBe('number')
    }
    expect(r.caps.map((c) => c.rule)).toContain('terminal_ceiling')
  })
})

describe('I8: the pain interrupt is mechanical', () => {
  it('escalates any bony-landmark pain at ANY severity', () => {
    for (const loc of ['shin', 'top_of_foot', 'heel', 'ankle_bone', 'kneecap', 'hip_bone'] as const) {
      expect(classifyPain({ location: loc, severity: 1, gaitAltering: false, bony: true, when: 'during' }))
        .toBe('bone')
    }
  })

  it('escalates gait-altering pain even at severity 1', () => {
    expect(classifyPain({ location: 'calf', severity: 1, gaitAltering: true, bony: false, when: 'during' }))
      .toBe('bone')
  })

  it('escalates muscular pain only at the severity threshold', () => {
    const base = { location: 'calf' as const, gaitAltering: false, bony: false, when: 'during' as const }
    expect(classifyPain({ ...base, severity: 2 })).toBe('none')
    expect(classifyPain({ ...base, severity: 3 })).toBe('soft')
  })

  it('blocks running the day it is reported', () => {
    const sim = new Sim(); sim.calibrate(); sim.runWeeks(MON, 2)
    const day = addDays(MON, 14)
    sim.pain(day, 'shin', 2)
    expect(sim.peek(day).plannedJogMin).toBe(0)
    expect(sim.state(day).phase).toBe('P0')
  })

  it('exits the bone branch on clean days, never on a countdown', () => {
    // A fixed 3-day timer manufactures a false "cleared" state: conservative
    // tibial bone stress injury management runs 6-27 weeks.
    const sim = new Sim(); sim.calibrate(); sim.runWeeks(MON, 2)
    const hurt = addDays(MON, 14)
    sim.pain(hurt, 'shin', 4)
    sim.answerGate(addDays(hurt, 1), 'post_pain')
    for (let i = 1; i <= 3; i++) sim.open(addDays(hurt, i))
    // Still blocked on day 3, the clean-day count has not yet been satisfied
    // by days that are recorded in the timeline.
    expect(sim.state(addDays(hurt, 2)).interruptKind).toBe('bone')
  })
})

describe('I9: the longest session stays within its share of the week', () => {
  it('caps a session at 30% of the prior build week once one exists', () => {
    const windows = { acuteMin: 90, chronicMin: 80, thisWeekMin: 0, lastWeekMin: 90, lastBuildWeekMin: 90, longest30dMin: 40, newLongestThisWeek: 0, daysSinceLastRun: 2 }
    const r = applyLoadCaps({ desiredJogMin: 40, windows, weekNumber: 12, isDownWeek: false, toleranceFactor: 1 })
    expect(r.jogMin).toBeLessThanOrEqual(90 * 0.30 + 0.01)
  })
})

describe('I10: no makeup volume, ever', () => {
  it('prescribes less after missed days, never more', () => {
    const sim = new Sim(); sim.calibrate(); sim.runWeeks(MON, 3)
    const before = sim.peek(addDays(MON, 21)).plannedJogMin
    // Five days of silence and no running.
    const after = addDays(MON, 26)
    const sim2 = new Sim(); sim2.calibrate(); sim2.runWeeks(MON, 3)
    for (let i = 21; i < 26; i++) sim2.miss(addDays(MON, i))
    expect(sim2.peek(after).plannedJogMin).toBeLessThanOrEqual(before)
  })

  it('never emits a session larger than the ladder level asks for', () => {
    const sim = new Sim(); sim.calibrate()
    for (let i = 0; i < 35; i++) {
      const day = addDays(MON, i)
      const p = sim.peek(day)
      if (p.plannedJogMin > 0) {
        const level = sim.state(day).level
        expect(p.plannedJogMin).toBeLessThanOrEqual(LADDER[level - 1]!.jogMin + 0.01)
        sim.run(day)
      } else sim.open(day)
    }
  })
})

describe('I11: the speed ceiling is the control', () => {
  it('presents a ceiling, not a target, on every running prescription', () => {
    const sim = new Sim(); sim.calibrate(6.2)
    const p = sim.peek(addDays(MON, 7))
    expect(p.speedCeilingMph).toBe(5.2)
    expect(p.speedMaxMph).toBe(p.speedCeilingMph)
    expect(p.speedMinMph!).toBeLessThan(p.speedCeilingMph!)
  })

  it('exposes no real-time governor field', () => {
    const sim = new Sim(); sim.calibrate()
    const p = sim.peek(addDays(MON, 7))
    expect(Object.keys(p)).not.toContain('hrAlarm')
    expect(Object.keys(p)).not.toContain('liveTarget')
  })
})

describe('I12: ceilings ratchet down freely and rise only on probe evidence', () => {
  it('refuses to raise a ceiling because he feels good and asks', () => {
    const sim = new Sim(); sim.calibrate(6.2)
    const before = sim.state(addDays(MON, 7)).ceilings.speedCeilingMph
    sim.push(addDays(MON, 7), { type: 'note', text: 'feeling great, want to go faster' })
    sim.push(addDays(MON, 8), { type: 'felt_awful' })
    expect(sim.state(addDays(MON, 9)).ceilings.speedCeilingMph).toBe(before)
  })

  it('raises only after two consecutive weeks of falling probe HR at fixed speed', () => {
    const sim = new Sim(); sim.calibrate(6.2)
    const base = sim.state(addDays(MON, 7)).ceilings.speedCeilingMph!
    sim.probe(addDays(MON, 7), 5.2, 5, 150)
    expect(sim.state(addDays(MON, 8)).ceilings.speedCeilingMph).toBe(base)
    sim.probe(addDays(MON, 14), 5.2, 5, 146)
    expect(sim.state(addDays(MON, 15)).ceilings.speedCeilingMph).toBe(base)
    sim.probe(addDays(MON, 21), 5.2, 4, 142)
    expect(sim.state(addDays(MON, 22)).ceilings.speedCeilingMph!).toBeGreaterThan(base)
  })

  it('ignores a probe run at a different speed', () => {
    // Freezing the probe speed is the entire point; a probe at another speed is
    // not comparable and must not count as evidence.
    const sim = new Sim(); sim.calibrate(6.2)
    const base = sim.state(addDays(MON, 7)).ceilings.speedCeilingMph!
    sim.probe(addDays(MON, 7), 5.2, 5, 150)
    sim.probe(addDays(MON, 14), 6.0, 5, 140)
    sim.probe(addDays(MON, 21), 6.0, 4, 138)
    expect(sim.state(addDays(MON, 22)).ceilings.speedCeilingMph).toBe(base)
  })
})

describe('I13: no maximum heart rate exists (also enforced statically)', () => {
  it('derives the easy ceiling from measurement, not from a percentage', () => {
    const sim = new Sim(); sim.calibrate(6.2, 155)
    // 155 measured at talk speed, minus the 10 bpm backoff, under the cap.
    expect(sim.state(addDays(MON, 7)).ceilings.easyHrCeiling).toBe(145)
  })

  it('produces a full plan with no HR device at all', () => {
    const sim = new Sim(); sim.calibrate(6.2, null)
    const p = sim.peek(addDays(MON, 7))
    expect(p.hrCeiling).toBeNull()
    expect(p.plannedJogMin).toBeGreaterThan(0)
    expect(p.speedCeilingMph).not.toBeNull()
  })
})

describe('structural sanity of every prescription the engine can emit', () => {
  it('keeps declared minutes consistent with declared structure', () => {
    const sim = new Sim(); sim.calibrate()
    for (let i = 0; i < 60; i++) {
      const day = addDays(MON, i)
      const p = sim.peek(day)
      expect(p.plannedJogMin).toBeCloseTo(jogMinutes(p.structure), 1)
      expect(p.plannedTotalMin).toBeGreaterThanOrEqual(p.plannedJogMin)
      expect(longestContinuousJogMin(p.structure)).toBeLessThanOrEqual(p.plannedJogMin + 0.01)
      if (p.plannedJogMin > 0) sim.run(day); else sim.open(day)
    }
  })
})
