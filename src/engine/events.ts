// ============================================================
// EVENT UTILITIES: ordering, deduplication, and structure arithmetic.
//
// The fold sorts before it reduces, so the same set of events produces the
// same state no matter what order they arrived in. That is what lets two
// devices sync by plain set union with no conflict resolution: a grow-only
// set plus an order-independent fold is convergent by construction.
// ============================================================

import type { AppEvent, IntervalBlock, SimpleBlock } from './types.ts'

/**
 * Canonical order: by the day the event is about, then by device timestamp,
 * then by id.
 *
 * The id tiebreak matters. Two devices can stamp the same `at` (or a clock can
 * be wrong), and without a total order the fold would be non-deterministic in
 * exactly the situation where determinism is hardest to debug. ULIDs are
 * unique, so this order is total.
 */
export function sortEvents(events: readonly AppEvent[]): AppEvent[] {
  return [...events].sort(
    (a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0)
      || (a.at < b.at ? -1 : a.at > b.at ? 1 : 0)
      || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
}

/** Drop exact duplicates by id. Sync is at-least-once, so this is routine. */
export function dedupeById(events: readonly AppEvent[]): AppEvent[] {
  const seen = new Set<string>()
  const out: AppEvent[] = []
  for (const e of events) {
    if (seen.has(e.id)) continue
    seen.add(e.id)
    out.push(e)
  }
  return out
}

/** Sort + dedupe in one pass. What the fold actually calls. */
export function normalizeEvents(events: readonly AppEvent[]): AppEvent[] {
  return sortEvents(dedupeById(events))
}

// ── Structure arithmetic ────────────────────────────────────
// One rule governs all of it: jogging minutes are load, walking minutes are
// not (invariant 1). Strides are running, so they count.

/** Expand `repeat` blocks into a flat sequence. */
export function flattenBlocks(blocks: readonly IntervalBlock[]): SimpleBlock[] {
  const out: SimpleBlock[] = []
  for (const b of blocks) {
    if (b.kind === 'repeat') {
      for (let i = 0; i < b.times; i++) out.push(...b.blocks)
    } else {
      out.push(b)
    }
  }
  return out
}

function blockJogMinutes(b: SimpleBlock): number {
  switch (b.kind) {
    case 'jog': return b.minutes
    case 'strides': return (b.count * b.seconds) / 60
    case 'walk': return 0
  }
}

function blockTotalMinutes(b: SimpleBlock): number {
  return b.kind === 'walk' ? b.minutes : blockJogMinutes(b)
}

/** Running minutes. THE load number, this is what every cap is applied to. */
export function jogMinutes(blocks: readonly IntervalBlock[]): number {
  return round1(flattenBlocks(blocks).reduce((n, b) => n + blockJogMinutes(b), 0))
}

/** Wall-clock cost of the session, walking included. Display only. */
export function totalMinutes(blocks: readonly IntervalBlock[]): number {
  return round1(flattenBlocks(blocks).reduce((n, b) => n + blockTotalMinutes(b), 0))
}

/**
 * Longest unbroken run of jogging minutes.
 *
 * This is the number the phase gates care about: P1 -> P2 needs 15 minutes
 * continuous, P2 -> P3 needs 30. Adjacent jog blocks with no walk between them
 * merge, so a structure is measured by what it actually asks of him rather
 * than by how it happens to be written.
 */
export function longestContinuousJogMin(blocks: readonly IntervalBlock[]): number {
  let best = 0
  let run = 0
  for (const b of flattenBlocks(blocks)) {
    if (b.kind === 'walk') {
      run = 0
    } else {
      run += blockJogMinutes(b)
      if (run > best) best = run
    }
  }
  return round1(best)
}

/** True when the session is one unbroken jog with no walk breaks inside it. */
export function isContinuous(blocks: readonly IntervalBlock[]): boolean {
  const jog = jogMinutes(blocks)
  return jog > 0 && longestContinuousJogMin(blocks) === jog
}

/** One decimal place. Interval math produces thirds of a minute via strides. */
export function round1(n: number): number {
  return Math.round(n * 10) / 10
}
