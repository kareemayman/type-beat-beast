import { parseTime } from './schedule'

// The app's settings. The main process keeps them in a file (src/main/settings.ts); the page reads and
// changes them over IPC.
export interface Settings {
  themePref: 'dark' | 'light' | 'system'
  motion: 'full' | 'reduced'
  producerName: string
  stems: boolean
  bsFile: 'mp3' | 'wav'
  freeDownload: boolean
  wavBits: '16' | '24' | '32f'
  mp3Rate: '192' | '256' | '320'
  publishTime: string // "HH:MM", local time
  tagNames: string[] // mixer track names the user has confirmed as their tag
}

export const DEFAULT_SETTINGS: Settings = {
  themePref: 'dark',
  motion: 'full',
  producerName: 'kriko',
  stems: true,
  bsFile: 'mp3',
  freeDownload: true,
  wavBits: '24',
  mp3Rate: '320',
  publishTime: '18:00',
  tagNames: [],
}

const oneOf = <T extends string>(value: unknown, options: readonly T[], fallback: T): T => (options.includes(value as T) ? (value as T) : fallback)
const bool = (value: unknown, fallback: boolean) => (typeof value === 'boolean' ? value : fallback)

// Takes saved or incoming values and keeps only the ones of the right shape. Anything missing or wrong falls
// back to `base`, so an old or hand-edited settings file can't break the app.
export function cleanSettings(values: unknown, base: Settings = DEFAULT_SETTINGS): Settings {
  const v = (typeof values === 'object' && values !== null ? values : {}) as Record<string, unknown>
  return {
    themePref: oneOf(v.themePref, ['dark', 'light', 'system'], base.themePref),
    motion: oneOf(v.motion, ['full', 'reduced'], base.motion),
    producerName: typeof v.producerName === 'string' && v.producerName.trim() ? v.producerName.trim() : base.producerName,
    stems: bool(v.stems, base.stems),
    bsFile: oneOf(v.bsFile, ['mp3', 'wav'], base.bsFile),
    freeDownload: bool(v.freeDownload, base.freeDownload),
    wavBits: oneOf(v.wavBits, ['16', '24', '32f'], base.wavBits),
    mp3Rate: oneOf(v.mp3Rate, ['192', '256', '320'], base.mp3Rate),
    publishTime: typeof v.publishTime === 'string' && parseTime(v.publishTime) ? v.publishTime : base.publishTime,
    tagNames: Array.isArray(v.tagNames) ? v.tagNames.filter((name): name is string => typeof name === 'string' && name.trim() !== '') : base.tagNames,
  }
}
