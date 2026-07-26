// ============================================================
// APP OPENS: load-bearing, not analytics.
//
// The reporting model assumes a prescribed session was completed unless told
// otherwise. That assumption is only valid while he is OPENING the app:
// opening it and not logging an exception is an implicit confirmation. Once
// the opens stop, the engine knows nothing, and "nothing" must not be read as
// "as prescribed". That path quietly hands a detrained kid week six of the
// plan. Hence this table, and hence the silence decay that reads it.
// ============================================================

import type { AppEvent, EventDraft } from '../engine/types.ts'
import { todayLocal, nowIso } from './clock.ts'
import { ulid } from './uid.ts'
import { appendEvents, getAllEvents } from './storage.ts'
import { enqueueForPush } from './sync.ts'

/**
 * Record an open for today, at most once per day.
 *
 * Once a day is enough: the decay rule asks "has he engaged at all in the last
 * seven days", not how many times. One row a day also keeps the log small
 * enough that a full refold stays sub-millisecond.
 */
export async function recordAppOpen(): Promise<boolean> {
  const today = todayLocal()
  const existing = await getAllEvents()
  if (existing.some((e) => e.type === 'app_open' && e.date === today)) return false

  const event: AppEvent = { id: ulid(), at: nowIso(), date: today, schema: 1, type: 'app_open' }
  await appendEvents([event])
  await enqueueForPush([event.id])
  return true
}

/** Append any event and queue it for the mirror. The single write path. */
export async function record(payload: EventDraft): Promise<AppEvent> {
  const event = { id: ulid(), at: nowIso(), schema: 1, ...payload } as AppEvent
  await appendEvents([event])
  await enqueueForPush([event.id])
  return event
}
