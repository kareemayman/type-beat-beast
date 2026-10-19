// Where a published beat's files go (see CLAUDE.md, "Beat folder"): a folder named after the beat, next to its
// .flp or in the output folder picked in Settings, holding the project and everything rendered from it.
import { win32 as path } from 'node:path'

export interface BeatFiles {
  folder: string // <folder of the .flp>\<beat name>
  flp: string // <project>.flp, moved in at the very end
  wav: string // <project>.wav, untagged
  taggedMp3: string // <project> TAGGED.mp3, for BeatStars and the YouTube video
  stems: string // <beat name>.rar
}

// `project` below is the .flp's file name without ".flp", like "flowers - 140 Em".
export function beatFiles(projectPath: string, beatName: string, outputFolder: string): BeatFiles {
  const project = path.basename(projectPath, path.extname(projectPath))
  const name = safeName(beatName) || safeName(project)
  const folder = path.join(outputFolder || path.dirname(projectPath), name)
  return {
    folder,
    flp: path.join(folder, path.basename(projectPath)),
    wav: path.join(folder, `${project}.wav`),
    taggedMp3: path.join(folder, `${project} TAGGED.mp3`),
    stems: path.join(folder, `${name}.rar`),
  }
}

// A beat name as a Windows folder or file name. The name can be edited in the app, so it may hold characters
// Windows doesn't allow (\ / : * ? " < > |), end in dots or spaces (which Windows drops), or be a name Windows
// keeps for devices (CON, NUL, COM1...).
export function safeName(name: string): string {
  const cleaned = name.replace(/[\\/:*?"<>|\x00-\x1f]/g, '-').trim().replace(/[. ]+$/, '')
  return /^(con|prn|aux|nul|com\d|lpt\d)$/i.test(cleaned) ? `${cleaned}_` : cleaned
}
