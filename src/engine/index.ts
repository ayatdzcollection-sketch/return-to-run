// The engine's entire public surface. Everything else is internal and is
// imported directly by tests only.
//
// Pure by construction: no file under src/engine may reference `Date`, browser
// storage, or browser globals, or import from src/lib. That boundary is
// enforced by noBannedConcepts.static.test.ts, and it is what makes "same log
// + same today => same prescription" a fact rather than an intention.

export { computeState, isBlocked, type FoldResult } from './fold.ts'
export { prescribe, scaleStructure, type PrescribeOptions } from './prescribe.ts'
export { evaluateHrSamples, evaluateDrift, breachedCeiling, type RawHrSample, type HrSummaryDraft, type DriftVerdict } from './hr.ts'
export { calibrate, easyHrCeiling, assignToleranceClass, type CalibrationResult } from './calibration.ts'
export { footwearLimit, surfaceLimit, heatLimit, computeProbe, type HeatLevel, type ProbeState } from './modifiers.ts'
export { classifyPain, computeInterrupt, computeSilence, type InterruptKind, type InterruptState } from './interrupts.ts'
export { computeWindows, applyLoadCaps, type LoadWindows, type CapResult } from './load.ts'
export { buildTimeline, type Timeline, type DayRecord } from './timeline.ts'
export { computeLadder, computePhase, maxTier, bestContinuous } from './phases.ts'
export {
  jogMinutes, totalMinutes, longestContinuousJogMin, isContinuous,
  normalizeEvents, sortEvents, flattenBlocks, round1,
} from './events.ts'
export {
  asLocalDate, tryLocalDate, addDays, diffDays, dayOfWeek, mondayOf, sundayOf,
  datesBetween, trailingWindow, weeksBetween, type LocalDate,
} from './dates.ts'
export * from './types.ts'
