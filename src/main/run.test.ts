import { describe, expect, it } from 'vitest'
import { cleanRunRequest, isRealStep } from './run'

describe('cleanRunRequest', () => {
  const good = {
    project: 'F:\\Projects\\Beats 2026\\10\\flowers - 140 Em.flp',
    beatName: 'flowers',
    tagIndex: 11,
    stems: true,
    bpm: 140,
    key: 'E min',
    cover: 'C:\\Users\\me\\Desktop\\rich amiri_.jpg',
    bsFile: 'mp3',
  }

  it('lets a well-formed request through', () => {
    expect(cleanRunRequest(good)).toEqual(good)
    expect(cleanRunRequest({ ...good, tagIndex: null, stems: false, bsFile: 'wav' })).toEqual({ ...good, tagIndex: null, stems: false, bsFile: 'wav' })
    expect(cleanRunRequest({ ...good, cover: 'D:\\Covers\\art.PNG' })).toEqual({ ...good, cover: 'D:\\Covers\\art.PNG' })
  })

  it('turns away anything else', () => {
    for (const bad of [
      null,
      'flowers',
      { ...good, project: 'C:\\Windows\\notepad.exe' },
      { ...good, tagIndex: 0 },
      { ...good, tagIndex: 126 },
      { ...good, tagIndex: '11' },
      { ...good, stems: 'yes' },
      { ...good, beatName: 42 },
      { ...good, bpm: 140.5 },
      { ...good, bpm: 20 },
      { ...good, key: 5 },
      { ...good, bsFile: 'flac' },
    ]) {
      expect(cleanRunRequest(bad)).toBeNull()
    }
  })

  it('only lets an image through as the cover, since it gets uploaded to BeatStars', () => {
    for (const cover of ['', 'C:\\Users\\me\\Documents\\passwords.txt', 'C:\\Users\\me\\cover.jpg.exe', 42]) expect(cleanRunRequest({ ...good, cover })).toBeNull()
  })

  it('keeps only the fields it knows', () => {
    expect(cleanRunRequest({ ...good, extra: 'ignored' })).toEqual(good)
  })
})

describe('isRealStep', () => {
  it('knows which steps the main process does', () => {
    expect(['wav', 'mp3', 'rar', 'bs', 'publish', 'tidy'].every(isRealStep)).toBe(true)
    expect(['ytv', 'yts', 'nope'].some(isRealStep)).toBe(false)
  })
})
