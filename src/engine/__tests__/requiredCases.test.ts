// ============================================================
// The eighteen cases named in the build brief, §17.
//
// Four of them assert behaviour the Stage 0 research pass replaced. Those are
// kept, renamed, and assert the AMENDED behaviour with the original stated
// alongside, so a reader checking the brief against the code finds the
// divergence written down rather than a missing test.
// ============================================================

import { describe, expect, it } from 'vitest'
import { Sim, d } from './harness.ts'
import { addDays } from '../dates.ts'
import { evaluateDrift, evaluateHrSamples, type RawHrSample } from '../hr.ts'
import { easyHrCeiling } from '../calibration.ts'
import { applyLoadCaps } from '../load.ts'
import { prescribe } from '../prescribe.ts'
import { maxTier } from '../phases.ts'
import { TUNABLES } from '../../config/tunables.ts'

const MON = d('2026-07-27')

describe('R1: misses 5 days -> next prescription is LOWER, and no makeup appears', () => {
  it('prescribes no more than before the gap', () => {
    const clean = new Sim(); clean.calibrate(); clean.runWeeks(MON, 3)
    const expected = clean.peek(addDays(MON, 22)).plannedJogMin

    const missed = new Sim(); missed.calibrate(); missed.runWeeks(MON, 3)
    for (let i = 17; i < 22; i++) missed.miss(addDays(MON, i))
    const after = missed.peek(addDays(MON, 22))

    expect(after.plannedJogMin).toBeLessThanOrEqual(expected)
  })

  it('never adds a catch-up session on a rest day', () => {
    const sim = new Sim(); sim.calibrate(); sim.runWeeks(MON, 2)
    for (let i = 14; i < 19; i++) sim.miss(addDays(MON, i))
    // Tuesday, Thursday, Saturday and Sunday stay rest days regardless.
    for (const offset of [22, 24, 26, 27]) {
      expect(sim.peek(addDays(MON, offset)).plannedJogMin).toBe(0)
    }
  })
})

describe('R2: shin pain at 4/10 -> forced rest, phase drops, the gate blocks resuming', () => {
  const sim = new Sim(); sim.calibrate(); sim.runWeeks(MON, 2)
  const hurt = addDays(MON, 14)
  const phaseBefore = sim.state(addDays(MON, 13)).phase
  sim.pain(hurt, 'shin', 4)

  it('stops prescribing immediately', () => {
    expect(sim.peek(hurt).plannedJogMin).toBe(0)
    expect(sim.peek(addDays(hurt, 1)).plannedJogMin).toBe(0)
  })

  it('drops the phase', () => {
    expect(sim.state(hurt).phase).not.toBe(phaseBefore)
  })

  it('raises the post-pain gate, which blocks resuming until answered', () => {
    expect(sim.state(hurt).gateDue).toBe('post_pain')
  })

  it('does NOT resume on a three-day countdown', () => {
    // AMENDED from the brief. The trigger is unchanged; the response is not.
    // A fixed 3-day timer manufactures a false "cleared" state, conservative
    // tibial bone stress injury management runs 6-27 weeks. See RESEARCH.md §A3.
    expect(sim.state(addDays(hurt, 3)).interruptKind).toBe('bone')
    expect(sim.peek(addDays(hurt, 3)).plannedJogMin).toBe(0)
    expect(sim.peek(addDays(hurt, 3)).audit.caps.some((c) => c.rule === 'bone_protocol')).toBe(true)
  })
})

describe('R3: a 60-minute team session against a 30-minute trailing week -> a cap', () => {
  const sim = new Sim(); sim.calibrate(); sim.runWeeks(MON, 3)
  const teamDay = addDays(MON, 22)
  const p = sim.peek(teamDay, { teamPracticeMin: 60 })

  it('emits a participation cap rather than a workout', () => {
    expect(p.kind).toBe('team_capped')
    expect(p.teamCapMin).toBeGreaterThan(0)
  })

  it('never prescribes full participation', () => {
    expect(p.teamCapMin!).toBeLessThan(60)
  })

  it('derives the cap from his own history, not from what the team is doing', () => {
    const rec = p.audit.caps.find((c) => c.rule === 'team_participation_cap')
    expect(rec).toBeDefined()
    expect(rec!.original).toBe(60)
    expect(rec!.applied).toBeLessThan(60)
  })
})

describe('R4 [AMENDED]: the load guardrail clamps and logs the original', () => {
  // The brief said: ACWR of 1.5 -> clamped to 1.3, original logged. The ACWR
  // clamp was removed outright, see RESEARCH.md §A6 and the I7 block. What
  // replaces it must still clamp and still log, which is what this asserts.
  it('clamps an over-large session and records what it replaced', () => {
    const windows = { acuteMin: 60, chronicMin: 50, thisWeekMin: 20, lastWeekMin: 90, lastBuildWeekMin: 90, longest30dMin: 20, newLongestThisWeek: 0, daysSinceLastRun: 2 }
    const r = applyLoadCaps({ desiredJogMin: 30, windows, weekNumber: 12, isDownWeek: false, toleranceFactor: 1 })
    expect(r.jogMin).toBeLessThan(30)
    const cap = r.caps.find((c) => c.rule === 'session_cap')!
    expect(cap.original).toBe(30)
    expect(cap.applied).toBe(22)
    expect(r.binding).toBe('session_cap')
  })
})

describe('R5: week four is a down week even for an aggressive responder', () => {
  it('cuts the fourth week regardless of how well he is responding', () => {
    const sim = new Sim(); sim.calibrate()
    for (let i = 0; i < 28; i++) {
      const day = addDays(MON, i)
      const p = sim.peek(day)
      if (p.plannedJogMin > 0) { sim.run(day); sim.soreness(addDays(day, 1), 0) } else sim.open(day)
    }
    const s = sim.state(addDays(MON, 21))
    expect(s.weekNumber).toBe(4)
    expect(s.isDownWeek).toBe(true)
    // Asserted on a Monday: a rest day carries no load caps to inspect.
    expect(sim.peek(addDays(MON, 21)).audit.caps.some((c) => c.rule === 'down_week')).toBe(true)
  })
})

describe('R6: a flat probe across three weeks raises a flag', () => {
  it('flags when neither HR nor RPE has improved', () => {
    const sim = new Sim(); sim.calibrate(6.2)
    for (let w = 1; w <= 4; w++) sim.probe(addDays(MON, w * 7), 5.2, 6, 150)
    const s = sim.state(addDays(MON, 29))
    expect(s.probeStagnantFlag).toBe(true)
    expect(s.probeTrend).toBe('flat')
  })

  it('does not flag when it is improving', () => {
    const sim = new Sim(); sim.calibrate(6.2)
    const hrs = [152, 150, 147, 144]
    hrs.forEach((hr, i) => sim.probe(addDays(MON, (i + 1) * 7), 5.2, 6 - i, hr))
    expect(sim.state(addDays(MON, 29)).probeStagnantFlag).toBe(false)
  })
})

describe('R7: eight days without opening the app', () => {
  const sim = new Sim(); sim.calibrate(); sim.runWeeks(MON, 2)
  const silentUntil = addDays(MON, 21) // a Monday; last app open was day 13

  it('decays chronic load', () => {
    const s = sim.state(silentUntil)
    expect(s.load.silenceDecayFactor).toBeLessThan(1)
    expect(s.audit.clamps.some((c) => c.rule === 'silence_decay')).toBe(true)
  })

  it('drops a phase', () => {
    expect(sim.state(silentUntil).phase).toBe('P0')
    expect(sim.state(silentUntil).audit.notes.some((n) => n.includes('without opening the app'))).toBe(true)
  })

  it('prescribes a re-entry session rather than resuming where he left off', () => {
    const p = sim.peek(silentUntil)
    expect(p.kind).toBe('re_entry')
    expect(p.rationaleCode).toBe('re_entry_silence')
  })
})

describe('R8: with no running shoes, no session over 25 minutes can be generated', () => {
  it('caps every session the engine can emit', () => {
    const sim = new Sim(); sim.calibrate()
    sim.profile(MON, { footwearState: 'none' })
    for (let i = 0; i < 60; i++) {
      const day = addDays(MON, i)
      const p = sim.peek(day)
      expect(p.plannedJogMin).toBeLessThanOrEqual(TUNABLES.FOOTWEAR.NONE_SESSION_CAP_MIN)
      if (p.plannedJogMin > 0) sim.run(day); else sim.open(day)
    }
  })

  it('disables outdoor running entirely', () => {
    const sim = new Sim(); sim.calibrate()
    sim.profile(MON, { footwearState: 'none', surface: 'road' })
    const p = sim.peek(addDays(MON, 7))
    expect(p.plannedJogMin).toBe(0)
    expect(p.audit.caps.some((c) => c.rule === 'no_running_shoes')).toBe(true)
  })
})

describe('R9 [AMENDED]: cadence coincidence marks samples suspect; artifact discards them', () => {
  // The brief discarded any sample where bpm == cadence +/-3 for >30 s. For
  // THIS athlete that is the expected state during a legitimate easy run
  // easy HR ~140-155 against a jogging cadence of ~150-170, so the rule as
  // written would delete most valid data and declare honest sessions unusable.
  // Coincidence now lowers confidence; independent evidence discards.
  // See RESEARCH.md §A15.
  // Real heart rate wanders several bpm from minute to minute. Perfectly flat
  // synthetic data would (correctly) trip the variance guard below.
  const steady = (n: number, bpm: number, cadence: number, from = 0): RawHrSample[] =>
    Array.from({ length: n }, (_, i) => ({ t: from + i, bpm: bpm + ((i % 7) - 3), cadenceSpm: cadence, speedMph: 5.2 }))

  it('does not discard a run merely because HR sits near cadence', () => {
    const out = evaluateHrSamples(steady(1200, 152, 154))
    expect(out.discardedPct).toBeLessThanOrEqual(TUNABLES.HR.DISCARD_CONFIDENCE_NONE_PCT)
    expect(out.suspectPct).toBeGreaterThan(0.5)
    expect(out.confidence).toBe('low')
  })

  it('discards samples that step faster than a heart can', () => {
    // Heart rate has a 20-30 s time constant; cadence follows the belt within
    // a stride or two. A jump coincident with a speed change is the sensor.
    const samples: RawHrSample[] = [
      ...steady(60, 140, 150),
      { t: 60, bpm: 172, cadenceSpm: 172, speedMph: 6.5 },
      ...steady(60, 172, 172, 61).map((s) => ({ ...s, speedMph: 6.5 })),
    ]
    const out = evaluateHrSamples(samples)
    expect(out.reasons).toContain('transition')
  })

  it('marks a session unusable once more than 30% is discarded', () => {
    const junk: RawHrSample[] = Array.from({ length: 600 }, (_, i) => ({
      t: i, bpm: i % 2 === 0 ? 300 : 150, cadenceSpm: 160, speedMph: 5.2,
    }))
    const out = evaluateHrSamples(junk)
    expect(out.discardedPct).toBeGreaterThan(TUNABLES.HR.DISCARD_CONFIDENCE_NONE_PCT)
    expect(out.confidence).toBe('none')
  })

  it('discards a pathologically smooth stretch at stable cadence', () => {
    const flat: RawHrSample[] = Array.from({ length: 400 }, (_, i) => ({ t: i, bpm: 155, cadenceSpm: 156, speedMph: 5.2 }))
    expect(evaluateHrSamples(flat).reasons).toContain('variance')
  })
})

describe('R10: HR above the easy ceiling at the prescribed speed lowers the speed, never the ceiling', () => {
  it('drops the speed ceiling and does not raise the HR ceiling', () => {
    const sim = new Sim(); sim.calibrate(6.2, 155) // ceiling 145 bpm, speed 5.2
    const before = sim.state(addDays(MON, 7))
    expect(before.ceilings.easyHrCeiling).toBe(145)

    const day = addDays(MON, 7)
    sim.run(day)
    sim.hrSummary(day, { meanFirst10: 150, meanFirst20: 152, meanMin15to25: 153, confidence: 'usable' })

    const after = sim.state(addDays(MON, 8))
    expect(after.ceilings.speedCeilingMph!).toBeLessThan(before.ceilings.speedCeilingMph!)
    expect(after.ceilings.easyHrCeiling!).toBeLessThanOrEqual(before.ceilings.easyHrCeiling!)
  })
})

describe('R11: a rise late in a long run is drift, not a breach', () => {
  it('treats +8 bpm over minutes 25-35 as expected drift', () => {
    expect(evaluateDrift({
      meanFirst10: 140, meanMin15to25: 148, sessionMin: 40, confidence: 'usable', wbgtC: null,
    })).toBe('expected_drift')
  })

  it('still calls a large early rise too fast', () => {
    expect(evaluateDrift({
      meanFirst10: 140, meanMin15to25: 160, sessionMin: 22, confidence: 'usable', wbgtC: null,
    })).toBe('too_fast')
  })

  it('declines to judge at all when it is hot', () => {
    // At 35 C, HR rises ~11% from minute 15 to 45 at a CONSTANT work rate. That
    // is ~16 bpm at his working HR, so heat alone would trip any threshold.
    expect(evaluateDrift({
      meanFirst10: 140, meanMin15to25: 160, sessionMin: 22, confidence: 'usable', wbgtC: 26,
    })).toBe('not_assessable')
  })
})

describe('R12 [AMENDED]: a talk test of 6.2 mph gives 5.2, not 6.2 and not 5.8', () => {
  // The brief subtracted 0.4 to reach 5.8. That margin is SMALLER than the
  // talk test's own minimal detectable change (~0.9-1.0 mph), a margin inside
  // the instrument's noise floor protects nothing. See RESEARCH.md §A13.
  it('subtracts the full margin', () => {
    const sim = new Sim(); sim.calibrate(6.2)
    expect(sim.state(addDays(MON, 3)).ceilings.conversationalSpeedMph).toBe(5.2)
  })

  it('never prescribes at the raw talk-test speed', () => {
    const sim = new Sim(); sim.calibrate(6.2)
    expect(sim.peek(addDays(MON, 7)).speedMaxMph).toBe(5.2)
  })
})

describe('R13 [AMENDED]: an implausible raw ceiling is rejected, not truncated', () => {
  it('truncates a high-but-plausible reading to the absolute cap', () => {
    // 162 - 10 backoff = 152, above the 150 cap.
    expect(easyHrCeiling(162)).toEqual({ ceiling: 150, truncated: true, rejected: false })
  })

  it('rejects 168 rather than laundering it into 150', () => {
    // The brief resolved 168 to 150. But the talk test approximates VT1, which
    // sits near 140 bpm in an adolescent, so a reading of 168 at talk-test
    // speed is evidence of SENSOR ERROR, most likely cadence lock. Truncating
    // it would turn a garbage measurement into a plausible-looking number.
    expect(easyHrCeiling(168)).toEqual({ ceiling: null, truncated: false, rejected: true })
  })

  it('rejects an implausibly low reading too', () => {
    expect(easyHrCeiling(110).rejected).toBe(true)
  })
})

describe('R14: two drift events inside the window drop both ceilings automatically', () => {
  it('lowers speed and HR ceilings with no input from the athlete', () => {
    const sim = new Sim(); sim.calibrate(6.2, 155)
    const before = sim.state(addDays(MON, 5))
    for (const offset of [7, 9]) {
      const day = addDays(MON, offset)
      sim.run(day)
      sim.hrSummary(day, { meanFirst10: 130, meanFirst20: 138, meanMin15to25: 148, confidence: 'usable' })
    }
    const after = sim.state(addDays(MON, 11))
    expect(after.driftEvents).toBeGreaterThanOrEqual(2)
    expect(after.ceilings.speedCeilingMph!).toBeLessThan(before.ceilings.speedCeilingMph!)
    expect(after.ceilings.easyHrCeiling!).toBeLessThan(before.ceilings.easyHrCeiling!)
  })
})

describe('R15: asking for a higher ceiling is refused', () => {
  it('ignores notes, good feelings and requests', () => {
    const sim = new Sim(); sim.calibrate(6.2)
    const before = sim.state(addDays(MON, 4)).ceilings.speedCeilingMph
    sim.push(addDays(MON, 5), { type: 'note', text: 'please raise my speed, this is too easy' })
    sim.soreness(addDays(MON, 5), 0)
    sim.run(addDays(MON, 7))
    expect(sim.state(addDays(MON, 8)).ceilings.speedCeilingMph).toBe(before)
  })
})

describe('R16: P4 interval work is not governed by heart rate', () => {
  it('applies no HR ceiling in P4', () => {
    // HR lags effort by 30-60 s, so by the time the number arrives the rep is
    // over. Applying a ceiling to interval work produces either a pointless
    // workout or a chased number.
    const sim = new Sim(); sim.calibrate(6.2, 155)
    const state = sim.state(addDays(MON, 7))
    const p4 = { ...state, phase: 'P4' as const }
    expect(prescribe(p4, addDays(MON, 7), { id: 'X' }).hrCeiling).toBeNull()
  })

  it('still applies one in the easy phases', () => {
    const sim = new Sim(); sim.calibrate(6.2, 155)
    expect(sim.peek(addDays(MON, 7)).hrCeiling).toBe(145)
  })

  it('locks tiers above easy until eight unbroken weeks', () => {
    expect(maxTier('P4', 7)).toBe('easy')
    expect(maxTier('P4', 8)).toBe('strides')
  })
})

describe('R17: the whole plan generates with no HR device', () => {
  it('runs eight weeks with no heart-rate data and no null dereference', () => {
    const sim = new Sim(); sim.calibrate(6.2, null)
    sim.profile(MON, { hrDevicePresent: false })
    for (let i = 0; i < 56; i++) {
      const day = addDays(MON, i)
      const p = sim.peek(day)
      expect(p.hrCeiling).toBeNull()
      expect(Number.isFinite(p.plannedJogMin)).toBe(true)
      if (p.plannedJogMin > 0) sim.run(day); else sim.open(day)
    }
    const s = sim.state(addDays(MON, 55))
    expect(s.hrDevicePresent).toBe(false)
    expect(s.ceilings.easyHrCeiling).toBeNull()
    expect(s.ceilings.speedCeilingMph).not.toBeNull()
    expect(s.sessionsCompleted).toBeGreaterThan(15)
  })
})

// R18, "any code path computing a max HR fails by construction". Is
// implemented in noBannedConcepts.static.test.ts, which reads the shipped
// source rather than exercising it. It lives there because a runtime test
// cannot prove the absence of a code path.
