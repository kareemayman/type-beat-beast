import { app, BrowserWindow, shell, type BrowserWindowConstructorOptions } from 'electron'
import { join } from 'node:path'
import type { Theme } from '../shared/api'

// Windows draws real minimize/maximize/close buttons over each window's own title bar; these are their colors.
// The overlay is 37 px tall, 3 px short of the 40 px title bar, so the bar's bottom border shows under the buttons.
export const CAPTION_BUTTONS: Record<Theme, Electron.TitleBarOverlayOptions> = {
  dark: { color: '#000000', symbolColor: '#9DB0C7', height: 37 },
  light: { color: '#E9EEF5', symbolColor: '#1E3E62', height: 37 },
}

// Every window the app opens gets the same locked-down page and the same rules for links and navigation.
// `page` is the HTML file it shows: index.html for the main window, notes.html for Notes.
export function createWindow(page: string, options: BrowserWindowConstructorOptions): BrowserWindow {
  const window = new BrowserWindow({
    show: false, // shown once the page has painted, so the window never flashes white
    backgroundColor: '#0B192C',
    titleBarStyle: 'hidden', // no standard title bar: the page draws its own
    titleBarOverlay: CAPTION_BUTTONS.dark,
    ...options,
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

  // In development, electron-vite serves the pages from a dev server with hot reload;
  // in the built app they're plain HTML files next to this one.
  const devServerUrl = process.env['ELECTRON_RENDERER_URL']
  if (!app.isPackaged && devServerUrl) void window.loadURL(`${devServerUrl}/${page}`)
  else void window.loadFile(join(__dirname, '../renderer', page))
  return window
}
