import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { readProject } from './project'
import { readRegistry } from './registry'
import { renderTagged, renderUntagged, stemFiles, type RenderJob } from './render'

describe('stemFiles', () => {
  it('keeps each mixer track the split render wrote, without the Master and Current tracks', () => {
    const files = [
      'flowers - 140 Em.flp',
      'flowers - 140 Em_Master.wav',
      'flowers - 140 Em_Current.wav',
      'flowers - 140 Em_Hive.wav',
      'flowers - 140 Em_venexxi - ! spinz 808.wav',
      'flowers - 140 Em_notes.txt',
      'other beat_Kick.wav',
    ]
    expect(stemFiles(files, 'flowers - 140 Em')).toEqual(['flowers - 140 Em_Hive.wav', 'flowers - 140 Em_venexxi - ! spinz 808.wav'])
  })
})

// The WAV's format, from its "fmt " chunk: 1 = PCM, 3 = float (0xFFFE = extensible, the subformat says which).
function wavFormat(file: string) {
  const buf = readFileSync(file)
  let pos = 12
  while (pos < buf.length && buf.toString('ascii', pos, pos + 4) !== 'fmt ') pos += 8 + buf.readUInt32LE(pos + 4)
  const format = buf.readUInt16LE(pos + 8)
  return {
    format: format === 0xfffe ? buf.readUInt16LE(pos + 32) : format,
    channels: buf.readUInt16LE(pos + 10),
    sampleRate: buf.readUInt32LE(pos + 12),
    bits: buf.readUInt16LE(pos + 22),
  }
}

// The MP3's bitrate in kbps, from the first MPEG-1 Layer III frame header after any ID3 tag.
function mp3Bitrate(file: string): number {
  const buf = readFileSync(file)
  let pos = buf.toString('ascii', 0, 3) === 'ID3' ? 10 + ((buf[6] << 21) | (buf[7] << 14) | (buf[8] << 7) | buf[9]) : 0
  while (pos < buf.length - 4 && !(buf[pos] === 0xff && (buf[pos + 1] & 0xe0) === 0xe0)) pos++
  return [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320][buf[pos + 2] >> 4]
}

// Real renders with FL Studio, only when asked for (they launch FL and take a couple of minutes):
//   TBB_REAL_RENDER=1 TBB_REAL_FLP="path\to\a copy of a beat.flp" npx vitest run src/main/render.test.ts
// Optional: TBB_QUALITY="32f/256" (default 24/320); TBB_KEEP_RENDERS=1 keeps the rendered files in %TEMP%.
// The tag is the last named mixer track.
describe.runIf(process.env.TBB_REAL_RENDER && process.env.TBB_REAL_FLP)('real renders', () => {
  it('renders the untagged WAV with stems, then the tagged MP3, and puts the Export choices back', async () => {
    const project = process.env.TBB_REAL_FLP!
    const read = await readProject(project)
    if (!read.ok) throw new Error(read.error)
    const [wavBits, mp3Rate] = (process.env.TBB_QUALITY ?? '24/320').split('/') as [RenderJob['quality']['wavBits'], RenderJob['quality']['mp3Rate']]
    const key = 'HKCU\\SOFTWARE\\Image-Line\\FL Studio 21\\General\\WAVRenderForm'
    const before = await Promise.all(['WFBox', 'MP3BitrateSlider', 'BatchBox'].map((name) => readRegistry(key, name)))
    const work = mkdtempSync(join(tmpdir(), 'tbb-render-'))
    const job: RenderJob = {
      flPath: (await readRegistry('HKLM\\SOFTWARE\\Image-Line\\Shared\\Paths', 'FL Studio'))!,
      flVersion: read.project.flVersion ?? '21',
      project,
      tagIndex: read.project.tracks.at(-1)!.index,
      stems: true,
      quality: { wavBits, mp3Rate },
      work,
      backupFile: join(work, 'export-backup.json'),
    }

    try {
      let started = Date.now()
      const { wav, stems } = await renderUntagged(job)
      console.log(`Untagged render: ${((Date.now() - started) / 1000).toFixed(0)} s`, wavFormat(wav), stems.map((stem) => basename(stem)))
      started = Date.now()
      const mp3 = await renderTagged(job)
      console.log(`Tagged render: ${((Date.now() - started) / 1000).toFixed(0)} s, ${mp3Bitrate(mp3)} kbps`)

      expect(wavFormat(wav)).toMatchObject(wavBits === '32f' ? { format: 3, bits: 32 } : { format: 1, bits: Number(wavBits) })
      expect(mp3Bitrate(mp3)).toBe(Number(mp3Rate))
      expect(stems.length).toBe(read.project.tracks.filter((track) => !track.muted).length - 1) // every playing track but the tag
      expect(await Promise.all(['WFBox', 'MP3BitrateSlider', 'BatchBox'].map((name) => readRegistry(key, name)))).toEqual(before)
      expect(existsSync(job.backupFile)).toBe(false)
    } finally {
      if (process.env.TBB_KEEP_RENDERS) console.log('Rendered files kept in', work)
      else rmSync(work, { recursive: true, force: true })
    }
  }, 20 * 60_000)
})
