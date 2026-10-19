import type { BeatKey } from '../../../shared/parseBeatName'
import type { MixerTrack, ProjectInfo } from '../../../shared/project'

export interface Cover {
  url: string // blob: URL for the preview
  name: string
  path: string
}

export type TagSource = 'remembered' | 'guessed' | 'picked' | 'none'

// Everything the New beat screen knows about the beat being worked on. Name, BPM and key stay editable text.
export interface Beat {
  fileName: string
  path: string
  name: string
  bpm: string
  key: string // "F min", "C maj", or just "Eb" when the file name had no major/minor marker
  collabs: string[]
  tracks: MixerTrack[]
  tagIndex: number | null
  tagSource: TagSource
  stems: boolean
  bsFile: 'mp3' | 'wav'
  cover: Cover | null
}

export function emptyBeat(defaults: { stems: boolean; bsFile: 'mp3' | 'wav' }): Beat {
  return {
    fileName: '',
    path: '',
    name: '',
    bpm: '',
    key: '',
    collabs: [],
    tracks: [],
    tagIndex: null,
    tagSource: 'none',
    stems: defaults.stems,
    bsFile: defaults.bsFile,
    cover: null,
  }
}

// Fills the beat from a project the main process read. Cover and per-beat options stay as they were.
export function beatFromProject(project: ProjectInfo, rememberedTags: string[], current: Beat): Beat {
  const parsed = project.beat
  return {
    ...current,
    fileName: project.fileName,
    path: project.path,
    name: parsed.ok ? parsed.beat.name : project.fileName.replace(/\.flp$/i, ''),
    bpm: parsed.ok ? String(parsed.beat.bpm) : '',
    key: parsed.ok ? shortKey(parsed.beat.key) : '',
    collabs: parsed.ok ? parsed.beat.producers.slice(1) : [], // the main producer (the user) always comes first
    tracks: project.tracks,
    ...guessTag(project.tracks, rememberedTags),
  }
}

// See CLAUDE.md, "Tag detection": a remembered tag name wins, otherwise the last named track is a guess.
export function guessTag(tracks: MixerTrack[], rememberedTags: string[]): Pick<Beat, 'tagIndex' | 'tagSource'> {
  const remembered = new Set(rememberedTags.map((name) => name.toLowerCase()))
  const known = tracks.find((track) => remembered.has(track.name.toLowerCase()))
  if (known) return { tagIndex: known.index, tagSource: 'remembered' }
  const last = tracks.at(-1)
  return last ? { tagIndex: last.index, tagSource: 'guessed' } : { tagIndex: null, tagSource: 'none' }
}

export function shortKey({ tonic, mode }: BeatKey): string {
  if (!mode) return tonic
  return `${tonic} ${mode === 'minor' ? 'min' : 'maj'}`
}

export function longKey(key: string): string {
  return key.replace(/ min$/, ' minor').replace(/ maj$/, ' major')
}

export function isValidBpm(bpm: string): boolean {
  const n = Number(bpm)
  return Number.isInteger(n) && n >= 40 && n <= 300
}

// Length of one beat in seconds, for animations that move in time with the music. Falls back to 140 BPM.
export function beatSeconds(bpm: string): number {
  return 60 / (isValidBpm(bpm) ? Number(bpm) : 140)
}

export function tagTrack(beat: Beat): MixerTrack | undefined {
  return beat.tracks.find((track) => track.index === beat.tagIndex)
}

const STRIPES = [['#FF6500', '#FF7A26'], ['#38BDF8', '#0EA5E9'], ['#A78BFA', '#8B6FE8'], ['#22C55E', '#16A34A'], ['#FF4D6D', '#F43F5E'], ['#FACC15', '#EAB308']]

// Stand-in artwork for a beat without a cover at hand: stripes in a color picked from its name.
export function coverStripes(name: string): string {
  const sum = [...name].reduce((total, char) => total + char.charCodeAt(0), 0)
  const [a, b] = STRIPES[sum % STRIPES.length]
  return `repeating-linear-gradient(135deg, ${a} 0 8px, ${b} 8px 16px)`
}
