// Main process: the app's "server". It runs Node.js, owns the windows, and has full access to the PC.
import { app, BrowserWindow, dialog, ipcMain, shell, type OpenDialogOptions } from 'electron'
import { existsSync } from 'node:fs'
import { isAbsolute, join } from 'node:path'
import { savedPart } from '../shared/settings'
import { findFlStudio, pickFlStudio } from './flStudio'
import { closeNotes, openNotes } from './notes'
import { readProject } from './project'
import { restoreExportChoices } from './render'
import { loadSettings, saveSettings } from './settings'
import { CAPTION_BUTTONS, createWindow } from './windows'

// While FL renders, the user's own Export choices wait in this file (see render.ts).
const exportBackupFile = () => join(app.getPath('userData'), 'fl-export-backup.json')

function createMainWindow(): void {
  const window = createWindow('index.html', { width: 1280, height: 800, minWidth: 1100, minHeight: 700, title: 'Type Beat Beast' })
  // Notes belongs to the main window, so it closes with it (and then the app quits).
  window.on('closed', closeNotes)
}

// IPC routes: the main-process side of `window.api` (see src/preload/index.ts). Like Express routes, they
// check what the page sends before using it.
ipcMain.handle('project:read', (_event, path: unknown) => {
  if (typeof path !== 'string' || !path.toLowerCase().endsWith('.flp')) {
    return { ok: false, error: "That isn't an FL Studio project." }
  }
  return readProject(path)
})

// Settings: each window loads them once and sends each change. saveSettings checks every value, and the other
// windows hear what changed, so a theme switch in the main window shows in Notes at once.
ipcMain.handle('settings:load', () => loadSettings())
ipcMain.handle('settings:save', async (event, change: unknown) => {
  const settings = await saveSettings(change)
  const changed = savedPart(change, settings)
  for (const window of BrowserWindow.getAllWindows()) {
    if (window.webContents !== event.sender) window.webContents.send('settings:changed', changed)
  }
  return settings
})

// FL Studio: found on its own, or pointed to by the user in a file dialog opened over the asking window.
ipcMain.handle('fl:find', () => findFlStudio())
ipcMain.handle('fl:pick', (event) => pickFlStudio(BrowserWindow.fromWebContents(event.sender)))

// Output folder: Windows' folder dialog. Only the answer goes back; the page saves it like any other setting.
ipcMain.handle('output:pick', async (event) => {
  const parent = BrowserWindow.fromWebContents(event.sender)
  const options: OpenDialogOptions = {
    title: 'Where should beat folders go?',
    defaultPath: (await loadSettings())?.outputFolder || undefined,
    properties: ['openDirectory'],
  }
  const { canceled, filePaths } = parent ? await dialog.showOpenDialog(parent, options) : await dialog.showOpenDialog(options)
  return canceled ? null : (filePaths[0] ?? null)
})

// "Open folder": Explorer opens with the file selected. Only full paths to things that exist get through.
ipcMain.on('shell:show', (_event, path: unknown) => {
  if (typeof path === 'string' && isAbsolute(path) && existsSync(path)) shell.showItemInFolder(path)
})

// Notes: the rail's button opens the Notes window, or brings it to the front.
ipcMain.on('notes:open', (event) => {
  const main = BrowserWindow.fromWebContents(event.sender)
  if (main) openNotes(main)
})

// Each window recolors its own caption buttons when its page switches theme.
ipcMain.on('window:theme', (event, theme: unknown) => {
  if (theme !== 'dark' && theme !== 'light') return
  BrowserWindow.fromWebContents(event.sender)?.setTitleBarOverlay(CAPTION_BUTTONS[theme])
})

app.whenReady().then(() => {
  // If the app closed in the middle of a render, FL still has the render's Export choices: put the user's back.
  restoreExportChoices(exportBackupFile()).catch((error) => console.error("Couldn't restore FL's Export choices:", error))
  createMainWindow()

  // macOS habit: clicking the dock icon with no windows open creates one.
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow()
  })
})

// On Windows, closing the last window quits the app.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
