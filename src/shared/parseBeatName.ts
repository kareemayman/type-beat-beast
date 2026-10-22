// Reads beat info from an FL Studio project's file name, following the user's naming system:
//   "beat name - bpm key"                            e.g. "8 bit - 151 D#m"
//   "main prod x collab prod - beat name - bpm key"  e.g. "kriko x welcomeCarson - ozempic - 132 Fmin"

export type KeyMode = 'major' | 'minor'

export interface BeatKey {
  tonic: string // "C", "D#", "Bb"
  mode: KeyMode | null // null when the name has no major/minor marker, so the app has to ask
}

export interface BeatInfo {
  name: string
  bpm: number
  key: BeatKey
  producers: string[] // as written before the beat name, main producer first; empty for solo beats
}

export type ParseResult = { ok: true; beat: BeatInfo } | { ok: false; error: string }

// The name ends with the BPM and the key, usually in that order ("140 Em"), but some real files have
// them the other way round ("my city - Fmin 137"). The dash before them is optional, because some
// files skip it ("kriko x welcomeCarson - mushroom 134 Gmin").
const BPM_THEN_KEY = /^(?<prefix>.*?)[\s-]*\b(?<bpm>\d{2,3})\s+(?<letter>[A-Ga-g])(?<accidental>[#b♯♭]?)(?<suffix>[A-Za-z]*)$/
const KEY_THEN_BPM = /^(?<prefix>.*?)[\s-]*\b(?<letter>[A-Ga-g])(?<accidental>[#b♯♭]?)(?<suffix>[A-Za-z]*)\s+(?<bpm>\d{2,3})$/

export function parseBeatName(fileName: string): ParseResult {
  const base = fileName.replace(/\.flp$/i, '').trim()
  const parts = (BPM_THEN_KEY.exec(base) ?? KEY_THEN_BPM.exec(base))?.groups
  if (!parts) return { ok: false, error: 'The name should end with the BPM and key, like "140 Em".' }

  const { prefix, bpm, letter, accidental, suffix } = parts
  const key = readKey(letter, accidental, suffix)
  if (!key) return { ok: false, error: `"${letter}${accidental}${suffix}" isn't a key the app knows.` }

  const segments = prefix.trim().split(/\s+-\s+/)
  const hasProducers = segments.length > 1 && /\s+x\s+/i.test(segments[0])
  const producers = hasProducers ? segments[0].split(/\s+x\s+/i).map((p) => p.trim()) : []
  const name = (hasProducers ? segments.slice(1) : segments).join(' - ').trim()
  if (!name) return { ok: false, error: 'There is no beat name before the BPM.' }

  return {
    ok: true,
    beat: {
      name,
      bpm: Number(bpm),
      key,
      producers,
    },
  }
}

// A key on its own, as the beat details show it ("F min", "C maj", or "Eb" with no major/minor marker) or as a file
// name writes it ("D#m", "Fmin"). Null when it isn't one.
const KEY = /^(?<letter>[A-Ga-g])(?<accidental>[#b♯♭]?)\s*(?<suffix>[A-Za-z]*)$/

export function parseKey(text: string): BeatKey | null {
  const parts = KEY.exec(text.trim())?.groups
  return (parts && readKey(parts.letter, parts.accidental, parts.suffix)) ?? null
}

function readKey(letter: string, accidental: string, suffix: string): BeatKey | undefined {
  const mode = readMode(suffix)
  if (mode === undefined) return undefined
  return { tonic: letter.toUpperCase() + accidental.replace('♯', '#').replace('♭', 'b'), mode }
}

// Minor: lowercase "m" or "min". Major: capital "M" or "maj". Three-letter forms work in any case,
// and are checked first so "CMIN" isn't read as major.
function readMode(suffix: string): KeyMode | null | undefined {
  const lower = suffix.toLowerCase()
  if (lower === 'min' || lower === 'minor') return 'minor'
  if (lower === 'maj' || lower === 'major') return 'major'
  if (suffix === 'm') return 'minor'
  if (suffix === 'M') return 'major'
  if (suffix === '') return null
  return undefined
}

export function keyLabel({ tonic, mode }: BeatKey): string {
  return mode ? `${tonic} ${mode}` : tonic
}
