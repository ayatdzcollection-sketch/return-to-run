// The inputs that were built, tested, and then had no way to reach the engine.
//
// The soreness case below is the one that mattered: it was not a missing
// feature, it was a silent bias. With no soreness data the "never sore"
// condition read as trivially true, so the athlete was classified `aggressive`
// and advanced a rung every two clean sessions instead of three. He was being
// moved up faster because nobody had asked him a question.

import { describe, expect, it } from 'vitest'
import { Sim, d } from './harness.ts'
import { addDays } from '../dates.ts'
import { approximateWbgt } from '../../lib/weather.ts'
import { heatLimit } from '../modifiers.ts'
import { TUNABLES } from '../../config/tunables.ts'

const MON = d('2026-07-27')

describe('soreness changes the tolerance class, which changes the ramp', () => {
  function ramp(logSoreness: null | (0 | 1 | 2 | 3)) {
    const sim = new Sim(); sim.calibrate(6.2)
    for (let i = 0; i < 10; i++) {
      const day = addDays(MON, i)
      const p = sim.peek(day)
      if (p.plannedJogMin > 0) {
        sim.run(day)
        if (logSoreness !== null) sim.soreness(addDays(day, 1), logSoreness)
      } else sim.open(day)
    }
    return sim.state(addDays(MON, 9))
  }

  it('classifies a genuinely untroubled athlete as aggressive', () => {
    expect(ramp(0).toleranceClass).toBe('aggressive')
  })

  it('stops guessing aggressive once he reports being sore', () => {
    const sore = ramp(2)
    expect(sore.toleranceClass).not.toBe('aggressive')
    // And that costs him a rung of speed: three clean sessions per level, not two.
    expect(sore.sessionsNeededPerLevel).toBe(TUNABLES.LADDER.SESSIONS_PER_LEVEL_DEFAULT)
  })

  it('advances more slowly when soreness is reported than when it is not', () => {
    expect(ramp(2).level).toBeLessThanOrEqual(ramp(0).level)
  })
})

describe('the weekly probe can now actually raise a ceiling', () => {
  it('raises only after two consecutive weeks of falling HR at the frozen speed', () => {
    const sim = new Sim(); sim.calibrate(6.2)
    const base = sim.state(addDays(MON, 3)).ceilings.speedCeilingMph!
    sim.probe(addDays(MON, 7), 5.2, 6, 152)
    sim.probe(addDays(MON, 14), 5.2, 5, 148)
    sim.probe(addDays(MON, 21), 5.2, 5, 145)
    expect(sim.state(addDays(MON, 22)).ceilings.speedCeilingMph!).toBeGreaterThan(base)
  })
})

describe('a manually typed average heart rate reaches the ceiling check', () => {
  it('lowers the speed ceiling when the average exceeded the easy ceiling', () => {
    // v1 heart-rate entry is him typing what the watch showed, which is capped
    // at `low` confidence. If the ceiling check refused `low` it could never
    // fire at all, which is what was happening.
    const sim = new Sim(); sim.calibrate(6.2, 155) // easy ceiling 145
    const before = sim.state(addDays(MON, 6)).ceilings.speedCeilingMph!
    const day = addDays(MON, 7)
    sim.run(day)
    sim.hrSummary(day, { meanFirst20: 151, confidence: 'low' })
    expect(sim.state(addDays(MON, 8)).ceilings.speedCeilingMph!).toBeLessThan(before)
  })

  it('still refuses to judge drift from a single number', () => {
    // A typed average is a mean and nothing more. Inventing a drift verdict
    // from it would be making up the one signal it cannot contain.
    const sim = new Sim(); sim.calibrate(6.2, 155)
    const day = addDays(MON, 7)
    sim.run(day)
    sim.hrSummary(day, { meanFirst20: 130, meanFirst10: null, meanMin15to25: null, confidence: 'low' })
    expect(sim.state(addDays(MON, 8)).driftEvents).toBe(0)
  })
})

describe('team practice reaches the load model', () => {
  it('emits a participation cap well under what the team is doing', () => {
    const sim = new Sim(); sim.calibrate(); sim.runWeeks(MON, 3)
    const p = sim.peek(addDays(MON, 22), { teamPracticeMin: 60 })
    expect(p.kind).toBe('team_capped')
    expect(p.teamCapMin!).toBeLessThan(60)
  })

  it('counts an unprescribed run identically to a prescribed one', () => {
    const sim = new Sim(); sim.calibrate(); sim.runWeeks(MON, 2)
    const before = sim.state(addDays(MON, 14)).load.acuteMin
    sim.external(addDays(MON, 14), 25)
    expect(sim.state(addDays(MON, 14)).load.acuteMin).toBe(before + 25)
  })
})

describe('heat now has a number to act on', () => {
  it('approximates WBGT below dry-bulb, as a wet-bulb index must', () => {
    const wbgt = approximateWbgt(30, 50)
    expect(wbgt).toBeLessThan(30)
    expect(wbgt).toBeGreaterThan(20)
  })

  it('rises with humidity at a fixed temperature', () => {
    expect(approximateWbgt(30, 80)).toBeGreaterThan(approximateWbgt(30, 30))
  })

  it('turns a hot Michigan afternoon into a real duration cut', () => {
    // ~32 C and humid is an ordinary August afternoon there.
    const limit = heatLimit(approximateWbgt(32, 70))
    expect(limit.level === 'high' || limit.level === 'unsafe').toBe(true)
    expect(limit.durationFactor).toBeLessThan(1)
  })

  it('does nothing at all when there is no reading', () => {
    // Offline in a basement must not block a treadmill session.
    expect(heatLimit(null)).toMatchObject({ level: 'none', durationFactor: 1, prohibited: false })
  })

  it('does not let outdoor heat cancel an indoor treadmill session', () => {
    // A hot Michigan afternoon he is not standing in must not zero a session
    // in a basement. This one only showed up by running the real app.
    const sim = new Sim(); sim.calibrate(6.2)
    const hot = sim.peek(addDays(MON, 2), { wbgtC: 34 })
    expect(hot.plannedJogMin).toBeGreaterThan(0)
    expect(hot.audit.caps.some((c) => c.rule.startsWith('heat_'))).toBe(false)
  })

  it('but still applies it once he is running outdoors', () => {
    const sim = new Sim(); sim.calibrate(6.2)
    sim.profile(MON, { surface: 'road', footwearState: 'broken_in' })
    const hot = sim.peek(addDays(MON, 2), { wbgtC: 34 })
    expect(hot.plannedJogMin).toBe(0)
  })
})
