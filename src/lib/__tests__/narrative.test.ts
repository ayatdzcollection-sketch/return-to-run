import { describe, expect, it } from 'vitest'
import { allRationaleCodesCovered, PAIN_QUESTIONS, rationaleSentence, SETUP_NOTICES } from '../narrative.ts'
import { RATIONALE_CODES, type Prescription, type RationaleCode } from '../../engine/types.ts'
import { asLocalDate } from '../../engine/dates.ts'

function stub(code: RationaleCode): Prescription {
  return {
    id: 'X', date: asLocalDate('2026-08-10'), phase: 'P1', kind: 'walk_run', tier: 'walk_run',
    structure: [{ kind: 'walk', minutes: 5 }, { kind: 'jog', minutes: 12 }, { kind: 'walk', minutes: 5 }],
    plannedJogMin: 12, plannedTotalMin: 22, speedCeilingMph: 5.2, speedMinMph: 4.8, speedMaxMph: 5.2,
    hrCeiling: 145, inclinePct: 0.5, teamCapMin: 18, rationaleCode: code,
    audit: { caps: [], binding: null },
  }
}

describe('the narrative layer', () => {
  it('has a template for every rationale code', () => {
    expect(allRationaleCodesCovered()).toBe(true)
  })

  it('renders a real sentence for every code', () => {
    for (const code of RATIONALE_CODES) {
      const s = rationaleSentence({ prescription: stub(code), levelLabel: '12 min jog', weekNumber: 4 })
      expect(s.length, code).toBeGreaterThan(20)
      expect(s.trim()).toBe(s)
      expect(s, code).toMatch(/[.!?]$/)
    }
  })

  it('never claims that a gradual build prevents injury', () => {
    // Buist 2008 tested exactly that claim in 532 novice runners with this
    // athlete's detraining criterion and found 20.8% vs 20.3%, p=0.90. The app
    // is not permitted to imply otherwise.
    const all = [
      ...RATIONALE_CODES.map((c) => rationaleSentence({ prescription: stub(c), levelLabel: '', weekNumber: 1 })),
      ...SETUP_NOTICES.map((n) => `${n.title}. ${n.body}`),
    ].join(' ')

    // Sentence by sentence, because the app is REQUIRED to say the negated
    // form somewhere ("not proven to prevent injury"). What must not appear is
    // the claim asserted, i.e. prevention and injury in one sentence with no
    // negation carrying it.
    for (const sentence of all.split(/(?<=[.!?])\s+/)) {
      const s = sentence.toLowerCase()
      if (/prevent/.test(s) && /injur/.test(s)) {
        expect(s, `unnegated prevention claim: "${sentence}"`).toMatch(/\bnot\b|\bnever\b|\bno\b/)
      }
    }

    expect(all.toLowerCase()).not.toMatch(/injury[- ]proof|keeps you (safe|healthy)|guarantee/)
  })

  it('carries no motivational filler, streaks or badges', () => {
    const all = [
      ...RATIONALE_CODES.map((c) => rationaleSentence({ prescription: stub(c), levelLabel: '', weekNumber: 1 })),
      ...SETUP_NOTICES.map((n) => n.body),
    ].join(' ').toLowerCase()
    for (const banned of ['streak', 'badge', 'crush', 'beast', 'you got this', 'keep it up', 'awesome', 'great job']) {
      expect(all, banned).not.toContain(banned)
    }
  })

  it('asks binary, behaviour-anchored pain questions rather than a severity scale', () => {
    // Pain severity correlates poorly with radiological severity in bone stress
    // injury, and it is the one input he can shade downward at no cost.
    for (const q of PAIN_QUESTIONS) {
      expect(q.text).toMatch(/\?$/)
      expect(q.text.toLowerCase()).not.toMatch(/how bad|rate.*(1|0)[- ]?(10|to)/)
    }
  })

  it('states the honest limitation somewhere in setup', () => {
    const bodies = SETUP_NOTICES.map((n) => n.body.toLowerCase()).join(' ')
    expect(bodies).toContain('not proven to prevent injury')
  })
})
