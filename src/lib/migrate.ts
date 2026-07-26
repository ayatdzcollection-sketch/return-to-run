// ============================================================
// SCHEMA MIGRATION — on read, never in place.
//
// Rewriting stored events to a new shape would violate the append-only rule
// that the whole model rests on, so migration happens when an event is loaded.
// Each event carries its own `schema` number and is upgraded in memory on the
// way to the fold; the row on disk is left exactly as it was written.
//
// The contract, inherited from the earlier engine and worth restating: additive
// and idempotent. Fill in fields that did not exist when the event was written;
// clamp values that are out of range; never discard an event because it looks
// wrong. A corrupt event that is dropped is training history that silently
// disappears, and the athlete's caps are computed from that history.
// ============================================================

import type { AppEvent } from '../engine/types.ts'

/** Bump when an event payload gains a field that the fold needs. */
export const LOCAL_SCHEMA_VERSION = 1

/**
 * Bring one stored event up to the current schema.
 *
 * Version 1 is the initial shape, so there is nothing to upgrade yet — the
 * function exists so that the call site is already correct when there is.
 */
export function migrateEvent(event: AppEvent): AppEvent {
  let e = event
  if ((e.schema ?? 0) < 1) e = { ...e, schema: 1 }
  // Future upgrades chain here, each guarded by the version it raises from.
  return e
}
