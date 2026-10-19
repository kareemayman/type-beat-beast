import { describe, expect, it } from 'vitest'
import { beatFiles, safeName } from './beatFolder'

describe('beatFiles', () => {
  it('puts a solo beat in a folder named after it, next to the .flp', () => {
    expect(beatFiles('F:\\Projects\\Beats 2026\\10\\flowers - 140 Em.flp', 'flowers', '')).toEqual({
      folder: 'F:\\Projects\\Beats 2026\\10\\flowers',
      flp: 'F:\\Projects\\Beats 2026\\10\\flowers\\flowers - 140 Em.flp',
      wav: 'F:\\Projects\\Beats 2026\\10\\flowers\\flowers - 140 Em.wav',
      taggedMp3: 'F:\\Projects\\Beats 2026\\10\\flowers\\flowers - 140 Em TAGGED.mp3',
      stems: 'F:\\Projects\\Beats 2026\\10\\flowers\\flowers.rar',
    })
  })

  it('names the files after the whole project, and the folder and stems after the beat', () => {
    const files = beatFiles('F:\\Beats\\kriko x welcomeCarson - ozempic - 132 Fmin.flp', 'ozempic', '')
    expect(files.folder).toBe('F:\\Beats\\ozempic')
    expect(files.wav).toBe('F:\\Beats\\ozempic\\kriko x welcomeCarson - ozempic - 132 Fmin.wav')
    expect(files.taggedMp3).toBe('F:\\Beats\\ozempic\\kriko x welcomeCarson - ozempic - 132 Fmin TAGGED.mp3')
    expect(files.stems).toBe('F:\\Beats\\ozempic\\ozempic.rar')
  })

  it('uses the output folder from Settings when one is picked', () => {
    expect(beatFiles('F:\\Projects\\8 bit - 151 D#m.flp', '8 bit', 'D:\\Beats\\Exports').folder).toBe('D:\\Beats\\Exports\\8 bit')
  })

  it('falls back to the project name when the beat name is empty', () => {
    expect(beatFiles('F:\\Projects\\untitled 3.flp', '  ', '').folder).toBe('F:\\Projects\\untitled 3')
  })
})

describe('safeName', () => {
  it('replaces characters Windows forbids', () => {
    expect(safeName('what/if: "maybe"?')).toBe('what-if- -maybe--')
  })

  it('drops the trailing dots and spaces Windows would drop', () => {
    expect(safeName('  flowers...  ')).toBe('flowers')
  })

  it('steers clear of device names', () => {
    expect(safeName('con')).toBe('con_')
    expect(safeName('COM1')).toBe('COM1_')
    expect(safeName('console')).toBe('console')
  })
})
