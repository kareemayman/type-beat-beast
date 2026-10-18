import type { ReadProjectResult } from './project'
import type { Settings } from './settings'

export type Theme = 'dark' | 'light'

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
}
