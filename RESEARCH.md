# RESEARCH.md — Stage 0 evidence pass

**Status:** in progress. Sections land as each research thread reports.
**Purpose:** the rules in the build brief are a starting hypothesis written by someone who is not a sports physiologist. This document verifies them before they are encoded, and says plainly where the evidence does not support them.

## Method

Eight parallel literature reviews, one per brief §2 question group. Source vetting, in order of weight: (1) systematic reviews and meta-analyses in peer-reviewed sports medicine / exercise physiology journals; (2) primary RCTs and prospective cohorts; (3) position statements from recognized bodies (ACSM, AAP, BJSM consensus, IOC, NATA); (4) textbook physiology, for *mechanism* only, never for prescription. Coaching blogs, product marketing, forum posts and content farms were rejected outright; where a number exists only in those, it is reported as such rather than laundered.

Every finding carries: claim, source and study design, study population, an explicit **transfer note** (does this apply to a detrained 15-year-old male?), a one-sentence mechanism, and a confidence rating of `strong` / `moderate` / `weak` / `lore`.

**Standing caveat that applies to every section:** there is no study of the target population — a ~12-month-detrained 15-year-old male returning to running. Every number here is transferred from an adjacent population. The closest structural analogues are military recruits (untrained → high-volume weight-bearing on a fixed schedule) and novice adult runners; the *worst* analogue, despite superficially matching on age and sport, is trained high-school cross-country runners, because their exposure range never includes the zero-to-something transition this athlete is about to make.

---

# PART I — Findings that change the design

These are surfaced before the detail because each one contradicts something in the brief. Per the build protocol, none has been silently implemented in either direction.

## A1. The Aug 10 goal is not achievable within any defensible progression. `moderate`

The brief's primary goal is 30 minutes continuous running by **Aug 10, 2026**, from a standing start on **Jul 26** — 15 days, matching the seed prior's 13-session ladder.

The best-matched prospective study available (Rauh, *JOSPT* 2014, n=421 US interscholastic cross-country runners, both sexes, sex-adjusted) found that **running ≤8 weeks during the summer nearly tripled the odds of injury in the first month of the season: OR 2.7, 95% CI 1.2–5.8.** Same sport, same age, same pre-season scenario — this is as close to a direct test as the literature gets.

Independently, the military-recruit literature — the closest structural analogue to a detrained athlete on a forced ramp — shows bone stress injury care-seeking **beginning in week 3 and peaking in weeks 5–8**, with mean time from start of training to clinical stress fracture diagnosis around 21 days. Counting from an early-August start, that vulnerability window lands **directly on the competitive season**, at exactly the moment race intensity, footwear (flats or spikes), and terrain all change at once.

**Implication for the engine.** The deadline is a constraint the engine cannot make safe, and no pain rule compensates for a schedule. Two things follow, both implemented:

1. The engine does not treat Aug 10 as a target it must hit. It produces the safest achievable progression and reports honestly where he will actually be on that date. A tryout standard he is not ready for is information he and his coach need on Aug 3, not a number to chase.
2. The guarded window is extended from the brief's "weeks 3–6" to **weeks 3–10**, covering the observed peak rather than stopping just before it.

**This is the one finding a human should weigh before anything else.** The engine is being built to be honest about the gap rather than to close it.

## A2. Pain severity is not a valid primary gate. `moderate`

> "Pain severity poorly correlates with radiological severity." — adolescent BSI narrative review, *Sports Med Open* 2021 (PMC8073721)

Periosteal nociception is not proportional to the extent of the underlying fatigue crack. A rule that gates on a self-reported 0–10 number is therefore built on an invalid assumption *even when the athlete is being honest* — and the qualitative literature says he will not be: concealment of injury and playing through pain is well documented in adolescent sport, and time-loss injury definitions are known to underestimate prevalence in adolescents specifically, because they keep playing.

**This is the strongest possible support for the brief's bony-landmark-at-any-severity rule — invariant 8 is upheld and strengthened.** It also means the engine should prefer binary, behaviour-anchored questions over severity scales wherever it can. Severity is the single input a motivated 15-year-old can shade downward at no cost, and it is the least valid input even when truthful.

## A3. Three forced rest days is the wrong *response* to bone pain. `moderate`

Invariant 8's trigger set is sound. Its response is not: a fixed 3-day timer manufactures a false "cleared" state. Conservative tibial BSI management runs **6–27 weeks**, with average time to unrestricted sport around 12–13 weeks. Returning to loading after three days lands squarely inside the remodelling resorption phase, when the bone is transiently *weaker* than at baseline.

Peer-reviewed bone guidance specifies **pain-free loading**, not a numeric pain allowance (Warden, Davis & Fredericson, *JOSPT* 2014; tibial-BSI return-to-run scoping review, 2024, 50 studies). Pain-free walking is a universal prerequisite across all 50 sources reviewed.

**Amendment adopted (conservative direction):** the bony branch of the pain interrupt exits on a **symptom-resolution gate**, never a countdown — pain-free walking *and* a pain-free 10-hop test on three consecutive days before any re-entry, mandatory referral if not met within 7 days or if the site is high-risk, re-entry at ≤50% of last tolerated duration, and a second trigger at the same site within 14 days ends self-management entirely. The non-bony branch keeps a time-based response.

## A4. The 10% rule failed its RCT. `strong` (that it is unvalidated)

Buist et al., novice adult runners (n≈532): a 13-week graded programme applying the 10% rule produced **no reduction in running-related injury versus a standard 8-week programme — 20.8% vs 20.3%.** The rule "appears to have originated as a progression of distance… but has been extrapolated across different variable domains… still without supporting evidence."

**Amendment:** invariant 2's +10%/week cap is **retained as a conservative volume ceiling but demoted from a safety mechanism to a governor**, and labelled `LORE` in code. It constrains; it is not believed to prevent injury. What replaces it as the actual protective mechanism is A5.

## A5. Load *pattern* beat load *volume*. `moderate` — and it is not in the brief at all

Same Rauh 2014 cohort, adjusted for sex and prior injury: **not frequently alternating short and long mileage days carried OR 3.0 (95% CI 1.4–6.4)** for early-season injury. Meanwhile the *JOSPT* 2023 systematic review of 24 prospective studies in high-school and collegiate cross-country found that **total weekly running volume, duration, and weekly changes in volume, duration and intensity were not prospectively associated with injury.**

The mechanism is plausible and specific: day-to-day load variation gives bone and tendon a remodelling window between high-strain bouts.

**Amendment adopted — a new invariant.** The engine must alternate long and short days rather than repeating a uniform duration. This has better prospective support than any volume rule in the brief, and the brief does not mention it.

**Caveat, stated honestly:** the *JOSPT* null on volume is measured *within* an already-training range. Absence of an association across a narrow exposure band is not evidence that ramping from zero is safe. Volume control is kept — it is simply no longer believed to be the whole story.

## A6. ACWR is removed entirely, and its lower bound was a safety defect. `strong` against

Invariant 7 clamps ACWR to 0.8–1.3. The dedicated review came back unambiguous: **this is not defensible, and the lower bound is actively unsafe.** Seven independent lines converge:

1. **The source figure is under a formal retraction request.** The 0.8–1.3 "sweet spot" originates in Blanch & Gabbett 2016 (*BJSM*, elite adult cricket/rugby/AFL players). Impellizzeri et al. submitted a letter to *BJSM* requesting retraction or erratum on the grounds that the figure was fitted to aggregated rather than raw data.
2. **The coupled form is spurious by construction.** Acute load is both the numerator and a component of the denominator. "This spurious correlation will be present irrespective of any true physiological association" (Lolli et al., *BJSM* 2019). This is a mathematical fact, not an empirical claim, so it is population-independent — it applies to n=1 exactly as it applies to a squad.
3. **Uncoupling and EWMA do not rescue it.** Coupled and uncoupled behave similarly in runners; EWMA has a known **initial-load problem** — which is precisely, fatally, this athlete's situation.
4. **In runners the association runs backwards.** Two prospective cohorts, different countries, different statistical frameworks, same reversed direction. Nakaoka 2021 (n=435, Bayesian): ACWR < 0.70 → 9.6% injury probability; ACWR > 1.38 → **1.3%**. Frandsen 2025 (n=5,205, multistate Cox): uncoupled ACWR >100% → **HRR 0.75 (0.59–0.96), p=0.02**. Almost certainly reverse causation — runners with a niggle cut their load, so low ratios *precede* reported injury — but that is the point: **the metric does not measure what the clamp assumes it measures.**
5. **The one RCT, in adolescents, was null.** Dalen-Lorentsen et al. 2021 (*BJSM*, cluster RCT, 482 elite youth footballers, coaches planned a full 10-month season using published ACWR principles): **RR 1.01 (95% CI 0.91–1.12), p=0.84.**
6. **It is arithmetically undefined at this baseline.** With 12 months at zero, the chronic denominator is zero in week 1 and dominated by zeros through week 4. Any non-zero start produces a ratio far above 1.3 by necessity. Frandsen's own coding for this state is "not possible to calculate."
7. **The lower bound would instruct a detrained 15-year-old to train MORE to satisfy a metric.** That is not insufficient conservatism; it is a safety defect pointing the wrong way.

**Amendment adopted — invariant 7 is replaced, not weakened.** ACWR is removed from the prescription path entirely. It is not clamped, not uncoupled, not EWMA'd, and not kept as a lower bound in any form. What replaces it is A6b.

## A6b. The replacement guardrail is per-session, not per-week. `moderate-strong`

The single most decision-relevant paper in the whole research pass: **Frandsen et al. 2025, *BJSM* 59(17), n=5,205 runners, 588,071 GPS-measured sessions, 18-month prospective, multistate Cox with competing risks.** It is the only study to test session-level, ACWR, and week-level exposures *head to head in the same data*, which makes the relative ranking internally valid even where the absolute numbers don't transfer.

Relative to a session at or below 110% of the **longest run in the previous 30 days**, adjusted hazard rate ratios for a first overuse injury were:

| Session vs 30-day longest | Adjusted HRR |
|---|---|
| >10–30% | **1.64 (1.31–2.05)** |
| >30–100% | **1.52 (1.16–2.00)** |
| >100% | **2.28 (1.50–3.48)** |

In the same cohort, **week-level metrics showed nothing** — week-to-week ratio 0.97 / 0.88 / 0.91, all non-significant. Corroborating this from the target population: Joachim et al. (Wisconsin high-school cross-country runners) found **no association between total volume, duration, or week-to-week change and in-season injury, p ≥ 0.54.**

A companion paper from the same cohort found that most overuse injuries had a **sudden onset attributable to a single session** rather than gradual accumulation — which is the mechanistic reason a per-session gate beats a weekly budget reconciled after the fact.

**Two caveats kept on the record.** The gradient is not monotonic (1.64 for >10–30% exceeds 1.52 for >30–100%), so the honest reading is "anything above ~10% carries roughly 1.5–2.3× the rate," not a clean dose-response. And the authors flag the rule's own failure mode: 10 km → 11 → 12.1 → 13.3 inside one week is three compliant 10% steps and is plainly excessive. **The rule does not compose across sessions**, which is why it needs a second constraint.

**Adopted:**
- **Primary:** no session exceeds **110% of the longest session in the previous 30 days**, in jogging minutes.
- **Composition constraint:** only **one new-longest session per week**.
- **Near-zero fix:** `min( max(1.10 × L, L + 1 min), L + 3 min, 30 min )`. At L = 8 min a pure 10% rule yields a 48-second increment — arithmetically degenerate and uninterpretable, giving absurdly small steps early (when tissue is least conditioned) and large ones late. The `+1 min` floor sits inside the 10–30% band that Nielsen 2014 found *not* significantly elevated. `weak` — this exact construction has never been tested and is labelled as a reasoned extension, not a finding.
- **The weekly cap survives as cheap secondary insurance only** (≤ +20% and ≤ +10 min absolute; Damsted 2019's reference category was <20%, not <10%). It never overrides the session cap and is never described to the athlete as evidence-based.

**30 minutes is a terminal ceiling, not a waypoint.** Pollock et al. 1977 — the only minutes-anchored dataset in previously untrained males (n=157, 20 weeks) — found injury incidence of 22% at 15 min/session, 24% at 30 min, and **54% at 45 min**; and by frequency, 12% at 3 days/week versus **39% at 5 days/week**. It is a 1977 study of an inmate cohort training at 85–90% of maximum, so the absolute rates are an upper bound — but it is the closest thing to on-point evidence that exists for this app's units and population, and nothing has superseded it. It independently corroborates A18's three-days-a-week finding from a completely different direction.

## A6c. Honest baseline: a perfectly executed return still carries real injury risk. `strong`

High-school cross-country: **17.0 injuries per 1,000 athlete-exposures** (boys 15.0). Adult novice runners: **10.9%** cumulative incidence over a 6-week supervised start-to-run programme (NLstart2run, n=1,696); **14.9%** pooled novice incidence across 4,720 runners. Rauh 2014: **15.9% of high-school cross-country runners sustained a time-loss injury in the first month** of the season (boys 13.2%).

**A well-run return for this athlete still carries roughly a 10–15% chance of a time-loss injury.** The app must not promise or imply otherwise, and NLstart2run identified "absence of previous running experience" as an independent risk factor the engine cannot modify.

## A7. Energy availability is the highest-certainty modifiable risk factor — and it is out of scope in the brief. `moderate-strong`

The *JOSPT* 2023 systematic review's highest certainty rating went to a factor the brief never mentions: **moderate certainty that RED-S risk factors increase running-related injury, particularly bone stress injury.** This is not a female-athlete concern being misapplied — REDs prevalence in male athletes is reported at 15–70%, and in a three-year longitudinal study of **adolescent male endurance athletes, 38% had low lumbar spine BMD (Z ≤ −1) at baseline**, with most either losing bone or failing to achieve expected pubertal mineral accrual.

The brief lists nutrition tracking as out of scope for v1, and full nutrition tracking should stay out. But an engine that meticulously governs volume while ignoring fuelling is optimizing the variable with the *weaker* evidence behind it.

**Amendment adopted (minimal, in keeping with the exception-only reporting model):** two additions, not a food diary — a one-time setup question about eating enough to cover training, and a low-frequency flag that fires when under-fuelling markers coincide with poor probe progress. Sleep gets the same treatment; adolescents sleeping <8 h/night show higher injury rates, and a military protocol that raised minimum sleep cut stress fractures from 31% to 11%.

## A8. Palpation has a blind spot at the highest-consequence site. `moderate`

In femoral neck stress fracture, "tenderness is rarely elicited, even with severe stress fractures." Presentation is insidious atraumatic groin or hip pain, worse at end-range hip motion; roughly 70% have a positive single-leg hop test. Missed diagnosis risks femoral head osteonecrosis.

**Amendment adopted:** groin/hip pain is its own red flag with mandatory referral, triggered by *location plus hop test* and explicitly **not** requiring tenderness on palpation. Added alongside it: a lumbar red flag (lumbar spine and pelvis account for 15.2% of high-school BSI).

## A9. "No injury history" is low information, not low risk. `moderate`

Prior running-related injury is one of the two strongest predictors in high-school cross-country (with sex; both non-modifiable). Given documented adolescent under-reporting and the absence of any athletic-trainer contact in this athlete's history, a clean report from him is weak evidence of a clean history.

**Implication:** the engine seeds `tolerance_class` at `conservative` until calibration proves otherwise, rather than at `standard`. The brief's day-7 assignment logic is retained; only the prior changes.

## A10. Graded running does not build tendon tolerance. It avoids exceeding a roughly fixed one. `moderate-strong`

This is the finding that most changes what the app has to *do*, as opposed to what it has to *refuse*.

The implicit model behind "progress running gradually so connective tissue can keep up" is that running is the connective-tissue training stimulus, just a slow one. For tendon, the evidence says it is not a stimulus at all:

- **Hansen et al. 2003, *J Appl Physiol* 95(6)** — eleven previously untrained adults ran habitually for **nine months** (~78 sessions, ~43 hours). VO2max rose 8.6% and submaximal oxygen cost fell 6.2%. **Achilles tendon displacement during maximal contraction was unchanged and tendon cross-sectional area was unchanged.** A within-subject dissociation: same people, same period, both systems measured, and running produced zero measurable tendon adaptation. `moderate` (n=11, adults, Achilles only — but it is the cleanest available test of exactly this question)
- **Bohm, Mersmann & Arampatzis 2015, *Sports Med Open*** — systematic review and meta-analysis, 27 studies / 264 participants. High-intensity loading (>70% MVC) raises tendon stiffness with SMD 0.90 (95% CI 0.71–1.08). **Low-intensity loading: SMD 0.04, CI −0.46 to 0.53 — statistically indistinguishable from zero.** `strong`
- **Bohm et al. 2024, *Sci Rep*** — Achilles strain during running reaches only 4.0–4.9%, and time above the ~4.5% adaptive threshold is **90 ± 40 ms per step**, against a requirement of roughly **3 seconds per repetition**. Submaximal running is explicitly insufficient as a tendon stimulus. `moderate`

**Mechanism:** tenocyte anabolic signalling is strain-magnitude *and* strain-duration gated. Running delivers a strong metabolic stimulus but delivers supra-threshold tendon strain for milliseconds per step, far below the sustained-strain requirement for mechanotransduction.

**Amendment adopted — a real addition to scope.** The brief allows "a basic calf/tibialis circuit" and lists strength programming beyond that as out of scope. That boundary is in the wrong place. The engine prescribes a **short tendon-directed loading circuit** — heavy isometric or heavy-slow calf/quad work, roughly 85–90% of maximum effort, ~3-second holds, three times a week, expecting 8–12 weeks to measurable effect. It stays deliberately minimal (one circuit, no periodization, no equipment assumptions) and it is the only place in the engine where "high intensity" is prescribed at all.

**Corollary, worth stating because it is counterintuitive:** the *aerobic* system will feel ready long before the skeleton is. The athlete's perceived readiness systematically overestimates his tissue readiness during exactly the weeks the engine is guarding. RPE is an aerobic signal and must never be permitted to drive volume progression during this window.

## A11. The at-risk tissue is tibial bone, not tendon — and bone *does* respond to running. `moderate-strong`

Medial tibial stress syndrome is the **most common injury in novice runners** (incidence 13.6–20.0%), followed by patellofemoral pain; median time to recovery for injured novice runners is ~10 weeks (Menéndez et al. 2020 systematic review; Nielsen et al. 2014, *PLoS One*, n=254 injured novice runners). Independently, NATION surveillance found **shin injuries had the highest new-injury rate of any body location** in high-school sport.

This does not weaken the connective-tissue framing — it re-aims it. The good news is that unlike tendon, **bone genuinely does adapt to running-type impact loading**, so for bone the "graded progression builds tolerance" model is valid. The engine's dose variable should be understood as **impact cycles**, not tendon strain.

**Design consequence:** the primary monitored tissue is the tibia; the pain rules in A2/A8 are already aimed correctly; and the strength circuit in A10 covers the tendon gap that running leaves open.

## A12. Bone mechanosensitivity saturates within a bout — so frequency beats duration. `strong` as mechanism, `weak` as prescription

Bone's adaptive response saturates after remarkably few load cycles (largely lost after ~20–40), and mechanosensitivity is **restored by inserted rest, with 4–8 hours between bouts optimal**. Splitting 360 daily loading cycles into 4×90 or 6×60 produced a greater osteogenic response than one continuous bout (Robling, Burr & Turner, *J Exp Biol* 2001; *MSSE* 2002).

**This is rodent work and cannot support a human number** — it is reported here for mechanism only, per the source hierarchy. But the mechanism is important enough to shape the program: **after the first few dozen impact cycles in a session, additional cycles contribute damage without contributing adaptive signal.**

That runs directly counter to a goal stated as "30 minutes *continuous*." It does not make the goal wrong — the tryout standard is what it is — but it means the engine should reach that standard by building **frequency and consistency first**, and treat the continuous 30 as a capability to be demonstrated rather than a dose to be repeated. It also independently corroborates A5's alternate-long-and-short-days rule from a completely different direction.

## A13. The talk-test margin is too small by a factor of about 2.5. `moderate`

The brief subtracts **0.4 mph** from the talk-test speed. Three independent routes say the margin should be **1.0 mph** (defensible band 0.8–1.2):

1. **The margin is smaller than the instrument's noise floor.** The talk test's minimal detectable change is 24.7–29.4 W in the only study that quantified it, which converts to roughly **0.9–1.0 mph** of treadmill running. A margin of 0.4 mph is inside the range where two calibration sessions in the same week would legitimately disagree. `moderate`
2. **The Foster lab's own prescription for sedentary individuals is one stage *below* the last positive stage.** From a first-change-in-breathing stop, that is two stages down ≈ 0.90 mph-equivalent. "Sedentary" is the closest published descriptor to "12 months detrained." `moderate`
3. **Error-budget arithmetic** (criterion drift, motivation, no observer, under-breath recitation) gives ~0.95 mph.

**Scale of the problem being guarded against:** in low-training-status males the VT1→VT2 band spans **8.7 → 12.3 km/h, i.e. 2.1–2.2 mph** (Benítez-Muñoz et al. 2025, *Eur J Appl Physiol*, n=791 males) — and the talk test's *negative* stage ("cannot speak comfortably") corresponds not to VT1 but to **VT2 / respiratory compensation**, replicated across three independent studies. Persinger et al. 2004 (*MSSE*, treadmill): negative stage 93 ± 6 %VO2peak versus ventilatory threshold at 77 ± 6 %VO2peak. A naive "can you still talk" administration lands **16 percentage points of VO2peak above VT1**. The brief's diagnosis of this problem was exactly right; its margin was not.

**Amendment adopted:** margin **1.0 mph**, expressed in mph rather than pace (a fixed mph subtraction is a constant metabolic subtraction; a fixed pace subtraction is not). Plus three structural additions:

- **A floor clamp.** 1.0 mph off a 4.6 mph result is 3.6 mph, which is a walk. When the calibrated ceiling falls below a plausible jog, the correct output is a **walk/run prescription**, not a running speed.
- **Calibrate twice, take the lower.** With a minimal detectable change near 0.9 mph, one session is not a measurement.
- **Enforce genuine vocalization.** Persinger's authors name this as the technique's single qualification: reciting silently or under the breath permits "a much higher intensity." In an unsupervised app used by a motivated teenager this is the largest failure mode in the whole calibration. The passage must be read **aloud at normal speaking volume**, with the same fixed wording every time (utterance rate demonstrably changes the answer).

**Nasal breathing — verdict: demoted from co-primary criterion to one-way cross-check.** `moderate` There is no validation of a nasal criterion against VT1 anywhere in the literature; the spontaneous nasal→oronasal switch has a between-subject SD of ~31%; and it is confounded by congestion, rhinitis and anatomy, which is unstable for a design that fixes a ceiling for weeks from one session. Worse, *forced* nasal-only breathing does not fail until 10–11 km/h (6.2–6.8 mph) — **above this athlete's entire easy range**, so a nasal-failure criterion would never bind at all. It is kept only as a safe one-way check: if he cannot comfortably nose-breathe at the prescribed ceiling, the ceiling comes down. That inference direction can only reduce speed.

**No talk-test validation exists in 13–18-year-olds.** The only pediatric data are prepubertal 8–12-year-olds, where it classified above-vs-below VT correctly 77% of the time *with a researcher present*. Expect worse unsupervised. The margin exists to absorb that; 0.4 mph could not.

## A14. Invariant 13 is strongly vindicated — and the 150 bpm cap survives for a better reason than assumed. `strong`

The brief's refusal to compute, test, or prescribe against a maximum heart rate is the best-supported decision in the entire document.

Cicone et al. 2019 (*Research Quarterly for Exercise and Sport*, systematic review and meta-analysis, n=648 children and adolescents, mean age 13.0): **"Age-based MHR equations derived from adult populations are not applicable to children."** The 220−age formula **overestimates by 12.4 ± 16.2 bpm** in youth; Tanaka underestimates by 2.7 ± 5.8. Heterogeneity I² = 94.6%. Measured maximum heart rate pooled to **198.3 ± 8.9 bpm**, corroborated by cohorts of n=433 (197 ± 8.6) and **n=6,557 at mean age 15.5 (196.1 ± 7.6)**. The **95% prediction interval for an individual 15-year-old is roughly 181–216 bpm**, and even bespoke youth-specific regressions achieve only R² = 0.29 with standard error ~8 bpm.

Any percentage-of-maximum zone model would therefore be building on ±17 bpm of irreducible uncertainty. `strong`

**ABSOLUTE_CAP = 150 bpm: kept.** It sits at ~76% of a typical 15-year-old male's maximum (individual range 69–83%), just above the expected first ventilatory threshold for a detrained adolescent (~138–148 bpm). But the stronger argument is different from the physiological one: the cap only ever binds when measured HR at talk-test speed exceeds 160 — and since the talk test *is* approximately VT1, a reading that high is itself evidence of **measurement error**, most likely cadence lock, whose output band is ~150–180 bpm. **The cap is best understood as an artifact guard sitting at the floor of the cadence-lock band**, which is close to ideal placement for the job it actually does. 145 would be marginally better on physiology alone, but that difference is inside the device's own ±5–8 bpm error — changing it would be false precision.

## A15. The cadence-lock rule as specified would delete most of the valid data. `moderate`

The brief discards HR samples where bpm equals cadence ±3 for more than 30 continuous seconds. The mechanism it is guarding against is real and well-understood: accelerometer-referenced artifact cancellation works by identifying the accelerometer's dominant spectral peak and suppressing the matching peak in the photoplethysmogram — and **when cadence frequency ≈ heart-rate frequency, the peak to suppress and the peak to preserve are the same peak.** The algorithm must choose, and because the motion component is often larger at the wrist, it commonly chooses cadence.

But for *this* athlete, bpm ≈ cadence is not the exception — it is the **expected state during a legitimate easy run**. His easy heart rate will sit around 140–155 bpm; a novice adolescent's cadence at jogging speed is roughly 150–170 steps per minute. The bands overlap almost completely. A rule that discards on coincidence alone would throw away most good sessions and blow through the 30%-discarded gate constantly, marking honest data unusable.

**Amendment adopted — the rule changes shape.** Coincidence *lowers a sample's confidence weight*; it does not by itself discard. A hard discard requires coincidence **plus** independent evidence of artifact:

- **The transition test (primary evidence).** Heart rate has a time constant of 20–30 seconds and physically cannot step; cadence changes within one or two strides. A jump greater than ~6 bpm within 10 seconds, coincident with a belt-speed change, is artifact — not physiology.
- **The variance test.** A locked signal is pathologically smooth. A rolling standard deviation under ~1 bpm across 60 seconds at stable cadence indicates the trace is tracking the treadmill, not the heart.
- Tolerance widened from ±3 to **±5 bpm**, and extended to **cadence/2** — the sub-harmonic lock is the dangerous omission, because it makes a too-hard run look easy.

**Two open risks a human should know about.** First, this entire rule presupposes the watch exposes per-sample cadence; that is unverified and, if false, the rule is unimplementable as written (fallback: transition and variance tests alone). Second, **cadence lock is quantified nowhere in the peer-reviewed literature** — prevalence, episode duration, and triggering combinations simply do not exist as published data. Every number above is an engineering estimate, which is why the discard gate ships in shadow mode: logged for several weeks before it is allowed to mark anything unusable.

## A16. The aerobic-drift threshold sits inside the device's noise floor. `moderate`

The brief flags a rise beyond ~8–10 bpm from the first 10 minutes to minutes 15–25 as evidence the pace was too fast. A budget wrist sensor's mean absolute error is **5–8 bpm**, with 95% limits of agreement of ±20–25 bpm. **The signal and the error are the same size** — that threshold measures noise.

Amendments, of which the last matters most:

- Thresholds raised and scaled by duration: **>12 bpm on a 20–25 minute run, >15 bpm on a 40 minute run**, compared **median-to-median across multi-minute windows** rather than point samples, so the error averages down.
- **The first 5 minutes of every session are excluded from all heart-rate statistics.** Cold-hand vasoconstriction collapses photoplethysmogram amplitude precisely then, and heart rate has not reached steady state.
- **Onset timing is the real discriminator, not magnitude.** Normal thermoregulatory drift is late-onset and gradual — in adolescent runners, decoupling onset came at a median of 10 km, roughly 35–45 minutes, with only 0.4% drift at 5–6 km. A pace above VT1 produces an *early* continuous rise beginning within the first 10 minutes, because the athlete never reached steady state at all. **A rise concentrated in minutes 5–15 means too fast; the same rise after minute 25 is normal.**
- Drift stays **advisory** — it can lower a ceiling, never raise one, and never moves the belt speed on its own.

## A17. One free hardware win worth more than any constant in this document. `strong`

Moving the sensor off the wrist bone reduces error by **50–60% during exercise** — graded-treadmill MAPE fell from 5.95% at the wrist to 1.89% on the forearm, with concordance rising from 0.89 to 0.997. The mechanism is prosaic: proximal sites have more soft-tissue padding, deeper vasculature, and less motion relative to the sensor, versus the wrist's tendons and bony prominences.

**The engine's setup instruction: wear the watch two to three finger-widths up the forearm, on the muscle, not on the wrist bone.** It costs nothing and it is a larger improvement than any tuning decision available elsewhere in the heart-rate pipeline.

## A18. Running 5–7 days a week has no support in any protocol found. This is the largest single divergence. `strong` that it is unsupported

The brief lists "5–7 days/week available" as an athlete fact, and the engine was to progress frequency first. **Every clinical and studied protocol located prescribes 2–4 running days per week with at least one non-running day between sessions** — with no exceptions:

| Protocol | Frequency |
|---|---|
| GRONORUN 1 (RCT, n=532) and GRONORUN 2 (RCT, n=432) | 3 sessions/week |
| Bertelsen 2018 (RCT) | 3 sessions/week, ≥1 day between |
| Ohio State Wexner clinic guideline | 2–3 days/week, ≥1 day off between |
| Oxford NHS OxSport (covers new runners explicitly) | every other day |
| CU Sports Medicine | every other day, "always separated by a rest day" |
| Tibial BSI return-to-run literature | 42% specify alternate-day running for the first 2–4 weeks |

A systematic review of 36 studies (n=23,047 runners; Fredette et al., *J Athletic Training* 2021) reports running 7 days/week associated with markedly increased injury risk versus 0–2 days/week — though the same review rates the overall frequency evidence as *conflicting*, so this rests on protocol unanimity plus mechanism rather than a clean dose-response. Youth-specific guidance (AAP Council on Sports Medicine and Fitness) caps at 5 days/week in one sport with at least one full rest day.

**Mechanism, and it is the strongest part of the argument:** tendon collagen synthesis peaks ~24 h after loading, but **degradation peaks earlier, so net collagen balance is negative for roughly the first 24–36 hours and positive only from ~36–72 h** (Miller et al., *J Physiol* 2005; Magnusson, Langberg & Kjaer, *Nat Rev Rheumatol* 2010). Running again inside 36 hours means loading a matrix that is still in net breakdown. Bone remodelling is slower still.

**Amendment adopted — a new invariant.** Three running days per week, on non-consecutive days, **minimum 48 hours between runs**. A fourth day may unlock from week 5 only if every prior session was clean; never a fifth. The athlete's extra availability is spent on the tendon circuit (A10), brisk walking, and cycling — real use of the time, no impact cost.

This also reframes the brief's progression order. "Frequency → duration → continuity → intensity" was written expecting frequency to climb toward daily. It cannot. Frequency is essentially fixed at three; the dimensions that actually progress are duration and continuity.

## A19. The seed prior is a 13-*week* RCT protocol relabelled as 13 *sessions*. `moderate` provenance, `strong` arithmetic

Seed sessions 4–6 prescribe **7 × (2 min jog / 1.5 min walk)**. GRONORUN's 13-week intervention arm, week 2, prescribes **2 min run / 1.5 min walk × 7**. That is an exact match on an unusual parameter — a 1.5-minute walk interval is not a common choice. Sessions 1–3 mirror GRONORUN week 1; sessions 7–8 mirror week 3; and the seed has 13 rows where GRONORUN has 13 weeks.

The provenance inference is strong but not documented. The arithmetic holds regardless: **at 5–7 sessions/week the seed compresses a 13-week protocol into under two weeks.** The individual session structures are well chosen *because* they came from a level-1 RCT. The failure is entirely in the time axis.

**Where published protocols actually land, zero to 30 minutes continuous:** 9–15 sessions for supervised clinic protocols (post-injury patients with residual fitness and a physiotherapist adjudicating each step), and **19–33 sessions across 4.5–13 weeks** for the unsupervised-novice RCT arms — which is this athlete's situation.

**Amendment adopted — replacement seed ladder.** 24 sessions across 8 weeks at 3 runs/week, compressible to ~16–18 sessions / 6 weeks when every session at a level is completed clean. Starting dose stays at the brief's 8 jog minutes, which is *more* conservative than GRONORUN week 1 (10 min) and OxSport week 1 (15 min) and is consistent with the one randomized signal favouring a low starting volume (Bertelsen 2018: 3 km/wk vs 6 km/wk, per-protocol injury difference −31.2%). The brief's two worst steps are smoothed: 8→14 jog minutes (+75%) becomes 8→10 (+25%), and 18→25 (+39%) becomes 15→18 (+20%). **A 20-minute continuous bout is inserted before the 30-minute test** — otherwise the first 20-minute continuous run he ever performs happens *during* the graded test itself. The brief's session 11–12 design, which trades total volume down (25→24) for bout length up (5→12), is good and is preserved in the new ladder.

**Also adopted, all absent from the brief:**
- **An entry gate before session 1:** pain-free brisk walking for 30 continuous minutes with normal gait. This is the single most consistent prerequisite across every clinic protocol found.
- **A hold rule:** 2–3 sessions per level before advancing, with all prescribed jog minutes completed.
- **A regression rule:** fail a level → repeat it; fail twice → step back one level. The brief's ladder only moves forward.
- **An intensity anchor at every level** (the brief has this; it is worth noting the literature agrees — Bertelsen anchored to a talk test, the BSI literature to 30–50% of usual pace).

## A20. Most injuries in this exact population never cause a missed session. `strong`

In 681 high-school cross-country athletes (mean age 15.2–15.4, 104 clinical sites, 22 states, 2009–2019), **69.3% of injuries produced no time loss.** Injury incidence was 15.0 per 1,000 athlete-exposures in boys; the commonest sites were knee (21.4%), ankle (20.4%) and calf (17.5%).

This is the best demographic match in the entire research pass — same age, same sex, same sport — and it says the injuries that matter mostly present as grumbling, sub-threshold complaints that never stop a session. An engine whose reporting model is exception-only must therefore be tuned to catch things the athlete would not think worth mentioning, which is exactly why the pain questions are binary and behaviour-anchored rather than "was it bad enough to stop?"

## A21. Honest framing: a gradual ladder builds capacity. It is not proven to prevent injury. `strong`

Buist et al. 2008 tested precisely this, head to head, in 532 novice runners with the same 12-months-detrained entry criterion as this athlete: a 13-week graded programme versus a standard 8-week programme. **Injury rates were 20.8% and 20.3% (p = 0.90).** GRONORUN 2 similarly found that a four-week walking-and-hopping preconditioning block before running did not reduce injuries (15.2% vs 16.8%, p = 0.69).

**The app must not claim that gradualness prevents injury**, in its copy or in its rationale sentences. What the evidence supports is a weaker and still worthwhile claim: a graduated ladder is the studied way to *build capacity* to 30 minutes, it keeps progression below the empirically flagged >30%-per-2-weeks threshold, and it creates the symptom-monitoring structure that catches problems early. That is what the narrative layer is allowed to say.

## A22. "Treadmill capacity overstates road capacity" is not supported as stated — and is backwards for the Achilles. `moderate`

The brief's §12 rationale for the road-transition modifier was belt-assisted push-off and lower impact. Both parts are wrong.

**Belt-assisted push-off is a myth.** With a constant belt speed, treadmill and overground running are mechanically equivalent and require equal propulsion (van Ingen Schenau, *MSSE* 1980; endorsed in Van Hooren et al. 2020). Overground the runner translates over a stationary foot; on a belt the foot translates beneath a stationary runner. **These are the same relative motion in two inertial frames.** The intuition mistakes a change of reference frame for a change of physics. `strong`

**Impact load is not lower — the evidence is tissue-specific and internally contradictory:**

| Measure | Treadmill vs overground | Source |
|---|---|---|
| Peak vertical GRF | **No difference** (−0.05 BW, CI −0.11 to 0.01) | Van Hooren 2020, SR/MA, 33 studies, n=494 |
| Loading rate, tibial acceleration | **No difference** | same |
| Achilles tendon peak force | **+12.5% HIGHER on treadmill** (p<.001) | Willy 2016, *JOSPT* 46(8) |
| Achilles loading rate | **+15.6% HIGHER** (p<.001) | same |
| Tibial load (pooled) | Lower on treadmill, SMD −0.83 (CI −1.53, −0.12) | Keast 2022, *Sports Med*, SR/MA |
| Field wearable kinetics (n=71) | **HIGHER on treadmill**, 0.17–1.30 g | DeJong Lempke 2024, *J Biomech* |

Two systematic reviews disagree on tibial load, and the field-wearable authors state the opposite of the brief's hypothesis as their explicit clinical recommendation.

**Nor does surface compliance help.** Treadmill decks absorb 64% of shock versus under 2% for asphalt — but runners re-tune leg stiffness across a 25-fold surface-stiffness range **within a single step**, preserving centre-of-mass displacement, contact time and peak force (Ferris 1999; Kerdok 2002). Compliance *relocates* load into the athlete's own muscle-tendon units; it does not remove it.

**Amendment adopted.** The road-transition modifier is **kept but re-based and restructured**:
- Its justification in code is no longer "treadmill under-loads." It is that Aug 10 stacks **five or six simultaneous novel stressors within 48 hours** — surface, footwear, volume, intensity, pace control, and social context — and that at *slow* speeds treadmill HR and RPE run **lower** than overground at matched speed (Miller 2019, SR/MA of 34 studies), so the same minutes outdoors are a genuinely higher internal load.
- **Duration:** −20% for the first four outdoor sessions, then −10% for two more. Extended from three, because three sessions is far shorter than any plausible tissue timescale. Labelled precautionary — **no study has ever measured this transition in either direction.**
- **An intensity cap is added, and matters more than the duration cut.** The escalation risk on Aug 10 is pace, not minutes: perceived speed is distorted without optic flow, and team practice removes external pace control.
- **Weekly volume is held flat across the changeover week.**
- **No separate surface-hardness penalty is stacked on top** — that would double-count a factor with no supporting evidence.

## A23. The treadmill incline should be 0.5%, not 1% — and it barely matters. `moderate`

The 1% convention comes from Jones & Doust 1996, whose **slowest tested speed was 2.92 m/s — 9:11 min/mile.** This athlete's entire range (4.5–6.0 mph, 2.01–2.68 m/s) sits *below the bottom of the validated band*, in the direction where the authors themselves found the correction already statistically indistinguishable from zero.

The correction compensates for air resistance, and drag scales with v², so required grade ∝ v². Anchored to Jones & Doust's own exact-match datum at 3.75 m/s, `G(v) = 1% × (v/3.75)²` retrodicts all five of their speeds correctly and gives **0.29% at 4.5 mph rising to 0.51% at 6.0 mph.** A cross-check against Pugh's drag coefficient agrees.

**Adopted: 0.5%, or 0% on a treadmill without half-percent increments.** But the honest note for whoever maintains this: the entire 0%-to-1% span is worth **under 4% of metabolic cost** at these speeds, which is below the noise floor of a minutes-based load model. It is not exposed as a tunable and is not worth engineering effort. The reason to prefer the low end is secondary and mechanism-only: incline raises plantarflexor demand, and the treadmill already over-loads the Achilles (A22) in an athlete whose tendon is the age-specific weak link.

## A24. Footwear gets no numeric multiplier — the brief over-weighted it. `moderate`

**No study anywhere examines running injury in people running in non-running footwear.** The brief's footwear modifiers (impact budget × 0.7, no session over 25 min) are mechanism-only inference.

Three things argue the real risk is small: his pace sits below the speeds at which footwear kinetics were measured, and **speed dominates tibial shock over cushioning by η² = 0.80 versus 0.39** (Lam 2018); the exposure is two weeks; and footwear RCTs move injury hazard only ~0.5–1.8× over six months at far higher volumes.

One caution is real: a **light runner in a hard-soled shoe** carried SHR 1.80 (95% CI 1.09–2.98) in an 848-runner RCT — and a 15-year-old is well under that trial's 78 kg median split. So the variable that matters is not "running shoe versus not" but **cushioned versus hard-soled skate/court.**

**Amendment adopted:** the footwear multiplier is replaced with (a) a setup instruction to use the most cushioned, lightest shoes available, (b) a symptom flag on foot, shin and calf discomfort rather than a volume penalty, and (c) **shin monitored specifically** — it has the highest new-injury rate of any location in high-school cross-country.

**New shoes on Aug 8 need no modifier if they are conventional trainers.** No break-in evidence exists; 1,773 runners across three RCTs entered novel shoes with no run-in and no early injury spike. **The exception is real and gets a substantial modifier:** minimalist, zero-or-low-drop, or carbon-plated shoes — 10 of 19 runners transitioning to minimalist footwear developed **bone marrow oedema on MRI within 10 weeks** (p = 0.009), subclinically. **The best action is to gate the purchase, not the transition:** choose a conventional cushioned trainer on comfort and fit, **not arch type** — arch-matching is the most decisively falsified heuristic in the footwear literature, and it is the one adolescents actually use (73% of surveyed adolescent cross-country runners ranked it first; only 57% knew their own arch type).

## A25. Heat will trigger the drift detector on its own, so the detector must be gated by environment. `moderate`

This is the sharpest interaction the research pass found between two of the brief's own rules.

At 35 °C, heart rate rose **11% from minute 15 to 45** at a constant work rate, versus **2% at 22 °C** (Lafrenz & Wingo, *MSSE* 2008, randomised crossover). **At a working heart rate of 150, an 11% rise is about 16 bpm — comfortably above the brief's 8–10 bpm "the pace was too hard" threshold, and above even the raised threshold in A16.** A second study independently observed 12 bpm of drift over 43 minutes at 35 °C with effort held constant.

The detector cannot separate the two causes from the signal, because heart rate *is* the summed output of metabolic and thermoregulatory demand — it was the single strongest predictor of thermal strain during self-paced running in heat (β = 0.462, ahead of WBGT at 0.327).

**Amendment adopted: gate, do not correct.** The drift verdict is computed **only** on sessions inside a reference thermal band, and outside it the "pace was too hard" conclusion is **suppressed entirely** rather than adjusted by an uncertain coefficient, with a note that no pacing conclusion was drawn. A suppressed rule generates no notification, which fits the exception-only model exactly. Two supporting rules: a drift flag must **recur across two qualifying sessions** before it moves a ceiling, and the easy-HR ceiling is only valid in the thermal environment where it was calibrated — an unfanned indoor calibration runs biased upward and must be re-derived at the outdoor transition.

**Michigan August, computed from NOAA hourly observations for Detroit, Lansing and Grand Rapids, 2010–2025:** on roughly **74% of August afternoons** an unfit, unacclimatized youth is in an ACSM band calling for reduced intensity *and* duration; about **19% reach the "cancel practice" band**. At 7–9 a.m. those figures are **22% and 0%**. Michigan's own MHSAA heat-index policy triggers on about **5%** of afternoons and reaches its stop tier on essentially none — it is a cancellation-grade emergency policy, not a training-load tool.

**Adopted:** any session the engine schedules itself in August is a **morning** session. That single rule removes most of the problem, and the engine has no authority over team practice anyway.

## A26. Two heat findings that change the plan rather than a threshold. `strong` / `moderate`

**The indoor treadmill needs a fan, and this is not a minor comfort note.** Cycling to exhaustion at 30 °C: **41 minutes with no airflow versus 58 minutes at 10 km/h of airflow** — a 41% difference, with higher core temperature, skin temperature, heart rate and RPE in still air (Otani 2018). Still air nearly halves the environment's maximum evaporative capacity (160 vs 298 W·m⁻²). An easy run outdoors at 10–11 km/h generates about 10 km/h of relative airflow; indoors it generates none. The benefit plateaus above ~16 km/h, so an ordinary household fan captures nearly all of it, and cooling must be **in place from the start** — applying it after drift develops does not reverse the decrement. A non-air-conditioned indoor space at 30–33 °C ambient measured **WBGT 28–30 °C in 17-year-old athletes** — the ACSM "cancel" band. An indoor space is not automatically a safe space. `strong`

**Adopted:** a one-time setup instruction — *point a fan at yourself before you start the treadmill* — shown once and never repeated, which is compatible with exception-only reporting.

**A 15-year-old is not more heat-vulnerable than an adult.** The AAP formally reversed its earlier position (2011 statement, reaffirmed March 2025): youth do not have less effective thermoregulation when hydration is adequate. The best single study — 68 children aged 10–16 plus 24 adults, treadmill, 30 °C and 40 °C — found **no effect of age on core temperature (p ≥ 0.176)**, with the one exception running the opposite way (adults got hotter). His elevated risk is entirely **detraining and lack of acclimatization**, which is a *more* conservative ACSM column than "youth" would have been. `strong`

**The most valuable thing this finding unlocks:** heat acclimatization is driven by exercise-heat *exposure*, not by aerobic fitness (Ravanelli 2021 — fit and unfit did not differ at matched heat production, but eight weeks of training improved the same people). **So the indoor treadmill block confers fitness but essentially no heat adaptation**, and he would arrive on Aug 10 fully unacclimatized, in the month when 60% of US high-school heat illness occurs. Adaptation is front-loaded — 75–80% of it lands in the first 4–7 exposures. **Adopted: convert part of the pre-Aug-10 prescribed minutes to short, easy, early-morning outdoor sessions.** Active 14.6-year-olds achieved measurable adaptation at a daytime WBGT of only 21.2 °C, which Michigan mornings supply comfortably. Note also, for the human reviewer: **Aug 10 to Aug 19 is nine days, so the recommended 14-day acclimatization period will still be incomplete at the first meet.**

---

# PART II — Findings by question

## Q4 & Q10 — Adolescent specificity and bone stress injury

### Skeletal maturity at 15

| | |
|---|---|
| **Claim** | Distal tibial physis closes ~15–17 y in males. Calcaneal apophysis: fused in 78% of 14–15-year-olds, 88% of 15–18, ~98% by 19. Tibial tubercle: bony union in boys ~11–17 y. Individual variation of ±2–3 years is normal. |
| **Source** | Radiographic/MRI fusion series (Crowder & Austin; *Skeletal Radiology* MRI series 2016); StatPearls. Cross-sectional imaging. |
| **Population** | Contemporary male adolescents, n tens to low hundreds per series. |
| **Transfer** | Direct — normative developmental anatomy, not a prescription. |
| **Mechanism** | Secondary ossification centres fuse progressively; until fusion the cartilaginous interface is mechanically distinct from adjacent bone. |
| **Confidence** | `strong` for general timing; `moderate` for this individual. **His fusion status is unknowable without imaging — assume at least one site is open or recently fused.** |

The apophysis is the mechanical weak link before fusion: the cartilage interface is described as 2–5× weaker than surrounding fibrous structures, so the same tensile load that fails at the myotendinous junction in an adult fails at the growth plate in an adolescent (Caine, DiFiori & Maffulli, *BJSM* 2006). `moderate` — the multiplier is a secondary citation not traced to a primary biomechanical study. **This is the strongest available support for the brief's "connective tissue is the limiter" hypothesis, with one correction: it points at the cartilage/bone interface, not at tendon.**

Peak height velocity in males averages ~13.5 y (recent cohorts 12.8 y), ±2SD roughly 11–15 y. At PHV adolescents have ~90% of adult stature but only ~57% of adult bone mineral content, with a transient rise in cortical porosity **particularly detectable in males** (Weaver et al., *Osteoporos Int* 2016, systematic review). At 15 he is *probably* past peak vulnerability — but a late maturer at 15 is squarely inside it, and there is no way to tell from the information available. `moderate-strong` mechanism, `weak` for placing this athlete.

Injury risk around PHV: 1.41 vs 0.81 traumatic injuries/player/year, days lost 15.69 vs 7.27 (van der Sluis, talented pubertal soccer). A 2025 systematic review (Pakarinen, *Health Science Reports*) graded the evidence **very low certainty**. Wrong sport, and the outcome that moved was traumatic rather than bone-stress injury. `weak` — direction only, no magnitude imported.

### Apophysitis

**Sever's (calcaneal):** typical range boys 8–15 y, peak 10–12. A 10-year German youth soccer academy series (n=612 players, 4,326 injury cases) found mean age at diagnosis 11.8 ± 2.1 y, incidence 0.36/100 athletes/year, mean time loss 60.7 days (recurrent cases: **181 days**). Cases **clustered at the start of season and after winter break** — a pattern that transfers directly to a 12-month-detrained athlete resuming. A 15-year-old male is at the far tail of the risk window: low prior probability, not zero. `moderate`

**Osgood-Schlatter:** onset with the growth spurt, males 10–15 y, union 11–17 y. Prevalence 9.8% at ages 12–15 (11.4% male); **21% in sports-active adolescents vs 4.5% in sedentary**. Reduced quadriceps and gastrocnemius flexibility are predictive in adolescent males. Distance running is lower-risk than jumping sports, but a novice with poor flexibility running 5–7 d/week is a plausible case. `strong` for age range and prevalence, `moderate` for running-specific risk.

### MTSS and the palpation geometry rule

High-school cross-country MTSS rate 2.8/1000 athlete-exposures (boys 1.7, girls 4.3; Bennett, *JOSPT* 2007). A separate 3-year prospective cohort of 230 HS runners (baseline age 15) reported MTSS 0.29 and tibial stress fracture 0.06 per 1000 AE, with **limited straight-leg raise significantly increasing stress fracture risk in males (aOR 1.38, 95% CI 1.04–1.83)** — one of very few male-specific findings. Meta-analytic risk factors include **fewer years of running experience**, which is this athlete's defining feature. The two incidence figures differ ~10-fold because injury definitions differ; they are not averaged. `moderate`

**The single most operationalizable discriminator in the entire literature:**

| | MTSS / muscular | Bone stress injury |
|---|---|---|
| Tenderness | **Diffuse, >5 cm** along posteromedial tibial border | **Focal, <5 cm** point tenderness |

Both are treated as points on one continuum, with MTSS potentially progressing to stress fracture if unmanaged. `moderate` — widely taught and internally consistent; no study reporting sensitivity/specificity for the 5 cm cutoff was located. Note this is a **location and extent rule, not a severity rule**, which is precisely why it is usable given A2.

### BSI epidemiology

Adolescent BSI incidence 3.9–19%, recurrence up to 21%; the **15–19 age band accounts for 42.6% of cases**. In HS cross-country, overall injury rate 13.1/1000 AE (boys 10.9), cumulative seasonal incidence 26–48% for boys. NATION surveillance 2014–19: **shin injuries had the highest new-injury rate of any body location, 1.9/1000 AE.** `moderate`

Distribution: 77% of stress fractures in athletes <20 y are lower extremity — leg 40.3%, foot 34.9%, lumbar spine/pelvis 15.2%. Tibia plus metatarsal accounts for 50.5% of BSI in runners under 20; the posteromedial tibial diaphysis is the most common region. `moderate-strong`

**High-risk sites** (delayed union, non-union, progression to complete fracture; watershed perfusion and/or maximal tensile load): anterior tibial cortex, superior femoral neck, medial malleolus, talus, tarsal navicular, proximal 5th metatarsal, pelvis, hallux sesamoids, patella, pars interarticularis. **Low-risk:** posteromedial tibia, fibula, 2nd–4th metatarsal shafts, pubic ramus, sacrum. (Warden, Davis & Fredericson, *JOSPT* 2014.) `strong`

### Warning signs a non-expert can self-report

This is the operational core, and it is why the engine's questions are binary rather than numeric.

- **Bone pain does not warm up; muscle pain does.** BSI pain "does not tend to resolve or 'warm up' as the run continues, and only abates once running has ceased"; it is progressive across the run, and over weeks begins earlier in each successive run — the crescendo pattern. `moderate` for the pattern; `weak` that a 15-year-old volunteers it unprompted. **Operationalization: never "how bad is it?"; instead "did it hurt more at minute 20 than at minute 5?"**
- **Single-leg hop test:** "strongly correlated with functional progression, and the most sensitive test for predicting return to unrestricted pain-free activity" for tibial BSI; ~70% of femoral stress fractures produce a positive hop. Self-administrable, no equipment. `moderate`
- **Focal bony point tenderness:** "palpatory bony tenderness is the most significant examination finding." Self-administrable — he can press along his own shin with one fingertip. `moderate`
- **Night pain / rest pain is a LATE sign, not an early one.** Sequence: pain after activity → pain during activity → pain in daily living → pain at rest. An engine that waits for night pain has already failed. `moderate` for the sequence, `lore` for it being a formally validated staging system.

**Counter-evidence, reported for honesty:** in the *rehabilitation* literature, an RCT and a large case series found that persistent localised tibial tenderness did not impede initiation or completion of a functional running progression. That is a post-diagnosis, clinician-supervised context — the opposite of this app's — but it means palpation tenderness is not a perfect gate and the engine should not claim it is.

### Pain thresholds — provenance

| Threshold | Provenance | Confidence |
|---|---|---|
| **≤5/10 during activity, back to baseline next day** | Silbernagel et al., *AJSM* 2007 — the only RCT-validated pain-monitoring model. Adults, Achilles tendinopathy, n≈38. Continuing to run under this model caused no negative effects. | `strong` **for tendon in adults**; `weak` as a basis for any bone rule |
| **Pain-free loading** | Warden *JOSPT* 2014; tibial-BSI RTR scoping review 2024 (50 studies; 39 were reviews/commentaries — level IV) | `moderate` for the principle, `weak` for implementation detail |
| **≤2/10, resolves in 24 h** | The three-checkpoint *structure* (during / later that day / next morning) traces to Silbernagel. **The number 2, the traffic-light scheme, and the "24-hour rule for runners" appear only in clinic blogs and physio handouts — the rejected source class. No peer-reviewed source validates 2/10.** | **`lore`** for the number; `strong` for the temporal structure |

The brief's ≥3/10 threshold is therefore no less evidence-based than the widely-repeated 2/10, and is less likely to fire on ordinary DOMS. Retained, labelled `LORE`.

### Youth training-load guidance — the evidence is essentially empty

> "Mileage recommendations cannot be made for runners under age 15… most of the available guidelines for youth distance running are based on expert opinion and not scientific evidence."
> — *Youth Distance Running and Lower Extremity Injury: A Systematic Review*, 2021 (PMC8306621) — 9 articles from 258 full texts screened; **7 of the 9 were case reports or case series**

Existing recommendations conflict with each other (IAAF, Australian SMF, AAP). Position statements from IOC 2015 (Bergeron et al., *BJSM*), AAP (Brenner 2016; 2023 overuse report) and NATA are institutionally authoritative and worth citing, but their numbers — ≥2 rest days/week, weekly sport hours ≤ athlete's age, ≥3 non-consecutive months off per year — are consensus, not dose-response data. `strong` that the evidence base is absent; `weak`/`lore` for every specific number in it.

AAP is worth quoting on mechanism, since it states the brief's core premise as institutional position: **"growing bones in children are less tolerant of stress than those of adults and may be more susceptible to stress injuries."**

One positive intervention with an effect size attached: a meta-analysis reported that a **10% increase in strength-training volume reduced overuse injury risk by ~4%**, and jumping/multi-joint impact exercise over 9–15 months produces favourable BMD change. `moderate` — supports keeping the calf/tibialis circuit the brief allows, and arguably expanding it slightly.

### Treadmill

Level treadmill running shows moderate-to-high validity versus overground for vertical ground reaction force; graded running diverges more. **Treadmill-primary is not an independent risk elevation for level running** — but the treadmill silently removes the day-to-day surface variation that Rauh's data associate with lower risk. That variation should be reintroduced deliberately through duration and pace (see A5), not by rushing him outdoors. `moderate` (full treatment in the treadmill-vs-overground section, pending.)

---

*Sections for the remaining seven question groups land as those threads report.*
