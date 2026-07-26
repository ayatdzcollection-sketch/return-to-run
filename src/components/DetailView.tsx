// Behind one tap: the week, the phase, the probe chart, and the audit trail.
//
// Nothing here is a dashboard. There are no streaks, no badges and no totals to
// chase — the numbers exist so that a decision the engine made can be checked,
// not so that a teenager can optimise against them.

import type { FoldResult } from '../engine/fold.ts'
import type { Prescription } from '../engine/types.ts'
import { addDays, mondayOf } from '../engine/dates.ts'
import { levelAt, TOP_LEVEL } from '../config/seedPlan.ts'

const PHASE_LABEL: Record<string, string> = {
  P0: 'Finding your speed',
  P1: 'Building continuity',
  P2: 'Continuous running',
  P3: 'Team practice',
  P4: 'In season',
}

export function DetailView({ state, week, onClose }: {
  state: FoldResult
  week: (Prescription | null)[]
  onClose: () => void
}) {
  const monday = mondayOf(state.today)
  const probes = state.timeline.ordered.filter((d) => d.probe).slice(-10)

  return (
    <div className="fixed inset-0 z-20 overflow-y-auto bg-stone-950">
      <header className="sticky top-0 flex items-center justify-between border-b border-stone-800 bg-stone-950 px-5 py-4">
        <h2 className="label !text-stone-300">Where you are</h2>
        <button onClick={onClose} className="px-2 py-1 text-sm text-stone-500">Close</button>
      </header>

      <div className="space-y-8 px-5 py-6">
        <section>
          <div className="label">phase</div>
          <div className="mt-1.5 text-xl font-semibold">{PHASE_LABEL[state.phase] ?? state.phase}</div>
          <div className="mt-1 text-sm text-stone-500">
            Step {state.level} of {TOP_LEVEL} — {levelAt(state.level).label}
          </div>
        </section>

        <section>
          <div className="label">this week</div>
          <div className="mt-3 grid grid-cols-7 gap-1.5">
            {week.map((p, i) => {
              const date = addDays(monday, i)
              const isToday = date === state.today
              const jog = p?.plannedJogMin ?? 0
              return (
                <div
                  key={date}
                  className={`rounded-lg border px-1 py-2.5 text-center ${
                    isToday ? 'border-stone-100' : 'border-stone-800'
                  }`}
                >
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
          <p className="mt-3 text-xs text-stone-600">Jogging minutes. Walking isn’t counted.</p>
        </section>

        {probes.length > 1 && (
          <section>
            <div className="label">monday check — same speed every week</div>
            <ProbeChart
              points={probes.map((p) => ({ hr: p.probe!.hrAtMin5, rpe: p.probe!.rpe }))}
            />
            <p className="mt-3 text-xs leading-relaxed text-stone-600">
              Falling at a fixed speed is the only thing that raises your ceiling.
              {state.probeStagnantFlag && ' Flat for three weeks — worth checking sleep and how much you’re eating.'}
            </p>
          </section>
        )}

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
        <polyline
          points={values.map((v, i) => `${x(i)},${y(v)}`).join(' ')}
          fill="none" stroke="#fb923c" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"
        />
        {values.map((v, i) => <circle key={i} cx={x(i)} cy={y(v)} r="3" fill="#fb923c" />)}
      </svg>
      <div className="mt-1 flex justify-between text-xs text-stone-600">
        <span>{hasHr ? `${hi} bpm` : `RPE ${hi}`}</span>
        <span>{hasHr ? `${lo} bpm` : `RPE ${lo}`}</span>
      </div>
    </div>
  )
}

function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1)
}
