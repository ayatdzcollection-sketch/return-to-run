// ============================================================
// CALENDAR ARITHMETIC: pure integer math, no `Date` anywhere.
//
// The engine must be replayable: given the same event log and the same
// `today`, it must produce the same prescription on any device, in any
// timezone, at any wall-clock moment. Reading a clock inside the engine
// would break that, so the engine never does, `today` is always passed in
// from src/lib/clock.ts, which is the only file in the codebase permitted
// to touch `Date`.
//
// That ban is enforced mechanically (noBannedConcepts.static.test.ts greps
// src/engine for the identifier), which is why even the *deterministic*
// parts of Date are avoided here: `Date.UTC` would be safe in principle,
// but "the string `Date` never appears in src/engine" is a rule with no
// exceptions to reason about, and this is safety-critical code.
//
// The civil-date <-> day-number conversions below are Howard Hinnant's
// days_from_civil / civil_from_days algorithms (proleptic Gregorian, exact
// for all years in range). They are the standard formulation; the only
// adaptation is JavaScript integer division via Math.floor/Math.trunc.
// ============================================================

/**
 * A calendar day in the athlete's own local timezone, 'YYYY-MM-DD'.
 *
 * Branded so a raw string can't be passed where a validated date is expected.
 * Events carry the local date stamped at creation and the engine trusts it
 * it never re-derives a date from a timestamp, so a device travelling across
 * a timezone can't silently reassign a session to a different day.
 */
export type LocalDate = string & { readonly __localDate: unique symbol }

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/

/** Validate and brand a 'YYYY-MM-DD' string. Throws on anything else. */
export function asLocalDate(s: string): LocalDate {
  const m = DATE_RE.exec(s)
  if (!m) throw new Error(`Not a LocalDate (expected YYYY-MM-DD): ${JSON.stringify(s)}`)
  const y = Number(m[1]), mo = Number(m[2]), d = Number(m[3])
  if (mo < 1 || mo > 12) throw new Error(`Month out of range in ${s}`)
  if (d < 1 || d > daysInMonth(y, mo)) throw new Error(`Day out of range in ${s}`)
  return s as LocalDate
}

/** Non-throwing variant: null when the string isn't a valid calendar date. */
export function tryLocalDate(s: string): LocalDate | null {
  try { return asLocalDate(s) } catch { return null }
}

export function isLeapYear(y: number): boolean {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0
}

export function daysInMonth(y: number, m: number): number {
  if (m === 2) return isLeapYear(y) ? 29 : 28
  return m === 4 || m === 6 || m === 9 || m === 11 ? 30 : 31
}

/** Days since 1970-01-01 (negative before it). Hinnant days_from_civil. */
export function toDayNumber(date: LocalDate): number {
  const m = DATE_RE.exec(date)!
  let y = Number(m[1])
  const mo = Number(m[2]), d = Number(m[3])
  y -= mo <= 2 ? 1 : 0
  const era = Math.floor(y / 400)
  const yoe = y - era * 400                                        // [0, 399]
  const doy = Math.floor((153 * (mo + (mo > 2 ? -3 : 9)) + 2) / 5) + d - 1
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy
  return era * 146097 + doe - 719468
}

/** Inverse of toDayNumber. Hinnant civil_from_days. */
export function fromDayNumber(n: number): LocalDate {
  const z = n + 719468
  const era = Math.floor(z / 146097)
  const doe = z - era * 146097                                     // [0, 146096]
  const yoe = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365)
  const y = yoe + era * 400
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100))
  const mp = Math.floor((5 * doy + 2) / 153)                       // [0, 11]
  const d = doy - Math.floor((153 * mp + 2) / 5) + 1               // [1, 31]
  const mo = mp + (mp < 10 ? 3 : -9)                               // [1, 12]
  const year = y + (mo <= 2 ? 1 : 0)
  return `${pad4(year)}-${pad2(mo)}-${pad2(d)}` as LocalDate
}

function pad2(n: number): string { return n < 10 ? `0${n}` : String(n) }
function pad4(n: number): string { return String(n).padStart(4, '0') }

export function addDays(date: LocalDate, days: number): LocalDate {
  return fromDayNumber(toDayNumber(date) + days)
}

/** `a - b` in whole days. Positive when `a` is later. */
export function diffDays(a: LocalDate, b: LocalDate): number {
  return toDayNumber(a) - toDayNumber(b)
}

export function compareDates(a: LocalDate, b: LocalDate): number {
  // 'YYYY-MM-DD' is lexicographically ordered, so string compare is correct
  // and cheaper than converting both to day numbers.
  return a < b ? -1 : a > b ? 1 : 0
}

export function minDate(a: LocalDate, b: LocalDate): LocalDate { return a <= b ? a : b }
export function maxDate(a: LocalDate, b: LocalDate): LocalDate { return a >= b ? a : b }

/**
 * Day of week, 0 = Monday .. 6 = Sunday.
 *
 * Monday-based because the training week is Monday-anchored: the weekly probe
 * runs Monday, and the weekly volume cap (invariant 2) compares Monday–Sunday
 * blocks. Day number 0 (1970-01-01) was a Thursday, hence the +3.
 */
export function dayOfWeek(date: LocalDate): number {
  return (((toDayNumber(date) + 3) % 7) + 7) % 7
}

/** The Monday on or before `date`. The canonical week key. */
export function mondayOf(date: LocalDate): LocalDate {
  return addDays(date, -dayOfWeek(date))
}

/** The Sunday on or after `date`. */
export function sundayOf(date: LocalDate): LocalDate {
  return addDays(mondayOf(date), 6)
}

/** Whole weeks from `anchor`'s Monday to `date`'s Monday. Negative before it. */
export function weeksBetween(date: LocalDate, anchor: LocalDate): number {
  return diffDays(mondayOf(date), mondayOf(anchor)) / 7
}

/** Every date from `from` to `to`, inclusive. Empty when `to` precedes `from`. */
export function datesBetween(from: LocalDate, to: LocalDate): LocalDate[] {
  const out: LocalDate[] = []
  const last = toDayNumber(to)
  for (let n = toDayNumber(from); n <= last; n++) out.push(fromDayNumber(n))
  return out
}

/** True when `date` falls in the inclusive window [start, end]. */
export function withinWindow(date: LocalDate, start: LocalDate, end: LocalDate): boolean {
  return date >= start && date <= end
}

/**
 * The inclusive window of the `days` most recent days ending at `today`.
 * `trailingWindow(today, 7)` is today plus the six days before it.
 */
export function trailingWindow(today: LocalDate, days: number): { start: LocalDate; end: LocalDate } {
  return { start: addDays(today, -(days - 1)), end: today }
}
