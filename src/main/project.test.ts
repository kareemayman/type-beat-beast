import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { readProject } from './project'

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
  const path = join(mkdtempSync(join(tmpdir(), 'tbb-')), fileName)
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
