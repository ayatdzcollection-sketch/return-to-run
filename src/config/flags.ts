// ============================================================
// FEATURE FLAGS: compile-time constants only.
//
// There is deliberately NO runtime or storage-backed flag store. A mutable
// flag would be an attack surface on the safety gates, and the athlete this
// app is built for has every incentive to find one.
//
// Hard rule: no flag may raise a ceiling, extend a duration cap, unlock a
// session tier, weaken a pain interrupt, or shorten a rest interval. Flags
// gate things that are additive or display-only. Every safety gate in the
// engine is unconditional.
// ============================================================

export const FLAGS = {
  /**
   * LLM-written session rationales via a server-side proxy.
   *
   * OFF, and off by default for the foreseeable future. The narrative layer
   * renders fixed sentences keyed by rationale code, no API key, no network
   * dependency, works in a basement with no signal. If this is ever turned on
   * it becomes a Supabase Edge Function; a client-side key is never acceptable.
   */
  LLM_NARRATIVE: false,

  /**
   * CSV import of raw heart-rate samples.
   *
   * OFF until an export path from the watch is confirmed to exist. The CMF
   * Watch Pro 3 has no public API, so v1 heart-rate entry is manual: he types
   * the average the watch shows him. That caps hr_confidence at `low`, which
   * is a state the engine is designed to run in indefinitely.
   */
  HR_CSV_IMPORT: false,

  /**
   * Shadow mode for the heart-rate quality gates.
   *
   * ON. The cadence-lock detector's thresholds are engineering estimates
   * the research pass found the failure mode is unquantified in the
   * peer-reviewed literature, with no published prevalence, episode duration,
   * or triggering combinations. Worse, for this athlete bpm ~ cadence is the
   * EXPECTED state during an easy run (easy HR ~140-155, jogging cadence
   * ~150-170), so a detector tuned wrong would discard most valid data and
   * declare honest sessions unusable.
   *
   * While this is on, the gates compute and log but do not mark a session's
   * heart rate unusable. Turn it off once the observed discard distribution
   * from this athlete's own logs supports a threshold.
   */
  HR_GATES_SHADOW_MODE: true,

  /** Developer state inspector. Never ships on. */
  DEBUG_PANEL: false,
} as const
