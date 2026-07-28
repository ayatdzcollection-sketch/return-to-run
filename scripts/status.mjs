#!/usr/bin/env node
// Roster and exception-only status digest, read straight from the mirror.
//
// The app is exception-only for the athlete: it does not nag him, it waits to
// be told something went wrong. This is the same contract pointed the other
// way. It stays quiet on a clean week and says exactly what needs a human when
// something does.
//
// PER ACCESS CODE. An earlier version filtered by code only when one was
// passed as an argument, and the scheduled job passes none, so it pulled every
// event from every athlete and computed ONE merged summary. With one real user
// that was harmless noise. With two it would have averaged them together and
// reported a pain flag with no indication of whose it was.
//
// Deliberately dependency-free and engine-free. It runs on a schedule when
// nobody is watching, so it must not be able to break because a type moved.
// Every signal below is readable from raw events.
//
//   node scripts/status.mjs            list every code and check them all
//   node scripts/status.mjs <code>     check one

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

function env() {
  try {
    const raw = readFileSync(join(ROOT, '.env.local'), 'utf8')
    const get = (k) => raw.match(new RegExp(`^${k}=(.*)$`, 'm'))?.[1]?.trim()
    return { url: get('VITE_SUPABASE_URL'), key: get('VITE_SUPABASE_ANON_KEY') }
  } catch {
    return { url: process.env.VITE_SUPABASE_URL, key: process.env.VITE_SUPABASE_ANON_KEY }
  }
}

const TARGET_DATE = '2026-08-10'
const HORIZON_DATE = '2026-10-31'
const SILENCE_DAYS = 7
const DORMANT_DAYS = 21
const BONY = new Set(['shin', 'top_of_foot', 'heel', 'ankle_bone', 'kneecap', 'hip_bone'])

const todayISO = () => new Date().toISOString().slice(0, 10)
const daysBetween = (a, b) => Math.round((Date.parse(a) - Date.parse(b)) / 86_400_000)
const plural = (n, one, many = one + 's') => `${n} ${n === 1 ? one : many}`

/** Everything worth knowing about one athlete, from their events alone. */
function summarise(code, events, today) {
  const dates = events.map((e) => e.date).sort()
  const first = dates[0]
  const opens = events.filter((e) => e.type === 'app_open').map((e) => e.date).sort()
  const lastOpen = opens.at(-1) ?? null
  const lastAny = dates.at(-1) ?? null

  const completed = events.filter((e) => e.type === 'session_completed').length
  const cutShort = events.filter((e) => e.type === 'session_cut_short').length
  const missed = events.filter((e) => e.type === 'session_missed').length
  const calibrated = events.some((e) => e.type === 'talk_test_result')
  const weeks = Math.max(1, Math.ceil((daysBetween(today, first) + 1) / 7))

  // Longest session the engine ever actually issued, as a progress proxy. The
  // frozen prescription carries its own minutes, which is why a completion
  // event needs to carry none.
  const issued = events.filter((e) => e.type === 'prescription_issued')
  const longest = issued.reduce((m, e) => Math.max(m, e.payload?.prescription?.plannedJogMin ?? 0), 0)
  const reachedGoal = issued.filter((e) => (e.payload?.prescription?.plannedJogMin ?? 0) >= 30)

  const flags = []

  const silentFor = lastOpen ? daysBetween(today, lastOpen) : null
  const dormant = silentFor !== null && silentFor >= DORMANT_DAYS
  if (silentFor !== null && silentFor >= SILENCE_DAYS && !dormant) {
    flags.push(`SILENT ${silentFor} days, last opened ${lastOpen}. Load has decayed and a phase has dropped; he gets a re-entry session, not where he left off.`)
  }

  for (const p of events.filter((e) => e.type === 'pain_reported' && daysBetween(today, e.date) <= 21)) {
    const loc = p.payload?.location ?? 'unknown'
    flags.push(
      `${BONY.has(loc) ? 'BONE-SITE PAIN' : 'PAIN'} at ${loc} on ${p.date}` +
      (BONY.has(loc)
        ? '. Running is blocked until pain-free walking and a pain-free hop test on three consecutive days. Not clear within a week means a clinician, not the app.'
        : '.'),
    )
  }

  if (reachedGoal.length > 0 && daysBetween(today, reachedGoal[0].date) >= 56) {
    flags.push(`NEEDS A NEW BLOCK. Reached 30 minutes continuous ${Math.floor(daysBetween(today, reachedGoal[0].date) / 7)} weeks ago; the plan has been repeating itself since.`)
  }
  if (today > HORIZON_DATE) {
    flags.push('NEEDS A NEW BLOCK. This plan was scoped to the season and the season is over.')
  }

  return {
    code, first, lastOpen, lastAny, weeks, completed, cutShort, missed,
    calibrated, longest, dormant, flags,
    // A code with no calibration and no sessions is almost certainly a typo or
    // a test run, not a person. Worth listing, not worth alarming about.
    inert: !calibrated && completed === 0,
  }
}

async function main() {
  const { url, key } = env()
  if (!url || !key) {
    console.log('STATUS: cannot check. Supabase credentials not found.')
    process.exit(0)
  }
  const only = process.argv[2] ?? null
  const today = todayISO()

  const query = new URL(`${url}/rest/v1/rtr_event`)
  query.searchParams.set('select', 'access_code,type,date,payload')
  query.searchParams.set('order', 'date.asc')
  query.searchParams.set('limit', '10000')
  if (only) query.searchParams.set('access_code', `eq.${only}`)

  const res = await fetch(query, { headers: { apikey: key, Authorization: `Bearer ${key}` } })
  if (!res.ok) {
    console.log(`STATUS: cannot check. Mirror returned HTTP ${res.status}.`)
    process.exit(0)
  }

  const events = await res.json()
  if (events.length === 0) {
    console.log(only ? `STATUS: no events for "${only}".` : 'STATUS: no events yet. Nobody has started, or nothing has synced.')
    process.exit(0)
  }

  const byCode = new Map()
  for (const e of events) {
    if (!byCode.has(e.access_code)) byCode.set(e.access_code, [])
    byCode.get(e.access_code).push(e)
  }

  const people = [...byCode.entries()]
    .map(([code, evs]) => summarise(code, evs, today))
    .sort((a, b) => (b.lastAny ?? '').localeCompare(a.lastAny ?? ''))

  const lines = []

  // ── The roster ────────────────────────────────────────────
  lines.push(`ROSTER: ${plural(people.length, 'access code')} in the mirror`)
  const w = Math.max(...people.map((p) => p.code.length), 4)
  for (const p of people) {
    const state = p.inert ? 'no sessions logged'
      : p.dormant ? `dormant, last active ${p.lastAny}`
        : `week ${p.weeks}, ${plural(p.completed, 'session')} done, longest ${p.longest} min`
    lines.push(`  ${p.code.padEnd(w)}  since ${p.first}  ${state}`)
  }

  // ── Per athlete, exception-only ───────────────────────────
  const active = people.filter((p) => !p.inert && !p.dormant)
  const flagged = people.filter((p) => p.flags.length > 0 && !p.inert && !p.dormant)

  lines.push('')
  if (active.length === 0) {
    lines.push('No active athletes. Nothing needs you.')
  } else if (flagged.length === 0) {
    for (const p of active) {
      lines.push(`${p.code}: nothing needs you. (week ${p.weeks}, ${plural(p.completed, 'session')} done, ${p.cutShort} cut short, ${p.missed} missed, last opened ${p.lastOpen}.)`)
    }
  } else {
    for (const p of active) {
      if (p.flags.length === 0) {
        lines.push(`${p.code}: nothing needs you. (week ${p.weeks}, ${plural(p.completed, 'session')} done.)`)
        continue
      }
      lines.push(`${p.code}: ${plural(p.flags.length, 'thing')} ${p.flags.length === 1 ? 'needs' : 'need'} you. (week ${p.weeks}, ${plural(p.completed, 'session')} done.)`)
      for (const f of p.flags) lines.push(`  - ${f}`)
    }
  }

  if (today < TARGET_DATE) {
    lines.push('')
    lines.push(`(tryout ${TARGET_DATE}, ${daysBetween(TARGET_DATE, today)} days away)`)
  }

  const report = lines.join('\n')
  console.log(report)

  if (process.env.GITHUB_STEP_SUMMARY) {
    const { appendFileSync } = await import('node:fs')
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, '```\n' + report + '\n```\n')
  }

  // A non-zero exit is the notification channel: GitHub emails on a failed
  // scheduled workflow and stays quiet on a passing one. Dormant and inert
  // codes never trigger it, so abandoned test codes cannot train you to ignore
  // the mail.
  if (flagged.length > 0) process.exit(1)
}

main().catch((err) => {
  console.log(`STATUS: check failed. ${err.message}`)
  process.exit(0)
})
