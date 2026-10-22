import { describe, expect, it } from 'vitest'
import { beatStarsKey, beatStarsTitle } from './beatstars'

// BeatStars' Key list, read from the track form on 2026-10-20 (leaving out NONE).
const ON_BEATSTARS = [
  'A_FLAT_MINOR', 'A_FLAT_MAJOR', 'A_MINOR', 'A_MAJOR', 'A_SHARP_MINOR', 'A_SHARP_MAJOR', 'B_FLAT_MINOR', 'B_FLAT_MAJOR', 'B_MINOR',
  'B_MAJOR', 'C_FLAT_MAJOR', 'C_MINOR', 'C_MAJOR', 'C_SHARP_MINOR', 'C_SHARP_MAJOR', 'D_FLAT_MINOR', 'D_FLAT_MAJOR', 'D_MINOR',
  'D_MAJOR', 'D_SHARP_MINOR', 'D_SHARP_MAJOR', 'E_FLAT_MINOR', 'E_FLAT_MAJOR', 'E_MINOR', 'E_MAJOR', 'F_MINOR', 'F_MAJOR',
  'F_SHARP_MINOR', 'F_SHARP_MAJOR', 'G_FLAT_MAJOR', 'G_MINOR', 'G_MAJOR', 'G_SHARP_MINOR', 'G_SHARP_MAJOR',
]

describe('beatStarsTitle', () => {
  it("writes the user's title, with every word of the name capitalized", () => {
    expect(beatStarsTitle('roadster')).toBe('Roadster [BUY 2, GET 1] - Rich Amiri Type Beat') // as published, 2026-10-20
    expect(beatStarsTitle(' 8  bit ')).toBe('8 Bit [BUY 2, GET 1] - Rich Amiri Type Beat')
    expect(beatStarsTitle('DnB dreams')).toBe('DnB Dreams [BUY 2, GET 1] - Rich Amiri Type Beat')
  })

  it('switches to the short form over 60 characters', () => {
    const longest = beatStarsTitle('x'.repeat(22)) // the longest name the full form fits
    expect(longest).toHaveLength(60)
    expect(longest).toContain('- Rich Amiri Type Beat')
    expect(beatStarsTitle('somethings never change')).toBe('Somethings Never Change [BUY 2 GET 1] Amiri Type Beat')
  })

  it('gives up when even the short form is too long', () => {
    expect(beatStarsTitle('x'.repeat(30))).toHaveLength(60)
    expect(beatStarsTitle('x'.repeat(31))).toBeNull()
    expect(beatStarsTitle('  ')).toBeNull()
  })
})

describe('beatStarsKey', () => {
  it('names the key the way BeatStars lists it', () => {
    expect(beatStarsKey({ tonic: 'D#', mode: 'minor' })).toBe('D_SHARP_MINOR') // roadster, from the recording
    expect(beatStarsKey({ tonic: 'F', mode: 'minor' })).toBe('F_MINOR')
    expect(beatStarsKey({ tonic: 'Bb', mode: 'major' })).toBe('B_FLAT_MAJOR')
    expect(beatStarsKey({ tonic: 'Cb', mode: 'major' })).toBe('C_FLAT_MAJOR')
  })

  it('uses the other name for keys BeatStars leaves out', () => {
    expect(beatStarsKey({ tonic: 'Gb', mode: 'minor' })).toBe('F_SHARP_MINOR')
    expect(beatStarsKey({ tonic: 'Cb', mode: 'minor' })).toBe('B_MINOR')
    expect(beatStarsKey({ tonic: 'E#', mode: 'major' })).toBe('F_MAJOR')
    expect(beatStarsKey({ tonic: 'B#', mode: 'minor' })).toBe('C_MINOR')
    expect(beatStarsKey({ tonic: 'Fb', mode: 'major' })).toBe('E_MAJOR')
  })

  it('only ever picks a key on the list, and can reach every one', () => {
    const picked = new Set<string | null>()
    for (const letter of 'ABCDEFG')
      for (const accidental of ['', '#', 'b'])
        for (const mode of ['major', 'minor'] as const) picked.add(beatStarsKey({ tonic: letter + accidental, mode }))
    expect([...picked].sort()).toEqual([...ON_BEATSTARS].sort())
  })

  it('needs major or minor', () => {
    expect(beatStarsKey({ tonic: 'Eb', mode: null })).toBeNull()
  })
})
