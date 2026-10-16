import type { ReadProjectResult } from './project'

export type Theme = 'dark' | 'light'

// The contract between the React app and the preload: everything React is allowed to use is listed here.
export interface Api {
  versions: {
    electron: string
    chrome: string
    node: string
  }
  // Full path of a file the user dropped or picked. The page only sees file names; the main process needs paths.
  pathForFile(file: File): string
  // Reads an FL Studio project in the main process: beat info from its name, plus its mixer tracks.
  readProject(path: string): Promise<ReadProjectResult>
  // Recolors the minimize/maximize/close buttons Windows draws over the title bar.
  setTheme(theme: Theme): void
}
