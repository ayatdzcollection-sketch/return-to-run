// ============================================================
// SAFETY TUNABLES — every adjustable threshold in the engine lives here.
// Change numbers in this file; never edit engine or UI code to retune.
//
// EVERY leaf value carries an entry in EVIDENCE below, giving its confidence
// level and its source. tunables.test.ts fails if a value exists without one,
// or an evidence entry without a value — so a number cannot be added to this
// engine without someone stating where it came from and how much to trust it.
//
// The four levels mean what RESEARCH.md says they mean:
//   strong   — systematic review / meta-analysis / RCT, reasonable transfer
//   moderate — good primary evidence, or strong evidence with a transfer gap
//   weak     — thin evidence, or a reasoned extension nobody has tested
//   lore     — widely repeated, no mechanism and no trial located
//
// `lore` values are KEPT where they are conservative and harmless. They are
// not deleted; they are labelled, so nobody later mistakes convention for
// evidence. Where the research pass found a rule to be actively wrong rather
// than merely unsupported — the ACWR clamp — it was removed, not downgraded.
// ============================================================

export type EvidenceLevel = 'strong' | 'moderate' | 'weak' | 'lore'

export const TUNABLES = {
  // ── Load guardrail ────────────────────────────────────────
  // The brief's ACWR clamp (0.8-1.3) is GONE. Not clamped, not uncoupled, not
  // EWMA'd, not kept as a display. Its source figure is under a retraction
  // request; the coupled form is spurious by construction; in the two
  // prospective running cohorts that tested it the association ran BACKWARDS;
  // the only RCT (in adolescents) returned RR 1.01; and at a 12-month-detrained
  // baseline it is arithmetically undefined. Worst of all, a LOWER bound of 0.8
  // would instruct a detrained 15-year-old to train MORE to satisfy a metric.
  // See RESEARCH.md §A6. What replaces it is a per-session cap.
  LOAD: {
    /** No session above this multiple of the longest session in the lookback. */
    SESSION_CAP_FACTOR: 1.10,
    /** Days of history the "longest session" is drawn from. */
    LONGEST_LOOKBACK_DAYS: 30,
    /** Floor: at an 8-minute baseline a pure 10% rule yields 48 seconds. */
    SESSION_CAP_MIN_INCREMENT_MIN: 1,
    /** Ceiling on the floor, so the rule cannot run away at higher volumes. */
    SESSION_CAP_MAX_INCREMENT_MIN: 3,
    /** The session cap does not compose across a week without this. */
    NEW_LONGEST_SESSIONS_PER_WEEK: 1,
    /** 30 min is the top of the tolerable bracket, not a waypoint to more. */
    TERMINAL_SESSION_CEILING_MIN: 30,
    /** Secondary weekly cap. Cheap insurance; never overrides the session cap. */
    WEEKLY_GROWTH_MAX: 1.20,
    WEEKLY_ABS_INCREASE_MAX_MIN: 10,
    /** Increments are halved inside the elevated-risk window. */
    HIGH_RISK_WEEK_FIRST: 3,
    HIGH_RISK_WEEK_LAST: 10,
    HIGH_RISK_INCREMENT_FACTOR: 0.5,
  },

  // ── Frequency and spacing ─────────────────────────────────
  // The brief assumed 5-7 running days a week were available and progressed
  // frequency first. No located protocol — studied or clinical — runs a novice
  // or returning runner more than 4 days a week, and the collagen mechanism
  // explains why. Frequency is effectively fixed at three; the dimensions that
  // actually progress are duration and continuity. See RESEARCH.md §A18.
  FREQUENCY: {
    RUN_DAYS_PER_WEEK: 3,
    /** Net collagen balance is negative for ~24-36 h after a loading bout. */
    MIN_HOURS_BETWEEN_RUNS: 48,
    /** A fourth day may unlock this late, and only after clean sessions. */
    FOURTH_DAY_UNLOCK_WEEK: 5,
    MAX_RUN_DAYS_PER_WEEK: 4,
  },

  // ── Ladder progression ────────────────────────────────────
  LADDER: {
    /** Sessions at a level before advancing, when everything is clean. */
    SESSIONS_PER_LEVEL_DEFAULT: 3,
    /** Compressed path, earned by completing every session at a level clean. */
    SESSIONS_PER_LEVEL_MIN: 2,
    /** Two consecutive failures at a level steps back one level. */
    FAILURES_BEFORE_REGRESSION: 2,
  },

  // ── Down week ─────────────────────────────────────────────
  DOWN_WEEK: {
    EVERY_N_WEEKS: 4,
    CUT: 0.30,
  },

  // ── Talk test and speed ceiling ───────────────────────────
  // The brief subtracted 0.4 mph. That is SMALLER than the talk test's own
  // minimal detectable change (~0.9-1.0 mph equivalent) — a margin inside the
  // instrument's noise floor. Three independent routes put the right figure
  // near 1.0. See RESEARCH.md §A13.
  TALK_TEST: {
    BACKOFF_MPH: 1.0,
    /** Below this the output is a walk/run prescription, not a running speed. */
    MIN_VIABLE_JOG_MPH: 4.0,
    /** One session is not a measurement when MDC is ~0.9 mph. Take the lower. */
    CALIBRATION_SESSIONS: 2,
    LADDER_START_MPH: 4.0,
    LADDER_STEP_MPH: 0.2,
    LADDER_STEP_MIN: 2,
    LADDER_MAX_MIN: 8,
  },

  // ── Heart rate ────────────────────────────────────────────
  // Secondary and corroborating, always. Never a governor, never a zone, never
  // a percentage of anything. See RESEARCH.md §A14, §A15, §A16.
  HR: {
    /**
     * Truncates a computed easy ceiling. Best understood as an ARTIFACT GUARD,
     * not a physiological boundary: it only binds when measured HR at talk-test
     * speed exceeds 160, and since the talk test approximates VT1 (~140 bpm for
     * this athlete), a reading that high is evidence of sensor error. 150 sits
     * at the floor of the cadence-lock output band, which is where a guard
     * against cadence lock belongs.
     */
    ABSOLUTE_CAP_BPM: 150,
    EASY_CEILING_BACKOFF_BPM: 10,
    /** Below this, reject and flag. A too-low ceiling is safe; he goes slower. */
    SANITY_LO_BPM: 120,
    /** Above this, REJECT the session rather than truncate it — truncating a
     *  garbage reading launders it into a plausible-looking number. */
    SANITY_HI_BPM: 165,

    /** Coincidence with cadence lowers confidence; it does not alone discard. */
    CADENCE_LOCK_BAND_BPM: 5,
    CADENCE_LOCK_MIN_SECONDS: 30,
    /** HR has a 20-30 s time constant and physically cannot step this fast. */
    TRANSITION_JUMP_BPM: 6,
    TRANSITION_WINDOW_SECONDS: 10,
    /** A locked trace is pathologically smooth — it tracks the belt, not him. */
    VARIANCE_FLOOR_BPM: 1,
    VARIANCE_WINDOW_SECONDS: 60,
    DISCARD_CONFIDENCE_NONE_PCT: 0.30,
    /** Cold-hand vasoconstriction collapses signal amplitude precisely here. */
    IGNORE_FIRST_MINUTES: 5,

    /** Drift thresholds, duration-scaled and above the device's noise floor. */
    DRIFT_SHORT_RUN_MAX_MIN: 25,
    DRIFT_SHORT_THRESHOLD_BPM: 12,
    DRIFT_LONG_THRESHOLD_BPM: 15,
    /** A rise concentrated before this minute means too fast, not thermal drift. */
    DRIFT_EARLY_ONSET_MIN: 15,
    DRIFT_WINDOW_DAYS: 14,
    DRIFT_EVENTS_BEFORE_DROP: 2,
    DRIFT_AUTODROP_SPEED_MPH: 0.2,
    DRIFT_AUTODROP_HR_BPM: 5,
  },

  // ── Pain ──────────────────────────────────────────────────
  // Severity is the least valid input even when honest — pain severity
  // correlates poorly with radiological severity in bone stress injury — and
  // it is the one input a motivated 15-year-old can shade downward at no cost.
  // Location and temporal pattern therefore trigger independently of severity.
  // See RESEARCH.md §A2, §A3, §A8.
  PAIN: {
    /** Non-bony threshold. No peer-reviewed source validates the popular 2/10. */
    SEVERITY_INTERRUPT: 3,
    /** Non-bony branch only. The bony branch never uses a countdown. */
    NON_BONY_REST_DAYS: 3,
    /** Bone branch: consecutive clean days before any re-entry is considered. */
    BONE_CLEAN_DAYS_REQUIRED: 3,
    /** Not clear by this point, or a high-risk site, and it stops being ours. */
    BONE_REFERRAL_AFTER_DAYS: 7,
    /** Re-entry after a bone interrupt starts here, not where he left off. */
    BONE_REENTRY_FACTOR: 0.5,
    /** A second trigger at the same site inside this window ends self-management. */
    BONE_RECURRENCE_WINDOW_DAYS: 14,
    /** Self-administered, no equipment, most sensitive single test available. */
    HOP_TEST_REPS: 10,
  },

  // ── Silence decay ─────────────────────────────────────────
  SILENCE: {
    TRIGGER_DAYS: 7,
    DECAY_PER_DAY: 0.95,
  },

  // ── Weekly probe ──────────────────────────────────────────
  PROBE: {
    /** Consecutive weeks of falling HR at fixed speed before a ceiling may rise. */
    RAISE_CONSECUTIVE_WEEKS: 2,
    /** And when it rises, it rises by this much. Slowly. */
    RAISE_STEP_MPH: 0.1,
    /** Neither HR nor RPE improving across this many weeks raises a flag. */
    FLAT_WEEKS_FLAG: 3,
    FIXED_MINUTES: 5,
  },

  // ── Footwear and surface ──────────────────────────────────
  // The brief over-weighted footwear. No study anywhere examines running injury
  // in people running in non-running shoes, and speed dominates tibial shock
  // over cushioning by eta-squared 0.80 vs 0.39 — at his paces the shoe term
  // operates where it matters least. The caps below are kept as conservative
  // precaution, not because they are evidenced. What IS evidenced is the
  // minimalist transition. See RESEARCH.md §A24.
  FOOTWEAR: {
    NONE_BUDGET_FACTOR: 0.7,
    NONE_SESSION_CAP_MIN: 25,
    NEW_SHOES_DAILY_CAP_MIN: 35,
    NEW_SHOES_SESSIONS: 3,
    /** Minimalist / zero-drop / carbon-plated only. Conventional trainers get none. */
    MINIMALIST_FACTOR: 0.6,
    MINIMALIST_SESSIONS: 10,
  },
  SURFACE: {
    ROAD_TRANSITION_FACTOR: 0.8,
    ROAD_TRANSITION_SESSIONS: 4,
    ROAD_TAPER_FACTOR: 0.9,
    ROAD_TAPER_SESSIONS: 2,
    /** Weekly volume does not grow at all across the changeover week. */
    ROAD_CHANGEOVER_WEEK_GROWTH: 1.0,
    TREADMILL_INCLINE_PCT: 0.5,
  },

  // ── Heat ──────────────────────────────────────────────────
  // The sharpest interaction the research pass found between two of the brief's
  // own rules: at 35 C, HR rises 11% from minute 15 to 45 at constant work rate
  // versus 2% at 22 C. At a working HR of 150 that is ~16 bpm of purely
  // heat-driven drift — above the drift threshold. HR cannot separate metabolic
  // from thermoregulatory demand, so outside the reference band the engine
  // DECLINES to draw a pacing conclusion rather than correcting it with an
  // uncertain coefficient. See RESEARCH.md §A25, §A26.
  HEAT: {
    /** Drift verdicts are computed only below this adjusted WBGT. */
    REFERENCE_BAND_WBGT_C: 19,
    /** Forecast and gridded WBGT read 1-3 C low. Added before any comparison. */
    FORECAST_SAFETY_MARGIN_C: 2,
    /** ACSM Category 1 (northern US), nonacclimatized/unfit column. */
    LEVEL1_WBGT_C: 19.0,
    LEVEL1_DURATION_FACTOR: 0.8,
    LEVEL2_WBGT_C: 22.4,
    LEVEL2_DURATION_FACTOR: 0.67,
    LEVEL3_WBGT_C: 24.6,
    LEVEL3_DURATION_FACTOR: 0.5,
    /** At or above this, no outdoor session is prescribed at all. */
    LEVEL4_WBGT_C: 26.8,
    /** An unfanned indoor space above this is treated as an outdoor session. */
    INDOOR_MAX_AMBIENT_C: 26,
    /** Exercise-heat exposures before the acclimatized column applies. */
    ACCLIMATIZATION_EXPOSURES: 10,
    /** A gap this long reverts him toward the unacclimatized column. */
    ACCLIMATIZATION_DECAY_DAYS: 7,
  },

  // ── Tendon circuit ────────────────────────────────────────
  // Running is not a tendon stimulus. Nine months of habitual running produced
  // ZERO measurable Achilles adaptation in previously untrained subjects, and
  // low-intensity loading has a meta-analytic effect on tendon stiffness of
  // SMD 0.04 with a CI spanning zero. Without this circuit the engine would be
  // pacing running while claiming to build connective tissue it never loads.
  // See RESEARCH.md §A10.
  TENDON: {
    SESSIONS_PER_WEEK: 3,
    /** Running exceeds the adaptive strain threshold for ~90 ms per step. */
    HOLD_SECONDS: 3,
    SETS: 4,
    REPS: 5,
    /** No intervention shorter than this registered any change. */
    MIN_WEEKS_TO_EFFECT: 8,
  },

  // ── Recalibration ─────────────────────────────────────────
  RECALIBRATION: {
    INTERVAL_DAYS: 14,
  },
} as const

// ============================================================
// EVIDENCE REGISTER
//
// One entry per leaf value above, keyed by dotted path. The test suite checks
// this is exhaustive in both directions. `source` is what a human would need
// to go read to challenge the number.
// ============================================================

export interface EvidenceEntry {
  level: EvidenceLevel
  source: string
}

export const EVIDENCE: Record<string, EvidenceEntry> = {
  'LOAD.SESSION_CAP_FACTOR': { level: 'moderate', source: 'Frandsen 2025 BJSM 59(17), n=5205, 588k GPS sessions: adjusted HRR 1.64 / 1.52 / 2.28 above 110% of 30-day longest. Only head-to-head test of session vs weekly metrics. Derived in distance, adults mean age 45.8 — the minutes substitution is untested.' },
  'LOAD.LONGEST_LOOKBACK_DAYS': { level: 'moderate', source: 'Frandsen 2025 — the exposure window used in the model.' },
  'LOAD.SESSION_CAP_MIN_INCREMENT_MIN': { level: 'weak', source: 'Reasoned extension. A pure 10% rule at an 8-min baseline gives a 48-second increment. The +1 min floor sits inside the 10-30% band Nielsen 2014 (JOSPT 44(10), n=874) found NOT significantly elevated. Never tested.' },
  'LOAD.SESSION_CAP_MAX_INCREMENT_MIN': { level: 'weak', source: 'Reasoned extension, bounds the floor at higher volumes. Never tested.' },
  'LOAD.NEW_LONGEST_SESSIONS_PER_WEEK': { level: 'weak', source: "Frandsen 2025's own stated caveat: 10km -> 11 -> 12.1 -> 13.3 in one week is three compliant 10% steps and is plainly excessive. Reasoned; never tested." },
  'LOAD.TERMINAL_SESSION_CEILING_MIN': { level: 'moderate', source: 'Pollock 1977 Med Sci Sports 9(1), n=157 previously untrained males, 20 weeks, minutes-based: injury 22% at 15 min, 24% at 30 min, 54% at 45 min. Dated and an inmate cohort at 85-90% HRmax, so read as an upper bound — but nothing has superseded it on these units.' },
  'LOAD.WEEKLY_GROWTH_MAX': { level: 'weak', source: "Damsted 2019 JOSPT 49(4) used <20% as its REFERENCE category, not <10%. Frandsen 2025 and Joachim 2024 both found no weekly-level signal at all (p>=0.54 in HS cross-country). Kept as cheap secondary insurance; must never be described to the athlete as evidence-based." },
  'LOAD.WEEKLY_ABS_INCREASE_MAX_MIN': { level: 'weak', source: 'Reasoned pairing with the relative weekly cap so it is not degenerate near zero. Untested.' },
  'LOAD.HIGH_RISK_WEEK_FIRST': { level: 'moderate', source: 'Damsted 2019: load-change signal present at 21 days, absent at 56 and 98. Military recruit cohorts: BSI care-seeking begins week 3.' },
  'LOAD.HIGH_RISK_WEEK_LAST': { level: 'moderate', source: "Extended from the brief's week 6 to week 10. Military recruit data peak in weeks 5-8; bone resorption precedes formation on a 3-6 month remodelling cycle. Ending vigilance at week 6 relaxes just before the observed peak." },
  'LOAD.HIGH_RISK_INCREMENT_FACTOR': { level: 'weak', source: 'Reasoned. Rauh 2014 JOSPT 44(10): 15.9% of HS cross-country runners injured in month one (boys 13.2%).' },

  'FREQUENCY.RUN_DAYS_PER_WEEK': { level: 'moderate', source: 'Unanimous across every located protocol: GRONORUN 1 & 2 (RCTs, n=532/432) 3/wk; Bertelsen 2018 3/wk; Ohio State 2-3/wk; Oxford NHS and CU Sports Medicine every other day. Pollock 1977: 12% injury at 3 d/wk vs 39% at 5 d/wk. Fredette 2022 (36 studies, n=23,047) rates frequency evidence "conflicting", so this rests on protocol unanimity plus mechanism.' },
  'FREQUENCY.MIN_HOURS_BETWEEN_RUNS': { level: 'moderate', source: 'Miller 2005 J Physiol (stable-isotope, n=8): tendon collagen synthesis peaks 24 h post-load but degradation peaks earlier, so NET balance is negative for ~24-36 h and positive only from ~36-72 h (Magnusson/Kjaer, Nat Rev Rheumatol 2010). Mechanism strong; the 48 h number is the conservative rounding of it.' },
  'FREQUENCY.FOURTH_DAY_UNLOCK_WEEK': { level: 'weak', source: "Extrapolated from Oxford NHS's every-other-day cadence, which averages 3.5 days/week. Untested." },
  'FREQUENCY.MAX_RUN_DAYS_PER_WEEK': { level: 'moderate', source: 'No located protocol exceeds 4. Fredette 2022 reports RR 5.92 for 7 d/wk vs 0-2 d/wk. AAP Council on Sports Medicine and Fitness caps youth at 5 d/wk in one sport with >=1 full rest day.' },

  'LADDER.SESSIONS_PER_LEVEL_DEFAULT': { level: 'moderate', source: 'CU Sports Medicine: repeat each step 2-3 times. Ohio State: 6 clean reps at a level. Oxford NHS: a full clean week per level.' },
  'LADDER.SESSIONS_PER_LEVEL_MIN': { level: 'moderate', source: 'Oxford NHS pace — the fastest defensible path, earned by clean sessions only.' },
  'LADDER.FAILURES_BEFORE_REGRESSION': { level: 'moderate', source: 'Oxford NHS and the tibial-BSI return-to-run literature both step back one level on symptom recurrence; the post-illness graded-return guidance uses an identical structure.' },

  'DOWN_WEEK.EVERY_N_WEEKS': { level: 'lore', source: 'No trial located. GRONORUN ran 13 weeks with no down week. Retained because it is conservative and cheap — it costs one week and buys adaptation time in the window the engine is guarding (tendon adaptation needs 8-12 weeks; Bohm 2015 SR/MA).' },
  'DOWN_WEEK.CUT': { level: 'lore', source: 'Convention; no trial located. GRONORUN 1 and 2 (RCTs, n=532 and n=432) both ran their full programmes with no down week at all. Retained only because a 30% dip is cheap and its direction is safe.' },

  'TALK_TEST.BACKOFF_MPH': { level: 'moderate', source: "Three converging routes: (1) the talk test's own minimal detectable change is 24.7-29.4 W ~ 0.9-1.0 mph (2024 SR, PMC11266803) and a margin below the instrument's noise floor protects nothing; (2) the Foster lab prescribes one stage BELOW the last positive stage for sedentary individuals, ~0.90 mph-equivalent from a first-breathing-change stop; (3) error-budget arithmetic gives ~0.95. Persinger 2004 MSSE 36(9): the negative talk-test stage is 93% VO2peak vs VT at 77% — 16 points above VT1." },
  'TALK_TEST.MIN_VIABLE_JOG_MPH': { level: 'weak', source: 'Reasoned floor clamp. 1.0 mph off a 4.6 mph result is a walk; below this the correct output is a walk/run prescription, not a running speed.' },
  'TALK_TEST.CALIBRATION_SESSIONS': { level: 'moderate', source: 'With MDC ~0.9 mph a single administration is not a measurement. Take the lower of two on separate days.' },
  'TALK_TEST.LADDER_START_MPH': { level: 'weak', source: "The build brief's value, retained. No evidence located for a specific start speed." },
  'TALK_TEST.LADDER_STEP_MPH': { level: 'moderate', source: 'ACSM running equation: 0.2 mph = 1.07 mL/kg/min ~ 2.3% of VO2max at this athletes estimated capacity — a resolvable but not coarse step.' },
  'TALK_TEST.LADDER_STEP_MIN': { level: 'moderate', source: 'Every validated talk-test protocol uses 2-minute stages with recitation in the final 30 s (Persinger 2004; Sazama 2023).' },
  'TALK_TEST.LADDER_MAX_MIN': { level: 'weak', source: "The build brief's cap, retained — bounds total load in a discovery session on an unconditioned athlete." },

  'HR.ABSOLUTE_CAP_BPM': { level: 'moderate', source: 'Cicone 2019 (SR/MA, n=648 youth): measured HRmax pools to 198.3 +/- 8.9 bpm; 150 is ~76% of that. Corroborated by Shargal 2015 (n=6557, mean age 15.5, 196.1 +/- 7.6). Adolescent VT1 measures ~141 bpm. Also sits at the floor of the cadence-lock output band (~150-180), which is its real job. 145 is marginally better on physiology but the difference is inside the device error.' },
  'HR.EASY_CEILING_BACKOFF_BPM': { level: 'lore', source: "The build brief's value. No source located for 10 bpm specifically; kept because it is conservative and its direction is safe." },
  'HR.SANITY_LO_BPM': { level: 'moderate', source: "Loosened from the brief's 130. A detrained teenager's easy HR runs high, so a computed ceiling under this signals sensor under-read — but a too-low ceiling is SAFE (he simply goes slower), so a tight lower bound only costs usability." },
  'HR.SANITY_HI_BPM': { level: 'moderate', source: "Tightened from the brief's 180, which is ~91% of a 197 HRmax and impossible as an easy ceiling. Above this the session is REJECTED rather than truncated: truncating a garbage reading to 150 launders it into a plausible-looking number." },
  'HR.CADENCE_LOCK_BAND_BPM': { level: 'weak', source: 'Widened from the brief +/-3. The DSP literature describes two harmonic series with slightly different fundamentals, so exact equality misses locks sitting 4-8 bpm off. Cadence lock is quantified NOWHERE in the peer-reviewed literature — no prevalence, no episode duration, no triggering combinations — so every number here is an engineering estimate. Hence FLAGS.HR_GATES_SHADOW_MODE.' },
  'HR.CADENCE_LOCK_MIN_SECONDS': { level: 'weak', source: "The build brief's value. Unvalidated; see above." },
  'HR.TRANSITION_JUMP_BPM': { level: 'moderate', source: 'HR has a 20-30 s time constant and cannot step; cadence changes within one or two strides. This is the primary discriminating evidence, because bpm ~ cadence is the EXPECTED state for this athlete at easy effort (easy HR ~140-155, jogging cadence ~150-170) and coincidence alone must not discard.' },
  'HR.TRANSITION_WINDOW_SECONDS': { level: 'moderate', source: 'Same HR time-constant argument as TRANSITION_JUMP_BPM: cardiac response to a work-rate step is 20-30 s, so any change completed inside 10 s belongs to the belt, not the heart.' },
  'HR.VARIANCE_FLOOR_BPM': { level: 'weak', source: 'A locked trace is pathologically smooth. Reasoned from the mechanism; no published threshold.' },
  'HR.VARIANCE_WINDOW_SECONDS': { level: 'weak', source: 'Reasoned: long enough that genuine beat-to-beat and respiratory variation would show, short enough to catch a lock episode. No published threshold exists — cadence lock is unquantified in the literature.' },
  'HR.DISCARD_CONFIDENCE_NONE_PCT': { level: 'moderate', source: 'Matches the literature convention that high accuracy means MAPE <10% for >=70% of training time — a 30% discard tolerance. Ships in shadow mode until this athletes own discard distribution supports it.' },
  'HR.IGNORE_FIRST_MINUTES': { level: 'moderate', source: 'Cold-hand peripheral vasoconstriction collapses PPG pulse amplitude (Sci Rep 2026 cold-stress study), and HR has not reached steady state. Both peak in exactly these minutes.' },
  'HR.DRIFT_SHORT_RUN_MAX_MIN': { level: 'moderate', source: 'Adolescent endurance runners showed only 0.4% decoupling at 5-6 km with onset at a median of 10 km (~35-45 min) — Front Physiol 2026, n=13. Drift is near-absent in the first ~30 min.' },
  'HR.DRIFT_SHORT_THRESHOLD_BPM': { level: 'moderate', source: "Raised from the brief's 8-10 bpm, which sits INSIDE the device's noise floor: budget wrist PPG MAE is 5-8 bpm with 95% LoA +/-20-25. Must be compared median-to-median across multi-minute windows or it measures noise." },
  'HR.DRIFT_LONG_THRESHOLD_BPM': { level: 'weak', source: 'Scaled for longer runs where thermoregulatory drift is genuinely expected. Reasoned.' },
  'HR.DRIFT_EARLY_ONSET_MIN': { level: 'moderate', source: 'Onset timing is the real discriminator, not magnitude. Thermoregulatory drift is late-onset and gradual; a pace above VT1 produces an early continuous rise because steady state was never reached at all.' },
  'HR.DRIFT_WINDOW_DAYS': { level: 'lore', source: "The build brief's window. Convention; no source located." },
  'HR.DRIFT_EVENTS_BEFORE_DROP': { level: 'lore', source: "The build brief's value. Convention; conservative and harmless." },
  'HR.DRIFT_AUTODROP_SPEED_MPH': { level: 'lore', source: "The build brief's value. Direction is safe — it only ever lowers a ceiling." },
  'HR.DRIFT_AUTODROP_HR_BPM': { level: 'lore', source: "The build brief's value. Direction is safe." },

  'PAIN.SEVERITY_INTERRUPT': { level: 'lore', source: 'The only RCT-validated pain threshold is <=5/10 (Silbernagel 2007 AJSM) and it is for TENDON in adults, where load under pain is therapeutic — it does not transfer to bone. The widely repeated 2/10 appears only in clinic blogs and handouts; no peer-reviewed source validates it. 3 is no less evidence-based than 2 and less likely to fire on ordinary DOMS.' },
  'PAIN.NON_BONY_REST_DAYS': { level: 'lore', source: "The build brief's value, retained for the non-bony branch only. The validated part of Silbernagel is the STRUCTURE (during / later that day / next morning), not any number." },
  'PAIN.BONE_CLEAN_DAYS_REQUIRED': { level: 'moderate', source: 'Warden/Davis/Fredericson JOSPT 2014 specify pain-free LOADING, not a numeric allowance. Pain-free walking is a universal prerequisite across all 50 sources in the 2024 tibial-BSI return-to-run scoping review.' },
  'PAIN.BONE_REFERRAL_AFTER_DAYS': { level: 'moderate', source: 'Conservative tibial BSI management runs 6-27 weeks, average time to unrestricted sport 12-13 weeks. A fixed short timer manufactures a false cleared state; past this point it stops being self-managed.' },
  'PAIN.BONE_REENTRY_FACTOR': { level: 'weak', source: 'Tibial-BSI RTR convention: resume at a lower level than the one that failed. No trial; level IV evidence throughout that literature.' },
  'PAIN.BONE_RECURRENCE_WINDOW_DAYS': { level: 'weak', source: 'Reasoned. Adolescent BSI recurrence runs up to 21%.' },
  'PAIN.HOP_TEST_REPS': { level: 'moderate', source: 'The single-leg hop is "the most sensitive test for predicting return to unrestricted pain-free activity" for tibial BSI (2024 scoping review); ~70% of femoral stress fractures produce a positive hop. Self-administrable with no equipment.' },

  'SILENCE.TRIGGER_DAYS': { level: 'lore', source: "The build brief's value. Assume-completed is only valid while he is engaging; no source for 7 days specifically." },
  'SILENCE.DECAY_PER_DAY': { level: 'lore', source: 'Convention. Direction is safe — it only ever reduces assumed fitness.' },

  'PROBE.RAISE_CONSECUTIVE_WEEKS': { level: 'lore', source: "The build brief's rule. Conservative by construction: ceilings fall freely and rise only on two weeks of falling HR at fixed speed." },
  'PROBE.RAISE_STEP_MPH': { level: 'weak', source: 'Half the calibration ladder step. Reasoned: ceilings should rise more slowly than they fall.' },
  'PROBE.FLAT_WEEKS_FLAG': { level: 'lore', source: "The build brief's value. A flag, not a gate — it changes nothing on its own." },
  'PROBE.FIXED_MINUTES': { level: 'lore', source: "The build brief's value. Frozen at calibration so HR is comparable week to week." },

  'FOOTWEAR.NONE_BUDGET_FACTOR': { level: 'weak', source: "The build brief's value, KEPT as precaution but explicitly not evidenced: no study anywhere examines running injury in people running in non-running footwear. Absence of evidence, so the conservative default stands." },
  'FOOTWEAR.NONE_SESSION_CAP_MIN': { level: 'weak', source: "The build brief's value. Precautionary. Lam 2018: speed dominates tibial shock over cushioning (eta-squared 0.80 vs 0.39), and his paces sit below the speeds where footwear kinetics were even measured." },
  'FOOTWEAR.NEW_SHOES_DAILY_CAP_MIN': { level: 'weak', source: "The build brief's value. No break-in evidence exists — 1,773 runners across three RCTs entered novel conventional shoes with no run-in and no early injury spike. Kept as cheap precaution only." },
  'FOOTWEAR.NEW_SHOES_SESSIONS': { level: 'weak', source: 'Precautionary. Break-in periods for conventional trainers are lore.' },
  'FOOTWEAR.MINIMALIST_FACTOR': { level: 'moderate', source: 'Ridge 2013 MSSE 45(7): 10 of 19 runners transitioning to minimalist footwear developed bone marrow oedema on MRI within 10 weeks (p=0.009), subclinically. Ryan 2014 BJSM: 12 injuries in the partial-minimalist arm vs 4 neutral. The adolescent tendon-maturation lag makes this stronger here than in those adult trials.' },
  'FOOTWEAR.MINIMALIST_SESSIONS': { level: 'weak', source: 'Ridge 2013 measured oedema accrual over 10 weeks, so a short taper is clearly inadequate; 10 sessions is a reasoned floor, not a tested value. Best action is to gate the PURCHASE — a conventional cushioned trainer chosen on comfort and fit, not arch type (the most decisively falsified heuristic in the footwear literature).' },
  'SURFACE.ROAD_TRANSITION_FACTOR': { level: 'weak', source: 'Explicitly precautionary — NO study has measured a treadmill-to-overground transition in either direction. Re-based: the justification is not that treadmill under-loads (it does not; peak vGRF shows no difference and Achilles load is 12.5% HIGHER on treadmill) but that Aug 10 stacks 5-6 novel stressors in 48 h, and that at slow speeds treadmill HR and RPE run LOWER than overground at matched speed (Miller 2019, SR/MA of 34 studies).' },
  'SURFACE.ROAD_TRANSITION_SESSIONS': { level: 'weak', source: "Extended from the brief's 3. Three sessions is far shorter than any plausible connective-tissue timescale. Precautionary." },
  'SURFACE.ROAD_TAPER_FACTOR': { level: 'weak', source: 'Reasoned step-down rather than a cliff back to full volume.' },
  'SURFACE.ROAD_TAPER_SESSIONS': { level: 'weak', source: 'Reasoned step-down length, untested. No study has measured a treadmill-to-overground transition in either direction, so the whole taper is precautionary.' },
  'SURFACE.ROAD_CHANGEOVER_WEEK_GROWTH': { level: 'moderate', source: 'Hold weekly volume flat across the changeover — not because the ground is harder, but because pace and terrain leave his control that week. Nielsen 2014: >30% progression HR 1.59.' },
  'SURFACE.TREADMILL_INCLINE_PCT': { level: 'moderate', source: "Jones & Doust 1996 J Sports Sci 14(4) tested 2.92-5.0 m/s; this athlete's entire range (2.01-2.68 m/s) is BELOW that band. The correction compensates for air drag, which scales with v-squared, so required grade = 1% x (v/3.75)^2 — giving 0.29% at 4.5 mph to 0.51% at 6.0 mph. That formula retrodicts all five of their tested speeds. Note the whole 0-1% span is worth <4% of metabolic cost here, below this model's noise floor." },

  'HEAT.REFERENCE_BAND_WBGT_C': { level: 'moderate', source: 'Lafrenz & Wingo 2008 MSSE 40(6): HR rose 11% from min 15-45 at 35 C vs 2% at 22 C at constant work rate. At HR 150 that is ~16 bpm of heat-driven drift, above the drift threshold. HR cannot separate metabolic from thermoregulatory demand (Andrade 2023: HR was the strongest predictor of thermal strain, beta 0.462), so outside this band the engine declines to draw a pacing conclusion rather than correcting it.' },
  'HEAT.FORECAST_SAFETY_MARGIN_C': { level: 'moderate', source: 'Grundstein 2025, 1,056 paired measurements at 26 high schools in 11 states: app/gridded WBGT estimates read ~1 C low on average and 2-3 C low at high WBGT, systematically under-classifying risk.' },
  'HEAT.LEVEL1_WBGT_C': { level: 'strong', source: 'ACSM Expert Consensus Statement on Exertional Heat Illness, Curr Sports Med Rep 2023;22:134-149, Table 7, Category 1 (northern US), nonacclimatized/unfit/high-risk column.' },
  'HEAT.LEVEL1_DURATION_FACTOR': { level: 'moderate', source: 'ACSM level 4: increase rest/work ratio AND decrease total duration. Duration is reduced before intensity, per the ACSM escalation order.' },
  'HEAT.LEVEL2_WBGT_C': { level: 'strong', source: 'ACSM Expert Consensus Statement on Exertional Heat Illness, Curr Sports Med Rep 2023;22:134-149, Table 7, Category 1 level 5, nonacclimatized/unfit column. Reached on ~74% of Michigan August afternoons.' },
  'HEAT.LEVEL2_DURATION_FACTOR': { level: 'moderate', source: 'ACSM level 5: decrease intensity AND total duration, no conditioning activities.' },
  'HEAT.LEVEL3_WBGT_C': { level: 'strong', source: 'ACSM Expert Consensus Statement, Curr Sports Med Rep 2023;22:134-149, Table 7, Category 1 level 6, nonacclimatized/unfit column: 1:1 rest:work ratio, limit intense exercise.' },
  'HEAT.LEVEL3_DURATION_FACTOR': { level: 'moderate', source: 'ACSM level 6: 1:1 rest:work, limit intense exercise.' },
  'HEAT.LEVEL4_WBGT_C': { level: 'strong', source: 'ACSM 2023 Table 7, Cat 1 level 7: cancel or stop practice. Reached on ~19% of Michigan August afternoons but ~0% of mornings — which is why the engine schedules its own outdoor sessions in the morning.' },
  'HEAT.INDOOR_MAX_AMBIENT_C': { level: 'moderate', source: 'Otani 2023: a non-air-conditioned gym at 30-33 C ambient measured WBGT 28-30 C in 17-year-old athletes — the ACSM cancel band. An indoor space is not automatically a safe space.' },
  'HEAT.ACCLIMATIZATION_EXPOSURES': { level: 'moderate', source: 'McDonald 2025, Bayesian meta-regression of 211 papers: ~75-80% of adaptation lands in the first 4-7 exposures, substantially complete by 14. Mean protocol 8 +/- 4 exposures.' },
  'HEAT.ACCLIMATIZATION_DECAY_DAYS': { level: 'weak', source: 'Adams 2021 J Athl Train 56(4) Delphi consensus calls for reintroducing heat acclimatization after periods of inactivity, without specifying a gap. Reasoned.' },

  'TENDON.SESSIONS_PER_WEEK': { level: 'moderate', source: 'Bohm/Mersmann/Arampatzis 2015 Sports Med Open, SR/MA of 27 studies / 264 participants: high-intensity loading SMD 0.90 for tendon stiffness; low-intensity SMD 0.04 with CI spanning zero. Hansen 2003 J Appl Physiol: nine months of habitual running produced ZERO Achilles adaptation.' },
  'TENDON.HOLD_SECONDS': { level: 'moderate', source: 'Arampatzis 2007 J Exp Biol: adaptive stimulus requires 4.5-6.5% strain sustained ~3 s per repetition. Bohm 2024 Sci Rep: running exceeds the threshold for only 90 +/- 40 ms per step.' },
  'TENDON.SETS': { level: 'weak', source: 'Typical of the effective interventions in Bohm 2015; not independently established.' },
  'TENDON.REPS': { level: 'weak', source: 'Typical of the effective interventions in Bohm 2015; not independently established.' },
  'TENDON.MIN_WEEKS_TO_EFFECT': { level: 'strong', source: 'Bohm 2015 SR/MA: no intervention shorter than 8 weeks registered any tendon change; effective interventions averaged 12.9 +/- 4.5 weeks.' },

  'RECALIBRATION.INTERVAL_DAYS': { level: 'lore', source: "The build brief's value. Convention; no source located." },
}

/** Every dotted path to a numeric leaf in TUNABLES. Used by the evidence test. */
export function tunablePaths(node: unknown = TUNABLES, prefix = ''): string[] {
  if (typeof node !== 'object' || node === null) return prefix ? [prefix] : []
  return Object.entries(node).flatMap(([k, v]) => tunablePaths(v, prefix ? `${prefix}.${k}` : k))
}
