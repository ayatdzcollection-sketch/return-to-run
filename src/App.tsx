import { useCallback, useEffect, useMemo, useState } from 'react'
import { computeState, type FoldResult } from './engine/fold.ts'
import { prescribe } from './engine/prescribe.ts'
import { addDays, mondayOf, tryLocalDate } from './engine/dates.ts'
import type { AppEvent, EventDraft, Prescription } from './engine/types.ts'
import { levelAt } from './config/seedPlan.ts'
import { todayLocal } from './lib/clock.ts'
import { ulid } from './lib/uid.ts'
import { getAllEvents, stampSchemaVersion } from './lib/storage.ts'
import { record, recordAppOpen } from './lib/appOpen.ts'
import { durabilityCheck, pendingCount, sync, type SyncState } from './lib/sync.ts'
import { getAccessCode, hasSupabase, setAccessCode } from './lib/supabase.ts'
import { rationaleSentence, SETUP_NOTICES } from './lib/narrative.ts'
import { TodayCard } from './components/TodayCard.tsx'
import { GateQuestion, SomethingWrong, type WrongChoice } from './components/Sheets.tsx'
import { CalibrationWizard } from './components/Calibration.tsx'
import { DetailView } from './components/DetailView.tsx'

const NOTICES_KEY = 'rtr_setup_seen'

export default function App() {
  const [events, setEvents] = useState<AppEvent[] | null>(null)
  // `?date=YYYY-MM-DD` in dev only, so a rest day does not block checking what
  // a running session looks like. Stripped from production builds entirely —
  // the engine takes `today` as a parameter precisely so this costs nothing.
  const [today] = useState(() => {
    if (import.meta.env.DEV) {
      const override = new URLSearchParams(location.search).get('date')
      const parsed = override ? tryLocalDate(override) : null
      if (parsed) return parsed
    }
    return todayLocal()
  })
  const [showWrong, setShowWrong] = useState(false)
  const [showDetail, setShowDetail] = useState(false)
  const [seenNotices, setSeenNotices] = useState(() => !!localStorage.getItem(NOTICES_KEY))
  const [code, setCode] = useState(() => getAccessCode())
  const [syncState, setSyncState] = useState<SyncState>({ kind: 'local_only' })
  const [pending, setPending] = useState(0)

  const reload = useCallback(async () => {
    setEvents(await getAllEvents())
    setPending(await pendingCount())
  }, [])

  useEffect(() => {
    void (async () => {
      await stampSchemaVersion()
      // Load first, paint, then reconcile with the mirror. The event log is the
      // primary store; the network is an optimisation.
      await recordAppOpen()
      await reload()
      const local = await getAllEvents()
      setSyncState(await sync(local))
      await reload()
      void durabilityCheck()
    })()
  }, [reload])

  const append = useCallback(async (payload: EventDraft) => {
    await record(payload)
    await reload()
    void getAllEvents().then((all) => sync(all)).then(setSyncState)
  }, [reload])

  const state: FoldResult | null = useMemo(
    () => (events === null ? null : computeState(events, today)),
    [events, today],
  )

  const todays: Prescription | null = useMemo(() => {
    if (!state) return null
    const existing = state.timeline.days.get(today)?.prescription
    return existing ?? prescribe(state, today, { id: ulid() })
  }, [state, today])

  const week = useMemo(() => {
    if (!state) return []
    const monday = mondayOf(today)
    return Array.from({ length: 7 }, (_, i) => {
      const date = addDays(monday, i)
      const issued = state.timeline.days.get(date)?.prescription
      return issued ?? (date >= today ? prescribe(state, date, { id: `preview-${date}` }) : null)
    })
  }, [state, today])

  // ── Loading ───────────────────────────────────────────────
  if (!state || !todays) {
    return <Centered><div className="label">Loading</div></Centered>
  }

  // ── Access code, once ─────────────────────────────────────
  if (hasSupabase && !code) {
    return <AccessCodeGate onSet={(c) => { setAccessCode(c); setCode(c) }} />
  }

  // ── Setup notices, once ───────────────────────────────────
  if (!seenNotices) {
    return (
      <Centered>
        <div className="w-full max-w-md space-y-7 py-8">
          {SETUP_NOTICES.map((n) => (
            <div key={n.id}>
              <h3 className="text-lg font-semibold">{n.title}</h3>
              <p className="mt-1.5 text-[0.95rem] leading-relaxed text-stone-400">{n.body}</p>
            </div>
          ))}
          <button
            className="btn-primary"
            onClick={() => { localStorage.setItem(NOTICES_KEY, '1'); setSeenNotices(true) }}
          >
            Got it
          </button>
        </div>
      </Centered>
    )
  }

  // ── A blocking gate outranks everything ───────────────────
  if (state.gateDue) {
    const gate = state.gateDue
    return (
      <GateQuestion
        gate={gate}
        onAnswer={(yes) => void append({ date: today, type: 'gate_answered', gate, answer: yes ? 'yes' : 'no' })}
      />
    )
  }

  // ── Calibration before anything can be prescribed ─────────
  if (todays.kind === 'calibration_discovery') {
    return (
      <CalibrationWizard
        onDone={(r) => void append({ date: today, type: 'talk_test_result', ...r })}
      />
    )
  }

  const alreadyLogged = state.timeline.days.get(today)?.outcome
  const done = alreadyLogged === 'completed' || alreadyLogged === 'cut_short' || alreadyLogged === 'missed'

  const onDone = async () => {
    const issued = state.timeline.days.get(today)?.prescription
    if (!issued) await append({ date: today, type: 'prescription_issued', prescription: todays })
    await append({ date: today, type: 'session_completed', prescriptionId: todays.id })
  }

  const onWrong = async (choice: WrongChoice) => {
    setShowWrong(false)
    const issued = state.timeline.days.get(today)?.prescription
    if (!issued) await append({ date: today, type: 'prescription_issued', prescription: todays })
    switch (choice.kind) {
      case 'missed': return append({ date: today, type: 'session_missed', prescriptionId: todays.id })
      case 'cut_short': return append({ date: today, type: 'session_cut_short', prescriptionId: todays.id, jogMinDone: choice.jogMinDone })
      case 'felt_awful': return append({ date: today, type: 'felt_awful' })
      case 'pain': return append({
        date: today, type: 'pain_reported',
        location: choice.location, severity: choice.severity,
        gaitAltering: choice.gaitAltering, when: choice.when,
      })
    }
  }

  return (
    <div className="mx-auto min-h-dvh max-w-md px-6 pb-10">
      <header className="flex items-baseline justify-between pt-6">
        <button onClick={() => setShowDetail(true)} className="label !text-stone-500">
          Week {state.weekNumber} · Step {state.level} ›
        </button>
        <SyncBadge state={syncState} pending={pending} />
      </header>

      <TodayCard
        p={todays}
        rationale={rationaleSentence({
          prescription: todays,
          levelLabel: levelAt(state.level).label,
          weekNumber: state.weekNumber,
        })}
      />

      <div className="mt-10 space-y-3">
        {done ? (
          <div className="rounded-xl border border-stone-800 px-5 py-4 text-center text-stone-400">
            Logged. Nothing else to do today.
          </div>
        ) : (
          <>
            {todays.plannedJogMin > 0 && (
              <button className="btn-primary" onClick={() => void onDone()}>Done</button>
            )}
            <button className="btn-quiet" onClick={() => setShowWrong(true)}>Something’s wrong</button>
          </>
        )}
      </div>

      {showWrong && (
        <SomethingWrong
          plannedJogMin={todays.plannedJogMin}
          onPick={(c) => void onWrong(c)}
          onClose={() => setShowWrong(false)}
        />
      )}
      {showDetail && <DetailView state={state} week={week} onClose={() => setShowDetail(false)} />}
    </div>
  )
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto flex min-h-dvh max-w-md items-center justify-center px-6">{children}</div>
}

function AccessCodeGate({ onSet }: { onSet: (code: string) => void }) {
  const [value, setValue] = useState('')
  return (
    <Centered>
      <div className="w-full">
        <h2 className="text-xl font-semibold">Access code</h2>
        <p className="mt-2 text-[0.95rem] leading-relaxed text-stone-400">
          Type it once. Same code on another phone shows the same log.
        </p>
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          autoCapitalize="none"
          autoCorrect="off"
          className="mt-6 w-full rounded-xl border border-stone-800 bg-stone-900/60 px-4 py-3 text-lg"
        />
        <button className="btn-primary mt-4 disabled:opacity-30" disabled={value.trim().length < 3} onClick={() => onSet(value)}>
          Continue
        </button>
      </div>
    </Centered>
  )
}

/** Degrades loudly. Silent local-only mode is how a phone loses a season. */
function SyncBadge({ state, pending }: { state: SyncState; pending: number }) {
  const text = state.kind === 'local_only' ? 'on this phone only'
    : state.kind === 'no_code' ? 'not linked'
      : state.kind === 'error' ? 'not backed up'
        : pending > 0 ? `${pending} to upload`
          : 'backed up'
  const warn = state.kind === 'error' || state.kind === 'local_only'
  return <span className={`text-[0.65rem] uppercase tracking-widest ${warn ? 'text-ceiling/70' : 'text-stone-600'}`}>{text}</span>
}
