// The app's own Chrome profile (%APPDATA%\Type Beat Beast\chrome-profile) and the BeatStars session in it. The user
// logs in there once, in a normal Chrome window with no automation attached, so any sign-in method works (Apple, X
// and Discord often refuse windows a script controls) and the app never sees a password. Playwright drives the same
// profile for the login check, and later for uploads.
import { app } from 'electron'
import { spawn } from 'node:child_process'
import { rm, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { chromium } from 'playwright-core'
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

const NO_CHROME: BeatStarsSession = { ok: false, error: "Couldn't find Google Chrome. Install it to use BeatStars from the app." }

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
