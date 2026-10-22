// Fills in a new track on BeatStars Studio the way the user does it by hand (recorded 2026-10-20, see "BeatStars"
// in CLAUDE.md), up to just before "Publish track". Each step is its own function, so a failed one can be retried
// on the same draft; fillInTrack runs them all. Runs on a page of the app's own Chrome profile (browser.ts).
import type { Locator, Page } from 'playwright-core'

const STUDIO = 'https://studio.beatstars.com'
const UPLOAD_TIMEOUT = 10 * 60_000 // a big stems archive on a slow connection

export interface TrackUpload {
  title: string // from beatStarsTitle
  bpm: number
  key: string // a value from BeatStars' Key list, from beatStarsKey
  cover: string // full paths from here on
  untagged: string
  tagged: string | null // null: no tagged MP3 of the user's own ("Reuse WAV")
  stems: string | null
  freeDownload: boolean
}

export type FileSlot = 'untagged' | 'tagged' | 'stems'

const SECTION: Record<FileSlot, string> = {
  untagged: 'studio-track-form-untagged',
  tagged: 'studio-track-form-tagged',
  stems: 'studio-track-form-stems',
}

// The whole fill-in, in the order the user does it. The files upload side by side, so the end waits for all of
// them. `progress` hears each step as it's done, for the step log. Answers with the draft's address.
export async function fillInTrack(page: Page, upload: TrackUpload, progress: (line: string) => void = () => {}): Promise<string> {
  await openStudio(page)
  const draft = await createTrack(page, upload.untagged)
  progress('Started a new track with the WAV')
  await fillDetails(page, upload)
  progress(`Title, ${upload.bpm} BPM and key filled in`)
  const oldArtwork = await setArtwork(page, upload.cover)
  await setFreeDownload(page, upload.freeDownload)
  progress(upload.freeDownload ? 'Free download on, non-commercial only' : 'Free download off')
  if (upload.tagged) await attach(page, 'tagged', upload.tagged)
  if (upload.stems) await attach(page, 'stems', upload.stems)
  progress('Waiting for BeatStars to take the files and the artwork')
  const slots: FileSlot[] = ['untagged', ...(upload.tagged ? (['tagged'] as const) : []), ...(upload.stems ? (['stems'] as const) : [])]
  await waitForUploads(page, slots, oldArtwork)
  progress('Every file attached, and the artwork is in')
  return draft
}

// Opens the dashboard. Logged out, the Studio sends visitors to its sign-up page instead.
export async function openStudio(page: Page): Promise<void> {
  await page.goto(`${STUDIO}/dashboard`)
  const create = page.getByRole('button', { name: 'Create Track' })
  await create.waitFor({ timeout: 30_000 }).catch(() => {})
  if (new URL(page.url()).host !== 'studio.beatstars.com' || !(await create.isVisible()))
    throw new Error('BeatStars sent the app to its sign-up page. Log in again: Settings → BeatStars.')
}

// Starts a new track with the untagged WAV. BeatStars makes the draft as soon as the upload starts, and the WAV
// keeps uploading while the rest is filled in. Answers with the draft's address.
export async function createTrack(page: Page, untagged: string): Promise<string> {
  await page.getByRole('button', { name: 'Create Track' }).click()
  await chooseFile(page, untagged)
  await page.waitForURL(/\/content\/tracks\/new\//, { timeout: UPLOAD_TIMEOUT })
  await form(page).waitFor()
  return page.url()
}

export async function fillDetails(page: Page, { title, bpm, key }: Pick<TrackUpload, 'title' | 'bpm' | 'key'>): Promise<void> {
  await page.locator('input#title').fill(title)
  await form(page).locator('input[type=number]').fill(String(bpm))
  await form(page).locator('select').selectOption(key)
}

// The artwork: Edit → Upload file → the image → Save (the crop) → Upload 1 file. It uploads alongside the files.
// Answers with the picture shown before (a new track shows the user's profile picture), for waitForUploads.
export async function setArtwork(page: Page, cover: string): Promise<string | null> {
  const before = await artworkPicture(page)
  await page.locator('studio-track-form-artwork-upload').getByRole('button', { name: 'Edit' }).click()
  await page.getByRole('menuitem', { name: 'Upload file' }).click()
  await chooseFile(page, cover)
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await page.getByRole('button', { name: 'Upload 1 file' }).click()
  return before
}

// Free download of the tagged MP3, for non-commercial use only: "Enable free download" ticked, and "Allow commercial
// use" (on for a new track) switched off. Both are found by their cards' text; their ids change on every page.
export async function setFreeDownload(page: Page, on: boolean): Promise<void> {
  await page.locator('.selectable-card', { hasText: 'Enable free download' }).locator('input[type=checkbox]').setChecked(on)
  if (!on) return
  const commercial = page.locator('.selectable-card', { hasText: 'Allow commercial use' }).getByRole('switch')
  if ((await commercial.getAttribute('aria-checked')) === 'true') await commercial.click()
}

// The tagged MP3 or the stems: "Add" in that file's section, then the file.
export async function attach(page: Page, slot: Exclude<FileSlot, 'untagged'>, file: string): Promise<void> {
  await page.locator(SECTION[slot]).getByRole('button', { name: 'Add' }).click()
  await chooseFile(page, file)
}

// What a slot of the files panel shows. A file goes "Uploading…", then "Attaching…", then shows its name with a
// play button (seen 2026-10-22: the stems took about 75 s to upload, then a while to attach). Empty slots have "Add".
export type SlotState = 'empty' | 'uploading' | 'attaching' | 'attached'

export async function slotState(page: Page, slot: FileSlot): Promise<SlotState> {
  const section = page.locator(SECTION[slot])
  const text = await section.innerText()
  if (/Uploading/i.test(text)) return 'uploading'
  if (/Attaching/i.test(text)) return 'attaching'
  const playable = (await section.locator('studio-track-form-play-button').count()) > 0
  const addable = (await section.getByRole('button', { name: 'Add' }).count()) > 0
  return playable && !addable ? 'attached' : 'empty'
}

const FILE_NAME: Record<FileSlot, string> = { untagged: 'the WAV', tagged: 'the tagged MP3', stems: 'the stems' }
const NOT_YET: Record<SlotState, string> = { empty: 'dropped', uploading: 'still uploading', attaching: 'still attaching', attached: '' }

// Waits until these slots have their files and the artwork shows something other than `oldArtwork`. BeatStars
// sometimes drops an upload (CLAUDE.md, "BeatStars glitches"): a slot still empty after half a minute gives up
// straight away, anything else after UPLOAD_TIMEOUT.
export async function waitForUploads(page: Page, slots: FileSlot[], oldArtwork: string | null): Promise<void> {
  const started = Date.now()
  for (;;) {
    const states = await Promise.all(slots.map((slot) => slotState(page, slot)))
    const artwork = (await artworkPicture(page)) !== oldArtwork
    if (artwork && states.every((state) => state === 'attached')) return
    const waited = Date.now() - started
    if (waited > UPLOAD_TIMEOUT || (waited > 30_000 && states.includes('empty'))) {
      const missing = slots.flatMap((slot, i) => (states[i] === 'attached' ? [] : [`${FILE_NAME[slot]} (${NOT_YET[states[i]]})`]))
      if (!artwork) missing.push('the artwork')
      throw new Error(`BeatStars didn't take ${missing.join(' or ')}. Reloading the draft and picking the file from the list under the upload dialog usually helps.`)
    }
    await page.waitForTimeout(2000)
  }
}

// Every file goes in through BeatStars' upload dialog. Waiting for the file chooser keeps Windows' own dialog closed.
async function chooseFile(page: Page, file: string): Promise<void> {
  const chooser = page.waitForEvent('filechooser')
  await page.getByRole('button', { name: 'browse files' }).click()
  await (await chooser).setFiles(file)
}

const form = (page: Page): Locator => page.locator('studio-track-form-metadata-wrapper')
const artworkPicture = (page: Page) => page.locator('studio-track-form-artwork-upload img').first().getAttribute('src')
