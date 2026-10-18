import type { ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import Card from '../components/Card'
import { Segmented, Switch } from '../components/controls'
import { useSettings } from '../lib/settings'
import styles from './Settings.module.css'

// Every quarter hour of the day, "00:00" to "23:45".
const TIMES = Array.from({ length: 96 }, (_, i) => `${String(Math.floor(i / 4)).padStart(2, '0')}:${String((i % 4) * 15).padStart(2, '0')}`)

// One setting: what it is on the left, its control on the right.
function Row({ title, sub, className = '', children }: { title: string; sub?: string; className?: string; children: ReactNode }) {
  return (
    <div className={`${styles.row} ${className}`}>
      <div className={styles.rowText}>
        <div className={styles.rowTitle}>{title}</div>
        {sub && <div className={styles.rowSub}>{sub}</div>}
      </div>
      {children}
    </div>
  )
}

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
        <div className={styles.column}>
          <Card sticker="Quality" stickerColor="var(--violet)" className={styles.card}>
            <Row title="WAV + stems" sub="Untagged renders">
              <Segmented
                label="WAV bit depth"
                value={settings.wavBits}
                options={[
                  ['16', '16-bit'],
                  ['24', '24-bit'],
                  ['32f', '32 float'],
                ]}
                onChange={(wavBits) => update({ wavBits })}
              />
            </Row>
            <Row title="Tagged MP3">
              <Segmented
                label="MP3 bitrate"
                value={settings.mp3Rate}
                options={[
                  ['192', '192'],
                  ['256', '256'],
                  ['320', '320 kbps'],
                ]}
                onChange={(mp3Rate) => update({ mp3Rate })}
              />
            </Row>
          </Card>

          {/* What every new beat starts with; the Options card on New beat can still change them for one beat. */}
          <Card sticker="Defaults" stickerColor="var(--green)" className={styles.card}>
            <Row title="Upload stems" sub="Packs a RAR and attaches it">
              <Switch label="Upload stems" checked={settings.stems} onChange={(stems) => update({ stems })} />
            </Row>
            <Row title="BeatStars file" sub="Reuse WAV lets BeatStars add its own tag">
              <Segmented
                label="BeatStars file"
                value={settings.bsFile}
                options={[
                  ['mp3', 'Tagged MP3'],
                  ['wav', 'Reuse WAV'],
                ]}
                onChange={(bsFile) => update({ bsFile })}
              />
            </Row>
            <Row title="Free download" sub="Tagged MP3 on BeatStars">
              <Switch label="Free download" checked={settings.freeDownload} onChange={(freeDownload) => update({ freeDownload })} />
            </Row>
          </Card>
        </div>

        <div className={styles.column}>
          <Card sticker="YouTube" stickerColor="var(--rose)" className={styles.card}>
            <Row title="Daily publish time" sub="One video a day, at this time on this PC's clock." className={styles.timeRow}>
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
            </Row>
          </Card>
        </div>
      </div>

      <p className={styles.later}>More settings land here next: paths, BeatStars, tags and looks.</p>
    </div>
  )
}
