// Packs the stems into "<beat name>.rar" with WinRAR (or "<beat name>.zip" when WinRAR isn't installed), named the
// way the user names them: "<project> - Track 1.wav", "<project> - Track 2.wav" and so on, in mixer order (see
// CLAUDE.md, "Beat folder").
import { execFile } from 'node:child_process'
import { rename, rm, stat } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'
import { promisify } from 'node:util'
import type { MixerTrack } from '../shared/project'
import { readRegistry } from './registry'

const execFileAsync = promisify(execFile)
const POWERSHELL = join(process.env['SystemRoot'] ?? 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe')

export interface Stem {
  file: string // the WAV FL wrote: "<project>_<mixer track name>.wav"
  as: string // its name in the archive: "<project> - Track <n>.wav"
}

// What packs the stems: WinRAR's Rar.exe, or PowerShell's built-in Compress-Archive for a ZIP.
export type Packer = { kind: 'rar'; exe: string } | { kind: 'zip' }

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
// Null when WinRAR isn't installed.
export async function findRar(): Promise<string | null> {
  const winrar = await readRegistry('HKLM\\SOFTWARE\\WinRAR', 'exe64')
  const candidates = [winrar && join(dirname(winrar), 'Rar.exe'), 'C:\\Program Files\\WinRAR\\Rar.exe', 'C:\\Program Files (x86)\\WinRAR\\Rar.exe']
  for (const path of candidates) if (path && (await exists(path))) return path
  return null
}

// WinRAR when it's installed, otherwise a ZIP, which Windows makes and opens on its own. (Not with Windows'
// tar.exe: it crashes on file names with characters like "é".)
export async function findPacker(): Promise<Packer> {
  const rar = await findRar()
  return rar ? { kind: 'rar', exe: rar } : { kind: 'zip' }
}

// Renames the stems to their archive names (they're the app's own temporary files) and packs them, without folder
// paths inside, into `archive` with the packer's extension (.rar or .zip). An archive already at that spot is
// replaced, never added to. Answers with the archive's path.
export async function packStems(packer: Packer, stems: Stem[], archive: string): Promise<string> {
  if (!stems.length) throw new Error('There are no stems to pack.')
  const files: string[] = []
  for (const stem of stems) {
    const renamed = join(dirname(stem.file), stem.as)
    if (renamed !== stem.file) await rename(stem.file, renamed)
    files.push(renamed)
  }
  const target = `${archive.replace(/\.(rar|zip)$/i, '')}.${packer.kind}`
  await rm(target, { force: true })

  try {
    if (packer.kind === 'rar') {
      // a = add to a new archive, -ep = no paths inside, -idq = only errors, -y = yes to any question.
      await execFileAsync(packer.exe, ['a', '-ep', '-idq', '-y', target, ...files])
    } else {
      // The paths reach PowerShell as environment variables, never as part of the command, so no file name can
      // turn into code.
      const script = "$ErrorActionPreference = 'Stop'; $ProgressPreference = 'SilentlyContinue'; Compress-Archive -LiteralPath ($env:TBB_FILES | ConvertFrom-Json) -DestinationPath $env:TBB_ZIP -CompressionLevel Optimal"
      await execFileAsync(POWERSHELL, ['-NoProfile', '-NonInteractive', '-Command', script], { env: { ...process.env, TBB_FILES: JSON.stringify(files), TBB_ZIP: target } })
    }
  } catch (error) {
    const { stderr, message } = error as { stderr?: string; message: string }
    throw new Error(`${packer.kind === 'rar' ? 'WinRAR' : 'Windows'} couldn't pack the stems: ${stderr?.trim() || message}`)
  }
  if (!(await exists(target))) throw new Error('Packing finished without writing the stems archive.')
  return target
}
