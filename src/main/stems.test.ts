import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { findPacker, findRar, packStems, stemNames } from './stems'

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

// Packing for real, with small stand-in WAVs in temp folders.
const folders: string[] = []
afterAll(() => folders.forEach((folder) => rmSync(folder, { recursive: true, force: true })))

// Three stand-in stems as FL would name them, in a fresh temp folder.
function fakeStems(projectName: string): { work: string; files: string[] } {
  const work = mkdtempSync(join(tmpdir(), 'tbb-'))
  folders.push(work)
  const files = ['Hive', 'Xpand!2', 'venexxi - ! spinz 808'].map((name) => {
    const file = join(work, `${projectName}_${name}.wav`)
    writeFileSync(file, Buffer.alloc(4096, name.length))
    return file
  })
  return { work, files }
}

// The names in a ZIP's central directory, and whether each is flagged as UTF-8 (bit 11), so any unzipper reads
// names like "café" right.
function zipEntries(zip: string): { name: string; utf8: boolean }[] {
  const buf = readFileSync(zip)
  const end = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]))
  const entries: { name: string; utf8: boolean }[] = []
  for (let i = 0, pos = buf.readUInt32LE(end + 16); i < buf.readUInt16LE(end + 10); i++) {
    const nameLength = buf.readUInt16LE(pos + 28)
    entries.push({ name: buf.toString('utf8', pos + 46, pos + 46 + nameLength), utf8: (buf.readUInt16LE(pos + 8) & 0x800) !== 0 })
    pos += 46 + nameLength + buf.readUInt16LE(pos + 30) + buf.readUInt16LE(pos + 32)
  }
  return entries
}

describe('findPacker', () => {
  it('picks WinRAR when it is installed, otherwise ZIP', async () => {
    expect((await findPacker()).kind).toBe((await findRar()) ? 'rar' : 'zip')
  })
})

describe.runIf(existsSync('C:\\Program Files\\WinRAR\\Rar.exe'))('packStems with WinRAR', () => {
  it('renames the stems and packs them without paths, replacing an older archive', async () => {
    const { work, files } = fakeStems(project)
    const rar = (await findRar())!
    writeFileSync(join(work, 'flowers.rar'), 'an older archive')

    const archive = await packStems({ kind: 'rar', exe: rar }, stemNames(files, project, tracks), join(work, 'flowers.rar'))

    expect(archive).toBe(join(work, 'flowers.rar'))
    const inside = execFileSync(rar, ['lb', archive], { encoding: 'utf8' }).trim().split(/\r?\n/)
    expect(inside).toEqual(['flowers - 140 Em - Track 1.wav', 'flowers - 140 Em - Track 2.wav', 'flowers - 140 Em - Track 3.wav'])
    expect(readdirSync(work).sort()).toEqual(['flowers - 140 Em - Track 1.wav', 'flowers - 140 Em - Track 2.wav', 'flowers - 140 Em - Track 3.wav', 'flowers.rar'])
  })
})

describe('packStems with ZIP (no WinRAR)', () => {
  it('makes a .zip instead, with names that survive characters like "é" and "ℹ"', async () => {
    const unicodeProject = 'café ℹ - 140 Em'
    const { work, files } = fakeStems(unicodeProject)
    writeFileSync(join(work, 'café ℹ.zip'), 'an older archive')

    const archive = await packStems({ kind: 'zip' }, stemNames(files, unicodeProject, tracks), join(work, 'café ℹ.rar'))

    expect(archive).toBe(join(work, 'café ℹ.zip'))
    expect(zipEntries(archive)).toEqual([1, 2, 3].map((n) => ({ name: `café ℹ - 140 Em - Track ${n}.wav`, utf8: true })))
  }, 30_000)

  it("treats quotes, $ and ; in names as plain text, since they never reach PowerShell's command", async () => {
    const trickyProject = "don't $stop; now - 140 Em"
    const { work, files } = fakeStems(trickyProject)

    const archive = await packStems({ kind: 'zip' }, stemNames(files, trickyProject, tracks), join(work, "don't $stop; now.rar"))

    expect(zipEntries(archive).map((entry) => entry.name)).toEqual([1, 2, 3].map((n) => `${trickyProject} - Track ${n}.wav`))
  }, 30_000)
})
