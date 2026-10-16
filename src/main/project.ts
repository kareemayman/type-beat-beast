// Reads an FL Studio project without changing it: the beat info in its file name, and its mixer tracks.
import { readFile, stat } from 'node:fs/promises'
import { basename } from 'node:path'
import { parseBeatName } from '../shared/parseBeatName'
import type { MixerTrack, ReadProjectResult } from '../shared/project'

// An .flp is a list of events; these are the ones the app needs (see CLAUDE.md, "Project file (.flp) format").
const EVENT_FL_VERSION = 199
const EVENT_TRACK_NAME = 204
const EVENT_TRACK_FLAGS = 236
const EVENT_TRACK_END = 147
const TRACK_ON = 0x8
const MAX_PROJECT_BYTES = 100 * 1024 * 1024

interface FlpEvent {
  id: number
  at: number // where the event's data starts
  size: number
}

export async function readProject(path: string): Promise<ReadProjectResult> {
  try {
    if ((await stat(path)).size > MAX_PROJECT_BYTES) return { ok: false, error: "That file is too big to be an FL Studio project." }
    const buf = await readFile(path)
    const events = readEvents(buf)
    const version = events.find((e) => e.id === EVENT_FL_VERSION)
    return {
      ok: true,
      project: {
        path,
        fileName: basename(path),
        flVersion: version ? buf.toString('ascii', version.at, version.at + version.size).replace(/\0+$/, '') : null,
        beat: parseBeatName(basename(path)),
        tracks: readMixerTracks(buf, events),
      },
    }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
}

function readEvents(buf: Buffer): FlpEvent[] {
  if (buf.toString('ascii', 0, 4) !== 'FLhd') throw new Error("That file isn't an FL Studio project.")
  let pos = 8 + buf.readUInt32LE(4)
  if (buf.toString('ascii', pos, pos + 4) !== 'FLdt') throw new Error('The project file looks damaged.')
  const end = Math.min(buf.length, pos + 8 + buf.readUInt32LE(pos + 4))
  pos += 8

  const events: FlpEvent[] = []
  while (pos < end) {
    const id = buf[pos++]
    // The id says how much data follows: under 64 one byte, under 128 two, under 192 four, otherwise a length prefix.
    let size = id < 64 ? 1 : id < 128 ? 2 : id < 192 ? 4 : 0
    if (id >= 192) {
      let shift = 0
      let byte: number
      do {
        byte = buf[pos++]
        size |= (byte & 0x7f) << shift
        shift += 7
      } while (byte & 0x80 && pos < end)
    }
    events.push({ id, at: pos, size })
    pos += size
  }
  return events
}

// Mixer tracks are stored in order, and each one's events end with EVENT_TRACK_END. Track 0 is the Master and
// 126 is FL's "Current" track, so only 1–125 can hold sounds or a tag. Unnamed tracks are left out.
function readMixerTracks(buf: Buffer, events: FlpEvent[]): MixerTrack[] {
  const tracks: MixerTrack[] = []
  let index = 0
  let name = ''
  let flags = TRACK_ON
  for (const event of events) {
    if (event.id === EVENT_TRACK_NAME) {
      name = buf.toString('utf16le', event.at, event.at + event.size).replace(/\0+$/, '')
    } else if (event.id === EVENT_TRACK_FLAGS && event.size >= 8) {
      flags = buf.readUInt32LE(event.at + 4)
    } else if (event.id === EVENT_TRACK_END) {
      if (index >= 1 && index <= 125 && name) tracks.push({ index, name, muted: !(flags & TRACK_ON) })
      index++
      name = ''
      flags = TRACK_ON
    }
  }
  return tracks
}
