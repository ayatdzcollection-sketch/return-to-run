// ============================================================
// THE ONLY FILE IN THE CODEBASE THAT READS A CLOCK.
//
// Every engine function takes `today` as a parameter. That is what makes the
// engine replayable: the same event log and the same date produce the same
// prescription on any device, in any timezone, at any hour. If the engine
// could call `new Date()` itself, none of the invariant tests would prove
// anything about what the athlete actually sees on a given morning.
//
// The purity check in noBannedConcepts.static.test.ts enforces that boundary
// by grepping src/engine for the identifier, so this file is the seam.
// ============================================================

import { asLocalDate, type LocalDate } from '../engine/dates.ts'

/**
 * Today, in the device's own timezone.
 *
 * Local, not UTC, deliberately. A run at 9pm on August 3rd in Michigan is
 * already August 4th in UTC, and assigning it to the wrong day would corrupt
 * the weekly volume cap and the rest-day rules. The athlete's calendar is the
 * one the engine reasons about.
 */
export function todayLocal(now: Date = new Date()): LocalDate {
  const y = now.getFullYear()
  const m = now.getMonth() + 1
  const d = now.getDate()
  return asLocalDate(`${y}-${pad(m)}-${pad(d)}`)
}

/** ISO timestamp with the device's offset, audit trail and sort tiebreak. */
export function nowIso(now: Date = new Date()): string {
  const offsetMin = -now.getTimezoneOffset()
  const sign = offsetMin >= 0 ? '+' : '-'
  const abs = Math.abs(offsetMin)
  const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
    + `T${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`
  return `${stamp}${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`
}

/** Milliseconds since the epoch. Sync cursors and debounce timers only. */
export function nowMs(): number {
  return Date.now()
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n)
}
