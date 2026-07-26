# Return to Run

A training app for one athlete: a 15-year-old male returning to running after roughly twelve months off, aiming at high-school cross country.

He reads today's session, runs it, and taps **Done**, or says what went wrong. There is no daily check-in, no streak, and nothing to optimise against. All the scheduling is deterministic and unit-tested; an append-only event log is the source of truth and every number is recomputed from it on read.

---

## Read this first

**The stated goal, 30 minutes continuous running by Aug 10, 2026, from a standing start on Jul 26, is not achievable within any progression the evidence supports.** Three independent research threads flagged it separately during Stage 0:

- In 421 high-school cross-country runners, **running ≤8 weeks over the summer nearly tripled the odds of injury in the first month of the season** (OR 2.7, 95% CI 1.2–5.8). He will have two to three weeks.
- Published protocols take **19–33 sessions across 4.5–13 weeks** to reach 30 minutes continuous in unsupervised novices.
- The bone-stress vulnerability window opens around week 3 and peaks in weeks 5–8, which, counting from an early-August start, lands directly on the competitive season.

The engine does not try to close that gap. It produces the safest progression it can and reports honestly where he actually is on Aug 10, because a tryout standard he is not ready for is information he and his coach need in advance, not a number to chase. See [`RESEARCH.md`](RESEARCH.md) §A1.

**And the honest framing the app itself uses:** a graduated ladder builds *capacity*. It is **not** proven to prevent injury. That was tested head-to-head in 532 novice runners with his exact detraining criterion and found nothing (20.8% vs 20.3%, p=0.90). A well-run return still carries roughly a 10–15% chance of a time-loss injury. The app says so, on the setup screen, in those words.

---

## Setup

Two steps, and only the first needs you.

**1. Create the mirror tables.** Open the Supabase SQL editor and run [`supabase/migration-001-event-log.sql`](supabase/migration-001-event-log.sql). Until you do, the app runs local-only. Everything works, but the log lives on one phone and the sync badge says so out loud.

Then verify the append-only guard actually took, by running the three statements in the comment at the bottom of that file. The `update` and `delete` must both fail with `rtr tables are append-only`. If either succeeds, the safety model is not what this app assumes.

**2. Hand him the URL and the access code.** He types the code once, then adds the page to his home screen. Same code on your phone shows the same log.

## Development

```bash
npm install && npm test
```

```bash
npm run dev
```

In dev only, `?date=YYYY-MM-DD` overrides today, so you can look at any day's prescription without waiting for it. It is stripped from production builds. The engine takes `today` as a parameter precisely so that costs nothing.

## How it is put together

```
src/engine/   pure domain logic. No Date, no browser APIs, no imports from lib/
src/config/   every research-derived number, each with a cited evidence entry
src/lib/      storage, sync, clock, narrative, everything that touches the world
src/components/  one screen
```

The engine is pure by construction and the boundary is enforced mechanically. `noBannedConcepts.static.test.ts` reads the shipped source and fails if `src/engine` or `src/config` references a clock, browser storage, or a browser global, and it fails if anything anywhere computes a maximum heart rate. That last one is invariant 13 implemented as a grep, because a rule that lives only in a design document gets violated the first time somebody needs a percentage.

Calendar arithmetic uses Hinnant civil↔day-number conversion rather than `Date`, so the ban has no exceptions to reason about.

**State is never stored.** `computeState(events, today)` folds the whole log every time. Interrupts, silence decay and ceiling changes are *derivations*, not commands, so no code path can forget to apply one or apply it twice, which is the only way "mechanical, not advisory" survives contact with a motivated teenager. The fold is order-independent (proven by test, under shuffling and duplicate delivery), which is what lets two devices sync by plain set union with no conflict resolution at all.

## What the evidence changed

Stage 0 ran eight parallel literature reviews before any engine code was written. Several findings contradicted the original brief; each was logged as an explicit amendment rather than quietly implemented. The full reconciliation is in [`DECISIONS.md`](DECISIONS.md). The load-bearing ones:

| | Original | Now |
|---|---|---|
| Load guardrail | ACWR clamped 0.8–1.3 | **Removed entirely.** Its source figure is under a retraction request, the association ran *backwards* in both prospective running cohorts, its one adolescent RCT was null, and a 0.8 lower bound would have told a detrained 15-year-old to train *more*. Replaced by a per-session cap against the 30-day longest. |
| Frequency | 5–7 days/week | **3 days/week, 48 hours apart.** No located protocol runs a novice more often; tendon collagen balance is net-negative for the first 24–36 hours after a run. |
| Talk-test margin | −0.4 mph | **−1.0 mph.** The original was smaller than the instrument's own minimal detectable change. |
| Seed ladder | 13 sessions | **9 criterion-gated levels over ~8 weeks.** The original was GRONORUN's 13-*week* RCT protocol with weeks relabelled as sessions. |
| Pain response | 3 rest days | **Bony sites exit on symptom resolution, never a countdown**, and escalate to referral. A fixed timer manufactures a false "cleared" state. |
| Missing entirely | none | Alternate long and short days (OR 3.0, better support than any volume rule in the brief), a tendon-loading circuit (running is not a tendon stimulus), and environment-gated drift detection (heat alone would trip it). |

Every number in [`src/config/tunables.ts`](src/config/tunables.ts) carries a machine-checked evidence entry rating it `strong` / `moderate` / `weak` / `lore` with its source. A value cannot enter the engine without one, and `lore` values are kept where they are conservative. They are labelled, not deleted, so nobody later mistakes convention for evidence.

## Tests

151 of them. Thirteen invariants, the eighteen cases named in the brief (four asserting amended behaviour, with the original stated alongside), fold determinism under shuffling, a twelve-week day-by-day replay that checks the rails on every single day with and without a heart-rate device, and property tests over randomly generated logs.

```bash
npm test
```
