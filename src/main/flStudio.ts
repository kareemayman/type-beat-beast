import { dialog, type BrowserWindow, type OpenDialogOptions } from 'electron'
import { readFile } from 'node:fs/promises'
import { basename, dirname } from 'node:path'
import type { FlStudioStatus } from '../shared/api'
import { readRegistry } from './registry'
import { loadSettings, saveSettings } from './settings'

// The version Windows shows under Properties → Details, read from the .exe's own bytes: the fixed part of
// its VS_VERSION_INFO block starts with the signature 0xFEEF04BD, followed by the version numbers.
export function exeVersion(bytes: Buffer): string | null {
  const info = bytes.lastIndexOf(Buffer.from('VS_VERSION_INFO', 'utf16le'))
  const fixed = info < 0 ? -1 : bytes.indexOf(Buffer.from([0xbd, 0x04, 0xef, 0xfe]), info)
  if (fixed < 0 || fixed + 16 > bytes.length) return null
  const high = bytes.readUInt32LE(fixed + 8) // major, minor
  const low = bytes.readUInt32LE(fixed + 12) // patch, build
  return `${high >>> 16}.${high & 0xffff}.${low >>> 16}`
}

// Is this FL Studio's 64-bit program? Answers with its version when it is.
async function check(path: string): Promise<FlStudioStatus> {
  if (basename(path).toLowerCase() !== 'fl64.exe') return { ok: false, error: 'Pick FL64.exe, the program that starts FL Studio.' }
  try {
    return { ok: true, path, version: exeVersion(await readFile(path)) }
  } catch {
    return { ok: false, error: `FL Studio isn't at ${path} anymore. Use Browse to point to FL64.exe.` }
  }
}

// Where FL Studio is: the path in Settings while it still checks out, otherwise the one FL's installer wrote
// to the registry, which then gets saved.
export async function findFlStudio(): Promise<FlStudioStatus> {
  const saved = (await loadSettings())?.flPath
  if (saved) {
    const status = await check(saved)
    if (status.ok) return status
  }
  for (const hive of ['HKLM', 'HKCU']) {
    const path = await readRegistry(`${hive}\\SOFTWARE\\Image-Line\\Shared\\Paths`, 'FL Studio')
    const status = path ? await check(path) : null
    if (status?.ok) {
      await saveSettings({ flPath: status.path })
      return status
    }
  }
  return { ok: false, error: "Couldn't find FL Studio. Use Browse to point to FL64.exe." }
}

// Windows' own file dialog, so the user can point to FL64.exe. Saved when it checks out; null if they cancel.
export async function pickFlStudio(parent: BrowserWindow | null): Promise<FlStudioStatus | null> {
  const saved = (await loadSettings())?.flPath
  const options: OpenDialogOptions = {
    title: 'Where is FL64.exe?',
    defaultPath: saved ? dirname(saved) : 'C:\\Program Files\\Image-Line',
    filters: [{ name: 'FL Studio (FL64.exe)', extensions: ['exe'] }],
    properties: ['openFile'],
  }
  // Tied to the app's window, the dialog stays on top of it and blocks it until it's closed.
  const { canceled, filePaths } = parent ? await dialog.showOpenDialog(parent, options) : await dialog.showOpenDialog(options)
  if (canceled || !filePaths[0]) return null
  const status = await check(filePaths[0])
  if (status.ok) await saveSettings({ flPath: status.path })
  return status
}
