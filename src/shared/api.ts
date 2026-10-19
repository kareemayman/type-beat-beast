import type { ReadProjectResult } from './project'
import type { Settings } from './settings'

export type Theme = 'dark' | 'light'

// FL Studio as the app sees it: where FL64.exe is and its version, or why it can't be used.
export type FlStudioStatus = { ok: true; path: string; version: string | null } | { ok: false; error: string }

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
  // Finds FL Studio: the path in Settings, else the one FL's installer recorded. Saves what it finds.
  findFlStudio(): Promise<FlStudioStatus>
  // Opens Windows' file dialog to point to FL64.exe. Saved when it checks out; null if the user cancels.
  pickFlStudio(): Promise<FlStudioStatus | null>
  // Opens Windows' folder dialog for where beat folders go. Answers with the folder (the page saves it), or null.
  pickOutputFolder(): Promise<string | null>
}
