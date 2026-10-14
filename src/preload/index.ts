// Preload: runs inside the window before the page loads, and decides exactly what the React app can use.
import { contextBridge } from 'electron'
import type { Api } from '../shared/api'

const api: Api = {
  versions: {
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node,
  },
}

// Makes `window.api` available to the page. Only what's in `api` crosses over, nothing else.
contextBridge.exposeInMainWorld('api', api)
