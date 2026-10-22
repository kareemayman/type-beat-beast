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
  bsShowChrome: boolean // show the Chrome window while BeatStars gets filled in; off, it works out of sight
  wavBits: '16' | '24' | '32f'
  mp3Rate: '192' | '256' | '320'
  publishTime: string // "HH:MM", local time
  tagNames: string[] // mixer track names the user has confirmed as their tag
  flPath: string // FL64.exe; empty until the app finds it or the user picks it
  outputFolder: string // where beat folders go; empty means next to each .flp
  notes: string // the Notes window's text
}

// The Notes window starts with the naming rules (see CLAUDE.md, "Naming system").
const DEFAULT_NOTES = `beat name - bpm key
→ flowers - 140 Em

main prod x collab prod - beat name - bpm key
→ kriko x welcomeCarson - ozempic - 132 Fmin

minor = m / min
major = M / maj
→ 8 bit - 151 D#m
`

export const DEFAULT_SETTINGS: Settings = {
  themePref: 'dark',
  motion: 'full',
  producerName: 'kriko',
  stems: true,
  bsFile: 'mp3',
  freeDownload: true,
  bsShowChrome: true,
  wavBits: '24',
  mp3Rate: '320',
  publishTime: '18:00',
  tagNames: [],
  flPath: '',
  outputFolder: '',
  notes: DEFAULT_NOTES,
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
    bsShowChrome: bool(v.bsShowChrome, base.bsShowChrome),
    wavBits: oneOf(v.wavBits, ['16', '24', '32f'], base.wavBits),
    mp3Rate: oneOf(v.mp3Rate, ['192', '256', '320'], base.mp3Rate),
    publishTime: typeof v.publishTime === 'string' && parseTime(v.publishTime) ? v.publishTime : base.publishTime,
    tagNames: Array.isArray(v.tagNames) ? v.tagNames.filter((name): name is string => typeof name === 'string' && name.trim() !== '') : base.tagNames,
    flPath: typeof v.flPath === 'string' ? v.flPath : base.flPath,
    outputFolder: typeof v.outputFolder === 'string' ? v.outputFolder : base.outputFolder,
    notes: typeof v.notes === 'string' ? v.notes : base.notes,
  }
}

// The fields a change touched, with their values as saved: what the other windows need to hear.
// (Object.hasOwn, so a key like "toString" can't sneak in from the object's prototype.)
export function savedPart(change: unknown, saved: Settings): Partial<Settings> {
  const keys = Object.keys(typeof change === 'object' && change !== null ? change : {}).filter((key) => Object.hasOwn(saved, key))
  return Object.fromEntries(keys.map((key) => [key, saved[key as keyof Settings]]))
}
