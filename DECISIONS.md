# DECISIONS.md

One entry per build stage, plus a standing record of choices that a future reader would otherwise have to reverse-engineer. Where a decision departs from the build brief, the departure is stated explicitly with its reason — never silently implemented in either direction.

---

## Stage 0 — Research pass

**Deliverable:** [`RESEARCH.md`](RESEARCH.md). Eight parallel literature reviews, one per question group in brief §2. Every finding carries claim, source and study design, study population, transfer note, mechanism, and a confidence rating of `strong` / `moderate` / `weak` / `lore`.

**Gate:** the reconciliation below is complete; every research-derived number lives in [`src/config/tunables.ts`](src/config/tunables.ts) with a machine-checked evidence entry; no engine code was written before this landed.

### The finding a human should weigh before anything else

**Thirty minutes continuous by Aug 10 is not achievable within any defensible progression, and three of the eight research threads flagged it independently.**

- Rauh 2014 (*JOSPT*, n=421 high-school cross-country runners, sex-adjusted): **≤8 weeks of summer running carried OR 2.7 (95% CI 1.2–5.8)** for injury in the first month of the season. He will have two to three weeks.
- Published protocols reach 30 minutes continuous in **19–33 sessions across 4.5–13 weeks** for unsupervised novices. The compressed clinic protocols that do it in 9–15 sessions assume a supervising physiotherapist and a patient with residual fitness.
- Military recruit data — the closest structural analogue to a detrained athlete on a forced ramp — show bone stress injury care-seeking **beginning in week 3 and peaking in weeks 5–8**. From an early-August start that window lands directly on the competitive season.

**Decision: the engine does not treat Aug 10 as a target it must hit.** It produces the safest achievable progression and reports honestly where he actually is on that date. The alternative — compressing the ladder to meet the date — is the specific failure this project exists to prevent, and no pain rule compensates for a schedule. This is surfaced to the athlete and to the human reviewer rather than resolved silently.

### Amendments to the brief's invariants

| # | Brief | Decision | Why |
|---|---|---|---|
| **7** | ACWR clamped 0.8–1.3 | **Removed entirely.** Replaced by a per-session cap: ≤110% of the longest session in the prior 30 days, one new-longest session per week. | Source figure under a retraction request; coupled form spurious by construction; in two prospective *running* cohorts (n=435 and n=5,205) the association ran **backwards**; the one RCT, in adolescents, returned RR 1.01; undefined at a zero baseline. And a **lower** bound of 0.8 would instruct a detrained 15-year-old to train *more* to satisfy a metric — a safety defect pointing the wrong way. |
| **2** | +10%/week, protective | **Kept as a ceiling, demoted from safety mechanism to governor**, labelled `LORE`. | Buist 2008 (RCT, n=532, same 12-months-detrained entry criterion): graded 13-week vs standard 8-week programme, **20.8% vs 20.3% injury, p=0.90**. The rule failed its only direct test. |
| **3** | frequency → duration → continuity → intensity | **Frequency is fixed at 3 days/week**, so the progressing dimensions are duration and continuity. | No located protocol — studied or clinical — runs a novice more than 4 days/week. Tendon net collagen balance is negative for ~24–36 h post-loading. |
| **8** | pain ≥3/10 or bony at any severity or gait-altering → 3 rest days | **Triggers kept and extended; the response is split.** Bony branch exits on a **symptom-resolution gate**, never a countdown. Added: a crescendo trigger (worse at minute 20 than minute 5), a hop-test trigger, a groin/hip red flag not requiring tenderness, and a lumbar red flag. | "Pain severity poorly correlates with radiological severity" — so a severity-only gate rests on an invalid assumption. A 3-day timer manufactures a false *cleared* state when conservative tibial BSI management runs 6–27 weeks. Palpation misses the femoral neck entirely, the highest-consequence site. |
| **new** | — | **Alternate long and short days.** Never three equal sessions in a week. | Rauh 2014: failing to alternate carried **OR 3.0 (1.4–6.4)** — better prospective support than any volume rule in the brief, and the brief does not mention it. |
| **new** | — | **48 hours minimum between runs.** | Collagen synthesis peaks ~24 h post-load but degradation peaks earlier; net balance is negative until ~36 h. |

### Amendments to §7, §8, §12 and scope

- **Seed ladder replaced.** The brief's 13-session ladder was identified as GRONORUN's 13-**week** RCT protocol with weeks relabelled as sessions — brief sessions 4–6 match GRONORUN week 2 exactly, down to the unusual 1.5-minute walk interval. New ladder: **9 criterion-gated levels, ~24 sessions across 8 weeks**, compressible to ~16–18 on clean sessions. The two steepest jumps (+75%, +39%) are smoothed to ≤25%, and a **20-minute continuous bout is inserted before the 30-minute test** — otherwise his first 20-minute run happens *during* the graded test. Starting dose unchanged at 8 jog minutes.
- **Talk-test margin 0.4 → 1.0 mph.** The brief's margin was *smaller than the instrument's own minimal detectable change* (~0.9 mph equivalent). Three independent routes converge on 1.0. Added: floor clamp (below a viable jog speed, prescribe walk/run instead of a running speed), calibrate twice and take the lower, and enforce genuine **aloud** vocalization — reciting under the breath permits a much higher intensity and is the largest unsupervised failure mode.
- **Nasal breathing demoted** from co-primary criterion to one-way cross-check. No validation against VT1 exists; between-subject SD ~31%; confounded by congestion. Worse, *forced* nasal-only breathing does not fail until 6.2–6.8 mph — above his entire easy range — so as a stop criterion it would never bind.
- **HR sanity band 130–180 → 120–165**, with reject-rather-than-truncate above 165. Truncating a garbage reading to 150 launders it into a plausible-looking number.
- **Cadence-lock rule reshaped.** For this athlete `bpm ≈ cadence` is the *expected* state during an easy run (easy HR ~140–155, jogging cadence ~150–170), so discarding on coincidence alone would delete most valid data. Coincidence now lowers a sample's confidence weight; a hard discard requires a transition-test or variance-collapse failure. Ships in **shadow mode** (`FLAGS.HR_GATES_SHADOW_MODE`) because cadence lock is quantified nowhere in the peer-reviewed literature.
- **Drift threshold 8–10 → 12–15 bpm**, median-to-median across multi-minute windows, first 5 minutes excluded, and **onset timing is the discriminator, not magnitude**. The brief's threshold sat inside the sensor's own 5–8 bpm error.
- **Drift is gated by environment.** At 35 °C, HR rises 11% from minute 15 to 45 at constant work rate versus 2% at 22 °C — roughly 16 bpm at his working HR, which would fire the detector on heat alone. Outside the reference thermal band the engine **declines to draw a pacing conclusion** rather than correcting it with an uncertain coefficient.
- **Treadmill incline 0–1% → 0.5%.** Jones & Doust's slowest tested speed was 9:11 min/mile; his entire range sits below it. Drag scales with v², giving 0.29–0.51% at his paces. Noted for maintainers: the whole 0–1% span is worth under 4% of metabolic cost here, below this model's noise floor — not worth engineering effort, and not exposed as a tunable.
- **Road-transition modifier re-based and extended** to −20% for 4 sessions then −10% for 2, plus an intensity cap and a flat-volume changeover week. Its old justification was wrong: belt-assisted push-off is a myth (Galilean equivalence), peak vertical GRF shows **no difference**, and Achilles load is **12.5% higher on the treadmill**. The real reason is that Aug 10 stacks five or six novel stressors in 48 hours, and at slow speeds treadmill HR and RPE run *lower* than overground at matched speed.
- **Footwear multipliers kept as precaution but explicitly de-emphasised**; a minimalist/low-drop/carbon-plate modifier added, which is the one footwear transition with real evidence (10 of 19 runners developed bone marrow oedema on MRI within 10 weeks, subclinically). Best action is to gate the **purchase**: a conventional cushioned trainer chosen on comfort and fit, **not arch type** — the most decisively falsified heuristic in the footwear literature, and the one adolescents actually use.

### Scope changes

- **Added: a tendon-directed strength circuit** (brief §18 listed this as out of scope beyond a basic calf circuit). Running is not a tendon stimulus — nine months of habitual running produced **zero** measurable Achilles adaptation in previously untrained subjects, and low-intensity loading has a meta-analytic effect on tendon stiffness of SMD 0.04 with a CI spanning zero. Without this the engine would be pacing running while claiming to protect connective tissue it never loads. Kept deliberately minimal: one circuit, ~3 s holds, three times a week, no equipment assumptions.
- **Added: minimal fuelling and sleep inputs.** RED-S risk factors received the **highest certainty rating of any modifiable factor** in the *JOSPT* 2023 systematic review of this exact population, and 38% of adolescent male endurance athletes in a three-year longitudinal study had low lumbar BMD at baseline. Not a food diary — one setup question and a low-frequency flag.
- **Added: a pre-Aug-10 heat-acclimatization block** of short early-morning outdoor sessions. Acclimatization is driven by exercise-**heat exposure**, not by aerobic fitness, so the indoor block confers fitness and essentially no heat adaptation; 75–80% of the available adaptation lands in the first 4–7 exposures.
- **Added: an entry gate** — pain-free brisk walking for 30 continuous minutes with normal gait. The most consistent prerequisite across every clinic protocol found. The brief began jogging with no check at all.
- **Honest framing, enforced in the narrative layer:** a graduated ladder builds *capacity*. It is **not** proven to prevent injury, and the app may not say that it is. A well-run return still carries roughly a 10–15% chance of a time-loss injury.

### Standing architecture decisions

- **SQLite → IndexedDB + Postgres mirror.** What is load-bearing in brief §4 is *event-sourced, append-only, state computed on read, enforced by a database trigger* — not the word SQLite. Local: IndexedDB, where `add()` throws on duplicate keys, giving append-only a real primitive and sync its dedup semantics for free; the storage module exports no update or delete function. Remote: Supabase Postgres with a `BEFORE UPDATE OR DELETE` trigger that raises, which no client can bypass. The mirror is also the durability answer to iOS evicting a web app's storage.
- **Prescriptions are events.** `prescription_issued` freezes the engine's output when it is first shown. So `session_completed` carries no numbers (exception-only reporting), tunable changes cannot retroactively rewrite what he was told to do, and every clamp survives in the audit trail.
- **Interrupts, decay and recalibration are fold derivations, not commands.** No code path can forget to apply them or apply them twice, which is what "mechanical, not advisory" has to mean in practice.
- **Raw HR samples never enter the fold.** Thousands of rows per run would swamp it; a pure pipeline reduces each session to one `hr_summary` event. Raw samples persist in a side store so a suspicious ceiling can be re-derived later.
- **No conflict resolution in sync.** The log is a grow-only set and the fold sorts before reducing, so two devices converge under plain set union. This deletes an entire class of problem the earlier engine needed real machinery for.
- **Monday-anchored calendar weeks** for the weekly cap, the down-week cadence and the probe; rolling windows only for the session-cap lookback.
- **Growth is measured against the last completed *build* week.** Down weeks are excluded from that baseline but their minutes still count in rolling windows.
- **Contradictory events resolve conservatively** — `missed` and `cut_short` beat `completed` for the same prescription.
- **v1 HR ingestion is manual entry.** The CMF Watch Pro 3 has no public API and no validation data exists for it or its price class during running. Manual entry caps `hr_confidence` at `low`, which is a state the engine is designed to run in indefinitely. CSV import sits behind a flag.
- **Narrative layer is deterministic templates.** `FLAGS.LLM_NARRATIVE` is off; no API key, no network dependency, works in a basement. If ever enabled it becomes a Supabase Edge Function — a client-side key is never acceptable.
- **The engine is pure and the ban is mechanical.** `src/engine` and `src/config` may not reference `Date`, browser storage, or browser globals, and may not import from `src/lib`. Calendar arithmetic uses Hinnant civil↔day-number conversion so the `Date` ban has no exceptions to reason about. Enforced by `noBannedConcepts.static.test.ts`, which also implements invariant 13 by construction: it greps the shipped source for any max-heart-rate concept. That invariant is the best-supported decision in the brief — age-based formulas overestimate by 12.4 bpm in youth, and an individual 15-year-old's 95% prediction interval spans roughly 181–216 bpm.

---

## Stages 1–3 — Engine, phase gates, interrupts, HR pipeline

**Gate:** 141 tests green — all thirteen invariants and all eighteen required cases, plus fold determinism and a twelve-week replay. No UI existed when this gate closed.

- **Frequency is fixed at three, so the progression order changed.** The brief's order was frequency → duration → continuity → intensity, written expecting frequency to climb toward daily. It cannot: a fourth running day inside a seven-day week cannot satisfy the 48-hour spacing rule (Mon/Wed/Fri is the maximum non-consecutive set that repeats weekly). The fourth-day unlock in the tunables is therefore a documented ceiling that the scheduler never reaches, and the dimensions that actually progress are duration and continuity.
- **Two HR signals with two urgencies.** Aerobic drift is inferential — it says the pace was *probably* above easy — so it takes two occurrences to move a ceiling. A ceiling breach is direct: his measured easy ceiling was exceeded while the belt sat at the prescribed speed. That drops the speed immediately. Collapsing them into one counter would have made R10 and R14 contradict each other.
- **Drift breaches are counted cumulatively, not in a rolling window.** A rolling count would let a ceiling drop expire on its own after two weeks — a rise with no evidence behind it, which invariant 12 forbids. Cumulative counting is the conservative reading.
- **Contradictory events resolve toward less credit.** Over-crediting a session inflates the baseline every future cap is computed from; under-crediting only slows him down. So `missed` and `cut_short` beat `completed`, and two reports of the same shortfall keep the smaller.
- **Session structures shrink by losing repetitions, not by shortening intervals.** The interval length is what is being trained at a given level; cutting it would change what the session is rather than how much of it there is.

## Stage 4 — Storage, sync, UI, deploy

**Gate:** driven end to end in a browser — calibration wizard, today card, pain triage, blocking gate. Built, deployed, and loading from GitHub Pages.

- **A real design flaw surfaced only by driving the actual UI**, not by any unit test: the brief's discovery ladder stops at 8 minutes, stepping 0.2 mph from 4.0, so it tops out at 4.6 mph. Minus the 1.0 mph margin that is 3.6 mph — a brisk walk. **The engine could never have derived a jogging speed at all.** Every test that handed `calibrate()` a talk-test result rather than running the ladder was blind to it.
  - **Fix:** a ladder that runs out of time no longer completes calibration. It only proves the ceiling is *above* the top speed reached, so the next discovery session resumes from there. Each is eight jogging minutes — the same dose as the first rung of the plan — and it converges in two or three. After three attempts with no reported breathing change the engine accepts the top speed reached rather than leaving him without a plan, with the full margin still applied.
  - A ceiling that still lands below jogging pace is **labelled "walk speed"** rather than dressed up as a run. The ceiling itself is left alone: a low cap is safe, and raising it to look more like running would not be.
- **A dev-only `?date=` override**, stripped from production builds. Possible at zero cost precisely because the engine takes `today` as a parameter.
- **The sync badge degrades loudly.** "On this phone only" and "not backed up" are the states that lose a season, so they are stated rather than hidden.

## Stage 5 — Narrative

**Gate:** every rationale code renders a sentence, asserted by exhaustiveness test; zero network calls with the flag off.

- **The honesty constraint is a test, not a style note.** One case walks every rendered sentence and every setup notice and fails if prevention and injury appear in the same sentence without a negation carrying it — because Buist 2008 tested "does a gradual ladder prevent injury" in 532 novice runners with this athlete's exact detraining criterion and found 20.8% vs 20.3%. Another fails on streak, badge, or motivational-filler language.
  - That test caught its own author: the first version flagged the app's *own* honest disclaimer ("not proven to prevent injury"). The check now reads sentence by sentence and requires a negation, which is the distinction that actually matters.
- **Pain triage asks four binary, behaviour-anchored questions** rather than a 0–10 scale. Severity correlates poorly with radiological severity in bone stress injury, and it is the single input a motivated 15-year-old can shade downward at no cost. "Did it hurt more at the end than at the start?" cannot be gamed the same way.

## Open items for the human reviewer

1. **Run the Supabase migration.** Until then the log lives on one phone. The verification statements at the bottom of the SQL file must fail — if `update` or `delete` succeeds, the append-only model is not in force.
2. **Michigan's WBGT region category is unverified** against Grundstein et al. 2015. Category 1 (the conservative choice) is encoded; Category 2 would shift every heat threshold about 2 °C warmer.
3. **Whether the watch exposes per-sample cadence is unknown**, and the cadence-lock rule presupposes it. The fallback (transition and variance tests alone) works without it. The gates ship in shadow mode either way, because cadence lock is quantified nowhere in the peer-reviewed literature.
4. **Energy availability and sleep are scoped but not built.** They carried the highest certainty rating of any modifiable factor in the systematic review of this exact population, and they are the clearest remaining gap between what the evidence says matters and what the engine currently measures.
