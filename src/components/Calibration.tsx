// The talk test, step by step.
//
// Three things here are doing safety work, not UX work:
//
// 1. The stop criterion is the FIRST CHANGE IN BREATHING, not loss of speech.
//    The talk test's "cannot speak comfortably" stage corresponds to the
//    SECOND ventilatory threshold, not the first, 93% of VO2peak versus 77%.
//    Asked naively, "can you still talk?" finds threshold and calls it easy.
// 2. The passage must be read ALOUD. Reciting it silently or under the breath
//    permits a much higher intensity, and the original authors name this as the
//    single qualification on the whole technique.
// 3. Two sessions, and the app keeps the slower result. The talk test's own
//    minimal detectable change is about 0.9 mph, so one administration is not
//    a measurement.

import { useState } from 'react'
import { TUNABLES } from '../config/tunables.ts'
import type { StopReason } from '../engine/types.ts'

const PASSAGE =
  'I am reading this out loud at my normal speaking voice, at my normal speed, and I am not rushing it or running the words together to get to the end faster.'

export function CalibrationWizard({ onDone }: {
  onDone: (result: { steps: { speedMph: number; meanHrLast60s: number | null }[]; passedSpeedMph: number; stopReason: StopReason }) => void
}) {
  const { LADDER_START_MPH, LADDER_STEP_MPH, LADDER_STEP_MIN, LADDER_MAX_MIN } = TUNABLES.TALK_TEST
  const maxSteps = LADDER_MAX_MIN / LADDER_STEP_MIN

  const [stepIndex, setStepIndex] = useState(0)
  const [steps, setSteps] = useState<{ speedMph: number; meanHrLast60s: number | null }[]>([])
  const [hr, setHr] = useState('')
  const [started, setStarted] = useState(false)

  const speed = round1(LADDER_START_MPH + stepIndex * LADDER_STEP_MPH)

  if (!started) {
    return (
      <div className="px-6 py-8">
        <div className="label">Session 1, find your speed</div>
        <h2 className="mt-3 text-2xl font-semibold leading-snug">Walk briskly for 5 minutes first.</h2>
        <div className="mt-6 space-y-4 text-[0.98rem] leading-relaxed text-stone-400">
          <p>
            Then you’ll jog at {LADDER_START_MPH} mph and go up {LADDER_STEP_MPH} mph every {LADDER_STEP_MIN} minutes.
            At the end of each step, read this out loud:
          </p>
          <p className="rounded-xl border border-stone-800 bg-stone-900/60 p-4 italic text-stone-200">“{PASSAGE}”</p>
          <p className="text-stone-300">
            <strong className="text-stone-100">Out loud, at normal volume.</strong> Mouthing it or muttering it will
            put your ceiling too high, and you’ll be training too hard for weeks without knowing.
          </p>
          <p>
            <strong className="text-stone-100">Stop at the first of these</strong>, not the last:
          </p>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>you take an extra breath in the middle of a sentence</li>
            <li>the rhythm of your breathing audibly changes while you talk</li>
            <li>you can’t keep breathing through your nose alone</li>
          </ul>
          <p className="text-stone-500">
            Not “can I still get the words out”. That’s much too late.
          </p>
        </div>
        <button className="btn-primary mt-8" onClick={() => setStarted(true)}>Start</button>
      </div>
    )
  }

  const record = (stop: boolean) => {
    const entry = { speedMph: speed, meanHrLast60s: hr.trim() === '' ? null : Number(hr) }
    const all = [...steps, entry]
    setSteps(all)
    setHr('')
    if (stop || stepIndex + 1 >= maxSteps) {
      // The passing speed is the last step COMPLETED before the criterion hit,
      // not the step it hit on.
      const passed = stop && all.length > 1 ? all[all.length - 2]!.speedMph : entry.speedMph
      onDone({ steps: all, passedSpeedMph: passed, stopReason: stop ? 'breathing_change' : 'time_limit' })
    } else {
      setStepIndex(stepIndex + 1)
    }
  }

  return (
    <div className="px-6 py-8">
      <div className="label">Step {stepIndex + 1} of {maxSteps}</div>
      <div className="mt-3 flex items-baseline gap-3">
        <span className="numeral text-[6rem] text-ceiling">{speed.toFixed(1)}</span>
        <span className="label pb-3">mph</span>
      </div>
      <p className="mt-4 text-stone-400">
        Run here for {LADDER_STEP_MIN} minutes. In the last 30 seconds, read the passage out loud.
      </p>
      <p className="mt-5 rounded-xl border border-stone-800 bg-stone-900/60 p-4 text-[0.95rem] italic leading-relaxed text-stone-200">
        “{PASSAGE}”
      </p>

      <label className="mt-6 block">
        <span className="label">heart rate at the end (optional)</span>
        <input
          inputMode="numeric"
          value={hr}
          onChange={(e) => setHr(e.target.value.replace(/\D/g, '').slice(0, 3))}
          placeholder=", "
          className="numeral mt-2 w-full rounded-xl border border-stone-800 bg-stone-900/60 px-4 py-3 text-3xl text-stone-100 placeholder:text-stone-700"
        />
      </label>

      <div className="mt-8 space-y-3">
        <button className="btn-quiet" onClick={() => record(true)}>
          My breathing just changed, stop here
        </button>
        <button className="btn-primary" onClick={() => record(false)}>
          Still easy, next step
        </button>
      </div>
    </div>
  )
}

function round1(n: number): number { return Math.round(n * 10) / 10 }
