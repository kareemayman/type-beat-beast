import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

export interface Settings {
  themePref: 'dark' | 'light' | 'system'
  motion: 'full' | 'reduced'
  producerName: string
  stems: boolean
  bsFile: 'mp3' | 'wav'
  freeDownload: boolean
  wavBits: '16' | '24' | '32f'
  mp3Rate: '192' | '256' | '320'
  publishTime: string
  tagNames: string[] // mixer track names the user has confirmed as their tag
}

const DEFAULTS: Settings = {
  themePref: 'dark',
  motion: 'full',
  producerName: 'kriko',
  stems: true,
  bsFile: 'mp3',
  freeDownload: true,
  wavBits: '24',
  mp3Rate: '320',
  publishTime: '18:00',
  tagNames: [],
}

const STORAGE_KEY = 'tbb-settings-v1'

function load(): Settings {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') }
  } catch {
    return DEFAULTS
  }
}

interface SettingsContextValue {
  settings: Settings
  update(patch: Partial<Settings>): void
}

const SettingsContext = createContext<SettingsContextValue | null>(null)

// Settings live in the page's localStorage for now. They move to a file the main process owns once the
// main process needs them (render quality, FL Studio path).
export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState(load)
  useEffect(() => localStorage.setItem(STORAGE_KEY, JSON.stringify(settings)), [settings])
  const update = useCallback((patch: Partial<Settings>) => setSettings((current) => ({ ...current, ...patch })), [])
  const value = useMemo(() => ({ settings, update }), [settings, update])
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
