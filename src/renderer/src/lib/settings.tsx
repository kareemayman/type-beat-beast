import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Settings } from '../../../shared/settings'

export type { Settings }

interface SettingsContextValue {
  settings: Settings
  update(change: Partial<Settings>): void
}

const SettingsContext = createContext<SettingsContextValue | null>(null)

// Before settings moved into a file, they lived in this page's localStorage. On the very first launch with
// the file, that old copy is handed over once, then deleted.
const OLD_KEY = 'tbb-settings-v1'
function takeOldCopy(): Partial<Settings> {
  try {
    const old = localStorage.getItem(OLD_KEY)
    localStorage.removeItem(OLD_KEY)
    return old ? JSON.parse(old) : {}
  } catch {
    return {}
  }
}

// The main process owns the settings (src/main/settings.ts). This loads them once, then every change shows
// up right away here while it's saved in the background.
export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings | null>(null)

  useEffect(() => {
    let current = true
    void (async () => {
      const loaded = (await window.api.loadSettings()) ?? (await window.api.saveSettings(takeOldCopy()))
      if (current) setSettings(loaded)
    })()
    return () => {
      current = false
    }
  }, [])

  const update = useCallback((change: Partial<Settings>) => {
    setSettings((settings) => settings && { ...settings, ...change })
    window.api.saveSettings(change).catch((error) => console.error('Saving settings failed:', error))
  }, [])

  const value = useMemo(() => settings && { settings, update }, [settings, update])
  // The app waits the few milliseconds it takes to load them, so nothing draws with the wrong theme first.
  if (!value) return null
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
}

export function useSettings(): SettingsContextValue {
  const value = useContext(SettingsContext)
  if (!value) throw new Error('useSettings must be used inside <SettingsProvider>')
  return value
}

export function qualityLabel({ wavBits, mp3Rate }: Settings): string {
  return `${wavBits === '32f' ? '32-bit float' : `${wavBits}-bit`} · ${mp3Rate} kbps`
}
