import type { BrowserWindow } from 'electron'
import { createWindow } from './windows'

// The Notes window: the naming rules on a sticky note. It's a window of its own, so it can sit next to
// FL Studio while a project gets its name. Its page is notes.html, a second small React app.
let notes: BrowserWindow | null = null

// Opens Notes, or brings it to the front if it's already open. The main window hears each time it opens or
// closes (main → page), so the rail's Notes button can light up.
export function openNotes(main: BrowserWindow): void {
  if (notes) {
    if (notes.isMinimized()) notes.restore()
    notes.focus()
    return
  }
  const bounds = main.getBounds()
  notes = createWindow('notes.html', {
    width: 420,
    height: 560,
    minWidth: 340,
    minHeight: 400,
    // Over the right side of the main window, below its title bar.
    x: bounds.x + bounds.width - 420 - 48,
    y: bounds.y + 88,
    maximizable: false,
    fullscreenable: false,
    title: 'Notes',
  })
  main.webContents.send('notes:changed', true)
  notes.on('closed', () => {
    notes = null
    if (!main.isDestroyed()) main.webContents.send('notes:changed', false)
  })
}

export function closeNotes(): void {
  notes?.close()
}
