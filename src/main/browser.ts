// The app's own Chrome profile (%APPDATA%\Type Beat Beast\chrome-profile) and the BeatStars session in it. The user
// logs in there once, in a normal Chrome window with no automation attached, so any sign-in method works (Apple, X
// and Discord often refuse windows a script controls) and the app never sees a password. Playwright drives the same
// profile for the login check, and later for uploads.
import { app, screen } from 'electron'
import { spawn } from 'node:child_process'
import { rm, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { chromium, type Page } from 'playwright-core'
import type { BeatStarsSession } from '../shared/api'
import { readRegistryDefault } from './registry'

const LOGIN = 'https://oauth.beatstars.com/verify?app=WEB_STUDIO&origin=https://studio.beatstars.com&send_callback=true'

export const profileDir = () => join(app.getPath('userData'), 'chrome-profile')

const exists = (path: string) =>
  stat(path).then(
    () => true,
    () => false,
  )

// Chrome's path, as its installer records it, or where it usually is.
export async function findChrome(): Promise<string | null> {
  const recorded = [
    await readRegistryDefault('HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths\\chrome.exe'),
    await readRegistryDefault('HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths\\chrome.exe'),
  ]
  const usual = ['C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', join(process.env['LOCALAPPDATA'] ?? '', 'Google\\Chrome\\Application\\chrome.exe')]
  for (const path of [...recorded, ...usual]) if (path && (await exists(path))) return path
  return null
}

// One thing at a time uses the profile: Chrome locks it while it's open.
let queue: Promise<unknown> = Promise.resolve()
function exclusive<T>(task: () => Promise<T>): Promise<T> {
  const turn = queue.then(task, task)
  queue = turn.catch(() => {})
  return turn
}

const NO_CHROME_MESSAGE = "Couldn't find Google Chrome. Install it to use BeatStars from the app."
const NO_CHROME: BeatStarsSession = { ok: false, error: NO_CHROME_MESSAGE }

// The login as the Studio keeps it in its local storage (the same keys as the sign-in site): a refresh token, and an
// access token with its expiry (30 days from logging in). Logged in means a refresh token, or an access token that
// hasn't expired.
interface StoredLogin {
  access: boolean
  refresh: boolean
  expires: number // ms since 1970; 0 when unknown
}

export function isLoggedIn(login: StoredLogin, now = Date.now()): boolean {
  return login.refresh || (login.access && login.expires > now)
}

// Is the app's profile logged in to the Studio, where uploads happen? A hidden Chrome reads the Studio's storage. It
// loads a static file there (robots.txt), so no BeatStars code runs. The Studio only gets the login when the user
// reaches it after signing in ("Continue to app", or BeatStars' own jump to the Studio). So the sign-in site's storage
// is no test: it said "Logged in" while the Studio still sent the app to the sign-up page.
export function beatStarsSession(): Promise<BeatStarsSession> {
  return exclusive(checkSession)
}

async function checkSession(): Promise<BeatStarsSession> {
  if (!(await exists(profileDir()))) return { ok: true, loggedIn: false }
  const chrome = await findChrome()
  if (!chrome) return NO_CHROME
  try {
    const context = await chromium.launchPersistentContext(profileDir(), { executablePath: chrome, headless: true })
    try {
      const page = context.pages()[0] ?? (await context.newPage())
      await page.goto('https://studio.beatstars.com/robots.txt', { waitUntil: 'domcontentloaded', timeout: 30_000 })
      // Only whether the tokens are there and when the access token expires leave the page, never a token.
      const login: StoredLogin = await page.evaluate(() => ({
        access: !!localStorage.getItem('access_token'),
        refresh: !!localStorage.getItem('refresh_token'),
        expires: Number(localStorage.getItem('access_token_expiration')) || 0,
      }))
      return { ok: true, loggedIn: isLoggedIn(login) }
    } finally {
      await context.close()
    }
  } catch (error) {
    const message = error instanceof Error ? error.message.split('\n')[0] : String(error)
    return { ok: false, error: `Couldn't check BeatStars (is its Chrome window still open?): ${message}` }
  }
}

// Opens a normal Chrome window on BeatStars' login page, in the app's profile, and waits for the user to close it.
// Then it checks whether the login took, which it has once the user's Studio dashboard showed in that window.
export function logInToBeatStars(): Promise<BeatStarsSession> {
  return exclusive(async () => {
    const chrome = await findChrome()
    if (!chrome) return NO_CHROME
    await new Promise<void>((resolve, reject) => {
      const window = spawn(chrome, [`--user-data-dir=${profileDir()}`, '--no-first-run', '--no-default-browser-check', LOGIN], { stdio: 'ignore' })
      window.on('error', reject)
      window.on('exit', () => resolve())
    })
    return checkSession()
  })
}

// The Chrome window an upload works in (beatstarsUpload.ts). It stays open from the fill-in until the user publishes
// or stops, holding the profile all that time (Chrome locks it), so a login check or a log out waits until it closes.
export interface UploadBrowser {
  page: Page
  isOpen(): boolean
  show(): Promise<void> // onto the main screen, maximized, in front
  close(): Promise<void>
}

// Settings → Show Chrome on: a normal maximized window. Off: a normal window too (BeatStars sees an ordinary
// browser either way), but placed left of every screen until show() brings it over.
export function openUploadBrowser(visible: boolean): Promise<UploadBrowser> {
  return new Promise((resolve, reject) => {
    exclusive(async () => {
      const chrome = await findChrome()
      if (!chrome) throw new Error(NO_CHROME_MESSAGE)
      const offScreen = Math.min(...screen.getAllDisplays().map((display) => display.bounds.x)) - 2000
      const context = await chromium.launchPersistentContext(profileDir(), {
        executablePath: chrome,
        headless: false,
        viewport: null, // the page fills the window, like in normal Chrome
        args: visible ? ['--start-maximized'] : [`--window-position=${offScreen},0`, '--window-size=1600,1000'],
      })
      let open = true
      const closed = new Promise<void>((done) => context.once('close', () => done()))
      void closed.then(() => (open = false))
      const page = context.pages()[0] ?? (await context.newPage())
      resolve({ page, isOpen: () => open, show: () => bringUp(page), close: () => context.close() })
      await closed
    }).catch(reject)
  })
}

// Moves the window onto the main screen and maximizes it, through Chrome's DevTools protocol (CDP).
async function bringUp(page: Page): Promise<void> {
  const cdp = await page.context().newCDPSession(page)
  try {
    const { windowId } = await cdp.send('Browser.getWindowForTarget')
    const { x, y, width, height } = screen.getPrimaryDisplay().workArea
    await cdp.send('Browser.setWindowBounds', { windowId, bounds: { left: x, top: y, width, height, windowState: 'normal' } })
    await cdp.send('Browser.setWindowBounds', { windowId, bounds: { windowState: 'maximized' } })
  } finally {
    await cdp.detach()
  }
  await page.bringToFront()
}

// Logs out by deleting the app's profile, whose cookies are the session. The user's own Chrome isn't touched.
export function logOutOfBeatStars(): Promise<BeatStarsSession> {
  return exclusive(async () => {
    try {
      await rm(profileDir(), { recursive: true, force: true })
      return { ok: true, loggedIn: false }
    } catch {
      return { ok: false, error: "Couldn't log out. Close the BeatStars Chrome window, then try again." }
    }
  })
}
