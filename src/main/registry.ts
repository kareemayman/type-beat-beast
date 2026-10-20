// The Windows registry, through Windows' own reg.exe: where FL Studio's installer records its path, and where
// FL keeps the choices from its Export window.
import { execFile } from 'node:child_process'
import { join } from 'node:path'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)
const REG = join(process.env['SystemRoot'] ?? 'C:\\Windows', 'System32', 'reg.exe')

// Picks one value out of `reg query` output, where each value is a line like "    FL Studio    REG_SZ    F:\...".
export function registryValue(output: string, name: string): string | null {
  for (const line of output.split(/\r?\n/)) {
    const match = /^\s+(.+?)\s+REG_\w+\s+(.*)$/.exec(line)
    if (match?.[1] === name) return match[2].trim()
  }
  return null
}

// A value, or null when the key or value doesn't exist (reg fails then).
export async function readRegistry(key: string, name: string): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync(REG, ['query', key, '/v', name])
    return registryValue(stdout, name)
  } catch {
    return null
  }
}

// A key's unnamed default value (what reg shows as "(Default)", a name Windows translates, so it isn't matched).
export async function readRegistryDefault(key: string): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync(REG, ['query', key, '/ve'])
    return /\sREG_\w+\s+(.*)$/m.exec(stdout)?.[1].trim() || null
  } catch {
    return null
  }
}

// Writes a text value (REG_SZ), creating the key if needed.
export async function writeRegistry(key: string, name: string, value: string): Promise<void> {
  await execFileAsync(REG, ['add', key, '/v', name, '/t', 'REG_SZ', '/d', value, '/f'])
}

export async function deleteRegistry(key: string, name: string): Promise<void> {
  await execFileAsync(REG, ['delete', key, '/v', name, '/f']).catch(() => {}) // already gone is fine
}
