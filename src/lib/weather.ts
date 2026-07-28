// ============================================================
// WBGT for outdoor sessions.
//
// The heat rules were built, tested, and then never fired, because nothing
// supplied a temperature. This is that missing input.
//
// Open-Meteo needs no API key and no account, which is the whole reason it is
// used here: a key would mean a secret, a secret would mean a backend, and a
// backend would mean the app stops working in a basement with no signal.
// Failure is silent and returns null, and null means the heat rules simply do
// not apply rather than the app breaking.
//
// HONEST LIMIT: this is the Australian Bureau of Meteorology's SHADE
// approximation to WBGT. It uses temperature and humidity only, so it reads
// low in direct sun, which is exactly where he will be running. That is part
// of why the engine adds its own safety margin on top before comparing against
// any threshold (RESEARCH.md A25), and why the thresholds themselves are the
// conservative northern-US column.
// ============================================================

import { PLAN } from '../config/tunables.ts'
import type { LocalDate } from '../engine/dates.ts'

const CACHE_KEY = 'rtr_wbgt_cache'

interface Cached { date: string; wbgtC: number | null; at: number }

/**
 * Approximate WBGT for the athlete's location at practice time.
 *
 * Cached per day: the number moves slowly, the app opens often, and a run in a
 * basement should not depend on a network call succeeding.
 */
export async function wbgtFor(date: LocalDate): Promise<number | null> {
  const cached = readCache()
  if (cached && cached.date === date) return cached.wbgtC

  try {
    const url = new URL('https://api.open-meteo.com/v1/forecast')
    url.searchParams.set('latitude', String(PLAN.LATITUDE))
    url.searchParams.set('longitude', String(PLAN.LONGITUDE))
    url.searchParams.set('hourly', 'temperature_2m,relative_humidity_2m')
    url.searchParams.set('start_date', date)
    url.searchParams.set('end_date', date)
    url.searchParams.set('timezone', 'auto')

    const res = await fetch(url, { signal: AbortSignal.timeout(6000) })
    if (!res.ok) return cacheAndReturn(date, null)

    const data = await res.json() as {
      hourly?: { time?: string[]; temperature_2m?: number[]; relative_humidity_2m?: number[] }
    }
    const times = data.hourly?.time ?? []
    const temps = data.hourly?.temperature_2m ?? []
    const humid = data.hourly?.relative_humidity_2m ?? []

    // Practice time, not the daily mean. An afternoon in August and the same
    // day at 7am are two different environments, and the research found the
    // gap between them is about two full activity-modification bands.
    const idx = times.findIndex((t) => t.endsWith(`T${String(PLAN.PRACTICE_HOUR).padStart(2, '0')}:00`))
    if (idx < 0 || temps[idx] === undefined || humid[idx] === undefined) return cacheAndReturn(date, null)

    return cacheAndReturn(date, approximateWbgt(temps[idx]!, humid[idx]!))
  } catch {
    // Offline, blocked, or slow. The heat rules just do not apply today.
    return null
  }
}

/**
 * Bureau of Meteorology shade approximation.
 *
 * WBGT = 0.567 Ta + 0.393 e + 3.94, with e the water vapour pressure in hPa.
 * Reads low in direct sun; see the header.
 */
export function approximateWbgt(tempC: number, relHumidityPct: number): number {
  const e = (relHumidityPct / 100) * 6.105 * Math.exp((17.27 * tempC) / (237.7 + tempC))
  return Math.round((0.567 * tempC + 0.393 * e + 3.94) * 10) / 10
}

function readCache(): Cached | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    return raw ? JSON.parse(raw) as Cached : null
  } catch { return null }
}

function cacheAndReturn(date: string, wbgtC: number | null): number | null {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify({ date, wbgtC, at: Date.now() } satisfies Cached)) } catch { /* full or private mode */ }
  return wbgtC
}
