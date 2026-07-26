import { describe, expect, it } from 'vitest'
import {
  dedupeById, flattenBlocks, isContinuous, jogMinutes, longestContinuousJogMin,
  normalizeEvents, sortEvents, totalMinutes,
} from '../events.ts'
import type { AppEvent, IntervalBlock } from '../types.ts'
import { asLocalDate } from '../dates.ts'

const d = asLocalDate

function ev(id: string, date: string, at: string): AppEvent {
  return { id, at, date: d(date), schema: 1, type: 'app_open' }
}

describe('event ordering', () => {
  it('sorts by date, then timestamp, then id', () => {
    const shuffled = [
      ev('c', '2026-08-02', '2026-08-02T09:00:00Z'),
      ev('b', '2026-08-01', '2026-08-01T18:00:00Z'),
      ev('a', '2026-08-01', '2026-08-01T06:00:00Z'),
    ]
    expect(sortEvents(shuffled).map((e) => e.id)).toEqual(['a', 'b', 'c'])
  })

  it('breaks identical timestamps by id, so the order is total', () => {
    // Two devices can stamp the same instant. Without this tiebreak the fold
    // would be non-deterministic exactly when that is hardest to notice.
    const same = '2026-08-01T06:00:00Z'
    const a = ev('01AAA', '2026-08-01', same)
    const b = ev('01BBB', '2026-08-01', same)
    expect(sortEvents([b, a]).map((e) => e.id)).toEqual(['01AAA', '01BBB'])
    expect(sortEvents([a, b]).map((e) => e.id)).toEqual(['01AAA', '01BBB'])
  })

  it('does not mutate its input', () => {
    const input = [ev('b', '2026-08-02', '2026-08-02T09:00:00Z'), ev('a', '2026-08-01', '2026-08-01T09:00:00Z')]
    sortEvents(input)
    expect(input.map((e) => e.id)).toEqual(['b', 'a'])
  })
})

describe('deduplication', () => {
  it('keeps the first occurrence of a repeated id', () => {
    // Sync is at-least-once by design, so the same event arrives more than once.
    const a = ev('x', '2026-08-01', '2026-08-01T09:00:00Z')
    expect(dedupeById([a, a, a])).toHaveLength(1)
  })

  it('normalizes in one pass', () => {
    const a = ev('a', '2026-08-01', '2026-08-01T09:00:00Z')
    const b = ev('b', '2026-08-02', '2026-08-02T09:00:00Z')
    expect(normalizeEvents([b, a, b, a]).map((e) => e.id)).toEqual(['a', 'b'])
  })
})

describe('structure arithmetic', () => {
  // The seed prior's opening session: 5 min walk, 8x(1 jog / 2 walk), 5 min walk.
  const seedSession1: IntervalBlock[] = [
    { kind: 'walk', minutes: 5 },
    { kind: 'repeat', times: 8, blocks: [{ kind: 'jog', minutes: 1 }, { kind: 'walk', minutes: 2 }] },
    { kind: 'walk', minutes: 5 },
  ]

  it('expands repeats', () => {
    expect(flattenBlocks(seedSession1)).toHaveLength(1 + 16 + 1)
  })

  it('counts jogging minutes only — walking is not load (I1)', () => {
    expect(jogMinutes(seedSession1)).toBe(8)
    expect(totalMinutes(seedSession1)).toBe(5 + 8 * 3 + 5)
  })

  it('counts strides as running minutes', () => {
    const withStrides: IntervalBlock[] = [
      { kind: 'jog', minutes: 20 },
      { kind: 'strides', count: 4, seconds: 15 },
    ]
    expect(jogMinutes(withStrides)).toBe(21)
  })

  it('measures the longest unbroken jog, not the total', () => {
    expect(longestContinuousJogMin(seedSession1)).toBe(1)
    expect(longestContinuousJogMin([
      { kind: 'walk', minutes: 5 },
      { kind: 'repeat', times: 2, blocks: [{ kind: 'jog', minutes: 12 }, { kind: 'walk', minutes: 2 }] },
    ])).toBe(12)
  })

  it('merges adjacent jog blocks with no walk between them', () => {
    // A structure is measured by what it asks of him, not by how it is written.
    expect(longestContinuousJogMin([
      { kind: 'jog', minutes: 10 },
      { kind: 'jog', minutes: 5 },
    ])).toBe(15)
  })

  it('recognizes a continuous session', () => {
    expect(isContinuous([{ kind: 'walk', minutes: 5 }, { kind: 'jog', minutes: 30 }])).toBe(true)
    expect(isContinuous(seedSession1)).toBe(false)
    expect(isContinuous([{ kind: 'walk', minutes: 20 }])).toBe(false)
  })

  it('treats a rest day as zero load', () => {
    expect(jogMinutes([])).toBe(0)
    expect(totalMinutes([])).toBe(0)
    expect(longestContinuousJogMin([])).toBe(0)
  })
})
