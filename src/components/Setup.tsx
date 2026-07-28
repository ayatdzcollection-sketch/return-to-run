// The three facts about his life that the engine cannot infer.
//
// These defaulted to "no running shoes, no watch, treadmill" and had no way to
// change, which meant he would have been capped at 25 minutes with outdoor
// running disabled for the entire season no matter what he actually owned.
// Everything else the app knows it works out from the log; these three it has
// to be told.

import type { FootwearState, Surface } from '../engine/types.ts'

export function Setup({ footwear, surface, hrDevice, onChange }: {
  footwear: FootwearState
  surface: Surface
  hrDevice: boolean
  onChange: (p: { footwearState?: FootwearState; surface?: Surface; hrDevicePresent?: boolean }) => void
}) {
  return (
    <section>
      <div className="label">your kit</div>

      <Row label="Shoes">
        <Choice active={footwear === 'none' || footwear === 'non_running'} onClick={() => onChange({ footwearState: 'non_running' })}>
          Not running shoes
        </Choice>
        <Choice active={footwear === 'new_under_50mi'} onClick={() => onChange({ footwearState: 'new_under_50mi' })}>
          New
        </Choice>
        <Choice active={footwear === 'broken_in'} onClick={() => onChange({ footwearState: 'broken_in' })}>
          Broken in
        </Choice>
      </Row>
      <Hint>
        {footwear === 'none' || footwear === 'non_running'
          ? 'Sessions are capped at 25 minutes and outdoor running is off until you have running shoes. Pick the most cushioned, lightest pair you have in the meantime, and avoid hard-soled skate or court shoes.'
          : footwear === 'new_under_50mi'
            ? 'Nothing changes for a conventional cushioned trainer. If they are minimalist, zero-drop or carbon-plated, say so, because that is the one shoe change with real evidence behind it.'
            : 'No footwear cap applied.'}
      </Hint>

      <Row label="Where you run">
        <Choice active={surface === 'treadmill'} onClick={() => onChange({ surface: 'treadmill' })}>Treadmill</Choice>
        <Choice active={surface === 'mixed'} onClick={() => onChange({ surface: 'mixed' })}>Both</Choice>
        <Choice active={surface === 'road'} onClick={() => onChange({ surface: 'road' })}>Outside</Choice>
      </Row>
      <Hint>
        {surface === 'treadmill'
          ? 'Point a fan at yourself before you start. Indoors you lose nearly all your cooling, and it has to be running before you are hot, not after.'
          : 'The first few outdoor sessions are shortened. Not because the ground is harder, but because pace, terrain and the group all leave your control at once.'}
      </Hint>

      <Row label="Watch">
        <Choice active={!hrDevice} onClick={() => onChange({ hrDevicePresent: false })}>No watch</Choice>
        <Choice active={hrDevice} onClick={() => onChange({ hrDevicePresent: true })}>Heart rate watch</Choice>
      </Row>
      <Hint>
        {hrDevice
          ? 'You will be asked for your average heart rate after a run. Wear it two fingers up your forearm, not on the wrist bone.'
          : 'The plan works exactly the same without one. Speed ceiling and the talk test do the job; heart rate only ever confirms them.'}
      </Hint>
    </section>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mt-4">
      <div className="mb-2 text-sm text-stone-400">{label}</div>
      <div className="flex gap-2">{children}</div>
    </div>
  )
}

function Choice({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 rounded-lg border px-2 py-2.5 text-xs font-semibold ${
        active ? 'border-stone-100 bg-stone-100 text-stone-950' : 'border-stone-800 text-stone-400'
      }`}
    >
      {children}
    </button>
  )
}

function Hint({ children }: { children: React.ReactNode }) {
  return <p className="mt-2 text-xs leading-relaxed text-stone-600">{children}</p>
}
