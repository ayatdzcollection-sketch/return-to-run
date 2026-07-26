// ============================================================
// Determinism, convergence, and a twelve-week replay.
//
// The invariant tests prove the rules hold in the situations someone thought
// to write down. These prove the two properties that make those tests mean
// anything: the fold is order-independent (so two devices converge), and the
// rails hold on every single day of a long, messy season rather than only at
// the moments a test happens to sample.
// ============================================================

import { describe, expect, it } from 'vitest'
import fc from 'fast-check'
import { Sim, d } from './harness.ts'
import { computeState } from '../fold.ts'
import { addDays } from '../dates.ts'
import { normalizeEvents } from '../events.ts'
import { TUNABLES } from '../../config/tunables.ts'
import { LADDER } from '../../config/seedPlan.ts'

const MON = d('2026-07-27')

/** Deterministic shuffle so a failure is reproducible. */
function shuffle<T>(xs: readonly T[], seed: number): T[] {
  const out = [...xs]
  let s = seed
  for (let i = out.length - 1; i > 0; i--) {
    s = (s * 1103515245 + 12345) & 0x7fffffff
    const j = s % (i + 1)
    ;[out[i], out[j]] = [out[j]!, out[i]!]
  }
  return out
}

describe('the fold is order-independent', () => {
  const sim = new Sim(); sim.calibrate(); sim.runWeeks(MON, 4)
  const today = addDays(MON, 27)
  const reference = computeState(sim.events, today)

  it('produces identical state from a shuffled log', () => {
    // This is what lets two devices sync by plain set union with no conflict
    // resolution: a grow-only set plus an order-independent fold is convergent
    // by construction.
    for (const seed of [1, 7, 42, 1234, 99999]) {
      const shuffled = computeState(shuffle(sim.events, seed), today)
      expect(shuffled.level).toBe(reference.level)
      expect(shuffled.phase).toBe(reference.phase)
      expect(shuffled.load.acuteMin).toBe(reference.load.acuteMin)
      expect(shuffled.ceilings).toEqual(reference.ceilings)
      expect(shuffled.sessionsCompleted).toBe(reference.sessionsCompleted)
    }
  })

  it('is unchanged by duplicate delivery', () => {
    // Sync is at-least-once, so every event arrives more than once eventually.
    const doubled = computeState([...sim.events, ...sim.events], today)
    expect(doubled.load.acuteMin).toBe(reference.load.acuteMin)
    expect(doubled.level).toBe(reference.level)
  })

  it('normalizes to the same canonical sequence regardless of arrival order', () => {
    const a = normalizeEvents(sim.events).map((e) => e.id)
    const b = normalizeEvents(shuffle(sim.events, 5)).map((e) => e.id)
    expect(a).toEqual(b)
  })
})

describe('twelve weeks, day by day, with the rails asserted every day', () => {
  // A scripted athlete: mostly compliant, one bad patch, one pain event, one
  // silent week, then team practice.
  function runSeason(withHr: boolean) {
    const sim = new Sim()
    sim.calibrate(6.2, withHr ? 155 : null)
    sim.profile(MON, { hrDevicePresent: withHr })

    let lastRunDay: number | null = null
    for (let i = 0; i < 84; i++) {
      const day = addDays(MON, i)

      // A silent week: he stops opening the app entirely.
      if (i >= 35 && i < 43) continue

      const p = sim.peek(day)

      // Every prescription, on every day, obeys the rails.
      expect(p.plannedJogMin).toBeLessThanOrEqual(TUNABLES.LOAD.TERMINAL_SESSION_CEILING_MIN)
      expect(p.plannedJogMin).toBeGreaterThanOrEqual(0)
      expect(Number.isFinite(p.plannedTotalMin)).toBe(true)
      if (!withHr) expect(p.hrCeiling).toBeNull()

      if (p.plannedJogMin > 0) {
        // 48 hours between runs, always.
        if (lastRunDay !== null) {
          expect(i - lastRunDay, `ran on consecutive days at offset ${i}`).toBeGreaterThanOrEqual(2)
        }
        lastRunDay = i
      }

      if (i === 30) {
        // Calf pain at 4/10 — muscular, so the soft branch.
        sim.pain(day, 'calf', 4)
        sim.answerGate(addDays(day, 1), 'post_pain')
        continue
      }
      if (i >= 21 && i <= 23 && p.plannedJogMin > 0) { sim.cutShort(day, p.plannedJogMin / 2); continue }
      if (i >= 70 && i % 2 === 0) { sim.open(day); sim.external(day, 45); continue }

      if (p.plannedJogMin > 0) {
        sim.run(day)
        sim.soreness(addDays(day, 1), i % 5 === 0 ? 1 : 0)
        if (withHr) sim.hrSummary(day, { meanFirst10: 132, meanFirst20: 134, meanMin15to25: 137, confidence: 'usable' })
      } else {
        sim.open(day)
      }
    }
    return sim
  }

  it('never breaks a rail across a full season, with HR', () => {
    const sim = runSeason(true)
    const final = sim.state(addDays(MON, 83))
    expect(final.sessionsCompleted).toBeGreaterThan(20)
    expect(final.load.acwr).toBeNull()
  })

  it('never breaks a rail across a full season, with no HR device at all', () => {
    const sim = runSeason(false)
    const final = sim.state(addDays(MON, 83))
    expect(final.ceilings.easyHrCeiling).toBeNull()
    expect(final.ceilings.speedCeilingMph).not.toBeNull()
    expect(final.sessionsCompleted).toBeGreaterThan(20)
  })

  it('recovers from the silent week by regressing, not by catching up', () => {
    const sim = runSeason(true)
    const beforeSilence = sim.state(addDays(MON, 34))
    const afterSilence = sim.state(addDays(MON, 43))
    expect(afterSilence.load.silenceDecayFactor).toBeLessThanOrEqual(1)
    // Never more volume than before the gap.
    expect(sim.peek(addDays(MON, 43)).plannedJogMin)
      .toBeLessThanOrEqual(LADDER[beforeSilence.level - 1]!.jogMin)
  })
})

describe('properties that must hold for any log the engine can produce', () => {
  it('never prescribes above the terminal ceiling, whatever the history', () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 0, max: 3 }), { minLength: 5, maxLength: 40 }),
        (script) => {
          const sim = new Sim()
          sim.calibrate()
          for (let i = 0; i < script.length; i++) {
            const day = addDays(MON, i)
            const p = sim.peek(day)
            expect(p.plannedJogMin).toBeLessThanOrEqual(TUNABLES.LOAD.TERMINAL_SESSION_CEILING_MIN)
            if (p.plannedJogMin === 0) { sim.open(day); continue }
            switch (script[i]! % 4) {
              case 0: sim.run(day); break
              case 1: sim.cutShort(day, p.plannedJogMin / 2); break
              case 2: sim.miss(day); break
              default: sim.open(day)
            }
          }
          return true
        },
      ),
      { numRuns: 30 },
    )
  })

  it('never raises a ceiling without probe evidence, whatever he reports', () => {
    fc.assert(
      fc.property(
        fc.array(fc.constantFrom(0, 1, 2, 3), { minLength: 3, maxLength: 20 }),
        (soreness) => {
          const sim = new Sim()
          sim.calibrate(6.2)
          const base = sim.state(addDays(MON, 3)).ceilings.speedCeilingMph!
          for (let i = 0; i < soreness.length; i++) {
            const day = addDays(MON, i + 3)
            sim.soreness(day, soreness[i]! as 0 | 1 | 2 | 3)
            const p = sim.peek(day)
            if (p.plannedJogMin > 0) sim.run(day); else sim.open(day)
          }
          const after = sim.state(addDays(MON, soreness.length + 3)).ceilings.speedCeilingMph!
          // Feeling good is not evidence. Only two weeks of falling probe HR is.
          expect(after).toBeLessThanOrEqual(base)
          return true
        },
      ),
      { numRuns: 30 },
    )
  })
})
