import { describe, expect, it } from 'vitest'
import { keyLabel, parseBeatName, parseKey } from './parseBeatName'

function beat(fileName: string) {
  const result = parseBeatName(fileName)
  if (!result.ok) throw new Error(`expected "${fileName}" to parse, got: ${result.error}`)
  return result.beat
}

describe('parseBeatName', () => {
  it('reads a solo beat', () => {
    expect(beat('8 bit - 151 D#m.flp')).toEqual({ name: '8 bit', bpm: 151, key: { tonic: 'D#', mode: 'minor' }, producers: [] })
    expect(beat('flowers - 140 Em')).toMatchObject({ name: 'flowers', bpm: 140, key: { tonic: 'E', mode: 'minor' } })
  })

  it('reads producers before the beat name, main producer first', () => {
    expect(beat('kriko x welcomeCarson - ozempic - 132 Fmin')).toEqual({
      name: 'ozempic',
      bpm: 132,
      key: { tonic: 'F', mode: 'minor' },
      producers: ['kriko', 'welcomeCarson'],
    })
    expect(beat('kriko x A x B - name - 140 Cm').producers).toEqual(['kriko', 'A', 'B'])
  })

  it('handles a missing dash before the BPM', () => {
    expect(beat('kriko x welcomeCarson - mushroom 134 Gmin')).toMatchObject({ name: 'mushroom', bpm: 134, producers: ['kriko', 'welcomeCarson'] })
  })

  it('reads the key before the BPM too', () => {
    expect(beat('my city - Fmin 137')).toMatchObject({ name: 'my city', bpm: 137, key: { tonic: 'F', mode: 'minor' } })
    expect(beat('save the day - Fm 147').key).toEqual({ tonic: 'F', mode: 'minor' })
    expect(beat('kriko x welcomeCarson - Random - Dmin 130')).toMatchObject({ name: 'Random', bpm: 130, producers: ['kriko', 'welcomeCarson'] })
  })

  it('tells major from minor', () => {
    for (const key of ['CM', 'Cmaj', 'CMAJ', 'Cmajor']) expect(beat(`beat - 120 ${key}`).key.mode).toBe('major')
    for (const key of ['Cm', 'Cmin', 'CMIN', 'cm']) expect(beat(`beat - 120 ${key}`).key.mode).toBe('minor')
    expect(beat('kriko x welcomeCarson - somethings never change - 170 Bmaj').key).toEqual({ tonic: 'B', mode: 'major' })
  })

  it('reads sharps and flats, and leaves the mode open when the name has no marker', () => {
    expect(beat('beat - 120 Bbm').key).toEqual({ tonic: 'Bb', mode: 'minor' })
    expect(beat('beat - 120 F#M').key).toEqual({ tonic: 'F#', mode: 'major' })
    expect(beat('beat - 120 Eb').key).toEqual({ tonic: 'Eb', mode: null })
  })

  it('keeps dashes that belong to the beat name', () => {
    expect(beat('lo-fi dreams - 90 Am').name).toBe('lo-fi dreams')
    expect(beat('lost - found - 120 Gm')).toMatchObject({ name: 'lost - found', producers: [] })
  })

  it('ignores extra spaces', () => {
    expect(beat('  flowers  -  140   Em  ')).toMatchObject({ name: 'flowers', bpm: 140, key: { tonic: 'E', mode: 'minor' } })
  })

  it('explains names it cannot read', () => {
    expect(parseBeatName('untitled.flp').ok).toBe(false)
    expect(parseBeatName('beat - 140').ok).toBe(false)
    expect(parseBeatName('beat - 140 Hm').ok).toBe(false)
    expect(parseBeatName('beat - 140 Cdorian').ok).toBe(false)
    expect(parseBeatName('140 Em').ok).toBe(false)
  })
})

describe('parseKey', () => {
  it('reads a key as the beat details show it, or as a file name writes it', () => {
    expect(parseKey('F min')).toEqual({ tonic: 'F', mode: 'minor' })
    expect(parseKey('C maj')).toEqual({ tonic: 'C', mode: 'major' })
    expect(parseKey('D#m')).toEqual({ tonic: 'D#', mode: 'minor' })
    expect(parseKey(' bb minor ')).toEqual({ tonic: 'Bb', mode: 'minor' })
    expect(parseKey('G♯M')).toEqual({ tonic: 'G#', mode: 'major' })
    expect(parseKey('Eb')).toEqual({ tonic: 'Eb', mode: null })
  })

  it('answers null to anything else', () => {
    for (const text of ['', 'H min', 'F dorian', 'Fmin7', '140']) expect(parseKey(text)).toBeNull()
  })
})

describe('keyLabel', () => {
  it('spells out the key', () => {
    expect(keyLabel({ tonic: 'D#', mode: 'minor' })).toBe('D# minor')
    expect(keyLabel({ tonic: 'Eb', mode: null })).toBe('Eb')
  })
})
