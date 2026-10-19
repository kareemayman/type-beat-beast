import { resolve } from 'node:path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'

// electron-vite builds three separate bundles: the main process, the preload, and the React app (renderer).
// Entry points follow its conventions: src/main/index.ts, src/preload/index.ts, src/renderer/index.html.
export default defineConfig({
  main: {},
  preload: {},
  renderer: {
    plugins: [react()],
    // Two pages: index.html for the main window and notes.html for the Notes window.
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/renderer/index.html'),
          notes: resolve(__dirname, 'src/renderer/notes.html'),
        },
      },
    },
  },
})
