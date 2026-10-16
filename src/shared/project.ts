import type { ParseResult } from './parseBeatName'

export interface MixerTrack {
  index: number // 1–125; track 0 is the Master and 126 is FL's "Current" track
  name: string
  muted: boolean
}

export interface ProjectInfo {
  path: string
  fileName: string
  flVersion: string | null
  beat: ParseResult
  tracks: MixerTrack[] // named mixer tracks only, in mixer order
}

export type ReadProjectResult = { ok: true; project: ProjectInfo } | { ok: false; error: string }
