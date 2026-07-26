// ============================================================
// THE LADDER — nine levels from a standing start to 30 minutes continuous.
//
// PROVENANCE. The build brief's original ladder was thirteen sessions long.
// The Stage 0 research pass identified it as GRONORUN's thirteen-WEEK RCT
// protocol with weeks relabelled as sessions: brief sessions 4-6 prescribe
// 7 x (2 min jog / 1.5 min walk), which is GRONORUN's week 2 exactly, down to
// the unusual 1.5-minute walk interval. Run at 5-7 sessions a week, that
// compressed a thirteen-week protocol into under a fortnight.
//
// The session structures were kept, because they came from a level-1 RCT and
// they are good. The time axis was rebuilt. See RESEARCH.md §A19.
//
// WHAT CHANGED, AND WHY:
//   - Levels, not sessions. Advancement is criterion-gated (2-3 clean
//     sessions at a level), never a calendar countdown. Every well-specified
//     clinical protocol works this way; the brief's ladder only moved forward.
//   - The two steepest jumps are smoothed. 8 -> 14 jog min (+75%) became
//     8 -> 10 (+25%); 18 -> 25 (+39%) became 15 -> 18 (+20%). Both originals
//     exceeded, inside a single step, the >30%-per-two-weeks progression
//     threshold that Nielsen 2014 (n=874 prospective) associates with injury.
//   - A 20-minute continuous bout is inserted before the 30-minute test.
//     Without it, the first 20-minute continuous run he ever performs happens
//     during the graded test itself.
//   - The starting dose is unchanged at 8 jog minutes. It is more conservative
//     than GRONORUN week 1 (10 min) and Oxford NHS week 1 (15 min), and low
//     starting volume is the one progression variable with randomized support
//     (Bertelsen 2018: 3 vs 6 km/week, per-protocol injury difference -31.2%).
//   - Level 8 trades total volume down for bout length up. That pattern is the
//     brief's own (its sessions 11-12 did the same) and it is good design.
//
// HONEST FRAMING, which the narrative layer must respect: a gradual ladder
// builds CAPACITY. It is not proven to prevent injury. Buist 2008 tested a
// 13-week graded programme against a standard 8-week one in 532 novice runners
// with this athlete's exact detraining criterion and found injury rates of
// 20.8% vs 20.3% (p=0.90). Nothing in this file may be described to the
// athlete as injury-proofing.
// ============================================================

import type { IntervalBlock } from '../engine/types.ts'

/** Every session opens and closes with a brisk walk. Not counted as load. */
export const WARMUP_WALK_MIN = 5
export const COOLDOWN_WALK_MIN = 5

export interface Level {
  /** 1-based. Also the ordering key — levels are climbed one at a time. */
  level: number
  /** The jogging portion. Warm-up and cool-down are added by buildStructure. */
  core: IntervalBlock[]
  /** Jogging minutes in the core. Denormalized for readability in tests. */
  jogMin: number
  /** Longest unbroken jog. The number the P1/P2 phase gates read. */
  longestBoutMin: number
  /** Short label for the UI. */
  label: string
}

/**
 * The ladder.
 *
 * Read the `longestBoutMin` column downward — 1, 2, 3, 5, 6, 11, 16, 20, 30 —
 * and note there is no jump larger than roughly +80% and none at all above
 * level 6. That column, not the jog-minute column, is what the athlete
 * actually has to tolerate in one unbroken piece.
 */
export const LADDER: readonly Level[] = [
  {
    level: 1,
    label: '1 min jog / 2 min walk',
    core: [{ kind: 'repeat', times: 8, blocks: [{ kind: 'jog', minutes: 1 }, { kind: 'walk', minutes: 2 }] }],
    jogMin: 8,
    longestBoutMin: 1,
  },
  {
    level: 2,
    label: '2 min jog / 1.5 min walk',
    core: [{ kind: 'repeat', times: 5, blocks: [{ kind: 'jog', minutes: 2 }, { kind: 'walk', minutes: 1.5 }] }],
    jogMin: 10,
    longestBoutMin: 2,
  },
  {
    level: 3,
    label: '3 min jog / 1.5 min walk',
    core: [{ kind: 'repeat', times: 4, blocks: [{ kind: 'jog', minutes: 3 }, { kind: 'walk', minutes: 1.5 }] }],
    jogMin: 12,
    longestBoutMin: 3,
  },
  {
    level: 4,
    label: '5 min jog / 2 min walk',
    core: [{ kind: 'repeat', times: 3, blocks: [{ kind: 'jog', minutes: 5 }, { kind: 'walk', minutes: 2 }] }],
    jogMin: 15,
    longestBoutMin: 5,
  },
  {
    level: 5,
    label: '6 min jog / 2 min walk',
    core: [{ kind: 'repeat', times: 3, blocks: [{ kind: 'jog', minutes: 6 }, { kind: 'walk', minutes: 2 }] }],
    jogMin: 18,
    longestBoutMin: 6,
  },
  {
    level: 6,
    label: '11 min jog / 2 min walk',
    core: [{ kind: 'repeat', times: 2, blocks: [{ kind: 'jog', minutes: 11 }, { kind: 'walk', minutes: 2 }] }],
    jogMin: 22,
    longestBoutMin: 11,
  },
  {
    level: 7,
    label: '16 min jog, then 10 min jog',
    core: [
      { kind: 'jog', minutes: 16 },
      { kind: 'walk', minutes: 2 },
      { kind: 'jog', minutes: 10 },
    ],
    jogMin: 26,
    longestBoutMin: 16,
  },
  {
    level: 8,
    // Total jog minutes fall against level 7's ladder trajectory while the
    // unbroken bout grows. Bout length is the thing being trained here.
    label: '20 min jog, then 8 min jog',
    core: [
      { kind: 'jog', minutes: 20 },
      { kind: 'walk', minutes: 2 },
      { kind: 'jog', minutes: 8 },
    ],
    jogMin: 28,
    longestBoutMin: 20,
  },
  {
    level: 9,
    label: '30 min continuous',
    core: [{ kind: 'jog', minutes: 30 }],
    jogMin: 30,
    longestBoutMin: 30,
  },
] as const

export const FIRST_LEVEL = 1
export const TOP_LEVEL = LADDER.length

export function levelAt(level: number): Level {
  const clamped = Math.max(FIRST_LEVEL, Math.min(TOP_LEVEL, Math.round(level)))
  return LADDER[clamped - 1]!
}

/** Wrap a level's core in its walking warm-up and cool-down. */
export function buildStructure(level: Level): IntervalBlock[] {
  return [
    { kind: 'walk', minutes: WARMUP_WALK_MIN },
    ...level.core,
    { kind: 'walk', minutes: COOLDOWN_WALK_MIN },
  ]
}

/**
 * The gate before level 1: pain-free brisk walking for 30 continuous minutes
 * with a normal, non-limping gait.
 *
 * The most consistent prerequisite in the entire return-to-run literature —
 * Ohio State, CU Sports Medicine and Oxford NHS all require it independently.
 * The build brief had no entry gate at all; it began jogging with no check.
 */
export const ENTRY_GATE_WALK_MIN = 30
