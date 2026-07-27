import { useCallback, useEffect, useMemo, useState } from 'react'
import { computeState, type FoldResult } from './engine/fold.ts'
import { prescribe } from './engine/prescribe.ts'
import { addDays, mondayOf, tryLocalDate } from './engine/dates.ts'
import type { AppEvent, EventDraft, Prescription } from './engine/types.ts'
import { LADDER_SUMMARY } from './engine/plan.ts'
import { levelAt } from './config/seedPlan.ts'
import { PLAN } from './config/tunables.ts'
import { ulid } from './lib/uid.ts'
import { getAllEvents, stampSchemaVersion } from './lib/storage.ts'
import { record, recordAppOpen } from './lib/appOpen.ts'
import { durabilityCheck, pendingCount, sync, type SyncState } from './lib/sync.ts'
import { getAccessCode, hasSupabase, setAccessCode } from './lib/supabase.ts'
import { rationaleSentence, SETUP_NOTICES } from './lib/narrative.ts'
import { useLiveDate, useRefreshOnResume } from './lib/useLive.ts'
import { TodayCard } from './components/TodayCard.tsx'
import { GateQuestion, SomethingWrong, type WrongChoice } from './components/Sheets.tsx'
import { CalibrationWizard } from './components/Calibration.tsx'
import { PlanView } from './components/PlanView.tsx'
import { PlanArc } from './components/PlanArc.tsx'
import { WatchPlacement } from './components/WatchPlacement.tsx'

const NOTICES_KEY = 'rtr_setup_seen'
const PLAN_INTRO_KEY = 'rtr_plan_intro_seen'

export default function App() {
  const [events, setEvents] = useState<AppEvent[] | null>(null)

  // `?date=YYYY-MM-DD` in dev only, so a rest day does not block checking what
  // a running session looks like. Stripped from production builds; the engine
  // takes `today` as a parameter precisely so this costs nothing.
  const devDate = useMemo(() => {
    if (!import.meta.env.DEV) return null
    const override = new URLSearchParams(location.search).get('date')
    return override ? tryLocalDate(override) : null
  }, [])

  // An installed PWA stays mounted for days. Without this, the date freezes at
  // whatever it was when he first opened the app and the screen silently shows
  // yesterday, which looks completely normal and is completely wrong.
  const today = useLiveDate(devDate)

  const [showWrong, setShowWrong] = useState(false)
  const [showPlan, setShowPlan] = useState(false)
  const [seenNotices, setSeenNotices] = useState(() => !!localStorage.getItem(NOTICES_KEY))
  const [seenPlanIntro, setSeenPlanIntro] = useState(() => !!localStorage.getItem(PLAN_INTRO_KEY))
  const [code, setCode] = useState(() => getAccessCode())
  const [syncState, setSyncState] = useState<SyncState>({ kind: 'local_only' })
  const [pending, setPending] = useState(0)

  const reload = useCallback(async () => {
    setEvents(await getAllEvents())
    setPending(await pendingCount())
  }, [])

  const append = useCallback(async (payload: EventDraft) => {
    await record(payload)
    await reload()
    void getAllEvents().then(sync).then(setSyncState)
  }, [reload])

  const refresh = useCallback(() => {
    void (async () => {
      await recordAppOpen()
      await reload()
      setSyncState(await sync(await getAllEvents()))
      await reload()
    })()
  }, [reload])

  useEffect(() => {
    void (async () => {
      await stampSchemaVersion()
      await recordAppOpen()
      // Paint from the local log first. The mirror is an optimisation, not a
      // dependency, and the treadmill is in a basement.
      await reload()
      setSyncState(await sync(await getAllEvents()))
      await reload()
      void durabilityCheck()
    })()
  }, [reload])

  // Anything logged on another device appears when he returns to the app.
  useRefreshOnResume(refresh)

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

  if (!state || !todays) return <Centered><div className="label">Loading</div></Centered>

  if (hasSupabase && !code) {
    return <AccessCodeGate onSet={(c) => { setAccessCode(c); setCode(c) }} />
  }

  if (!seenNotices) {
    return (
      <Centered>
        <div className="w-full max-w-md space-y-8 py-8">
          {SETUP_NOTICES.map((n) => (
            <div key={n.id}>
              <h3 className="text-lg font-semibold">{n.title}</h3>
              <p className="mt-1.5 text-[0.95rem] leading-relaxed text-stone-400">{n.body}</p>
              {/* A position is far easier to copy than to read. */}
              {n.id === 'watch_position' && <div className="mt-4"><WatchPlacement /></div>}
            </div>
          ))}
          <button className="btn-primary" onClick={() => { localStorage.setItem(NOTICES_KEY, '1'); setSeenNotices(true) }}>
            Got it
          </button>
        </div>
      </Centered>
    )
  }

  if (state.gateDue) {
    const gate = state.gateDue
    return (
      <GateQuestion
        gate={gate}
        onAnswer={(yes) => void append({ date: today, type: 'gate_answered', gate, answer: yes ? 'yes' : 'no' })}
      />
    )
  }

  if (todays.kind === 'calibration_discovery') {
    return <CalibrationWizard onDone={(r) => void append({ date: today, type: 'talk_test_result', ...r })} />
  }

  // The bridge out of onboarding. Calibration used to end by dropping him on a
  // bare number with nothing to connect it to.
  if (!seenPlanIntro) {
    return <PlanIntro state={state} onDone={() => { localStorage.setItem(PLAN_INTRO_KEY, '1'); setSeenPlanIntro(true) }} />
  }

  const logged = state.timeline.days.get(today)?.outcome
  const done = logged === 'completed' || logged === 'cut_short' || logged === 'missed'
  const issuedToday = !!state.timeline.days.get(today)?.prescription

  const onDone = async () => {
    if (!issuedToday) await append({ date: today, type: 'prescription_issued', prescription: todays })
    await append({ date: today, type: 'session_completed', prescriptionId: todays.id })
  }

  const onWrong = async (choice: WrongChoice) => {
    setShowWrong(false)
    if (!issuedToday) await append({ date: today, type: 'prescription_issued', prescription: todays })
    const prescriptionId = todays.id
    switch (choice.kind) {
      case 'missed': return append({ date: today, type: 'session_missed', prescriptionId })
      case 'cut_short': return append({ date: today, type: 'session_cut_short', prescriptionId, jogMinDone: choice.jogMinDone })
      case 'felt_awful': return append({ date: today, type: 'felt_awful' })
      case 'pain': return append({
        date: today, type: 'pain_reported', location: choice.location,
        severity: choice.severity, gaitAltering: choice.gaitAltering, when: choice.when,
      })
    }
  }

  return (
    <div className="mx-auto min-h-dvh max-w-md px-6 pb-10">
      <header className="flex items-baseline justify-between pt-6">
        <button onClick={() => setShowPlan(true)} className="label !text-stone-500">
          Week {state.weekNumber} ›
        </button>
        <SyncBadge state={syncState} pending={pending} />
      </header>

      {state.plan.needsNewPlan && (
        <button
          onClick={() => setShowPlan(true)}
          className="mt-4 block w-full rounded-xl border border-ceiling/40 bg-ceiling/5 px-4 py-3 text-left"
        >
          <div className="label !text-ceiling">this plan has run its course</div>
          <div className="mt-1 text-sm text-stone-300">Ask for the next block.</div>
        </button>
      )}

      <TodayCard
        p={todays}
        rationale={rationaleSentence({
          prescription: todays,
          levelLabel: levelAt(state.level).label,
          weekNumber: state.weekNumber,
        })}
      />

      <PlanArc level={state.level} plan={state.plan} onOpen={() => setShowPlan(true)} />

      <div className="mt-8 space-y-3">
        {done ? (
          <div className="rounded-xl border border-stone-800 px-5 py-4 text-center text-stone-400">
            Logged. Nothing else to do today.
          </div>
        ) : (
          <>
            {todays.plannedJogMin > 0 && <button className="btn-primary" onClick={() => void onDone()}>Done</button>}
            <button className="btn-quiet" onClick={() => setShowWrong(true)}>Something’s wrong</button>
          </>
        )}
      </div>

      {showWrong && (
        <SomethingWrong plannedJogMin={todays.plannedJogMin} onPick={(c) => void onWrong(c)} onClose={() => setShowWrong(false)} />
      )}
      {showPlan && <PlanView state={state} week={week} onClose={() => setShowPlan(false)} />}
    </div>
  )
}

/**
 * Shown once, immediately after calibration.
 *
 * The complaint this fixes: onboarding ended and the app became a bare number
 * with no visible connection to anything. This names the whole arc, gives the
 * projected finish, and says plainly when that finish lands after the tryout,
 * so it is learned on day one rather than discovered in week six.
 */
function PlanIntro({ state, onDone }: { state: FoldResult; onDone: () => void }) {
  const { projection } = state
  return (
    <div className="mx-auto min-h-dvh max-w-md px-6 py-10">
      <div className="label">your plan</div>
      <h2 className="mt-3 text-2xl font-semibold leading-snug">
        Nine steps to 30 minutes without stopping.
      </h2>
      <p className="mt-4 text-[0.97rem] leading-relaxed text-stone-400">
        Three runs a week, never two days in a row. You move up a step after{' '}
        {state.sessionsNeededPerLevel} clean sessions and back down after two that are not.
        Your speed ceiling came from your talk test, and it only rises if your Monday check
        says it should.
      </p>

      <ol className="mt-7 space-y-0">
        {LADDER_SUMMARY.map((rung) => (
          <li key={rung.level} className="flex items-baseline gap-3 border-b border-stone-900 py-2">
            <span className={`numeral w-5 shrink-0 text-sm ${rung.level === state.level ? 'text-ceiling' : 'text-stone-700'}`}>
              {rung.level}
            </span>
            <span className={`flex-1 text-[0.95rem] ${rung.level === state.level ? 'text-stone-100' : 'text-stone-500'}`}>
              {rung.label}
            </span>
          </li>
        ))}
      </ol>

      {projection.goalDate && (
        <div className="mt-7 rounded-xl border border-stone-800 bg-stone-900/50 p-4">
          <div className="label">estimated finish</div>
          <div className="numeral mt-2 text-3xl">{formatDate(projection.goalDate)}</div>
          {projection.missesTargetBy !== null && (
            <p className="mt-3 text-sm leading-relaxed text-stone-400">
              That lands after the {formatDate(PLAN.TARGET_DATE)} tryout, and that is deliberate.
              Building fast enough to hit the date is what causes the injury this plan exists to
              avoid. Worth telling your coach now rather than on the day.
            </p>
          )}
        </div>
      )}

      <button className="btn-primary mt-8" onClick={onDone}>Start week 1</button>
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
          value={value} onChange={(e) => setValue(e.target.value)}
          autoCapitalize="none" autoCorrect="off"
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

function formatDate(d: string): string {
  const [, m, day] = d.split('-')
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${months[Number(m) - 1]} ${Number(day)}`
}
