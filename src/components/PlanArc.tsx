// The one-line answer to "what am I in the middle of".
//
// The daily screen was correct and completely disorienting: a number, two
// buttons, and no sense of an arc. This sits under the session, costs one line,
// and is the difference between "today is 22 minutes" and "today is rung six
// of nine, and the next one is the first long unbroken run".
//
// Deliberately not a progress bar to fill or a streak to protect. It shows
// position, not achievement, and it goes backwards when he does.

import type { PlanStatus } from '../engine/plan.ts'
import { rungLabel } from '../engine/plan.ts'
import { TOP_LEVEL } from '../config/seedPlan.ts'

export function PlanArc({ level, plan, onOpen }: {
  level: number
  plan: PlanStatus
  onOpen: () => void
}) {
  const atTop = level >= TOP_LEVEL
  return (
    <button onClick={onOpen} className="mt-8 block w-full text-left">
      <div className="flex gap-1">
        {Array.from({ length: TOP_LEVEL }, (_, i) => {
          const rung = i + 1
          const done = rung < level
          const current = rung === level
          return (
            <span
              key={rung}
              className={`h-1 flex-1 rounded-full ${
                current ? 'bg-ceiling' : done ? 'bg-stone-500' : 'bg-stone-800'
              }`}
            />
          )
        })}
      </div>
      <div className="mt-2.5 flex items-baseline justify-between gap-3">
        <span className="text-sm text-stone-400">
          {plan.block === 'needs_new_plan'
            ? 'This plan has run its course'
            : atTop
              ? 'Holding at 30 minutes'
              : <>Next up: <span className="text-stone-200">{rungLabel(level + 1)}</span></>}
        </span>
        <span className="label shrink-0 !text-stone-600">
          {atTop ? 'done' : `${level} of ${TOP_LEVEL}`} ›
        </span>
      </div>
    </button>
  )
}
