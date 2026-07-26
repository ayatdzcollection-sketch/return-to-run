// ============================================================
// THE EVENT LOG — append only.
//
// This module deliberately exports no way to update or delete an event. That
// is the local half of the append-only guarantee (the other half is a Postgres
// trigger on the mirror; see supabase/migration-001-event-log.sql). If a
// correction is ever needed, the answer is to append a correcting event, not
// to edit history — the fold's job is to reconcile them.
//
// storage.test.ts asserts the export surface, so adding a mutation function
// here fails the suite rather than quietly weakening the model.
// ============================================================

import type { AppEvent } from '../engine/types.ts'
import { normalizeEvents } from '../engine/events.ts'
import { migrateEvent, LOCAL_SCHEMA_VERSION } from './migrate.ts'
import { addIfAbsent, count, getAll, getMeta, putMeta, STORE_EVENTS, STORE_HR } from './idb.ts'

export interface RawHrSample {
  sessionDate: string
  ts: number
  bpm: number
  cadenceSpm: number | null
  qualityFlag?: string
}

/**
 * Append events. Already-present ids are skipped, not overwritten.
 *
 * Idempotent on purpose: this is the single entry point for both local taps
 * and events pulled down from the mirror, and the pull is at-least-once.
 * Returns how many were genuinely new.
 */
export async function appendEvents(events: readonly AppEvent[]): Promise<number> {
  let added = 0
  for (const e of events) {
    if (await addIfAbsent(STORE_EVENTS, e)) added++
  }
  return added
}

/** The whole log, normalized (sorted, deduplicated) and schema-migrated. */
export async function getAllEvents(): Promise<AppEvent[]> {
  const stored = await getAll<AppEvent>(STORE_EVENTS)
  return normalizeEvents(stored.map(migrateEvent))
}

export async function countEvents(): Promise<number> {
  return count(STORE_EVENTS)
}

/** Raw HR samples. Audit trail only — these never reach the fold. */
export async function appendHrSamples(samples: readonly RawHrSample[]): Promise<number> {
  let added = 0
  for (const s of samples) {
    if (await addIfAbsent(STORE_HR, s)) added++
  }
  return added
}

export async function getHrSamples(): Promise<RawHrSample[]> {
  return getAll<RawHrSample>(STORE_HR)
}

// ── Local schema stamp ──────────────────────────────────────
// Stored events are never rewritten, so migration happens on read (migrate.ts).
// This stamp only records which version last wrote, for diagnostics.

const META_SCHEMA = 'schemaVersion'

export async function readSchemaVersion(): Promise<number> {
  return (await getMeta<number>(META_SCHEMA)) ?? LOCAL_SCHEMA_VERSION
}

export async function stampSchemaVersion(): Promise<void> {
  await putMeta(META_SCHEMA, LOCAL_SCHEMA_VERSION)
}
