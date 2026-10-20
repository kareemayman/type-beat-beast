import type { ReadProjectResult } from './project'
import type { Settings } from './settings'

export type Theme = 'dark' | 'light'

// FL Studio as the app sees it: where FL64.exe is and its version, or why it can't be used.
export type FlStudioStatus = { ok: true; path: string; version: string | null } | { ok: false; error: string }

// One beat's run, as the page asks for it (see src/main/run.ts).
export interface RunRequest {
  project: string // the .flp
  beatName: string
  tagIndex: number | null // the tag's mixer track, or null for no tag
  stems: boolean
}

// The steps the main process really does so far; BeatStars and YouTube are still simulated in the page.
export type RealStep = 'wav' | 'mp3' | 'rar' | 'tidy'

export type RunStart = { ok: true; id: string } | { ok: false; error: string }

// Whether the app's own Chrome profile is logged in to BeatStars, or why that couldn't be checked.
export type BeatStarsSession = { ok: true; loggedIn: boolean } | { ok: false; error: string }
export type StepResult = { ok: true; log: string[] } | { ok: false; error: string }

// The contract between the React app and the preload: everything React is allowed to use is listed here.
export interface Api {
  // Full path of a file the user dropped or picked. The page only sees file names; the main process needs paths.
  pathForFile(file: File): string
  // Reads an FL Studio project in the main process: beat info from its name, plus its mixer tracks.
  readProject(path: string): Promise<ReadProjectResult>
  // Recolors the minimize/maximize/close buttons Windows draws over the title bar.
  setTheme(theme: Theme): void
  // The saved settings, or null on the very first launch.
  loadSettings(): Promise<Settings | null>
  // Saves a change and answers with all the settings as saved.
  saveSettings(change: Partial<Settings>): Promise<Settings>
  // Changes saved from another window, as they happen (the main process pushes them). Returns a function that
  // stops listening.
  onSettingsChanged(listener: (change: Partial<Settings>) => void): () => void
  // Finds FL Studio: the path in Settings, else the one FL's installer recorded. Saves what it finds.
  findFlStudio(): Promise<FlStudioStatus>
  // Opens Windows' file dialog to point to FL64.exe. Saved when it checks out; null if the user cancels.
  pickFlStudio(): Promise<FlStudioStatus | null>
  // Opens Windows' folder dialog for where beat folders go. Answers with the folder (the page saves it), or null.
  pickOutputFolder(): Promise<string | null>
  // Opens Explorer with this file selected.
  showInFolder(path: string): void
  // Opens the Notes window, or brings it to the front.
  openNotes(): void
  // Whether the Notes window is open, each time that changes. Returns a function that stops listening.
  onNotesChanged(listener: (open: boolean) => void): () => void
  // Starts a beat's run in the main process (finds FL, reads the project). Answers with the run's id, or why not.
  startRun(request: RunRequest): Promise<RunStart>
  // Does one real step of a run; answers with lines for the step log, or why it failed.
  runStep(id: string, step: RealStep): Promise<StepResult>
  // Stops a run: closes FL if it's rendering, then clears the run's temporary files.
  stopRun(id: string): void
  // Checks the BeatStars session in the app's own Chrome profile (takes a few seconds).
  beatStarsSession(): Promise<BeatStarsSession>
  // Opens a Chrome window on BeatStars' login page; answers once the user has closed it.
  logInToBeatStars(): Promise<BeatStarsSession>
  // Deletes the app's Chrome profile, and with it the BeatStars session.
  logOutOfBeatStars(): Promise<BeatStarsSession>
}
