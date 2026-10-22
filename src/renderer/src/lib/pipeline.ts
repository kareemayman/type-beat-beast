import { useEffect, useReducer, useRef } from 'react'
import { AudioWaveform, CalendarClock, Clapperboard, Music2, Package, Sparkles, Store, type LucideIcon } from 'lucide-react'
import type { Done, RealStep, RunRequest, StepResult } from '../../../shared/api'

// The renders, the stems, BeatStars and tidying up are real: the main process does them (src/main/run.ts). YouTube
// is still simulated with made-up timings until Phase 4; DEMO marks the places that say so.
export const DEMO = true

export type StepId = 'wav' | 'mp3' | 'rar' | 'bs' | 'ytv' | 'yts' | 'tidy'
export type StepStatus = 'queued' | 'running' | 'needs' | 'done' | 'failed' | 'skipped'
export type Phase = 'idle' | 'running' | 'needs' | 'failed' | 'done'

export interface StepState {
  status: StepStatus
  progress: number // 0–100; for a real step, an estimate until it finishes
  seconds: number // time spent so far
  startedAt: number | null
  log?: string[] // what a real step did, from the main process
  error?: string // why a real step failed
  approved?: boolean // BeatStars: the user OK'd the draft, so the step is publishing it
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
  real: boolean // done by the main process; otherwise simulated here
  running(ctx: LogContext, step: StepState): string // headline while it runs
  needs?: string // headline while it waits for the user
  failed?: string // headline when a simulated step fails
  seconds: number // about how long it takes, for the progress estimate and the time left
  demoTicks?: number // simulated steps: how many 250 ms ticks they take
  log?(ctx: LogContext): string[] // simulated steps: made-up log lines
}

export const STEPS: StepDef[] = [
  { id: 'wav', short: 'WAV + stems', icon: AudioWaveform, real: true, seconds: 45, running: () => 'Cooking the stems…' },
  {
    id: 'mp3', short: 'Tagged MP3', icon: Music2, real: true, seconds: 40,
    running: (c) => (c.tagTrack ? `Bouncing the 808s… tag on ${c.tagTrack}` : 'Bouncing the 808s…'),
  },
  { id: 'rar', short: 'Pack stems', icon: Package, real: true, seconds: 15, running: () => 'Wrapping the stems for delivery' },
  // Filled in first, then it waits for the user's OK ("needs"); once OK'd, the same step publishes.
  {
    id: 'bs', short: 'BeatStars', icon: Store, real: true, seconds: 150,
    running: (_ctx, step) => (step.approved ? 'Publishing on BeatStars…' : 'Filling in BeatStars…'),
    needs: 'Your turn: check BeatStars before it goes live',
  },
  {
    id: 'ytv', short: 'YouTube video', icon: Clapperboard, real: false, seconds: 71, demoTicks: 20,
    running: () => 'Pressing the video…',
    failed: "Couldn't read the cover. Use a JPG or PNG, then retry.",
    log: () => ['Cover + tagged MP3 going in', 'Video done, 1080p'],
  },
  {
    id: 'yts', short: 'Schedule', icon: CalendarClock, real: false, seconds: 6, demoTicks: 8,
    running: () => 'Finding a slot…',
    log: () => ['Found the next free slot', 'Uploaded and scheduled'],
  },
  { id: 'tidy', short: 'Tidy up', icon: Sparkles, real: true, seconds: 1, running: () => 'Sweeping up…' },
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

type Action =
  | { type: 'run' | 'tick' | 'approve' | 'retry' | 'reset'; now: number; stems: boolean }
  | { type: 'finish'; index: number; log: string[]; now: number; stems: boolean }
  | { type: 'fail'; index: number; error: string }

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

function reducer(steps: StepState[], action: Action): StepState[] {
  const next = steps.slice()
  if (action.type === 'reset') return STEPS.map(queued)
  if (action.type === 'run') return STEPS.map((_, i) => (i === 0 ? running(action.now) : queued()))

  // A real step's answer from the main process. One for a step that isn't running any more (stopped) is dropped.
  if (action.type === 'finish' || action.type === 'fail') {
    const step = steps[action.index]
    if (step.status !== 'running') return steps
    if (action.type === 'fail') {
      next[action.index] = { ...step, status: 'failed', error: action.error }
      return next
    }
    const seconds = (action.now - (step.startedAt ?? action.now)) / 1000
    // BeatStars, filled in: it waits for the user's OK before anything goes public.
    if (STEPS[action.index].id === 'bs' && !step.approved) {
      next[action.index] = { ...step, status: 'needs', progress: 100, seconds, log: action.log }
      return next
    }
    // Publishing adds its lines to the fill-in's.
    next[action.index] = { ...step, status: 'done', progress: 100, seconds, log: step.approved ? [...(step.log ?? []), ...action.log] : action.log }
    startAfter(next, action.index, action.now, action.stems)
    return next
  }

  if (action.type === 'tick') {
    const i = steps.findIndex((s) => s.status === 'running')
    if (i < 0) return steps
    const def = STEPS[i]
    // A real step only reports when it ends; meanwhile its bar creeps toward 95% at the expected pace.
    if (def.real) {
      const seconds = (action.now - (steps[i].startedAt ?? action.now)) / 1000
      next[i] = { ...steps[i], seconds, progress: Math.min(95, (seconds / def.seconds) * 100) }
      return next
    }
    const ticks = def.demoTicks ?? 1
    const step = { ...steps[i], progress: Math.min(100, steps[i].progress + 100 / ticks), seconds: steps[i].seconds + def.seconds / ticks }
    next[i] = step
    if (step.progress < 100) return next
    next[i] = { ...step, status: 'done' }
    startAfter(next, i, action.now, action.stems)
    return next
  }

  // The user's OK on the BeatStars review: the step runs again in the main process, this time to publish.
  if (action.type === 'approve') {
    const i = steps.findIndex((s) => s.status === 'needs')
    if (i < 0) return steps
    next[i] = { ...running(action.now), approved: true, log: steps[i].log }
    return next
  }

  // retry: the failed step again. BeatStars remembers whether it failed filling in or publishing.
  const i = steps.findIndex((s) => s.status === 'failed')
  if (i < 0) return steps
  next[i] = { ...running(action.now), approved: steps[i].approved, log: steps[i].approved ? steps[i].log : undefined }
  return next
}

export interface Pipeline {
  steps: StepState[]
  phase: Phase
  current: number
  run(request: RunRequest): void
  approve(): void
  retry(): void
  reset(): void
  showBeatStars(): Promise<Done> // "Open in browser" on the review
}

export function usePipeline({ stems, paused }: { stems: boolean; paused: boolean }): Pipeline {
  const [steps, dispatch] = useReducer(reducer, undefined, () => STEPS.map(queued))
  const phase = phaseOf(steps)
  const request = useRef<RunRequest | null>(null) // what the current run is for
  const runId = useRef<string | null>(null) // the main process's run, once it has started
  const generation = useRef(0) // goes up with each Run and Stop, so answers meant for an earlier run are dropped
  const handedOver = useRef('') // the last step start sent to the main process (React may run an effect twice)

  // Four times a second: progress for the running step, real or simulated. It pauses while the window is
  // hidden; a real step keeps going in the main process and its time catches up.
  useEffect(() => {
    if (phase !== 'running' || paused) return
    const timer = setInterval(() => dispatch({ type: 'tick', now: Date.now(), stems }), 250)
    return () => clearInterval(timer)
  }, [phase, paused, stems])

  // When a real step starts, the main process does it, starting the run first if needed. Its answer finishes or
  // fails the step.
  const index = steps.findIndex((s) => s.status === 'running')
  const startKey = index >= 0 && STEPS[index].real ? `${index}@${steps[index].startedAt}` : ''
  // What the main process does for it: the step itself, or "publish" once the user has OK'd BeatStars.
  const realStep: RealStep | null = startKey ? (steps[index].approved ? 'publish' : (STEPS[index].id as RealStep)) : null
  useEffect(() => {
    if (!startKey || !realStep || handedOver.current === startKey || !request.current) return
    handedOver.current = startKey
    const runRequest = request.current
    const asOf = generation.current
    void (async () => {
      if (!runId.current) {
        const started = await window.api.startRun(runRequest)
        if (asOf !== generation.current) return started.ok && window.api.stopRun(started.id)
        if (!started.ok) return dispatch({ type: 'fail', index, error: started.error })
        runId.current = started.id
      }
      const result: StepResult = await window.api.runStep(runId.current, realStep)
      if (asOf !== generation.current) return
      if (result.ok && realStep === 'tidy') runId.current = null // the run is over in the main process
      dispatch(result.ok ? { type: 'finish', index, log: result.log, now: Date.now(), stems: runRequest.stems } : { type: 'fail', index, error: result.error })
    })()
  }, [startKey, index, realStep])

  // Drops the current run: the main process stops it (closing FL if it's rendering) and clears its temp files.
  function stop() {
    generation.current++
    if (runId.current) window.api.stopRun(runId.current)
    runId.current = null
  }

  return {
    steps,
    phase,
    current: currentStep(steps),
    run: (runRequest) => {
      stop()
      request.current = runRequest
      dispatch({ type: 'run', now: Date.now(), stems })
    },
    approve: () => dispatch({ type: 'approve', now: Date.now(), stems }),
    retry: () => dispatch({ type: 'retry', now: Date.now(), stems }),
    reset: () => {
      stop()
      dispatch({ type: 'reset', now: Date.now(), stems })
    },
    showBeatStars: () => (runId.current ? window.api.showBeatStars(runId.current) : Promise.resolve({ ok: false, error: "There's no BeatStars draft yet." })),
  }
}

// Fraction of the whole run that's done, weighted by how long each step takes.
export function overallProgress(steps: StepState[]): number {
  const total = STEPS.reduce((sum, def) => sum + def.seconds, 0)
  const done = steps.reduce((sum, step, i) => {
    if (step.status === 'done' || step.status === 'skipped' || step.status === 'needs') return sum + STEPS[i].seconds
    if (step.status === 'running') return sum + (STEPS[i].seconds * step.progress) / 100
    return sum
  }, 0)
  return done / total
}

// Rough time left, from each step's expected length.
export function secondsLeft(steps: StepState[]): number {
  return steps.reduce((sum, step, i) => {
    if (step.status === 'queued' || step.status === 'failed') return sum + STEPS[i].seconds
    if (step.status === 'running') return sum + (1 - step.progress / 100) * STEPS[i].seconds
    return sum
  }, 0)
}

export function mmss(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`
}
