// Where a published beat's files go (see CLAUDE.md, "Beat folder"): a folder named after the beat, next to its
// .flp or in the output folder picked in Settings, holding the project and everything rendered from it.
import { mkdir, readdir } from 'node:fs/promises'
import { win32 as path } from 'node:path'

export interface BeatFiles {
  folder: string // <folder of the .flp>\<beat name>
  flp: string // <project>.flp, moved in once everything is published
  wav: string // <project>.wav, untagged
  taggedMp3: string // <project> TAGGED.mp3, for BeatStars and the YouTube video
  stems: string // <beat name>.rar (.zip without WinRAR)
}

// `project` below is the .flp's file name without ".flp", like "flowers - 140 Em".
export function beatFiles(projectPath: string, beatName: string, outputFolder: string): BeatFiles {
  const name = safeName(beatName) || safeName(projectName(projectPath))
  return filesIn(path.join(outputFolder || path.dirname(projectPath), name), projectPath, name)
}

const projectName = (projectPath: string) => path.basename(projectPath, path.extname(projectPath))

function filesIn(folder: string, projectPath: string, name: string): BeatFiles {
  const project = projectName(projectPath)
  return {
    folder,
    flp: path.join(folder, path.basename(projectPath)),
    wav: path.join(folder, `${project}.wav`),
    taggedMp3: path.join(folder, `${project} TAGGED.mp3`),
    stems: path.join(folder, `${name}.rar`),
  }
}

// Makes the beat folder. A folder by that name that's empty or already holds this project's files (a re-run) is
// used as it is; one holding a different beat is left alone, and this beat goes into "<name> (2)", "<name> (3)"...
export async function createBeatFolder(files: BeatFiles, projectPath: string): Promise<BeatFiles> {
  const project = projectName(projectPath).toLowerCase()
  const name = path.basename(files.stems, path.extname(files.stems))
  for (let n = 1; ; n++) {
    const folder = n === 1 ? files.folder : `${files.folder} (${n})`
    const entries = await readdir(folder).catch(() => null)
    if (entries === null) await mkdir(folder, { recursive: true })
    if (entries === null || entries.length === 0 || entries.some((entry) => entry.toLowerCase().startsWith(project))) {
      return filesIn(folder, projectPath, name)
    }
  }
}

// A beat name as a Windows folder or file name. The name can be edited in the app, so it may hold characters
// Windows doesn't allow (\ / : * ? " < > |), end in dots or spaces (which Windows drops), or be a name Windows
// keeps for devices (CON, NUL, COM1...).
export function safeName(name: string): string {
  const cleaned = name.replace(/[\\/:*?"<>|\x00-\x1f]/g, '-').trim().replace(/[. ]+$/, '')
  return /^(con|prn|aux|nul|com\d|lpt\d)$/i.test(cleaned) ? `${cleaned}_` : cleaned
}
