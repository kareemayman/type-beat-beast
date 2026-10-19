import { describe, expect, it } from 'vitest'
import { cleanSettings, DEFAULT_SETTINGS } from './settings'

describe('cleanSettings', () => {
  it('gives the defaults for nothing or junk', () => {
    expect(cleanSettings(undefined)).toEqual(DEFAULT_SETTINGS)
    expect(cleanSettings('not an object')).toEqual(DEFAULT_SETTINGS)
    expect(cleanSettings({})).toEqual(DEFAULT_SETTINGS)
  })

  it('keeps values of the right shape', () => {
    const saved = {
      themePref: 'system',
      stems: false,
      wavBits: '32f',
      publishTime: '20:30',
      tagNames: ['Purchase your tracks today'],
      flPath: 'F:\\Program Files\\Fl Studio 21\\FL64.exe',
      outputFolder: 'D:\\Beats\\Exports',
    }
    expect(cleanSettings(saved)).toEqual({ ...DEFAULT_SETTINGS, ...saved })
  })

  it('drops values of the wrong shape', () => {
    const saved = { themePref: 'blue', stems: 'yes', mp3Rate: 320, publishTime: '25:00', producerName: '  ', tagNames: 'tag', flPath: 42, outputFolder: null }
    expect(cleanSettings(saved)).toEqual(DEFAULT_SETTINGS)
  })

  it('falls back to the current settings, not the defaults, when a change is bad', () => {
    const current = { ...DEFAULT_SETTINGS, publishTime: '20:30', bsFile: 'wav' as const }
    expect(cleanSettings({ ...current, publishTime: 'later', stems: false }, current)).toEqual({ ...current, stems: false })
  })

  it('keeps only real tag names', () => {
    expect(cleanSettings({ tagNames: ['tag', '', '  ', 42, null, 'TAG 2'] }).tagNames).toEqual(['tag', 'TAG 2'])
  })

  it('ignores settings it no longer knows', () => {
    expect(cleanSettings({ sampleRate: '48' })).toEqual(DEFAULT_SETTINGS)
  })
})
