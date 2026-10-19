import { useCallback, useEffect, useRef, useState } from 'react'
import { RotateCcw, StickyNote } from 'lucide-react'
import { DEFAULT_SETTINGS } from '../../../shared/settings'
import ConfirmButton from '../components/ConfirmButton'
import { useReducedMotion, useTheme } from '../lib/environment'
import { useSettings } from '../lib/settings'
import styles from './Notes.module.css'

const SAVE_DELAY = 600 // ms after the last keystroke

// The naming rules on a sticky note, editable. The text is saved with the settings shortly after typing stops.
export default function Notes() {
  const { settings, update } = useSettings()
  useTheme()
  const reduceMotion = useReducedMotion()
  // The text lives here while it's being edited and is read from the settings only once, so a save coming back
  // from another window can never move the caret.
  const [text, setText] = useState(settings.notes)
  const [saving, setSaving] = useState(false)
  const unsaved = useRef<string | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)

  const save = useCallback(() => {
    clearTimeout(timer.current)
    if (unsaved.current !== null) update({ notes: unsaved.current })
    unsaved.current = null
    setSaving(false)
  }, [update])

  function change(next: string) {
    setText(next)
    setSaving(true)
    unsaved.current = next
    clearTimeout(timer.current)
    timer.current = setTimeout(save, SAVE_DELAY)
  }

  // Closing the window right after typing still saves the last words.
  useEffect(() => {
    window.addEventListener('beforeunload', save)
    return () => window.removeEventListener('beforeunload', save)
  }, [save])

  const lines = text.split('\n').length

  return (
    <div className={`${styles.window} grid-bg`}>
      <header className={styles.bar}>
        <span className={styles.badge}>
          <StickyNote size={14} strokeWidth={2.5} />
        </span>
        <span className={styles.name}>Notes</span>
      </header>

      <main className={styles.body}>
        <div className={styles.note}>
          <span className={styles.tape} aria-hidden="true" />
          <div className={styles.noteHead}>
            <h1 className={styles.heading}>Naming rules</h1>
            <ConfirmButton className={styles.reset} onConfirm={() => change(DEFAULT_SETTINGS.notes)} confirmLabel="Click again to reset">
              <RotateCcw size={14} strokeWidth={2.5} />
              Reset
            </ConfirmButton>
          </div>
          <textarea className={styles.text} value={text} onChange={(e) => change(e.target.value)} aria-label="Notes" spellCheck={false} />
        </div>
      </main>

      <footer className={styles.foot}>
        <span
          className={styles.led}
          data-saving={saving}
          style={{ animation: saving && !reduceMotion ? 'tbcBreathe 0.8s ease-in-out infinite' : 'none' }}
        />
        <span>{saving ? 'Saving…' : 'Saved'}</span>
        <span className={styles.lines}>
          {lines} {lines === 1 ? 'line' : 'lines'}
        </span>
      </footer>
    </div>
  )
}
