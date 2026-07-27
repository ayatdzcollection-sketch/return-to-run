#!/usr/bin/env node
// Exception-only status digest, read straight from the mirror.
//
// The app is exception-only for the athlete: it does not nag him, it waits to
// be told something went wrong. This is the same contract pointed the other
// way. It prints NOTHING worth reading on a normal week, and says exactly what
// needs a human when something does.
//
// Deliberately dependency-free and engine-free. It runs on a schedule when
// nobody is watching, so it should not be able to break because a type moved.
// The signals below are all readable from raw events.
//
//   node scripts/status.mjs [accessCode]

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
const SILENCE_DAYS = 7
const BONY = new Set(['shin', 'top_of_foot', 'heel', 'ankle_bone', 'kneecap', 'hip_bone'])

const todayISO = () => new Date().toISOString().slice(0, 10)
const daysBetween = (a, b) => Math.round((Date.parse(a) - Date.parse(b)) / 86_400_000)

async function main() {
  const { url, key } = env()
  if (!url || !key) {
    console.log('STATUS: cannot check. Supabase credentials not found.')
    process.exit(0)
  }
  const code = process.argv[2] ?? null

  const query = new URL(`${url}/rest/v1/rtr_event`)
  query.searchParams.set('select', 'id,type,date,payload')
  query.searchParams.set('order', 'date.asc')
  query.searchParams.set('limit', '5000')
  if (code) query.searchParams.set('access_code', `eq.${code}`)

  const res = await fetch(query, { headers: { apikey: key, Authorization: `Bearer ${key}` } })
  if (!res.ok) {
    console.log(`STATUS: cannot check. Mirror returned HTTP ${res.status}.`)
    process.exit(0)
  }
  const events = await res.json()
  const today = todayISO()
  const flags = []

  if (events.length === 0) {
    console.log('STATUS: no events yet. He has not started, or has not synced.')
    process.exit(0)
  }

  // ── Has he stopped engaging? ──────────────────────────────
  // The app assumes a session was completed unless told otherwise, and that
  // assumption is only valid while he is opening it.
  const opens = events.filter((e) => e.type === 'app_open').map((e) => e.date)
  const lastOpen = opens.at(-1) ?? null
  const silentFor = lastOpen ? daysBetween(today, lastOpen) : null
  if (silentFor !== null && silentFor >= SILENCE_DAYS) {
    flags.push(`SILENT ${silentFor} days. Last opened ${lastOpen}. The app has decayed his load and dropped a phase; he will get a re-entry session, not where he left off.`)
  }

  // ── Anything hurting? ─────────────────────────────────────
  const pains = events.filter((e) => e.type === 'pain_reported' && daysBetween(today, e.date) <= 21)
  for (const p of pains) {
    const loc = p.payload?.location ?? 'unknown'
    const bony = BONY.has(loc)
    flags.push(
      `${bony ? 'BONE-SITE PAIN' : 'PAIN'} at ${loc} on ${p.date}` +
      (bony ? '. Running is blocked until pain-free walking and a pain-free hop test on three consecutive days. If it is not clear within a week, that needs a clinician, not the app.' : '.'),
    )
  }

  // ── Where is he in the plan? ──────────────────────────────
  const completed = events.filter((e) => e.type === 'session_completed').length
  const cutShort = events.filter((e) => e.type === 'session_cut_short').length
  const missed = events.filter((e) => e.type === 'session_missed').length
  const first = events[0].date
  const weeks = Math.max(1, Math.ceil((daysBetween(today, first) + 1) / 7))

  // ── Has the plan run out of road? ─────────────────────────
  const issued = events.filter((e) => e.type === 'prescription_issued')
  const topSessions = issued.filter((e) => (e.payload?.prescription?.plannedJogMin ?? 0) >= 30)
  if (topSessions.length > 0) {
    const since = daysBetween(today, topSessions[0].date)
    if (since >= 56) {
      flags.push(`NEEDS A NEW BLOCK. He reached 30 minutes continuous ${Math.floor(since / 7)} weeks ago and the plan has been repeating itself since. Time to write what comes next.`)
    }
  }
  if (today > '2026-10-31') {
    flags.push('NEEDS A NEW BLOCK. This plan was scoped to the season and the season is over.')
  }

  // ── Report ────────────────────────────────────────────────
  const summary = `week ${weeks}, ${completed} sessions done, ${cutShort} cut short, ${missed} missed`
  if (flags.length === 0) {
    console.log(`STATUS: nothing needs you. (${summary}, last opened ${lastOpen}.)`)
  } else {
    console.log(`STATUS: ${flags.length} thing${flags.length > 1 ? 's need' : ' needs'} you. (${summary}.)`)
    for (const f of flags) console.log(`  - ${f}`)
  }
  if (today < TARGET_DATE) {
    console.log(`  (tryout ${TARGET_DATE}, ${daysBetween(TARGET_DATE, today)} days away)`)
  }
}

main().catch((err) => {
  console.log(`STATUS: check failed. ${err.message}`)
  process.exit(0)
})
