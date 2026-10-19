// Packs the stems into "<beat name>.rar" with WinRAR, named the way the user names them: "<project> - Track 1.wav",
// "<project> - Track 2.wav" and so on, in mixer order (see CLAUDE.md, "Beat folder").
import { execFile } from 'node:child_process'
import { rename, rm, stat } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'
import { promisify } from 'node:util'
import type { MixerTrack } from '../shared/project'
import { readRegistry } from './registry'

const execFileAsync = promisify(execFile)

export interface Stem {
  file: string // the WAV FL wrote: "<project>_<mixer track name>.wav"
  as: string // its name in the RAR: "<project> - Track <n>.wav"
}

// Numbers the stems in mixer order, so "Track 1" is the first mixer track that played. A file whose track can't be
// matched by name (FL may write some characters differently) goes after the others, in name order.
export function stemNames(files: string[], project: string, tracks: MixerTrack[]): Stem[] {
  const mixerIndex = (file: string) => {
    const trackName = basename(file).slice(project.length + 1, -'.wav'.length).toLowerCase()
    return tracks.find((track) => track.name.toLowerCase() === trackName)?.index ?? Infinity
  }
  return [...files]
    .sort((a, b) => mixerIndex(a) - mixerIndex(b) || basename(a).localeCompare(basename(b)))
    .map((file, i) => ({ file, as: `${project} - Track ${i + 1}.wav` }))
}

const exists = (path: string) =>
  stat(path).then(
    () => true,
    () => false,
  )

// WinRAR's command-line program, Rar.exe, sits next to WinRAR.exe, whose path WinRAR's installer records.
export async function findRar(): Promise<string> {
  const winrar = await readRegistry('HKLM\\SOFTWARE\\WinRAR', 'exe64')
  const candidates = [winrar && join(dirname(winrar), 'Rar.exe'), 'C:\\Program Files\\WinRAR\\Rar.exe', 'C:\\Program Files (x86)\\WinRAR\\Rar.exe']
  for (const path of candidates) if (path && (await exists(path))) return path
  throw new Error("Couldn't find WinRAR. Install it, or turn stems off for this beat.")
}

// Renames the stems to their RAR names (they're the app's own temporary files) and packs them into `archive` with
// WinRAR's usual settings (RAR5, normal compression) and no folder paths inside. An archive already at that spot
// is replaced, never added to.
export async function packStems(rar: string, stems: Stem[], archive: string): Promise<void> {
  if (!stems.length) throw new Error('There are no stems to pack.')
  const files: string[] = []
  for (const stem of stems) {
    const renamed = join(dirname(stem.file), stem.as)
    if (renamed !== stem.file) await rename(stem.file, renamed)
    files.push(renamed)
  }
  await rm(archive, { force: true })
  // a = add to a new archive, -ep = no paths inside, -idq = only errors, -y = yes to any question.
  await execFileAsync(rar, ['a', '-ep', '-idq', '-y', archive, ...files]).catch((error: { stderr?: string; message: string }) => {
    throw new Error(`WinRAR couldn't pack the stems: ${error.stderr?.trim() || error.message}`)
  })
  if (!(await exists(archive))) throw new Error('WinRAR finished without writing the stems archive.')
}
