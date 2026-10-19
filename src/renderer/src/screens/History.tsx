import type { CSSProperties } from 'react'
import { Activity, CircleAlert, CircleCheck, CloudUpload, Disc3, FolderOpen, Hand, type LucideIcon } from 'lucide-react'
import { addDays, dayKey, formatTime, fromDayKey, nextFreeSlot, parseTime, type ScheduledVideo } from '../../../shared/schedule'
import { coverStripes, type Beat } from '../lib/beat'
import { demoRuns, demoVideos } from '../lib/demo'
import { DEMO, STEPS, displayStatus, mmss, type Pipeline, type StepStatus } from '../lib/pipeline'
import { useSettings } from '../lib/settings'
import { useToast } from '../lib/toasts'
import styles from './History.module.css'

// One dot per pipeline step.
type Dot = 'done' | 'running' | 'needs' | 'failed' | 'empty'
const DOT_COLOR: Record<Dot, string> = { done: 'var(--green)', running: 'var(--orange)', needs: 'var(--sky)', failed: 'var(--rose)', empty: 'var(--card2)' }
const STEP_DOT: Record<StepStatus, Dot> = { done: 'done', running: 'running', needs: 'needs', failed: 'failed', queued: 'empty', skipped: 'empty' }
const UPLOAD_STEP = STEPS.findIndex((step) => step.id === 'yts')

interface Result {
  color: string
  icon: LucideIcon
  label: string
}

interface Row {
  key: string
  beat: string
  meta: string
  when: string
  seconds: number | null // how long the run took; null before it starts
  art: string // CSS background for the thumbnail
  dots: Dot[]
  result: Result
  onOpen(): void
}

const TILTS = ['-0.4deg', '0.3deg', '-0.2deg', '0.4deg', '-0.3deg', '0.2deg']
const clock = (date: Date) => formatTime({ hours: date.getHours(), minutes: date.getMinutes() })
const weekday = (date: Date) => date.toLocaleDateString('en-GB', { weekday: 'short' }) // "Mon"

// "Today, 17:58", "Yesterday, 21:14" or "Fri 16 Oct, 16:05".
function when(date: Date, now: Date): string {
  if (dayKey(date) === dayKey(now)) return `Today, ${clock(date)}`
  if (dayKey(date) === dayKey(addDays(now, -1))) return `Yesterday, ${clock(date)}`
  return `${date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}, ${clock(date)}`
}

// What became of a run once it left the app: its video's place on the schedule. Everything before the
// YouTube upload went through either way.
function videoResult(video: ScheduledVideo | undefined, at: string): Pick<Row, 'result' | 'dots'> {
  const stuck = (dot: Dot) => STEPS.map((_, i): Dot => (i < UPLOAD_STEP ? 'done' : i === UPLOAD_STEP ? dot : 'empty'))
  const done = STEPS.map((): Dot => 'done')
  switch (video?.status) {
    case 'live':
      return { result: { color: 'var(--green)', icon: CircleCheck, label: 'Live on YouTube' }, dots: done }
    case 'uploading':
      return { result: { color: 'var(--sky)', icon: CloudUpload, label: 'Uploading' }, dots: stuck('needs') }
    case 'failed':
      return { result: { color: 'var(--rose)', icon: CircleAlert, label: 'Upload failed' }, dots: stuck('failed') }
    default:
      return { result: { color: 'var(--green)', icon: CircleCheck, label: video ? `Scheduled · ${weekday(fromDayKey(video.day))} ${at}` : 'Done' }, dots: done }
  }
}

interface HistoryProps {
  beat: Beat // the beat on the New beat screen, shown live at the top
  pipeline: Pipeline
}

export default function History({ beat, pipeline }: HistoryProps) {
  const { settings } = useSettings()
  const toast = useToast()
  const now = new Date()
  const time = parseTime(settings.publishTime) ?? { hours: 18, minutes: 0 }
  const at = formatTime(time)
  const videos = demoVideos(now, time)
  const rows: Row[] = []

  // The beat on New beat, as it goes. A finished demo run takes the next free slot, like the Pipeline says.
  if (beat.fileName) {
    const { steps, phase, current } = pipeline
    const next = nextFreeSlot(videos, now, time)
    const result: Record<typeof phase, Result> = {
      idle: { color: 'var(--yellow)', icon: Disc3, label: 'Ready to run' },
      running: { color: 'var(--orange)', icon: Activity, label: 'Cooking now' },
      needs: { color: 'var(--sky)', icon: Hand, label: 'Waiting on you' },
      failed: { color: 'var(--rose)', icon: CircleAlert, label: `${STEPS[current].short} failed` },
      done: { color: 'var(--green)', icon: CircleCheck, label: `Scheduled · ${weekday(next)} ${at}` },
    }
    const started = steps[0].startedAt
    rows.push({
      key: 'current',
      beat: beat.name || beat.fileName,
      meta: [beat.bpm && `${beat.bpm} BPM`, beat.key].filter(Boolean).join(' · '),
      when: started ? when(new Date(started), now) : 'Not run yet',
      seconds: started ? steps.reduce((sum, step) => sum + step.seconds, 0) : null,
      art: beat.cover ? `center / cover no-repeat url("${beat.cover.url}")` : coverStripes(beat.name || beat.fileName),
      dots: steps.map((step, i) => STEP_DOT[displayStatus(step, i, beat.stems)]),
      result: result[phase],
      onOpen: () => window.api.showInFolder(beat.path),
    })
  }

  for (const run of demoRuns(now)) {
    rows.push({
      key: run.beat,
      beat: run.beat,
      meta: run.meta,
      when: when(run.cookedAt, now),
      seconds: run.seconds,
      art: coverStripes(run.beat),
      ...videoResult(
        videos.find((video) => video.beat === run.beat),
        at,
      ),
      onOpen: () => toast('info', 'Demo: beat folders come with Phase 2.'),
    })
  }

  return (
    <div className={styles.page}>
      <header>
        <h1 className={styles.title}>History</h1>
        <div className={styles.sub}>Every beat that went through the pipeline.</div>
      </header>

      <div className={styles.list}>
        {rows.map((row, i) => {
          const done = row.dots.filter((dot) => dot === 'done').length
          return (
            <div key={row.key} className={styles.row} style={{ '--tilt': TILTS[i % TILTS.length] } as CSSProperties}>
              <span className={styles.art} style={{ background: row.art }} />
              <div className={styles.titles}>
                <div className={styles.beat}>{row.beat}</div>
                <div className={styles.meta}>{[row.when, row.meta].filter(Boolean).join(' · ')}</div>
              </div>
              <span className={styles.dots} role="img" aria-label={`${done} of ${row.dots.length} steps done`}>
                {row.dots.map((dot, j) => (
                  <span key={STEPS[j].id} title={STEPS[j].short} style={{ background: DOT_COLOR[dot] }} />
                ))}
              </span>
              <span className={styles.result} style={{ background: row.result.color }}>
                <row.result.icon size={15} strokeWidth={2.75} />
                <span>{row.result.label}</span>
              </span>
              <span className={styles.time}>{row.seconds === null ? '—' : mmss(row.seconds)}</span>
              <button className={styles.open} onClick={row.onOpen}>
                <FolderOpen size={16} strokeWidth={2.5} />
                Open folder
              </button>
            </div>
          )
        })}
      </div>

      {DEMO && <p className={styles.demo}>Demo runs for now, except the top one when a beat is loaded. Real runs get saved once the steps are real.</p>}
    </div>
  )
}
