import { describe, expect, it } from 'vitest'
import { registryValue } from './registry'

describe('registryValue', () => {
  const output = [
    '',
    'HKEY_LOCAL_MACHINE\\SOFTWARE\\Image-Line\\Shared\\Paths',
    '    FL Studio    REG_SZ    F:\\Program Files\\Fl Studio 21\\FL64.exe',
    '    FL Studio engine    REG_SZ    F:\\Program Files\\Fl Studio 21\\FLEngine_x64.dll',
    '',
  ].join('\r\n')

  it('finds the exact value name', () => {
    expect(registryValue(output, 'FL Studio')).toBe('F:\\Program Files\\Fl Studio 21\\FL64.exe')
    expect(registryValue(output, 'FL Studio engine')).toBe('F:\\Program Files\\Fl Studio 21\\FLEngine_x64.dll')
  })

  it("gives null for a value that isn't there", () => {
    expect(registryValue(output, 'VST plugins')).toBeNull()
  })
})
