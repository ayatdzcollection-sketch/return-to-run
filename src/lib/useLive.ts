// ============================================================
// KEEPING THE SCREEN TRUE while the app sits open.
//
// An installed PWA is not a page you reload. It stays in memory for days: he
// opens it at the treadmill, backgrounds it, and opens it again tomorrow
// without the app ever remounting. Two things silently rot in that window.
//
//   1. `today`. Captured once at mount, it goes stale at midnight and the app
//      then shows yesterday's session forever, with yesterday's rest day and
//      yesterday's rationale. This is the most damaging of the two, because
//      nothing about the screen looks wrong.
//   2. The event log. Anything logged on another device, or pulled from the
//      mirror, never appears until a manual reload.
//
// The service worker already handles the SHELL updating. These hooks handle
// the app's own state, which is the half that was missing.
// ============================================================

import { useEffect, useState } from 'react'
import { todayLocal } from './clock.ts'
import type { LocalDate } from '../engine/dates.ts'

/** Poll interval. Cheap: a string compare, and it only re-renders on a change. */
const TICK_MS = 60_000

/**
 * Today, kept current across midnight, backgrounding and sleep.
 *
 * Returns the same string identity until the date genuinely changes, so it
 * does not churn the memoised fold on every tick.
 */
export function useLiveDate(override: LocalDate | null): LocalDate {
  const [today, setToday] = useState<LocalDate>(() => override ?? todayLocal())

  useEffect(() => {
    if (override) return
    const tick = () => setToday((current) => {
      const now = todayLocal()
      return now === current ? current : now
    })
    // Interval catches midnight while the screen is on; visibility and focus
    // catch the far commoner case of the phone having been asleep.
    const id = window.setInterval(tick, TICK_MS)
    const onVisible = () => { if (document.visibilityState === 'visible') tick() }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', tick)
    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', tick)
    }
  }, [override])

  return today
}

/**
 * Run `refresh` whenever the app comes back to the foreground or reconnects.
 *
 * Deliberately not on an interval: re-reading the log costs an IndexedDB round
 * trip and a network call, and there is no reason to pay that while the phone
 * is in his pocket.
 */
export function useRefreshOnResume(refresh: () => void): void {
  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === 'visible') refresh() }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('online', refresh)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('online', refresh)
    }
  }, [refresh])
}
