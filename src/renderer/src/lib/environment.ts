// Small hooks for things outside React: OS settings, window visibility, the clock and the keyboard.
import { useEffect, useState, useSyncExternalStore } from 'react'
import type { Theme } from '../../../shared/api'
import { useSettings } from './settings'

export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const media = matchMedia(query)
      media.addEventListener('change', onChange)
      return () => media.removeEventListener('change', onChange)
    },
    () => matchMedia(query).matches,
  )
}

// Electron passes Windows' dark/light setting to the page, so "System" theme is just a media query.
export const useSystemDark = () => useMediaQuery('(prefers-color-scheme: dark)')

// The theme on screen: Settings' choice, or Windows' when that's "System". It's applied to the page (CSS picks
// colors from data-theme) and to the window's caption buttons, which the main process recolors.
export function useTheme(): Theme {
  const { settings } = useSettings()
  const systemDark = useSystemDark()
  const theme = settings.themePref === 'system' ? (systemDark ? 'dark' : 'light') : settings.themePref
  useEffect(() => {
    document.documentElement.dataset.theme = theme
    window.api.setTheme(theme)
  }, [theme])
  return theme
}

export function useReducedMotion(): boolean {
  const { settings } = useSettings()
  const osPrefers = useMediaQuery('(prefers-reduced-motion: reduce)')
  return settings.motion === 'reduced' || osPrefers
}

export function useDocumentHidden(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      document.addEventListener('visibilitychange', onChange)
      return () => document.removeEventListener('visibilitychange', onChange)
    },
    () => document.hidden,
  )
}

const isLateNight = () => {
  const hour = new Date().getHours()
  return hour >= 3 && hour < 6
}

// Between 3 and 6 AM a sleepy moon shows up in the title bar.
export function useLateNight(): boolean {
  const [late, setLate] = useState(isLateNight)
  useEffect(() => {
    const timer = setInterval(() => setLate(isLateNight()), 60_000)
    return () => clearInterval(timer)
  }, [])
  return late
}

const KONAMI = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a']

// Typing the Konami code turns on "producer mode" for 10 seconds.
export function useKonami(): boolean {
  const [on, setOn] = useState(false)
  useEffect(() => {
    let keys: string[] = []
    let timer: ReturnType<typeof setTimeout> | undefined
    const onKey = (event: KeyboardEvent) => {
      if (isTyping(event.target)) return
      keys = [...keys, event.key.length === 1 ? event.key.toLowerCase() : event.key].slice(-KONAMI.length)
      if (keys.join() !== KONAMI.join()) return
      keys = []
      setOn(true)
      clearTimeout(timer)
      timer = setTimeout(() => setOn(false), 10_000)
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      clearTimeout(timer)
    }
  }, [])
  return on
}

export function isTyping(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
}
