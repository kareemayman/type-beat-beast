import { useEffect, useRef, useState } from 'react'
import { Moon, MoonStar, Sparkles, Sun } from 'lucide-react'
import type { Theme } from '../../../shared/api'
import type { Phase } from '../lib/pipeline'
import styles from './TitleBar.module.css'

const DOT: Record<Phase, string> = { running: '#FF6500', needs: '#38BDF8', failed: '#FF4D6D', done: '#22C55E', idle: '#5B7290' }

interface TitleBarProps {
  beatName: string
  beatInfo: string // "132 · F min"
  phase: Phase
  beatSec: number
  reduceMotion: boolean
  theme: Theme
  onToggleTheme(): void
  lateNight: boolean
  producerMode: boolean
  producerName: string
}

// The app's own title bar. The whole bar drags the window (-webkit-app-region: drag), its buttons opt out,
// and the right 140 px stay empty for the minimize/maximize/close buttons Windows draws on top.
export default function TitleBar(props: TitleBarProps) {
  const { beatName, beatInfo, phase, beatSec, reduceMotion, theme, onToggleTheme, lateNight, producerMode, producerName } = props
  const [bouncing, setBouncing] = useState(false)
  const [moonTip, setMoonTip] = useState(false)
  const clicks = useRef<number[]>([])
  const bounceTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  useEffect(() => () => clearTimeout(bounceTimer.current), [])

  const b = beatSec.toFixed(3)

  // Easter egg: five clicks on the logo within 2 seconds make it bounce to the beat for 8 beats.
  const onLogo = () => {
    const now = Date.now()
    clicks.current = [...clicks.current.filter((t) => now - t < 2000), now]
    if (clicks.current.length < 5) return
    clicks.current = []
    setBouncing(true)
    clearTimeout(bounceTimer.current)
    bounceTimer.current = setTimeout(() => setBouncing(false), beatSec * 8000 + 60)
  }

  const ThemeIcon = theme === 'dark' ? Sun : Moon
  const themeLabel = theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'

  return (
    <header className={styles.bar}>
      <div className={styles.logoCell}>
        <button className={styles.logo} onClick={onLogo} aria-label="Type Beat Beast">
          <span className={styles.logoMark} style={{ animation: bouncing && !reduceMotion ? `tbcBounce ${b}s cubic-bezier(.3,0,.3,1) 8` : 'none' }}>
            {[6, 13, 9, 4].map((height, i) => (
              <span key={i} style={{ height }} />
            ))}
          </span>
        </button>
      </div>
      <span className={styles.title}>Type Beat Beast</span>

      {producerMode ? (
        <span className={styles.producer}>
          <Sparkles size={16} strokeWidth={2.25} />
          {producerName} on the track
        </span>
      ) : (
        beatName && (
          <span className={styles.pill}>
            <span
              className={styles.dot}
              style={{ background: DOT[phase], animation: phase === 'running' && !reduceMotion ? `tbcBreathe ${b}s ease-out infinite` : 'none' }}
            />
            <span className={styles.pillName}>{beatName}</span>
            {beatInfo && <span className={styles.dim}>{beatInfo}</span>}
          </span>
        )
      )}

      <div className={styles.spacer} />
      <div className={styles.actions}>
        {lateNight && (
          <div className={styles.moonWrap}>
            <button
              className={styles.moon}
              aria-label="Go to sleep. The beat will still slap tomorrow."
              onMouseEnter={() => setMoonTip(true)}
              onMouseLeave={() => setMoonTip(false)}
              onFocus={() => setMoonTip(true)}
              onBlur={() => setMoonTip(false)}
            >
              <span className={styles.moonIcon} style={{ animation: reduceMotion ? 'none' : 'tbcSway 4s ease-in-out infinite' }}>
                <MoonStar size={18} strokeWidth={2.25} />
              </span>
              <span aria-hidden="true" className={styles.z} style={{ animation: reduceMotion ? 'none' : 'tbcZ 2.4s ease-out infinite' }}>
                z
              </span>
            </button>
            {moonTip && (
              <div role="tooltip" className={styles.tooltip}>
                Go to sleep. The beat will still slap tomorrow.
              </div>
            )}
          </div>
        )}
        <button className={styles.iconButton} onClick={onToggleTheme} aria-label={themeLabel} title={themeLabel}>
          <ThemeIcon size={18} strokeWidth={2.25} />
        </button>
      </div>
      <div className={styles.captionSpace} aria-hidden="true" />
    </header>
  )
}
