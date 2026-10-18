import { app } from 'electron'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { cleanSettings, DEFAULT_SETTINGS, type Settings } from '../shared/settings'

// The settings live in one JSON file in the app's data folder, %APPDATA%\Type Beat Beast\settings.json.
// The main process owns it, like an Express server owns its database, and the page goes through IPC.
// (localStorage wasn't a good home: it belongs to the page's address, so the dev server and the built app
// each had their own copy.)
const file = () => join(app.getPath('userData'), 'settings.json')

let current: Settings | null = null
let reading: Promise<void> | null = null
let writing: Promise<void> = Promise.resolve()

// Reads the file the first time anything needs the settings; later calls share that one read.
function readOnce(): Promise<void> {
  reading ??= (async () => {
    try {
      current = cleanSettings(JSON.parse(await readFile(file(), 'utf8')))
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return // first launch: nothing saved yet
      // A damaged file shouldn't keep the app from opening; the next change writes a good one.
      console.error('Settings file unreadable, using the defaults:', error)
      current = { ...DEFAULT_SETTINGS }
    }
  })()
  return reading
}

// What's saved, or null on the very first launch, before anything was saved.
export async function loadSettings(): Promise<Settings | null> {
  await readOnce()
  return current
}

// Merges a change from the page into the settings and saves them. Values of the wrong shape are dropped.
export async function saveSettings(change: unknown): Promise<Settings> {
  await readOnce()
  // Nothing waits between here and `current = next`, so two changes can never start from the same old settings.
  const base = current ?? DEFAULT_SETTINGS
  const next = cleanSettings({ ...base, ...(typeof change === 'object' ? change : {}) }, base)
  current = next
  // One write at a time, each into a temporary file that then replaces the real one, so a crash
  // mid-write can't leave half a file behind.
  writing = writing
    .catch(() => {})
    .then(async () => {
      await mkdir(dirname(file()), { recursive: true })
      await writeFile(`${file()}.tmp`, JSON.stringify(next, null, 2))
      await rename(`${file()}.tmp`, file())
    })
  await writing
  return next
}
