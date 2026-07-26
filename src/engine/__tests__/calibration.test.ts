// The talk-test ladder has to be able to REACH this athlete's easy speed.
//
// The build brief's discovery session stops at 8 minutes, stepping 0.2 mph
// from 4.0 — a ceiling of 4.6 mph. Minus the 1.0 mph margin that is 3.6 mph,
// which is a brisk walk. Left alone, the engine could never derive a jogging
// speed at all, and the flaw is invisible in any test that hands calibration a
// result rather than running the ladder.

import { describe, expect, it } from 'vitest'
import { Sim, d } from './harness.ts'
import { addDays } from '../dates.ts'
import { TUNABLES } from '../../config/tunables.ts'
import type { StopReason } from '../types.ts'

const MON = d('2026-07-27')

function ladder(sim: Sim, date: ReturnType<typeof d>, from: number, steps: number, stopReason: StopReason) {
  const stepped = Array.from({ length: steps }, (_, i) => ({
    speedMph: round1(from + i * TUNABLES.TALK_TEST.LADDER_STEP_MPH),
    meanHrLast60s: 130 + i * 4,
  }))
  sim.open(date)
  sim.push(date, {
    type: 'talk_test_result',
    steps: stepped,
    passedSpeedMph: stopReason === 'time_limit'
      ? stepped.at(-1)!.speedMph
      : stepped.at(-2)!.speedMph,
    stopReason,
  })
}

function round1(n: number) { return Math.round(n * 10) / 10 }

describe('an unfinished ladder does not complete calibration', () => {
  it('keeps prescribing discovery, resuming where it stopped', () => {
    const sim = new Sim()
    // Eight minutes at 0.2 mph steps: 4.0, 4.2, 4.4, 4.6, then out of time.
    ladder(sim, MON, 4.0, 4, 'time_limit')

    const next = sim.peek(addDays(MON, 2))
    expect(next.kind).toBe('calibration_discovery')
    // Resumes from the top speed reached, rather than starting over at 4.0 and
    // never getting anywhere.
    expect(next.speedMinMph).toBe(4.6)
    expect(sim.state(addDays(MON, 2)).ceilings.conversationalSpeedMph).toBeNull()
  })

  it('reaches a real jogging speed across a few short sessions', () => {
    const sim = new Sim()
    ladder(sim, MON, 4.0, 4, 'time_limit')
    ladder(sim, addDays(MON, 2), 4.6, 4, 'time_limit')
    ladder(sim, addDays(MON, 4), 5.2, 5, 'breathing_change')

    const speed = sim.state(addDays(MON, 5)).ceilings.conversationalSpeedMph!
    // Passed 5.8, minus the full 1.0 mph margin.
    expect(speed).toBe(4.8)
    expect(speed).toBeGreaterThanOrEqual(TUNABLES.TALK_TEST.MIN_VIABLE_JOG_MPH)
  })

  it('still applies the full margin when it gives up and accepts the top speed', () => {
    // A stubborn athlete who never reports a breathing change must not be left
    // without a plan forever — but the result errs slow.
    const sim = new Sim()
    ladder(sim, MON, 4.0, 4, 'time_limit')
    ladder(sim, addDays(MON, 2), 4.6, 4, 'time_limit')
    ladder(sim, addDays(MON, 4), 5.2, 4, 'time_limit')

    const state = sim.state(addDays(MON, 5))
    expect(state.ceilings.conversationalSpeedMph).not.toBeNull()
    expect(state.ceilings.conversationalSpeedMph!)
      .toBeLessThanOrEqual(5.8 - TUNABLES.TALK_TEST.BACKOFF_MPH)
  })

  it('flags a below-jog ceiling instead of dressing a walk up as a run', () => {
    const sim = new Sim()
    ladder(sim, MON, 4.0, 5, 'breathing_change')   // passed 4.6 -> 3.6 mph
    const state = sim.state(addDays(MON, 1))
    expect(state.belowJogFloor).toBe(true)
    const p = sim.peek(addDays(MON, 7))
    expect(p.audit.caps.some((c) => c.rule === 'below_jog_floor')).toBe(true)
  })
})
