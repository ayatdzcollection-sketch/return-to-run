// ============================================================
// MIRROR SYNC: offline-first, at-least-once, no conflict resolution.
//
// There is no merge algorithm here, and that is not an omission. The event log
// is a grow-only set and the fold sorts before it reduces, so the state derived
// from two devices' logs is the state derived from their union, whatever order
// things arrive in. Sync therefore reduces to: push what the server lacks, pull
// what we lack, and let duplicate ids collide harmlessly on the primary key.
//
// The earlier engine needed a real state-merge routine because it stored a
// mutable snapshot. Event sourcing deletes that entire class of problem, which
// is most of why it was worth the change.
// ============================================================

import type { AppEvent } from '../engine/types.ts'
import type { LocalDate } from '../engine/dates.ts'
import { appendEvents, countEvents } from './storage.ts'
import { getMeta, putMeta } from './idb.ts'
import { getAccessCode, supabase } from './supabase.ts'

const TABLE = 'rtr_event'
const META_PUSH = 'pushQueue'
const META_PULL = 'pullCursor'

interface EventRow {
  id: string
  access_code: string
  type: string
  date: string
  at: string
  schema: number
  payload: Record<string, unknown>
  server_seq?: number
}

function toRow(e: AppEvent, accessCode: string): EventRow {
  const { id, at, date, schema, type, ...payload } = e
  return { id, access_code: accessCode, type, date, at, schema, payload }
}

function fromRow(r: EventRow): AppEvent {
  return { id: r.id, at: r.at, date: r.date as LocalDate, schema: r.schema, type: r.type, ...r.payload } as AppEvent
}

// ── Push queue ──────────────────────────────────────────────
// Ids that have not been acknowledged by the server yet. Persisted, so a run
// logged on a plane is still mirrored days later when the app next has signal.

async function readQueue(): Promise<string[]> {
  return (await getMeta<string[]>(META_PUSH)) ?? []
}

export async function enqueueForPush(ids: readonly string[]): Promise<void> {
  const queue = new Set(await readQueue())
  for (const id of ids) queue.add(id)
  await putMeta(META_PUSH, [...queue])
}

export type SyncState =
  | { kind: 'local_only' }                       // no mirror configured
  | { kind: 'no_code' }                          // mirror configured, code not set
  | { kind: 'pending'; count: number }
  | { kind: 'synced' }
  | { kind: 'error'; message: string }

/**
 * Push every queued event, then pull anything new.
 *
 * Insert-or-ignore on the way out (`ignoreDuplicates`), ConstraintError-tolerant
 * append on the way in. Both directions are therefore safe to retry, which is
 * what makes it correct to run this on every app open, every visibility change,
 * and every reconnect without tracking whether it is already running.
 */
export async function sync(all: readonly AppEvent[]): Promise<SyncState> {
  if (!supabase) return { kind: 'local_only' }
  const accessCode = getAccessCode()
  if (!accessCode) return { kind: 'no_code' }

  try {
    const queue = await readQueue()
    if (queue.length > 0) {
      const byId = new Map(all.map((e) => [e.id, e]))
      const rows = queue.map((id) => byId.get(id)).filter((e): e is AppEvent => !!e).map((e) => toRow(e, accessCode))
      if (rows.length > 0) {
        const { error } = await supabase.from(TABLE).upsert(rows, { onConflict: 'id', ignoreDuplicates: true })
        if (error) return { kind: 'error', message: error.message }
      }
      await putMeta(META_PUSH, [])
    }

    const cursor = (await getMeta<number>(META_PULL)) ?? 0
    const { data, error } = await supabase
      .from(TABLE)
      .select('*')
      .eq('access_code', accessCode)
      .gt('server_seq', cursor)
      .order('server_seq', { ascending: true })
      .limit(2000)
    if (error) return { kind: 'error', message: error.message }

    const rows = (data ?? []) as EventRow[]
    if (rows.length > 0) {
      await appendEvents(rows.map(fromRow))
      const maxSeq = rows.reduce((m, r) => Math.max(m, r.server_seq ?? 0), cursor)
      await putMeta(META_PULL, maxSeq)
    }
    return { kind: 'synced' }
  } catch (err) {
    return { kind: 'error', message: err instanceof Error ? err.message : String(err) }
  }
}

export async function pendingCount(): Promise<number> {
  return (await readQueue()).length
}

/**
 * Compare local and remote event counts.
 *
 * This is the answer to iOS evicting the app's storage: if the phone's log is
 * short, the mirror still has the history, and a full re-pull rebuilds state
 * exactly, because the log IS the state. Surfaced in the UI rather than fixed
 * silently, since a mismatch is worth knowing about.
 */
export async function durabilityCheck(): Promise<{ local: number; remote: number | null }> {
  const local = await countEvents()
  const accessCode = getAccessCode()
  if (!supabase || !accessCode) return { local, remote: null }
  const { count, error } = await supabase
    .from(TABLE)
    .select('id', { count: 'exact', head: true })
    .eq('access_code', accessCode)
  return { local, remote: error ? null : (count ?? null) }
}

/** Re-pull the entire mirror from scratch. Recovery path after eviction. */
export async function fullRepull(): Promise<number> {
  await putMeta(META_PULL, 0)
  const state = await sync([])
  return state.kind === 'synced' ? countEvents() : 0
}
