import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { findRar, packStems, stemNames } from './stems'

const project = 'flowers - 140 Em'
const tracks = [
  { index: 1, name: 'Hive', muted: false },
  { index: 2, name: 'Xpand!2', muted: false },
  { index: 8, name: 'venexxi - ! spinz 808', muted: false },
  { index: 11, name: 'Purchase your tracks today', muted: false },
]

describe('stemNames', () => {
  it('numbers the stems in mixer order, the way the user names them', () => {
    const files = ['C:\\work\\flowers - 140 Em_venexxi - ! spinz 808.wav', 'C:\\work\\flowers - 140 Em_Hive.wav', 'C:\\work\\flowers - 140 Em_Xpand!2.wav']
    expect(stemNames(files, project, tracks)).toEqual([
      { file: 'C:\\work\\flowers - 140 Em_Hive.wav', as: 'flowers - 140 Em - Track 1.wav' },
      { file: 'C:\\work\\flowers - 140 Em_Xpand!2.wav', as: 'flowers - 140 Em - Track 2.wav' },
      { file: 'C:\\work\\flowers - 140 Em_venexxi - ! spinz 808.wav', as: 'flowers - 140 Em - Track 3.wav' },
    ])
  })

  it('orders the stems FL really wrote for flowers (render of 2026-10-19) by mixer track', () => {
    const flowersTracks = ['Hive', 'Xpand!2', 'Phase Plant', 'Phase Plant #2', 'rio - escape hi hat', 'ℹrobot snare @thecxdy', 'crokonk_crash', 'venexxi - ! spinz 808', '[PBS] Overused Zay Shaker', 'venexxi - ! musthave snare', 'Purchase your tracks today'].map(
      (name, i) => ({ index: i + 1, name, muted: false }),
    )
    // What the split render wrote, in the order readdir listed it; the muted tag isn't there.
    const written = ['crokonk_crash', 'Hive', 'Phase Plant #2', 'Phase Plant', 'rio - escape hi hat', 'venexxi - ! musthave snare', 'venexxi - ! spinz 808', 'Xpand!2', '[PBS] Overused Zay Shaker', 'ℹrobot snare @thecxdy']
    const stems = stemNames(written.map((name) => `${project}_${name}.wav`), project, flowersTracks)
    expect(stems.map((stem) => `${stem.as} ← ${stem.file.slice(project.length + 1, -4)}`)).toEqual(
      flowersTracks.slice(0, 10).map((track, i) => `${project} - Track ${i + 1}.wav ← ${track.name}`),
    )
  })

  it('puts stems it cannot match to a mixer track last', () => {
    const files = ['C:\\work\\flowers - 140 Em_Mystery.wav', 'C:\\work\\flowers - 140 Em_hive.wav']
    expect(stemNames(files, project, tracks).map((stem) => stem.as)).toEqual(['flowers - 140 Em - Track 1.wav', 'flowers - 140 Em - Track 2.wav'])
    expect(stemNames(files, project, tracks)[1].file).toBe('C:\\work\\flowers - 140 Em_Mystery.wav')
  })
})

// Packs three small stand-in WAVs with the real WinRAR, in a temp folder (skipped where WinRAR isn't installed).
const folders: string[] = []
afterAll(() => folders.forEach((folder) => rmSync(folder, { recursive: true, force: true })))

describe.runIf(existsSync('C:\\Program Files\\WinRAR\\Rar.exe'))('packStems', () => {
  it('renames the stems and packs them without paths', async () => {
    const work = mkdtempSync(join(tmpdir(), 'tbb-'))
    folders.push(work)
    const files = ['Hive', 'Xpand!2', 'venexxi - ! spinz 808'].map((name) => {
      const file = join(work, `${project}_${name}.wav`)
      writeFileSync(file, Buffer.alloc(4096, name.length))
      return file
    })
    const rar = await findRar()
    const archive = join(work, 'flowers.rar')
    writeFileSync(archive, 'an older archive') // replaced, not added to

    await packStems(rar, stemNames(files, project, tracks), archive)

    const inside = execFileSync(rar, ['lb', archive], { encoding: 'utf8' }).trim().split(/\r?\n/)
    expect(inside).toEqual(['flowers - 140 Em - Track 1.wav', 'flowers - 140 Em - Track 2.wav', 'flowers - 140 Em - Track 3.wav'])
    expect(readdirSync(work).sort()).toEqual(['flowers - 140 Em - Track 1.wav', 'flowers - 140 Em - Track 2.wav', 'flowers - 140 Em - Track 3.wav', 'flowers.rar'])
  })
})
