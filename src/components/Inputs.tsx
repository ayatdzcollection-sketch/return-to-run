// The four inputs the engine was built to read and had no way to receive.
//
// Everything here is one or two taps. That is not a style preference: this app
// is exception-only precisely because a daily questionnaire gets answered
// carelessly within a fortnight, and a carelessly answered input is worse than
// no input because the engine believes it.

import { useState } from 'react'
import { Sheet } from './Sheets.tsx'
import { SORENESS_OPTIONS } from '../lib/narrative.ts'

/**
 * Next-morning soreness, asked the morning after a session.
 *
 * The most consequential missing input in the app. `tolerance_class` is
 * assigned partly on "soreness never above 1", and with no data that condition
 * reads as trivially TRUE, which biased the assignment toward `aggressive` and
 * advanced him a rung every two clean sessions instead of three. He was being
 * moved up faster because the app never asked.
 */
export function SorenessPrompt({ onPick }: { onPick: (score: 0 | 1 | 2 | 3) => void }) {
  return (
    <div className="mt-5 rounded-xl border border-stone-800 bg-stone-900/40 p-4">
      <div className="label">yesterday’s run</div>
      <p className="mt-1.5 text-[0.98rem] text-stone-200">How do your legs feel this morning?</p>
      <div className="mt-3 grid grid-cols-4 gap-2">
        {SORENESS_OPTIONS.map((o) => (
          <button
            key={o.score}
            onClick={() => onPick(o.score)}
            className="rounded-lg border border-stone-800 px-1 py-2.5 text-xs font-semibold text-stone-300 active:bg-stone-800"
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}

/**
 * The Monday probe and the post-run heart rate, asked once the run is done.
 *
 * The probe is the ONLY thing in the engine that can raise a speed ceiling
 * (invariant 12). Without it his ceiling could fall but never rise, so he would
 * have been stuck at his week-one speed for the whole season.
 *
 * RPE is asked whether or not a watch exists, because it is the check on the
 * sensor: a watch that has locked onto his cadence will report a falling heart
 * rate while the effort climbs, and RPE is what catches that.
 */
export function AfterSession({ askProbe, askHr, probeSpeedMph, onDone, onSkip }: {
  askProbe: boolean
  askHr: boolean
  probeSpeedMph: number | null
  onDone: (r: { rpe: number | null; hrAtMin5: number | null; avgHr: number | null }) => void
  onSkip: () => void
}) {
  const [rpe, setRpe] = useState<number | null>(null)
  const [hrAtMin5, setHrAtMin5] = useState('')
  const [avgHr, setAvgHr] = useState('')

  const num = (s: string) => (s.trim() === '' ? null : Number(s))
  const ready = !askProbe || rpe !== null

  return (
    <Sheet title={askProbe ? 'Monday check' : 'After the run'} onClose={onSkip}>
      {askProbe && (
        <>
          <p className="text-[0.95rem] leading-relaxed text-stone-400">
            The first 5 minutes were at{' '}
            <span className="text-stone-200">{probeSpeedMph?.toFixed(1) ?? 'your check'} mph</span>, the same
            speed every Monday. Comparing the same speed week to week is the only thing that
            can raise your ceiling.
          </p>
          <div className="mt-6">
            <div className="label">how hard did those 5 minutes feel?</div>
            <div className="mt-3 grid grid-cols-5 gap-2">
              {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                <button
                  key={n}
                  onClick={() => setRpe(n)}
                  className={`numeral rounded-lg border py-3 text-lg ${
                    rpe === n ? 'border-stone-100 bg-stone-100 text-stone-950' : 'border-stone-800 text-stone-300'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
            <div className="mt-2 flex justify-between text-xs text-stone-600">
              <span>1 — barely working</span><span>10 — all out</span>
            </div>
          </div>
          {askHr && (
            <NumberField label="heart rate at minute 5 (optional)" value={hrAtMin5} onChange={setHrAtMin5} />
          )}
        </>
      )}

      {askHr && (
        <NumberField
          label="average heart rate for the whole run (optional)"
          value={avgHr}
          onChange={setAvgHr}
          hint="Whatever the watch shows for the session average."
        />
      )}

      <button
        disabled={!ready}
        className="btn-primary mt-8 disabled:opacity-30"
        onClick={() => onDone({ rpe, hrAtMin5: num(hrAtMin5), avgHr: num(avgHr) })}
      >
        Save
      </button>
      <button className="btn-quiet mt-3" onClick={onSkip}>Skip</button>
    </Sheet>
  )
}

/** Team practice: the app has to be told, because it cannot see the team. */
export function TeamPracticeSheet({ onPick, onClose }: {
  onPick: (practiceMin: number) => void
  onClose: () => void
}) {
  return (
    <Sheet title="Team practice" onClose={onClose}>
      <p className="text-[0.95rem] leading-relaxed text-stone-400">
        Roughly how long is the running part of practice today? The app will tell you how much
        of it to do. The cap comes from what you have actually been running, never from what
        the team is doing.
      </p>
      <div className="mt-6 space-y-3">
        {[30, 45, 60, 90].map((m) => (
          <button key={m} className="btn-option numeral text-2xl" onClick={() => onPick(m)}>
            {m} <span className="text-base text-stone-500">min</span>
          </button>
        ))}
      </div>
    </Sheet>
  )
}

/** A run the app never prescribed. Counts toward load identically. */
export function LoggedElsewhere({ onPick, onClose }: {
  onPick: (durationMin: number) => void
  onClose: () => void
}) {
  return (
    <Sheet title="How long did you run" onClose={onClose}>
      <p className="mb-5 text-stone-400">
        Running minutes only. This counts exactly the same as a session the app gave you.
      </p>
      <div className="space-y-3">
        {[10, 15, 20, 25, 30, 40, 50, 60].map((m) => (
          <button key={m} className="btn-option numeral text-2xl" onClick={() => onPick(m)}>
            {m} <span className="text-base text-stone-500">min</span>
          </button>
        ))}
      </div>
    </Sheet>
  )
}

function NumberField({ label, value, onChange, hint }: {
  label: string; value: string; onChange: (v: string) => void; hint?: string
}) {
  return (
    <label className="mt-6 block">
      <span className="label">{label}</span>
      {hint && <span className="mt-1 block text-xs text-stone-600">{hint}</span>}
      <input
        inputMode="numeric"
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 3))}
        placeholder="—"
        className="numeral mt-2 w-full rounded-xl border border-stone-800 bg-stone-900/60 px-4 py-3 text-3xl text-stone-100 placeholder:text-stone-700"
      />
    </label>
  )
}
