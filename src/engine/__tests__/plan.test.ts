// The arc: where he is, what is coming, and when the engine runs out of road.
//
// The projection is the one forward-looking number in the app, so it gets held
// to the same standard as everything else: it must be reachable by the rules
// the engine actually applies, and it must never quietly flatter the deadline.

import { describe, expect, it } from 'vitest'
import { Sim, d } from './harness.ts'
import { addDays, dayOfWeek } from '../dates.ts'
import { planStatus, projectPlan, type PlanInputs } from '../plan.ts'
import { PLAN, TUNABLES } from '../../config/tunables.ts'
import { TOP_LEVEL } from '../../config/seedPlan.ts'

const MON = d('2026-07-27')

function inputs(over: Partial<PlanInputs> = {}): PlanInputs {
  return {
    today: MON,
    level: 1,
    cleanSessionsAtLevel: 0,
    sessionsNeededPerLevel: 3,
    bestContinuousMin: 0,
    firstDate: MON,
    topLevelCompletions: [],
    interrupted: false,
    ...over,
  }
}

describe('projection', () => {
  it('lands the goal on a long day, not merely on the top rung', () => {
    // Monday and Wednesday are scaled down, so reaching level 9 on a Wednesday
    // is not the same as running 30 minutes unbroken.
    const p = projectPlan(inputs())
    expect(p.goalDate).not.toBeNull()
    expect(dayOfWeek(p.goalDate!)).toBe(4) // Friday
  })

  it('takes the number of weeks the literature says it should', () => {
    // Published protocols reach 30 min continuous in 19-33 sessions across
    // 4.5-13 weeks for unsupervised novices. Nine rungs at three clean
    // sessions each is 27 sessions at three a week.
    const p = projectPlan(inputs())
    expect(p.weeksToGoal).toBeGreaterThanOrEqual(8)
    expect(p.weeksToGoal).toBeLessThanOrEqual(13)
  })

  it('reports the miss against the tryout date rather than hiding it', () => {
    const p = projectPlan(inputs())
    expect(p.missesTargetBy).not.toBeNull()
    expect(p.missesTargetBy!).toBeGreaterThan(0)
  })

  it('moves earlier for a responder who advances in two sessions, not three', () => {
    const slow = projectPlan(inputs({ sessionsNeededPerLevel: 3 }))
    const fast = projectPlan(inputs({ sessionsNeededPerLevel: 2 }))
    expect(fast.weeksToGoal!).toBeLessThan(slow.weeksToGoal!)
  })

  it('never projects a session above the terminal ceiling', () => {
    for (const day of projectPlan(inputs()).days) {
      expect(day.approxJogMin).toBeLessThanOrEqual(TUNABLES.LOAD.TERMINAL_SESSION_CEILING_MIN)
    }
  })

  it('projects exactly three run days a week, never consecutive', () => {
    const days = projectPlan(inputs()).days.slice(0, 28)
    for (let w = 0; w < 4; w++) {
      expect(days.slice(w * 7, w * 7 + 7).filter((x) => x.isRunDay)).toHaveLength(3)
    }
    for (let i = 1; i < days.length; i++) {
      expect(days[i]!.isRunDay && days[i - 1]!.isRunDay).toBe(false)
    }
  })

  it('reports the goal as already reached once he has actually run it', () => {
    const done = d('2026-09-18')
    const p = projectPlan(inputs({
      today: addDays(done, 3), // a completion cannot be in the future
      bestContinuousMin: 30,
      topLevelCompletions: [done],
    }))
    expect(p.goalDate).toBe(done)
    expect(p.weeksToGoal).toBe(0)
  })
})

describe('block status', () => {
  it('starts in the return block', () => {
    expect(planStatus(inputs()).block).toBe('return')
    expect(planStatus(inputs()).needsNewPlan).toBe(false)
  })

  it('moves to the season block once 30 minutes is done', () => {
    const s = planStatus(inputs({ bestContinuousMin: 30, topLevelCompletions: [d('2026-09-18')], today: d('2026-09-25') }))
    expect(s.block).toBe('season')
    expect(s.levelsDone).toBe(TOP_LEVEL)
    expect(s.needsNewPlan).toBe(false)
  })

  it('asks for a new plan once it is only repeating itself', () => {
    // Holding at the top rung is safe, but it is not a plan any more.
    const s = planStatus(inputs({
      bestContinuousMin: 30,
      topLevelCompletions: [d('2026-08-21')],
      today: addDays(d('2026-08-21'), 7 * (PLAN.SEASON_REVIEW_WEEKS + 1)),
    }))
    expect(s.block).toBe('needs_new_plan')
    expect(s.needsNewPlan).toBe(true)
    expect(s.reason).toContain('30 minutes')
  })

  it('asks for a new plan once the season it was written for is over', () => {
    const s = planStatus(inputs({ today: addDays(PLAN.HORIZON_DATE, 1) }))
    expect(s.block).toBe('needs_new_plan')
    expect(s.reason).toContain('season')
  })
})

describe('the fold exposes the arc to the UI', () => {
  it('carries plan status and a projection through computeState', () => {
    const sim = new Sim(); sim.calibrate(6.2)
    const state = sim.state(addDays(MON, 3))
    expect(state.plan.block).toBe('return')
    expect(state.plan.levelsTotal).toBe(TOP_LEVEL)
    expect(state.projection.goalDate).not.toBeNull()
    expect(state.projection.days.length).toBeGreaterThan(60)
  })

  it('pulls the estimate in as he actually completes rungs', () => {
    const sim = new Sim(); sim.calibrate(6.2)
    const early = sim.state(addDays(MON, 3)).projection.goalDate!
    sim.runWeeks(MON, 3)
    const later = sim.state(addDays(MON, 21)).projection.goalDate!
    // Three weeks of clean sessions should not push the estimate further away.
    expect(later <= early).toBe(true)
  })
})
