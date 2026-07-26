// THE screen. If it takes more than five seconds to read, it is wrong.
//
// The visual hierarchy encodes the safety model: minutes are the unit and read
// first; the speed CEILING is the control (invariant 11) and is the only
// coloured number on the page; heart rate is a corroborating signal and sits
// quietly beside it, absent entirely when there is no device.

import type { IntervalBlock, Prescription } from '../engine/types.ts'
import { TUNABLES } from '../config/tunables.ts'

export function TodayCard({ p, rationale }: { p: Prescription; rationale: string }) {
  const resting = p.plannedJogMin === 0

  return (
    <div>
      {resting ? (
        <div className="pt-6">
          <div className="numeral text-[5.5rem] text-stone-300">REST</div>
          <p className="mt-5 text-[0.95rem] leading-relaxed text-stone-400">{rationale}</p>
        </div>
      ) : (
        <>
          <div className="flex items-baseline gap-3 pt-4">
            <span className="numeral text-[7rem] text-stone-50">{fmt(p.plannedTotalMin)}</span>
            <span className="label pb-3">minutes</span>
          </div>

          <ol className="mt-6 space-y-1.5">
            {p.structure.map((b, i) => (
              <li key={i} className="flex items-baseline gap-3 text-[1.05rem]">
                <span className="numeral w-6 shrink-0 text-right text-stone-600 text-sm">{i + 1}</span>
                <span className={b.kind === 'walk' ? 'text-stone-500' : 'text-stone-100'}>
                  {describe(b)}
                </span>
              </li>
            ))}
          </ol>

          <div className="mt-7 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-stone-800 bg-stone-800">
            {/* Labelled honestly: below the viable jog floor this is a brisk
                walk, and calling it a jogging speed would misdescribe it. */}
            <Cell
              label={p.speedCeilingMph !== null && p.speedCeilingMph < TUNABLES.TALK_TEST.MIN_VIABLE_JOG_MPH
                ? 'walk speed' : 'belt speed'}
              hero
            >
              {p.speedCeilingMph === null ? (
                <span className="text-stone-500">—</span>
              ) : (
                <>
                  <span className="text-stone-500">≤</span>{' '}
                  <span className="text-ceiling">{p.speedCeilingMph.toFixed(1)}</span>
                  <span className="ml-1.5 text-base text-stone-500">mph</span>
                </>
              )}
            </Cell>
            {/* Absent, not zeroed, when there is no trustworthy heart rate.
                The engine runs indefinitely without one. */}
            <Cell label={p.hrCeiling === null ? 'incline' : 'heart rate'}>
              {p.hrCeiling === null ? (
                <>
                  <span className="text-stone-300">{p.inclinePct}</span>
                  <span className="ml-1 text-base text-stone-500">%</span>
                </>
              ) : (
                <>
                  <span className="text-stone-500">≤</span>{' '}
                  <span className="text-stone-300">{p.hrCeiling}</span>
                  <span className="ml-1 text-base text-stone-500">bpm</span>
                </>
              )}
            </Cell>
          </div>

          <p className="mt-6 text-[0.95rem] leading-relaxed text-stone-400">{rationale}</p>
        </>
      )}
    </div>
  )
}

function Cell({ label, hero, children }: { label: string; hero?: boolean; children: React.ReactNode }) {
  return (
    <div className="bg-stone-950 px-4 py-4">
      <div className="label">{label}</div>
      <div className={`numeral mt-2 ${hero ? 'text-4xl' : 'text-3xl'}`}>{children}</div>
    </div>
  )
}

function describe(b: IntervalBlock): string {
  switch (b.kind) {
    case 'walk': return `Walk ${fmt(b.minutes)} min`
    case 'jog': return `Jog ${fmt(b.minutes)} min`
    case 'strides': return `${b.count} × ${b.seconds}s strides`
    case 'repeat': return `${b.times} × (${b.blocks.map(describe).join(' / ')})`
  }
}

function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1)
}
