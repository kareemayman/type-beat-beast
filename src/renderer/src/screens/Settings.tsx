import { ChevronDown } from 'lucide-react'
import Card from '../components/Card'
import { useSettings } from '../lib/settings'
import styles from './Settings.module.css'

// Every quarter hour of the day, "00:00" to "23:45".
const TIMES = Array.from({ length: 96 }, (_, i) => `${String(Math.floor(i / 4)).padStart(2, '0')}:${String((i % 4) * 15).padStart(2, '0')}`)

// Built card by card from the design. Every change saves right away (see lib/settings.tsx).
export default function Settings() {
  const { settings, update } = useSettings()

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <h1 className={styles.title}>Settings</h1>
        <div className={styles.sub}>Changes save as you go.</div>
      </header>

      <div className={styles.columns}>
        <Card sticker="YouTube" stickerColor="var(--rose)" className={styles.card}>
          <div className={`${styles.row} ${styles.timeRow}`}>
            <div className={styles.rowText}>
              <div className={styles.rowTitle}>Daily publish time</div>
              <div className={styles.rowSub}>One video a day, at this time on this PC's clock.</div>
            </div>
            <label className={styles.time}>
              <span className={styles.timeCaption}>Daily at</span>
              <select
                className={styles.timeSelect}
                value={settings.publishTime}
                aria-label="Daily publish time"
                onChange={(e) => update({ publishTime: e.target.value })}
              >
                {TIMES.map((time) => (
                  <option key={time}>{time}</option>
                ))}
              </select>
              <ChevronDown className={styles.chevron} size={18} strokeWidth={3} />
            </label>
          </div>
        </Card>
      </div>

      <p className={styles.later}>More settings land here next: paths, quality, defaults, BeatStars, tags and looks.</p>
    </div>
  )
}
