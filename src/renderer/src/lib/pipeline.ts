import { useEffect, useReducer } from 'react'
import { AudioWaveform, CalendarClock, Clapperboard, Music2, Package, Sparkles, Store, type LucideIcon } from 'lucide-react'

// Every step is still a demo with made-up timings; nothing is rendered or uploaded yet.
// Phases 2–4 swap the steps for real work one by one (see CLAUDE.md).
export const DEMO = true

export type StepId = 'wav' | 'mp3' | 'rar' | 'bs' | 'ytv' | 'yts' | 'tidy'
export type StepStatus = 'queued' | 'running' | 'needs' | 'done' | 'failed' | 'skipped'
export type Phase = 'idle' | 'running' | 'needs' | 'failed' | 'done'

export interface StepState {
  status: StepStatus
  progress: number // 0–100
  seconds: number // time spent so far
  startedAt: number | null
}

export interface LogContext {
  name: string
  base: string // project file name without .flp
  tagTrack: string // "track 11", or "" when the beat has no tag
  stems: string[] // mixer tracks that become stems
  quality: { wav: string; mp3: string }
}

export interface StepDef {
  id: StepId
  short: string
  icon: LucideIcon
  running(ctx: LogContext): string // headline while it runs
  needs?: string // headline while it waits for the user
  failed?: string // headline when it fails
  demoSeconds: number // how long the step "takes" in the demo
  demoTicks: number // how many 250 ms ticks the demo spends on it
  log(ctx: LogContext): string[]
}

const listStems = (stems: string[]) =>
  stems.length > 3 ? `${stems.slice(0, 3).join(', ')} + ${stems.length - 3} more` : stems.join(', ') || 'none'

export const STEPS: StepDef[] = [
  {
    id: 'wav', short: 'WAV + stems', icon: AudioWaveform, demoSeconds: 108, demoTicks: 32,
    running: () => 'Cooking the stems…',
    log: (c) => [
      c.tagTrack ? `Muted the tag on ${c.tagTrack}` : 'No tag track to mute',
      `Rendering ${c.base}.wav`,
      `Stems: ${listStems(c.stems)}`,
      `Done. ${c.stems.length} stems, ${c.quality.wav}`,
    ],
  },
  {
    id: 'mp3', short: 'Tagged MP3', icon: Music2, demoSeconds: 66, demoTicks: 24,
    running: (c) => (c.tagTrack ? `Bouncing the 808s… tag on ${c.tagTrack}` : 'Bouncing the 808s…'),
    log: (c) => [
      c.tagTrack ? `Unmuted the tag on ${c.tagTrack}` : 'No tag track, so this MP3 has no tag',
      `Rendering ${c.base} (tagged).mp3`,
      `${c.quality.mp3}, tag on`,
    ],
  },
  {
    id: 'rar', short: 'Pack stems', icon: Package, demoSeconds: 21, demoTicks: 12,
    running: () => 'Wrapping the stems for delivery',
    log: (c) => [`Packing ${c.stems.length} stems into ${c.name} stems.rar`, 'Packed'],
  },
  {
    id: 'bs', short: 'BeatStars', icon: Store, demoSeconds: 34, demoTicks: 16,
    running: () => 'Filling in BeatStars…',
    needs: 'Your turn: check BeatStars before it goes live',
    log: (c) => ['Opened BeatStars', `Filled in ${c.name}, BPM and key`, 'Attached the files, free download on', 'Waiting for your OK'],
  },
  {
    id: 'ytv', short: 'YouTube video', icon: Clapperboard, demoSeconds: 71, demoTicks: 20,
    running: () => 'Pressing the video…',
    failed: "Couldn't read the cover. Use a JPG or PNG, then retry.",
    log: () => ['Cover + tagged MP3 going in', 'Video done, 1080p'],
  },
  {
    id: 'yts', short: 'Schedule', icon: CalendarClock, demoSeconds: 6, demoTicks: 8,
    running: () => 'Finding a slot…',
    log: () => ['Found the next free slot', 'Uploaded and scheduled'],
  },
  {
    id: 'tidy', short: 'Tidy up', icon: Sparkles, demoSeconds: 4, demoTicks: 6,
    running: () => 'Sweeping up…',
    log: (c) => ['Cleared temp files', `Moved the project into the ${c.name} folder`],
  },
]

const queued = (): StepState => ({ status: 'queued', progress: 0, seconds: 0, startedAt: null })
const running = (now: number): StepState => ({ status: 'running', progress: 0, seconds: 0, startedAt: now })

export function phaseOf(steps: StepState[]): Phase {
  if (steps.some((s) => s.status === 'running')) return 'running'
  if (steps.some((s) => s.status === 'needs')) return 'needs'
  if (steps.some((s) => s.status === 'failed')) return 'failed'
  if (steps.every((s) => s.status === 'done' || s.status === 'skipped')) return 'done'
  return 'idle'
}

// The step the screen focuses on: whatever is running, waiting or failed; the last one when all are done.
export function currentStep(steps: StepState[]): number {
  for (const status of ['running', 'needs', 'failed'] as const) {
    const i = steps.findIndex((s) => s.status === status)
    if (i >= 0) return i
  }
  return phaseOf(steps) === 'done' ? steps.length - 1 : 0
}

type Action = { type: 'run' | 'tick' | 'approve' | 'retry' | 'reset'; now: number; stems: boolean }

// "Pack stems" shows as skipped ahead of time when stems are off.
export function displayStatus(step: StepState, i: number, stems: boolean): StepStatus {
  return step.status === 'queued' && STEPS[i].id === 'rar' && !stems ? 'skipped' : step.status
}

// Starts the step after `i`, skipping "Pack stems" when stems are off.
function startAfter(steps: StepState[], i: number, now: number, stems: boolean): void {
  let j = i + 1
  while (j < steps.length && STEPS[j].id === 'rar' && !stems) steps[j++] = { ...queued(), status: 'skipped' }
  if (j < steps.length) steps[j] = running(now)
}

function reducer(steps: StepState[], { type, now, stems }: Action): StepState[] {
  const next = steps.slice()
  if (type === 'reset') return STEPS.map(queued)
  if (type === 'run') return STEPS.map((_, i) => (i === 0 ? running(now) : queued()))

  if (type === 'tick') {
    const i = steps.findIndex((s) => s.status === 'running')
    if (i < 0) return steps
    const def = STEPS[i]
    const step = { ...steps[i], progress: Math.min(100, steps[i].progress + 100 / def.demoTicks), seconds: steps[i].seconds + def.demoSeconds / def.demoTicks }
    next[i] = step
    if (step.progress < 100) return next
    // BeatStars waits for the user's OK before anything goes public.
    if (def.id === 'bs') next[i] = { ...step, status: 'needs' }
    else {
      next[i] = { ...step, status: 'done' }
      startAfter(next, i, now, stems)
    }
    return next
  }

  if (type === 'approve') {
    const i = steps.findIndex((s) => s.status === 'needs')
    if (i < 0) return steps
    next[i] = { ...steps[i], status: 'done' }
    startAfter(next, i, now, stems)
    return next
  }

  // retry
  const i = steps.findIndex((s) => s.status === 'failed')
  if (i < 0) return steps
  next[i] = running(now)
  return next
}

export interface Pipeline {
  steps: StepState[]
  phase: Phase
  current: number
  run(): void
  approve(): void
  retry(): void
  reset(): void
}

export function usePipeline({ stems, paused }: { stems: boolean; paused: boolean }): Pipeline {
  const [steps, dispatch] = useReducer(reducer, undefined, () => STEPS.map(queued))
  const phase = phaseOf(steps)

  // The demo moves the running step forward four times a second, and stops while the window is hidden.
  useEffect(() => {
    if (phase !== 'running' || paused) return
    const timer = setInterval(() => dispatch({ type: 'tick', now: Date.now(), stems }), 250)
    return () => clearInterval(timer)
  }, [phase, paused, stems])

  return {
    steps,
    phase,
    current: currentStep(steps),
    run: () => dispatch({ type: 'run', now: Date.now(), stems }),
    approve: () => dispatch({ type: 'approve', now: Date.now(), stems }),
    retry: () => dispatch({ type: 'retry', now: Date.now(), stems }),
    reset: () => dispatch({ type: 'reset', now: Date.now(), stems }),
  }
}

// Fraction of the whole run that's done, weighted by how long each step takes.
export function overallProgress(steps: StepState[]): number {
  const total = STEPS.reduce((sum, def) => sum + def.demoSeconds, 0)
  const done = steps.reduce((sum, step, i) => {
    if (step.status === 'done' || step.status === 'skipped' || step.status === 'needs') return sum + STEPS[i].demoSeconds
    if (step.status === 'running') return sum + (STEPS[i].demoSeconds * step.progress) / 100
    return sum
  }, 0)
  return done / total
}

// Rough time left, from each step's expected length.
export function secondsLeft(steps: StepState[]): number {
  return steps.reduce((sum, step, i) => {
    if (step.status === 'queued' || step.status === 'failed') return sum + STEPS[i].demoSeconds
    if (step.status === 'running') return sum + (1 - step.progress / 100) * STEPS[i].demoSeconds
    return sum
  }, 0)
}

export function mmss(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`
}
