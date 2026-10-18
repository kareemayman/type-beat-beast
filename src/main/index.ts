// Main process: the app's "server". It runs Node.js, owns the windows, and has full access to the PC.
import { app, BrowserWindow, ipcMain, shell } from 'electron'
import { join } from 'node:path'
import type { Theme } from '../shared/api'
import { findFlStudio, pickFlStudio } from './flStudio'
import { readProject } from './project'
import { loadSettings, saveSettings } from './settings'

// Windows draws real minimize/maximize/close buttons over the app's own title bar; these are their colors.
// The overlay is 37 px tall, 3 px short of the 40 px title bar, so the bar's bottom border shows under the buttons.
const CAPTION_BUTTONS: Record<Theme, Electron.TitleBarOverlayOptions> = {
  dark: { color: '#000000', symbolColor: '#9DB0C7', height: 37 },
  light: { color: '#E9EEF5', symbolColor: '#1E3E62', height: 37 },
}

function createMainWindow(): void {
  const window = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1100,
    minHeight: 700,
    show: false, // shown once the page has painted, so the window never flashes white
    backgroundColor: '#0B192C',
    title: 'Type Beat Beast',
    titleBarStyle: 'hidden', // no standard title bar: the page draws its own
    titleBarOverlay: CAPTION_BUTTONS.dark,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      // Electron's security defaults, spelled out: the page gets no Node.js and can't reach into the preload.
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  window.once('ready-to-show', () => window.show())

  // Links that would open a new window go to the user's browser instead, and only if they're https.
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) void shell.openExternal(url)
    return { action: 'deny' }
  })

  // The page never navigates away, e.g. when a file is dropped outside a drop zone.
  window.webContents.on('will-navigate', (event) => event.preventDefault())

  // In development, electron-vite serves the React app from a dev server with hot reload;
  // in the built app it's a plain HTML file next to this one.
  const devServerUrl = process.env['ELECTRON_RENDERER_URL']
  if (!app.isPackaged && devServerUrl) void window.loadURL(devServerUrl)
  else void window.loadFile(join(__dirname, '../renderer/index.html'))
}

// IPC routes: the main-process side of `window.api` (see src/preload/index.ts). Like Express routes, they
// check what the page sends before using it.
ipcMain.handle('project:read', (_event, path: unknown) => {
  if (typeof path !== 'string' || !path.toLowerCase().endsWith('.flp')) {
    return { ok: false, error: "That isn't an FL Studio project." }
  }
  return readProject(path)
})

// Settings: the page loads them once at start-up and sends each change. saveSettings checks every value.
ipcMain.handle('settings:load', () => loadSettings())
ipcMain.handle('settings:save', (_event, change: unknown) => saveSettings(change))

// FL Studio: found on its own, or pointed to by the user in a file dialog opened over the asking window.
ipcMain.handle('fl:find', () => findFlStudio())
ipcMain.handle('fl:pick', (event) => pickFlStudio(BrowserWindow.fromWebContents(event.sender)))

ipcMain.on('window:theme', (event, theme: unknown) => {
  if (theme !== 'dark' && theme !== 'light') return
  BrowserWindow.fromWebContents(event.sender)?.setTitleBarOverlay(CAPTION_BUTTONS[theme])
})

app.whenReady().then(() => {
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
