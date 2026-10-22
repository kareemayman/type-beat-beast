// Fills in a new track on BeatStars Studio the way the user does it by hand (recorded 2026-10-20, see "BeatStars"
// in CLAUDE.md), then publishes it once the user has OK'd it. Each step is its own function; fillInTrack and
// completeTrack run them in order. Runs on a page of the app's own Chrome profile (browser.ts).
import type { Locator, Page } from 'playwright-core'

const STUDIO = 'https://studio.beatstars.com'
const UPLOAD_TIMEOUT = 10 * 60_000 // a big stems archive on a slow connection

export interface TrackUpload {
  title: string // from beatStarsTitle
  bpm: number
  key: string // a value from BeatStars' Key list, from beatStarsKey
  cover: string // full paths from here on
  untagged: string
  tagged: string | null // null: no tagged file of the user's own, so BeatStars tags the preview itself
  stems: string | null
  freeDownload: boolean
}

// What a fill-in knows about its draft so far, noted as it goes, so a failed one carries on with the same draft
// instead of making another.
export interface Draft {
  url?: string // the draft's address, once BeatStars has made it
  oldArtwork?: string | null // what the artwork showed before the cover went in, for waitForUploads
}

export type FileSlot = 'untagged' | 'tagged' | 'stems'

const SECTION: Record<FileSlot, string> = {
  untagged: 'studio-track-form-untagged',
  tagged: 'studio-track-form-tagged',
  stems: 'studio-track-form-stems',
}
const FILE_NAME: Record<FileSlot, string> = { untagged: 'the WAV', tagged: 'the tagged MP3', stems: 'the stems' }

// A new track, filled in up to just before "Publish track". `progress` hears each step as it's done, for the step log.
export async function fillInTrack(page: Page, upload: TrackUpload, draft: Draft, progress: (line: string) => void): Promise<void> {
  await openStudio(page)
  draft.url = await createTrack(page, upload.untagged)
  progress('Started a new track with the WAV')
  await completeTrack(page, upload, draft, progress)
}

// Fills in whatever the draft is missing, then waits for every upload. Retry uses it too: it carries on with the
// same draft and keeps what's there, including anything the user fixed by hand in the Chrome window.
export async function completeTrack(page: Page, upload: TrackUpload, draft: Draft, progress: (line: string) => void): Promise<void> {
  if (draft.url && page.url() !== draft.url) await openDraft(page, draft.url)
  await fillDetails(page, upload)
  progress(`Title, ${upload.bpm} BPM and key filled in`)
  // The cover again only if it never went in, or the artwork still shows what it did before.
  if (draft.oldArtwork === undefined || (await artworkPicture(page)) === draft.oldArtwork) draft.oldArtwork = await setArtwork(page, upload.cover)
  await setFreeDownload(page, upload.freeDownload)
  progress(upload.freeDownload ? 'Free download on, non-commercial use only' : 'Free download off')
  const files: [FileSlot, string | null][] = [['untagged', upload.untagged], ['tagged', upload.tagged], ['stems', upload.stems]]
  for (const [slot, file] of files) if (file && (await slotState(page, slot)) === 'empty') await attach(page, slot, file)
  progress('Waiting for BeatStars to take the files and the artwork')
  await waitForUploads(page, files.filter(([, file]) => file).map(([slot]) => slot), draft.oldArtwork)
  progress('Every file attached, and the artwork is in')
}

// Opens the dashboard. Logged out, the Studio sends visitors to its sign-up page instead.
export async function openStudio(page: Page): Promise<void> {
  await page.goto(`${STUDIO}/dashboard`)
  const create = page.getByRole('button', { name: 'Create Track' })
  await create.waitFor({ timeout: 30_000 }).catch(() => {})
  if (new URL(page.url()).host !== 'studio.beatstars.com' || !(await create.isVisible()))
    throw new Error('BeatStars sent the app to its sign-up page. Log in again: Settings → BeatStars.')
}

// A draft again, in a new window or after a reload: BeatStars saves drafts as they're filled in.
export async function openDraft(page: Page, url: string): Promise<void> {
  await page.goto(url)
  await form(page)
    .waitFor({ timeout: 60_000 })
    .catch(() => {
      throw new Error("Couldn't open the BeatStars draft. If BeatStars logged the app out, log in again: Settings → BeatStars.")
    })
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

// Title, BPM and key, each read back afterwards, so the review's "Matched" means BeatStars really has them.
export async function fillDetails(page: Page, { title, bpm, key }: Pick<TrackUpload, 'title' | 'bpm' | 'key'>): Promise<void> {
  const titleBox = page.locator('input#title')
  const bpmBox = form(page).locator('input[type=number]')
  const keyList = form(page).locator('select')
  await titleBox.fill(title)
  await bpmBox.fill(String(bpm))
  await keyList.selectOption(key)
  if ((await titleBox.inputValue()) !== title || Number(await bpmBox.inputValue()) !== bpm || (await keyList.inputValue()) !== key)
    throw new Error("BeatStars didn't keep the title, BPM or key. Have a look in the Chrome window, then retry.")
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
  if ((await commercial.getAttribute('aria-checked')) !== 'false') throw new Error("BeatStars didn't switch off commercial use for the free download.")
}

// A file into its slot: "Add" in that slot's section, then the file.
export async function attach(page: Page, slot: FileSlot, file: string): Promise<void> {
  try {
    await page.locator(SECTION[slot]).getByRole('button', { name: 'Add' }).click()
    await chooseFile(page, file)
  } catch (error) {
    throw new Error(`Couldn't add ${FILE_NAME[slot]} on BeatStars: ${firstLine(error)}`)
  }
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

const NOT_YET: Record<SlotState, string> = { empty: 'dropped', uploading: 'still uploading', attaching: 'still attaching', attached: '' }

// Waits until these slots have their files and the artwork shows something other than `oldArtwork`. BeatStars
// sometimes drops an upload (CLAUDE.md, "BeatStars glitches"): a slot still empty after half a minute gives up
// straight away, anything else after UPLOAD_TIMEOUT.
export async function waitForUploads(page: Page, slots: FileSlot[], oldArtwork: string | null | undefined): Promise<void> {
  const started = Date.now()
  for (;;) {
    const states = await Promise.all(slots.map((slot) => slotState(page, slot)))
    const artwork = (await artworkPicture(page)) !== oldArtwork
    if (artwork && states.every((state) => state === 'attached')) return
    const waited = Date.now() - started
    if (waited > UPLOAD_TIMEOUT || (waited > 30_000 && states.includes('empty'))) {
      const missing = slots.flatMap((slot, i) => (states[i] === 'attached' ? [] : [`${FILE_NAME[slot]} (${NOT_YET[states[i]]})`]))
      if (!artwork) missing.push('the artwork')
      throw new Error(`BeatStars didn't take ${missing.join(' or ')}. Fix it in the Chrome window (reload the draft, then pick the file from the list under the upload dialog), then retry.`)
    }
    await page.waitForTimeout(2000)
  }
}

// "Publish track", then BeatStars' confirmation: a dialog with the track's link and a copy button. Answers with the
// link, or null when the confirmation doesn't show one.
export async function publishTrack(page: Page): Promise<string | null> {
  await page.getByRole('button', { name: 'Publish track' }).click()
  const copy = page.locator('bs-btn-copy-to-clipboard')
  await copy.waitFor({ timeout: 2 * 60_000 }).catch(() => {
    throw new Error("BeatStars didn't confirm the publish. Have a look in the Chrome window.")
  })
  // The link sits in the dialog, as text or in a box; the page around it has no other BeatStars links.
  const dialog = page.locator('mat-dialog-container, [role=dialog]').filter({ has: copy })
  const where = (await dialog.count()) ? dialog.last() : page.locator('body')
  const boxes = await Promise.all((await where.locator('input').all()).map((box) => box.inputValue().catch(() => '')))
  const text = [await where.innerText(), ...boxes].join('\n')
  return text.match(/https?:\/\/(?:www\.)?(?:beatstars\.com|bsta\.rs)\/\S+/)?.[0] ?? null
}

// Every file goes in through BeatStars' upload dialog. Waiting for the file chooser keeps Windows' own dialog closed.
async function chooseFile(page: Page, file: string): Promise<void> {
  const chooser = page.waitForEvent('filechooser')
  await page.getByRole('button', { name: 'browse files' }).click()
  await (await chooser).setFiles(file)
}

const form = (page: Page): Locator => page.locator('studio-track-form-metadata-wrapper')
const artworkPicture = (page: Page) => page.locator('studio-track-form-artwork-upload img').first().getAttribute('src')
export const firstLine = (error: unknown) => (error instanceof Error ? error.message : String(error)).split('\n')[0]
