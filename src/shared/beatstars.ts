// What the app types into BeatStars' track form, worked out from the beat details (see "BeatStars" in CLAUDE.md).
import type { BeatKey } from './parseBeatName'

// BeatStars' title box counts up to 60 characters.
export const TITLE_LIMIT = 60

// The user's titles (CLAUDE.md, "BeatStars title"): the beat name with every word capitalized, then the deal and the
// artist, or the short form when that's over the limit. Null when even the short one is, so the user picks the title.
export function beatStarsTitle(beatName: string): string | null {
  const name = beatName
    .trim()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
  if (!name) return null
  const titles = [`${name} [BUY 2, GET 1] - Rich Amiri Type Beat`, `${name} [BUY 2 GET 1] Amiri Type Beat`]
  return titles.find((title) => title.length <= TITLE_LIMIT) ?? null
}

const ACCIDENTAL: Record<string, string> = { '#': '_SHARP', b: '_FLAT' }

// BeatStars' Key list has every major and minor except these, so they go by the key's other name.
const OTHER_NAME: Record<string, string> = {
  C_FLAT_MINOR: 'B_MINOR',
  G_FLAT_MINOR: 'F_SHARP_MINOR',
  B_SHARP_MAJOR: 'C_MAJOR',
  B_SHARP_MINOR: 'C_MINOR',
  E_SHARP_MAJOR: 'F_MAJOR',
  E_SHARP_MINOR: 'F_MINOR',
  F_FLAT_MAJOR: 'E_MAJOR',
  F_FLAT_MINOR: 'E_MINOR',
}

// The key as BeatStars' Key list names it ("D#" minor → D_SHARP_MINOR). Null without major or minor: BeatStars
// needs one, so the user has to say which.
export function beatStarsKey({ tonic, mode }: BeatKey): string | null {
  if (!mode) return null
  const value = `${tonic.charAt(0)}${ACCIDENTAL[tonic.slice(1)] ?? ''}_${mode.toUpperCase()}`
  return OTHER_NAME[value] ?? value
}
