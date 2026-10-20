import { describe, expect, it } from 'vitest'
import { cleanRunRequest, isRealStep } from './run'

describe('cleanRunRequest', () => {
  const good = { project: 'F:\\Projects\\Beats 2026\\10\\flowers - 140 Em.flp', beatName: 'flowers', tagIndex: 11, stems: true }

  it('lets a well-formed request through', () => {
    expect(cleanRunRequest(good)).toEqual(good)
    expect(cleanRunRequest({ ...good, tagIndex: null, stems: false })).toEqual({ ...good, tagIndex: null, stems: false })
  })

  it('turns away anything else', () => {
    for (const bad of [null, 'flowers', { ...good, project: 'C:\\Windows\\notepad.exe' }, { ...good, tagIndex: 0 }, { ...good, tagIndex: 126 }, { ...good, tagIndex: '11' }, { ...good, stems: 'yes' }, { ...good, beatName: 42 }]) {
      expect(cleanRunRequest(bad)).toBeNull()
    }
  })

  it('keeps only the fields it knows', () => {
    expect(cleanRunRequest({ ...good, extra: 'ignored' })).toEqual(good)
  })
})

describe('isRealStep', () => {
  it('knows which steps the main process does', () => {
    expect(['wav', 'mp3', 'rar', 'tidy'].every(isRealStep)).toBe(true)
    expect(['bs', 'ytv', 'yts', 'nope'].some(isRealStep)).toBe(false)
  })
})
