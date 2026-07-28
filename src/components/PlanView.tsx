// The whole arc, behind one tap.
//
// Shows where he is, what the rungs are, and roughly when the goal lands. The
// projected date is the honest part and the reason this screen exists: the
// plan is aimed at a date it very likely cannot reach, and a number that moves
// as he actually trains is a far better way to learn that than a promise made
// in week one.
//
// No streaks, no totals, no badges. Every forward-looking number is labelled
// as an estimate that will move.

import type { FoldResult } from '../engine/fold.ts'
import type { Prescription } from '../engine/types.ts'
import { LADDER_SUMMARY } from '../engine/plan.ts'
import { coachMessage } from '../lib/narrative.ts'
import { Setup } from './Setup.tsx'
import type { FootwearState, Surface } from '../engine/types.ts'
import { addDays, mondayOf, type LocalDate } from '../engine/dates.ts'
import { PLAN } from '../config/tunables.ts'

const PHASE_LABEL: Record<string, string> = {
  P0: 'Finding your speed',
  P1: 'Building continuity',
  P2: 'Continuous running',
  P3: 'Team practice',
  P4: 'In season',
}

export function PlanView({ state, week, onClose, onProfile }: {
  state: FoldResult
  week: (Prescription | null)[]
  onClose: () => void
  onProfile: (p: { footwearState?: FootwearState; surface?: Surface; hrDevicePresent?: boolean }) => void
}) {
  const monday = mondayOf(state.today)
  const probes = state.timeline.ordered.filter((d) => d.probe).slice(-10)
  const { projection, plan } = state

  return (
    <div className="fixed inset-0 z-20 overflow-y-auto bg-stone-950">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-stone-800 bg-stone-950 px-5 py-4">
        <h2 className="label !text-stone-300">The plan</h2>
        <button onClick={onClose} className="px-2 py-1 text-sm text-stone-500">Close</button>
      </header>

      <div className="space-y-9 px-5 py-6">
        {plan.needsNewPlan && (
          <section className="rounded-xl border border-ceiling/40 bg-ceiling/5 p-4">
            <div className="label !text-ceiling">time for a new block</div>
            <p className="mt-2 text-[0.95rem] leading-relaxed text-stone-300">
              {plan.reason}. The app will keep giving safe sessions, but it is repeating
              itself now rather than building. Ask for the next block.
            </p>
          </section>
        )}

        <section>
          <div className="label">where you are</div>
          <div className="mt-1.5 text-xl font-semibold">{PHASE_LABEL[state.phase] ?? state.phase}</div>
          <div className="mt-1 text-sm text-stone-500">
            Week {state.weekNumber}
            {state.isDownWeek && ' · down week, on purpose'}
          </div>
        </section>

        {/* The honest headline. It moves every time he trains, which is the point. */}
        <section>
          <div className="label">30 minutes continuous</div>
          {projection.goalDate === null ? (
            <div className="mt-2 text-stone-400">Not yet estimable.</div>
          ) : (
            <>
              <div className="numeral mt-2 text-4xl text-stone-100">
                {plan.reachedGoalAt ? 'Done' : formatDate(projection.goalDate)}
              </div>
              {!plan.reachedGoalAt && (
                <p className="mt-2 text-sm leading-relaxed text-stone-500">
                  Estimate only, and only if every session between now and then goes clean.
                  Most do not. It moves as you train.
                </p>
              )}
              {projection.missesTargetBy !== null && !plan.reachedGoalAt && (
                <p className="mt-3 rounded-xl border border-stone-800 bg-stone-900/60 p-3.5 text-sm leading-relaxed text-stone-300">
                  That is <strong className="text-ceiling">{projection.missesTargetBy} days</strong> after
                  the {formatDate(PLAN.TARGET_DATE)} tryout. Building faster is what causes the injury
                  this plan exists to avoid, so the plan does not chase the date. Worth telling
                  the coach early rather than on the day.
                </p>
              )}
            </>
          )}
        </section>

        <section>
          <div className="label">the rungs</div>
          <ol className="mt-3 space-y-0">
            {LADDER_SUMMARY.map((rung) => {
              const done = rung.level < state.level
              const current = rung.level === state.level
              return (
                <li
                  key={rung.level}
                  className={`flex items-baseline gap-3 border-b border-stone-900 py-2.5 ${
                    current ? 'text-stone-100' : done ? 'text-stone-500' : 'text-stone-600'
                  }`}
                >
                  <span className={`numeral w-5 shrink-0 text-sm ${current ? 'text-ceiling' : ''}`}>
                    {done ? '✓' : rung.level}
                  </span>
                  <span className="flex-1 text-[0.98rem]">{rung.label}</span>
                  <span className="numeral shrink-0 text-sm text-stone-600">{rung.jogMin}m</span>
                </li>
              )
            })}
          </ol>
          <p className="mt-3 text-xs leading-relaxed text-stone-600">
            You move up after {state.sessionsNeededPerLevel} clean sessions on a rung, and back
            down a rung after two that are not. Thirty minutes is where this plan stops on
            purpose: injury rates roughly doubled between 30 and 45 minutes a session in
            previously untrained men.
          </p>
        </section>

        <section>
          <div className="label">this week</div>
          <div className="mt-3 grid grid-cols-7 gap-1.5">
            {week.map((p, i) => {
              const date = addDays(monday, i)
              const isToday = date === state.today
              const jog = p?.plannedJogMin ?? 0
              return (
                <div key={date} className={`rounded-lg border px-1 py-2.5 text-center ${isToday ? 'border-stone-100' : 'border-stone-800'}`}>
                  <div className="text-[0.6rem] uppercase tracking-wide text-stone-600">
                    {['M', 'T', 'W', 'T', 'F', 'S', 'S'][i]}
                  </div>
                  <div className={`numeral mt-1.5 text-lg ${jog > 0 ? 'text-stone-200' : 'text-stone-700'}`}>
                    {jog > 0 ? Math.round(jog) : '–'}
                  </div>
                </div>
              )
            })}
          </div>
          <p className="mt-3 text-xs text-stone-600">
            Jogging minutes; walking is not counted. Three runs a week, never back to back.
          </p>
        </section>

        <section>
          <div className="label">the next few weeks</div>
          <div className="mt-3 space-y-2">
            {upcomingWeeks(state).map((w) => (
              <div key={w.monday} className="flex items-baseline justify-between border-b border-stone-900 pb-2 text-sm">
                <span className="text-stone-400">{formatDate(w.monday)}</span>
                <span className="text-stone-500">{w.label}</span>
                <span className="numeral shrink-0 text-stone-500">{w.jogMin}m</span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-stone-600">Provisional. Recalculated from what you actually do.</p>
        </section>

        {probes.length > 1 && (
          <section>
            <div className="label">monday check, same speed every week</div>
            <ProbeChart points={probes.map((p) => ({ hr: p.probe!.hrAtMin5, rpe: p.probe!.rpe }))} />
            <p className="mt-3 text-xs leading-relaxed text-stone-600">
              Falling at a fixed speed is the only thing that raises your ceiling.
              {state.probeStagnantFlag && ' Flat for three weeks; worth checking sleep and how much you are eating.'}
            </p>
          </section>
        )}

        {/* Recalibration is offered, not forced. A full speed-discovery ladder
            every fortnight would be disruptive at rung 8, and the Monday probe
            already re-derives the ceiling continuously from falling heart rate
            at a fixed speed. This is the backstop for when that has gone quiet. */}
        {state.recalibrationDue && state.ceilings.conversationalSpeedMph !== null && (
          <section className="rounded-xl border border-stone-800 bg-stone-900/40 p-4">
            <div className="label">worth re-checking</div>
            <p className="mt-2 text-sm leading-relaxed text-stone-400">
              It has been a couple of weeks since your speed was last measured. If the Monday
              check has been flat, redo the talk test: 5 minutes brisk walk, then step up from
              your current ceiling until your breathing first changes.
            </p>
          </section>
        )}

        <Setup
          footwear={state.footwearState}
          surface={state.surface}
          hrDevice={state.hrDevicePresent}
          onChange={onProfile}
        />

        <section>
          <div className="label">for your coach</div>
          <p className="mt-2 rounded-xl border border-stone-800 bg-stone-900/60 p-4 text-sm leading-relaxed text-stone-300">
            {coachMessage({
              longestRunMin: state.continuousCapacityMin,
              weeksRunning: state.weekNumber,
              capMin: Math.max(5, Math.round(state.load.lastBuildWeekMin ? state.load.lastBuildWeekMin / 3 : 10)),
            })}
          </p>
          <button
            className="btn-quiet mt-3"
            onClick={() => void navigator.clipboard?.writeText(coachMessage({
              longestRunMin: state.continuousCapacityMin,
              weeksRunning: state.weekNumber,
              capMin: Math.max(5, Math.round(state.load.lastBuildWeekMin ? state.load.lastBuildWeekMin / 3 : 10)),
            }))}
          >
            Copy
          </button>
        </section>

        <section>
          <div className="label">why today looks like this</div>
          <ul className="mt-3 space-y-2">
            {(week.find((p) => p?.date === state.today)?.audit.caps ?? []).map((c, i) => (
              <li key={i} className="flex items-baseline justify-between gap-3 border-b border-stone-900 pb-2 text-sm">
                <span className="text-stone-400">{c.rule.replace(/_/g, ' ')}</span>
                <span className="numeral shrink-0 text-stone-500">
                  {c.applied < c.original ? `${fmt(c.original)} → ${fmt(c.applied)}` : fmt(c.applied)}
                </span>
              </li>
            ))}
          </ul>
        </section>

        {state.audit.notes.length > 0 && (
          <section>
            <div className="label">notes</div>
            <ul className="mt-3 space-y-1.5 text-sm text-stone-400">
              {state.audit.notes.map((n, i) => <li key={i}>{n}</li>)}
            </ul>
          </section>
        )}
      </div>
    </div>
  )
}

/** Group the projection into weeks, for a readable look-ahead. */
function upcomingWeeks(state: FoldResult) {
  const out: { monday: LocalDate; label: string; jogMin: number }[] = []
  const days = state.projection.days
  for (let w = 0; w < 6; w++) {
    const slice = days.slice(w * 7, w * 7 + 7)
    if (slice.length === 0) break
    const jogMin = Math.round(slice.reduce((n, d) => n + d.approxJogMin, 0))
    if (jogMin === 0) continue
    const topLevel = Math.max(...slice.map((d) => d.level))
    out.push({
      monday: slice[0]!.date,
      label: LADDER_SUMMARY[topLevel - 1]?.label ?? '',
      jogMin,
    })
  }
  return out
}

/** Hand-rolled so the bundle carries no chart library for one sparkline. */
function ProbeChart({ points }: { points: { hr: number | null; rpe: number }[] }) {
  const w = 320, h = 90, pad = 6
  const hasHr = points.every((p) => p.hr !== null)
  const values = hasHr ? points.map((p) => p.hr!) : points.map((p) => p.rpe)
  const lo = Math.min(...values), hi = Math.max(...values)
  const span = hi - lo || 1
  const x = (i: number) => pad + (i * (w - pad * 2)) / Math.max(1, points.length - 1)
  const y = (v: number) => pad + ((hi - v) / span) * (h - pad * 2)

  return (
    <div className="mt-3 overflow-x-auto">
      <svg viewBox={`0 0 ${w} ${h}`} className="h-24 w-full" role="img" aria-label="Weekly check trend">
        <polyline points={values.map((v, i) => `${x(i)},${y(v)}`).join(' ')}
          fill="none" stroke="#fb923c" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {values.map((v, i) => <circle key={i} cx={x(i)} cy={y(v)} r="3" fill="#fb923c" />)}
      </svg>
      <div className="mt-1 flex justify-between text-xs text-stone-600">
        <span>{hasHr ? `${hi} bpm` : `RPE ${hi}`}</span>
        <span>{hasHr ? `${lo} bpm` : `RPE ${lo}`}</span>
      </div>
    </div>
  )
}

function formatDate(d: string): string {
  const [, m, day] = d.split('-')
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${months[Number(m) - 1]} ${Number(day)}`
}

function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1)
}
