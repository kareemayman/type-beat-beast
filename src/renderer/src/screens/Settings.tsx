import { useState, type ReactNode } from 'react'
import { ChevronDown, MicVocal, X } from 'lucide-react'
import Card from '../components/Card'
import { Segmented, Switch } from '../components/controls'
import { useMediaQuery } from '../lib/environment'
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
  const [tagDraft, setTagDraft] = useState('')
  // Windows' own animation switch wins over "Full" (see useReducedMotion).
  const windowsReducesMotion = useMediaQuery('(prefers-reduced-motion: reduce)')

  function addTag() {
    const name = tagDraft.trim()
    if (name && !settings.tagNames.some((tag) => tag.toLowerCase() === name.toLowerCase())) update({ tagNames: [...settings.tagNames, name] })
    setTagDraft('')
  }

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

          {/* The names Tag detection trusts first (see CLAUDE.md). Running a beat adds its tag track's name. */}
          <Card sticker="Tags" stickerColor="var(--yellow)" className={`${styles.card} ${styles.tags}`}>
            <p className={styles.note}>A mixer track with one of these names gets picked as the voice tag. Otherwise the app guesses.</p>
            <div className={styles.chips}>
              {settings.tagNames.length ? (
                settings.tagNames.map((name) => (
                  <span key={name} className={styles.chip}>
                    <MicVocal size={14} strokeWidth={2.75} />
                    <span className={styles.chipName}>{name}</span>
                    <button aria-label={`Forget ${name}`} title={`Forget ${name}`} onClick={() => update({ tagNames: settings.tagNames.filter((tag) => tag !== name) })}>
                      <X size={14} strokeWidth={3} />
                    </button>
                  </span>
                ))
              ) : (
                <span className={styles.none}>None yet. Running a beat adds its tag track's name here.</span>
              )}
            </div>
            <input
              className={styles.addTag}
              value={tagDraft}
              placeholder="Add a track name, press Enter"
              aria-label="Add tag track name"
              onChange={(e) => setTagDraft(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addTag()}
            />
          </Card>

          <Card sticker="Appearance" stickerColor="#F4F7FB" className={styles.card}>
            <Row title="Theme" sub="System follows Windows">
              <Segmented
                label="Theme"
                value={settings.themePref}
                options={[
                  ['dark', 'Dark'],
                  ['light', 'Light'],
                  ['system', 'System'],
                ]}
                onChange={(themePref) => update({ themePref })}
              />
            </Row>
            <Row title="Motion" sub={windowsReducesMotion ? 'Animation effects are off in Windows, so it stays reduced' : 'Reduced swaps bounces for fades'}>
              <Segmented
                label="Motion"
                value={settings.motion}
                options={[
                  ['full', 'Full'],
                  ['reduced', 'Reduced'],
                ]}
                onChange={(motion) => update({ motion })}
              />
            </Row>
          </Card>
        </div>
      </div>

      <p className={styles.later}>Next: paths. The BeatStars and YouTube logins come with their phases.</p>
    </div>
  )
}
