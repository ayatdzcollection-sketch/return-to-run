import { describe, expect, it } from 'vitest'
import {
  addDays, asLocalDate, compareDates, datesBetween, dayOfWeek, diffDays,
  fromDayNumber, isLeapYear, mondayOf, sundayOf, toDayNumber, trailingWindow,
  tryLocalDate, weeksBetween, withinWindow,
} from '../dates.ts'

const d = asLocalDate

describe('LocalDate validation', () => {
  it('accepts a well-formed date', () => {
    expect(d('2026-08-10')).toBe('2026-08-10')
  })

  it('rejects malformed strings', () => {
    for (const bad of ['2026-8-10', '20260810', '2026/08/10', '', 'today', '2026-08-10T00:00']) {
      expect(() => d(bad)).toThrow()
      expect(tryLocalDate(bad)).toBeNull()
    }
  })

  it('rejects impossible calendar days', () => {
    expect(() => d('2026-02-29')).toThrow()   // 2026 is not a leap year
    expect(() => d('2026-13-01')).toThrow()
    expect(() => d('2026-04-31')).toThrow()
    expect(d('2024-02-29')).toBe('2024-02-29') // 2024 is
  })

  it('knows its leap years', () => {
    expect(isLeapYear(2024)).toBe(true)
    expect(isLeapYear(2026)).toBe(false)
    expect(isLeapYear(1900)).toBe(false)
    expect(isLeapYear(2000)).toBe(true)
  })
})

describe('day-number conversion', () => {
  it('anchors on the unix epoch', () => {
    expect(toDayNumber(d('1970-01-01'))).toBe(0)
    expect(fromDayNumber(0)).toBe('1970-01-01')
  })

  it('round-trips across a decade, month ends and leap days included', () => {
    for (let n = toDayNumber(d('2020-01-01')); n <= toDayNumber(d('2030-01-01')); n++) {
      expect(toDayNumber(fromDayNumber(n))).toBe(n)
    }
  })

  it('handles dates before the epoch', () => {
    expect(fromDayNumber(toDayNumber(d('1899-12-31')))).toBe('1899-12-31')
    expect(toDayNumber(d('1969-12-31'))).toBe(-1)
  })
})

describe('arithmetic', () => {
  it('adds and subtracts across month and year boundaries', () => {
    expect(addDays(d('2026-08-10'), 1)).toBe('2026-08-11')
    expect(addDays(d('2026-07-31'), 1)).toBe('2026-08-01')
    expect(addDays(d('2026-12-31'), 1)).toBe('2027-01-01')
    expect(addDays(d('2026-01-01'), -1)).toBe('2025-12-31')
    expect(addDays(d('2024-02-28'), 1)).toBe('2024-02-29')
    expect(addDays(d('2026-02-28'), 1)).toBe('2026-03-01')
  })

  it('measures signed distance in whole days', () => {
    expect(diffDays(d('2026-08-10'), d('2026-07-26'))).toBe(15)
    expect(diffDays(d('2026-07-26'), d('2026-08-10'))).toBe(-15)
    expect(diffDays(d('2026-08-10'), d('2026-08-10'))).toBe(0)
  })

  it('orders dates', () => {
    expect(compareDates(d('2026-01-01'), d('2026-01-02'))).toBe(-1)
    expect(compareDates(d('2026-01-02'), d('2026-01-01'))).toBe(1)
    expect(compareDates(d('2026-01-01'), d('2026-01-01'))).toBe(0)
  })
})

describe('Monday-anchored weeks', () => {
  it('numbers days with Monday as 0', () => {
    // 2026-08-10 is a Monday; the brief pins team practice to that date.
    expect(dayOfWeek(d('2026-08-10'))).toBe(0)
    expect(dayOfWeek(d('2026-08-11'))).toBe(1)
    expect(dayOfWeek(d('2026-08-16'))).toBe(6) // Sunday
    expect(dayOfWeek(d('1970-01-01'))).toBe(3) // a Thursday
  })

  it('finds the Monday of any day, itself included', () => {
    expect(mondayOf(d('2026-08-10'))).toBe('2026-08-10')
    expect(mondayOf(d('2026-08-16'))).toBe('2026-08-10')
    expect(mondayOf(d('2026-08-09'))).toBe('2026-08-03')
    expect(sundayOf(d('2026-08-10'))).toBe('2026-08-16')
  })

  it('counts whole weeks between week anchors', () => {
    expect(weeksBetween(d('2026-08-16'), d('2026-08-10'))).toBe(0) // same week
    expect(weeksBetween(d('2026-08-17'), d('2026-08-10'))).toBe(1)
    expect(weeksBetween(d('2026-08-03'), d('2026-08-10'))).toBe(-1)
  })
})

describe('windows', () => {
  it('enumerates an inclusive range and is empty when reversed', () => {
    expect(datesBetween(d('2026-08-10'), d('2026-08-12')))
      .toEqual(['2026-08-10', '2026-08-11', '2026-08-12'])
    expect(datesBetween(d('2026-08-10'), d('2026-08-10'))).toEqual(['2026-08-10'])
    expect(datesBetween(d('2026-08-12'), d('2026-08-10'))).toEqual([])
  })

  it('builds a trailing window that includes today', () => {
    // A 7-day acute window is today plus the six days before it — not eight days.
    const w = trailingWindow(d('2026-08-10'), 7)
    expect(w).toEqual({ start: '2026-08-04', end: '2026-08-10' })
    expect(datesBetween(w.start, w.end)).toHaveLength(7)
  })

  it('tests membership inclusively at both edges', () => {
    expect(withinWindow(d('2026-08-04'), d('2026-08-04'), d('2026-08-10'))).toBe(true)
    expect(withinWindow(d('2026-08-10'), d('2026-08-04'), d('2026-08-10'))).toBe(true)
    expect(withinWindow(d('2026-08-03'), d('2026-08-04'), d('2026-08-10'))).toBe(false)
    expect(withinWindow(d('2026-08-11'), d('2026-08-04'), d('2026-08-10'))).toBe(false)
  })
})
