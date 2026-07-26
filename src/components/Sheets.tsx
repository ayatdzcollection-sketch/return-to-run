// The "Something's wrong" path, the pain form, and the blocking gates.
//
// Every question here is binary and behaviour-anchored rather than a 0-10
// scale. Pain severity correlates poorly with tissue damage in bone stress
// injury, and severity is the one input a motivated teenager can shade
// downward for free. "Did it hurt more at the end than at the start?" cannot
// be gamed the same way.

import { useState } from 'react'
import { PAIN_LOCATIONS, type GateId, type PainLocation } from '../engine/types.ts'
import { PAIN_QUESTIONS, REFERRAL_COPY } from '../lib/narrative.ts'

export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-20 flex flex-col bg-stone-950">
      <header className="flex items-center justify-between border-b border-stone-800 px-5 py-4">
        <h2 className="label !text-stone-300">{title}</h2>
        <button onClick={onClose} className="px-2 py-1 text-sm text-stone-500">Close</button>
      </header>
      <div className="flex-1 overflow-y-auto px-5 py-6">{children}</div>
    </div>
  )
}

export type WrongChoice =
  | { kind: 'missed' }
  | { kind: 'cut_short'; jogMinDone: number }
  | { kind: 'pain'; location: PainLocation; severity: number; gaitAltering: boolean; when: 'during' | 'after' | 'next_am' }
  | { kind: 'felt_awful' }

export function SomethingWrong({ plannedJogMin, onPick, onClose }: {
  plannedJogMin: number
  onPick: (c: WrongChoice) => void
  onClose: () => void
}) {
  const [view, setView] = useState<'menu' | 'pain' | 'short'>('menu')

  if (view === 'pain') return <PainForm onSubmit={(c) => onPick(c)} onClose={onClose} />
  if (view === 'short') return <CutShort planned={plannedJogMin} onSubmit={(m) => onPick({ kind: 'cut_short', jogMinDone: m })} onClose={onClose} />

  return (
    <Sheet title="What happened" onClose={onClose}>
      <div className="space-y-3">
        <button className="btn-option" onClick={() => setView('pain')}>
          <div className="font-semibold">Something hurt</div>
          <div className="mt-0.5 text-sm text-stone-500">Any pain at all, however small</div>
        </button>
        <button className="btn-option" onClick={() => setView('short')}>
          <div className="font-semibold">I stopped early</div>
          <div className="mt-0.5 text-sm text-stone-500">Ran some of it, not all of it</div>
        </button>
        <button className="btn-option" onClick={() => onPick({ kind: 'missed' })}>
          <div className="font-semibold">I skipped it</div>
          <div className="mt-0.5 text-sm text-stone-500">Didn’t run today</div>
        </button>
        <button className="btn-option" onClick={() => onPick({ kind: 'felt_awful' })}>
          <div className="font-semibold">Finished it, but felt awful</div>
          <div className="mt-0.5 text-sm text-stone-500">No pain, just wrong</div>
        </button>
      </div>
    </Sheet>
  )
}

function CutShort({ planned, onSubmit, onClose }: { planned: number; onSubmit: (m: number) => void; onClose: () => void }) {
  const options = [...new Set([0, Math.round(planned * 0.25), Math.round(planned * 0.5), Math.round(planned * 0.75)])]
    .filter((n) => n < planned)
  return (
    <Sheet title="How much did you run" onClose={onClose}>
      <p className="mb-5 text-stone-400">Jogging minutes only — walking doesn’t count.</p>
      <div className="space-y-3">
        {options.map((m) => (
          <button key={m} className="btn-option numeral text-2xl" onClick={() => onSubmit(m)}>
            {m} <span className="text-base text-stone-500">min</span>
          </button>
        ))}
      </div>
    </Sheet>
  )
}

function PainForm({ onSubmit, onClose }: { onSubmit: (c: WrongChoice) => void; onClose: () => void }) {
  const [location, setLocation] = useState<PainLocation | null>(null)
  const [answers, setAnswers] = useState<Record<string, boolean>>({})

  if (!location) {
    return (
      <Sheet title="Where" onClose={onClose}>
        <p className="mb-5 text-stone-400">Point to the exact spot. If you can cover it with one fingertip, say so below.</p>
        <div className="space-y-2">
          {(Object.keys(PAIN_LOCATIONS) as PainLocation[]).map((loc) => (
            <button key={loc} className="btn-option flex items-center justify-between" onClick={() => setLocation(loc)}>
              <span>{PAIN_LOCATIONS[loc].label}</span>
              {PAIN_LOCATIONS[loc].bony && <span className="text-xs text-ceiling">bone</span>}
            </button>
          ))}
        </div>
      </Sheet>
    )
  }

  const bony = PAIN_LOCATIONS[location].bony
  const allAnswered = PAIN_QUESTIONS.every((q) => q.id in answers)

  return (
    <Sheet title={PAIN_LOCATIONS[location].label} onClose={onClose}>
      {bony && (
        <p className="mb-6 rounded-xl border border-ceiling/30 bg-ceiling/5 p-4 text-sm leading-relaxed text-stone-300">
          That’s on bone. This app stops you there whatever the pain score, because pain on a bone doesn’t track how bad the problem is.
        </p>
      )}
      <div className="space-y-5">
        {PAIN_QUESTIONS.map((q) => (
          <div key={q.id}>
            <p className="mb-2.5 text-[1.02rem] leading-snug">{q.text}</p>
            <div className="flex gap-2">
              {[true, false].map((v) => (
                <button
                  key={String(v)}
                  onClick={() => setAnswers((a) => ({ ...a, [q.id]: v }))}
                  className={`flex-1 rounded-xl border px-4 py-3 font-semibold ${
                    answers[q.id] === v
                      ? 'border-stone-100 bg-stone-100 text-stone-950'
                      : 'border-stone-800 text-stone-300'
                  }`}
                >
                  {v ? 'Yes' : 'No'}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
      <button
        disabled={!allAnswered}
        className="btn-primary mt-8 disabled:opacity-30"
        onClick={() => onSubmit({
          kind: 'pain',
          location,
          // The severity field still exists for the record, but the engine's
          // escalation for a bony site does not consult it.
          severity: answers['worse_during'] || answers['night'] ? 4 : 2,
          gaitAltering: answers['gait'] === true || answers['hop'] === false,
          when: answers['night'] ? 'next_am' : 'during',
        })}
      >
        Log it
      </button>
    </Sheet>
  )
}

const GATE_COPY: Record<GateId, { title: string; question: string; body: string }> = {
  pre_20min: {
    title: 'Before your first 20-minute run',
    question: 'Have your legs felt normal after the last few runs — no ache that lasted into the next day?',
    body: 'Twenty unbroken minutes is a real step up. This is the one time the app asks before letting you take it.',
  },
  pre_team: {
    title: 'Before your first team practice',
    question: 'Do you know what you’re going to do when the group runs longer than your cap?',
    body: 'The plan is: warm up with them, run your minutes, peel off, rejoin for cooldown and core. Tell the coach beforehand, not during.',
  },
  post_pain: {
    title: 'After a pain stop',
    question: 'Can you walk 30 minutes with no pain and hop 10 times on that leg with no pain?',
    body: REFERRAL_COPY,
  },
}

export function GateQuestion({ gate, onAnswer }: { gate: GateId; onAnswer: (yes: boolean) => void }) {
  const copy = GATE_COPY[gate]
  return (
    <div className="fixed inset-0 z-30 flex flex-col justify-center bg-stone-950 px-6">
      <div className="label mb-4">{copy.title}</div>
      <h2 className="text-2xl font-semibold leading-snug">{copy.question}</h2>
      <p className="mt-4 text-[0.95rem] leading-relaxed text-stone-400">{copy.body}</p>
      <div className="mt-10 space-y-3">
        <button className="btn-primary" onClick={() => onAnswer(true)}>Yes</button>
        <button className="btn-quiet" onClick={() => onAnswer(false)}>No — not yet</button>
      </div>
    </div>
  )
}
