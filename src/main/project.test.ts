import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, dirname, join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { copyProject, readProject } from './project'

// Every test project goes in a fresh temp folder; they're all deleted at the end.
const tempFolders: string[] = []
const tempFolder = () => {
  const folder = mkdtempSync(join(tmpdir(), 'tbb-'))
  tempFolders.push(folder)
  return folder
}
afterAll(() => tempFolders.forEach((folder) => rmSync(folder, { recursive: true, force: true })))

// Builds a tiny .flp: the FLhd header, then an FLdt chunk holding the given events.
function flp(events: Buffer[]): Buffer {
  const data = Buffer.concat(events)
  const header = Buffer.alloc(14)
  header.write('FLhd', 0, 'ascii')
  header.writeUInt32LE(6, 4)
  header.writeUInt16LE(96, 12) // PPQ
  const chunk = Buffer.alloc(8)
  chunk.write('FLdt', 0, 'ascii')
  chunk.writeUInt32LE(data.length, 4)
  return Buffer.concat([header, chunk, data])
}

// A variable-length event: id, then the length as a varint, then the data.
function blob(id: number, body: Buffer): Buffer {
  const length: number[] = []
  let n = body.length
  do {
    length.push((n & 0x7f) | (n > 0x7f ? 0x80 : 0))
    n >>= 7
  } while (n > 0)
  return Buffer.concat([Buffer.from([id, ...length]), body])
}

const text = (id: number, value: string, encoding: 'utf16le' | 'ascii') => blob(id, Buffer.from(`${value}\0`, encoding))

// One mixer track: flags (track on or muted), an optional name, then the end-of-track event.
function track(name: string | null, on = true): Buffer[] {
  const flags = Buffer.alloc(12)
  flags.writeUInt32LE(on ? 0x4c : 0x44, 4)
  return [blob(236, flags), ...(name ? [text(204, name, 'utf16le')] : []), Buffer.from([147, 0, 0, 0, 0])]
}

function writeProject(fileName: string, data: Buffer): string {
  const path = join(tempFolder(), fileName)
  writeFileSync(path, data)
  return path
}

describe('readProject', () => {
  it('reads the FL version, the named mixer tracks and whether each is muted', async () => {
    const path = writeProject(
      'kriko x welcomeCarson - ozempic - 132 Fmin.flp',
      flp([
        Buffer.from([10, 1]), // a 1-byte event
        Buffer.from([65, 0x34, 0x12]), // a 2-byte event
        text(199, '21.0.3.3517', 'ascii'),
        blob(210, Buffer.alloc(300)), // a long event, so its length needs a two-byte varint
        ...track(null), // 0: Master
        ...track('Kick'),
        ...track(null),
        ...track('Purchase your tracks today', false),
      ]),
    )

    const result = await readProject(path)

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.project.flVersion).toBe('21.0.3.3517')
    expect(result.project.tracks).toEqual([
      { index: 1, name: 'Kick', muted: false },
      { index: 3, name: 'Purchase your tracks today', muted: true },
    ])
    expect(result.project.beat).toMatchObject({ ok: true, beat: { name: 'ozempic', bpm: 132, producers: ['kriko', 'welcomeCarson'] } })
  })

  it("says so when the file isn't an FL Studio project", async () => {
    const result = await readProject(writeProject('fake.flp', Buffer.from('not a project')))
    expect(result).toEqual({ ok: false, error: "That file isn't an FL Studio project." })
  })

  // Optional check against a real project: TBB_REAL_FLP="path\to\beat.flp" npm test
  it.runIf(process.env.TBB_REAL_FLP)('reads a real project', async () => {
    const result = await readProject(process.env.TBB_REAL_FLP!)
    expect(result.ok).toBe(true)
    if (result.ok) console.log(result.project.flVersion, result.project.tracks)
  })
})

describe('copyProject', () => {
  async function tracksOf(path: string) {
    const result = await readProject(path)
    if (!result.ok) throw new Error(result.error)
    return result.project.tracks
  }

  // How many bytes differ between two files of the same length.
  const changedBytes = (a: Buffer, b: Buffer) => a.reduce((count, byte, i) => count + (byte === b[i] ? 0 : 1), 0)

  // Track 3 is the tag.
  const project = (tagOn: boolean) => flp([...track(null), ...track('Kick'), ...track(null), ...track('Purchase your tracks today', tagOn)])

  it('mutes the tag in the copy, changing one byte, and leaves the original alone', async () => {
    const source = writeProject('flowers - 140 Em.flp', project(true))
    const before = readFileSync(source)
    const copy = join(dirname(source), 'untagged.flp')

    await copyProject(source, copy, { index: 3, on: false })

    expect(await tracksOf(copy)).toContainEqual({ index: 3, name: 'Purchase your tracks today', muted: true })
    expect(changedBytes(before, readFileSync(copy))).toBe(1)
    expect(readFileSync(source).equals(before)).toBe(true)
  })

  it('switches a muted tag on', async () => {
    const source = writeProject('flowers - 140 Em.flp', project(false))
    const copy = join(dirname(source), 'tagged.flp')

    await copyProject(source, copy, { index: 3, on: true })

    expect(await tracksOf(copy)).toContainEqual({ index: 3, name: 'Purchase your tracks today', muted: false })
    expect(changedBytes(readFileSync(source), readFileSync(copy))).toBe(1)
  })

  it('copies as is when the beat has no tag track', async () => {
    const source = writeProject('somethings never change - 170 Bmaj.flp', project(true))
    const copy = join(dirname(source), 'copy.flp')

    await copyProject(source, copy, null)

    expect(readFileSync(copy).equals(readFileSync(source))).toBe(true)
  })

  it('never writes over the original or any file already there', async () => {
    const source = writeProject('flowers - 140 Em.flp', project(true))
    const before = readFileSync(source)
    const taken = join(dirname(source), 'taken.flp')
    writeFileSync(taken, 'keep me')

    await expect(copyProject(source, source, { index: 3, on: false })).rejects.toThrow('must not replace its original')
    await expect(copyProject(source, taken, null)).rejects.toThrow()

    expect(readFileSync(source).equals(before)).toBe(true)
    expect(readFileSync(taken, 'utf8')).toBe('keep me')
  })

  it('says so when the track has no on/off switch', async () => {
    const source = writeProject('beat.flp', flp([...track(null), Buffer.from([147, 0, 0, 0, 0])]))
    await expect(copyProject(source, join(dirname(source), 'copy.flp'), { index: 1, on: false })).rejects.toThrow('no on/off switch')
  })

  // Optional check against a real project (the same TBB_REAL_FLP): copies with the last named track muted and on.
  it.runIf(process.env.TBB_REAL_FLP)('switches the last named track in copies of a real project', async () => {
    const source = process.env.TBB_REAL_FLP!
    const before = readFileSync(source)
    const tag = (await tracksOf(source)).at(-1)!
    const folder = tempFolder()
    const muted = join(folder, `muted ${basename(source)}`)
    const on = join(folder, `on ${basename(source)}`)

    await copyProject(source, muted, { index: tag.index, on: false })
    await copyProject(source, on, { index: tag.index, on: true })

    expect((await tracksOf(muted)).find((track) => track.index === tag.index)?.muted).toBe(true)
    expect((await tracksOf(on)).find((track) => track.index === tag.index)?.muted).toBe(false)
    expect(changedBytes(before, readFileSync(muted)) + changedBytes(before, readFileSync(on))).toBe(1)
    expect(readFileSync(source).equals(before)).toBe(true)
    console.log(`Switched track ${tag.index} "${tag.name}" (muted in the original: ${tag.muted})`)
  })
})
