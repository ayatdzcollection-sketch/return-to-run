// ============================================================
// THE NARRATIVE LAYER: one sentence under each session.
//
// Deterministic templates keyed by rationale code. No API key, no proxy, no
// network dependency: this works in a basement with no signal, which is where
// the treadmill is. FLAGS.LLM_NARRATIVE is off and the upgrade path, if ever
// taken, is a server-side proxy, never a client-side key.
//
// TWO HARD RULES ON WHAT THIS MAY SAY:
//
// 1. It must never claim that a gradual ladder prevents injury. Buist 2008
//    tested exactly that in 532 novice runners with this athlete's own
//    12-months-detrained entry criterion and found 20.8% vs 20.3% (p=0.90).
//    A graduated ladder builds CAPACITY. That is the honest claim and the only
//    one permitted here.
//
// 2. Narrative never feeds back into state. These strings are read by a human
//    and by nothing else.
// ============================================================

import type { Prescription, RationaleCode } from '../engine/types.ts'
import { RATIONALE_CODES } from '../engine/types.ts'

export interface NarrativeContext {
  prescription: Prescription
  levelLabel: string
  weekNumber: number
}

type Template = (ctx: NarrativeContext) => string

const TEMPLATES: Record<RationaleCode, Template> = {
  seed_prior: () =>
    'Starting point, before the app knows anything about you. It will adjust from what you actually do.',

  calibration_discovery: () =>
    'Find the speed where your breathing first changes, not where you run out of breath. Read the passage out loud, at normal volume, every step.',

  calibration_observation: () =>
    'Same speed every time this week. The app is watching how you recover, not how fast you go.',

  progression_frequency: () =>
    'Same length as last time. Consistency first.',

  progression_duration: ({ prescription }) =>
    `${fmt(prescription.plannedJogMin)} minutes of jogging today, a small step up from where you have been.`,

  progression_continuity: ({ prescription }) =>
    `Same total as before, but held together for longer: ${fmt(longestBout(prescription))} minutes unbroken.`,

  progression_intensity: () =>
    'A little faster today. Everything else stays the same.',

  held_session_cap: () =>
    'Held here rather than stepped up: this is close to the longest you have run in the last month, and that is the number the app grows from.',

  held_weekly_cap: () =>
    'Trimmed to keep this week close to last week. The week matters more than any one run.',

  held_longest_session: () =>
    'Kept shorter so no single run dominates the week.',

  held_footwear: () =>
    'Capped until you have running shoes. Use the most cushioned, lightest pair you have, and avoid hard-soled skate or court shoes.',

  held_surface_transition: () =>
    'Shorter because you are outside now. Outdoors is a different job for your legs than a belt is, even at the same pace.',

  down_week: ({ weekNumber }) =>
    `Week ${weekNumber} is a down week. Less this week, on purpose, it is not a setback and it is not optional.`,

  forced_rest_pain: () =>
    'No running. Pain in that spot is the one signal the app will not let you talk it out of.',

  forced_rest_consecutive: () =>
    'Rest today. Two hard days in a row is how this goes wrong.',

  scheduled_rest: () =>
    'Rest day. Tendon takes a day and a half to come out of net breakdown after a run, so the gap is doing real work.',

  re_entry_silence: ({ prescription }) =>
    `It has been a while, so this restarts lower: ${fmt(prescription.plannedJogMin)} minutes. Picking up where you left off is how people get hurt coming back.`,

  re_entry_pain: ({ prescription }) =>
    `First run back. ${fmt(prescription.plannedJogMin)} minutes, well under what you were doing. Stop if anything hurts in the same place.`,

  team_cap: ({ prescription }) =>
    `Warm up with the team, run the first ${fmt(prescription.teamCapMin ?? prescription.plannedJogMin)} minutes, then peel off. Rejoin for cooldown, strides and core.`,

  probe_day: ({ prescription }) =>
    `First 5 minutes at the fixed check speed, then ${fmt(prescription.plannedJogMin)} minutes as usual. Same speed every Monday is what makes the comparison mean anything.`,

  gate_blocked: () =>
    'One question before today’s session.',

  ceiling_lowered_drift: () =>
    'Speed ceiling came down. Your heart rate drifted up at a steady pace twice, that usually means the pace was above easy, whatever it felt like.',

  ceiling_lowered_hr_breach: () =>
    'Speed ceiling came down. Your heart rate ran above your easy ceiling at the prescribed pace.',

  ceiling_raised_probe: () =>
    'Speed ceiling went up a notch, your heart rate at the check speed has fallen two weeks running. That is the only thing that moves it up.',
}

/** The sentence shown under today's session. */
export function rationaleSentence(ctx: NarrativeContext): string {
  return TEMPLATES[ctx.prescription.rationaleCode](ctx)
}

/** Every code has a template. Asserted by narrative.test.ts, not assumed. */
export function allRationaleCodesCovered(): boolean {
  return RATIONALE_CODES.every((c) => typeof TEMPLATES[c] === 'function')
}

// ── One-time notices ────────────────────────────────────────
// Shown once at setup and never repeated. An exception-only app does not nag,
// so anything that would otherwise be a daily reminder has to live here.

export const SETUP_NOTICES = [
  {
    id: 'fan',
    title: 'Point a fan at yourself',
    body: 'Running indoors with no airflow, you lose almost all of your cooling. In the lab this cut time-to-exhaustion by about 40%. Any household fan does it, but turn it on before you start, not once you are hot.',
  },
  {
    id: 'watch_position',
    title: 'Wear the watch up your forearm',
    body: 'Two or three finger-widths above the wrist bone, on the muscle. That single change cuts heart-rate error by roughly half during running, more than any setting in this app.',
  },
  {
    id: 'entry_gate',
    title: 'Before the first run',
    body: 'You should be able to walk briskly for 30 minutes with no pain and no limp. That is the one thing every clinical return-to-run programme asks for first.',
  },
  {
    id: 'honesty',
    title: 'What this app can and cannot do',
    body: 'A gradual build gets you to 30 minutes. It is not proven to prevent injury, and this app will not pretend otherwise. What it does is keep the steps small, keep the rest days real, and stop early when something hurts in the wrong place.',
  },
] as const

// ── Pain triage copy ────────────────────────────────────────
// Deliberately binary and behaviour-anchored rather than a 0-10 scale. Pain
// severity correlates poorly with tissue damage in bone stress injury, and
// severity is the one input a motivated 15-year-old can shade downward for
// free. "Did it get worse as you kept going?" cannot be gamed the same way.

export const PAIN_QUESTIONS = [
  { id: 'worse_during', text: 'Did it hurt more at the end of the run than at the start?' },
  { id: 'gait', text: 'Did it change how you were running or walking?' },
  { id: 'hop', text: 'Can you hop 10 times on that leg with no pain?', invert: true },
  { id: 'night', text: 'Has it woken you up or hurt while sitting still?' },
] as const

export const REFERRAL_COPY =
  'Stop running and get this looked at before you run again. Pain on a bone that keeps coming back is not something to train through, and the sites that matter most are the ones that hurt least early on.'

function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1)
}

function longestBout(p: Prescription): number {
  let best = 0, run = 0
  const flat = p.structure.flatMap((b) => (b.kind === 'repeat' ? Array.from({ length: b.times }, () => b.blocks).flat() : [b]))
  for (const b of flat) {
    if (b.kind === 'walk') run = 0
    else { run += b.kind === 'jog' ? b.minutes : (b.count * b.seconds) / 60; best = Math.max(best, run) }
  }
  return Math.round(best * 10) / 10
}
