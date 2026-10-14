// Main process: the app's "server". It runs Node.js, owns the windows, and has full access to the PC.
import { app, BrowserWindow, shell } from 'electron'
import { join } from 'node:path'

function createMainWindow(): void {
  const window = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1100,
    minHeight: 700,
    show: false, // shown once the page has painted, so the window never flashes white
    backgroundColor: '#0B192C',
    title: 'Type Beat Beast',
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

  // In development, electron-vite serves the React app from a dev server with hot reload;
  // in the built app it's a plain HTML file next to this one.
  const devServerUrl = process.env['ELECTRON_RENDERER_URL']
  if (!app.isPackaged && devServerUrl) void window.loadURL(devServerUrl)
  else void window.loadFile(join(__dirname, '../renderer/index.html'))
}

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
