import { describe, expect, it } from 'vitest'
import { exeVersion, registryValue } from './flStudio'

// A fake .exe tail: the VS_VERSION_INFO marker, padding, then the fixed version block for 21.0.3.3517.
function fakeExe(): Buffer {
  const fixed = Buffer.alloc(16)
  fixed.writeUInt32LE(0xfeef04bd, 0) // signature
  fixed.writeUInt32LE(0x00010000, 4) // structure version
  fixed.writeUInt32LE((21 << 16) | 0, 8) // 21.0
  fixed.writeUInt32LE((3 << 16) | 3517, 12) // .3, build 3517
  return Buffer.concat([Buffer.alloc(64, 0x90), Buffer.from('VS_VERSION_INFO', 'utf16le'), Buffer.alloc(4), fixed])
}

describe('exeVersion', () => {
  it('reads major.minor.patch from the version block', () => {
    expect(exeVersion(fakeExe())).toBe('21.0.3')
  })

  it('gives null when there is no version block', () => {
    expect(exeVersion(Buffer.alloc(256))).toBeNull()
  })
})

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
