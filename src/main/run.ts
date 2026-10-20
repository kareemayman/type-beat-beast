// A beat's run in the main process: the steps that are real so far (both renders, the stems, tidying up). The page
// asks for one step at a time, so it can show each as it goes, retry a failed one, or stop the run.
import { randomUUID } from 'node:crypto'
import { copyFile, mkdtemp, rename, rm, unlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, extname, join } from 'node:path'
import type { RealStep, RunRequest, RunStart, StepResult } from '../shared/api'
import type { MixerTrack } from '../shared/project'
import { DEFAULT_SETTINGS } from '../shared/settings'
import { beatFiles, createBeatFolder, type BeatFiles } from './beatFolder'
import { findFlStudio } from './flStudio'
import { readProject } from './project'
import { renderTagged, renderUntagged, type RenderJob } from './render'
import { loadSettings } from './settings'
import { findPacker, packStems, stemNames, type Stem } from './stems'

interface Run {
  id: string
  request: RunRequest
  files: BeatFiles // the plan until the WAV step makes the folder, then the real paths
  tracks: MixerTrack[]
  job: RenderJob
  abort: AbortController
  stems: Stem[] | null // what the split render wrote, waiting to be packed
  busy: Promise<unknown> | null // the step in progress
}

const runs = new Map<string, Run>()
const REAL_STEPS: RealStep[] = ['wav', 'mp3', 'rar', 'tidy']

// The page's request, checked like any input from the page: only a well-formed one gets through.
export function cleanRunRequest(value: unknown): RunRequest | null {
  const v = (typeof value === 'object' && value !== null ? value : {}) as Record<string, unknown>
  const tagIndex = v.tagIndex === null || (Number.isInteger(v.tagIndex) && (v.tagIndex as number) >= 1 && (v.tagIndex as number) <= 125) ? (v.tagIndex as number | null) : undefined
  if (typeof v.project !== 'string' || !/\.flp$/i.test(v.project) || typeof v.beatName !== 'string' || tagIndex === undefined || typeof v.stems !== 'boolean') return null
  return { project: v.project, beatName: v.beatName, tagIndex, stems: v.stems }
}

export const isRealStep = (value: unknown): value is RealStep => REAL_STEPS.includes(value as RealStep)

export async function startRun(request: RunRequest, backupFile: string): Promise<RunStart> {
  const fl = await findFlStudio()
  if (!fl.ok) return { ok: false, error: `${fl.error} (Settings → Paths)` }
  const project = await readProject(request.project)
  if (!project.ok) return { ok: false, error: project.error }
  const settings = (await loadSettings()) ?? DEFAULT_SETTINGS
  const abort = new AbortController()
  const id = randomUUID()
  runs.set(id, {
    id,
    request,
    files: beatFiles(request.project, request.beatName, settings.outputFolder),
    tracks: project.project.tracks,
    abort,
    stems: null,
    busy: null,
    job: {
      flPath: fl.path,
      flVersion: fl.version ?? project.project.flVersion ?? '21',
      project: request.project,
      tagIndex: request.tagIndex,
      stems: request.stems,
      quality: { wavBits: settings.wavBits, mp3Rate: settings.mp3Rate },
      work: await mkdtemp(join(tmpdir(), 'tbb-run-')),
      backupFile,
      signal: abort.signal,
    },
  })
  return { ok: true, id }
}

export async function runStep(id: string, step: RealStep): Promise<StepResult> {
  const run = runs.get(id)
  if (!run) return { ok: false, error: 'This run has ended. Press Run to start again.' }
  try {
    run.busy = STEPS[step](run)
    return { ok: true, log: (await run.busy) as string[] }
  } catch (error) {
    return { ok: false, error: run.abort.signal.aborted ? 'Stopped.' : error instanceof Error ? error.message : String(error) }
  } finally {
    run.busy = null
  }
}

// Stops a run: closes FL if it's rendering (the user's Export choices still go back), waits for the step to end,
// then deletes the run's temporary files. Files already in the beat folder stay.
export async function stopRun(id: string): Promise<void> {
  const run = runs.get(id)
  if (!run) return
  runs.delete(id)
  run.abort.abort()
  await run.busy?.catch(() => {})
  await rm(run.job.work, { recursive: true, force: true })
}

const project = (run: Run) => basename(run.request.project, extname(run.request.project))
const took = (since: number) => `${Math.round((Date.now() - since) / 1000)} s`

const STEPS: Record<RealStep, (run: Run) => Promise<string[]>> = {
  // The untagged WAV, plus the stems when they're on, from one render of a copy with the tag muted.
  async wav(run) {
    const started = Date.now()
    const { wav, stems } = await renderUntagged(run.job)
    run.files = await createBeatFolder(run.files, run.request.project)
    await move(wav, run.files.wav)
    run.stems = run.request.stems ? stemNames(stems, project(run), run.tracks) : null
    return [
      run.request.tagIndex === null ? 'No tag track to mute' : `Muted the tag on mixer track ${run.request.tagIndex}`,
      `Rendered ${basename(run.files.wav)} in ${took(started)}`,
      run.stems ? `${run.stems.length} stems, one per mixer track that plays` : 'Stems are off, so one plain render',
      `Saved in ${run.files.folder}`,
    ]
  },

  // The tagged MP3, from a copy with the tag on.
  async mp3(run) {
    const started = Date.now()
    const mp3 = await renderTagged(run.job)
    run.files = await createBeatFolder(run.files, run.request.project)
    await move(mp3, run.files.taggedMp3)
    return [
      run.request.tagIndex === null ? 'No tag track, so this MP3 has no tag' : `Tag on, from mixer track ${run.request.tagIndex}`,
      `Rendered ${basename(run.files.taggedMp3)} in ${took(started)}`,
    ]
  },

  // The stems, packed with WinRAR (or into a ZIP without it) straight into the beat folder.
  async rar(run) {
    if (!run.stems) throw new Error('The stems come from the WAV step. Start over to render them.')
    const started = Date.now()
    const packer = await findPacker()
    const archive = await packStems(packer, run.stems, run.files.stems, run.abort.signal)
    return [
      `Packed ${run.stems.length} stems into ${basename(archive)} in ${took(started)}`,
      ...(packer.kind === 'zip' ? ["WinRAR isn't installed, so it's a ZIP"] : []),
    ]
  },

  // The end of the run: its temporary files go. The .flp and the cover move into the beat folder only once
  // BeatStars and YouTube are real and everything has published.
  async tidy(run) {
    await rm(run.job.work, { recursive: true, force: true })
    runs.delete(run.id)
    return ['Cleared the temporary files', `Everything is in ${run.files.folder}`, 'The .flp and cover stay put until publishing is real']
  },
}

// Moves a file, also from one drive to another (the work folder is in Windows' temp folder, beat folders can be
// anywhere). A file already at the destination is replaced.
async function move(from: string, to: string): Promise<void> {
  try {
    await rename(from, to)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EXDEV') throw error
    await copyFile(from, to)
    await unlink(from)
  }
}
