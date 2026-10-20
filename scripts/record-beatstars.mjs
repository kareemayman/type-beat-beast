// Records one BeatStars upload done by hand, to write the app's upload script from (Phase 3). Opens Playwright's
// recorder on the app's own Chrome profile, at BeatStars' sign-in page, which already holds the login: the user clicks
// "Continue to app" and uploads a beat as usual. Every click and typed value lands in
// recordings\beatstars-upload-<date>-<time>.js, which git ignores. Run it with `npm run record:beatstars`.
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const LOGIN = 'https://oauth.beatstars.com/verify?app=WEB_STUDIO&origin=https://studio.beatstars.com&send_callback=true'

const root = fileURLToPath(new URL('..', import.meta.url))
const { productName } = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'))
const profile = join(process.env.APPDATA ?? '', productName, 'chrome-profile') // the app's data folder, as Electron names it

if (!existsSync(profile)) {
  console.error("The app's Chrome profile doesn't exist yet. Log in first: Settings → BeatStars → Log in.")
  process.exit(1)
}

const pad = (n) => String(n).padStart(2, '0')
const now = new Date()
const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`
const output = join(root, 'recordings', `beatstars-upload-${stamp}.js`)
await mkdir(join(root, 'recordings'), { recursive: true })

console.log(`Recording into ${relative(root, output)}
  1. Click "Continue to app". Don't type your password in this window: if BeatStars asks you to log in, close it
     and log in from the app first (Settings → BeatStars).
  2. Upload a beat the way you always do. Pick the files with BeatStars' own upload buttons: the recorder can't see
     files dragged in from Explorer.
  3. Publish it, or stop just before publishing. Then close the Chrome window.`)

// Ctrl+C reaches the recorder too, which closes Chrome and exits. This script waits for that, then cleans the file.
process.on('SIGINT', () => {})
const cli = join(root, 'node_modules', 'playwright-core', 'cli.js')
const args = ['codegen', '--channel', 'chrome', '--user-data-dir', profile, '--target', 'javascript', '--output', output, LOGIN]
const code = await new Promise((resolve, reject) => {
  const recorder = spawn(process.execPath, [cli, ...args], { stdio: 'inherit' })
  recorder.on('error', reject)
  recorder.on('exit', resolve)
})

if (!existsSync(output)) {
  console.error(code ? "The recorder stopped with an error. Is the app's BeatStars window still open?" : 'Nothing was recorded.')
  process.exit(1)
}
// The recorder writes down everything typed, a password too. Whatever went into a field named like one is removed.
const text = await readFile(output, 'utf8')
const safe = text.replace(/^(.*password.*\.fill\().*\);$/gim, "$1'<removed>');")
if (safe !== text) {
  await writeFile(output, safe)
  console.log('A password was typed during the recording. It has been removed from the file.')
}
console.log(`Saved ${relative(root, output)}`)
