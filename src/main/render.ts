// Renders with FL Studio's command line (see CLAUDE.md, "FL Studio command line"). Each render works on its own
// copy of the project with the tag switched as needed, and FL's Export choices are set just for that render.
import { execFile, spawn } from 'node:child_process'
import { mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { basename, extname, join } from 'node:path'
import { promisify } from 'node:util'
import type { Settings } from '../shared/settings'
import { copyProject } from './project'
import { deleteRegistry, readRegistry, writeRegistry } from './registry'

const execFileAsync = promisify(execFile)
const RENDER_TIMEOUT = 10 * 60_000

// The Export window's choices a command-line render uses, as FL stores them in the registry.
const WAV_BITS: Record<Settings['wavBits'], string> = { '16': '0', '24': '1', '32f': '2' }
const MP3_RATES: Record<Settings['mp3Rate'], string> = { '192': '10', '256': '12', '320': '13' }
const exportKey = (flVersion: string) => `HKCU\\SOFTWARE\\Image-Line\\FL Studio ${flVersion.split('.')[0]}\\General\\WAVRenderForm`

export interface RenderJob {
  flPath: string // FL64.exe
  flVersion: string // like "21.0.3"; its major number names FL's registry key
  project: string // the user's .flp, only ever read
  tagIndex: number | null // the tag's mixer track, or null for no tag
  stems: boolean
  quality: Pick<Settings, 'wavBits' | 'mp3Rate'>
  work: string // a folder of the app's own for the project copies and what FL writes
  backupFile: string // where the user's own Export choices wait during a render
  signal?: AbortSignal // stops the render: FL gets closed, and the user's Export choices still go back
}

// The untagged render: a copy with the tag muted, to WAV. With stems on, FL splits the mixer: its Master track
// is the WAV and every other track that plays is a stem. Everything stays in `work` for the next steps.
export async function renderUntagged(job: RenderJob): Promise<{ wav: string; stems: string[] }> {
  const { folder, copy, name } = await prepareCopy(job, 'untagged', false)
  await render(job, copy, 'wav', job.stems)
  const wav = await written(join(folder, job.stems ? `${name}_Master.wav` : `${name}.wav`))
  const stems = job.stems ? stemFiles(await readdir(folder), name).map((file) => join(folder, file)) : []
  return { wav, stems }
}

// The tagged render: a copy with the tag on, to MP3.
export async function renderTagged(job: RenderJob): Promise<string> {
  const { folder, copy, name } = await prepareCopy(job, 'tagged', true)
  await render(job, copy, 'mp3', false)
  return written(join(folder, `${name}.mp3`))
}

// What a split render wrote for each mixer track, as "<project>_<track name>.wav": everything but the Master
// (that's the WAV) and FL's "Current" track (not a real track).
export function stemFiles(files: string[], name: string): string[] {
  const skip = new Set([`${name}_Master.wav`, `${name}_Current.wav`].map((file) => file.toLowerCase()))
  return files.filter((file) => file.toLowerCase().startsWith(`${name.toLowerCase()}_`) && /\.wav$/i.test(file) && !skip.has(file.toLowerCase()))
}

// Is FL Studio open? A render needs it closed: the open FL would get in the way, and on closing it may write its
// own Export choices back over the ones set for the render.
export async function isFlRunning(): Promise<boolean> {
  const { stdout } = await execFileAsync(join(process.env['SystemRoot'] ?? 'C:\\Windows', 'System32', 'tasklist.exe'), ['/FO', 'CSV', '/NH'])
  return /^"(fl64|fl)\.exe"/im.test(stdout)
}

// Each render gets a fresh folder in `work` holding a copy of the project under its own name, because FL names
// what it writes after the project.
async function prepareCopy(job: RenderJob, kind: 'untagged' | 'tagged', tagOn: boolean) {
  const folder = join(job.work, kind)
  const copy = join(folder, basename(job.project))
  await rm(folder, { recursive: true, force: true })
  await mkdir(folder, { recursive: true })
  await copyProject(job.project, copy, job.tagIndex === null ? null : { index: job.tagIndex, on: tagOn })
  return { folder, copy, name: basename(job.project, extname(job.project)) }
}

async function render(job: RenderJob, copy: string, format: 'wav' | 'mp3', split: boolean): Promise<void> {
  job.signal?.throwIfAborted()
  if (await isFlRunning()) throw new Error('FL Studio is open. Save your work, close FL, then retry.')
  const choices = { WFBox: WAV_BITS[job.quality.wavBits], MP3BitrateSlider: MP3_RATES[job.quality.mp3Rate], BatchBox: split ? '1' : '0' }
  await withExportChoices(exportKey(job.flVersion), choices, job.backupFile, () => runFl(job.flPath, copy, format, job.signal))
}

// One render with FL's command line: /R renders and then closes FL, /E picks the format, and FL writes next to
// the project. Resolves once FL has closed. If FL is still open after the timeout (usually it's waiting on a
// dialog, like a missing plugin), it gets closed and the render fails. The signal closes FL right away.
function runFl(flPath: string, project: string, format: 'wav' | 'mp3', signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const fl = spawn(flPath, ['/R', `/E${format}`, project], { stdio: 'ignore', signal })
    const timer = setTimeout(() => {
      fl.kill()
      reject(new Error(`FL Studio didn't finish the ${format.toUpperCase()} render in ${RENDER_TIMEOUT / 60_000} minutes. Check FL for a message (a missing plugin or sample?), then retry.`))
    }, RENDER_TIMEOUT)
    fl.on('error', (error) => {
      clearTimeout(timer)
      reject(error)
    })
    fl.on('exit', () => {
      clearTimeout(timer)
      resolve()
    })
  })
}

async function written(file: string): Promise<string> {
  const found = await stat(file).then(
    (info) => info.size > 0,
    () => false,
  )
  if (!found) throw new Error(`FL Studio closed without writing ${basename(file)}.`)
  return file
}

interface ExportBackup {
  key: string
  values: Record<string, string | null> // null: the value didn't exist before
}

// Sets FL's Export choices for one render and always puts the user's own back afterwards. The user's values go
// into `backupFile` first, so if the app dies mid-render, the next start can still put them back.
export async function withExportChoices<T>(key: string, choices: Record<string, string>, backupFile: string, render: () => Promise<T>): Promise<T> {
  await restoreExportChoices(backupFile) // a backup left by a crash holds the user's real values: restore those first
  const backup: ExportBackup = { key, values: {} }
  for (const name of Object.keys(choices)) backup.values[name] = await readRegistry(key, name)
  await writeFile(backupFile, JSON.stringify(backup, null, 2))
  try {
    for (const [name, value] of Object.entries(choices)) await writeRegistry(key, name, value)
    return await render()
  } finally {
    await restoreExportChoices(backupFile)
  }
}

// Puts the user's Export choices back from the backup file, if there is one, then deletes it.
export async function restoreExportChoices(backupFile: string): Promise<void> {
  let backup: ExportBackup
  try {
    backup = JSON.parse(await readFile(backupFile, 'utf8'))
  } catch {
    return // no backup, nothing to restore
  }
  for (const [name, value] of Object.entries(backup.values)) {
    if (value === null) await deleteRegistry(backup.key, name)
    else await writeRegistry(backup.key, name, value)
  }
  await rm(backupFile, { force: true })
}
