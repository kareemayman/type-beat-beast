// Preload: runs inside each window before its page loads, and decides exactly what the React app can use.
import { contextBridge, ipcRenderer, webUtils, type IpcRendererEvent } from 'electron'
import type { Api } from '../shared/api'

// Messages the main process sends on its own (main → page, like a server pushing over a WebSocket). Only the
// data reaches the page, never the IPC event itself, which would hand the page ipcRenderer.
function listen<T>(channel: string, listener: (data: T) => void): () => void {
  const handler = (_event: IpcRendererEvent, data: T) => listener(data)
  ipcRenderer.on(channel, handler)
  return () => ipcRenderer.removeListener(channel, handler)
}

const api: Api = {
  pathForFile: (file) => webUtils.getPathForFile(file),
  // invoke = request and response over IPC, like fetch() to an Express route. The main process answers in ipcMain.handle.
  readProject: (path) => ipcRenderer.invoke('project:read', path),
  // send = one-way message with no answer. The main process listens with ipcMain.on.
  setTheme: (theme) => ipcRenderer.send('window:theme', theme),
  loadSettings: () => ipcRenderer.invoke('settings:load'),
  saveSettings: (change) => ipcRenderer.invoke('settings:save', change),
  onSettingsChanged: (listener) => listen('settings:changed', listener),
  findFlStudio: () => ipcRenderer.invoke('fl:find'),
  pickFlStudio: () => ipcRenderer.invoke('fl:pick'),
  pickOutputFolder: () => ipcRenderer.invoke('output:pick'),
  showInFolder: (path) => ipcRenderer.send('shell:show', path),
  openNotes: () => ipcRenderer.send('notes:open'),
  onNotesChanged: (listener) => listen('notes:changed', listener),
  startRun: (request) => ipcRenderer.invoke('run:start', request),
  runStep: (id, step) => ipcRenderer.invoke('run:step', id, step),
  stopRun: (id) => ipcRenderer.send('run:stop', id),
  beatStarsSession: () => ipcRenderer.invoke('beatstars:session'),
  logInToBeatStars: () => ipcRenderer.invoke('beatstars:login'),
  logOutOfBeatStars: () => ipcRenderer.invoke('beatstars:logout'),
}

// Makes `window.api` available to the page. Only what's in `api` crosses over, nothing else.
contextBridge.exposeInMainWorld('api', api)
