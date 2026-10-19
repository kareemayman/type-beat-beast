import { useState, type CSSProperties } from 'react'
import { CalendarClock, CalendarPlus, CircleAlert, CircleCheck, Clock, CloudUpload, Disc3, RotateCcw, SquarePlay, type LucideIcon } from 'lucide-react'
import { addDays, dayKey, formatTime, fromDayKey, nextFreeSlot, parseTime, slotOn, type VideoStatus } from '../../../shared/schedule'
import Card from '../components/Card'
import Mascot, { type MascotKind } from '../components/Mascot'
import { coverStripes } from '../lib/beat'
import { demoVideos } from '../lib/demo'
import { DEMO } from '../lib/pipeline'
import { useSettings } from '../lib/settings'
import { useToast } from '../lib/toasts'
import styles from './Schedule.module.css'

const STATUS: Record<VideoStatus, { color: string; icon: LucideIcon; label: string }> = {
  live: { color: 'var(--green)', icon: CircleCheck, label: 'Live' },
  scheduled: { color: 'var(--orange)', icon: CalendarClock, label: 'Scheduled' },
  uploading: { color: 'var(--sky)', icon: CloudUpload, label: 'Uploading' },
  failed: { color: 'var(--rose)', icon: CircleAlert, label: 'Failed' },
}

// Two weeks of slots, starting yesterday so the last drop stays in view.
const DAYS = 14
const TILTS = ['-1.5deg', '1deg', '-0.5deg', '1.5deg', '-1deg', '0.5deg', '-1.5deg']

const weekday = (date: Date) => date.toLocaleDateString('en-GB', { weekday: 'short' }).toUpperCase() // "MON"
const longDay = (date: Date) => date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }) // "Mon 19 Oct"

interface ScheduleProps {
  beatName: string // the beat waiting on the New beat screen, if it isn't scheduled yet
  mascot: MascotKind
  reduceMotion: boolean
  onGoNewBeat(): void
  onGoSettings(): void
}

export default function Schedule({ beatName, mascot, reduceMotion: rm, onGoNewBeat, onGoSettings }: ScheduleProps) {
  const { settings } = useSettings()
  const toast = useToast()
  const [demoEmpty, setDemoEmpty] = useState(false)

  // Settings keeps the publish time as "HH:MM"; 18:00 is only a fallback, so a broken value can't break the screen.
  const time = parseTime(settings.publishTime) ?? { hours: 18, minutes: 0 }
  const at = formatTime(time)
  const now = new Date()
  const today = dayKey(now)
  const videos = demoEmpty ? [] : demoVideos(now, time)
  const byDay = new Map(videos.map((video) => [video.day, video]))
  const next = nextFreeSlot(videos, now, time)
  const failed = videos.filter((video) => video.status === 'failed')
  const empty = videos.every((video) => video.status === 'live')

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <div className={styles.titles}>
          <h1 className={styles.title}>Schedule</h1>
          <div className={styles.sub}>
            <SquarePlay size={18} strokeWidth={2.25} />
            YouTube · one drop a day at {at}
          </div>
        </div>
        {!empty && (
          <span className={styles.slot}>
            <span className={styles.slotLabel}>Next free slot</span>
            <span className={styles.slotWhen}>
              {longDay(next)} · {at}
            </span>
          </span>
        )}
        <button className={styles.button} onClick={onGoSettings}>
          <Clock size={16} strokeWidth={2.5} />
          Change time
        </button>
      </header>

      {empty ? (
        <Card className={styles.empty}>
          <span className={styles.sleeper} aria-hidden="true">
            <svg width="134" height="140" viewBox="0 0 134 140">
              <polygon points="46,12 88,12 124,116 10,116" transform="translate(5 5)" fill="#000" />
              <polygon points="46,12 88,12 124,116 10,116" fill="#A78BFA" stroke="#000" strokeWidth="3" strokeLinejoin="round" />
              <rect x="2" y="110" width="130" height="24" rx="10" fill="#FACC15" stroke="#000" strokeWidth="3" />
              <line x1="67" y1="104" x2="67" y2="28" stroke="#000" strokeWidth="5" strokeLinecap="round" />
              <rect x="57" y="40" width="20" height="13" rx="3" fill="#FF6500" stroke="#000" strokeWidth="3" />
              <path d="M 36 80 q 7 7 14 0" fill="none" stroke="#000" strokeWidth="3.5" strokeLinecap="round" />
              <path d="M 84 80 q 7 7 14 0" fill="none" stroke="#000" strokeWidth="3.5" strokeLinecap="round" />
            </svg>
            <span className={styles.z} style={{ animation: rm ? 'none' : 'tbcZ 2.4s ease-out infinite' }}>
              z
            </span>
            <span className={`${styles.z} ${styles.zBig}`} style={{ animation: rm ? 'none' : 'tbcZ 2.4s ease-out 1.2s infinite' }}>
              z
            </span>
          </span>
          <div className={styles.emptyTitle}>Nothing scheduled. Go cook something.</div>
          <div className={styles.emptyNote}>Finished beats land in the next free daily slot at {at}.</div>
          <button className={styles.cta} onClick={onGoNewBeat}>
            <Disc3 size={22} strokeWidth={2.5} />
            New beat
          </button>
        </Card>
      ) : (
        <>
          <ol className={styles.grid} aria-label="Daily slots">
            {Array.from({ length: DAYS }, (_, i) => {
              const date = addDays(now, i - 1)
              const key = dayKey(date)
              const video = byDay.get(key)
              const tilt = { '--tilt': TILTS[i % TILTS.length] } as CSSProperties
              const head = (
                <span className={styles.padHead}>
                  <span className={styles.weekday}>{weekday(date)}</span>
                  <span className={styles.date}>{date.getDate()}</span>
                  {key === today && <span className={styles.today}>TODAY</span>}
                </span>
              )

              if (video) {
                const { color, icon: Icon, label } = STATUS[video.status]
                return (
                  <li key={key}>
                    <div className={styles.pad} style={tilt}>
                      {head}
                      <span className={styles.thumb} style={{ background: coverStripes(video.beat) }}>
                        {video.status === 'uploading' && (
                          <span className={styles.upload} role="progressbar" aria-label="Upload" aria-valuenow={video.progress ?? 0}>
                            <span style={{ transform: `scaleX(${(video.progress ?? 0) / 100})` }} />
                          </span>
                        )}
                        <span className={styles.time}>{at}</span>
                      </span>
                      <span className={styles.beat}>{video.beat}</span>
                      <span className={styles.status} style={{ background: color }}>
                        <Icon size={13} strokeWidth={3} />
                        <span>{label}</span>
                      </span>
                    </div>
                  </li>
                )
              }

              // The next free slot doubles as a shortcut to cook something for it.
              if (key === dayKey(next)) {
                return (
                  <li key={key}>
                    <button className={styles.pad} data-kind="next" style={tilt} onClick={onGoNewBeat}>
                      {head}
                      <span className={styles.nextBody}>
                        <CalendarPlus size={24} strokeWidth={2.5} />
                        <span className={styles.nextTitle}>Next free!</span>
                        <span className={styles.nextSub}>{beatName ? `${beatName} lands here` : 'Your next beat lands here'}</span>
                      </span>
                    </button>
                  </li>
                )
              }

              // A day whose slot has gone by with nothing on it.
              const gone = slotOn(date, time) <= now
              return (
                <li key={key}>
                  <div className={styles.pad} data-kind={gone ? 'gone' : 'free'}>
                    {head}
                    <span className={styles.freeText}>{gone ? 'No drop' : `Free · ${at}`}</span>
                  </div>
                </li>
              )
            })}
          </ol>

          {failed.map((video) => (
            <Card key={video.day} className={styles.failed}>
              <span className={styles.failMascot}>
                <Mascot kind={mascot} mood="fail" size={68} reduceMotion={rm} />
                <span className={styles.failBadge}>
                  <CircleAlert size={14} strokeWidth={3} />
                </span>
              </span>
              <div className={styles.failText}>
                <div className={styles.failTitle}>
                  {video.beat} didn't upload ({longDay(fromDayKey(video.day))})
                </div>
                <div className={styles.failNote}>{video.error ?? 'The upload failed.'}</div>
              </div>
              <button className={styles.button} onClick={() => toast('info', 'Demo: retrying comes with the YouTube step.')}>
                <RotateCcw size={16} strokeWidth={2.5} />
                Retry upload
              </button>
            </Card>
          ))}
        </>
      )}

      {DEMO && (
        <p className={styles.demo}>
          Demo days for now. The real ones come from YouTube once it's connected.{' '}
          <button onClick={() => setDemoEmpty((on) => !on)}>{demoEmpty ? 'Show the demo days' : 'Peek at the empty screen'}</button>
        </p>
      )}
    </div>
  )
}
