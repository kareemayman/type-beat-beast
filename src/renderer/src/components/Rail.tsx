import { CalendarDays, Disc3, HistoryIcon, SettingsIcon, StickyNote, type LucideIcon } from 'lucide-react'
import styles from './Rail.module.css'

export type Screen = 'new' | 'schedule' | 'history' | 'settings'

const ITEMS: [Screen, string, LucideIcon][] = [
  ['new', 'New beat', Disc3],
  ['schedule', 'Schedule', CalendarDays],
  ['history', 'History', HistoryIcon],
  ['settings', 'Settings', SettingsIcon],
]

interface RailProps {
  screen: Screen
  onNavigate(screen: Screen): void
  notesOpen: boolean
  onNotes(): void
}

export default function Rail({ screen, onNavigate, notesOpen, onNotes }: RailProps) {
  return (
    <nav className={styles.rail} aria-label="Main">
      {ITEMS.map(([id, label, Icon]) => (
        <button
          key={id}
          className={styles.item}
          data-on={screen === id}
          aria-label={label}
          title={label}
          aria-current={screen === id ? 'page' : undefined}
          onClick={() => onNavigate(id)}
        >
          <Icon size={22} strokeWidth={2.25} />
        </button>
      ))}
      <div className={styles.spacer} />
      <button className={`${styles.item} ${styles.notes}`} data-on={notesOpen} aria-label="Notes" title="Notes" aria-pressed={notesOpen} onClick={onNotes}>
        <StickyNote size={22} strokeWidth={2.25} />
      </button>
    </nav>
  )
}
