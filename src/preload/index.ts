// Preload: runs inside the window before the page loads, and decides exactly what the React app can use.
import { contextBridge, ipcRenderer, webUtils } from 'electron'
import type { Api } from '../shared/api'

const api: Api = {
  pathForFile: (file) => webUtils.getPathForFile(file),
  // invoke = request and response over IPC, like fetch() to an Express route. The main process answers in ipcMain.handle.
  readProject: (path) => ipcRenderer.invoke('project:read', path),
  // send = one-way message with no answer. The main process listens with ipcMain.on.
  setTheme: (theme) => ipcRenderer.send('window:theme', theme),
  loadSettings: () => ipcRenderer.invoke('settings:load'),
  saveSettings: (change) => ipcRenderer.invoke('settings:save', change),
}

// Makes `window.api` available to the page. Only what's in `api` crosses over, nothing else.
contextBridge.exposeInMainWorld('api', api)
